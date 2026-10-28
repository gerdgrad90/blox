process.env.DISABLE_HMR = 'true';

import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

interface RemoteSkin {
  skinColor: string;
  torsoColor: string;
  legsColor: string;
  hat: string;
  face: string;
  outfit?: string;
  backpack?: string;
  name: string;
}

interface RoomPlayerState {
  id: string;
  roomId: string;
  skin: RemoteSkin;
  position: [number, number, number];
  rotationY: number;
  isMoving: boolean;
  isGrounded: boolean;
  activeTool: string;
  checkpoint: number;
  coins: number;
  isAttacking?: boolean;
  lastUpdated: number;
}

interface RoomBlock {
  key: string;
  position: [number, number, number];
  color: string;
}

interface ChatMessage {
  id: string;
  author: string;
  text: string;
  timestamp: number;
}

interface RoomState {
  id: string;
  mode: 'online' | 'lan';
  players: Map<string, RoomPlayerState>;
  clients: Map<string, WebSocket>;
  blocks: Map<string, RoomBlock>;
  chatHistory: ChatMessage[];
}

const rooms = new Map<string, RoomState>();

function getOrCreateRoom(roomId: string, mode: 'online' | 'lan' = 'online'): RoomState {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      mode,
      players: new Map(),
      clients: new Map(),
      blocks: new Map(),
      chatHistory: [
        {
          id: 'welcome_1',
          author: 'Сервер',
          text: `Добро пожаловать в комнату ${roomId === 'public_obby' ? 'Глобальный Паркур #1' : roomId}!`,
          timestamp: Date.now(),
        },
      ],
    };
    rooms.set(roomId, room);
  }
  return room;
}

function broadcastToRoom(room: RoomState, payload: unknown, excludeId?: string) {
  const msg = JSON.stringify(payload);
  room.clients.forEach((ws, clientId) => {
    if (clientId !== excludeId && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  });
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json());

  // API endpoint for active multiplayer servers / rooms
  app.get('/api/servers', (_req, res) => {
    const publicRoom = getOrCreateRoom('public_obby', 'online');
    const serverList: { id: string; mode: string; playerCount: number; players: string[] }[] = [];

    rooms.forEach((r) => {
      if (r.players.size > 0 || r.id === 'public_obby') {
        serverList.push({
          id: r.id,
          mode: r.mode,
          playerCount: r.players.size,
          players: Array.from(r.players.values()).map((p) => p.skin.name),
        });
      }
    });

    res.json({
      onlinePlayersTotal: Array.from(rooms.values()).reduce((acc, r) => acc + r.players.size, 0),
      publicRoomPlayers: publicRoom.players.size,
      servers: serverList,
    });
  });

  // WebSocket Server using noServer: true so it never aborts other upgrade requests
  const wss = new WebSocketServer({ noServer: true });
  const viteNoopWss = new WebSocketServer({ noServer: true });

  viteNoopWss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'connected' }));
  });

  server.on('upgrade', (req, socket, head) => {
    const pathname = req.url ? req.url.split('?')[0] : '';
    if (pathname === '/ws/game') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      // Gracefully accept any @vite/client HMR websocket upgrade so it never throws
      viteNoopWss.handleUpgrade(req, socket, head, (ws) => {
        viteNoopWss.emit('connection', ws, req);
      });
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    let clientId = `p_${Math.random().toString(36).slice(2, 9)}`;
    let currentRoomId: string | null = null;

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(String(raw));
        const { type, payload } = data;

        if (type === 'room:join') {
          // Leave previous room if any
          if (currentRoomId) {
            const oldRoom = rooms.get(currentRoomId);
            if (oldRoom) {
              oldRoom.players.delete(clientId);
              oldRoom.clients.delete(clientId);
              broadcastToRoom(oldRoom, { type: 'player:left', payload: { id: clientId } });
            }
          }

          if (payload?.clientId) {
            clientId = String(payload.clientId);
          }
          const targetRoomId = String(payload?.roomId || 'public_obby');
          const mode = payload?.mode === 'lan' ? 'lan' : 'online';
          currentRoomId = targetRoomId;

          const room = getOrCreateRoom(targetRoomId, mode);
          const newPlayer: RoomPlayerState = {
            id: clientId,
            roomId: targetRoomId,
            skin: payload?.skin || {
              skinColor: '#e5c298',
              torsoColor: '#141619',
              legsColor: '#18181b',
              hat: 'rocker_hair',
              face: 'squiggly',
              outfit: 'rock_jacket',
              backpack: 'fuel_jetpack',
              name: 'RockBlox',
            },
            position: payload?.position || [0, 1.5, 0],
            rotationY: payload?.rotationY || 0,
            isMoving: false,
            isGrounded: true,
            activeTool: payload?.activeTool || 'sword',
            checkpoint: payload?.checkpoint || 0,
            coins: payload?.coins || 0,
            lastUpdated: Date.now(),
          };

          room.players.set(clientId, newPlayer);
          room.clients.set(clientId, ws);

          // Send full authoritative room state to joining player
          ws.send(
            JSON.stringify({
              type: 'room:init',
              payload: {
                selfId: clientId,
                roomId: targetRoomId,
                players: Array.from(room.players.values()),
                blocks: Array.from(room.blocks.values()),
                chatHistory: room.chatHistory,
              },
            })
          );

          // Notify other players in the room
          broadcastToRoom(
            room,
            {
              type: 'player:joined',
              payload: newPlayer,
            },
            clientId
          );
        } else if (type === 'player:move' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          const p = room?.players.get(clientId);
          if (room && p && payload) {
            if (Array.isArray(payload.position)) p.position = payload.position;
            if (typeof payload.rotationY === 'number') p.rotationY = payload.rotationY;
            if (typeof payload.isMoving === 'boolean') p.isMoving = payload.isMoving;
            if (typeof payload.isGrounded === 'boolean') p.isGrounded = payload.isGrounded;
            if (typeof payload.activeTool === 'string') p.activeTool = payload.activeTool;
            if (typeof payload.checkpoint === 'number') p.checkpoint = payload.checkpoint;
            if (typeof payload.coins === 'number') p.coins = payload.coins;
            p.lastUpdated = Date.now();

            broadcastToRoom(
              room,
              {
                type: 'player:updated',
                payload: {
                  id: clientId,
                  position: p.position,
                  rotationY: p.rotationY,
                  isMoving: p.isMoving,
                  isGrounded: p.isGrounded,
                  activeTool: p.activeTool,
                  checkpoint: p.checkpoint,
                  coins: p.coins,
                },
              },
              clientId
            );
          }
        } else if (type === 'player:skin' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          const p = room?.players.get(clientId);
          if (room && p && payload?.skin) {
            p.skin = payload.skin;
            broadcastToRoom(
              room,
              {
                type: 'player:skin_updated',
                payload: { id: clientId, skin: p.skin },
              },
              clientId
            );
          }
        } else if (type === 'player:attack' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room) {
            broadcastToRoom(
              room,
              {
                type: 'player:attacked',
                payload: { id: clientId },
              },
              clientId
            );
          }
        } else if (type === 'block:place' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room && payload?.key && Array.isArray(payload?.position)) {
            if (!room.blocks.has(payload.key) && room.blocks.size < 100) {
              const block: RoomBlock = {
                key: String(payload.key),
                position: payload.position,
                color: String(payload.color || '#ef4444'),
              };
              room.blocks.set(block.key, block);
              broadcastToRoom(room, { type: 'block:placed', payload: block });
            }
          }
        } else if (type === 'block:remove' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room && payload?.key) {
            if (room.blocks.has(payload.key)) {
              room.blocks.delete(payload.key);
              broadcastToRoom(room, { type: 'block:removed', payload: { key: payload.key } });
            }
          }
        } else if (type === 'chat:send' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room && payload?.text) {
            const msg: ChatMessage = {
              id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              author: String(payload.author || 'Игрок'),
              text: String(payload.text).slice(0, 140),
              timestamp: Date.now(),
            };
            room.chatHistory.push(msg);
            if (room.chatHistory.length > 25) {
              room.chatHistory.shift();
            }
            broadcastToRoom(room, { type: 'chat:message', payload: msg });
          }
        }
      } catch {
        // Ignore malformed packets
      }
    });

    ws.on('close', () => {
      if (currentRoomId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const leavingPlayer = room.players.get(clientId);
          room.players.delete(clientId);
          room.clients.delete(clientId);
          broadcastToRoom(room, {
            type: 'player:left',
            payload: { id: clientId, name: leavingPlayer?.skin.name },
          });
        }
      }
    });
  });

  // Vite middleware in dev or static serving in prod
  if (process.env.NODE_ENV !== 'production') {
    // Serve a clean, WebSocket-free /@vite/client shim so the browser never attempts
    // a failing HMR WebSocket connection (port 24678) in Cloud Run / iframe environments.
    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
let lastInsertedStyle;
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll(\`link[rel="stylesheet"][data-vite-dev-id="\${CSS.escape(id)}"]\`).forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    invalidate() {},
    decline() {},
    on() {},
    off() {},
    send() {},
    data: {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return \`\${pathname}?\${queryToInject}\${search ? "&" + search.slice(1) : ""}\${hash || ""}\`;
}
export class ErrorOverlay extends (typeof HTMLElement !== "undefined" ? HTMLElement : class {}) {
  close() { this.parentNode?.removeChild(this); }
}
`);
    });

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Blox World Multiplayer Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

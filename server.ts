process.env.DISABLE_HMR = 'true';
import 'dotenv/config';

import express from 'express';
import fs from 'fs';
import crypto from 'crypto';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import type { ViteDevServer } from 'vite';
import { filterProfanity } from './src/game/profanityFilter';
import { getEmoteById, isValidEmoteId } from './src/game/emotes';

process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
});

interface RemoteSkin {
  skinColor: string;
  torsoColor: string;
  legsColor: string;
  headShape?: 'round' | 'blocky';
  hat: string;
  face: string;
  outfit?: string;
  shirt?: string;
  pants?: string;
  backpack?: string;
  playerTitleId?: string | null;
  name: string;
}

interface RoomPlayerState {
  id: string;
  playerKey?: string;
  bio?: string;
  gems?: number;
  unlockedAchievements?: Record<string, number>;
  lifetimeStats?: {
    totalJumps: number;
    totalDeaths: number;
  };
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
  activeEmote?: { id: string; expiresAt: number } | null;
  voiceEnabled?: boolean;
  voiceMuted?: boolean;
  voiceSpeaking?: boolean;
  lastUpdated: number;
  transport?: 'ws' | 'http' | 'relay';
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

interface RoomEventEntry {
  seq: number;
  type: string;
  payload: any;
  senderId?: string;
  ts: number;
}

interface RoomState {
  id: string;
  gameId: string;
  mode: 'online' | 'lan';
  players: Map<string, RoomPlayerState>;
  clients: Map<string, WebSocket>;
  blocks: Map<string, RoomBlock>;
  openedDoors: Set<number>;
  elevatorClosed: boolean;
  chatHistory: ChatMessage[];
  eventSeq: number;
  recentEvents: RoomEventEntry[];
}

const rooms = new Map<string, RoomState>();

function inferGameIdFromRoom(roomId: string): string {
  const lower = String(roomId || '').toLowerCase();
  if (lower.startsWith('doors-') || lower === 'public_doors' || lower.includes('doors')) return 'doors';
  if (lower.startsWith('lava_survival-') || lower === 'public_lava' || lower.includes('lava')) return 'lava_survival';
  if (lower.startsWith('bee_swarm-') || lower === 'public_bee' || lower.includes('bee')) return 'bee_swarm';
  if (lower.startsWith('studio-') || lower === 'public_studio' || lower.includes('studio')) return 'studio';
  if (lower.startsWith('obby-') || lower === 'public_obby' || lower.includes('obby')) return 'obby';
  return 'doors';
}

function isStandardPublicRoomId(roomId: string): boolean {
  return (
    roomId === 'doors-main' ||
    roomId === 'obby-main' ||
    roomId === 'lava_survival-main' ||
    roomId === 'bee_swarm-main' ||
    roomId === 'studio-main' ||
    roomId === 'public_doors' ||
    roomId === 'public_obby' ||
    roomId === 'public_lava' ||
    roomId === 'public_bee' ||
    roomId === 'public_studio'
  );
}

function normalizeServerRoomId(
  rawRoomId: string,
  mode: 'online' | 'lan' = 'online',
  fallbackGameId?: string
): string {
  const validGames = ['doors', 'obby', 'lava_survival', 'bee_swarm', 'studio'];
  const safeGame =
    fallbackGameId && validGames.includes(fallbackGameId)
      ? fallbackGameId
      : inferGameIdFromRoom(rawRoomId);
  const trimmed = String(rawRoomId || '').trim();
  const lower = trimmed.toLowerCase();

  const isPublicAlias =
    !trimmed ||
    lower === 'public_doors' ||
    lower === 'doors-main' ||
    lower === 'public_obby' ||
    lower === 'obby-main' ||
    lower === 'public_lava' ||
    lower === 'lava_survival-main' ||
    lower === 'public_bee' ||
    lower === 'bee_swarm-main' ||
    lower === 'public_studio' ||
    lower === 'studio-main';

  if (isPublicAlias) {
    if (lower === 'public_doors' || lower === 'doors-main') return 'doors-main';
    if (lower === 'public_obby' || lower === 'obby-main') return 'obby-main';
    if (lower === 'public_lava' || lower === 'lava_survival-main') return 'lava_survival-main';
    if (lower === 'public_bee' || lower === 'bee_swarm-main') return 'bee_swarm-main';
    if (lower === 'public_studio' || lower === 'studio-main') return 'studio-main';
    return `${safeGame}-main`;
  }

  const stripped = trimmed.replace(/^(doors|obby|lava_survival|bee_swarm|studio|room)-/i, '');
  const cleanCode = stripped.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 16) || 'OBBY777';
  return `room-${cleanCode}`;
}

function getOrCreateRoom(
  rawRoomId: string,
  mode: 'online' | 'lan' = 'online',
  gameId?: string
): RoomState {
  const roomId = normalizeServerRoomId(rawRoomId, mode, gameId);
  const resolvedMode: 'online' | 'lan' = isStandardPublicRoomId(roomId) ? 'online' : mode;
  let room = rooms.get(roomId);
  if (!room) {
    const resolvedGameId = gameId || inferGameIdFromRoom(roomId);
    room = {
      id: roomId,
      gameId: resolvedGameId,
      mode: resolvedMode,
      players: new Map(),
      clients: new Map(),
      blocks: new Map(),
      openedDoors: new Set<number>(),
      elevatorClosed: false,
      chatHistory: [
        {
          id: 'welcome_1',
          author: 'Сервер',
          text: `Добро пожаловать в комнату ${isStandardPublicRoomId(roomId) ? 'Онлайн-сервер' : roomId}!`,
          timestamp: Date.now(),
        },
      ],
      eventSeq: 0,
      recentEvents: [],
    };
    rooms.set(roomId, room);
  } else if (gameId && (room.players.size === 0 || !room.gameId)) {
    room.gameId = gameId;
  }
  return room;
}

const serverRelaySockets: { url: string; ws: WebSocket | null; ready: boolean }[] = [];
const serverSeenRelayMids = new Set<string>();
const serverPresenceReplyThrottle = new Map<string, number>();

function encodeMqttRemLen(len: number): number[] {
  const out: number[] = [];
  let rem = len;
  do {
    let d = rem % 128;
    rem = Math.floor(rem / 128);
    if (rem > 0) d |= 0x80;
    out.push(d);
  } while (rem > 0);
  return out;
}

function encodeMqttStr(str: string): Buffer {
  const b = Buffer.from(str, 'utf8');
  return Buffer.concat([Buffer.from([(b.length >> 8) & 0xff, b.length & 0xff]), b]);
}

function buildServerMqttPublish(topic: string, jsonStr: string): Buffer {
  const tBuf = encodeMqttStr(topic);
  const mBuf = Buffer.from(jsonStr, 'utf8');
  const rem = encodeMqttRemLen(tBuf.length + mBuf.length);
  return Buffer.concat([Buffer.from([0x30, ...rem]), tBuf, mBuf]);
}

function publishToServerCloudRelay(
  roomId: string,
  senderId: string,
  packet: { type: string; payload?: any }
) {
  const mid = `srv_${senderId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  serverSeenRelayMids.add(mid);
  if (serverSeenRelayMids.size > 500) {
    const oldest = serverSeenRelayMids.values().next().value;
    if (oldest) serverSeenRelayMids.delete(oldest);
  }
  const envStr = JSON.stringify({
    mid,
    senderId,
    roomId,
    ts: Date.now(),
    packet,
  });
  const frame = buildServerMqttPublish(`bloxhub3d/v2/room/${roomId}`, envStr);
  for (const link of serverRelaySockets) {
    if (link.ready && link.ws && link.ws.readyState === WebSocket.OPEN) {
      try {
        link.ws.send(frame);
      } catch {}
    }
  }
}

function buildServerMqttConnect(clientId: string, username?: string, password?: string): Buffer {
  const hasAuth = Boolean(username && password);
  const flags = hasAuth ? 0xc2 : 0x02;
  const vh = Buffer.from([0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, flags, 0x00, 0x3c]);
  const plParts: Buffer[] = [encodeMqttStr(clientId)];
  if (hasAuth && username && password) {
    plParts.push(encodeMqttStr(username), encodeMqttStr(password));
  }
  const pl = Buffer.concat(plParts);
  const rem = encodeMqttRemLen(vh.length + pl.length);
  return Buffer.concat([Buffer.from([0x10, ...rem]), vh, pl]);
}

function buildServerMqttSubscribe(topic: string, packetId: number = 1): Buffer {
  const vh = Buffer.from([(packetId >> 8) & 0xff, packetId & 0xff]);
  const pl = Buffer.concat([encodeMqttStr(topic), Buffer.from([0x00])]);
  const rem = encodeMqttRemLen(vh.length + pl.length);
  return Buffer.concat([Buffer.from([0x82, ...rem]), vh, pl]);
}

function parseServerMqttFrames(buf: Buffer): { type: number; topic?: string; payloadText?: string }[] {
  const out: { type: number; topic?: string; payloadText?: string }[] = [];
  let offset = 0;
  while (offset < buf.length) {
    const header = buf[offset];
    let mult = 1;
    let len = 0;
    let idx = offset + 1;
    let valid = false;
    while (idx < buf.length) {
      const b = buf[idx++];
      len += (b & 0x7f) * mult;
      mult *= 128;
      if ((b & 0x80) === 0) {
        valid = true;
        break;
      }
    }
    if (!valid || idx + len > buf.length) break;
    const type = header >> 4;
    if (type === 3 && len >= 2) {
      const tLen = (buf[idx] << 8) | buf[idx + 1];
      const qos = (header >> 1) & 0x03;
      const pStart = idx + 2 + tLen + (qos > 0 ? 2 : 0);
      const pEnd = idx + len;
      if (pStart <= pEnd) {
        out.push({
          type,
          topic: buf.slice(idx + 2, idx + 2 + tLen).toString('utf8'),
          payloadText: buf.slice(pStart, pEnd).toString('utf8'),
        });
      }
    } else {
      out.push({ type });
    }
    offset = idx + len;
  }
  return out;
}

function pushRoomEvent(room: RoomState, type: string, payload: any, senderId?: string) {
  room.eventSeq += 1;
  room.recentEvents.push({
    seq: room.eventSeq,
    type,
    payload,
    senderId,
    ts: Date.now(),
  });
  if (room.recentEvents.length > 150) {
    room.recentEvents.splice(0, room.recentEvents.length - 150);
  }
}

function broadcastToRoom(
  room: RoomState,
  payload: { type: string; payload?: any },
  excludeId?: string,
  forwardToCloudRelay: boolean = true
) {
  pushRoomEvent(room, payload.type, payload.payload, excludeId);
  const msg = JSON.stringify(payload);
  room.clients.forEach((ws, clientId) => {
    if (clientId !== excludeId && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  });
  if (forwardToCloudRelay && excludeId) {
    publishToServerCloudRelay(room.id, excludeId, payload);
  }
}

function sanitizeVoiceSignalPayload(raw: any): {
  to: string;
  signalType: 'offer' | 'answer' | 'ice';
  sdp?: { type: string; sdp?: string };
  candidate?: Record<string, any>;
  signalId: string;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const to = typeof raw.to === 'string' ? raw.to.trim().slice(0, 128) : '';
  const signalType = raw.signalType;
  if (!to || (signalType !== 'offer' && signalType !== 'answer' && signalType !== 'ice')) {
    return null;
  }
  const signalId =
    typeof raw.signalId === 'string' && raw.signalId.trim()
      ? raw.signalId.trim().slice(0, 96)
      : `vsig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  if (signalType === 'offer' || signalType === 'answer') {
    if (!raw.sdp || typeof raw.sdp !== 'object' || typeof raw.sdp.type !== 'string') return null;
    const sdpText = typeof raw.sdp.sdp === 'string' ? raw.sdp.sdp.slice(0, 32768) : '';
    return {
      to,
      signalType,
      sdp: { type: raw.sdp.type.slice(0, 24), sdp: sdpText },
      signalId,
    };
  }

  if (!raw.candidate || typeof raw.candidate !== 'object') return null;
  const candStr = typeof raw.candidate.candidate === 'string' ? raw.candidate.candidate.slice(0, 2048) : '';
  return {
    to,
    signalType: 'ice',
    candidate: {
      candidate: candStr,
      sdpMid: typeof raw.candidate.sdpMid === 'string' ? raw.candidate.sdpMid.slice(0, 64) : null,
      sdpMLineIndex:
        typeof raw.candidate.sdpMLineIndex === 'number' ? raw.candidate.sdpMLineIndex : null,
      usernameFragment:
        typeof raw.candidate.usernameFragment === 'string'
          ? raw.candidate.usernameFragment.slice(0, 64)
          : undefined,
    },
    signalId,
  };
}

function relayVoiceSignalInRoom(
  room: RoomState,
  fromId: string,
  rawPayload: any,
  forwardToCloudRelay: boolean = true
) {
  const clean = sanitizeVoiceSignalPayload(rawPayload);
  if (!clean || clean.to === fromId) return;
  // Enforce room isolation: target must currently be in the same room
  if (!room.players.has(clean.to) && !room.clients.has(clean.to)) return;

  const packet = {
    type: 'voice:signal',
    payload: {
      from: fromId,
      to: clean.to,
      signalType: clean.signalType,
      sdp: clean.sdp,
      candidate: clean.candidate,
      signalId: clean.signalId,
    },
  };

  pushRoomEvent(room, packet.type, packet.payload, fromId);
  const targetWs = room.clients.get(clean.to);
  if (targetWs && targetWs.readyState === WebSocket.OPEN) {
    targetWs.send(JSON.stringify(packet));
  }
  if (forwardToCloudRelay) {
    publishToServerCloudRelay(room.id, fromId, packet);
  }
}

function handleIncomingServerRelayPacket(payloadText: string) {
  try {
    const env = JSON.parse(payloadText);
    if (!env || !env.mid || !env.packet || !env.packet.type) return;
    if (serverSeenRelayMids.has(env.mid)) return;
    serverSeenRelayMids.add(env.mid);
    if (serverSeenRelayMids.size > 500) {
      const oldest = serverSeenRelayMids.values().next().value;
      if (oldest) serverSeenRelayMids.delete(oldest);
    }

    const rawRoomId = String(env.roomId || '');
    if (!rawRoomId || rawRoomId === '*') return;
    const { type, payload } = env.packet;
    if (!payload) return;

    const senderId = String(payload.id || env.senderId || '');
    if (!senderId) return;

    const mode: 'online' | 'lan' = rawRoomId.startsWith('room-') ? 'lan' : 'online';
    const room = getOrCreateRoom(rawRoomId, mode, payload.gameId);

    // If this player already has an active direct WS connection on this server, local WS is authoritative
    const localWs = room.clients.get(senderId);
    if (localWs && localWs.readyState === WebSocket.OPEN) {
      return;
    }

    if (
      type === 'player:joined' ||
      type === 'player:presence' ||
      type === 'player:presence_reply' ||
      type === 'player:updated'
    ) {
      const isNew = !room.players.has(senderId);
      const prev = room.players.get(senderId);
      const safeSkin = payload.skin
        ? sanitizeSkinPayload(payload.skin, payload.skin.name || prev?.skin.name || 'Player')
        : prev?.skin || sanitizeSkinPayload({}, 'Player');

      const updatedPlayer: RoomPlayerState = {
        id: senderId,
        playerKey: typeof payload.playerKey === 'string' ? payload.playerKey.slice(0, 128) : prev?.playerKey,
        bio: typeof payload.bio === 'string' ? filterProfanity(payload.bio.trim().slice(0, 80)) : prev?.bio,
        gems: typeof payload.gems === 'number' ? Math.max(0, Math.floor(payload.gems)) : prev?.gems,
        unlockedAchievements: mergeAchievementsMaps(
          prev?.unlockedAchievements,
          sanitizeAchievementsMap(payload.unlockedAchievements)
        ),
        lifetimeStats: payload.lifetimeStats
          ? mergeLifetimeStats(prev?.lifetimeStats, sanitizeLifetimeStats(payload.lifetimeStats))
          : prev?.lifetimeStats,
        roomId: room.id,
        skin: safeSkin,
        position:
          Array.isArray(payload.position) && payload.position.length === 3
            ? payload.position
            : prev?.position || [0, 1.5, 0],
        rotationY: typeof payload.rotationY === 'number' ? payload.rotationY : prev?.rotationY || 0,
        isMoving: typeof payload.isMoving === 'boolean' ? payload.isMoving : Boolean(prev?.isMoving),
        isGrounded:
          typeof payload.isGrounded === 'boolean' ? payload.isGrounded : prev?.isGrounded !== false,
        activeTool: typeof payload.activeTool === 'string' ? payload.activeTool : prev?.activeTool || 'sword',
        checkpoint: typeof payload.checkpoint === 'number' ? payload.checkpoint : prev?.checkpoint || 0,
        coins: typeof payload.coins === 'number' ? payload.coins : prev?.coins || 0,
        voiceEnabled:
          typeof payload.voiceEnabled === 'boolean' ? payload.voiceEnabled : prev?.voiceEnabled,
        voiceMuted:
          typeof payload.voiceMuted === 'boolean' ? payload.voiceMuted : prev?.voiceMuted,
        voiceSpeaking:
          typeof payload.voiceSpeaking === 'boolean' ? payload.voiceSpeaking : prev?.voiceSpeaking,
        lastUpdated: Date.now(),
        transport: 'relay',
      };
      room.players.set(senderId, updatedPlayer);

      if (isNew) {
        broadcastToRoom(
          room,
          { type: 'player:joined', payload: { ...updatedPlayer, gameId: room.gameId } },
          senderId,
          false
        );
      } else {
        const moveMsg = JSON.stringify({
          type: 'player:updated',
          payload: updatedPlayer,
        });
        room.clients.forEach((peerWs, peerId) => {
          if (peerId !== senderId && peerWs.readyState === WebSocket.OPEN) {
            peerWs.send(moveMsg);
          }
        });
      }

      // Reply with all local players in this room on join OR periodic presence probes
      // (throttled every 3s for existing peers so standalone HTML clients never miss the host after SUBACK/login)
      if (isNew || type === 'player:joined' || type === 'player:presence') {
        const throttleKey = `${room.id}:${senderId}`;
        const nowTs = Date.now();
        const lastReplyAt = serverPresenceReplyThrottle.get(throttleKey) || 0;
        if (isNew || nowTs - lastReplyAt > 3000) {
          serverPresenceReplyThrottle.set(throttleKey, nowTs);
          if (serverPresenceReplyThrottle.size > 400) {
            const oldestKey = serverPresenceReplyThrottle.keys().next().value;
            if (oldestKey) serverPresenceReplyThrottle.delete(oldestKey);
          }
          room.players.forEach((localPlayer, localId) => {
            if (localId !== senderId && localPlayer.transport !== 'relay') {
              publishToServerCloudRelay(room.id, localId, {
                type: 'player:presence_reply',
                payload: {
                  ...localPlayer,
                  gameId: room.gameId,
                  openedDoors: Array.from(room.openedDoors),
                  elevatorClosed: room.elevatorClosed,
                },
              });
            }
          });
        }
      }
    } else if (type === 'player:skin_updated' && payload.skin) {
      const p = room.players.get(senderId);
      if (p) {
        p.skin = sanitizeSkinPayload(payload.skin, payload.skin.name || p.skin.name);
        p.lastUpdated = Date.now();
        broadcastToRoom(
          room,
          { type: 'player:skin_updated', payload: { id: senderId, skin: p.skin } },
          senderId,
          false
        );
      }
    } else if (type === 'player:attacked') {
      broadcastToRoom(room, { type: 'player:attacked', payload: { id: senderId } }, senderId, false);
    } else if (type === 'player:emoted' && isValidEmoteId(payload?.emoteId)) {
      const dur = Math.max(800, Math.min(8000, Number(payload.durationMs) || getEmoteById(payload.emoteId).durationMs));
      const p = room.players.get(senderId);
      if (p) {
        p.activeEmote = { id: payload.emoteId, expiresAt: Date.now() + dur };
      }
      broadcastToRoom(
        room,
        {
          type: 'player:emoted',
          payload: {
            id: senderId,
            emoteId: payload.emoteId,
            durationMs: dur,
            eventId: typeof payload.eventId === 'string' ? payload.eventId : undefined,
          },
        },
        senderId,
        false
      );
    } else if (type === 'player:left') {
      const leaving = room.players.get(senderId);
      if (leaving) {
        room.players.delete(senderId);
        broadcastToRoom(
          room,
          { type: 'player:left', payload: { id: senderId, name: payload.name || leaving.skin.name } },
          senderId,
          false
        );
      }
    } else if (type === 'block:placed' && payload.key && Array.isArray(payload.position)) {
      if (!room.blocks.has(payload.key) && room.blocks.size < 100) {
        const block: RoomBlock = {
          key: String(payload.key),
          position: payload.position,
          color: String(payload.color || '#ef4444'),
        };
        room.blocks.set(block.key, block);
        broadcastToRoom(room, { type: 'block:placed', payload: block }, senderId, false);
      }
    } else if (type === 'block:removed' && payload.key) {
      if (room.blocks.has(payload.key)) {
        room.blocks.delete(payload.key);
        broadcastToRoom(room, { type: 'block:removed', payload: { key: payload.key } }, senderId, false);
      }
    } else if (type === 'doors:opened' && typeof payload.doorIndex === 'number') {
      const idx = Math.floor(payload.doorIndex);
      if (!room.openedDoors.has(idx)) {
        room.openedDoors.add(idx);
        broadcastToRoom(
          room,
          { type: 'doors:opened', payload: { doorIndex: idx, doorNumber: payload.doorNumber } },
          senderId,
          false
        );
      }
    } else if (type === 'doors:elevator_closed') {
      if (!room.elevatorClosed) {
        room.elevatorClosed = true;
        broadcastToRoom(room, { type: 'doors:elevator_closed', payload: {} }, senderId, false);
      }
    } else if (type === 'chat:message' && payload.text) {
      const msgId = String(payload.id || `msg_${Date.now()}`);
      if (!room.chatHistory.some((m) => m.id === msgId)) {
        const msg: ChatMessage = {
          id: msgId,
          author: filterProfanity(String(payload.author || 'Игрок')),
          text: filterProfanity(String(payload.text).slice(0, 140)),
          timestamp: Date.now(),
        };
        room.chatHistory.push(msg);
        if (room.chatHistory.length > 25) room.chatHistory.shift();
        broadcastToRoom(room, { type: 'chat:message', payload: msg }, senderId, false);
      }
    } else if (type === 'voice:state') {
      const p = room.players.get(senderId);
      const enabled = Boolean(payload.enabled);
      const muted = Boolean(payload.muted);
      const speaking = enabled && !muted && Boolean(payload.speaking);
      if (p) {
        p.voiceEnabled = enabled;
        p.voiceMuted = muted;
        p.voiceSpeaking = speaking;
        p.lastUpdated = Date.now();
      }
      broadcastToRoom(
        room,
        { type: 'voice:state', payload: { id: senderId, enabled, muted, speaking } },
        senderId,
        false
      );
    } else if (type === 'voice:signal') {
      relayVoiceSignalInRoom(room, senderId, payload, false);
    }
  } catch {}
}

function startServerCloudRelayBridge() {
  const brokers: { url: string; username?: string; password?: string }[] = [
    // Port 443 standard HTTPS/WSS MQTT relay (works through mobile carriers & corporate/school firewalls)
    { url: 'wss://public.cloud.shiftr.io', username: 'public', password: 'public' },
    { url: 'wss://broker.emqx.io:8084/mqtt' },
    { url: 'wss://broker.hivemq.com:8884/mqtt' },
    { url: 'wss://test.mosquitto.org:8081' },
  ];
  for (const broker of brokers) {
    const link = { url: broker.url, ws: null as WebSocket | null, ready: false };
    serverRelaySockets.push(link);

    const connectLink = () => {
      try {
        const sock = new WebSocket(broker.url, ['mqtt']);
        link.ws = sock;
        link.ready = false;

        sock.on('open', () => {
          const cid = `bxsrv_${Math.random().toString(36).slice(2, 10)}`;
          try {
            sock.send(buildServerMqttConnect(cid, broker.username, broker.password));
          } catch {}
        });

        sock.on('message', (data: Buffer) => {
          const frames = parseServerMqttFrames(Buffer.from(data));
          for (const f of frames) {
            if (f.type === 2) {
              link.ready = true;
              try {
                sock.send(buildServerMqttSubscribe('bloxhub3d/v2/room/+', 1));
              } catch {}
            } else if (f.type === 3 && f.payloadText) {
              handleIncomingServerRelayPacket(f.payloadText);
            }
          }
        });

        sock.on('close', () => {
          link.ws = null;
          link.ready = false;
          setTimeout(connectLink, 3000);
        });

        sock.on('error', () => {
          try {
            sock.close();
          } catch {}
        });
      } catch {
        setTimeout(connectLink, 4000);
      }
    };

    connectLink();
  }

  // MQTT keep-alive pings
  setInterval(() => {
    const pingFrame = Buffer.from([0xc0, 0x00]);
    for (const link of serverRelaySockets) {
      if (link.ready && link.ws && link.ws.readyState === WebSocket.OPEN) {
        try {
          link.ws.send(pingFrame);
        } catch {}
      }
    }
  }, 22000);

  // Periodic presence heartbeat for local WS players so standalone HTML peers never reap an idle host after 14s
  setInterval(() => {
    const hasOpenRelay = serverRelaySockets.some(
      (link) => link.ready && link.ws && link.ws.readyState === WebSocket.OPEN
    );
    if (!hasOpenRelay) return;

    rooms.forEach((room) => {
      if (room.players.size === 0) return;
      room.players.forEach((localPlayer, localId) => {
        if (localPlayer.transport === 'relay') return;
        const localWs = room.clients.get(localId);
        if (!localWs || localWs.readyState !== WebSocket.OPEN) return;
        publishToServerCloudRelay(room.id, localId, {
          type: 'player:presence',
          payload: {
            ...localPlayer,
            gameId: room.gameId,
            openedDoors: Array.from(room.openedDoors),
            elevatorClosed: room.elevatorClosed,
          },
        });
      });
    });
  }, 5000);
}

interface ServerUserProfile {
  uid: string;
  username: string;
  bio: string;
  role: 'player';
  coins: number;
  gems: number;
  skin: RemoteSkin;
  ownedItems: string[];
  unlockedAchievements?: Record<string, number>;
  lifetimeStats?: {
    totalJumps: number;
    totalDeaths: number;
  };
  updatedAt?: number;
}

interface StoredAccountRecord extends ServerUserProfile {
  usernameLower: string;
  passwordSalt: string;
  passwordHash: string;
  recoverySalt?: string;
  recoveryHash?: string;
  createdAt: number;
  updatedAt: number;
}

interface AccountsStoreFile {
  accounts: StoredAccountRecord[];
  sessions: Record<string, string>;
}

const DEFAULT_STARTER_OWNED = [
  'rocker_hair',
  'cap',
  '6b47_helmet',
  'rock_jacket',
  'pizza_tee',
  'rus_emr_vest',
  'squiggly',
  'smile',
  'eye_scar',
  'fuel_jetpack',
  'roblox_classic',
];

const DATA_DIR = path.join(process.cwd(), '.data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'blox-accounts.json');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');
const FEEDBACK_BACKUP_FILE = path.join(DATA_DIR, 'feedback.backup.json');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');
const DEFAULT_FEEDBACK_RECIPIENT = 'gerdgrad9@gmail.com';

type LeaderboardGameId = 'doors' | 'obby' | 'lava_survival' | 'bee_swarm' | 'studio';

interface LeaderboardGameStatsRecord {
  completedLevels: number;
  victories: number;
  bestTimeSeconds: number;
}

interface LeaderboardEntryRecord {
  playerKey: string;
  username: string;
  completedLevels: number;
  victories: number;
  bestTimeSeconds: number;
  totalTimeSeconds: number;
  bestGameId: LeaderboardGameId;
  perGameStats: Partial<Record<LeaderboardGameId, LeaderboardGameStatsRecord>>;
  skin?: RemoteSkin;
  bio?: string;
  coins?: number;
  gems?: number;
  totalJumps?: number;
  totalDeaths?: number;
  unlockedAchievements?: Record<string, number>;
  recentRunKeys?: string[];
  updatedAt: number;
}

function sanitizeAchievementsMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (
      typeof k === 'string' &&
      /^[a-z0-9_]{1,40}$/i.test(k) &&
      typeof v === 'number' &&
      Number.isFinite(v) &&
      v > 0
    ) {
      out[k] = Math.floor(v);
    }
  }
  return out;
}

function mergeAchievementsMaps(
  a?: Record<string, number>,
  b?: Record<string, number>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const src of [a, b]) {
    if (!src) continue;
    for (const [k, v] of Object.entries(src)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        out[k] = out[k] ? Math.min(out[k], v) : v;
      }
    }
  }
  return out;
}

function sanitizeLifetimeStats(raw: unknown): { totalJumps: number; totalDeaths: number } {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    totalJumps: Math.max(0, Math.min(100000000, Math.floor(Number(obj.totalJumps) || 0))),
    totalDeaths: Math.max(0, Math.min(100000000, Math.floor(Number(obj.totalDeaths) || 0))),
  };
}

function mergeLifetimeStats(
  a?: { totalJumps: number; totalDeaths: number },
  b?: { totalJumps: number; totalDeaths: number }
): { totalJumps: number; totalDeaths: number } {
  return {
    totalJumps: Math.max(a?.totalJumps || 0, b?.totalJumps || 0),
    totalDeaths: Math.max(a?.totalDeaths || 0, b?.totalDeaths || 0),
  };
}

const leaderboardByPlayerKey = new Map<string, LeaderboardEntryRecord>();

function normalizeLeaderboardGameId(raw: unknown): LeaderboardGameId {
  if (raw === 'obby' || raw === 'lava_survival' || raw === 'bee_swarm' || raw === 'doors' || raw === 'studio') {
    return raw;
  }
  return 'doors';
}

function loadLeaderboardStore() {
  try {
    if (!fs.existsSync(LEADERBOARD_FILE)) return;
    const raw = fs.readFileSync(LEADERBOARD_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    for (const item of parsed) {
      if (item && typeof item.playerKey === 'string' && typeof item.username === 'string') {
        leaderboardByPlayerKey.set(item.playerKey, {
          playerKey: item.playerKey,
          username: item.username.slice(0, 16),
          completedLevels: Math.max(0, Math.floor(Number(item.completedLevels) || 0)),
          victories: Math.max(0, Math.floor(Number(item.victories) || 0)),
          bestTimeSeconds: Math.max(0, Math.floor(Number(item.bestTimeSeconds) || 0)),
          totalTimeSeconds: Math.max(0, Math.floor(Number(item.totalTimeSeconds) || 0)),
          bestGameId: normalizeLeaderboardGameId(item.bestGameId),
          perGameStats: item.perGameStats && typeof item.perGameStats === 'object' ? item.perGameStats : {},
          skin: item.skin,
          bio: typeof item.bio === 'string' ? item.bio.slice(0, 80) : undefined,
          coins: typeof item.coins === 'number' ? Math.max(0, Math.floor(item.coins)) : undefined,
          gems: typeof item.gems === 'number' ? Math.max(0, Math.floor(item.gems)) : undefined,
          totalJumps: typeof item.totalJumps === 'number' ? Math.max(0, Math.floor(item.totalJumps)) : undefined,
          totalDeaths: typeof item.totalDeaths === 'number' ? Math.max(0, Math.floor(item.totalDeaths)) : undefined,
          unlockedAchievements: sanitizeAchievementsMap(item.unlockedAchievements),
          recentRunKeys: Array.isArray(item.recentRunKeys) ? item.recentRunKeys.slice(-80) : [],
          updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
        });
      }
    }
  } catch {
    // Ignore corrupted leaderboard file
  }
}

function persistLeaderboardStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const serialized = Array.from(leaderboardByPlayerKey.values()).map((entry) => ({
      ...entry,
      recentRunKeys: (entry.recentRunKeys || []).slice(-80),
    }));
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(serialized, null, 2), 'utf-8');
  } catch {
    // Non-fatal
  }
}

function buildRankedLeaderboard(
  gameFilter: 'all' | LeaderboardGameId = 'all',
  viewerPlayerKey?: string
) {
  const rawList = Array.from(leaderboardByPlayerKey.values());
  const projected = rawList
    .map((entry) => {
      const gs =
        gameFilter === 'all'
          ? {
              completedLevels: entry.completedLevels,
              victories: entry.victories,
              bestTimeSeconds: entry.bestTimeSeconds,
            }
          : entry.perGameStats[gameFilter] || {
              completedLevels: 0,
              victories: 0,
              bestTimeSeconds: 0,
            };

      return {
        playerKey: entry.playerKey,
        username: entry.username,
        completedLevels: gs.completedLevels,
        victories: gs.victories,
        bestTimeSeconds: gs.bestTimeSeconds,
        totalTimeSeconds: entry.totalTimeSeconds,
        bestGameId: gameFilter === 'all' ? entry.bestGameId : gameFilter,
        perGameStats: entry.perGameStats,
        skin: entry.skin,
        updatedAt: entry.updatedAt,
      };
    })
    .filter((item) => item.completedLevels > 0 || item.victories > 0)
    .sort((a, b) => {
      if (b.completedLevels !== a.completedLevels) {
        return b.completedLevels - a.completedLevels;
      }
      const aTime = a.bestTimeSeconds > 0 ? a.bestTimeSeconds : Number.MAX_SAFE_INTEGER;
      const bTime = b.bestTimeSeconds > 0 ? b.bestTimeSeconds : Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) {
        return aTime - bTime;
      }
      if (b.victories !== a.victories) {
        return b.victories - a.victories;
      }
      if (a.totalTimeSeconds !== b.totalTimeSeconds) {
        return a.totalTimeSeconds - b.totalTimeSeconds;
      }
      return a.updatedAt - b.updatedAt;
    })
    .map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

  const viewerIdx = viewerPlayerKey
    ? projected.findIndex((item) => item.playerKey === viewerPlayerKey)
    : -1;

  return {
    gameId: gameFilter,
    entries: projected.slice(0, 10),
    totalPlayers: projected.length,
    viewerRank: viewerIdx >= 0 ? viewerIdx + 1 : null,
    viewerEntry: viewerIdx >= 0 ? projected[viewerIdx] : null,
    updatedAt: Date.now(),
  };
}

loadLeaderboardStore();

interface FeedbackRecord {
  id: string;
  rating: number;
  message: string;
  author: string;
  contactEmail?: string;
  gameId?: string;
  mode?: string;
  roomId?: string;
  createdAt: number;
  emailDelivered: boolean;
  provider: 'resend' | 'smtp' | 'none';
  deliveryError?: string;
  isRead?: boolean;
  pinned?: boolean;
}

interface FeedbackSummary {
  averageRating: number;
  ratedCount: number;
  totalLetters: number;
  positivePercent: number;
  unreadCount: number;
  breakdown: Record<'1' | '2' | '3' | '4' | '5', number>;
  byGame: Record<string, { averageRating: number; ratedCount: number; totalLetters: number }>;
}

const feedbackMessages: FeedbackRecord[] = [];

function mergeFeedbackLists(sources: FeedbackRecord[][]): FeedbackRecord[] {
  const byId = new Map<string, FeedbackRecord>();
  for (const list of sources) {
    for (const item of list) {
      if (!item || typeof item.id !== 'string') continue;
      const prev = byId.get(item.id);
      if (!prev) {
        byId.set(item.id, item);
      } else {
        byId.set(item.id, {
          ...prev,
          ...item,
          emailDelivered: Boolean(prev.emailDelivered || item.emailDelivered),
          isRead: Boolean(prev.isRead || item.isRead),
          pinned: Boolean(prev.pinned || item.pinned),
        });
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

function readFeedbackFileSafe(filePath: string): FeedbackRecord[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is FeedbackRecord => Boolean(item && typeof item.id === 'string'));
  } catch {
    return [];
  }
}

function loadFeedbackStore() {
  const primary = readFeedbackFileSafe(FEEDBACK_FILE);
  const backup = readFeedbackFileSafe(FEEDBACK_BACKUP_FILE);
  const merged = mergeFeedbackLists([backup, primary]);
  feedbackMessages.splice(0, feedbackMessages.length, ...merged);
  if (merged.length > 0 && primary.length < merged.length) {
    persistFeedbackStore();
  }
}

function persistFeedbackStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const serialized = JSON.stringify(feedbackMessages, null, 2);
    const tmpFile = `${FEEDBACK_FILE}.tmp`;
    fs.writeFileSync(tmpFile, serialized, 'utf-8');
    fs.renameSync(tmpFile, FEEDBACK_FILE);
    fs.writeFileSync(FEEDBACK_BACKUP_FILE, serialized, 'utf-8');
  } catch {
    // Non-fatal
  }
}

function computeFeedbackSummary(records: FeedbackRecord[]): FeedbackSummary {
  const breakdown: Record<'1' | '2' | '3' | '4' | '5', number> = {
    '5': 0,
    '4': 0,
    '3': 0,
    '2': 0,
    '1': 0,
  };
  const gameAcc: Record<string, { sum: number; rated: number; total: number }> = {};

  let ratingSum = 0;
  let ratedCount = 0;
  let positiveCount = 0;
  let unreadCount = 0;

  for (const item of records) {
    if (!item.isRead) unreadCount += 1;
    const rawRating = typeof item.rating === 'number' && Number.isFinite(item.rating)
      ? Math.round(item.rating)
      : 0;
    const hasValidRating = rawRating >= 1 && rawRating <= 5;
    if (hasValidRating) {
      ratedCount += 1;
      ratingSum += rawRating;
      const key = String(rawRating) as '1' | '2' | '3' | '4' | '5';
      breakdown[key] += 1;
      if (rawRating >= 4) positiveCount += 1;
    }

    const gId = typeof item.gameId === 'string' && item.gameId.trim() ? item.gameId.trim() : 'other';
    if (!gameAcc[gId]) {
      gameAcc[gId] = { sum: 0, rated: 0, total: 0 };
    }
    gameAcc[gId].total += 1;
    if (hasValidRating) {
      gameAcc[gId].rated += 1;
      gameAcc[gId].sum += rawRating;
    }
  }

  const byGame: FeedbackSummary['byGame'] = {};
  for (const [gId, acc] of Object.entries(gameAcc)) {
    byGame[gId] = {
      averageRating: acc.rated > 0 ? Math.round((acc.sum / acc.rated) * 10) / 10 : 0,
      ratedCount: acc.rated,
      totalLetters: acc.total,
    };
  }

  return {
    averageRating: ratedCount > 0 ? Math.round((ratingSum / ratedCount) * 10) / 10 : 0,
    ratedCount,
    totalLetters: records.length,
    positivePercent: ratedCount > 0 ? Math.round((positiveCount / ratedCount) * 100) : 0,
    unreadCount,
    breakdown,
    byGame,
  };
}

loadFeedbackStore();

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getResolvedSmtpCredentials(): { smtpUser: string; smtpPass: string } {
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();
  const smtpUser = (
    process.env.SMTP_USER ||
    process.env.FEEDBACK_TO_EMAIL ||
    DEFAULT_FEEDBACK_RECIPIENT
  ).trim();
  return { smtpUser, smtpPass };
}

function hasFeedbackMailProvider(): boolean {
  const hasResend = Boolean((process.env.RESEND_API_KEY || '').trim());
  const { smtpUser, smtpPass } = getResolvedSmtpCredentials();
  const hasSmtp = Boolean(smtpUser && smtpPass);
  return hasResend || hasSmtp;
}

async function deliverFeedbackEmail(record: FeedbackRecord): Promise<{
  emailDelivered: boolean;
  provider: 'resend' | 'smtp' | 'none';
  deliveryError?: string;
}> {
  const recipient = (process.env.FEEDBACK_TO_EMAIL || DEFAULT_FEEDBACK_RECIPIENT).trim();
  const stars = record.rating > 0 ? `${'★'.repeat(record.rating)}${'☆'.repeat(Math.max(0, 5 - record.rating))} (${record.rating}/5)` : 'Без оценки';
  const subject = `[Blox Hub] Отзыв от ${record.author || 'Игрока'} · ${stars}`;
  const plainText = [
    `Новый отзыв в Blox Hub 3D`,
    `Автор: ${record.author || 'Игрок'}`,
    `Оценка: ${stars}`,
    `Email/Контакт для ответа: ${record.contactEmail || 'не указан'}`,
    `Игра: ${record.gameId || '-'} | Режим: ${record.mode || '-'} | Комната: ${record.roomId || '-'}`,
    `Дата: ${new Date(record.createdAt).toLocaleString('ru-RU')}`,
    ``,
    `Сообщение:`,
    record.message || '(пустое сообщение, только оценка)',
  ].join('\n');

  const htmlBody = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:24px;border-radius:16px;border:1px solid #334155;">
      <h2 style="margin:0 0 12px;color:#fbbf24;">Новый отзыв в Blox Hub 3D</h2>
      <p style="margin:6px 0;"><strong>Автор:</strong> ${escapeHtml(record.author || 'Игрок')}</p>
      <p style="margin:6px 0;"><strong>Оценка:</strong> ${escapeHtml(stars)}</p>
      <p style="margin:6px 0;"><strong>Контакт:</strong> ${escapeHtml(record.contactEmail || 'не указан')}</p>
      <p style="margin:6px 0;"><strong>Игра / Комната:</strong> ${escapeHtml(record.gameId || '-')} (${escapeHtml(record.mode || '-')}, ${escapeHtml(record.roomId || '-')})</p>
      <div style="margin-top:16px;padding:16px;background:#1e293b;border-radius:12px;border:1px solid #475569;white-space:pre-wrap;color:#ffffff;">${escapeHtml(record.message || '(без текста)')}</div>
    </div>
  `;

  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
  if (resendApiKey) {
    try {
      const fromAddr = (process.env.RESEND_FROM_EMAIL || 'Blox Hub <onboarding@resend.dev>').trim();
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddr,
          to: [recipient],
          subject,
          text: plainText,
          html: htmlBody,
          ...(record.contactEmail && record.contactEmail.includes('@')
            ? { reply_to: record.contactEmail }
            : {}),
        }),
      });
      if (!resp.ok) {
        const errBody = await resp.text();
        return { emailDelivered: false, provider: 'resend', deliveryError: `Resend ${resp.status}: ${errBody.slice(0, 140)}` };
      }
      return { emailDelivered: true, provider: 'resend' };
    } catch (err: any) {
      return { emailDelivered: false, provider: 'resend', deliveryError: err?.message || 'Resend request failed' };
    }
  }

  const { smtpUser, smtpPass } = getResolvedSmtpCredentials();
  if (smtpUser && smtpPass) {
    try {
      const smtpHost = (process.env.SMTP_HOST || (smtpUser.toLowerCase().endsWith('@gmail.com') ? 'smtp.gmail.com' : '')).trim();
      const smtpPort = Number(process.env.SMTP_PORT || 465);
      const nodemailerMod = await import('nodemailer');
      const nodemailerClient = nodemailerMod.default || nodemailerMod;
      const transporter = nodemailerClient.createTransport({
        host: smtpHost || 'smtp.gmail.com',
        port: Number.isFinite(smtpPort) ? smtpPort : 465,
        secure: (Number.isFinite(smtpPort) ? smtpPort : 465) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      await transporter.sendMail({
        from: `"Blox Hub 3D" <${smtpUser}>`,
        to: recipient,
        replyTo:
          record.contactEmail && record.contactEmail.includes('@') ? record.contactEmail : undefined,
        subject,
        text: plainText,
        html: htmlBody,
      });
      return { emailDelivered: true, provider: 'smtp' };
    } catch (err: any) {
      return { emailDelivered: false, provider: 'smtp', deliveryError: err?.message || 'SMTP send failed' };
    }
  }

  return {
    emailDelivered: false,
    provider: 'none',
    deliveryError: 'Почтовый транспорт (SMTP_USER/SMTP_PASS или RESEND_API_KEY) не настроен в Secrets.',
  };
}

const accountsByUid = new Map<string, StoredAccountRecord>();
const uidByUsernameLower = new Map<string, string>();
const sessionTokens = new Map<string, string>();

function sanitizeServerUsername(raw: string): string {
  return String(raw || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16);
}

function isValidServerUsername(name: string): boolean {
  return name.length >= 3 && name.length <= 16 && /^[a-zA-Z0-9_]+$/.test(name);
}

function sanitizeOwnedList(list: unknown): string[] {
  const set = new Set<string>(DEFAULT_STARTER_OWNED);
  if (Array.isArray(list)) {
    for (const item of list) {
      if (typeof item === 'string') {
        const clean = item.trim().slice(0, 32);
        if (clean.length >= 1 && /^[a-zA-Z0-9_-]+$/.test(clean)) {
          set.add(clean);
        }
      }
      if (set.size >= 50) break;
    }
  }
  return Array.from(set).slice(0, 50);
}

function sanitizeSkinPayload(raw: any, fallbackName: string): RemoteSkin {
  const hexOk = (val: unknown, fb: string) =>
    typeof val === 'string' && /^#[0-9a-fA-F]{6}$/.test(val) ? val : fb;
  const keyOk = (val: unknown, fb: string) =>
    typeof val === 'string' && /^[a-zA-Z0-9_-]{1,32}$/.test(val.trim()) ? val.trim() : fb;

  return {
    name: fallbackName,
    skinColor: hexOk(raw?.skinColor, '#e5c298'),
    torsoColor: hexOk(raw?.torsoColor, '#141619'),
    legsColor: hexOk(raw?.legsColor, '#18181b'),
    headShape: raw?.headShape === 'blocky' ? 'blocky' : 'round',
    hat: keyOk(raw?.hat, 'rocker_hair'),
    face: keyOk(raw?.face, 'squiggly'),
    outfit: keyOk(raw?.outfit, 'rock_jacket'),
    shirt: raw?.shirt ? keyOk(raw.shirt, 'rock_jacket') : 'rock_jacket',
    pants: raw?.pants ? keyOk(raw.pants, 'rock_jeans') : 'rock_jeans',
    backpack: keyOk(raw?.backpack, 'fuel_jetpack'),
    playerTitleId:
      typeof raw?.playerTitleId === 'string' && /^[a-zA-Z0-9_-]{1,32}$/.test(raw.playerTitleId.trim())
        ? raw.playerTitleId.trim()
        : null,
  };
}

const authSocketsByUid = new Map<string, Set<{ ws: WebSocket; token: string }>>();

function broadcastAccountSync(
  uid: string,
  sourceToken?: string,
  eventType: 'account:synced' | 'account:logged_out' = 'account:synced'
) {
  const listeners = authSocketsByUid.get(uid);
  if (!listeners || listeners.size === 0) return;

  const acc = accountsByUid.get(uid);
  const payload =
    eventType === 'account:synced' && acc
      ? JSON.stringify({ type: 'account:synced', profile: toPublicProfile(acc) })
      : JSON.stringify({ type: 'account:logged_out' });

  for (const entry of listeners) {
    if (sourceToken && entry.token === sourceToken && eventType === 'account:synced') {
      continue;
    }
    if (entry.ws.readyState === WebSocket.OPEN) {
      entry.ws.send(payload);
    }
  }
}

function buildSyncChecksum(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify({
    uid: payload.uid,
    username: payload.username,
    passwordSalt: payload.passwordSalt,
    passwordHash: payload.passwordHash,
    updatedAt: payload.updatedAt,
  });
  return crypto
    .createHash('sha256')
    .update(`blox_sync_v1:${canonical}`)
    .digest('hex')
    .slice(0, 24);
}

function toPublicProfile(acc: StoredAccountRecord): ServerUserProfile {
  return {
    uid: acc.uid,
    username: acc.username,
    bio: acc.bio,
    role: 'player',
    coins: acc.coins,
    gems: acc.gems,
    skin: { ...acc.skin, name: acc.username },
    ownedItems: [...acc.ownedItems],
    unlockedAchievements: acc.unlockedAchievements ? { ...acc.unlockedAchievements } : {},
    lifetimeStats: acc.lifetimeStats ? { ...acc.lifetimeStats } : { totalJumps: 0, totalDeaths: 0 },
    updatedAt: acc.updatedAt,
  };
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const computed = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (computed.length !== expected.length) return false;
  return crypto.timingSafeEqual(computed, expected);
}

function loadAccountsStore() {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) return;
    const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as AccountsStoreFile;
    if (Array.isArray(parsed.accounts)) {
      for (const acc of parsed.accounts) {
        if (acc && acc.uid && acc.usernameLower) {
          accountsByUid.set(acc.uid, acc);
          uidByUsernameLower.set(acc.usernameLower, acc.uid);
        }
      }
    }
    if (parsed.sessions && typeof parsed.sessions === 'object') {
      for (const [token, uid] of Object.entries(parsed.sessions)) {
        if (typeof uid === 'string' && accountsByUid.has(uid)) {
          sessionTokens.set(token, uid);
        }
      }
    }
  } catch {
    // Ignore corrupted or missing local store
  }
}

function persistAccountsStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const payload: AccountsStoreFile = {
      accounts: Array.from(accountsByUid.values()),
      sessions: Object.fromEntries(sessionTokens.entries()),
    };
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch {
    // Non-fatal in ephemeral environments
  }
}

loadAccountsStore();

function resolveServerPort(): number {
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx >= 0 && process.argv[portArgIdx + 1]) {
    const parsed = Number(process.argv[portArgIdx + 1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const eqArg = process.argv.find((a) => a.startsWith('--port='));
  if (eqArg) {
    const parsed = Number(eqArg.split('=')[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const envPort = Number(process.env.PORT);
  if (Number.isFinite(envPort) && envPort > 0) return envPort;
  return 3000;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = resolveServerPort();

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, port: PORT, uptime: process.uptime() });
  });

  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  const getAuthTokenFromRequest = (req: express.Request): string => {
    const authHeader = req.headers.authorization || '';
    return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  };

  const getAuthUidFromRequest = (req: express.Request): string | null => {
    const token = getAuthTokenFromRequest(req);
    if (!token) return null;
    return sessionTokens.get(token) || null;
  };

  // Account Auth API (Username + Password, without Google)
  app.post('/api/auth/register', (req, res) => {
    const body = req.body || {};
    const username = sanitizeServerUsername(body.username);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!isValidServerUsername(username)) {
      res.status(400).json({
        error: 'Никнейм должен быть от 3 до 16 символов (латиница, цифры и _).',
      });
      return;
    }
    if (password.length < 4 || password.length > 64) {
      res.status(400).json({
        error: 'Пароль должен содержать от 4 до 64 символов.',
      });
      return;
    }

    const lower = username.toLowerCase();
    if (uidByUsernameLower.has(lower)) {
      res.status(409).json({
        error: `Никнейм «${username}» уже занят. Выберите другой или войдите в аккаунт.`,
      });
      return;
    }

    const uid = `u_${crypto.randomBytes(10).toString('hex')}`;
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const now = Date.now();
    const coins =
      typeof body.coins === 'number' && Number.isFinite(body.coins)
        ? Math.max(0, Math.min(10000000, Math.floor(body.coins)))
        : 100;
    const gems =
      typeof body.gems === 'number' && Number.isFinite(body.gems)
        ? Math.max(0, Math.min(1000000, Math.floor(body.gems)))
        : 0;

    const rawRecovery = typeof body.recoveryCode === 'string' ? body.recoveryCode.trim().slice(0, 32) : '';
    const recoverySalt = rawRecovery.length >= 3 ? crypto.randomBytes(16).toString('hex') : undefined;
    const recoveryHash =
      recoverySalt && rawRecovery.length >= 3
        ? hashPassword(rawRecovery.toLowerCase(), recoverySalt)
        : undefined;

    const record: StoredAccountRecord = {
      uid,
      username,
      usernameLower: lower,
      bio: typeof body.bio === 'string' ? body.bio.trim().slice(0, 80) : '',
      role: 'player',
      coins,
      gems,
      skin: sanitizeSkinPayload(body.skin, username),
      ownedItems: sanitizeOwnedList(body.ownedItems),
      unlockedAchievements: sanitizeAchievementsMap(body.unlockedAchievements),
      lifetimeStats: sanitizeLifetimeStats(body.lifetimeStats),
      passwordSalt: salt,
      passwordHash,
      ...(recoverySalt && recoveryHash ? { recoverySalt, recoveryHash } : {}),
      createdAt: now,
      updatedAt: now,
    };

    accountsByUid.set(uid, record);
    uidByUsernameLower.set(lower, uid);

    const token = crypto.randomBytes(32).toString('hex');
    sessionTokens.set(token, uid);
    persistAccountsStore();

    res.status(201).json({
      token,
      profile: toPublicProfile(record),
    });
  });

  const OWNER_2FA_USERNAME = 'gerdgrad92';
  const OWNER_2FA_CODE = (process.env.OWNER_2FA_CODE || '0808').trim();

  app.post('/api/auth/login', (req, res) => {
    const body = req.body || {};
    const username = sanitizeServerUsername(body.username);
    const password = typeof body.password === 'string' ? body.password : '';
    const twoFactorCode = typeof body.twoFactorCode === 'string' ? body.twoFactorCode.trim() : '';

    if (!username || !password) {
      res.status(400).json({ error: 'Введите никнейм и пароль.' });
      return;
    }

    const uid = uidByUsernameLower.get(username.toLowerCase());
    const record = uid ? accountsByUid.get(uid) : undefined;
    if (!record || !verifyPassword(password, record.passwordSalt, record.passwordHash)) {
      res.status(401).json({ error: 'Неверный никнейм или пароль.' });
      return;
    }

    if (record.usernameLower === OWNER_2FA_USERNAME) {
      if (!twoFactorCode) {
        res.status(403).json({
          requires2FA: true,
          twoFactorStep: 'prompt',
          error: `Пароль верный! Введите код 2FA для входа в аккаунт ${record.username}.`,
        });
        return;
      }
      if (twoFactorCode !== OWNER_2FA_CODE) {
        res.status(403).json({
          requires2FA: true,
          twoFactorStep: 'invalid',
          error: 'Неверный код 2FA. Проверьте пароль 2FA и попробуйте снова.',
        });
        return;
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    sessionTokens.set(token, record.uid);
    persistAccountsStore();

    res.json({
      token,
      profile: toPublicProfile(record),
    });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const body = req.body || {};
    const username = sanitizeServerUsername(body.username);
    const verificationCode =
      typeof body.verificationCode === 'string' ? body.verificationCode.trim() : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!isValidServerUsername(username)) {
      res.status(400).json({
        error: 'Введите корректный никнейм аккаунта (от 3 до 16 символов).',
      });
      return;
    }
    if (!verificationCode) {
      res.status(400).json({
        error: 'Введите код подтверждения (код 2FA, секретное слово или BLOXSYNC1).',
      });
      return;
    }
    if (newPassword.length < 4 || newPassword.length > 64) {
      res.status(400).json({
        error: 'Новый пароль должен содержать от 4 до 64 символов.',
      });
      return;
    }

    const uid = uidByUsernameLower.get(username.toLowerCase());
    const record = uid ? accountsByUid.get(uid) : undefined;
    if (!record) {
      res.status(404).json({
        error: `Аккаунт «${username}» не найден. Проверьте написание никнейма.`,
      });
      return;
    }

    let verified = false;

    // 1. Owner account 2FA PIN verification (e.g. gerdgrad92 with 0808)
    if (record.usernameLower === OWNER_2FA_USERNAME && verificationCode === OWNER_2FA_CODE) {
      verified = true;
    }

    // 2. Stored account recovery PIN / secret word verification
    if (
      !verified &&
      record.recoverySalt &&
      record.recoveryHash &&
      verifyPassword(verificationCode.toLowerCase().slice(0, 32), record.recoverySalt, record.recoveryHash)
    ) {
      verified = true;
    }

    // 3. Portable BLOXSYNC1 code ownership verification
    const compactCode = verificationCode.replace(/\s+/g, '');
    if (!verified && compactCode.startsWith('BLOXSYNC1.')) {
      try {
        const jsonText = Buffer.from(compactCode.slice('BLOXSYNC1.'.length), 'base64url').toString('utf-8');
        const parsed = JSON.parse(jsonText);
        if (
          parsed &&
          parsed.v === 1 &&
          parsed.uid === record.uid &&
          parsed.passwordHash === record.passwordHash &&
          typeof parsed.checksum === 'string' &&
          buildSyncChecksum(parsed) === parsed.checksum
        ) {
          verified = true;
        }
      } catch {
        // Invalid sync code
      }
    }

    if (!verified) {
      if (record.usernameLower === OWNER_2FA_USERNAME) {
        res.status(403).json({
          error: `Неверный код 2FA для сброса пароля аккаунта ${record.username}.`,
        });
      } else if (record.recoveryHash) {
        res.status(403).json({
          error: 'Неверное секретное слово / PIN восстановления или код BLOXSYNC1.',
        });
      } else {
        res.status(403).json({
          error:
            'У этого аккаунта не задано секретное слово восстановления. Вставьте ваш код синхронизации BLOXSYNC1.',
        });
      }
      return;
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    record.passwordSalt = newSalt;
    record.passwordHash = hashPassword(newPassword, newSalt);
    record.updatedAt = Date.now();

    // Rotate sessions for safety and issue a fresh session token so the user signs in right away
    for (const [tok, tokUid] of Array.from(sessionTokens.entries())) {
      if (tokUid === record.uid) {
        sessionTokens.delete(tok);
      }
    }
    const newToken = crypto.randomBytes(32).toString('hex');
    sessionTokens.set(newToken, record.uid);
    persistAccountsStore();
    broadcastAccountSync(record.uid, newToken, 'account:synced');

    res.json({
      token: newToken,
      profile: toPublicProfile(record),
    });
  });

  app.get('/api/auth/session', (req, res) => {
    const uid = getAuthUidFromRequest(req);
    const record = uid ? accountsByUid.get(uid) : undefined;
    if (!record) {
      res.status(401).json({ error: 'Сессия не найдена.' });
      return;
    }
    res.json({ profile: toPublicProfile(record) });
  });

  app.put('/api/auth/profile', (req, res) => {
    const sourceToken = getAuthTokenFromRequest(req);
    const uid = sourceToken ? sessionTokens.get(sourceToken) || null : null;
    const record = uid ? accountsByUid.get(uid) : undefined;
    if (!record) {
      res.status(401).json({ error: 'Требуется вход в аккаунт.' });
      return;
    }

    const NICKNAME_CHANGE_GEM_COST = 10;
    const body = req.body || {};
    let renamedAndChargedGems = false;
    if (typeof body.username === 'string') {
      const nextName = sanitizeServerUsername(body.username);
      if (!isValidServerUsername(nextName)) {
        res.status(400).json({
          error: 'Никнейм должен быть от 3 до 16 символов (латиница, цифры и _).',
        });
        return;
      }
      const nextLower = nextName.toLowerCase();
      const ownerOfName = uidByUsernameLower.get(nextLower);
      if (ownerOfName && ownerOfName !== record.uid) {
        res.status(409).json({ error: `Никнейм «${nextName}» уже занят.` });
        return;
      }
      if (nextName !== record.username) {
        const bodyGems =
          typeof body.gems === 'number' && Number.isFinite(body.gems)
            ? Math.max(0, Math.min(1000000, Math.floor(body.gems)))
            : record.gems;
        const availableGems = Math.max(record.gems, bodyGems);
        if (availableGems < NICKNAME_CHANGE_GEM_COST) {
          res.status(400).json({
            error: `Недостаточно кристаллов для смены ника! Нужно ${NICKNAME_CHANGE_GEM_COST} 💎 (у вас ${availableGems} 💎 — кристаллы гипер редкие).`,
            requiredGems: NICKNAME_CHANGE_GEM_COST,
            currentGems: availableGems,
          });
          return;
        }
        record.gems = availableGems - NICKNAME_CHANGE_GEM_COST;
        renamedAndChargedGems = true;
      }
      uidByUsernameLower.delete(record.usernameLower);
      record.username = nextName;
      record.usernameLower = nextLower;
      record.skin.name = nextName;
      uidByUsernameLower.set(nextLower, record.uid);
    }

    if (typeof body.bio === 'string') {
      record.bio = body.bio.trim().slice(0, 80);
    }
    if (typeof body.recoveryCode === 'string' && body.recoveryCode.trim().length >= 3) {
      const cleanRec = body.recoveryCode.trim().toLowerCase().slice(0, 32);
      const recSalt = crypto.randomBytes(16).toString('hex');
      record.recoverySalt = recSalt;
      record.recoveryHash = hashPassword(cleanRec, recSalt);
    }
    if (typeof body.coins === 'number' && Number.isFinite(body.coins)) {
      record.coins = Math.max(0, Math.min(10000000, Math.floor(body.coins)));
    }
    if (!renamedAndChargedGems && typeof body.gems === 'number' && Number.isFinite(body.gems)) {
      record.gems = Math.max(0, Math.min(1000000, Math.floor(body.gems)));
    }
    if (body.skin && typeof body.skin === 'object') {
      record.skin = sanitizeSkinPayload(body.skin, record.username);
    }
    if (Array.isArray(body.ownedItems)) {
      record.ownedItems = sanitizeOwnedList([...record.ownedItems, ...body.ownedItems]);
    }
    if (body.unlockedAchievements && typeof body.unlockedAchievements === 'object') {
      record.unlockedAchievements = mergeAchievementsMaps(
        record.unlockedAchievements,
        sanitizeAchievementsMap(body.unlockedAchievements)
      );
    }
    if (body.lifetimeStats && typeof body.lifetimeStats === 'object') {
      record.lifetimeStats = mergeLifetimeStats(
        record.lifetimeStats,
        sanitizeLifetimeStats(body.lifetimeStats)
      );
    }
    record.updatedAt = Date.now();

    persistAccountsStore();
    const lbRecord = leaderboardByPlayerKey.get(record.uid);
    if (lbRecord) {
      lbRecord.username = record.username;
      lbRecord.skin = record.skin;
      persistLeaderboardStore();
    }
    broadcastAccountSync(record.uid, sourceToken, 'account:synced');
    res.json({ profile: toPublicProfile(record) });
  });

  // Two-way account sync (merges owned items cleanly and resolves state across devices)
  app.post('/api/auth/sync', (req, res) => {
    const sourceToken = getAuthTokenFromRequest(req);
    const uid = sourceToken ? sessionTokens.get(sourceToken) || null : null;
    const record = uid ? accountsByUid.get(uid) : undefined;
    if (!record) {
      res.status(401).json({ error: 'Требуется вход в аккаунт.' });
      return;
    }

    const body = req.body || {};
    const clientUpdatedAt =
      typeof body.clientUpdatedAt === 'number' && Number.isFinite(body.clientUpdatedAt)
        ? body.clientUpdatedAt
        : 0;

    let changed = false;
    if (Array.isArray(body.ownedItems)) {
      const merged = sanitizeOwnedList([...record.ownedItems, ...body.ownedItems]);
      if (merged.length !== record.ownedItems.length) {
        record.ownedItems = merged;
        changed = true;
      }
    }

    // Apply client mutations only if client is at least as fresh as server
    if (clientUpdatedAt >= record.updatedAt) {
      if (typeof body.bio === 'string') {
        const cleanBio = body.bio.trim().slice(0, 80);
        if (cleanBio !== record.bio) {
          record.bio = cleanBio;
          changed = true;
        }
      }
      if (typeof body.coins === 'number' && Number.isFinite(body.coins)) {
        const nextCoins = Math.max(0, Math.min(10000000, Math.floor(body.coins)));
        if (nextCoins !== record.coins) {
          record.coins = nextCoins;
          changed = true;
        }
      }
      if (typeof body.gems === 'number' && Number.isFinite(body.gems)) {
        const nextGems = Math.max(0, Math.min(1000000, Math.floor(body.gems)));
        if (nextGems !== record.gems) {
          record.gems = nextGems;
          changed = true;
        }
      }
      if (body.skin && typeof body.skin === 'object') {
        record.skin = sanitizeSkinPayload(body.skin, record.username);
        changed = true;
      }
    }

    if (body.unlockedAchievements && typeof body.unlockedAchievements === 'object') {
      const mergedAch = mergeAchievementsMaps(
        record.unlockedAchievements,
        sanitizeAchievementsMap(body.unlockedAchievements)
      );
      if (Object.keys(mergedAch).length > Object.keys(record.unlockedAchievements || {}).length) {
        record.unlockedAchievements = mergedAch;
        changed = true;
      }
    }
    if (body.lifetimeStats && typeof body.lifetimeStats === 'object') {
      const mergedLife = mergeLifetimeStats(
        record.lifetimeStats,
        sanitizeLifetimeStats(body.lifetimeStats)
      );
      if (
        mergedLife.totalJumps !== (record.lifetimeStats?.totalJumps || 0) ||
        mergedLife.totalDeaths !== (record.lifetimeStats?.totalDeaths || 0)
      ) {
        record.lifetimeStats = mergedLife;
        changed = true;
      }
    }

    if (changed) {
      record.updatedAt = Date.now();
      persistAccountsStore();
      broadcastAccountSync(record.uid, sourceToken, 'account:synced');
    }

    res.json({ profile: toPublicProfile(record) });
  });

  // Portable Account Sync Export (transfer/sync account across separate servers or browsers)
  app.post('/api/auth/sync-export', (req, res) => {
    const uid = getAuthUidFromRequest(req);
    const record = uid ? accountsByUid.get(uid) : undefined;
    if (!record) {
      res.status(401).json({ error: 'Требуется вход в аккаунт.' });
      return;
    }

    const corePayload = {
      v: 1,
      uid: record.uid,
      username: record.username,
      bio: record.bio,
      coins: record.coins,
      gems: record.gems,
      skin: record.skin,
      ownedItems: record.ownedItems,
      passwordSalt: record.passwordSalt,
      passwordHash: record.passwordHash,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    const checksum = buildSyncChecksum(corePayload);
    const encoded = Buffer.from(
      JSON.stringify({ ...corePayload, checksum }),
      'utf-8'
    ).toString('base64url');

    res.json({
      syncCode: `BLOXSYNC1.${encoded}`,
      profile: toPublicProfile(record),
    });
  });

  // Portable Account Sync Import
  app.post('/api/auth/sync-import', (req, res) => {
    const body = req.body || {};
    const rawCode = typeof body.syncCode === 'string' ? body.syncCode.replace(/\s+/g, '') : '';
    const confirmPassword = typeof body.password === 'string' ? body.password : '';

    if (!rawCode.startsWith('BLOXSYNC1.')) {
      res.status(400).json({ error: 'Неверный формат кода синхронизации (ожидается BLOXSYNC1...).' });
      return;
    }

    let parsed: any;
    try {
      const jsonText = Buffer.from(rawCode.slice('BLOXSYNC1.'.length), 'base64url').toString('utf-8');
      parsed = JSON.parse(jsonText);
    } catch {
      res.status(400).json({ error: 'Повреждённый код синхронизации.' });
      return;
    }

    const username = sanitizeServerUsername(parsed?.username);
    if (
      !parsed ||
      parsed.v !== 1 ||
      !isValidServerUsername(username) ||
      typeof parsed.passwordSalt !== 'string' ||
      typeof parsed.passwordHash !== 'string' ||
      typeof parsed.checksum !== 'string'
    ) {
      res.status(400).json({ error: 'Код синхронизации не содержит корректный профиль.' });
      return;
    }

    const expectedChecksum = buildSyncChecksum(parsed);
    if (expectedChecksum !== parsed.checksum) {
      res.status(400).json({ error: 'Контрольная сумма кода синхронизации не совпадает.' });
      return;
    }

    const lower = username.toLowerCase();
    const twoFactorCode = typeof body.twoFactorCode === 'string' ? body.twoFactorCode.trim() : '';
    if (lower === OWNER_2FA_USERNAME) {
      if (!twoFactorCode) {
        res.status(403).json({
          requires2FA: true,
          twoFactorStep: 'prompt',
          error: `Для переноса аккаунта ${username} введите код 2FA.`,
        });
        return;
      }
      if (twoFactorCode !== OWNER_2FA_CODE) {
        res.status(403).json({
          requires2FA: true,
          twoFactorStep: 'invalid',
          error: 'Неверный код 2FA. Попробуйте ещё раз.',
        });
        return;
      }
    }
    const existingUid = uidByUsernameLower.get(lower);
    const existingRecord = existingUid ? accountsByUid.get(existingUid) : undefined;
    const importedUpdatedAt =
      typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)
        ? parsed.updatedAt
        : Date.now();

    let targetRecord: StoredAccountRecord;

    if (existingRecord) {
      const sameHash = existingRecord.passwordHash === parsed.passwordHash;
      const passwordOk =
        confirmPassword.length >= 4 &&
        verifyPassword(confirmPassword, existingRecord.passwordSalt, existingRecord.passwordHash);

      if (!sameHash && !passwordOk) {
        res.status(403).json({
          error: `Аккаунт «${username}» уже есть на этом сервере. Введите пароль аккаунта для подтверждения синхронизации.`,
          needsPassword: true,
        });
        return;
      }

      // Merge items as union and take newer state for skin/wallet/bio
      existingRecord.ownedItems = sanitizeOwnedList([
        ...existingRecord.ownedItems,
        ...(Array.isArray(parsed.ownedItems) ? parsed.ownedItems : []),
      ]);
      if (importedUpdatedAt >= existingRecord.updatedAt) {
        existingRecord.bio = typeof parsed.bio === 'string' ? parsed.bio.trim().slice(0, 80) : existingRecord.bio;
        existingRecord.coins =
          typeof parsed.coins === 'number'
            ? Math.max(0, Math.min(10000000, Math.floor(parsed.coins)))
            : existingRecord.coins;
        existingRecord.gems =
          typeof parsed.gems === 'number'
            ? Math.max(0, Math.min(1000000, Math.floor(parsed.gems)))
            : existingRecord.gems;
        if (parsed.skin) {
          existingRecord.skin = sanitizeSkinPayload(parsed.skin, existingRecord.username);
        }
        existingRecord.updatedAt = Date.now();
      } else {
        existingRecord.updatedAt = Date.now();
      }
      targetRecord = existingRecord;
    } else {
      const uid =
        typeof parsed.uid === 'string' && parsed.uid.length >= 4 && parsed.uid.length <= 64
          ? parsed.uid
          : `u_${crypto.randomBytes(10).toString('hex')}`;
      targetRecord = {
        uid,
        username,
        usernameLower: lower,
        bio: typeof parsed.bio === 'string' ? parsed.bio.trim().slice(0, 80) : '',
        role: 'player',
        coins:
          typeof parsed.coins === 'number' && Number.isFinite(parsed.coins)
            ? Math.max(0, Math.min(10000000, Math.floor(parsed.coins)))
            : 100,
        gems:
          typeof parsed.gems === 'number' && Number.isFinite(parsed.gems)
            ? Math.max(0, Math.min(1000000, Math.floor(parsed.gems)))
            : 3,
        skin: sanitizeSkinPayload(parsed.skin, username),
        ownedItems: sanitizeOwnedList(parsed.ownedItems),
        passwordSalt: parsed.passwordSalt,
        passwordHash: parsed.passwordHash,
        createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
        updatedAt: Date.now(),
      };
      accountsByUid.set(uid, targetRecord);
      uidByUsernameLower.set(lower, uid);
    }

    const token = crypto.randomBytes(32).toString('hex');
    sessionTokens.set(token, targetRecord.uid);
    persistAccountsStore();
    broadcastAccountSync(targetRecord.uid, token, 'account:synced');

    res.json({
      token,
      profile: toPublicProfile(targetRecord),
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = getAuthTokenFromRequest(req);
    const uid = token ? sessionTokens.get(token) || null : null;
    const allDevices = Boolean(req.body?.allDevices);

    if (allDevices && uid) {
      for (const [tok, mappedUid] of Array.from(sessionTokens.entries())) {
        if (mappedUid === uid) {
          sessionTokens.delete(tok);
        }
      }
      persistAccountsStore();
      broadcastAccountSync(uid, undefined, 'account:logged_out');
    } else if (token && sessionTokens.has(token)) {
      sessionTokens.delete(token);
      persistAccountsStore();
    }
    res.json({ ok: true });
  });

  // API endpoint for active multiplayer servers / rooms
  app.get('/api/servers', (_req, res) => {
    getOrCreateRoom('doors-main', 'online', 'doors');
    getOrCreateRoom('obby-main', 'online', 'obby');
    const serverList: { id: string; gameId: string; mode: string; playerCount: number; players: string[] }[] = [];

    rooms.forEach((r) => {
      if (r.players.size > 0 || r.id === 'doors-main' || r.id === 'obby-main') {
        serverList.push({
          id: r.id,
          gameId: r.gameId,
          mode: r.mode,
          playerCount: r.players.size,
          players: Array.from(r.players.values()).map((p) => p.skin.name),
        });
      }
    });

    const totalOnline = Array.from(rooms.values()).reduce((acc, r) => acc + r.players.size, 0);
    const doorsMain = rooms.get('doors-main');
    res.json({
      onlinePlayersTotal: totalOnline,
      publicRoomPlayers: doorsMain ? doorsMain.players.size : 0,
      servers: serverList,
    });
  });

  // Lookup an active room by short room code (so joining friend's code finds the right gameId automatically)
  app.get('/api/rooms/lookup/:code', (req, res) => {
    const cleanCode = String(req.params.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');

    if (!cleanCode) {
      res.json({ found: false });
      return;
    }

    const normalizedCandidate = normalizeServerRoomId(cleanCode, 'lan');
    let matched: RoomState | null = null;
    for (const room of rooms.values()) {
      if (room.players.size === 0) continue;
      const suffix = room.id.includes('-') ? room.id.slice(room.id.indexOf('-') + 1) : room.id;
      if (
        room.id === normalizedCandidate ||
        room.id.toUpperCase() === cleanCode ||
        suffix.toUpperCase() === cleanCode
      ) {
        matched = room;
        break;
      }
    }

    if (!matched) {
      res.json({ found: false });
      return;
    }

    res.json({
      found: true,
      roomId: matched.id,
      gameId: matched.gameId,
      mode: matched.mode,
      playerCount: matched.players.size,
      players: Array.from(matched.players.values()).map((p) => p.skin.name),
    });
  });

  // HTTP Multiplayer Fallback Routes (work reliably even behind strict mobile/corporate WS proxies)
  app.post('/api/multiplayer/join', (req, res) => {
    const body = req.body || {};
    const clientId = String(body.clientId || `p_${Math.random().toString(36).slice(2, 9)}`);
    const mode = body.mode === 'lan' ? 'lan' : 'online';
    const rawTargetRoomId = String(body.roomId || 'doors-main');
    const gameId = typeof body.gameId === 'string' ? body.gameId : inferGameIdFromRoom(rawTargetRoomId);
    const targetRoomId = normalizeServerRoomId(rawTargetRoomId, mode, gameId);
    const previousRoomId =
      typeof body.previousRoomId === 'string'
        ? normalizeServerRoomId(body.previousRoomId, mode, gameId)
        : null;

    if (previousRoomId && previousRoomId !== targetRoomId) {
      const oldRoom = rooms.get(previousRoomId);
      if (oldRoom && oldRoom.players.has(clientId)) {
        const leaving = oldRoom.players.get(clientId);
        oldRoom.players.delete(clientId);
        oldRoom.clients.delete(clientId);
        broadcastToRoom(
          oldRoom,
          { type: 'player:left', payload: { id: clientId, name: leaving?.skin.name } },
          clientId
        );
      }
    }

    const room = getOrCreateRoom(targetRoomId, mode, gameId);
    const fallbackName = sanitizeServerUsername(body.skin?.name || 'RockBlox') || 'RockBlox';
    const safeSkin = sanitizeSkinPayload(body.skin, body.skin?.name || fallbackName);
    const alreadyInRoom = room.players.has(clientId);

    const playerState: RoomPlayerState = {
      id: clientId,
      playerKey: typeof body.playerKey === 'string' ? body.playerKey.slice(0, 128) : undefined,
      bio: typeof body.bio === 'string' ? filterProfanity(body.bio.trim().slice(0, 80)) : undefined,
      gems: typeof body.gems === 'number' ? Math.max(0, Math.floor(body.gems)) : undefined,
      unlockedAchievements: sanitizeAchievementsMap(body.unlockedAchievements),
      lifetimeStats: body.lifetimeStats ? sanitizeLifetimeStats(body.lifetimeStats) : undefined,
      roomId: room.id,
      skin: safeSkin,
      position: Array.isArray(body.position) && body.position.length === 3 ? body.position : [0, 1.5, 0],
      rotationY: typeof body.rotationY === 'number' ? body.rotationY : 0,
      isMoving: Boolean(body.isMoving),
      isGrounded: body.isGrounded !== false,
      activeTool: typeof body.activeTool === 'string' ? body.activeTool : 'sword',
      checkpoint: typeof body.checkpoint === 'number' ? body.checkpoint : 0,
      coins: typeof body.coins === 'number' ? body.coins : 0,
      lastUpdated: Date.now(),
      transport: 'http',
    };

    room.players.set(clientId, playerState);

    if (!alreadyInRoom) {
      broadcastToRoom(
        room,
        {
          type: 'player:joined',
          payload: { ...playerState, gameId: room.gameId },
        },
        clientId
      );
    }

    const nowInit = Date.now();
    res.json({
      selfId: clientId,
      roomId: room.id,
      gameId: room.gameId,
      seq: room.eventSeq,
      players: Array.from(room.players.values()).map((pl) => ({
        ...pl,
        activeEmote: pl.activeEmote && pl.activeEmote.expiresAt > nowInit ? pl.activeEmote : undefined,
      })),
      blocks: Array.from(room.blocks.values()),
      openedDoors: Array.from(room.openedDoors),
      elevatorClosed: room.elevatorClosed,
      chatHistory: room.chatHistory,
    });
  });

  app.post('/api/multiplayer/sync', (req, res) => {
    const body = req.body || {};
    const clientId = String(body.clientId || '');
    const rawRoomId = String(body.roomId || '');
    const mode = body.mode === 'lan' ? 'lan' : 'online';
    const roomId = rawRoomId ? normalizeServerRoomId(rawRoomId, mode, body.gameId) : '';
    const sinceSeq = typeof body.sinceSeq === 'number' && Number.isFinite(body.sinceSeq) ? body.sinceSeq : 0;

    if (!clientId || !roomId) {
      res.status(400).json({ error: 'Missing clientId or roomId' });
      return;
    }

    const room = getOrCreateRoom(roomId, mode, body.gameId);
    let player = room.players.get(clientId);

    if (!player) {
      const safeSkin = sanitizeSkinPayload(body.skin, body.skin?.name || 'Player');
      player = {
        id: clientId,
        roomId,
        skin: safeSkin,
        position: Array.isArray(body.position) ? body.position : [0, 1.5, 0],
        rotationY: typeof body.rotationY === 'number' ? body.rotationY : 0,
        isMoving: Boolean(body.isMoving),
        isGrounded: body.isGrounded !== false,
        activeTool: typeof body.activeTool === 'string' ? body.activeTool : 'sword',
        checkpoint: typeof body.checkpoint === 'number' ? body.checkpoint : 0,
        coins: typeof body.coins === 'number' ? body.coins : 0,
        lastUpdated: Date.now(),
        transport: 'http',
      };
      room.players.set(clientId, player);
      broadcastToRoom(room, { type: 'player:joined', payload: player }, clientId);
    } else {
      if (Array.isArray(body.position) && body.position.length === 3) player.position = body.position;
      if (typeof body.rotationY === 'number') player.rotationY = body.rotationY;
      if (typeof body.isMoving === 'boolean') player.isMoving = body.isMoving;
      if (typeof body.isGrounded === 'boolean') player.isGrounded = body.isGrounded;
      if (typeof body.activeTool === 'string') player.activeTool = body.activeTool;
      if (typeof body.checkpoint === 'number') player.checkpoint = body.checkpoint;
      if (typeof body.coins === 'number') player.coins = body.coins;
      if (body.skin && typeof body.skin === 'object') {
        player.skin = sanitizeSkinPayload(body.skin, body.skin.name || player.skin.name);
      }
      if (typeof body.playerKey === 'string') player.playerKey = body.playerKey.slice(0, 128);
      if (typeof body.bio === 'string') player.bio = filterProfanity(body.bio.trim().slice(0, 80));
      if (typeof body.gems === 'number') player.gems = Math.max(0, Math.floor(body.gems));
      if (body.unlockedAchievements && typeof body.unlockedAchievements === 'object') {
        player.unlockedAchievements = mergeAchievementsMaps(
          player.unlockedAchievements,
          sanitizeAchievementsMap(body.unlockedAchievements)
        );
      }
      if (body.lifetimeStats && typeof body.lifetimeStats === 'object') {
        player.lifetimeStats = mergeLifetimeStats(
          player.lifetimeStats,
          sanitizeLifetimeStats(body.lifetimeStats)
        );
      }
      player.lastUpdated = Date.now();
      player.transport = 'http';

      // Push live movement update to WebSocket peers in this room
      const updatePayload = {
        type: 'player:updated',
        payload: {
          id: clientId,
          skin: player.skin,
          position: player.position,
          rotationY: player.rotationY,
          isMoving: player.isMoving,
          isGrounded: player.isGrounded,
          activeTool: player.activeTool,
          checkpoint: player.checkpoint,
          coins: player.coins,
        },
      };
      const serialized = JSON.stringify(updatePayload);
      room.clients.forEach((peerWs, peerId) => {
        if (peerId !== clientId && peerWs.readyState === WebSocket.OPEN) {
          peerWs.send(serialized);
        }
      });
      publishToServerCloudRelay(room.id, clientId, updatePayload);
    }

    // Process any queued discrete actions (blocks, chat, doors, attacks, skin)
    if (Array.isArray(body.actions)) {
      for (const act of body.actions.slice(0, 20)) {
        if (!act || !act.type) continue;
        if (act.type === 'player:skin' && act.payload?.skin) {
          player.skin = sanitizeSkinPayload(act.payload.skin, act.payload.skin.name || player.skin.name);
          broadcastToRoom(room, { type: 'player:skin_updated', payload: { id: clientId, skin: player.skin } }, clientId);
        } else if (act.type === 'player:attack') {
          broadcastToRoom(room, { type: 'player:attacked', payload: { id: clientId } }, clientId);
        } else if (act.type === 'player:emote' && isValidEmoteId(act.payload?.emoteId)) {
          const dur = Math.max(
            800,
            Math.min(8000, Number(act.payload?.durationMs) || getEmoteById(act.payload.emoteId).durationMs)
          );
          player.activeEmote = { id: act.payload.emoteId, expiresAt: Date.now() + dur };
          broadcastToRoom(
            room,
            {
              type: 'player:emoted',
              payload: {
                id: clientId,
                emoteId: act.payload.emoteId,
                durationMs: dur,
                eventId: typeof act.payload?.eventId === 'string' ? act.payload.eventId : undefined,
              },
            },
            clientId
          );
        } else if (act.type === 'block:place' && act.payload?.key && Array.isArray(act.payload?.position)) {
          if (!room.blocks.has(act.payload.key) && room.blocks.size < 100) {
            const block: RoomBlock = {
              key: String(act.payload.key),
              position: act.payload.position,
              color: String(act.payload.color || '#ef4444'),
            };
            room.blocks.set(block.key, block);
            broadcastToRoom(room, { type: 'block:placed', payload: block }, clientId);
          }
        } else if (act.type === 'block:remove' && act.payload?.key) {
          if (room.blocks.has(act.payload.key)) {
            room.blocks.delete(act.payload.key);
            broadcastToRoom(room, { type: 'block:removed', payload: { key: act.payload.key } }, clientId);
          }
        } else if (act.type === 'doors:open' && typeof act.payload?.doorIndex === 'number') {
          const idx = Math.floor(act.payload.doorIndex);
          if (!room.openedDoors.has(idx)) {
            room.openedDoors.add(idx);
            broadcastToRoom(
              room,
              { type: 'doors:opened', payload: { doorIndex: idx, doorNumber: act.payload.doorNumber } },
              clientId
            );
          }
        } else if (act.type === 'doors:elevator') {
          if (!room.elevatorClosed) {
            room.elevatorClosed = true;
            broadcastToRoom(room, { type: 'doors:elevator_closed', payload: {} }, clientId);
          }
        } else if (act.type === 'chat:send' && act.payload?.text) {
          const msg: ChatMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            author: filterProfanity(String(act.payload.author || player.skin.name || 'Игрок')),
            text: filterProfanity(String(act.payload.text).slice(0, 140)),
            timestamp: Date.now(),
          };
          room.chatHistory.push(msg);
          if (room.chatHistory.length > 25) room.chatHistory.shift();
          broadcastToRoom(room, { type: 'chat:message', payload: msg }, clientId);
        } else if (act.type === 'voice:state' && act.payload) {
          const enabled = Boolean(act.payload.enabled);
          const muted = Boolean(act.payload.muted);
          const speaking = enabled && !muted && Boolean(act.payload.speaking);
          player.voiceEnabled = enabled;
          player.voiceMuted = muted;
          player.voiceSpeaking = speaking;
          broadcastToRoom(
            room,
            { type: 'voice:state', payload: { id: clientId, enabled, muted, speaking } },
            clientId
          );
        } else if (act.type === 'voice:signal' && act.payload) {
          relayVoiceSignalInRoom(room, clientId, act.payload, true);
        }
      }
    }

    const events = room.recentEvents.filter(
      (ev) =>
        ev.seq > sinceSeq &&
        ev.senderId !== clientId &&
        (ev.type !== 'voice:signal' || ev.payload?.to === clientId)
    );

    res.json({
      ok: true,
      seq: room.eventSeq,
      players: Array.from(room.players.values()),
      events,
    });
  });

  app.post('/api/multiplayer/leave', (req, res) => {
    const body = req.body || {};
    const clientId = String(body.clientId || '');
    const rawRoomId = String(body.roomId || '');
    const roomId = rawRoomId ? normalizeServerRoomId(rawRoomId) : '';
    const room = roomId ? rooms.get(roomId) : undefined;
    if (room && clientId && room.players.has(clientId)) {
      const leaving = room.players.get(clientId);
      room.players.delete(clientId);
      room.clients.delete(clientId);
      broadcastToRoom(
        room,
        { type: 'player:left', payload: { id: clientId, name: leaving?.skin.name } },
        clientId
      );
    }
    res.json({ ok: true });
  });

  // Global Leaderboard Routes (ranked by completed levels desc, then fastest time asc)
  app.get('/api/leaderboard', (req, res) => {
    const rawGame = typeof req.query.gameId === 'string' ? req.query.gameId : 'all';
    const gameFilter: 'all' | LeaderboardGameId =
      rawGame === 'doors' || rawGame === 'obby' || rawGame === 'lava_survival' || rawGame === 'bee_swarm' || rawGame === 'studio'
        ? rawGame
        : 'all';
    const viewerPlayerKey = typeof req.query.playerKey === 'string' ? req.query.playerKey.trim().slice(0, 128) : undefined;
    res.json(buildRankedLeaderboard(gameFilter, viewerPlayerKey));
  });

  // Public Player Profile Lookup (aggregates live room, cloud account, and leaderboard data)
  app.get('/api/players/profile', (req, res) => {
    const rawPlayerKey = typeof req.query.playerKey === 'string' ? req.query.playerKey.trim().slice(0, 128) : '';
    const rawUsername = typeof req.query.username === 'string' ? req.query.username.trim().slice(0, 32) : '';
    const rawClientId = typeof req.query.clientId === 'string' ? req.query.clientId.trim().slice(0, 128) : '';

    if (!rawPlayerKey && !rawUsername && !rawClientId) {
      res.status(400).json({ error: 'Missing playerKey, username, or clientId' });
      return;
    }

    const lowerName = rawUsername.toLowerCase();

    // 1. Find account record if available
    let account: StoredAccountRecord | undefined = rawPlayerKey ? accountsByUid.get(rawPlayerKey) : undefined;
    if (!account && lowerName) {
      const foundUid = uidByUsernameLower.get(lowerName);
      if (foundUid) account = accountsByUid.get(foundUid);
    }

    // 2. Find live room player if currently online
    let livePlayer: RoomPlayerState | undefined;
    let liveGameId: LeaderboardGameId | undefined;
    for (const room of rooms.values()) {
      for (const p of room.players.values()) {
        if (
          (rawClientId && p.id === rawClientId) ||
          (rawPlayerKey && p.playerKey === rawPlayerKey) ||
          (lowerName && p.skin?.name?.toLowerCase() === lowerName) ||
          (account && p.playerKey === account.uid)
        ) {
          livePlayer = p;
          liveGameId = normalizeLeaderboardGameId(room.gameId);
          break;
        }
      }
      if (livePlayer) break;
    }

    // 3. Find leaderboard record
    let lb: LeaderboardEntryRecord | undefined =
      (account ? leaderboardByPlayerKey.get(account.uid) : undefined) ||
      (rawPlayerKey ? leaderboardByPlayerKey.get(rawPlayerKey) : undefined) ||
      (livePlayer?.playerKey ? leaderboardByPlayerKey.get(livePlayer.playerKey) : undefined);

    if (!lb && lowerName) {
      for (const item of leaderboardByPlayerKey.values()) {
        if (item.username.toLowerCase() === lowerName) {
          lb = item;
          break;
        }
      }
    }

    if (!account && !livePlayer && !lb) {
      res.status(404).json({ error: 'Player profile not found' });
      return;
    }

    const resolvedName = filterProfanity(
      account?.username || livePlayer?.skin?.name || lb?.username || rawUsername || 'Player'
    );
    const resolvedKey =
      account?.uid ||
      livePlayer?.playerKey ||
      lb?.playerKey ||
      rawPlayerKey ||
      `guest:${resolvedName.toLowerCase()}`;

    const ranked = buildRankedLeaderboard('all', resolvedKey);
    const resolvedSkin = sanitizeSkinPayload(
      livePlayer?.skin || account?.skin || lb?.skin || {},
      resolvedName
    );

    const unlockedAchievements = mergeAchievementsMaps(
      mergeAchievementsMaps(account?.unlockedAchievements, lb?.unlockedAchievements),
      livePlayer?.unlockedAchievements
    );

    const totalJumps = Math.max(
      account?.lifetimeStats?.totalJumps || 0,
      livePlayer?.lifetimeStats?.totalJumps || 0,
      lb?.totalJumps || 0
    );
    const totalDeaths = Math.max(
      account?.lifetimeStats?.totalDeaths || 0,
      livePlayer?.lifetimeStats?.totalDeaths || 0,
      lb?.totalDeaths || 0
    );

    const totalCoins = Math.max(
      account?.coins || 0,
      livePlayer?.coins || 0,
      lb?.coins || 0
    );
    const totalGems = Math.max(
      account?.gems || 0,
      livePlayer?.gems || 0,
      lb?.gems || 0
    );

    res.json({
      playerKey: resolvedKey,
      username: resolvedName,
      bio: filterProfanity(account?.bio || livePlayer?.bio || lb?.bio || ''),
      accountType: account || resolvedKey.startsWith('u_') ? 'cloud' : 'guest',
      isOnline: Boolean(livePlayer),
      currentGameId: liveGameId || lb?.bestGameId,
      roomCheckpoint: livePlayer ? livePlayer.checkpoint : undefined,
      skin: resolvedSkin,
      stats: {
        totalCoins,
        totalGems,
        completedLevels: lb?.completedLevels || 0,
        victories: lb?.victories || 0,
        bestTimeSeconds: lb?.bestTimeSeconds || 0,
        totalTimeSeconds: lb?.totalTimeSeconds || 0,
        totalJumps,
        totalDeaths,
      },
      perGameStats: lb?.perGameStats || {},
      unlockedAchievements,
      leaderboardRank: ranked.viewerRank,
      updatedAt: Math.max(account?.updatedAt || 0, lb?.updatedAt || 0, livePlayer?.lastUpdated || 0),
    });
  });

  app.post('/api/leaderboard/submit', (req, res) => {
    const body = req.body || {};
    const token = getAuthTokenFromRequest(req);
    const authUid = token ? sessionTokens.get(token) || null : null;
    const accountRecord = authUid ? accountsByUid.get(authUid) : undefined;

    const rawUsername = accountRecord
      ? accountRecord.username
      : String(body.username || body.skin?.name || 'Player').trim().slice(0, 16) || 'Player';
    const playerKey = accountRecord
      ? accountRecord.uid
      : String(body.playerKey || `guest:${rawUsername.toLowerCase()}`).trim().slice(0, 128);

    if (!playerKey || !rawUsername) {
      res.status(400).json({ error: 'Missing playerKey or username' });
      return;
    }

    const gameId = normalizeLeaderboardGameId(body.gameId);
    const eventType = body.eventType === 'victory' ? 'victory' : 'level_clear';
    const runId = typeof body.runId === 'string' ? body.runId.slice(0, 64) : `run_${Date.now()}`;
    const levelKey = typeof body.levelKey === 'string' ? body.levelKey.slice(0, 64) : `${gameId}_lvl`;
    const runDedupKey = `${runId}::${levelKey}`;
    const elapsedSeconds =
      typeof body.elapsedSeconds === 'number' && Number.isFinite(body.elapsedSeconds)
        ? Math.max(1, Math.min(86400, Math.floor(body.elapsedSeconds)))
        : 1;
    const completionTime =
      typeof body.completionTime === 'number' && Number.isFinite(body.completionTime)
        ? Math.max(1, Math.min(86400, Math.floor(body.completionTime)))
        : elapsedSeconds;
    const levelsDelta =
      typeof body.levelsDelta === 'number' && Number.isFinite(body.levelsDelta)
        ? Math.max(1, Math.min(10, Math.floor(body.levelsDelta)))
        : 1;

    const now = Date.now();
    let entry = leaderboardByPlayerKey.get(playerKey);
    if (!entry) {
      entry = {
        playerKey,
        username: rawUsername,
        completedLevels: 0,
        victories: 0,
        bestTimeSeconds: 0,
        totalTimeSeconds: 0,
        bestGameId: gameId,
        perGameStats: {},
        skin: accountRecord ? accountRecord.skin : sanitizeSkinPayload(body.skin, rawUsername),
        recentRunKeys: [],
        updatedAt: now,
      };
      leaderboardByPlayerKey.set(playerKey, entry);
    }

    entry.username = rawUsername;
    if (accountRecord) {
      entry.skin = accountRecord.skin;
      entry.bio = accountRecord.bio;
      entry.coins = accountRecord.coins;
      entry.gems = accountRecord.gems;
      entry.unlockedAchievements = mergeAchievementsMaps(
        entry.unlockedAchievements,
        accountRecord.unlockedAchievements
      );
      entry.totalJumps = Math.max(entry.totalJumps || 0, accountRecord.lifetimeStats?.totalJumps || 0);
      entry.totalDeaths = Math.max(entry.totalDeaths || 0, accountRecord.lifetimeStats?.totalDeaths || 0);
    } else if (body.skin && typeof body.skin === 'object') {
      entry.skin = sanitizeSkinPayload(body.skin, rawUsername);
    }

    if (typeof body.bio === 'string') {
      entry.bio = filterProfanity(body.bio.trim().slice(0, 80));
    }
    if (typeof body.coins === 'number' && Number.isFinite(body.coins)) {
      entry.coins = Math.max(0, Math.floor(body.coins));
    }
    if (typeof body.gems === 'number' && Number.isFinite(body.gems)) {
      entry.gems = Math.max(0, Math.floor(body.gems));
    }
    if (typeof body.totalJumps === 'number' && Number.isFinite(body.totalJumps)) {
      entry.totalJumps = Math.max(entry.totalJumps || 0, Math.floor(body.totalJumps));
    }
    if (typeof body.totalDeaths === 'number' && Number.isFinite(body.totalDeaths)) {
      entry.totalDeaths = Math.max(entry.totalDeaths || 0, Math.floor(body.totalDeaths));
    }
    if (body.unlockedAchievements && typeof body.unlockedAchievements === 'object') {
      entry.unlockedAchievements = mergeAchievementsMaps(
        entry.unlockedAchievements,
        sanitizeAchievementsMap(body.unlockedAchievements)
      );
    }

    const alreadyProcessed = (entry.recentRunKeys || []).includes(runDedupKey);
    if (!alreadyProcessed) {
      entry.recentRunKeys = [...(entry.recentRunKeys || []), runDedupKey].slice(-80);
      entry.completedLevels += levelsDelta;
      entry.totalTimeSeconds += elapsedSeconds;
      entry.updatedAt = now;

      const gs = entry.perGameStats[gameId] || {
        completedLevels: 0,
        victories: 0,
        bestTimeSeconds: 0,
      };
      gs.completedLevels += levelsDelta;

      if (eventType === 'victory') {
        entry.victories += 1;
        gs.victories += 1;
        if (entry.bestTimeSeconds === 0 || completionTime < entry.bestTimeSeconds) {
          entry.bestTimeSeconds = completionTime;
          entry.bestGameId = gameId;
        }
        if (gs.bestTimeSeconds === 0 || completionTime < gs.bestTimeSeconds) {
          gs.bestTimeSeconds = completionTime;
        }
      }

      entry.perGameStats[gameId] = gs;
      persistLeaderboardStore();

      const updatePacket = JSON.stringify({
        type: 'leaderboard:updated',
        payload: { gameId },
      });
      wss.clients.forEach((clientWs) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          try {
            clientWs.send(updatePacket);
          } catch {}
        }
      });
    }

    const ranked = buildRankedLeaderboard('all', playerKey);
    res.json({
      ok: true,
      entry: ranked.viewerEntry || entry,
      rank: ranked.viewerRank,
      totalPlayers: ranked.totalPlayers,
      entries: ranked.entries,
    });
  });

  // Real Feedback Submission + Email Delivery to gerdgrad9@gmail.com
  app.get('/api/feedback', (_req, res) => {
    const recipient = (process.env.FEEDBACK_TO_EMAIL || DEFAULT_FEEDBACK_RECIPIENT).trim();
    const sorted = feedbackMessages
      .slice()
      .sort((a, b) => {
        if (Boolean(b.pinned) !== Boolean(a.pinned)) {
          return b.pinned ? 1 : -1;
        }
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    res.json({
      recipient,
      emailConfigured: hasFeedbackMailProvider(),
      summary: computeFeedbackSummary(feedbackMessages),
      items: sorted,
    });
  });

  app.get('/api/feedback/summary', (_req, res) => {
    const summary = computeFeedbackSummary(feedbackMessages);
    const recentReviews = feedbackMessages
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 12)
      .map((item) => ({
        id: item.id,
        author: item.author,
        rating: item.rating,
        message: item.message,
        gameId: item.gameId,
        createdAt: item.createdAt,
      }));
    res.json({
      ok: true,
      summary,
      recentReviews,
    });
  });

  app.post('/api/feedback', async (req, res) => {
    const body = req.body || {};
    const ratingNum = typeof body.rating === 'number' && Number.isFinite(body.rating)
      ? Math.max(0, Math.min(5, Math.floor(body.rating)))
      : 0;
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : '';
    const author = typeof body.author === 'string' && body.author.trim()
      ? body.author.trim().slice(0, 32)
      : 'Игрок';
    const contactEmail = typeof body.contactEmail === 'string' ? body.contactEmail.trim().slice(0, 120) : '';
    const gameId = typeof body.gameId === 'string' ? body.gameId.slice(0, 32) : '';
    const mode = typeof body.mode === 'string' ? body.mode.slice(0, 32) : '';
    const roomId = typeof body.roomId === 'string' ? body.roomId.slice(0, 64) : '';

    if (ratingNum === 0 && !message) {
      res.status(400).json({ error: 'Поставьте оценку или напишите текст отзыва.' });
      return;
    }

    const record: FeedbackRecord = {
      id: `fb_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      rating: ratingNum,
      message,
      author,
      contactEmail: contactEmail || undefined,
      gameId: gameId || undefined,
      mode: mode || undefined,
      roomId: roomId || undefined,
      createdAt: Date.now(),
      emailDelivered: false,
      provider: 'none',
      isRead: false,
      pinned: false,
    };

    const delivery = await deliverFeedbackEmail(record);
    record.emailDelivered = delivery.emailDelivered;
    record.provider = delivery.provider;
    if (delivery.deliveryError) {
      record.deliveryError = delivery.deliveryError;
    }

    feedbackMessages.push(record);
    persistFeedbackStore();

    const recipient = (process.env.FEEDBACK_TO_EMAIL || DEFAULT_FEEDBACK_RECIPIENT).trim();
    const subjectText = encodeURIComponent(
      `[Blox Hub] Отзыв от ${author} (${ratingNum ? `${ratingNum}/5` : 'без оценки'})`
    );
    const bodyText = encodeURIComponent(
      `Игрок: ${author}\nОценка: ${ratingNum || '-'}/5\nИгра: ${gameId || '-'}\nКонтакт: ${contactEmail || '-'}\n\nСообщение:\n${message || '(без текста)'}`
    );
    const mailtoUrl = `mailto:${recipient}?subject=${subjectText}&body=${bodyText}`;

    res.status(201).json({
      ok: true,
      id: record.id,
      emailDelivered: record.emailDelivered,
      provider: record.provider,
      needsEmailConfig: !hasFeedbackMailProvider(),
      error: record.deliveryError,
      recipient,
      mailtoUrl,
      summary: computeFeedbackSummary(feedbackMessages),
      feedback: record,
    });
  });

  // Admin Panel Verification (Password 0808) & Live Server Overview
  const ADMIN_PANEL_PIN = (process.env.ADMIN_PANEL_PIN || '0808').trim();
  const verifyAdminPin = (candidate: unknown): boolean => {
    if (typeof candidate !== 'string') return false;
    const trimmed = candidate.trim();
    if (!trimmed || trimmed.length !== ADMIN_PANEL_PIN.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(trimmed), Buffer.from(ADMIN_PANEL_PIN));
    } catch {
      return trimmed === ADMIN_PANEL_PIN;
    }
  };

  app.post('/api/admin/verify', (req, res) => {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!verifyAdminPin(password)) {
      res.status(401).json({ ok: false, error: 'Неверный пароль! Введите правильный код доступа.' });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/admin/overview', (req, res) => {
    const pinHeader = typeof req.headers['x-admin-pin'] === 'string' ? req.headers['x-admin-pin'] : '';
    if (!verifyAdminPin(pinHeader)) {
      res.status(401).json({ error: 'Требуется пароль администратора.' });
      return;
    }

    const activeRooms = Array.from(rooms.values())
      .filter((room) => room.players.size > 0)
      .map((room) => ({
        roomId: room.id,
        gameId: room.gameId,
        mode: room.mode,
        playerCount: room.players.size,
        openedDoorsCount: room.openedDoors.size,
        elevatorClosed: room.elevatorClosed,
        players: Array.from(room.players.values()).map((p) => ({
          id: p.id,
          name: p.skin?.name || 'Игрок',
          coins: p.coins || 0,
          checkpoint: p.checkpoint || 0,
        })),
      }));

    const onlinePlayers = activeRooms.reduce((sum, r) => sum + r.playerCount, 0);

    res.json({
      onlinePlayers,
      activeRoomCount: activeRooms.length,
      accountsCount: accountsByUid.size,
      leaderboardCount: leaderboardByPlayerKey.size,
      feedbackCount: feedbackMessages.length,
      uptimeSeconds: Math.floor(process.uptime()),
      rooms: activeRooms,
    });
  });

  app.patch('/api/admin/feedback/:id', (req, res) => {
    const pinHeader = typeof req.headers['x-admin-pin'] === 'string' ? req.headers['x-admin-pin'] : '';
    if (!verifyAdminPin(pinHeader)) {
      res.status(401).json({ error: 'Требуется пароль администратора.' });
      return;
    }
    const targetId = String(req.params.id || '');
    const record = feedbackMessages.find((item) => item.id === targetId);
    if (!record) {
      res.status(404).json({ error: 'Отзыв не найден.' });
      return;
    }
    if (typeof req.body?.isRead === 'boolean') {
      record.isRead = req.body.isRead;
    }
    if (typeof req.body?.pinned === 'boolean') {
      record.pinned = req.body.pinned;
    }
    persistFeedbackStore();
    res.json({
      ok: true,
      feedback: record,
      summary: computeFeedbackSummary(feedbackMessages),
    });
  });

  app.delete('/api/admin/feedback/:id', (req, res) => {
    const pinHeader = typeof req.headers['x-admin-pin'] === 'string' ? req.headers['x-admin-pin'] : '';
    if (!verifyAdminPin(pinHeader)) {
      res.status(401).json({ error: 'Требуется пароль администратора.' });
      return;
    }
    res.status(403).json({
      error: 'Письма в Почте хранятся навсегда и не подлежат удалению.',
    });
  });

  // Single-flight lock so concurrent standalone HTML downloads share one Vite build
  let activeStandaloneBuild: Promise<void> | null = null;
  let lastStandaloneBuildAt = 0;

  // API endpoint to download the entire game combined into a single standalone HTML file
  // Emits a classic IIFE <script> (NO type="module") inside <body> after #root so it works
  // everywhere: file:///android_asset/index.html (Android/PICO WebView APK), browsers, and HTTPS hosts.
  app.get('/api/download-html', async (req, res) => {
    try {
      const validGames = new Set(['doors', 'obby', 'lava_survival', 'bee_swarm', 'studio']);
      const rawGame = typeof req.query.game === 'string' ? req.query.game.trim() : '';
      const rawMode = typeof req.query.mode === 'string' ? req.query.mode.trim() : '';
      const rawRoom = typeof req.query.room === 'string' ? req.query.room.trim() : '';

      let embeddedInvite: { mode?: 'online' | 'lan_room'; gameId?: string; roomId?: string } | null =
        null;
      if (rawGame || rawMode || rawRoom) {
        const cleanGame = validGames.has(rawGame) ? rawGame : undefined;
        const cleanMode: 'online' | 'lan_room' | undefined =
          rawMode === 'lan_room' ? 'lan_room' : rawMode === 'online' ? 'online' : undefined;
        const cleanRoom = rawRoom
          ? rawRoom
              .toUpperCase()
              .replace(/[^A-Z0-9_-]/g, '')
              .slice(0, 16)
          : undefined;
        if (cleanGame || cleanMode || (cleanRoom && cleanRoom.length >= 2)) {
          embeddedInvite = {
            ...(cleanMode ? { mode: cleanMode } : {}),
            ...(cleanGame ? { gameId: cleanGame } : {}),
            ...(cleanRoom && cleanRoom.length >= 2 ? { roomId: cleanRoom } : {}),
          };
        }
      }

      const distDir = path.join(process.cwd(), 'dist');
      const assetsDir = path.join(distDir, 'assets');
      const distIndexPath = path.join(distDir, 'index.html');

      const needsRebuild =
        !fs.existsSync(distIndexPath) ||
        !fs.existsSync(assetsDir) ||
        Date.now() - lastStandaloneBuildAt > 15000;

      if (needsRebuild) {
        if (!activeStandaloneBuild) {
          activeStandaloneBuild = import('vite')
            .then(({ build: viteBuild }) => viteBuild())
            .then(() => {
              lastStandaloneBuildAt = Date.now();
            })
            .finally(() => {
              activeStandaloneBuild = null;
            });
        }
        await activeStandaloneBuild;
      }

      let html = fs.readFileSync(distIndexPath, 'utf-8');

      // Extract & inline all built local stylesheets referenced by dist/index.html
      const collectedCssChunks: string[] = [];
      html = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi, (tag) => {
        const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
        const href = hrefMatch?.[1] || '';
        if (/^https?:\/\//i.test(href)) {
          // Make external Google Fonts non-blocking on offline APKs / file://
          if (tag.includes('media=')) return tag;
          return tag.replace(/>$/, ' media="print" onload="this.media=\'all\'">');
        }
        const relPath = href.replace(/^\.?\//, '');
        const absCssPath = path.join(distDir, relPath);
        if (relPath && fs.existsSync(absCssPath)) {
          collectedCssChunks.push(fs.readFileSync(absCssPath, 'utf-8'));
          return '';
        }
        return tag;
      });

      if (collectedCssChunks.length === 0 && fs.existsSync(assetsDir)) {
        const fallbackCss = fs.readdirSync(assetsDir).find((f) => f.endsWith('.css'));
        if (fallbackCss) {
          collectedCssChunks.push(fs.readFileSync(path.join(assetsDir, fallbackCss), 'utf-8'));
        }
      }

      const combinedCss = collectedCssChunks.join('\n').replace(/<\/style>/gi, '<\\/style>');
      if (combinedCss) {
        html = html.replace(/<\/head>/i, () => `<style>\n${combinedCss}\n</style>\n</head>`);
      }

      // Remove modulepreload hints so classic WebView doesn't try fetching external module chunks
      html = html.replace(/<link[^>]+rel=["']modulepreload["'][^>]*>/gi, '');

      // Locate built JS entry referenced by <script type="module" ... src="...">
      let entryJsAbsPath: string | null = null;
      html = html.replace(/<script[^>]+type=["']module["'][^>]*src=["']([^"']+)["'][^>]*><\/script>/gi, (_tag, srcPath) => {
        if (!entryJsAbsPath) {
          const relPath = String(srcPath).replace(/^\.?\//, '');
          const candidate = path.join(distDir, relPath);
          if (fs.existsSync(candidate)) {
            entryJsAbsPath = candidate;
          }
        }
        return '';
      });

      if (!entryJsAbsPath && fs.existsSync(assetsDir)) {
        const fallbackJs = fs.readdirSync(assetsDir).find((f) => f.endsWith('.js'));
        if (fallbackJs) {
          entryJsAbsPath = path.join(assetsDir, fallbackJs);
        }
      }

      if (!entryJsAbsPath || !fs.existsSync(entryJsAbsPath)) {
        throw new Error('Built JS entry missing');
      }

      // Bundle ESM entry (and any split chunks) into a single classic IIFE script compatible with file:// WebView
      const esbuild = await import('esbuild');
      const iifeBuild = await esbuild.build({
        entryPoints: [entryJsAbsPath],
        bundle: true,
        format: 'iife',
        globalName: 'BloxHubStandaloneApp',
        platform: 'browser',
        target: ['es2019'],
        minify: true,
        write: false,
        define: {
          'import.meta.env.DEV': 'false',
          'import.meta.env.PROD': 'true',
          'import.meta.env.MODE': '"production"',
          'import.meta.env.SSR': 'false',
          'import.meta.env': '{}',
          'import.meta.url': '"file:///android_asset/index.html"',
        },
      });

      let jsContent = iifeBuild.outputFiles?.[0]?.text || '';
      if (!jsContent) {
        throw new Error('Failed to generate standalone IIFE JS output');
      }

      // Escape closing script tags inside JS bundle so inline classic <script> never terminates early
      jsContent = jsContent.replace(/<\/script>/gi, '<\\/script>');

      const serializedInvite = JSON.stringify(embeddedInvite).replace(/<\/script>/gi, '<\\/script>');

      // Boot error guard + standalone HTML runtime flags so multiplayer uses Cloud Relay directly
      const bootGuardScript = `<script>
(function(){
  window.__BLOX_STANDALONE_HTML__ = true;
  window.__BLOX_INVITE_CONFIG__ = ${serializedInvite};
  window.__bloxShowBootError = function(msg) {
    var root = document.getElementById('root');
    if (root && !root.firstElementChild) {
      root.innerHTML = '<div style="font-family:sans-serif;background:#0b1120;color:#e2e8f0;min-height:100vh;padding:24px;display:flex;align-items:center;justify-content:center;"><div style="max-width:480px;background:#111827;border:1px solid #334155;border-radius:16px;padding:20px;"><h2 style="margin:0 0 8px;color:#38bdf8;font-size:18px;">Blox World 3D</h2><p style="margin:0;font-size:14px;line-height:1.5;color:#cbd5e1;">Не удалось запустить 3D-движок: ' + String(msg || 'WebGL/JS') + '</p></div></div>';
    }
  };
  window.addEventListener('error', function(e) {
    var root = document.getElementById('root');
    if (root && !root.firstElementChild) {
      window.__bloxShowBootError(e && e.message ? e.message : 'Script error');
    }
  });
})();
</script>`;

      // Inject classic IIFE <script> inside <body> after <div id="root"></div> (NO type="module")
      const inlineBundleTag = `${bootGuardScript}\n<script>\n${jsContent}\n</script>`;
      if (/<\/body>/i.test(html)) {
        html = html.replace(/<\/body>/i, () => `${inlineBundleTag}\n</body>`);
      } else {
        html = `${html}\n${inlineBundleTag}`;
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="Blox_Hub_3D_Standalone.html"');
      res.send(html);
    } catch (err) {
      console.error('Standalone HTML build error:', err);
      res.status(500).send('Error generating standalone HTML bundle');
    }
  });

  // WebSocket Server using noServer: true so it never aborts other upgrade requests
  const wss = new WebSocketServer({ noServer: true });
  const authWss = new WebSocketServer({ noServer: true });
  const viteNoopWss = new WebSocketServer({ noServer: true });

  viteNoopWss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'connected' }));
  });

  authWss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    try {
      const urlObj = new URL(req.url || '/', 'http://localhost');
      const token = (urlObj.searchParams.get('token') || '').trim();
      const uid = token ? sessionTokens.get(token) : undefined;
      const record = uid ? accountsByUid.get(uid) : undefined;
      if (!uid || !record) {
        ws.close(4001, 'Unauthorized');
        return;
      }

      const entry = { ws, token };
      let set = authSocketsByUid.get(uid);
      if (!set) {
        set = new Set();
        authSocketsByUid.set(uid, set);
      }
      set.add(entry);

      ws.send(
        JSON.stringify({
          type: 'account:hello',
          serverTs: Date.now(),
          profile: toPublicProfile(record),
        })
      );

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(String(raw));
          if (msg?.type === 'ping' && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'pong',
                clientTs: typeof msg.clientTs === 'number' ? msg.clientTs : null,
                serverTs: Date.now(),
              })
            );
          }
        } catch {
          // Ignore malformed auth socket frames
        }
      });

      ws.on('close', () => {
        const listeners = authSocketsByUid.get(uid);
        if (listeners) {
          listeners.delete(entry);
          if (listeners.size === 0) {
            authSocketsByUid.delete(uid);
          }
        }
      });
    } catch {
      ws.close(4000, 'Bad sync request');
    }
  });

  server.on('upgrade', (req, socket, head) => {
    const pathname = req.url ? req.url.split('?')[0] : '';
    if (pathname === '/ws/game') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else if (pathname === '/ws/auth') {
      authWss.handleUpgrade(req, socket, head, (ws) => {
        authWss.emit('connection', ws, req);
      });
    } else {
      // Gracefully accept any @vite/client HMR websocket upgrade so it never throws
      viteNoopWss.handleUpgrade(req, socket, head, (ws) => {
        viteNoopWss.emit('connection', ws, req);
      });
    }
  });

  // Heartbeat & stale-player reaper so disconnected mobile/browser clients never leave ghosts
  const WS_HEARTBEAT_INTERVAL_MS = 10000;
  const wsAliveMap = new WeakMap<WebSocket, boolean>();
  const wsLastActivityMap = new WeakMap<WebSocket, number>();
  const multiplayerMaintenanceInterval = setInterval(() => {
    const now = Date.now();
    wss.clients.forEach((clientWs) => {
      if (wsAliveMap.get(clientWs) === false) {
        try {
          clientWs.terminate();
        } catch {}
        return;
      }
      const lastActivity = wsLastActivityMap.get(clientWs) ?? 0;
      // Only send protocol-level ping when socket has been idle, avoiding frame collisions during movement bursts
      if (now - lastActivity >= 12000) {
        wsAliveMap.set(clientWs, false);
        try {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.ping();
          }
        } catch {}
      }
    });

    rooms.forEach((room, rId) => {
      room.players.forEach((p, pid) => {
        const wsSock = room.clients.get(pid);
        const wsDead = wsSock ? wsSock.readyState !== WebSocket.OPEN : false;
        const staleMs = p.transport === 'relay' ? 16000 : p.transport === 'http' ? 20000 : 45000;
        if (wsDead || now - p.lastUpdated > staleMs) {
          room.players.delete(pid);
          room.clients.delete(pid);
          broadcastToRoom(
            room,
            {
              type: 'player:left',
              payload: { id: pid, name: p.skin.name },
            },
            undefined,
            false
          );
        }
      });

      if (room.players.size === 0 && !isStandardPublicRoomId(rId)) {
        rooms.delete(rId);
      }
    });
  }, 15000);

  server.on('close', () => {
    clearInterval(multiplayerMaintenanceInterval);
  });

  wss.on('connection', (ws: WebSocket) => {
    let clientId = `p_${Math.random().toString(36).slice(2, 9)}`;
    let currentRoomId: string | null = null;
    wsAliveMap.set(ws, true);
    wsLastActivityMap.set(ws, Date.now());

    ws.on('pong', () => {
      const now = Date.now();
      wsAliveMap.set(ws, true);
      wsLastActivityMap.set(ws, now);
      if (currentRoomId) {
        const p = rooms.get(currentRoomId)?.players.get(clientId);
        if (p) p.lastUpdated = now;
      }
    });

    ws.on('message', (raw) => {
      const msgNow = Date.now();
      wsAliveMap.set(ws, true);
      wsLastActivityMap.set(ws, msgNow);
      try {
        const data = JSON.parse(String(raw));
        const { type, payload } = data;

        if (type === 'ping') {
          if (currentRoomId) {
            const p = rooms.get(currentRoomId)?.players.get(clientId);
            if (p) p.lastUpdated = msgNow;
          }
          if (ws.readyState === WebSocket.OPEN) {
            const clientTs =
              typeof payload?.clientTs === 'number'
                ? payload.clientTs
                : typeof data?.clientTs === 'number'
                ? data.clientTs
                : null;
            const seq =
              typeof payload?.seq === 'number'
                ? payload.seq
                : typeof data?.seq === 'number'
                ? data.seq
                : null;
            ws.send(
              JSON.stringify({
                type: 'pong',
                ts: msgNow,
                payload: {
                  clientTs,
                  serverTs: msgNow,
                  seq,
                  nextPingInMs: WS_HEARTBEAT_INTERVAL_MS,
                },
              })
            );
          }
          return;
        }

        if (type === 'room:join') {
          const nextClientId = payload?.clientId ? String(payload.clientId) : clientId;
          const mode = payload?.mode === 'lan' ? 'lan' : 'online';
          const rawTargetRoomId = String(payload?.roomId || 'doors-main');
          const gameId = typeof payload?.gameId === 'string' ? payload.gameId : inferGameIdFromRoom(rawTargetRoomId);
          const targetRoomId = normalizeServerRoomId(rawTargetRoomId, mode, gameId);

          // Leave previous room if switching rooms
          if (currentRoomId && currentRoomId !== targetRoomId) {
            const oldRoom = rooms.get(currentRoomId);
            if (oldRoom) {
              const oldPlayer = oldRoom.players.get(clientId);
              oldRoom.players.delete(clientId);
              oldRoom.clients.delete(clientId);
              broadcastToRoom(
                oldRoom,
                { type: 'player:left', payload: { id: clientId, name: oldPlayer?.skin.name } },
                clientId
              );
            }
          }

          clientId = nextClientId;
          currentRoomId = targetRoomId;

          const room = getOrCreateRoom(targetRoomId, mode, gameId);
          const alreadyInRoom = room.players.has(clientId);
          const safeSkin = sanitizeSkinPayload(payload?.skin, payload?.skin?.name || 'RockBlox');

          const newPlayer: RoomPlayerState = {
            id: clientId,
            playerKey: typeof payload?.playerKey === 'string' ? payload.playerKey.slice(0, 128) : undefined,
            bio: typeof payload?.bio === 'string' ? filterProfanity(payload.bio.trim().slice(0, 80)) : undefined,
            gems: typeof payload?.gems === 'number' ? Math.max(0, Math.floor(payload.gems)) : undefined,
            unlockedAchievements: sanitizeAchievementsMap(payload?.unlockedAchievements),
            lifetimeStats: payload?.lifetimeStats ? sanitizeLifetimeStats(payload.lifetimeStats) : undefined,
            roomId: room.id,
            skin: safeSkin,
            position: Array.isArray(payload?.position) && payload.position.length === 3 ? payload.position : [0, 1.5, 0],
            rotationY: typeof payload?.rotationY === 'number' ? payload.rotationY : 0,
            isMoving: Boolean(payload?.isMoving),
            isGrounded: payload?.isGrounded !== false,
            activeTool: payload?.activeTool || 'sword',
            checkpoint: typeof payload?.checkpoint === 'number' ? payload.checkpoint : 0,
            coins: typeof payload?.coins === 'number' ? payload.coins : 0,
            lastUpdated: Date.now(),
            transport: 'ws',
          };

          room.players.set(clientId, newPlayer);
          room.clients.set(clientId, ws);

          // Send full authoritative room state to joining player
          const nowWsInit = Date.now();
          ws.send(
            JSON.stringify({
              type: 'room:init',
              payload: {
                selfId: clientId,
                roomId: room.id,
                gameId: room.gameId,
                seq: room.eventSeq,
                serverTime: nowWsInit,
                heartbeatIntervalMs: WS_HEARTBEAT_INTERVAL_MS,
                players: Array.from(room.players.values()).map((pl) => ({
                  ...pl,
                  activeEmote: pl.activeEmote && pl.activeEmote.expiresAt > nowWsInit ? pl.activeEmote : undefined,
                })),
                blocks: Array.from(room.blocks.values()),
                openedDoors: Array.from(room.openedDoors),
                elevatorClosed: room.elevatorClosed,
                chatHistory: room.chatHistory,
              },
            })
          );

          // Notify other players in the room
          if (!alreadyInRoom) {
            broadcastToRoom(
              room,
              {
                type: 'player:joined',
                payload: { ...newPlayer, gameId: room.gameId },
              },
              clientId
            );
          } else {
            broadcastToRoom(
              room,
              {
                type: 'player:skin_updated',
                payload: { id: clientId, skin: newPlayer.skin },
              },
              clientId
            );
          }
        } else if (type === 'player:move' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          const p = room?.players.get(clientId);
          if (room && p && payload) {
            if (Array.isArray(payload.position) && payload.position.length === 3) p.position = payload.position;
            if (typeof payload.rotationY === 'number') p.rotationY = payload.rotationY;
            if (typeof payload.isMoving === 'boolean') p.isMoving = payload.isMoving;
            if (typeof payload.isGrounded === 'boolean') p.isGrounded = payload.isGrounded;
            if (typeof payload.activeTool === 'string') p.activeTool = payload.activeTool;
            if (typeof payload.checkpoint === 'number') p.checkpoint = payload.checkpoint;
            if (typeof payload.coins === 'number') p.coins = payload.coins;
            if (payload.skin && typeof payload.skin === 'object') {
              p.skin = sanitizeSkinPayload(payload.skin, payload.skin.name || p.skin.name);
            }
            p.lastUpdated = Date.now();
            p.transport = 'ws';

            const updateEvent = {
              type: 'player:updated',
              payload: {
                id: clientId,
                skin: p.skin,
                position: p.position,
                rotationY: p.rotationY,
                isMoving: p.isMoving,
                isGrounded: p.isGrounded,
                activeTool: p.activeTool,
                checkpoint: p.checkpoint,
                coins: p.coins,
              },
            };
            const msg = JSON.stringify(updateEvent);
            room.clients.forEach((peerWs, peerId) => {
              if (peerId !== clientId && peerWs.readyState === WebSocket.OPEN) {
                peerWs.send(msg);
              }
            });
            publishToServerCloudRelay(room.id, clientId, updateEvent);
          }
        } else if (type === 'player:skin' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          const p = room?.players.get(clientId);
          if (room && p && payload) {
            if (payload.skin) {
              p.skin = sanitizeSkinPayload(payload.skin, payload.skin.name || p.skin.name);
            }
            if (typeof payload.playerKey === 'string') p.playerKey = payload.playerKey.slice(0, 128);
            if (typeof payload.bio === 'string') p.bio = filterProfanity(payload.bio.trim().slice(0, 80));
            if (typeof payload.gems === 'number') p.gems = Math.max(0, Math.floor(payload.gems));
            if (payload.unlockedAchievements && typeof payload.unlockedAchievements === 'object') {
              p.unlockedAchievements = mergeAchievementsMaps(
                p.unlockedAchievements,
                sanitizeAchievementsMap(payload.unlockedAchievements)
              );
            }
            if (payload.lifetimeStats && typeof payload.lifetimeStats === 'object') {
              p.lifetimeStats = mergeLifetimeStats(
                p.lifetimeStats,
                sanitizeLifetimeStats(payload.lifetimeStats)
              );
            }
            p.lastUpdated = Date.now();
            broadcastToRoom(
              room,
              {
                type: 'player:skin_updated',
                payload: {
                  id: clientId,
                  skin: p.skin,
                  playerKey: p.playerKey,
                  bio: p.bio,
                  gems: p.gems,
                  unlockedAchievements: p.unlockedAchievements,
                  lifetimeStats: p.lifetimeStats,
                },
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
        } else if (type === 'player:emote' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          const p = room?.players.get(clientId);
          if (room && isValidEmoteId(payload?.emoteId)) {
            const dur = Math.max(
              800,
              Math.min(8000, Number(payload?.durationMs) || getEmoteById(payload.emoteId).durationMs)
            );
            if (p) {
              p.activeEmote = { id: payload.emoteId, expiresAt: Date.now() + dur };
            }
            broadcastToRoom(
              room,
              {
                type: 'player:emoted',
                payload: {
                  id: clientId,
                  emoteId: payload.emoteId,
                  durationMs: dur,
                  eventId: typeof payload?.eventId === 'string' ? payload.eventId : undefined,
                },
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
              broadcastToRoom(room, { type: 'block:placed', payload: block }, clientId);
            }
          }
        } else if (type === 'block:remove' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room && payload?.key) {
            if (room.blocks.has(payload.key)) {
              room.blocks.delete(payload.key);
              broadcastToRoom(room, { type: 'block:removed', payload: { key: payload.key } }, clientId);
            }
          }
        } else if (type === 'doors:open' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room && typeof payload?.doorIndex === 'number') {
            const idx = Math.floor(payload.doorIndex);
            if (!room.openedDoors.has(idx)) {
              room.openedDoors.add(idx);
              broadcastToRoom(
                room,
                {
                  type: 'doors:opened',
                  payload: { doorIndex: idx, doorNumber: payload.doorNumber },
                },
                clientId
              );
            }
          }
        } else if (type === 'doors:elevator' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room && !room.elevatorClosed) {
            room.elevatorClosed = true;
            broadcastToRoom(room, { type: 'doors:elevator_closed', payload: {} }, clientId);
          }
        } else if (type === 'chat:send' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room && payload?.text) {
            const msg: ChatMessage = {
              id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              author: filterProfanity(String(payload.author || 'Игрок')),
              text: filterProfanity(String(payload.text).slice(0, 140)),
              timestamp: Date.now(),
            };
            room.chatHistory.push(msg);
            if (room.chatHistory.length > 25) {
              room.chatHistory.shift();
            }
            broadcastToRoom(room, { type: 'chat:message', payload: msg }, clientId);
          }
        } else if (type === 'voice:state' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room && payload) {
            const enabled = Boolean(payload.enabled);
            const muted = Boolean(payload.muted);
            const speaking = enabled && !muted && Boolean(payload.speaking);
            const p = room.players.get(clientId);
            if (p) {
              p.voiceEnabled = enabled;
              p.voiceMuted = muted;
              p.voiceSpeaking = speaking;
              p.lastUpdated = Date.now();
            }
            broadcastToRoom(
              room,
              { type: 'voice:state', payload: { id: clientId, enabled, muted, speaking } },
              clientId
            );
          }
        } else if (type === 'voice:signal' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room && payload) {
            relayVoiceSignalInRoom(room, clientId, payload, true);
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
          // Only remove if this closed socket is still the active socket for clientId
          const activeSocket = room.clients.get(clientId);
          if (activeSocket === ws) {
            const leavingPlayer = room.players.get(clientId);
            room.players.delete(clientId);
            room.clients.delete(clientId);
            broadcastToRoom(
              room,
              {
                type: 'player:left',
                payload: { id: clientId, name: leavingPlayer?.skin.name },
              },
              clientId
            );
          }
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

    let viteMiddleware: express.RequestHandler | null = null;
    let viteInstance: ViteDevServer | null = null;
    let viteReadyPromise: Promise<ViteDevServer> | null = null;

    const ensureViteReady = (): Promise<ViteDevServer> => {
      if (!viteReadyPromise) {
        viteReadyPromise = import('vite')
          .then(({ createServer: createViteServer }) =>
            createViteServer({
              server: {
                middlewareMode: true,
                hmr: false,
                ws: false,
                watch: null,
              },
              appType: 'spa',
            })
          )
          .then((vite) => {
            viteInstance = vite;
            viteMiddleware = vite.middlewares;
            return vite;
          })
          .catch((err) => {
            viteReadyPromise = null;
            throw err;
          });
      }
      return viteReadyPromise;
    };

    app.use((req, res, next) => {
      if (viteMiddleware) {
        viteMiddleware(req, res, next);
        return;
      }
      ensureViteReady()
        .then((vite) => vite.middlewares(req, res, next))
        .catch(next);
    });

    const shutdown = () => {
      viteInstance?.close().catch(() => {});
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 1000).unref();
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);

    server.on('error', (err) => {
      console.error('[server] HTTP server error:', err);
    });

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Blox World Multiplayer Server running on http://0.0.0.0:${PORT}`);
      // Warm up Vite immediately after port 3000 is already accepting connections
      void ensureViteReady().catch((err) => {
        console.error('[server] Vite middleware warmup failed:', err);
      });
      setTimeout(() => {
        startServerCloudRelayBridge();
      }, 1500);
    });
    return;
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.on('error', (err) => {
    console.error('[server] HTTP server error:', err);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Blox World Multiplayer Server running on http://0.0.0.0:${PORT}`);
    setTimeout(() => {
      startServerCloudRelayBridge();
    }, 1500);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

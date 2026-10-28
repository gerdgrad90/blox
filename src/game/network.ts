import { CharacterSkin, MultiplayerMode, RemotePlayerInfo, ToolType } from './types';

export interface NetworkCallbacks {
  onInitRoom: (data: {
    selfId: string;
    roomId: string;
    players: RemotePlayerInfo[];
    blocks: { key: string; position: [number, number, number]; color: string }[];
    chatHistory: { id: string; author: string; text: string }[];
  }) => void;
  onPlayerJoined: (player: RemotePlayerInfo) => void;
  onPlayerUpdated: (update: Partial<RemotePlayerInfo> & { id: string }) => void;
  onPlayerSkinUpdated: (id: string, skin: CharacterSkin) => void;
  onPlayerAttacked: (id: string) => void;
  onPlayerLeft: (id: string, name?: string) => void;
  onBlockPlaced: (block: { key: string; position: [number, number, number]; color: string }) => void;
  onBlockRemoved: (key: string) => void;
  onChatMessage: (msg: { id: string; author: string; text: string }) => void;
  onConnectionStatus: (connected: boolean, mode: MultiplayerMode, roomId: string) => void;
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private bc: BroadcastChannel | null = null;
  private callbacks: NetworkCallbacks;
  public selfId: string = `p_${Math.random().toString(36).slice(2, 9)}`;
  public currentRoomId: string = 'public_obby';
  public currentMode: MultiplayerMode = 'online';
  private currentSkin: CharacterSkin;
  private reconnectTimer: number | null = null;
  private isDisposed: boolean = false;
  private lastMoveSentAt: number = 0;

  constructor(skin: CharacterSkin, callbacks: NetworkCallbacks) {
    this.currentSkin = skin;
    this.callbacks = callbacks;
  }

  public connectToRoom(roomId: string, mode: MultiplayerMode, skin: CharacterSkin) {
    this.currentRoomId = roomId;
    this.currentMode = mode;
    this.currentSkin = skin;

    // Close existing BroadcastChannel
    if (this.bc) {
      this.bc.close();
      this.bc = null;
    }

    // If local_coop (2 players on 1 screen), no network room needed, but we still allow local BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.bc = new BroadcastChannel(`blox_room_${roomId}`);
        this.bc.onmessage = (ev) => {
          this.handleMessage(ev.data, true);
        };
      } catch {
        // Ignore if BroadcastChannel unsupported
      }
    }

    // Establish WebSocket connection to authoritative server
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.sendJoinPacket();
      }
      return;
    }

    this.openWebSocket();
  }

  private openWebSocket() {
    if (this.isDisposed || typeof window === 'undefined') return;

    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws/game`;
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        if (this.isDisposed) return;
        this.callbacks.onConnectionStatus(true, this.currentMode, this.currentRoomId);
        this.sendJoinPacket();
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data));
          this.handleMessage(parsed, false);
        } catch {
          // Ignore malformed packet
        }
      };

      socket.onclose = () => {
        if (this.isDisposed) return;
        this.callbacks.onConnectionStatus(false, this.currentMode, this.currentRoomId);
        this.reconnectTimer = window.setTimeout(() => this.openWebSocket(), 2500);
      };

      socket.onerror = () => {
        // Handled by onclose
      };
    } catch {
      // Fallback to BroadcastChannel if WebSocket fails
    }
  }

  private sendJoinPacket() {
    const joinMsg = {
      type: 'room:join',
      payload: {
        clientId: this.selfId,
        roomId: this.currentRoomId,
        mode: this.currentMode === 'lan_room' ? 'lan' : 'online',
        skin: this.currentSkin,
        position: [0, 1.5, 0],
        rotationY: 0,
        activeTool: 'sword',
        checkpoint: 0,
        coins: 0,
      },
    };
    this.sendRaw(joinMsg);

    // Also announce on BroadcastChannel for instant local tab discovery
    if (this.bc) {
      this.bc.postMessage({
        type: 'player:joined',
        payload: {
          id: this.selfId,
          skin: this.currentSkin,
          position: [0, 1.5, 0],
          rotationY: 0,
          isMoving: false,
          isGrounded: true,
          activeTool: 'sword',
          checkpoint: 0,
          coins: 0,
        },
      });
    }
  }

  private handleMessage(data: any, fromBroadcastChannel: boolean) {
    if (!data || !data.type) return;
    const { type, payload } = data;

    if (type === 'room:init' && payload) {
      if (payload.selfId) {
        this.selfId = payload.selfId;
      }
      this.callbacks.onInitRoom({
        selfId: this.selfId,
        roomId: payload.roomId || this.currentRoomId,
        players: (payload.players || []).filter((p: RemotePlayerInfo) => p.id !== this.selfId),
        blocks: payload.blocks || [],
        chatHistory: payload.chatHistory || [],
      });
    } else if (type === 'player:joined' && payload && payload.id !== this.selfId) {
      this.callbacks.onPlayerJoined(payload);
      // If discovered via BroadcastChannel, reply with our current presence so both tabs see each other
      if (fromBroadcastChannel && this.bc) {
        this.bc.postMessage({
          type: 'player:presence_reply',
          payload: {
            id: this.selfId,
            skin: this.currentSkin,
            position: [0, 1.5, 0],
            rotationY: 0,
            isMoving: false,
            isGrounded: true,
            activeTool: 'sword',
            checkpoint: 0,
            coins: 0,
          },
        });
      }
    } else if (type === 'player:presence_reply' && payload && payload.id !== this.selfId) {
      this.callbacks.onPlayerJoined(payload);
    } else if (type === 'player:updated' && payload && payload.id !== this.selfId) {
      this.callbacks.onPlayerUpdated(payload);
    } else if (type === 'player:skin_updated' && payload && payload.id !== this.selfId) {
      this.callbacks.onPlayerSkinUpdated(payload.id, payload.skin);
    } else if (type === 'player:attacked' && payload && payload.id !== this.selfId) {
      this.callbacks.onPlayerAttacked(payload.id);
    } else if (type === 'player:left' && payload && payload.id !== this.selfId) {
      this.callbacks.onPlayerLeft(payload.id, payload.name);
    } else if (type === 'block:placed' && payload) {
      this.callbacks.onBlockPlaced(payload);
    } else if (type === 'block:removed' && payload?.key) {
      this.callbacks.onBlockRemoved(payload.key);
    } else if (type === 'chat:message' && payload) {
      this.callbacks.onChatMessage(payload);
    }
  }

  private sendRaw(packet: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(packet));
    }
  }

  public sendMoveUpdate(state: {
    position: [number, number, number];
    rotationY: number;
    isMoving: boolean;
    isGrounded: boolean;
    activeTool: ToolType;
    checkpoint: number;
    coins: number;
  }) {
    const now = performance.now();
    // Throttle network updates to ~16Hz (every 60ms)
    if (now - this.lastMoveSentAt < 60) return;
    this.lastMoveSentAt = now;

    const packet = {
      type: 'player:move',
      payload: {
        id: this.selfId,
        ...state,
      },
    };
    this.sendRaw(packet);
    if (this.bc) {
      this.bc.postMessage({
        type: 'player:updated',
        payload: {
          id: this.selfId,
          ...state,
        },
      });
    }
  }

  public sendSkinUpdate(skin: CharacterSkin) {
    this.currentSkin = skin;
    this.sendRaw({ type: 'player:skin', payload: { skin } });
    if (this.bc) {
      this.bc.postMessage({
        type: 'player:skin_updated',
        payload: { id: this.selfId, skin },
      });
    }
  }

  public sendAttack() {
    this.sendRaw({ type: 'player:attack', payload: { id: this.selfId } });
    if (this.bc) {
      this.bc.postMessage({ type: 'player:attacked', payload: { id: this.selfId } });
    }
  }

  public sendBlockPlace(key: string, position: [number, number, number], color: string) {
    this.sendRaw({ type: 'block:place', payload: { key, position, color } });
    if (this.bc) {
      this.bc.postMessage({ type: 'block:placed', payload: { key, position, color } });
    }
  }

  public sendBlockRemove(key: string) {
    this.sendRaw({ type: 'block:remove', payload: { key } });
    if (this.bc) {
      this.bc.postMessage({ type: 'block:removed', payload: { key } });
    }
  }

  public sendChatMessage(text: string, author: string) {
    this.sendRaw({ type: 'chat:send', payload: { text, author } });
    if (this.bc) {
      this.bc.postMessage({
        type: 'chat:message',
        payload: { id: `bc_${Date.now()}`, author, text },
      });
    }
  }

  public dispose() {
    this.isDisposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.bc) {
      this.bc.postMessage({ type: 'player:left', payload: { id: this.selfId, name: this.currentSkin.name } });
      this.bc.close();
      this.bc = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

import {
  CharacterSkin,
  EmoteId,
  GameId,
  MultiplayerMode,
  PlayerLifetimeStats,
  RemotePlayerInfo,
  ToolType,
  VoicePeerBroadcastState,
  VoiceSignalPacket,
  VoiceSignalType,
} from './types';
import { CloudMultiplayerRelay } from './cloudRelay';
import { filterProfanity } from './profanityFilter';
import { getEmoteById, isValidEmoteId } from './emotes';
import { isFileProtocol } from './env';

export interface PublicProfileBroadcastMeta {
  playerKey?: string;
  bio?: string;
  gems?: number;
  unlockedAchievements?: Record<string, number>;
  lifetimeStats?: Partial<PlayerLifetimeStats>;
}

export interface NetworkCallbacks {
  onInitRoom: (data: {
    selfId: string;
    roomId: string;
    gameId?: GameId;
    players: RemotePlayerInfo[];
    blocks: { key: string; position: [number, number, number]; color: string }[];
    openedDoors?: number[];
    elevatorClosed?: boolean;
    chatHistory: { id: string; author: string; text: string }[];
    serverTime?: number;
    heartbeatIntervalMs?: number;
  }) => void;
  onPlayerJoined: (player: RemotePlayerInfo) => void;
  onPlayerUpdated: (update: Partial<RemotePlayerInfo> & { id: string }) => void;
  onPlayerSkinUpdated: (id: string, skin: CharacterSkin) => void;
  onPlayerAttacked: (id: string) => void;
  onPlayerEmoted?: (id: string, emoteId: EmoteId, durationMs?: number) => void;
  onPlayerLeft: (id: string, name?: string) => void;
  onBlockPlaced: (block: { key: string; position: [number, number, number]; color: string }) => void;
  onBlockRemoved: (key: string) => void;
  onDoorOpened?: (doorIndex: number, doorNumber?: number) => void;
  onElevatorClosed?: () => void;
  onChatMessage: (msg: { id: string; author: string; text: string }) => void;
  onConnectionStatus: (connected: boolean, mode: MultiplayerMode, roomId: string) => void;
  onLatencyUpdate?: (rttMs: number) => void;
  onLeaderboardUpdated?: (gameId?: string) => void;
  onRoomGameDetected?: (gameId: GameId) => void;
  onVoiceStateUpdated?: (state: VoicePeerBroadcastState) => void;
  onVoiceSignal?: (signal: VoiceSignalPacket) => void;
}

interface LocalMoveSnapshot {
  position: [number, number, number];
  rotationY: number;
  isMoving: boolean;
  isGrounded: boolean;
  activeTool: ToolType;
  checkpoint: number;
  coins: number;
}

const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 10000;
const HEARTBEAT_TIMEOUT_MS = 5000;
const QUIET_WINDOW_MS = 18;
const SELF_ID_STORAGE_KEY = 'blox_mp_self_id_v1';

export function isValidGameId(val: unknown): val is GameId {
  return val === 'doors' || val === 'obby' || val === 'lava_survival' || val === 'bee_swarm' || val === 'studio';
}

export function inferGameIdFromRoom(roomId: string, fallback: GameId = 'doors'): GameId {
  const lower = String(roomId || '').trim().toLowerCase();
  if (lower.startsWith('doors-') || lower === 'public_doors' || lower.includes('doors')) {
    return 'doors';
  }
  if (
    lower.startsWith('lava_survival-') ||
    lower === 'public_lava' ||
    lower.includes('lava')
  ) {
    return 'lava_survival';
  }
  if (lower.startsWith('bee_swarm-') || lower === 'public_bee' || lower.includes('bee')) {
    return 'bee_swarm';
  }
  if (lower.startsWith('studio-') || lower === 'public_studio' || lower.includes('studio')) {
    return 'studio';
  }
  if (lower.startsWith('obby-') || lower === 'public_obby' || lower.includes('obby')) {
    return 'obby';
  }
  return fallback;
}

/**
 * Normalizes any room identifier across Online mode and Room Code mode so that
 * mobile and desktop clients always join the exact same canonical channel.
 */
export function normalizeCanonicalRoomId(
  rawRoomId: string,
  mode: MultiplayerMode | 'lan' | 'online' = 'online',
  fallbackGameId: GameId | string = 'doors'
): string {
  const safeGame: GameId = isValidGameId(fallbackGameId)
    ? fallbackGameId
    : inferGameIdFromRoom(rawRoomId, 'doors');
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

  if (mode === 'online' && isPublicAlias) {
    if (lower === 'public_doors' || lower === 'doors-main') return 'doors-main';
    if (lower === 'public_obby' || lower === 'obby-main') return 'obby-main';
    if (lower === 'public_lava' || lower === 'lava_survival-main') return 'lava_survival-main';
    if (lower === 'public_bee' || lower === 'bee_swarm-main') return 'bee_swarm-main';
    if (lower === 'public_studio' || lower === 'studio-main') return 'studio-main';
    return `${safeGame}-main`;
  }

  if (isPublicAlias) {
    if (lower === 'public_doors' || lower === 'doors-main') return 'doors-main';
    if (lower === 'public_obby' || lower === 'obby-main') return 'obby-main';
    if (lower === 'public_lava' || lower === 'lava_survival-main') return 'lava_survival-main';
    if (lower === 'public_bee' || lower === 'bee_swarm-main') return 'bee_swarm-main';
    if (lower === 'public_studio' || lower === 'studio-main') return 'studio-main';
    return `${safeGame}-main`;
  }

  // Strip any leading gameId or "room-" prefix so custom room codes are game-agnostic and case-insensitive
  const stripped = trimmed.replace(/^(doors|obby|lava_survival|bee_swarm|studio|room)-/i, '');
  const cleanCode = stripped.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 16) || 'OBBY777';
  return `room-${cleanCode}`;
}

function getOrCreatePersistentSelfId(): string {
  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    try {
      const existing = sessionStorage.getItem(SELF_ID_STORAGE_KEY);
      if (existing && /^p_[a-z0-9]{5,16}$/i.test(existing)) {
        return existing;
      }
      const created = `p_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SELF_ID_STORAGE_KEY, created);
      return created;
    } catch {}
  }
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

export function computeExponentialBackoffDelay(
  attempt: number,
  baseMs: number = BASE_RECONNECT_DELAY_MS,
  maxMs: number = MAX_RECONNECT_DELAY_MS,
  jitterFactor: number = 0.75 + Math.random() * 0.5
): number {
  const safeAttempt = Math.max(0, Math.min(attempt, 6));
  const raw = Math.min(maxMs, baseMs * Math.pow(2, safeAttempt));
  return Math.max(400, Math.min(maxMs, Math.round(raw * jitterFactor)));
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private bc: BroadcastChannel | null = null;
  private cloudRelay: CloudMultiplayerRelay | null = null;
  private callbacks: NetworkCallbacks;
  public selfId: string = getOrCreatePersistentSelfId();
  public currentRoomId: string = 'doors-main';
  public currentMode: MultiplayerMode = 'online';
  public currentGameId: GameId = 'doors';
  private joinedRoomAt: number = Date.now();
  private currentSkin: CharacterSkin;
  private publicMeta: PublicProfileBroadcastMeta = {};
  private lastLocalState: LocalMoveSnapshot = {
    position: [0, 1.5, 0],
    rotationY: 0,
    isMoving: false,
    isGrounded: true,
    activeTool: 'sword',
    checkpoint: 0,
    coins: 0,
  };

  private localBlocks: Map<string, { key: string; position: [number, number, number]; color: string }> =
    new Map();
  private localOpenedDoors: Set<number> = new Set();
  private localElevatorClosed: boolean = false;

  private wsConnected: boolean = false;
  private httpConnected: boolean = false;
  private cloudRelayConnected: boolean = false;

  private reconnectTimer: number | null = null;
  private reconnectAttempts: number = 0;
  private isConnecting: boolean = false;

  // Synchronized heartbeat & latency tracking
  private heartbeatTimer: number | null = null;
  private heartbeatTimeoutTimer: number | null = null;
  private heartbeatIntervalMs: number = DEFAULT_HEARTBEAT_INTERVAL_MS;
  private pingSeq: number = 0;
  private pendingPingSeq: number | null = null;
  private pendingPingSentAt: number = 0;
  private smoothedRttMs: number = 0;
  private clockOffsetMs: number = 0;
  private lastPacketSentAt: number = 0;
  private lastPacketReceivedAt: number = 0;

  // Cross-device presence beacon & peer liveness tracker
  private presenceBeaconTimer: number | null = null;
  private knownPeers: Map<string, { info: RemotePlayerInfo; lastSeen: number }> = new Map();

  // HTTP fallback state
  private httpSyncTimer: number | null = null;
  private httpStartupFallbackTimer: number | null = null;
  private httpPollInFlight: boolean = false;
  private httpJoinedRoomId: string | null = null;
  private httpSeq: number = 0;
  private pendingHttpActions: { type: string; payload?: any }[] = [];
  private seenChatIds: Set<string> = new Set();
  private seenEmoteEventIds: Set<string> = new Set();
  private seenVoiceSignalIds: Set<string> = new Set();
  private lastPresenceReplyToPeer: Map<string, number> = new Map();

  private isDisposed: boolean = false;
  private lastMoveSentAt: number = 0;

  private boundOnlineHandler: (() => void) | null = null;
  private boundOfflineHandler: (() => void) | null = null;
  private boundVisibilityHandler: (() => void) | null = null;
  private boundBeforeUnloadHandler: (() => void) | null = null;

  constructor(skin: CharacterSkin, callbacks: NetworkCallbacks) {
    this.currentSkin = skin;
    this.callbacks = callbacks;

    this.cloudRelay = new CloudMultiplayerRelay(
      this.selfId,
      this.currentRoomId,
      (packet, roomId) => {
        if (roomId === '*' || roomId === this.currentRoomId) {
          this.handleMessage(packet, true);
        }
      },
      (relayConnected) => {
        this.cloudRelayConnected = relayConnected;
        this.emitCombinedConnectionStatus();
        if (relayConnected) {
          this.broadcastPresencePacket('player:joined');
        }
      }
    );

    this.attachLifecycleListeners();
    this.startPresenceBeacon();
  }

  private emitCombinedConnectionStatus() {
    if (this.isDisposed) return;
    const isAnyConnected = this.wsConnected || this.httpConnected || this.cloudRelayConnected;
    this.callbacks.onConnectionStatus(isAnyConnected, this.currentMode, this.currentRoomId);
  }

  private attachLifecycleListeners() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    this.boundOnlineHandler = () => {
      if (this.isDisposed) return;
      this.reconnectAttempts = 0;
      this.cloudRelay?.reconnectNow();
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.openWebSocket();
      } else {
        this.syncHeartbeat(true);
      }
      this.broadcastPresencePacket('player:presence');
    };

    this.boundOfflineHandler = () => {
      if (this.isDisposed) return;
      this.wsConnected = false;
      this.httpConnected = false;
      this.cloudRelayConnected = false;
      this.stopWsHeartbeat();
      this.emitCombinedConnectionStatus();
    };

    this.boundVisibilityHandler = () => {
      if (this.isDisposed) return;
      if (document.visibilityState === 'visible') {
        this.cloudRelay?.reconnectNow();
        this.broadcastPresencePacket('player:presence');
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.syncHeartbeat(true);
        } else if (typeof navigator === 'undefined' || navigator.onLine !== false) {
          this.reconnectAttempts = 0;
          this.openWebSocket();
        }
      } else {
        this.clearHeartbeatTimers();
      }
    };

    this.boundBeforeUnloadHandler = () => {
      try {
        this.cloudRelay?.publishRoom({
          type: 'player:left',
          payload: { id: this.selfId, name: this.currentSkin.name },
        });
      } catch {}
    };

    window.addEventListener('online', this.boundOnlineHandler);
    window.addEventListener('offline', this.boundOfflineHandler);
    document.addEventListener('visibilitychange', this.boundVisibilityHandler);
    window.addEventListener('beforeunload', this.boundBeforeUnloadHandler);
  }

  private detachLifecycleListeners() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (this.boundOnlineHandler) {
      window.removeEventListener('online', this.boundOnlineHandler);
      this.boundOnlineHandler = null;
    }
    if (this.boundOfflineHandler) {
      window.removeEventListener('offline', this.boundOfflineHandler);
      this.boundOfflineHandler = null;
    }
    if (this.boundVisibilityHandler) {
      document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
      this.boundVisibilityHandler = null;
    }
    if (this.boundBeforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.boundBeforeUnloadHandler);
      this.boundBeforeUnloadHandler = null;
    }
  }

  private startPresenceBeacon() {
    if (typeof window === 'undefined') return;
    if (this.presenceBeaconTimer !== null) {
      clearInterval(this.presenceBeaconTimer);
    }
    this.presenceBeaconTimer = window.setInterval(() => {
      if (this.isDisposed) return;
      if (this.currentMode === 'local_coop') return;

      // Broadcast periodic presence so mobile & desktop peers discover each other within <= 2s
      this.broadcastPresencePacket('player:presence');

      // Reap stale peers that haven't sent any packet in >14 seconds
      const now = Date.now();
      for (const [peerId, entry] of Array.from(this.knownPeers.entries())) {
        if (now - entry.lastSeen > 14000) {
          this.knownPeers.delete(peerId);
          this.callbacks.onPlayerLeft(peerId, entry.info.skin?.name);
        }
      }
    }, 2200);
  }

  public setPublicProfileMeta(meta: PublicProfileBroadcastMeta) {
    this.publicMeta = {
      ...this.publicMeta,
      ...meta,
    };
  }

  public sendProfileUpdate(meta?: PublicProfileBroadcastMeta) {
    if (meta) {
      this.setPublicProfileMeta(meta);
    }
    const packetPayload = {
      skin: this.currentSkin,
      ...this.publicMeta,
    };
    this.sendRaw({ type: 'player:skin', payload: packetPayload }, true);
    const peerMsg = {
      type: 'player:skin_updated',
      payload: {
        id: this.selfId,
        ...packetPayload,
      },
    };
    this.cloudRelay?.publishRoom(peerMsg);
    if (this.bc) {
      try {
        this.bc.postMessage(peerMsg);
      } catch {}
    }
  }

  private buildPresencePayload() {
    return {
      id: this.selfId,
      skin: this.currentSkin,
      ...this.publicMeta,
      gameId: this.currentGameId,
      joinedRoomAt: this.joinedRoomAt,
      ...this.lastLocalState,
      openedDoors: Array.from(this.localOpenedDoors),
      elevatorClosed: this.localElevatorClosed,
    };
  }

  private broadcastPresencePacket(type: 'player:joined' | 'player:presence' | 'player:presence_reply') {
    const packet = {
      type,
      payload: this.buildPresencePayload(),
    };
    this.cloudRelay?.publishRoom(packet);
    if (this.bc) {
      try {
        this.bc.postMessage(packet);
      } catch {}
    }
  }

  public announcePresenceNow() {
    if (this.isDisposed || this.currentMode === 'local_coop') return;
    this.broadcastPresencePacket('player:joined');
  }

  public getLatencyMs(): number {
    return Math.round(this.smoothedRttMs);
  }

  public getReconnectAttempt(): number {
    return this.reconnectAttempts;
  }

  public getEstimatedServerTime(): number {
    return Date.now() + Math.round(this.clockOffsetMs);
  }

  public connectToRoom(
    roomId: string,
    mode: MultiplayerMode,
    skin: CharacterSkin,
    explicitGameId?: GameId
  ) {
    const resolvedGameId: GameId =
      explicitGameId && isValidGameId(explicitGameId)
        ? explicitGameId
        : inferGameIdFromRoom(roomId, this.currentGameId);
    const canonicalRoomId = normalizeCanonicalRoomId(roomId, mode, resolvedGameId);

    const previousRoomId = this.currentRoomId;
    const roomChanged = previousRoomId !== canonicalRoomId;

    if (roomChanged && previousRoomId) {
      const leaveMsg = {
        type: 'player:left',
        payload: { id: this.selfId, name: this.currentSkin.name },
      };
      this.cloudRelay?.publishRoom(leaveMsg, previousRoomId);
      if (this.bc) {
        try {
          this.bc.postMessage(leaveMsg);
        } catch {}
      }
    }

    this.currentRoomId = canonicalRoomId;
    this.currentMode = mode;
    this.currentGameId = resolvedGameId;
    this.currentSkin = skin;

    if (roomChanged) {
      this.joinedRoomAt = Date.now();
      this.httpJoinedRoomId = null;
      this.httpSeq = 0;
      this.knownPeers.clear();
      this.lastPresenceReplyToPeer.clear();
      this.localBlocks.clear();
      this.localOpenedDoors.clear();
      this.localElevatorClosed = false;
      this.pendingHttpActions = [];
    }

    this.cloudRelay?.setRoom(canonicalRoomId);

    if (this.bc) {
      this.bc.close();
      this.bc = null;
    }

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.bc = new BroadcastChannel(`blox_room_${canonicalRoomId}`);
        this.bc.onmessage = (ev) => {
          this.handleMessage(ev.data, true);
        };
      } catch {
        // Ignore if BroadcastChannel unsupported
      }
    }

    // Always announce presence immediately on Cloud Relay + BroadcastChannel
    this.broadcastPresencePacket('player:joined');
    this.emitCombinedConnectionStatus();

    if (isFileProtocol()) {
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendJoinPacket();
      this.syncHeartbeat(true);
      return;
    }

    if (!this.ws || (this.ws.readyState !== WebSocket.CONNECTING && this.ws.readyState !== WebSocket.OPEN)) {
      this.reconnectAttempts = 0;
      this.openWebSocket();
    }

    // Start HTTP fallback automatically if WS does not connect within 1200ms
    this.scheduleHttpFallbackStart(1200);
  }

  private scheduleHttpFallbackStart(delayMs: number) {
    if (this.httpStartupFallbackTimer) {
      clearTimeout(this.httpStartupFallbackTimer);
      this.httpStartupFallbackTimer = null;
    }
    this.httpStartupFallbackTimer = window.setTimeout(() => {
      if (this.isDisposed) return;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.startHttpFallbackPolling();
      }
    }, delayMs);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.isDisposed || typeof window === 'undefined') return;
    if (this.reconnectTimer !== null) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return;
    }

    const delayMs = computeExponentialBackoffDelay(this.reconnectAttempts);
    this.reconnectAttempts = Math.min(this.reconnectAttempts + 1, 10);

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.openWebSocket();
    }, delayMs);
  }

  private openWebSocket() {
    if (this.isDisposed || typeof window === 'undefined' || isFileProtocol()) return;
    if (this.isConnecting) return;
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.clearReconnectTimer();
    this.isConnecting = true;

    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws/game`;
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        if (this.isDisposed || this.ws !== socket) {
          this.isConnecting = false;
          try {
            socket.close();
          } catch {}
          return;
        }
        this.isConnecting = false;
        this.wsConnected = true;
        this.reconnectAttempts = 0;
        this.lastPacketReceivedAt = performance.now();
        this.stopHttpFallbackPolling();
        this.emitCombinedConnectionStatus();
        this.sendJoinPacket();
        this.syncHeartbeat(true);
      };

      socket.onmessage = (event) => {
        if (this.isDisposed || this.ws !== socket) return;
        this.lastPacketReceivedAt = performance.now();
        this.clearHeartbeatTimeout();
        try {
          const parsed = JSON.parse(String(event.data));
          if (parsed?.type === 'pong') {
            this.handlePong(parsed);
            return;
          }
          this.handleMessage(parsed, false);
        } catch {
          // Ignore malformed packet
        }
      };

      socket.onclose = () => {
        if (this.ws === socket) {
          this.isConnecting = false;
          this.wsConnected = false;
          this.ws = null;
        }
        if (this.isDisposed) return;
        this.stopWsHeartbeat();
        this.emitCombinedConnectionStatus();
        this.startHttpFallbackPolling();
        this.scheduleReconnect();
      };

      socket.onerror = () => {
        if (this.ws === socket) {
          this.isConnecting = false;
          this.wsConnected = false;
        }
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          try {
            socket.close();
          } catch {}
        }
      };
    } catch {
      this.isConnecting = false;
      this.wsConnected = false;
      this.emitCombinedConnectionStatus();
      this.startHttpFallbackPolling();
      this.scheduleReconnect();
    }
  }

  private clearHeartbeatTimeout() {
    if (this.heartbeatTimeoutTimer !== null) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  private clearHeartbeatTimers() {
    if (this.heartbeatTimer !== null) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.clearHeartbeatTimeout();
  }

  public syncHeartbeat(immediate: boolean = false) {
    if (this.isDisposed) return;
    this.clearHeartbeatTimers();
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    if (immediate) {
      const sinceMove = performance.now() - this.lastMoveSentAt;
      const deferMs = sinceMove < QUIET_WINDOW_MS ? QUIET_WINDOW_MS - sinceMove + 4 : 0;
      this.heartbeatTimer = window.setTimeout(() => {
        this.heartbeatTimer = null;
        this.dispatchHeartbeatPing();
      }, deferMs);
      return;
    }

    const baseDelay = Math.max(4000, this.heartbeatIntervalMs);
    const sinceLastRx = performance.now() - (this.lastPacketReceivedAt || performance.now());
    const phaseDelay = Math.max(1500, baseDelay - Math.min(baseDelay - 1500, sinceLastRx));

    this.heartbeatTimer = window.setTimeout(() => {
      this.heartbeatTimer = null;
      this.dispatchHeartbeatPing();
    }, phaseDelay);
  }

  private dispatchHeartbeatPing() {
    if (this.isDisposed || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const sinceMove = performance.now() - this.lastMoveSentAt;
    if (sinceMove < QUIET_WINDOW_MS) {
      this.heartbeatTimer = window.setTimeout(() => {
        this.heartbeatTimer = null;
        this.dispatchHeartbeatPing();
      }, QUIET_WINDOW_MS - sinceMove + 4);
      return;
    }

    const seq = ++this.pingSeq;
    const clientTs = Date.now();
    this.pendingPingSeq = seq;
    this.pendingPingSentAt = performance.now();

    try {
      this.ws.send(
        JSON.stringify({
          type: 'ping',
          payload: { clientTs, seq },
        })
      );
      this.lastPacketSentAt = performance.now();
    } catch {
      this.handleZombieSocket();
      return;
    }

    this.clearHeartbeatTimeout();
    this.heartbeatTimeoutTimer = window.setTimeout(() => {
      this.heartbeatTimeoutTimer = null;
      if (this.pendingPingSeq === seq) {
        this.handleZombieSocket();
      }
    }, HEARTBEAT_TIMEOUT_MS);
  }

  private handlePong(packet: any) {
    const payload = packet?.payload && typeof packet.payload === 'object' ? packet.payload : packet;
    const seq = typeof payload?.seq === 'number' ? payload.seq : null;

    if (this.pendingPingSeq !== null && (seq === null || seq === this.pendingPingSeq)) {
      const rtt = Math.max(1, performance.now() - this.pendingPingSentAt);
      this.smoothedRttMs = this.smoothedRttMs === 0 ? rtt : this.smoothedRttMs * 0.75 + rtt * 0.25;
      this.pendingPingSeq = null;

      const serverTs =
        typeof payload?.serverTs === 'number'
          ? payload.serverTs
          : typeof packet?.ts === 'number'
          ? packet.ts
          : null;
      if (serverTs !== null) {
        const estimatedNow = serverTs + rtt / 2;
        const sampleOffset = estimatedNow - Date.now();
        this.clockOffsetMs =
          this.clockOffsetMs === 0 ? sampleOffset : this.clockOffsetMs * 0.8 + sampleOffset * 0.2;
      }

      this.callbacks.onLatencyUpdate?.(Math.round(this.smoothedRttMs));
    }

    if (typeof payload?.nextPingInMs === 'number' && payload.nextPingInMs >= 3000) {
      this.heartbeatIntervalMs = Math.min(30000, payload.nextPingInMs);
    }

    this.clearHeartbeatTimeout();
    this.syncHeartbeat(false);
  }

  private handleZombieSocket() {
    this.pendingPingSeq = null;
    this.stopWsHeartbeat();
    const deadWs = this.ws;
    this.ws = null;
    this.wsConnected = false;
    this.isConnecting = false;
    if (deadWs) {
      try {
        deadWs.close(4008, 'Heartbeat timeout');
      } catch {}
    }
    if (!this.isDisposed) {
      this.emitCombinedConnectionStatus();
      this.startHttpFallbackPolling();
      this.scheduleReconnect();
    }
  }

  private stopWsHeartbeat() {
    this.pendingPingSeq = null;
    this.clearHeartbeatTimers();
  }

  private startHttpFallbackPolling() {
    if (this.isDisposed || this.httpSyncTimer !== null) return;
    const poll = async () => {
      if (this.isDisposed) return;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.stopHttpFallbackPolling();
        return;
      }
      if (this.httpPollInFlight) return;
      this.httpPollInFlight = true;
      try {
        await this.syncViaHttp();
      } finally {
        this.httpPollInFlight = false;
      }
    };
    void poll();
    this.httpSyncTimer = window.setInterval(poll, 350);
  }

  private stopHttpFallbackPolling() {
    if (this.httpSyncTimer !== null) {
      clearInterval(this.httpSyncTimer);
      this.httpSyncTimer = null;
    }
  }

  private upsertKnownPeer(peer: RemotePlayerInfo, notifyJoinIfNew: boolean = true) {
    if (!peer || !peer.id || peer.id === this.selfId) return;
    const now = Date.now();
    const existing = this.knownPeers.get(peer.id);
    this.knownPeers.set(peer.id, { info: peer, lastSeen: now });
    if (!existing && notifyJoinIfNew) {
      this.callbacks.onPlayerJoined(peer);
    } else if (existing) {
      this.callbacks.onPlayerUpdated(peer);
    }
  }

  private checkPeerRoomGameSync(payload: any) {
    if (this.currentMode !== 'lan_room') return;
    const peerGameId = payload?.gameId;
    if (!isValidGameId(peerGameId) || peerGameId === this.currentGameId) return;

    const peerJoinedAt =
      typeof payload?.joinedRoomAt === 'number' && Number.isFinite(payload.joinedRoomAt)
        ? payload.joinedRoomAt
        : 0;
    const peerId = String(payload?.id || '');

    // Adopt the game world of the player who created/entered the custom room first
    const peerIsOlderHost =
      peerJoinedAt > 0
        ? peerJoinedAt < this.joinedRoomAt - 250 ||
          (Math.abs(peerJoinedAt - this.joinedRoomAt) <= 250 && peerId < this.selfId)
        : true;

    if (peerIsOlderHost) {
      this.currentGameId = peerGameId;
      this.callbacks.onRoomGameDetected?.(peerGameId);
    }
  }

  private async syncViaHttp() {
    if (isFileProtocol()) return;
    const targetRoomId = this.currentRoomId;
    const targetMode = this.currentMode === 'lan_room' ? 'lan' : 'online';
    const gameId = this.currentGameId;

    try {
      if (this.httpJoinedRoomId !== targetRoomId) {
        const prevRoom = this.httpJoinedRoomId;
        const res = await fetch('/api/multiplayer/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: this.selfId,
            roomId: targetRoomId,
            previousRoomId: prevRoom,
            mode: targetMode,
            gameId,
            joinedRoomAt: this.joinedRoomAt,
            skin: this.currentSkin,
            ...this.publicMeta,
            ...this.lastLocalState,
          }),
        });
        if (!res.ok) throw new Error('HTTP join failed');
        const data = await res.json();
        this.httpConnected = true;
        this.httpJoinedRoomId = targetRoomId;
        this.httpSeq = typeof data.seq === 'number' ? data.seq : 0;

        if (isValidGameId(data.gameId) && this.currentMode === 'lan_room' && data.gameId !== this.currentGameId) {
          this.currentGameId = data.gameId;
          this.callbacks.onRoomGameDetected?.(data.gameId);
        }

        const serverPlayers: RemotePlayerInfo[] = (data.players || []).filter(
          (p: RemotePlayerInfo) => p.id !== this.selfId
        );
        for (const p of serverPlayers) {
          this.knownPeers.set(p.id, { info: p, lastSeen: Date.now() });
        }

        const mergedPlayers = Array.from(this.knownPeers.values()).map((e) => e.info);
        this.emitCombinedConnectionStatus();
        this.callbacks.onInitRoom({
          selfId: this.selfId,
          roomId: data.roomId || targetRoomId,
          gameId: isValidGameId(data.gameId) ? data.gameId : this.currentGameId,
          players: mergedPlayers,
          blocks: data.blocks || [],
          openedDoors: Array.isArray(data.openedDoors) ? data.openedDoors : [],
          elevatorClosed: Boolean(data.elevatorClosed),
          chatHistory: Array.isArray(data.chatHistory)
            ? data.chatHistory.map((m: { id: string; author: string; text: string }) => ({
                ...m,
                author: filterProfanity(String(m.author || 'Игрок')),
                text: filterProfanity(String(m.text || '')),
              }))
            : [],
        });
        return;
      }

      const actionsToFlush = this.pendingHttpActions.splice(0, 20);
      const res = await fetch('/api/multiplayer/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: this.selfId,
          roomId: targetRoomId,
          mode: targetMode,
          gameId,
          joinedRoomAt: this.joinedRoomAt,
          sinceSeq: this.httpSeq,
          skin: this.currentSkin,
          ...this.publicMeta,
          ...this.lastLocalState,
          actions: actionsToFlush,
        }),
      });
      if (!res.ok) throw new Error('HTTP sync failed');
      const data = await res.json();
      this.httpConnected = true;
      this.emitCombinedConnectionStatus();

      if (typeof data.seq === 'number') {
        this.httpSeq = data.seq;
      }

      const serverPlayers: RemotePlayerInfo[] = (data.players || []).filter(
        (p: RemotePlayerInfo) => p.id !== this.selfId
      );
      for (const peer of serverPlayers) {
        this.upsertKnownPeer(peer, true);
      }

      if (Array.isArray(data.events)) {
        for (const ev of data.events) {
          if (ev.type === 'player:joined' || ev.type === 'player:left') continue;
          this.handleMessage(ev, false);
        }
      }
    } catch {
      this.httpConnected = false;
      this.emitCombinedConnectionStatus();
    }
  }

  private sendJoinPacket() {
    const joinMsg = {
      type: 'room:join',
      payload: {
        clientId: this.selfId,
        roomId: this.currentRoomId,
        gameId: this.currentGameId,
        joinedRoomAt: this.joinedRoomAt,
        mode: this.currentMode === 'lan_room' ? 'lan' : 'online',
        skin: this.currentSkin,
        ...this.publicMeta,
        ...this.lastLocalState,
      },
    };
    this.sendRaw(joinMsg);
    this.broadcastPresencePacket('player:joined');
  }

  private handleMessage(data: any, fromPeerChannel: boolean) {
    if (!data || !data.type) return;
    const { type, payload } = data;

    if (type === 'room:init' && payload) {
      if (typeof payload.heartbeatIntervalMs === 'number' && payload.heartbeatIntervalMs >= 3000) {
        this.heartbeatIntervalMs = Math.min(30000, payload.heartbeatIntervalMs);
      }
      if (typeof payload.serverTime === 'number') {
        const sampleOffset = payload.serverTime - Date.now();
        this.clockOffsetMs =
          this.clockOffsetMs === 0 ? sampleOffset : this.clockOffsetMs * 0.7 + sampleOffset * 0.3;
      }
      if (isValidGameId(payload.gameId) && this.currentMode === 'lan_room' && payload.gameId !== this.currentGameId) {
        const otherPlayers = (payload.players || []).filter((p: RemotePlayerInfo) => p.id !== this.selfId);
        if (otherPlayers.length > 0) {
          this.currentGameId = payload.gameId;
          this.callbacks.onRoomGameDetected?.(payload.gameId);
        }
      }

      const incomingPlayers: RemotePlayerInfo[] = (payload.players || []).filter(
        (p: RemotePlayerInfo) => p.id !== this.selfId
      );
      const now = Date.now();
      for (const p of incomingPlayers) {
        this.knownPeers.set(p.id, { info: p, lastSeen: now });
      }
      // Preserve any active Cloud Relay peers alongside server players
      const combinedPlayers = Array.from(this.knownPeers.values()).map((e) => e.info);

      if (Array.isArray(payload.blocks)) {
        for (const b of payload.blocks) {
          if (b && b.key) this.localBlocks.set(b.key, b);
        }
      }
      if (Array.isArray(payload.openedDoors)) {
        for (const idx of payload.openedDoors) {
          if (typeof idx === 'number') this.localOpenedDoors.add(idx);
        }
      }
      if (payload.elevatorClosed) {
        this.localElevatorClosed = true;
      }

      this.syncHeartbeat(false);
      this.callbacks.onInitRoom({
        selfId: this.selfId,
        roomId: payload.roomId || this.currentRoomId,
        gameId: isValidGameId(payload.gameId) ? payload.gameId : this.currentGameId,
        players: combinedPlayers,
        blocks: Array.from(this.localBlocks.values()),
        openedDoors: Array.from(this.localOpenedDoors),
        elevatorClosed: this.localElevatorClosed,
        chatHistory: Array.isArray(payload.chatHistory)
          ? payload.chatHistory.map((m: { id: string; author: string; text: string }) => ({
              ...m,
              author: filterProfanity(String(m.author || 'Игрок')),
              text: filterProfanity(String(m.text || '')),
            }))
          : [],
        serverTime: payload.serverTime,
        heartbeatIntervalMs: payload.heartbeatIntervalMs,
      });
    } else if (
      (type === 'player:joined' || type === 'player:presence' || type === 'player:presence_reply') &&
      payload &&
      payload.id &&
      payload.id !== this.selfId
    ) {
      this.checkPeerRoomGameSync(payload);
      const isNewPeer = !this.knownPeers.has(payload.id);
      const prev = this.knownPeers.get(payload.id)?.info;
      const peerInfo: RemotePlayerInfo = {
        id: payload.id,
        playerKey: typeof payload.playerKey === 'string' ? payload.playerKey : prev?.playerKey,
        bio: typeof payload.bio === 'string' ? payload.bio : prev?.bio,
        gems: typeof payload.gems === 'number' ? payload.gems : prev?.gems,
        unlockedAchievements:
          payload.unlockedAchievements && typeof payload.unlockedAchievements === 'object'
            ? payload.unlockedAchievements
            : prev?.unlockedAchievements,
        lifetimeStats:
          payload.lifetimeStats && typeof payload.lifetimeStats === 'object'
            ? payload.lifetimeStats
            : prev?.lifetimeStats,
        skin: payload.skin || prev?.skin || this.currentSkin,
        position: Array.isArray(payload.position) ? payload.position : prev?.position || [0, 1.5, 0],
        rotationY: typeof payload.rotationY === 'number' ? payload.rotationY : prev?.rotationY || 0,
        isMoving: Boolean(payload.isMoving),
        isGrounded: payload.isGrounded !== false,
        activeTool: payload.activeTool || 'sword',
        checkpoint: typeof payload.checkpoint === 'number' ? payload.checkpoint : 0,
        coins: typeof payload.coins === 'number' ? payload.coins : 0,
      };
      this.upsertKnownPeer(peerInfo, true);

      if (Array.isArray(payload.openedDoors)) {
        for (const dIdx of payload.openedDoors) {
          if (typeof dIdx === 'number' && !this.localOpenedDoors.has(dIdx)) {
            this.localOpenedDoors.add(dIdx);
            this.callbacks.onDoorOpened?.(dIdx);
          }
        }
      }
      if (payload.elevatorClosed && !this.localElevatorClosed) {
        this.localElevatorClosed = true;
        this.callbacks.onElevatorClosed?.();
      }

      if (fromPeerChannel) {
        const nowReply = Date.now();
        const prevReplyAt = this.lastPresenceReplyToPeer.get(payload.id) || 0;
        const shouldReply =
          type === 'player:joined' ||
          isNewPeer ||
          (type === 'player:presence' && nowReply - prevReplyAt > 4000);
        if (shouldReply) {
          this.lastPresenceReplyToPeer.set(payload.id, nowReply);
          this.broadcastPresencePacket('player:presence_reply');
        }
      }
    } else if (type === 'player:updated' && payload && payload.id && payload.id !== this.selfId) {
      this.checkPeerRoomGameSync(payload);
      const prev = this.knownPeers.get(payload.id)?.info;
      const merged: RemotePlayerInfo = {
        id: payload.id,
        playerKey: typeof payload.playerKey === 'string' ? payload.playerKey : prev?.playerKey,
        bio: typeof payload.bio === 'string' ? payload.bio : prev?.bio,
        gems: typeof payload.gems === 'number' ? payload.gems : prev?.gems,
        unlockedAchievements:
          payload.unlockedAchievements && typeof payload.unlockedAchievements === 'object'
            ? payload.unlockedAchievements
            : prev?.unlockedAchievements,
        lifetimeStats:
          payload.lifetimeStats && typeof payload.lifetimeStats === 'object'
            ? payload.lifetimeStats
            : prev?.lifetimeStats,
        skin: payload.skin || prev?.skin || this.currentSkin,
        position: Array.isArray(payload.position) ? payload.position : prev?.position || [0, 1.5, 0],
        rotationY: typeof payload.rotationY === 'number' ? payload.rotationY : prev?.rotationY || 0,
        isMoving: typeof payload.isMoving === 'boolean' ? payload.isMoving : Boolean(prev?.isMoving),
        isGrounded: typeof payload.isGrounded === 'boolean' ? payload.isGrounded : prev?.isGrounded !== false,
        activeTool: payload.activeTool || prev?.activeTool || 'sword',
        checkpoint: typeof payload.checkpoint === 'number' ? payload.checkpoint : prev?.checkpoint || 0,
        coins: typeof payload.coins === 'number' ? payload.coins : prev?.coins || 0,
      };
      const isNew = !prev;
      this.knownPeers.set(payload.id, { info: merged, lastSeen: Date.now() });
      if (isNew) {
        this.callbacks.onPlayerJoined(merged);
        if (fromPeerChannel) {
          this.broadcastPresencePacket('player:presence_reply');
        }
      } else {
        this.callbacks.onPlayerUpdated(merged);
      }
    } else if (type === 'player:skin_updated' && payload && payload.id && payload.id !== this.selfId) {
      const existing = this.knownPeers.get(payload.id);
      if (existing) {
        existing.info = {
          ...existing.info,
          skin: payload.skin || existing.info.skin,
          playerKey: typeof payload.playerKey === 'string' ? payload.playerKey : existing.info.playerKey,
          bio: typeof payload.bio === 'string' ? payload.bio : existing.info.bio,
          gems: typeof payload.gems === 'number' ? payload.gems : existing.info.gems,
          unlockedAchievements:
            payload.unlockedAchievements && typeof payload.unlockedAchievements === 'object'
              ? payload.unlockedAchievements
              : existing.info.unlockedAchievements,
          lifetimeStats:
            payload.lifetimeStats && typeof payload.lifetimeStats === 'object'
              ? payload.lifetimeStats
              : existing.info.lifetimeStats,
        };
        existing.lastSeen = Date.now();
        this.callbacks.onPlayerUpdated(existing.info);
      }
      if (payload.skin) {
        this.callbacks.onPlayerSkinUpdated(payload.id, payload.skin);
      }
    } else if (type === 'player:attacked' && payload && payload.id && payload.id !== this.selfId) {
      const existing = this.knownPeers.get(payload.id);
      if (existing) existing.lastSeen = Date.now();
      this.callbacks.onPlayerAttacked(payload.id);
    } else if (
      type === 'player:emoted' &&
      payload &&
      payload.id &&
      payload.id !== this.selfId &&
      isValidEmoteId(payload.emoteId)
    ) {
      const eventId = payload.eventId ? String(payload.eventId) : '';
      if (eventId) {
        if (this.seenEmoteEventIds.has(eventId)) return;
        this.seenEmoteEventIds.add(eventId);
        if (this.seenEmoteEventIds.size > 100) {
          const first = this.seenEmoteEventIds.values().next().value;
          if (first) this.seenEmoteEventIds.delete(first);
        }
      }
      const existing = this.knownPeers.get(payload.id);
      if (existing) {
        existing.lastSeen = Date.now();
        const dur =
          typeof payload.durationMs === 'number'
            ? payload.durationMs
            : getEmoteById(payload.emoteId).durationMs;
        existing.info.activeEmote = { id: payload.emoteId, expiresAt: Date.now() + dur };
      }
      this.callbacks.onPlayerEmoted?.(payload.id, payload.emoteId, payload.durationMs);
    } else if (type === 'player:left' && payload && payload.id && payload.id !== this.selfId) {
      const leaving = this.knownPeers.get(payload.id);
      this.knownPeers.delete(payload.id);
      this.callbacks.onPlayerLeft(payload.id, payload.name || leaving?.info.skin?.name);
    } else if (type === 'block:placed' && payload && payload.key) {
      if (!this.localBlocks.has(payload.key)) {
        this.localBlocks.set(payload.key, payload);
        this.callbacks.onBlockPlaced(payload);
      }
    } else if (type === 'block:removed' && payload?.key) {
      this.localBlocks.delete(payload.key);
      this.callbacks.onBlockRemoved(payload.key);
    } else if (type === 'doors:opened' && typeof payload?.doorIndex === 'number') {
      if (!this.localOpenedDoors.has(payload.doorIndex)) {
        this.localOpenedDoors.add(payload.doorIndex);
        this.callbacks.onDoorOpened?.(payload.doorIndex, payload.doorNumber);
      }
    } else if (type === 'doors:elevator_closed') {
      if (!this.localElevatorClosed) {
        this.localElevatorClosed = true;
        this.callbacks.onElevatorClosed?.();
      }
    } else if (type === 'chat:message' && payload) {
      const cleanPayload = {
        ...payload,
        author: payload.author ? filterProfanity(String(payload.author)) : undefined,
        text: filterProfanity(String(payload.text || '')),
      };
      const msgId = String(cleanPayload.id || `${cleanPayload.author}:${cleanPayload.text}:${Math.floor(Date.now() / 2000)}`);
      if (this.seenChatIds.has(msgId)) return;
      this.seenChatIds.add(msgId);
      if (this.seenChatIds.size > 120) {
        const first = this.seenChatIds.values().next().value;
        if (first) this.seenChatIds.delete(first);
      }
      this.callbacks.onChatMessage(cleanPayload);
    } else if (type === 'game:invite' && payload && typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('blox_game_invite', { detail: payload }));
      } catch {}
    } else if (type === 'leaderboard:updated') {
      this.callbacks.onLeaderboardUpdated?.(payload?.gameId);
    } else if (type === 'voice:state' && payload && payload.id && payload.id !== this.selfId) {
      const voiceState: VoicePeerBroadcastState = {
        id: String(payload.id),
        enabled: Boolean(payload.enabled),
        muted: Boolean(payload.muted),
        speaking: Boolean(payload.enabled) && !Boolean(payload.muted) && Boolean(payload.speaking),
      };
      const existing = this.knownPeers.get(voiceState.id);
      if (existing) {
        existing.lastSeen = Date.now();
        existing.info.voiceEnabled = voiceState.enabled;
        existing.info.voiceMuted = voiceState.muted;
        existing.info.voiceSpeaking = voiceState.speaking;
      }
      this.callbacks.onVoiceStateUpdated?.(voiceState);
    } else if (type === 'voice:signal' && payload && payload.from && payload.from !== this.selfId) {
      if (payload.to && payload.to !== this.selfId) return;
      const sigId = payload.signalId ? String(payload.signalId) : '';
      if (sigId) {
        if (this.seenVoiceSignalIds.has(sigId)) return;
        this.seenVoiceSignalIds.add(sigId);
        if (this.seenVoiceSignalIds.size > 300) {
          const first = this.seenVoiceSignalIds.values().next().value;
          if (first) this.seenVoiceSignalIds.delete(first);
        }
      }
      this.callbacks.onVoiceSignal?.({
        from: String(payload.from),
        to: String(payload.to || this.selfId),
        signalType: payload.signalType as VoiceSignalType,
        sdp: payload.sdp,
        candidate: payload.candidate,
        signalId: sigId || undefined,
      });
    }
  }

  private sendRaw(packet: { type: string; payload?: any }, queueForHttp: boolean = false) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(packet));
        this.lastPacketSentAt = performance.now();
      } catch {
        if (queueForHttp) {
          this.enqueueHttpAction(packet);
        }
        this.handleZombieSocket();
      }
    } else if (queueForHttp) {
      this.enqueueHttpAction(packet);
    }
  }

  private enqueueHttpAction(packet: { type: string; payload?: any }) {
    this.pendingHttpActions.push(packet);
    if (this.pendingHttpActions.length > 30) {
      this.pendingHttpActions.shift();
    }
  }

  public sendMoveUpdate(state: LocalMoveSnapshot) {
    this.lastLocalState = state;

    const now = performance.now();
    // Throttle outgoing socket updates to ~16Hz (every 60ms)
    if (now - this.lastMoveSentAt < 60) return;
    this.lastMoveSentAt = now;

    const movePayload = {
      id: this.selfId,
      skin: this.currentSkin,
      gameId: this.currentGameId,
      joinedRoomAt: this.joinedRoomAt,
      ...state,
    };

    this.sendRaw({ type: 'player:move', payload: movePayload }, false);

    const peerUpdatePacket = {
      type: 'player:updated',
      payload: movePayload,
    };
    this.cloudRelay?.publishRoom(peerUpdatePacket);
    if (this.bc) {
      try {
        this.bc.postMessage(peerUpdatePacket);
      } catch {}
    }
  }

  public sendSkinUpdate(skin: CharacterSkin) {
    this.currentSkin = skin;
    const payload = {
      skin,
      ...this.publicMeta,
    };
    this.sendRaw({ type: 'player:skin', payload }, true);
    const peerMsg = {
      type: 'player:skin_updated',
      payload: {
        id: this.selfId,
        ...payload,
      },
    };
    this.cloudRelay?.publishRoom(peerMsg);
    if (this.bc) {
      try {
        this.bc.postMessage(peerMsg);
      } catch {}
    }
  }

  public sendAttack() {
    this.sendRaw({ type: 'player:attack', payload: { id: this.selfId } }, true);
    const peerMsg = { type: 'player:attacked', payload: { id: this.selfId } };
    this.cloudRelay?.publishRoom(peerMsg);
    if (this.bc) {
      try {
        this.bc.postMessage(peerMsg);
      } catch {}
    }
  }

  public sendEmote(emoteId: EmoteId, durationMs?: number) {
    if (!isValidEmoteId(emoteId)) return;
    const resolvedDuration =
      typeof durationMs === 'number' && durationMs > 0
        ? durationMs
        : getEmoteById(emoteId).durationMs;
    const eventId = `em_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.seenEmoteEventIds.add(eventId);
    const wsPayload = { id: this.selfId, emoteId, durationMs: resolvedDuration, eventId };
    this.sendRaw({ type: 'player:emote', payload: wsPayload }, true);
    const peerMsg = { type: 'player:emoted', payload: wsPayload };
    this.cloudRelay?.publishRoom(peerMsg);
    if (this.bc) {
      try {
        this.bc.postMessage(peerMsg);
      } catch {}
    }
  }

  public sendBlockPlace(key: string, position: [number, number, number], color: string) {
    this.localBlocks.set(key, { key, position, color });
    this.sendRaw({ type: 'block:place', payload: { key, position, color } }, true);
    const peerMsg = { type: 'block:placed', payload: { key, position, color } };
    this.cloudRelay?.publishRoom(peerMsg);
    if (this.bc) {
      try {
        this.bc.postMessage(peerMsg);
      } catch {}
    }
  }

  public sendBlockRemove(key: string) {
    this.localBlocks.delete(key);
    this.sendRaw({ type: 'block:remove', payload: { key } }, true);
    const peerMsg = { type: 'block:removed', payload: { key } };
    this.cloudRelay?.publishRoom(peerMsg);
    if (this.bc) {
      try {
        this.bc.postMessage(peerMsg);
      } catch {}
    }
  }

  public sendDoorOpen(doorIndex: number, doorNumber: number) {
    this.localOpenedDoors.add(doorIndex);
    this.sendRaw({ type: 'doors:open', payload: { doorIndex, doorNumber } }, true);
    const peerMsg = { type: 'doors:opened', payload: { doorIndex, doorNumber } };
    this.cloudRelay?.publishRoom(peerMsg);
    if (this.bc) {
      try {
        this.bc.postMessage(peerMsg);
      } catch {}
    }
  }

  public sendElevatorClose() {
    this.localElevatorClosed = true;
    this.sendRaw({ type: 'doors:elevator', payload: {} }, true);
    const peerMsg = { type: 'doors:elevator_closed', payload: {} };
    this.cloudRelay?.publishRoom(peerMsg);
    if (this.bc) {
      try {
        this.bc.postMessage(peerMsg);
      } catch {}
    }
  }

  public sendChatMessage(text: string, author: string) {
    const cleanText = filterProfanity(text);
    const cleanAuthor = filterProfanity(author);
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.seenChatIds.add(msgId);
    this.sendRaw({ type: 'chat:send', payload: { id: msgId, text: cleanText, author: cleanAuthor } }, true);
    const peerMsg = {
      type: 'chat:message',
      payload: { id: msgId, author: cleanAuthor, text: cleanText },
    };
    this.cloudRelay?.publishRoom(peerMsg);
    if (this.bc) {
      try {
        this.bc.postMessage(peerMsg);
      } catch {}
    }
  }

  public getSelfId(): string {
    return this.selfId;
  }

  public sendVoiceState(state: { enabled: boolean; muted: boolean; speaking: boolean }) {
    const payload = {
      id: this.selfId,
      enabled: Boolean(state.enabled),
      muted: Boolean(state.muted),
      speaking: Boolean(state.enabled) && !Boolean(state.muted) && Boolean(state.speaking),
    };
    this.sendRaw({ type: 'voice:state', payload }, true);
    const peerMsg = { type: 'voice:state', payload };
    this.cloudRelay?.publishRoom(peerMsg);
    if (this.bc) {
      try {
        this.bc.postMessage(peerMsg);
      } catch {}
    }
  }

  public sendVoiceSignal(
    toPeerId: string,
    signal: {
      signalType: VoiceSignalType;
      sdp?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    }
  ) {
    if (!toPeerId || toPeerId === this.selfId) return;
    const signalId = `vsig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.seenVoiceSignalIds.add(signalId);
    const payload = {
      from: this.selfId,
      to: toPeerId,
      signalType: signal.signalType,
      sdp: signal.sdp,
      candidate: signal.candidate,
      signalId,
    };
    this.sendRaw({ type: 'voice:signal', payload }, true);
    const peerMsg = { type: 'voice:signal', payload };
    this.cloudRelay?.publishRoom(peerMsg);
    if (this.bc) {
      try {
        this.bc.postMessage(peerMsg);
      } catch {}
    }
  }

  public sendGameInvite(invite: any) {
    this.cloudRelay?.publishGlobal({
      type: 'game:invite',
      payload: invite,
    });
  }

  public dispose() {
    this.isDisposed = true;
    this.detachLifecycleListeners();
    this.stopWsHeartbeat();
    this.stopHttpFallbackPolling();
    if (this.presenceBeaconTimer !== null) {
      clearInterval(this.presenceBeaconTimer);
      this.presenceBeaconTimer = null;
    }
    if (this.httpStartupFallbackTimer) {
      clearTimeout(this.httpStartupFallbackTimer);
      this.httpStartupFallbackTimer = null;
    }
    this.clearReconnectTimer();
    const leaveMsg = {
      type: 'player:left',
      payload: { id: this.selfId, name: this.currentSkin.name },
    };
    this.cloudRelay?.publishRoom(leaveMsg);
    this.cloudRelay?.dispose();
    this.cloudRelay = null;

    if (this.httpJoinedRoomId && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        navigator.sendBeacon(
          '/api/multiplayer/leave',
          new Blob(
            [JSON.stringify({ clientId: this.selfId, roomId: this.httpJoinedRoomId })],
            { type: 'application/json' }
          )
        );
      } catch {}
    }
    if (this.bc) {
      try {
        this.bc.postMessage(leaveMsg);
      } catch {}
      this.bc.close();
      this.bc = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

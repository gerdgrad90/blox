import type {
  VoiceChatSnapshot,
  VoiceInputMode,
  VoiceParticipantInfo,
  VoicePeerBroadcastState,
  VoiceSignalPacket,
  VoiceSignalType,
  VoiceSpatialMode,
} from './types';

export interface VoiceSignalingTransport {
  getSelfId: () => string;
  sendVoiceState: (state: { enabled: boolean; muted: boolean; speaking: boolean }) => void;
  sendVoiceSignal: (
    toPeerId: string,
    signal: {
      signalType: VoiceSignalType;
      sdp?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    }
  ) => void;
}

export interface VoicePeerMetadata {
  id: string;
  name: string;
  voiceEnabled?: boolean;
  voiceMuted?: boolean;
  voiceSpeaking?: boolean;
}

export const VOICE_PROXIMITY_MIN_DISTANCE = 6;
export const VOICE_PROXIMITY_MAX_DISTANCE = 42;
export const VOICE_SPEAKING_THRESHOLD = 0.042;
const VOICE_SPEAKING_HANGOVER_MS = 280;

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

/**
 * Deterministic glare-free WebRTC offer tie-breaker.
 * Only the peer with the lexicographically smaller client ID creates and sends the initial offer.
 */
export function shouldInitiateVoiceOffer(selfId: string, peerId: string): boolean {
  const a = String(selfId || '').trim();
  const b = String(peerId || '').trim();
  if (!a || !b || a === b) return false;
  return a < b;
}

/**
 * Computes 3D distance-attenuated gain for proximity voice chat, or 1.0 in global room mode.
 */
export function computeProximityVoiceGain(
  listenerPos: [number, number, number] | null | undefined,
  speakerPos: [number, number, number] | null | undefined,
  mode: VoiceSpatialMode,
  minDistance: number = VOICE_PROXIMITY_MIN_DISTANCE,
  maxDistance: number = VOICE_PROXIMITY_MAX_DISTANCE
): number {
  if (mode === 'room') return 1;
  if (!listenerPos || !speakerPos) return 1;
  const dx = speakerPos[0] - listenerPos[0];
  const dy = speakerPos[1] - listenerPos[1];
  const dz = speakerPos[2] - listenerPos[2];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (!Number.isFinite(dist)) return 1;
  if (dist <= minDistance) return 1;
  if (dist >= maxDistance) return 0;
  const span = Math.max(0.001, maxDistance - minDistance);
  const t = (dist - minDistance) / span;
  // Smooth ease-out curve so nearby players stay clear and distant players fade smoothly
  const gain = Math.pow(1 - t, 1.65);
  return Math.max(0, Math.min(1, gain));
}

export function computeDistanceMeters(
  a: [number, number, number] | null | undefined,
  b: [number, number, number] | null | undefined
): number | null {
  if (!a || !b) return null;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return Number.isFinite(dist) ? dist : null;
}

/**
 * Computes normalized RMS audio level (0..1) from an 8-bit PCM time-domain buffer centered at 128.
 */
export function computeRmsVoiceLevel(samples: ArrayLike<number>): number {
  const len = samples.length;
  if (!len) return 0;
  let sumSq = 0;
  for (let i = 0; i < len; i++) {
    const centered = (samples[i] - 128) / 128;
    sumSq += centered * centered;
  }
  const rms = Math.sqrt(sumSq / len);
  return Math.max(0, Math.min(1, rms * 2.4));
}

export function isVoiceSpeakingFromLevel(
  level: number,
  threshold: number = VOICE_SPEAKING_THRESHOLD
): boolean {
  return Number.isFinite(level) && level >= threshold;
}

interface RemotePeerRecord {
  id: string;
  name: string;
  voiceEnabled: boolean;
  voiceMuted: boolean;
  voiceSpeaking: boolean;
  localVolume: number;
  locallyMuted: boolean;
  remoteLevel: number;
  distanceMeters: number | null;
  effectiveGain: number;
  connectionState: 'connected' | 'connecting' | 'idle';
}

interface PeerConnectionBundle {
  peerId: string;
  pc: RTCPeerConnection;
  pendingIce: RTCIceCandidateInit[];
  remoteStream: MediaStream | null;
  audioEl: HTMLAudioElement | null;
  sourceNode: MediaStreamAudioSourceNode | null;
  analyserNode: AnalyserNode | null;
  gainNode: GainNode | null;
  analyserBuf: Uint8Array<ArrayBuffer> | null;
  makingOffer: boolean;
}

const VOICE_PREFS_STORAGE_KEY = 'blox_voice_prefs_v1';

interface SavedVoicePrefs {
  inputMode?: VoiceInputMode;
  spatialMode?: VoiceSpatialMode;
  masterVolume?: number;
}

function loadVoicePrefs(): SavedVoicePrefs {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(VOICE_PREFS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      inputMode: parsed.inputMode === 'ptt' ? 'ptt' : 'open',
      spatialMode: parsed.spatialMode === 'proximity' ? 'proximity' : 'room',
      masterVolume:
        typeof parsed.masterVolume === 'number' && Number.isFinite(parsed.masterVolume)
          ? Math.max(0, Math.min(1, parsed.masterVolume))
          : 0.9,
    };
  } catch {
    return {};
  }
}

function saveVoicePrefs(prefs: SavedVoicePrefs) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VOICE_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

export class VoiceChatManager {
  private transport: VoiceSignalingTransport;
  private selfName: string;

  private connected = false;
  private connecting = false;
  private listenOnly = false;
  private muted = false;
  private deafened = false;
  private speaking = false;
  private localLevel = 0;
  private inputMode: VoiceInputMode = 'open';
  private pttActive = false;
  private spatialMode: VoiceSpatialMode = 'room';
  private masterVolume = 0.9;
  private micPermission: 'prompt' | 'granted' | 'denied' | 'unavailable' = 'prompt';
  private statusMessage: string | null = null;

  private localStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private localSourceNode: MediaStreamAudioSourceNode | null = null;
  private localAnalyserNode: AnalyserNode | null = null;
  private localAnalyserBuf: Uint8Array<ArrayBuffer> | null = null;
  private lastSpokeAt = 0;
  private lastBroadcastStateKey = '';

  private peers = new Map<string, RemotePeerRecord>();
  private connections = new Map<string, PeerConnectionBundle>();
  private listeners = new Set<(snapshot: VoiceChatSnapshot) => void>();
  private meterTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(transport: VoiceSignalingTransport, selfName: string = 'Игрок') {
    this.transport = transport;
    this.selfName = selfName;
    const saved = loadVoicePrefs();
    if (saved.inputMode) this.inputMode = saved.inputMode;
    if (saved.spatialMode) this.spatialMode = saved.spatialMode;
    if (typeof saved.masterVolume === 'number') this.masterVolume = saved.masterVolume;
  }

  public setSelfName(name: string) {
    const clean = String(name || '').trim() || 'Игрок';
    if (this.selfName !== clean) {
      this.selfName = clean;
      this.emit();
    }
  }

  public subscribe(listener: (snapshot: VoiceChatSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): VoiceChatSnapshot {
    const selfId = this.transport.getSelfId();
    const participants: VoiceParticipantInfo[] = [];

    if (this.connected) {
      participants.push({
        id: selfId || 'self',
        name: this.selfName,
        isSelf: true,
        enabled: true,
        muted: this.isEffectiveMicMuted(),
        speaking: this.speaking && !this.isEffectiveMicMuted(),
        level: this.isEffectiveMicMuted() ? 0 : this.localLevel,
        connectionState: 'local',
        volume: 1,
        locallyMuted: false,
        distanceMeters: 0,
        effectiveGain: 1,
      });
    }

    let remoteVoiceCount = 0;
    this.peers.forEach((peer) => {
      if (peer.voiceEnabled) {
        remoteVoiceCount += 1;
        participants.push({
          id: peer.id,
          name: peer.name,
          isSelf: false,
          enabled: true,
          muted: peer.voiceMuted,
          speaking: (peer.voiceSpeaking || peer.remoteLevel >= VOICE_SPEAKING_THRESHOLD) && !peer.voiceMuted,
          level: peer.voiceMuted ? 0 : peer.remoteLevel,
          connectionState: peer.connectionState,
          volume: peer.localVolume,
          locallyMuted: peer.locallyMuted,
          distanceMeters: peer.distanceMeters,
          effectiveGain: peer.effectiveGain,
        });
      }
    });

    return {
      connected: this.connected,
      connecting: this.connecting,
      listenOnly: this.listenOnly,
      muted: this.muted,
      deafened: this.deafened,
      speaking: this.speaking && !this.isEffectiveMicMuted(),
      localLevel: this.isEffectiveMicMuted() ? 0 : this.localLevel,
      inputMode: this.inputMode,
      pttActive: this.pttActive,
      spatialMode: this.spatialMode,
      masterVolume: this.masterVolume,
      micPermission: this.micPermission,
      statusMessage: this.statusMessage,
      participants,
      remoteVoiceCount,
    };
  }

  private emit() {
    if (this.disposed) return;
    const snap = this.getSnapshot();
    this.listeners.forEach((cb) => {
      try {
        cb(snap);
      } catch {}
    });
  }

  public isEffectiveMicMuted(): boolean {
    if (!this.connected) return true;
    if (this.listenOnly) return true;
    if (this.deafened) return true;
    if (this.muted) return true;
    if (this.inputMode === 'ptt' && !this.pttActive) return true;
    return false;
  }

  private applyLocalTrackMuteState() {
    const effectiveMuted = this.isEffectiveMicMuted();
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !effectiveMuted;
      });
    }
    if (effectiveMuted) {
      this.speaking = false;
      this.localLevel = 0;
    }
    this.broadcastLocalVoiceState();
  }

  private broadcastLocalVoiceState(force: boolean = false) {
    const payload = {
      enabled: this.connected,
      muted: this.isEffectiveMicMuted(),
      speaking: this.connected && !this.isEffectiveMicMuted() && this.speaking,
    };
    const key = `${payload.enabled ? 1 : 0}:${payload.muted ? 1 : 0}:${payload.speaking ? 1 : 0}`;
    if (!force && key === this.lastBroadcastStateKey) return;
    this.lastBroadcastStateKey = key;
    this.transport.sendVoiceState(payload);
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    }
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.audioCtx = new Ctor();
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  public async joinVoice(): Promise<boolean> {
    if (this.disposed || this.connected || this.connecting) return this.connected;
    this.connecting = true;
    this.statusMessage = 'Подключение к голосовому каналу...';
    this.emit();

    let stream: MediaStream | null = null;
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    ) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        this.micPermission = 'granted';
        this.listenOnly = false;
        this.statusMessage = null;
      } catch (err: any) {
        const errName = String(err?.name || '');
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          this.micPermission = 'denied';
          this.statusMessage = 'Доступ к микрофону запрещён — включён режим прослушивания.';
        } else {
          this.micPermission = 'unavailable';
          this.statusMessage = 'Микрофон не найден — включён режим прослушивания.';
        }
        this.listenOnly = true;
      }
    } else {
      this.micPermission = 'unavailable';
      this.listenOnly = true;
      this.statusMessage = 'Микрофон недоступен в этом браузере — включён режим прослушивания.';
    }

    if (this.disposed) {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      return false;
    }

    this.localStream = stream;
    this.connected = true;
    this.connecting = false;
    this.speaking = false;
    this.localLevel = 0;

    if (this.listenOnly) {
      this.muted = true;
    }

    // Set up local microphone analyser for real-time Voice Activity Detection (VAD)
    const ctx = this.ensureAudioContext();
    if (ctx && this.localStream && this.localStream.getAudioTracks().length > 0) {
      try {
        this.localSourceNode = ctx.createMediaStreamSource(this.localStream);
        this.localAnalyserNode = ctx.createAnalyser();
        this.localAnalyserNode.fftSize = 256;
        this.localAnalyserNode.smoothingTimeConstant = 0.5;
        this.localSourceNode.connect(this.localAnalyserNode);
        this.localAnalyserBuf = new Uint8Array(this.localAnalyserNode.fftSize);
      } catch {
        this.localSourceNode = null;
        this.localAnalyserNode = null;
        this.localAnalyserBuf = null;
      }
    }

    this.applyLocalTrackMuteState();
    this.broadcastLocalVoiceState(true);
    this.startMeterLoop();
    this.reconcilePeerConnections();
    this.emit();
    return true;
  }

  public leaveVoice() {
    if (!this.connected && !this.connecting) return;
    this.connected = false;
    this.connecting = false;
    this.speaking = false;
    this.localLevel = 0;
    this.pttActive = false;
    this.statusMessage = null;

    this.stopMeterLoop();
    this.closeAllPeerConnections();

    if (this.localSourceNode) {
      try {
        this.localSourceNode.disconnect();
      } catch {}
      this.localSourceNode = null;
    }
    this.localAnalyserNode = null;
    this.localAnalyserBuf = null;

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      this.localStream = null;
    }

    this.broadcastLocalVoiceState(true);
    this.emit();
  }

  public toggleMute() {
    if (this.listenOnly && this.connected) {
      this.statusMessage = 'Режим прослушивания: разрешите микрофон и переподключитесь.';
      this.emit();
      return;
    }
    this.muted = !this.muted;
    if (!this.muted && this.deafened) {
      this.deafened = false;
      this.refreshAllRemoteGains();
    }
    this.applyLocalTrackMuteState();
    this.emit();
  }

  public setMuted(muted: boolean) {
    if (this.muted === muted) return;
    this.muted = muted;
    if (!muted && this.deafened) {
      this.deafened = false;
      this.refreshAllRemoteGains();
    }
    this.applyLocalTrackMuteState();
    this.emit();
  }

  public toggleDeafen() {
    this.setDeafened(!this.deafened);
  }

  public setDeafened(deafened: boolean) {
    if (this.deafened === deafened) return;
    this.deafened = deafened;
    this.refreshAllRemoteGains();
    this.applyLocalTrackMuteState();
    this.emit();
  }

  public setInputMode(mode: VoiceInputMode) {
    if (this.inputMode === mode) return;
    this.inputMode = mode;
    if (mode === 'open') {
      this.pttActive = false;
    }
    saveVoicePrefs({
      inputMode: this.inputMode,
      spatialMode: this.spatialMode,
      masterVolume: this.masterVolume,
    });
    this.applyLocalTrackMuteState();
    this.emit();
  }

  public setPushToTalkActive(active: boolean) {
    if (this.inputMode !== 'ptt' || !this.connected) {
      if (this.pttActive) {
        this.pttActive = false;
        this.emit();
      }
      return;
    }
    if (this.pttActive === active) return;
    this.pttActive = active;
    this.applyLocalTrackMuteState();
    this.emit();
  }

  public setSpatialMode(mode: VoiceSpatialMode) {
    if (this.spatialMode === mode) return;
    this.spatialMode = mode;
    saveVoicePrefs({
      inputMode: this.inputMode,
      spatialMode: this.spatialMode,
      masterVolume: this.masterVolume,
    });
    if (mode === 'room') {
      this.peers.forEach((peer) => {
        peer.effectiveGain = 1;
      });
    }
    this.refreshAllRemoteGains();
    this.emit();
  }

  public setMasterVolume(volume: number) {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0.9));
    this.masterVolume = clamped;
    saveVoicePrefs({
      inputMode: this.inputMode,
      spatialMode: this.spatialMode,
      masterVolume: this.masterVolume,
    });
    this.refreshAllRemoteGains();
    this.emit();
  }

  public setPeerVolume(peerId: string, volume: number) {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    peer.localVolume = Math.max(0, Math.min(1.5, Number.isFinite(volume) ? volume : 1));
    this.applyPeerGain(peerId);
    this.emit();
  }

  public togglePeerMute(peerId: string) {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    peer.locallyMuted = !peer.locallyMuted;
    this.applyPeerGain(peerId);
    this.emit();
  }

  public syncRoomPeers(peersList: VoicePeerMetadata[]) {
    const selfId = this.transport.getSelfId();
    const validIds = new Set<string>();

    for (const item of peersList) {
      if (!item.id || item.id === selfId) continue;
      validIds.add(item.id);
      const existing = this.peers.get(item.id);
      if (existing) {
        existing.name = item.name || existing.name;
        if (typeof item.voiceEnabled === 'boolean') existing.voiceEnabled = item.voiceEnabled;
        if (typeof item.voiceMuted === 'boolean') existing.voiceMuted = item.voiceMuted;
        if (typeof item.voiceSpeaking === 'boolean') existing.voiceSpeaking = item.voiceSpeaking;
      } else {
        this.peers.set(item.id, {
          id: item.id,
          name: item.name || 'Игрок',
          voiceEnabled: Boolean(item.voiceEnabled),
          voiceMuted: Boolean(item.voiceMuted),
          voiceSpeaking: Boolean(item.voiceSpeaking),
          localVolume: 1,
          locallyMuted: false,
          remoteLevel: 0,
          distanceMeters: null,
          effectiveGain: 1,
          connectionState: 'idle',
        });
      }
    }

    Array.from(this.peers.keys()).forEach((id) => {
      if (!validIds.has(id)) {
        this.handlePeerLeft(id);
      }
    });

    if (this.connected) {
      this.broadcastLocalVoiceState(true);
      this.reconcilePeerConnections();
    }
    this.emit();
  }

  public upsertPeerMeta(meta: VoicePeerMetadata) {
    const selfId = this.transport.getSelfId();
    if (!meta.id || meta.id === selfId) return;
    const existing = this.peers.get(meta.id);
    if (existing) {
      existing.name = meta.name || existing.name;
      if (typeof meta.voiceEnabled === 'boolean') existing.voiceEnabled = meta.voiceEnabled;
      if (typeof meta.voiceMuted === 'boolean') existing.voiceMuted = meta.voiceMuted;
      if (typeof meta.voiceSpeaking === 'boolean') existing.voiceSpeaking = meta.voiceSpeaking;
    } else {
      this.peers.set(meta.id, {
        id: meta.id,
        name: meta.name || 'Игрок',
        voiceEnabled: Boolean(meta.voiceEnabled),
        voiceMuted: Boolean(meta.voiceMuted),
        voiceSpeaking: Boolean(meta.voiceSpeaking),
        localVolume: 1,
        locallyMuted: false,
        remoteLevel: 0,
        distanceMeters: null,
        effectiveGain: 1,
        connectionState: 'idle',
      });
    }
    if (this.connected) {
      this.reconcilePeerConnections();
    }
    this.emit();
  }

  public handleRemoteVoiceState(state: VoicePeerBroadcastState) {
    const selfId = this.transport.getSelfId();
    if (!state.id || state.id === selfId) return;
    let peer = this.peers.get(state.id);
    if (!peer) {
      peer = {
        id: state.id,
        name: 'Игрок',
        voiceEnabled: state.enabled,
        voiceMuted: state.muted,
        voiceSpeaking: state.speaking,
        localVolume: 1,
        locallyMuted: false,
        remoteLevel: 0,
        distanceMeters: null,
        effectiveGain: 1,
        connectionState: 'idle',
      };
      this.peers.set(state.id, peer);
    } else {
      peer.voiceEnabled = state.enabled;
      peer.voiceMuted = state.muted;
      peer.voiceSpeaking = state.speaking;
    }

    if (!state.enabled) {
      this.closePeerConnection(state.id);
      peer.remoteLevel = 0;
      peer.voiceSpeaking = false;
      peer.connectionState = 'idle';
    } else if (this.connected) {
      this.reconcilePeerConnections();
    }
    this.emit();
  }

  public handlePeerLeft(peerId: string) {
    this.closePeerConnection(peerId);
    if (this.peers.delete(peerId)) {
      this.emit();
    }
  }

  public resetForRoomChange() {
    this.closeAllPeerConnections();
    this.peers.clear();
    if (this.connected) {
      this.broadcastLocalVoiceState(true);
    }
    this.emit();
  }

  public updateSpatialPositions(
    listenerPos: [number, number, number] | null,
    remotePositions: Map<string, [number, number, number]>
  ) {
    if (!this.connected) return;
    let changed = false;
    this.peers.forEach((peer, peerId) => {
      if (!peer.voiceEnabled) return;
      const speakerPos = remotePositions.get(peerId) || null;
      const dist = computeDistanceMeters(listenerPos, speakerPos);
      const gain = computeProximityVoiceGain(listenerPos, speakerPos, this.spatialMode);
      const roundedDist = dist !== null ? Math.round(dist) : null;
      if (peer.distanceMeters !== roundedDist || Math.abs(peer.effectiveGain - gain) > 0.02) {
        peer.distanceMeters = roundedDist;
        peer.effectiveGain = gain;
        this.applyPeerGain(peerId);
        changed = true;
      }
    });
    if (changed) {
      this.emit();
    }
  }

  private reconcilePeerConnections() {
    if (!this.connected || typeof RTCPeerConnection === 'undefined') return;
    const selfId = this.transport.getSelfId();
    if (!selfId) return;

    this.peers.forEach((peer, peerId) => {
      if (!peer.voiceEnabled) {
        this.closePeerConnection(peerId);
        return;
      }
      const existing = this.connections.get(peerId);
      if (!existing && shouldInitiateVoiceOffer(selfId, peerId)) {
        void this.initiateOfferToPeer(peerId);
      }
    });
  }

  private createPeerConnectionBundle(peerId: string): PeerConnectionBundle | null {
    if (typeof RTCPeerConnection === 'undefined') return null;

    const existing = this.connections.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const bundle: PeerConnectionBundle = {
      peerId,
      pc,
      pendingIce: [],
      remoteStream: null,
      audioEl: null,
      sourceNode: null,
      analyserNode: null,
      gainNode: null,
      analyserBuf: null,
      makingOffer: false,
    };
    this.connections.set(peerId, bundle);

    const peerRecord = this.peers.get(peerId);
    if (peerRecord) {
      peerRecord.connectionState = 'connecting';
    }

    // Attach local audio tracks if available; otherwise add a recvonly audio transceiver
    if (this.localStream && this.localStream.getAudioTracks().length > 0) {
      this.localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    } else {
      try {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      } catch {}
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.transport.sendVoiceSignal(peerId, {
          signalType: 'ice',
          candidate: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate,
        });
      }
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams && ev.streams[0] ? ev.streams[0] : new MediaStream([ev.track]);
      this.attachRemoteAudioStream(bundle, stream);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      const rec = this.peers.get(peerId);
      if (!rec) return;
      if (state === 'connected') {
        rec.connectionState = 'connected';
        this.emit();
      } else if (state === 'connecting' || state === 'new') {
        rec.connectionState = 'connecting';
        this.emit();
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        rec.connectionState = 'idle';
        if (state === 'failed') {
          this.closePeerConnection(peerId);
          // Re-attempt connection if peer is still in voice
          if (this.connected && rec.voiceEnabled) {
            const selfId = this.transport.getSelfId();
            if (shouldInitiateVoiceOffer(selfId, peerId)) {
              setTimeout(() => {
                if (this.connected && this.peers.get(peerId)?.voiceEnabled && !this.connections.has(peerId)) {
                  void this.initiateOfferToPeer(peerId);
                }
              }, 1500);
            }
          }
        }
        this.emit();
      }
    };

    return bundle;
  }

  private attachRemoteAudioStream(bundle: PeerConnectionBundle, stream: MediaStream) {
    bundle.remoteStream = stream;

    // Create a hidden <audio> element so Chrome/Safari reliably pull audio frames from WebRTC
    if (typeof document !== 'undefined') {
      if (!bundle.audioEl) {
        const audio = document.createElement('audio');
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        audio.style.display = 'none';
        document.body.appendChild(audio);
        bundle.audioEl = audio;
      }
      bundle.audioEl.srcObject = stream;
    }

    const ctx = this.ensureAudioContext();
    if (ctx) {
      try {
        if (bundle.sourceNode) {
          bundle.sourceNode.disconnect();
        }
        if (bundle.gainNode) {
          bundle.gainNode.disconnect();
        }
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.55;
        const gain = ctx.createGain();
        source.connect(analyser);
        analyser.connect(gain);
        gain.connect(ctx.destination);

        bundle.sourceNode = source;
        bundle.analyserNode = analyser;
        bundle.gainNode = gain;
        bundle.analyserBuf = new Uint8Array(analyser.fftSize);

        // Mute the raw <audio> element when routed through Web Audio GainNode so audio isn't doubled
        if (bundle.audioEl) {
          bundle.audioEl.muted = true;
          bundle.audioEl.play().catch(() => {});
        }
      } catch {
        // Fallback to direct <audio> playback if Web Audio routing fails
        if (bundle.audioEl) {
          bundle.audioEl.muted = false;
          bundle.audioEl.play().catch(() => {});
        }
      }
    } else if (bundle.audioEl) {
      bundle.audioEl.muted = false;
      bundle.audioEl.play().catch(() => {});
    }

    this.applyPeerGain(bundle.peerId);
  }

  private computeFinalGainForPeer(peer: RemotePeerRecord): number {
    if (this.deafened || peer.locallyMuted) return 0;
    const spatial = this.spatialMode === 'proximity' ? peer.effectiveGain : 1;
    return Math.max(0, Math.min(1.5, this.masterVolume * peer.localVolume * spatial));
  }

  private applyPeerGain(peerId: string) {
    const peer = this.peers.get(peerId);
    const bundle = this.connections.get(peerId);
    if (!peer || !bundle) return;
    const finalGain = this.computeFinalGainForPeer(peer);
    if (bundle.gainNode && this.audioCtx) {
      try {
        bundle.gainNode.gain.setTargetAtTime(finalGain, this.audioCtx.currentTime, 0.03);
      } catch {
        bundle.gainNode.gain.value = finalGain;
      }
    } else if (bundle.audioEl) {
      bundle.audioEl.muted = finalGain <= 0.001;
      bundle.audioEl.volume = Math.max(0, Math.min(1, finalGain));
    }
  }

  private refreshAllRemoteGains() {
    this.connections.forEach((_, peerId) => {
      this.applyPeerGain(peerId);
    });
  }

  private async initiateOfferToPeer(peerId: string) {
    const bundle = this.createPeerConnectionBundle(peerId);
    if (!bundle || bundle.makingOffer) return;
    bundle.makingOffer = true;
    try {
      const offer = await bundle.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      if (!this.connected || !this.connections.has(peerId)) return;
      await bundle.pc.setLocalDescription(offer);
      this.transport.sendVoiceSignal(peerId, {
        signalType: 'offer',
        sdp: bundle.pc.localDescription
          ? { type: bundle.pc.localDescription.type, sdp: bundle.pc.localDescription.sdp }
          : offer,
      });
    } catch {
      this.closePeerConnection(peerId);
    } finally {
      bundle.makingOffer = false;
    }
  }

  public async handleSignal(packet: VoiceSignalPacket) {
    if (this.disposed || !this.connected) return;
    const selfId = this.transport.getSelfId();
    if (!packet || !packet.from || packet.from === selfId) return;
    if (packet.to && selfId && packet.to !== selfId) return;

    const peerId = packet.from;
    if (!this.peers.has(peerId)) {
      this.peers.set(peerId, {
        id: peerId,
        name: 'Игрок',
        voiceEnabled: true,
        voiceMuted: false,
        voiceSpeaking: false,
        localVolume: 1,
        locallyMuted: false,
        remoteLevel: 0,
        distanceMeters: null,
        effectiveGain: 1,
        connectionState: 'connecting',
      });
    } else {
      const rec = this.peers.get(peerId)!;
      rec.voiceEnabled = true;
    }

    const bundle = this.createPeerConnectionBundle(peerId);
    if (!bundle) return;

    try {
      if (packet.signalType === 'offer' && packet.sdp) {
        if (bundle.pc.signalingState !== 'stable') {
          try {
            await bundle.pc.setLocalDescription({ type: 'rollback' });
          } catch {}
        }
        await bundle.pc.setRemoteDescription(new RTCSessionDescription(packet.sdp));
        await this.flushPendingIce(bundle);
        const answer = await bundle.pc.createAnswer();
        await bundle.pc.setLocalDescription(answer);
        this.transport.sendVoiceSignal(peerId, {
          signalType: 'answer',
          sdp: bundle.pc.localDescription
            ? { type: bundle.pc.localDescription.type, sdp: bundle.pc.localDescription.sdp }
            : answer,
        });
      } else if (packet.signalType === 'answer' && packet.sdp) {
        if (bundle.pc.signalingState === 'have-local-offer') {
          await bundle.pc.setRemoteDescription(new RTCSessionDescription(packet.sdp));
          await this.flushPendingIce(bundle);
        }
      } else if (packet.signalType === 'ice' && packet.candidate) {
        if (bundle.pc.remoteDescription && bundle.pc.remoteDescription.type) {
          await bundle.pc.addIceCandidate(new RTCIceCandidate(packet.candidate));
        } else {
          bundle.pendingIce.push(packet.candidate);
        }
      }
    } catch {
      // Ignore transient signaling race errors
    }
  }

  private async flushPendingIce(bundle: PeerConnectionBundle) {
    while (bundle.pendingIce.length > 0) {
      const cand = bundle.pendingIce.shift();
      if (!cand) continue;
      try {
        await bundle.pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {}
    }
  }

  private closePeerConnection(peerId: string) {
    const bundle = this.connections.get(peerId);
    if (!bundle) return;
    this.connections.delete(peerId);
    try {
      bundle.sourceNode?.disconnect();
    } catch {}
    try {
      bundle.gainNode?.disconnect();
    } catch {}
    if (bundle.audioEl) {
      try {
        bundle.audioEl.pause();
        bundle.audioEl.srcObject = null;
        bundle.audioEl.remove();
      } catch {}
    }
    try {
      bundle.pc.onicecandidate = null;
      bundle.pc.ontrack = null;
      bundle.pc.onconnectionstatechange = null;
      bundle.pc.close();
    } catch {}
  }

  private closeAllPeerConnections() {
    Array.from(this.connections.keys()).forEach((peerId) => {
      this.closePeerConnection(peerId);
    });
    this.peers.forEach((peer) => {
      peer.connectionState = 'idle';
      peer.remoteLevel = 0;
    });
  }

  private startMeterLoop() {
    if (this.meterTimer !== null) return;
    this.meterTimer = setInterval(() => {
      if (!this.connected || this.disposed) return;
      let shouldEmit = false;
      const now = Date.now();

      // Local mic VAD
      if (this.localAnalyserNode && this.localAnalyserBuf && !this.isEffectiveMicMuted()) {
        this.localAnalyserNode.getByteTimeDomainData(this.localAnalyserBuf);
        const level = computeRmsVoiceLevel(this.localAnalyserBuf);
        if (Math.abs(level - this.localLevel) > 0.02) {
          this.localLevel = level;
          shouldEmit = true;
        }
        if (isVoiceSpeakingFromLevel(level)) {
          this.lastSpokeAt = now;
          if (!this.speaking) {
            this.speaking = true;
            this.broadcastLocalVoiceState();
            shouldEmit = true;
          }
        } else if (this.speaking && now - this.lastSpokeAt > VOICE_SPEAKING_HANGOVER_MS) {
          this.speaking = false;
          this.broadcastLocalVoiceState();
          shouldEmit = true;
        }
      } else if (this.localLevel > 0 || this.speaking) {
        this.localLevel = 0;
        this.speaking = false;
        this.broadcastLocalVoiceState();
        shouldEmit = true;
      }

      // Remote peer live audio meters
      this.connections.forEach((bundle, peerId) => {
        const peer = this.peers.get(peerId);
        if (!peer || !bundle.analyserNode || !bundle.analyserBuf) return;
        bundle.analyserNode.getByteTimeDomainData(bundle.analyserBuf);
        const rLevel = computeRmsVoiceLevel(bundle.analyserBuf);
        if (Math.abs(rLevel - peer.remoteLevel) > 0.03) {
          peer.remoteLevel = rLevel;
          shouldEmit = true;
        }
      });

      if (shouldEmit) {
        this.emit();
      }
    }, 100);
  }

  private stopMeterLoop() {
    if (this.meterTimer !== null) {
      clearInterval(this.meterTimer);
      this.meterTimer = null;
    }
  }

  public dispose() {
    this.leaveVoice();
    this.disposed = true;
    this.listeners.clear();
    if (this.audioCtx) {
      try {
        void this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
  }
}

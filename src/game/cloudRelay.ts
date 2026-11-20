interface BrokerSpec {
  url: string;
  username?: string;
  password?: string;
}

/**
 * Multi-broker WSS MQTT relay pool.
 * Includes standard port 443 (public.cloud.shiftr.io) so players behind strict mobile
 * carriers, school/home Wi-Fi, or ISP firewalls that block ports 8081/8084/8884 can still
 * play together seamlessly from standalone HTML files and web sessions.
 */
export const CLOUD_RELAY_BROKERS: BrokerSpec[] = [
  { url: 'wss://public.cloud.shiftr.io', username: 'public', password: 'public' },
  { url: 'wss://broker.emqx.io:8084/mqtt' },
  { url: 'wss://broker.hivemq.com:8884/mqtt' },
  { url: 'wss://test.mosquitto.org:8081' },
];

const TOPIC_PREFIX = 'bloxhub3d/v2';

function encodeRemainingLength(len: number): number[] {
  const bytes: number[] = [];
  let rem = len;
  do {
    let digit = rem % 128;
    rem = Math.floor(rem / 128);
    if (rem > 0) digit |= 0x80;
    bytes.push(digit);
  } while (rem > 0);
  return bytes;
}

function encodeUtf8Bytes(str: string): Uint8Array {
  const raw = new TextEncoder().encode(str);
  const out = new Uint8Array(2 + raw.length);
  out[0] = (raw.length >> 8) & 0xff;
  out[1] = raw.length & 0xff;
  out.set(raw, 2);
  return out;
}

function concatBytes(...arrays: Uint8Array[]): ArrayBuffer {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out.buffer as ArrayBuffer;
}

export function buildMqttConnectPacket(
  clientId: string,
  username?: string,
  password?: string
): ArrayBuffer {
  // MQTT v3.1.1 CONNECT packet, CleanSession=1 (0x02), KeepAlive=60s
  let flags = 0x02;
  const parts: Uint8Array[] = [encodeUtf8Bytes(clientId)];
  if (username) {
    flags |= 0x80;
    parts.push(encodeUtf8Bytes(username));
    if (password !== undefined) {
      flags |= 0x40;
      parts.push(encodeUtf8Bytes(password));
    }
  }
  const variableHeader = new Uint8Array([
    0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, flags, 0x00, 0x3c,
  ]);
  let payloadLen = 0;
  for (const p of parts) payloadLen += p.length;
  const rem = encodeRemainingLength(variableHeader.length + payloadLen);
  return concatBytes(new Uint8Array([0x10, ...rem]), variableHeader, ...parts);
}

function buildMqttSubscribePacket(topic: string, packetId: number): ArrayBuffer {
  const pid = new Uint8Array([(packetId >> 8) & 0xff, packetId & 0xff]);
  const topicBytes = encodeUtf8Bytes(topic);
  const qos = new Uint8Array([0x00]);
  const rem = encodeRemainingLength(pid.length + topicBytes.length + qos.length);
  return concatBytes(new Uint8Array([0x82, ...rem]), pid, topicBytes, qos);
}

function buildMqttUnsubscribePacket(topic: string, packetId: number): ArrayBuffer {
  const pid = new Uint8Array([(packetId >> 8) & 0xff, packetId & 0xff]);
  const topicBytes = encodeUtf8Bytes(topic);
  const rem = encodeRemainingLength(pid.length + topicBytes.length);
  return concatBytes(new Uint8Array([0xa2, ...rem]), pid, topicBytes);
}

function buildMqttPublishPacket(topic: string, jsonStr: string): ArrayBuffer {
  const topicBytes = encodeUtf8Bytes(topic);
  const msgBytes = new TextEncoder().encode(jsonStr);
  const rem = encodeRemainingLength(topicBytes.length + msgBytes.length);
  return concatBytes(new Uint8Array([0x30, ...rem]), topicBytes, msgBytes);
}

function buildMqttPingReqPacket(): ArrayBuffer {
  return new Uint8Array([0xc0, 0x00]).buffer as ArrayBuffer;
}

interface ParsedMqttFrame {
  type: number;
  topic?: string;
  payloadText?: string;
}

export function parseMqttFrames(buf: Uint8Array): ParsedMqttFrame[] {
  const frames: ParsedMqttFrame[] = [];
  const decoder = new TextDecoder('utf-8');
  let offset = 0;

  while (offset < buf.length) {
    const header = buf[offset];
    let mult = 1;
    let len = 0;
    let idx = offset + 1;
    let validLength = false;

    while (idx < buf.length) {
      const b = buf[idx++];
      len += (b & 0x7f) * mult;
      mult *= 128;
      if ((b & 0x80) === 0) {
        validLength = true;
        break;
      }
    }

    if (!validLength || idx + len > buf.length) {
      break;
    }

    const packetType = header >> 4;
    if (packetType === 3 && len >= 2) {
      const topicLen = (buf[idx] << 8) | buf[idx + 1];
      const qos = (header >> 1) & 0x03;
      const packetIdBytes = qos > 0 ? 2 : 0;
      const payloadStart = idx + 2 + topicLen + packetIdBytes;
      const packetEnd = idx + len;
      if (payloadStart <= packetEnd) {
        const topic = decoder.decode(buf.subarray(idx + 2, idx + 2 + topicLen));
        const payloadText = decoder.decode(buf.subarray(payloadStart, packetEnd));
        frames.push({ type: packetType, topic, payloadText });
      }
    } else {
      frames.push({ type: packetType });
    }

    offset = idx + len;
  }

  return frames;
}

interface BrokerLink {
  spec: BrokerSpec;
  ws: WebSocket | null;
  ready: boolean;
  subscribed: boolean;
  reconnectTimer: number | null;
  pingTimer: number | null;
  attempts: number;
}

export interface RelayEnvelope {
  mid: string;
  senderId: string;
  roomId: string;
  ts: number;
  packet: {
    type: string;
    payload?: any;
  };
}

export class CloudMultiplayerRelay {
  private selfId: string;
  private currentRoomId: string = 'doors-main';
  private onMessage: (packet: { type: string; payload?: any }, roomId: string) => void;
  private onStatusChange: (connected: boolean) => void;
  private links: BrokerLink[] = [];
  private seenMessageIds: Set<string> = new Set();
  private packetIdSeq: number = 1;
  private isDisposed: boolean = false;
  private pendingOutbound: { topic: string; json: string }[] = [];

  constructor(
    selfId: string,
    initialRoomId: string,
    onMessage: (packet: { type: string; payload?: any }, roomId: string) => void,
    onStatusChange: (connected: boolean) => void
  ) {
    this.selfId = selfId;
    this.currentRoomId = initialRoomId;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;

    if (typeof window !== 'undefined' && typeof WebSocket !== 'undefined') {
      // Connect to all brokers in parallel (including port-443) so standalone HTML works across any ISP/firewall
      for (const spec of CLOUD_RELAY_BROKERS) {
        const link: BrokerLink = {
          spec,
          ws: null,
          ready: false,
          subscribed: false,
          reconnectTimer: null,
          pingTimer: null,
          attempts: 0,
        };
        this.links.push(link);
        this.openLink(link);
      }
    }
  }

  private getRoomTopic(roomId: string): string {
    return `${TOPIC_PREFIX}/room/${roomId}`;
  }

  private getGlobalTopic(): string {
    return `${TOPIC_PREFIX}/global`;
  }

  private nextPacketId(): number {
    this.packetIdSeq = (this.packetIdSeq % 65000) + 1;
    return this.packetIdSeq;
  }

  public isConnected(): boolean {
    return this.links.some((l) => l.ready && l.ws && l.ws.readyState === WebSocket.OPEN);
  }

  private notifyStatus() {
    this.onStatusChange(this.isConnected());
  }

  private handleBinaryFrames(link: BrokerLink, bytes: Uint8Array) {
    const frames = parseMqttFrames(bytes);
    for (const frame of frames) {
      if (frame.type === 2) {
        // CONNACK received: broker session is ready; subscribe before announcing presence
        link.ready = true;
        link.subscribed = false;
        link.attempts = 0;
        this.subscribeLinkTopics(link);
        this.startLinkPing(link);
        this.flushPendingOutbound();
        this.notifyStatus();
      } else if (frame.type === 9) {
        // SUBACK received: subscription is guaranteed active on broker -> re-trigger presence discovery!
        if (!link.subscribed) {
          link.subscribed = true;
          this.flushPendingOutbound();
          this.notifyStatus();
        }
      } else if (frame.type === 3 && frame.payloadText) {
        this.handleIncomingPublish(frame.payloadText);
      }
    }
  }

  private openLink(link: BrokerLink) {
    if (this.isDisposed || typeof window === 'undefined') return;
    if (link.reconnectTimer !== null) {
      window.clearTimeout(link.reconnectTimer);
      link.reconnectTimer = null;
    }
    if (link.ws && (link.ws.readyState === WebSocket.CONNECTING || link.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    try {
      const socket = new WebSocket(link.spec.url, ['mqtt']);
      socket.binaryType = 'arraybuffer';
      link.ws = socket;
      link.ready = false;
      link.subscribed = false;

      socket.onopen = () => {
        if (this.isDisposed || link.ws !== socket) {
          try {
            socket.close();
          } catch {}
          return;
        }
        const mqttClientId = `bx_${this.selfId.replace(/[^a-zA-Z0-9]/g, '').slice(-10)}_${Math.random()
          .toString(36)
          .slice(2, 7)}`;
        try {
          socket.send(buildMqttConnectPacket(mqttClientId, link.spec.username, link.spec.password));
        } catch {
          try {
            socket.close();
          } catch {}
        }
      };

      socket.onmessage = (event) => {
        if (this.isDisposed || link.ws !== socket) return;
        if (event.data instanceof ArrayBuffer) {
          this.handleBinaryFrames(link, new Uint8Array(event.data));
        } else if (typeof Blob !== 'undefined' && event.data instanceof Blob) {
          // Compatibility fallback for older Android WebViews that ignore binaryType='arraybuffer'
          void event.data
            .arrayBuffer()
            .then((ab) => {
              if (!this.isDisposed && link.ws === socket) {
                this.handleBinaryFrames(link, new Uint8Array(ab));
              }
            })
            .catch(() => {});
        }
      };

      socket.onclose = () => {
        if (link.ws === socket) {
          link.ws = null;
          link.ready = false;
          link.subscribed = false;
        }
        this.stopLinkPing(link);
        this.notifyStatus();
        if (!this.isDisposed) {
          this.scheduleLinkReconnect(link);
        }
      };

      socket.onerror = () => {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          try {
            socket.close();
          } catch {}
        }
      };
    } catch {
      this.scheduleLinkReconnect(link);
    }
  }

  private subscribeLinkTopics(link: BrokerLink) {
    if (!link.ws || link.ws.readyState !== WebSocket.OPEN || !link.ready) return;
    try {
      link.ws.send(buildMqttSubscribePacket(this.getRoomTopic(this.currentRoomId), this.nextPacketId()));
      link.ws.send(buildMqttSubscribePacket(this.getGlobalTopic(), this.nextPacketId()));
    } catch {}
  }

  private startLinkPing(link: BrokerLink) {
    this.stopLinkPing(link);
    link.pingTimer = window.setInterval(() => {
      if (this.isDisposed || !link.ws || link.ws.readyState !== WebSocket.OPEN || !link.ready) {
        return;
      }
      try {
        link.ws.send(buildMqttPingReqPacket());
      } catch {
        try {
          link.ws.close();
        } catch {}
      }
    }, 22000);
  }

  private stopLinkPing(link: BrokerLink) {
    if (link.pingTimer !== null) {
      clearInterval(link.pingTimer);
      link.pingTimer = null;
    }
  }

  private scheduleLinkReconnect(link: BrokerLink) {
    if (this.isDisposed || link.reconnectTimer !== null) return;
    const delay = Math.min(15000, 900 * Math.pow(1.8, Math.min(link.attempts, 5)));
    link.attempts += 1;
    link.reconnectTimer = window.setTimeout(() => {
      link.reconnectTimer = null;
      this.openLink(link);
    }, delay);
  }

  private handleIncomingPublish(payloadText: string) {
    try {
      const env = JSON.parse(payloadText) as RelayEnvelope;
      if (!env || !env.mid || !env.packet || !env.packet.type) return;
      if (env.senderId === this.selfId) return;
      if (this.seenMessageIds.has(env.mid)) return;

      this.seenMessageIds.add(env.mid);
      if (this.seenMessageIds.size > 600) {
        const oldest = this.seenMessageIds.values().next().value;
        if (oldest) this.seenMessageIds.delete(oldest);
      }

      if (env.roomId && env.roomId !== '*' && env.roomId !== this.currentRoomId) {
        return;
      }

      this.onMessage(env.packet, env.roomId || this.currentRoomId);
    } catch {
      // Ignore malformed JSON
    }
  }

  public setRoom(nextRoomId: string) {
    if (nextRoomId === this.currentRoomId) return;
    const prevTopic = this.getRoomTopic(this.currentRoomId);
    this.currentRoomId = nextRoomId;
    const nextTopic = this.getRoomTopic(nextRoomId);

    for (const link of this.links) {
      if (link.ws && link.ws.readyState === WebSocket.OPEN && link.ready) {
        link.subscribed = false;
        try {
          link.ws.send(buildMqttUnsubscribePacket(prevTopic, this.nextPacketId()));
          link.ws.send(buildMqttSubscribePacket(nextTopic, this.nextPacketId()));
        } catch {}
      }
    }
  }

  public publishRoom(packet: { type: string; payload?: any }, roomIdOverride?: string) {
    const targetRoom = roomIdOverride || this.currentRoomId;
    const env: RelayEnvelope = {
      mid: `${this.selfId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      senderId: this.selfId,
      roomId: targetRoom,
      ts: Date.now(),
      packet,
    };
    this.seenMessageIds.add(env.mid);
    this.publishRaw(this.getRoomTopic(targetRoom), JSON.stringify(env));
  }

  public publishGlobal(packet: { type: string; payload?: any }) {
    const env: RelayEnvelope = {
      mid: `${this.selfId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      senderId: this.selfId,
      roomId: '*',
      ts: Date.now(),
      packet,
    };
    this.seenMessageIds.add(env.mid);
    this.publishRaw(this.getGlobalTopic(), JSON.stringify(env));
  }

  private publishRaw(topic: string, jsonStr: string) {
    let sentAny = false;
    const frame = buildMqttPublishPacket(topic, jsonStr);
    for (const link of this.links) {
      if (link.ws && link.ws.readyState === WebSocket.OPEN && link.ready) {
        try {
          link.ws.send(frame);
          sentAny = true;
        } catch {}
      }
    }
    if (!sentAny) {
      this.pendingOutbound.push({ topic, json: jsonStr });
      if (this.pendingOutbound.length > 25) {
        this.pendingOutbound.shift();
      }
    }
  }

  private flushPendingOutbound() {
    if (this.pendingOutbound.length === 0) return;
    const batch = this.pendingOutbound.splice(0, this.pendingOutbound.length);
    for (const item of batch) {
      this.publishRaw(item.topic, item.json);
    }
  }

  public reconnectNow() {
    for (const link of this.links) {
      if (!link.ws || link.ws.readyState !== WebSocket.OPEN) {
        link.attempts = 0;
        this.openLink(link);
      }
    }
  }

  public dispose() {
    this.isDisposed = true;
    for (const link of this.links) {
      this.stopLinkPing(link);
      if (link.reconnectTimer !== null) {
        clearTimeout(link.reconnectTimer);
        link.reconnectTimer = null;
      }
      if (link.ws) {
        try {
          link.ws.close();
        } catch {}
        link.ws = null;
        link.ready = false;
        link.subscribed = false;
      }
    }
  }
}

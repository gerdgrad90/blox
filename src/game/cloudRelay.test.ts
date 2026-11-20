import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOUD_RELAY_BROKERS,
  buildMqttConnectPacket,
  parseMqttFrames,
} from './cloudRelay';
import {
  isStandaloneHtmlRuntime,
  isFileProtocol,
  getEmbeddedInviteConfig,
} from './env';

describe('CloudMultiplayerRelay MQTT framing & broker pool', () => {
  it('includes a standard port-443 WSS broker plus fallback brokers', () => {
    assert.ok(CLOUD_RELAY_BROKERS.length >= 4);
    const hasPort443 = CLOUD_RELAY_BROKERS.some((b) => {
      const parsed = new URL(b.url);
      return parsed.protocol === 'wss:' && (parsed.port === '' || parsed.port === '443');
    });
    assert.equal(hasPort443, true, 'Must include at least one port-443 WSS broker');
  });

  it('builds valid anonymous MQTT 3.1.1 CONNECT packet (flags 0x02)', () => {
    const buf = new Uint8Array(buildMqttConnectPacket('bx_test1'));
    assert.equal(buf[0], 0x10); // CONNECT
    // Variable header: 00 04 M Q T T 04 flags 00 3c
    assert.equal(buf[4], 0x4d); // 'M'
    assert.equal(buf[8], 0x04); // protocol level 4 (MQTT 3.1.1)
    assert.equal(buf[9], 0x02); // CleanSession=1, no user/pass
    const decodedClientId = new TextDecoder().decode(buf.slice(14));
    assert.equal(decodedClientId, 'bx_test1');
  });

  it('builds valid authenticated MQTT 3.1.1 CONNECT packet (flags 0xC2)', () => {
    const buf = new Uint8Array(buildMqttConnectPacket('bx_test2', 'public', 'public'));
    assert.equal(buf[0], 0x10);
    assert.equal(buf[9], 0xc2); // CleanSession + Username + Password
    const tail = new TextDecoder().decode(buf.slice(12));
    assert.ok(tail.includes('bx_test2'));
    assert.ok(tail.includes('public'));
  });

  it('parses CONNACK, SUBACK, and PUBLISH frames from a single chunk', () => {
    const topic = new TextEncoder().encode('bloxhub3d/v2/room/room-SIS777');
    const payload = new TextEncoder().encode('{"type":"player:joined","id":"p1"}');
    const pubRemLen = 2 + topic.length + payload.length;
    const combined = new Uint8Array([
      // CONNACK (type 2)
      0x20, 0x02, 0x00, 0x00,
      // SUBACK (type 9)
      0x90, 0x03, 0x00, 0x01, 0x00,
      // PUBLISH QoS 0 (type 3)
      0x30, pubRemLen, (topic.length >> 8) & 0xff, topic.length & 0xff,
      ...topic,
      ...payload,
    ]);

    const frames = parseMqttFrames(combined);
    assert.equal(frames.length, 3);
    assert.equal(frames[0].type, 2);
    assert.equal(frames[1].type, 9);
    assert.equal(frames[2].type, 3);
    assert.equal(frames[2].topic, 'bloxhub3d/v2/room/room-SIS777');
    assert.equal(frames[2].payloadText, '{"type":"player:joined","id":"p1"}');
  });
});

describe('Standalone HTML environment detection & embedded invites', () => {
  it('detects standalone HTML via __BLOX_STANDALONE_HTML__ flag even over http:', () => {
    const prevWindow = (globalThis as any).window;
    try {
      (globalThis as any).window = {
        location: { protocol: 'http:' },
        __BLOX_STANDALONE_HTML__: true,
        __BLOX_INVITE_CONFIG__: { mode: 'lan_room', gameId: 'obby', roomId: 'SIS777' },
      };
      assert.equal(isStandaloneHtmlRuntime(), true);
      assert.equal(isFileProtocol(), true);
      assert.deepEqual(getEmbeddedInviteConfig(), {
        mode: 'lan_room',
        gameId: 'obby',
        roomId: 'SIS777',
      });
    } finally {
      (globalThis as any).window = prevWindow;
    }
  });

  it('detects file:, content:, and blob: protocols as standalone HTML', () => {
    const prevWindow = (globalThis as any).window;
    try {
      for (const proto of ['file:', 'content:', 'blob:']) {
        (globalThis as any).window = { location: { protocol: proto } };
        assert.equal(isStandaloneHtmlRuntime(), true, `Expected ${proto} to be standalone`);
      }
      (globalThis as any).window = { location: { protocol: 'https:' } };
      assert.equal(isStandaloneHtmlRuntime(), false);
    } finally {
      (globalThis as any).window = prevWindow;
    }
  });

  it('resolves default public room when embedded invite specifies online gameId only', () => {
    const prevWindow = (globalThis as any).window;
    try {
      (globalThis as any).window = {
        location: { protocol: 'file:' },
        __BLOX_INVITE_CONFIG__: { mode: 'online', gameId: 'lava_survival' },
      };
      assert.deepEqual(getEmbeddedInviteConfig(), {
        mode: 'online',
        gameId: 'lava_survival',
        roomId: 'public_lava',
      });
    } finally {
      (globalThis as any).window = prevWindow;
    }
  });
});

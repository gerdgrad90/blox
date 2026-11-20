import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  VoiceChatManager,
  computeProximityVoiceGain,
  computeRmsVoiceLevel,
  isVoiceSpeakingFromLevel,
  shouldInitiateVoiceOffer,
  VOICE_PROXIMITY_MAX_DISTANCE,
  VOICE_PROXIMITY_MIN_DISTANCE,
} from './voice';

describe('Voice Chat pure helpers', () => {
  it('shouldInitiateVoiceOffer is deterministic and anti-symmetric to prevent offer glare', () => {
    assert.equal(shouldInitiateVoiceOffer('player_a', 'player_b'), true);
    assert.equal(shouldInitiateVoiceOffer('player_b', 'player_a'), false);
    assert.equal(shouldInitiateVoiceOffer('player_a', 'player_a'), false);
    assert.equal(shouldInitiateVoiceOffer('', 'player_b'), false);
    assert.equal(shouldInitiateVoiceOffer('player_a', ''), false);
  });

  it('computeProximityVoiceGain returns 1.0 in global room mode regardless of distance', () => {
    assert.equal(computeProximityVoiceGain([0, 0, 0], [500, 100, -300], 'room'), 1);
    assert.equal(computeProximityVoiceGain(null, [10, 0, 0], 'room'), 1);
  });

  it('computeProximityVoiceGain smoothly attenuates by 3D distance in proximity mode', () => {
    const close = computeProximityVoiceGain([0, 0, 0], [3, 0, 0], 'proximity');
    assert.equal(close, 1);

    const atMin = computeProximityVoiceGain([0, 0, 0], [VOICE_PROXIMITY_MIN_DISTANCE, 0, 0], 'proximity');
    assert.equal(atMin, 1);

    const midDist = (VOICE_PROXIMITY_MIN_DISTANCE + VOICE_PROXIMITY_MAX_DISTANCE) / 2;
    const mid = computeProximityVoiceGain([0, 0, 0], [midDist, 0, 0], 'proximity');
    assert.ok(mid > 0.15 && mid < 0.7, `Expected smooth mid gain, got ${mid}`);

    const far = computeProximityVoiceGain([0, 0, 0], [VOICE_PROXIMITY_MAX_DISTANCE + 5, 0, 0], 'proximity');
    assert.equal(far, 0);
  });

  it('computeRmsVoiceLevel and isVoiceSpeakingFromLevel distinguish silence from active speech', () => {
    const silence = new Uint8Array(64).fill(128);
    const silenceLevel = computeRmsVoiceLevel(silence);
    assert.equal(silenceLevel, 0);
    assert.equal(isVoiceSpeakingFromLevel(silenceLevel), false);

    const loud = new Uint8Array(64);
    for (let i = 0; i < loud.length; i++) {
      loud[i] = i % 2 === 0 ? 190 : 66;
    }
    const loudLevel = computeRmsVoiceLevel(loud);
    assert.ok(loudLevel > 0.4, `Expected loud level > 0.4, got ${loudLevel}`);
    assert.equal(isVoiceSpeakingFromLevel(loudLevel), true);
  });
});

describe('VoiceChatManager state & signaling orchestration', () => {
  it('joins in listen-only mode when no mic API exists, broadcasts state, and tracks remote peers', async () => {
    const sentStates: Array<{ enabled: boolean; muted: boolean; speaking: boolean }> = [];
    const manager = new VoiceChatManager(
      {
        getSelfId: () => 'client_a',
        sendVoiceState: (s) => sentStates.push(s),
        sendVoiceSignal: () => {},
      },
      'TestHero'
    );

    manager.syncRoomPeers([
      { id: 'client_b', name: 'FriendOne', voiceEnabled: true, voiceMuted: false, voiceSpeaking: true },
      { id: 'client_c', name: 'SilentTwo', voiceEnabled: false, voiceMuted: true, voiceSpeaking: false },
    ]);

    assert.equal(manager.getSnapshot().remoteVoiceCount, 1);
    assert.equal(manager.getSnapshot().connected, false);

    const joined = await manager.joinVoice();
    assert.equal(joined, true);

    const snap = manager.getSnapshot();
    assert.equal(snap.connected, true);
    assert.equal(snap.listenOnly, true);
    assert.equal(snap.participants.length, 2);
    assert.ok(sentStates.some((s) => s.enabled === true));

    // Toggle deafen, spatial mode, input mode, master volume, and per-peer mute/volume
    manager.setDeafened(true);
    assert.equal(manager.getSnapshot().deafened, true);
    manager.setDeafened(false);

    manager.setInputMode('ptt');
    assert.equal(manager.getSnapshot().inputMode, 'ptt');
    manager.setPushToTalkActive(true);
    assert.equal(manager.getSnapshot().pttActive, true);
    manager.setPushToTalkActive(false);
    assert.equal(manager.getSnapshot().pttActive, false);

    manager.setSpatialMode('proximity');
    assert.equal(manager.getSnapshot().spatialMode, 'proximity');

    const remotePositions = new Map<string, [number, number, number]>([
      ['client_b', [24, 0, 0]],
    ]);
    manager.updateSpatialPositions([0, 0, 0], remotePositions);
    const friendSnap = manager.getSnapshot().participants.find((p) => p.id === 'client_b');
    assert.ok(friendSnap);
    assert.equal(friendSnap.distanceMeters, 24);
    assert.ok(friendSnap.effectiveGain > 0 && friendSnap.effectiveGain < 1);

    manager.togglePeerMute('client_b');
    assert.equal(
      manager.getSnapshot().participants.find((p) => p.id === 'client_b')?.locallyMuted,
      true
    );

    manager.setPeerVolume('client_b', 1.25);
    assert.equal(
      manager.getSnapshot().participants.find((p) => p.id === 'client_b')?.volume,
      1.25
    );

    // Remote peer leaves voice
    manager.handleRemoteVoiceState({ id: 'client_b', enabled: false, muted: true, speaking: false });
    assert.equal(manager.getSnapshot().remoteVoiceCount, 0);
    assert.equal(manager.getSnapshot().participants.length, 1);

    // Leave voice and verify broadcast
    manager.leaveVoice();
    assert.equal(manager.getSnapshot().connected, false);
    assert.equal(sentStates[sentStates.length - 1]?.enabled, false);

    manager.dispose();
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkAABBIntersection,
  getPlayerSpeed,
  getPlayerJumpForce,
  getPlayerGravity,
  isItemCollected,
  evaluateCheckpoints,
  snapToGrid,
  hasFallenIntoVoid,
  calculateFinalScore,
  normalizeJoystickVector,
  sanitizeRoomCode,
  BASE_RUN_SPEED,
  SPEED_COIL_MULTIPLIER,
  BASE_JUMP_FORCE,
  GRAVITY_COIL_JUMP_FORCE,
} from './rules';
import { Checkpoint } from './types';

test('AABB intersection detects overlapping bounding boxes', () => {
  const boxA = { minX: 0, maxX: 2, minY: 0, maxY: 2, minZ: 0, maxZ: 2 };
  const boxB = { minX: 1, maxX: 3, minY: 1, maxY: 3, minZ: 1, maxZ: 3 };
  assert.equal(checkAABBIntersection(boxA, boxB), true);

  const boxC = { minX: 5, maxX: 7, minY: 0, maxY: 2, minZ: 0, maxZ: 2 };
  assert.equal(checkAABBIntersection(boxA, boxC), false);
});

test('Speed Coil gives speed multiplier', () => {
  assert.equal(getPlayerSpeed('sword'), BASE_RUN_SPEED);
  assert.equal(getPlayerSpeed('speed_coil'), BASE_RUN_SPEED * SPEED_COIL_MULTIPLIER);
  assert.ok(getPlayerSpeed('speed_coil') > BASE_RUN_SPEED);
});

test('Gravity Coil enhances jump and lowers gravity', () => {
  assert.equal(getPlayerJumpForce('sword'), BASE_JUMP_FORCE);
  assert.equal(getPlayerJumpForce('gravity_coil'), GRAVITY_COIL_JUMP_FORCE);
  assert.ok(getPlayerJumpForce('gravity_coil') > BASE_JUMP_FORCE);

  assert.ok(getPlayerGravity('gravity_coil') > getPlayerGravity('sword')); // Less negative
});

test('Item collection checks Euclidean proximity', () => {
  const player: [number, number, number] = [0, 1, 0];
  const closeCoin: [number, number, number] = [0.5, 1, 0.5];
  const farCoin: [number, number, number] = [10, 1, 10];

  assert.equal(isItemCollected(player, closeCoin, 2.0), true);
  assert.equal(isItemCollected(player, farCoin, 2.0), false);
});

test('Checkpoint progression advances to higher checkpoint IDs only', () => {
  const checkpoints: Checkpoint[] = [
    { id: 0, name: 'Spawn', position: [0, 0, 0], activated: true },
    { id: 1, name: 'Neon Run', position: [0, 0, 20], activated: false },
    { id: 2, name: 'Lava Tower', position: [0, 0, 40], activated: false },
  ];

  // Near checkpoint 1
  const result1 = evaluateCheckpoints([0, 0, 20.5], checkpoints, 0);
  assert.equal(result1.updatedId, 1);
  assert.equal(result1.newlyActivated, true);

  // Near checkpoint 0 while already at 1 -> should stay 1
  const result2 = evaluateCheckpoints([0, 0, 0.5], checkpoints, 1);
  assert.equal(result2.updatedId, 1);
  assert.equal(result2.newlyActivated, false);
});

test('Grid snapping aligns to stud grid', () => {
  assert.equal(snapToGrid(2.3, 2.0), 2.0);
  assert.equal(snapToGrid(3.2, 2.0), 4.0);
  assert.equal(snapToGrid(0.9, 2.0), 0.0);
});

test('Void detection triggers below Y threshold', () => {
  assert.equal(hasFallenIntoVoid(5.0), false);
  assert.equal(hasFallenIntoVoid(0.0), false);
  assert.equal(hasFallenIntoVoid(-16.0), true);
});

test('Final score calculation awards points and bonuses', () => {
  const score = calculateFinalScore(10, 2, 60, 1);
  // 10 * 50 = 500
  // 2 * 250 = 500
  // 3000 - 60 * 15 = 2100
  // -100 death
  // Total: 3000
  assert.equal(score, 3000);
});

test('normalizeJoystickVector clamps and applies deadzone', () => {
  // Inside deadzone
  const small = normalizeJoystickVector(2, 1, 50, 0.12);
  assert.equal(small.active, false);
  assert.equal(small.x, 0);
  assert.equal(small.y, 0);

  // Full right push beyond maxRadius
  const fullRight = normalizeJoystickVector(80, 0, 50, 0.12);
  assert.equal(fullRight.active, true);
  assert.equal(fullRight.x, 1);
  assert.equal(fullRight.y, 0);
  assert.equal(fullRight.clampedDx, 50);

  // Full upward push (negative dy on screen)
  const fullUp = normalizeJoystickVector(0, -100, 50, 0.12);
  assert.equal(fullUp.active, true);
  assert.equal(fullUp.x, 0);
  assert.equal(fullUp.y, -1);
  assert.equal(fullUp.clampedDy, -50);
});

test('sanitizeRoomCode uppercases and strips invalid characters', () => {
  assert.equal(sanitizeRoomCode('  obby-123!@# '), 'OBBY-123');
  assert.equal(sanitizeRoomCode(''), 'OBBY777');
  assert.equal(sanitizeRoomCode('verylongroomcode123456'), 'VERYLONGROOM');
});

test('Jetpack Boost and Bloxy Cola tools enhance player mobility', () => {
  assert.ok(getPlayerSpeed('jetpack_boost') > BASE_RUN_SPEED);
  assert.ok(getPlayerSpeed('bloxy_cola') > BASE_RUN_SPEED);
  assert.ok(getPlayerJumpForce('jetpack_boost') > BASE_JUMP_FORCE);
  assert.ok(getPlayerGravity('jetpack_boost') > getPlayerGravity('sword'));
});




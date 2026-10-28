/**
 * Pure Game Rules & Physics calculations decoupled from Three.js and React.
 * Can be verified with node:test.
 */

import { Checkpoint, CollectibleItem, ToolType } from './types';

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface PlayerPhysicsState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  isGrounded: boolean;
  activeTool: ToolType;
}

export const BASE_RUN_SPEED = 12.0;
export const SPEED_COIL_MULTIPLIER = 1.85;
export const BASE_JUMP_FORCE = 13.5;
export const GRAVITY_COIL_JUMP_FORCE = 20.0;
export const BASE_GRAVITY = -32.0;
export const GRAVITY_COIL_GRAVITY = -14.0;
export const VOID_KILL_Y = -15.0;

/**
 * Checks if two axis-aligned bounding boxes intersect.
 */
export function checkAABBIntersection(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.minX <= b.maxX &&
    a.maxX >= b.minX &&
    a.minY <= b.maxY &&
    a.maxY >= b.minY &&
    a.minZ <= b.maxZ &&
    a.maxZ >= b.minZ
  );
}

/**
 * Calculates current movement speed based on equipped tool.
 */
export function getPlayerSpeed(tool: ToolType): number {
  if (tool === 'speed_coil') {
    return BASE_RUN_SPEED * SPEED_COIL_MULTIPLIER;
  }
  if (tool === 'jetpack_boost') {
    return BASE_RUN_SPEED * 1.45;
  }
  if (tool === 'bloxy_cola') {
    return BASE_RUN_SPEED * 1.35;
  }
  return BASE_RUN_SPEED;
}

/**
 * Calculates jump impulse force based on equipped tool.
 */
export function getPlayerJumpForce(tool: ToolType): number {
  if (tool === 'gravity_coil') {
    return GRAVITY_COIL_JUMP_FORCE;
  }
  if (tool === 'jetpack_boost') {
    return 18.5;
  }
  if (tool === 'bloxy_cola') {
    return 15.5;
  }
  return BASE_JUMP_FORCE;
}

/**
 * Calculates gravity acceleration based on equipped tool.
 */
export function getPlayerGravity(tool: ToolType): number {
  if (tool === 'gravity_coil') {
    return GRAVITY_COIL_GRAVITY;
  }
  if (tool === 'jetpack_boost') {
    return -18.0;
  }
  return BASE_GRAVITY;
}

/**
 * Calculates if player collected an item based on Euclidean distance threshold.
 */
export function isItemCollected(
  playerPos: [number, number, number],
  itemPos: [number, number, number],
  pickupRadius: number = 2.0
): boolean {
  const dx = playerPos[0] - itemPos[0];
  const dy = playerPos[1] - itemPos[1];
  const dz = playerPos[2] - itemPos[2];
  return dx * dx + dy * dy + dz * dz <= pickupRadius * pickupRadius;
}

/**
 * Checks and updates checkpoint activation.
 */
export function evaluateCheckpoints(
  playerPos: [number, number, number],
  checkpoints: Checkpoint[],
  currentActiveId: number,
  activationRadius: number = 2.8
): { updatedId: number; newlyActivated: boolean } {
  let highestActivated = currentActiveId;
  let newlyActivated = false;

  for (const cp of checkpoints) {
    const dx = playerPos[0] - cp.position[0];
    const dy = playerPos[1] - cp.position[1];
    const dz = playerPos[2] - cp.position[2];
    const distSq = dx * dx + dy * dy + dz * dz;

    if (distSq <= activationRadius * activationRadius) {
      if (cp.id > highestActivated) {
        highestActivated = cp.id;
        newlyActivated = true;
      }
    }
  }

  return { updatedId: highestActivated, newlyActivated };
}

/**
 * Snaps a 3D coordinate to a grid (e.g. for Roblox building studs).
 */
export function snapToGrid(val: number, gridSize: number = 2.0): number {
  return Math.round(val / gridSize) * gridSize;
}

/**
 * Check if player has fallen into the void.
 */
export function hasFallenIntoVoid(y: number): boolean {
  return y < VOID_KILL_Y;
}

/**
 * Calculate final completion score.
 */
export function calculateFinalScore(
  coins: number,
  gems: number,
  timeSeconds: number,
  deaths: number
): number {
  const coinPoints = coins * 50;
  const gemPoints = gems * 250;
  const timeBonus = Math.max(0, Math.floor(3000 - timeSeconds * 15));
  const deathPenalty = deaths * 100;
  return Math.max(100, coinPoints + gemPoints + timeBonus - deathPenalty);
}

/**
 * Normalizes touch joystick displacement into [-1, 1] axes with deadzone and circular clamping.
 */
export function normalizeJoystickVector(
  dx: number,
  dy: number,
  maxRadius: number = 50,
  deadzone: number = 0.12
): { x: number; y: number; clampedDx: number; clampedDy: number; active: boolean } {
  if (maxRadius <= 0) {
    return { x: 0, y: 0, clampedDx: 0, clampedDy: 0, active: false };
  }
  const dist = Math.hypot(dx, dy);
  if (dist === 0) {
    return { x: 0, y: 0, clampedDx: 0, clampedDy: 0, active: false };
  }

  const clampedDist = Math.min(dist, maxRadius);
  const scale = clampedDist / dist;
  const clampedDx = dx * scale;
  const clampedDy = dy * scale;

  const normMag = clampedDist / maxRadius;
  if (normMag < deadzone) {
    return { x: 0, y: 0, clampedDx, clampedDy, active: false };
  }

  // Rescale magnitude smoothly outside deadzone
  const effectiveMag = (normMag - deadzone) / (1 - deadzone);
  const dirX = dx / dist;
  const dirY = dy / dist;

  return {
    x: Number((dirX * effectiveMag).toFixed(4)),
    y: Number((dirY * effectiveMag).toFixed(4)),
    clampedDx,
    clampedDy,
    active: true,
  };
}

/**
 * Sanitizes a user-entered room code for local/LAN multiplayer rooms.
 */
export function sanitizeRoomCode(rawCode: string, fallback: string = 'OBBY777'): string {
  const cleaned = String(rawCode || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 12);
  return cleaned.length > 0 ? cleaned : fallback;
}



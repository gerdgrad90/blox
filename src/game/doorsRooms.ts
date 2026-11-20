import * as THREE from 'three';
import { DOORS_ROOMS_ATLAS, DoorsRoomDefinition, SurfaceType } from './types';

function createSignTexture(
  text: string,
  opts: { bg: string; fg: string; border?: string; font?: string; width?: number; height?: number }
): THREE.CanvasTexture {
  const w = opts.width || 512;
  const h = opts.height || 160;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = opts.bg;
  ctx.fillRect(0, 0, w, h);

  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
  }

  ctx.fillStyle = opts.fg;
  ctx.font = opts.font || '900 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCheckeredTileTexture(c1: string, c2: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = c1;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = c2;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillRect(64, 64, 64, 64);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 64, 64);
  ctx.strokeRect(64, 64, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 36);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const roomTitleMaterialCache = new Map<string, THREE.Material>();

function getRoomBannerMaterial(title: string): THREE.Material {
  if (roomTitleMaterialCache.has(title)) {
    return roomTitleMaterialCache.get(title)!;
  }
  const tex = createSignTexture(title, {
    bg: '#1c120c',
    fg: '#fcd34d',
    border: '#b45309',
    font: '900 34px sans-serif',
    width: 640,
    height: 120,
  });
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.35,
    metalness: 0.4,
    emissive: 0x451a03,
    emissiveIntensity: 0.45,
  });
  roomTitleMaterialCache.set(title, mat);
  return mat;
}

interface DoorsSharedMaterials {
  mahogany: THREE.MeshStandardMaterial;
  darkOak: THREE.MeshStandardMaterial;
  darkWood: THREE.MeshStandardMaterial;
  plankWood: THREE.MeshStandardMaterial;
  crate: THREE.MeshStandardMaterial;
  greenDiamondWall: THREE.MeshStandardMaterial;
  redDiamondWall: THREE.MeshStandardMaterial;
  navyWall: THREE.MeshStandardMaterial;
  charredWall: THREE.MeshStandardMaterial;
  tealWall: THREE.MeshStandardMaterial;
  brickWall: THREE.MeshStandardMaterial;
  infirmaryWall: THREE.MeshStandardMaterial;
  riftWall: THREE.MeshStandardMaterial;
  stoneWall: THREE.MeshStandardMaterial;
  goldTrim: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  warmGlass: THREE.MeshStandardMaterial;
  warmSconce: THREE.MeshStandardMaterial;
  velvetRed: THREE.MeshStandardMaterial;
  suitcase: THREE.MeshStandardMaterial;
  foliage: THREE.MeshStandardMaterial;
  vineGreen: THREE.MeshStandardMaterial;
  pot: THREE.MeshStandardMaterial;
  clawGlow: THREE.MeshStandardMaterial;
  greenBaize: THREE.MeshStandardMaterial;
  ironMetal: THREE.MeshStandardMaterial;
  mattress: THREE.MeshStandardMaterial;
  herbGlow: THREE.MeshStandardMaterial;
  riftCyan: THREE.MeshBasicMaterial;
  riftBlue: THREE.MeshStandardMaterial;
  skull: THREE.MeshStandardMaterial;
  stoneStatue: THREE.MeshStandardMaterial;
  glassRoof: THREE.MeshStandardMaterial;
  bookRed: THREE.MeshStandardMaterial;
  bookBlue: THREE.MeshStandardMaterial;
  bookGold: THREE.MeshStandardMaterial;
  bookGreen: THREE.MeshStandardMaterial;
  clockFace: THREE.MeshStandardMaterial;
  humansSign: THREE.MeshStandardMaterial;
  jeffSign: THREE.MeshStandardMaterial;
  darkAlcove: THREE.MeshBasicMaterial;
  whiteGlow: THREE.MeshBasicMaterial;
  snareMat: THREE.MeshStandardMaterial;
  infirmaryFloor: THREE.MeshStandardMaterial;
  bulbColors: THREE.MeshBasicMaterial[];
  blueCandle: THREE.MeshBasicMaterial;
  amberWindow: THREE.MeshStandardMaterial;
}

let cachedMats: DoorsSharedMaterials | null = null;

function getSharedDoorsMats(): DoorsSharedMaterials {
  if (cachedMats) return cachedMats;

  const humansTex = createSignTexture('◄ HUMANS', {
    bg: '#78350f',
    fg: '#1c1917',
    border: '#451a03',
    font: '900 54px monospace',
  });
  const jeffTex = createSignTexture('JEFF SHOP', {
    bg: '#5c2d0c',
    fg: '#fef3c7',
    border: '#3b1f0e',
    font: '900 58px monospace',
  });

  cachedMats = {
    mahogany: new THREE.MeshStandardMaterial({ color: 0x4a2511, roughness: 0.55, metalness: 0.1 }),
    darkOak: new THREE.MeshStandardMaterial({ color: 0x2b1508, roughness: 0.7 }),
    darkWood: new THREE.MeshStandardMaterial({ color: 0x3b1f0e, roughness: 0.65 }),
    plankWood: new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 }),
    crate: new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.75 }),
    greenDiamondWall: new THREE.MeshStandardMaterial({ color: 0x163024, roughness: 0.85 }),
    redDiamondWall: new THREE.MeshStandardMaterial({ color: 0x6b1d24, roughness: 0.82 }),
    navyWall: new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.82 }),
    charredWall: new THREE.MeshStandardMaterial({ color: 0x271916, roughness: 0.92 }),
    tealWall: new THREE.MeshStandardMaterial({ color: 0x11423e, roughness: 0.8 }),
    brickWall: new THREE.MeshStandardMaterial({ color: 0x5c2618, roughness: 0.9 }),
    infirmaryWall: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.65 }),
    riftWall: new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.7, emissive: 0x0c1938, emissiveIntensity: 0.35 }),
    stoneWall: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 }),
    goldTrim: new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35, metalness: 0.75 }),
    brass: new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.25,
      metalness: 0.88,
      emissive: 0x78350f,
      emissiveIntensity: 0.25,
    }),
    warmGlass: new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    }),
    warmSconce: new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.4,
    }),
    velvetRed: new THREE.MeshStandardMaterial({ color: 0x9f1239, roughness: 0.78 }),
    suitcase: new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.65 }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.78 }),
    vineGreen: new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.65,
      emissive: 0x052e16,
      emissiveIntensity: 0.3,
    }),
    pot: new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.7 }),
    clawGlow: new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 1.1,
      roughness: 0.35,
    }),
    greenBaize: new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 }),
    ironMetal: new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.78, roughness: 0.35 }),
    mattress: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.7 }),
    herbGlow: new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      emissive: 0x22c55e,
      emissiveIntensity: 1.1,
    }),
    riftCyan: new THREE.MeshBasicMaterial({ color: 0x67e8f9 }),
    riftBlue: new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.6,
    }),
    skull: new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.6,
    }),
    stoneStatue: new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.6 }),
    glassRoof: new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.28,
      roughness: 0.12,
      metalness: 0.2,
    }),
    bookRed: new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.7 }),
    bookBlue: new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.7 }),
    bookGold: new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.55 }),
    bookGreen: new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.7 }),
    clockFace: new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.3, emissive: 0x78350f, emissiveIntensity: 0.25 }),
    humansSign: new THREE.MeshStandardMaterial({ map: humansTex, roughness: 0.7 }),
    jeffSign: new THREE.MeshStandardMaterial({ map: jeffTex, roughness: 0.65, emissive: 0x451a03, emissiveIntensity: 0.25 }),
    darkAlcove: new THREE.MeshBasicMaterial({ color: 0x050507 }),
    whiteGlow: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    snareMat: new THREE.MeshStandardMaterial({ color: 0x14532d, emissive: 0x052e16, emissiveIntensity: 0.35, roughness: 0.85 }),
    infirmaryFloor: new THREE.MeshStandardMaterial({ map: createCheckeredTileTexture('#cbd5e1', '#94a3b8'), roughness: 0.45 }),
    bulbColors: [0xef4444, 0x22c55e, 0x3b82f6, 0xfacc15, 0xec4899].map(
      (c) => new THREE.MeshBasicMaterial({ color: c })
    ),
    blueCandle: new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
    amberWindow: new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.95,
      roughness: 0.25,
    }),
  };

  return cachedMats;
}

export function getDoorsRoomDefByDoorNumber(doorNumber: number): DoorsRoomDefinition {
  const clamped = Math.max(0, Math.min(100, Math.floor(doorNumber)));
  for (const def of DOORS_ROOMS_ATLAS) {
    if (clamped >= def.startDoor && clamped <= def.endDoor) {
      return def;
    }
  }
  return DOORS_ROOMS_ATLAS[1];
}

export function getDoorsRoomDefByZ(z: number, roomLength: number = 12): DoorsRoomDefinition {
  if (z < 0.8) {
    return DOORS_ROOMS_ATLAS[0]; // ЛИФТ
  }
  if (z >= 100 * roomLength - 0.5) {
    return DOORS_ROOMS_ATLAS[DOORS_ROOMS_ATLAS.length - 1]; // ЭЛЕКТРОЩИТОВАЯ
  }
  const doorNum = Math.max(1, Math.min(100, Math.floor(z / roomLength) + 1));
  return getDoorsRoomDefByDoorNumber(doorNum);
}

/**
 * Builds the starter wooden Elevator (ЛИФТ) at z = -8..0 and Reception Lobby (СТОЙКА АДМИНИСТРАТОРА) at z = 0..12
 */
export function buildStarterElevatorAndReception(
  worldRoot: THREE.Group,
  addPlatform: (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    surface?: SurfaceType
  ) => THREE.Mesh
) {
  const m = getSharedDoorsMats();

  // ============================================================================
  // 1. ЛИФТ (Starter Wooden Elevator Cab at z = -8.0 .. 0.0)
  // ============================================================================
  const elevGroup = new THREE.Group();
  elevGroup.name = 'DoorsStarterElevator';

  addPlatform(0, -1, -4.0, 6.4, 1.0, 8.0, m.mahogany, 'wood');
  const elevCeiling = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.5, 8.0), m.darkOak);
  elevCeiling.position.set(0, 7.6, -4.0);
  elevGroup.add(elevCeiling);

  addPlatform(0, 0, -7.8, 6.4, 7.8, 0.5, m.mahogany, 'wood');
  addPlatform(-3.1, 0, -4.0, 0.5, 7.8, 7.8, m.mahogany, 'wood');
  addPlatform(3.1, 0, -4.0, 0.5, 7.8, 7.8, m.mahogany, 'wood');

  const railBack = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.14, 0.14), m.brass);
  railBack.position.set(0, 2.8, -7.45);
  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 6.8), m.brass);
  railL.position.set(-2.75, 2.8, -4.0);
  const railR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 6.8), m.brass);
  railR.position.set(2.75, 2.8, -4.0);
  elevGroup.add(railBack, railL, railR);

  addPlatform(-4.6, 0, -0.2, 4.2, 9.5, 0.6, m.greenDiamondWall);
  addPlatform(4.6, 0, -0.2, 4.2, 9.5, 0.6, m.greenDiamondWall);

  const elevFrameL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 6.8, 0.8), m.mahogany);
  elevFrameL.position.set(-2.35, 3.4, -0.1);
  const elevFrameR = new THREE.Mesh(new THREE.BoxGeometry(0.45, 6.8, 0.8), m.mahogany);
  elevFrameR.position.set(2.35, 3.4, -0.1);
  const elevHeader = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.5, 0.85), m.mahogany);
  elevHeader.position.set(0, 6.9, -0.1);
  elevGroup.add(elevFrameL, elevFrameR, elevHeader);

  const transomArch = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 0.25, 16, 1, false, 0, Math.PI),
    m.warmGlass
  );
  transomArch.rotation.z = -Math.PI / 2;
  transomArch.rotation.y = Math.PI / 2;
  transomArch.position.set(0, 7.4, 0.15);
  elevGroup.add(transomArch);

  const callPlate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.1, 0.12), m.mahogany);
  callPlate.position.set(2.85, 3.3, 0.2);
  const btnUp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), m.brass);
  btnUp.position.set(2.85, 3.52, 0.26);
  const btnDown = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), m.brass);
  btnDown.position.set(2.85, 3.08, 0.26);
  elevGroup.add(callPlate, btnUp, btnDown);

  const chairGroup = new THREE.Group();
  chairGroup.position.set(4.5, 0, 1.3);
  chairGroup.rotation.y = -0.35;
  const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 1.6), m.velvetRed);
  chairSeat.position.y = 0.6;
  const chairBack = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.9, 0.45), m.velvetRed);
  chairBack.position.set(0, 1.6, -0.6);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.2, 1.6), m.velvetRed);
  armL.position.set(-0.85, 1.0, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.2, 1.6), m.velvetRed);
  armR.position.set(0.85, 1.0, 0);
  chairGroup.add(chairSeat, chairBack, armL, armR);
  elevGroup.add(chairGroup);

  const elevBanner = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.6, 0.08), getRoomBannerMaterial('ЛИФТ'));
  elevBanner.position.set(0, 6.2, -0.15);
  elevGroup.add(elevBanner);

  worldRoot.add(elevGroup);

  // ============================================================================
  // 2. СТОЙКА АДМИНИСТРАТОРА (Reception Desk & Luggage Cart at z = 2.0 .. 11.0)
  // ============================================================================
  const recGroup = new THREE.Group();
  recGroup.name = 'DoorsReceptionLobby';

  const deskFront = addPlatform(-3.9, 0, 6.0, 2.4, 2.2, 5.2, m.mahogany, 'wood');
  deskFront.castShadow = false;
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.22, 5.5), m.darkOak);
  deskTop.position.set(-3.9, 2.25, 6.0);
  recGroup.add(deskTop);

  const bellBase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 12), m.darkOak);
  bellBase.position.set(-3.1, 2.4, 5.5);
  const bellDome = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), m.brass);
  bellDome.position.set(-3.1, 2.44, 5.5);
  recGroup.add(bellBase, bellDome);

  const keyBoard = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.4, 3.2), m.darkOak);
  keyBoard.position.set(-5.8, 4.6, 6.0);
  const glowingKey = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.25), m.brass);
  glowingKey.position.set(-5.65, 4.5, 6.0);
  recGroup.add(keyBoard, glowingKey);

  const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.48, 1.1, 8), m.pot);
  planter.position.set(-2.3, 0.55, 8.8);
  const cypressCone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 3.4, 10), m.foliage);
  cypressCone.position.set(-2.3, 2.6, 8.8);
  recGroup.add(planter, cypressCone);

  const cartGroup = new THREE.Group();
  cartGroup.position.set(3.9, 0, 6.6);
  const cartBase = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 3.4), m.darkOak);
  cartBase.position.y = 0.4;
  const cartArch = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.09, 8, 16, Math.PI), m.brass);
  cartArch.rotation.y = Math.PI / 2;
  cartArch.position.set(0, 2.4, 0);
  const bar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.0, 8), m.brass);
  bar1.position.set(0, 1.4, -1.05);
  const bar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.0, 8), m.brass);
  bar2.position.set(0, 1.4, 1.05);
  cartGroup.add(cartBase, cartArch, bar1, bar2);

  const suitCoords: [number, number, number, number, number, number][] = [
    [0, 0.85, -0.5, 1.4, 0.65, 1.1],
    [0.1, 0.85, 0.75, 1.3, 0.6, 1.0],
    [-0.05, 1.45, -0.3, 1.25, 0.55, 0.95],
    [0.05, 1.4, 0.7, 1.15, 0.5, 0.9],
    [0, 1.98, 0.1, 1.1, 0.5, 0.85],
  ];
  suitCoords.forEach(([sx, sy, sz, sw, sh, sd]) => {
    const sc = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), m.suitcase);
    sc.position.set(sx, sy, sz);
    cartGroup.add(sc);
  });
  recGroup.add(cartGroup);

  const recBanner = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.7, 0.08),
    getRoomBannerMaterial('СТОЙКА АДМИНИСТРАТОРА')
  );
  recBanner.position.set(0, 7.1, 11.45);
  recGroup.add(recBanner);

  worldRoot.add(recGroup);
}

/**
 * Helper: Adds colorful book rows onto a bookshelf mesh
 */
function addBookshelfBooks(
  parent: THREE.Group,
  x: number,
  zCenter: number,
  spanZ: number,
  facingSign: number,
  m: DoorsSharedMaterials
) {
  const bookMats = [m.bookRed, m.bookBlue, m.bookGold, m.bookGreen];
  const rows = 4;
  const cols = Math.max(3, Math.floor(spanZ / 0.9));
  for (let r = 0; r < rows; r++) {
    const ry = 1.2 + r * 1.3;
    for (let c = 0; c < cols; c++) {
      const rz = zCenter - spanZ * 0.42 + (c / Math.max(1, cols - 1)) * (spanZ * 0.84);
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.72 + ((c + r) % 3) * 0.08, 0.45),
        bookMats[(r * 3 + c) % bookMats.length]
      );
      book.position.set(x + facingSign * 0.42, ry, rz);
      parent.add(book);
    }
  }
}

/**
 * Decorates each room segment (2..99) according to the 18 canonical DOORS room archetypes.
 * Every archetype displays distinct walls, furniture, lighting fixtures, and landmarks from its very first room!
 */
export function buildThematicDoorsRoomSegment(
  worldRoot: THREE.Group,
  doorNum: number,
  zStart: number,
  zCenter: number,
  zDoor: number,
  addPlatform: (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    surface?: SurfaceType
  ) => THREE.Mesh
) {
  const def = getDoorsRoomDefByDoorNumber(doorNum);
  const segGroup = new THREE.Group();
  segGroup.name = `DoorsRoom_${doorNum}_${def.id}`;
  const m = getSharedDoorsMats();

  // Place overhead room name banner on startDoor + key milestones so players see the location name in 3D too
  if (doorNum === def.startDoor || doorNum === 50 || doorNum === 52 || doorNum === 60 || doorNum === 70 || doorNum === 86 || doorNum === 90) {
    const banner = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.7, 0.08), getRoomBannerMaterial(def.title));
    banner.position.set(0, 7.15, zDoor - 0.55);
    segGroup.add(banner);
  }

  switch (def.id) {
    // -------------------------------------------------------------------------
    // 3. КОМНАТА ПРИГЛАШЕНИЯ (Doors 2–6): Red diamond walls, boarded beams, string lights & "<- HUMANS" sign
    // -------------------------------------------------------------------------
    case 'invitation_room': {
      const wallOverlayL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 6.4, 11.4), m.redDiamondWall);
      wallOverlayL.position.set(-5.82, 5.6, zCenter);
      const wallOverlayR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 6.4, 11.4), m.redDiamondWall);
      wallOverlayR.position.set(5.82, 5.6, zCenter);
      segGroup.add(wallOverlayL, wallOverlayR);

      // Slanted wooden beams & horizontal planks in every room 2..6
      const beamL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 6.5, 0.45), m.plankWood);
      beamL.position.set(-5.45, 3.2, zCenter - 2.4);
      const beamSlant = new THREE.Mesh(new THREE.BoxGeometry(0.42, 6.0, 0.45), m.plankWood);
      beamSlant.position.set(-5.45, 3.4, zCenter - 0.2);
      beamSlant.rotation.x = 0.42;
      segGroup.add(beamL, beamSlant);

      for (let p = 0; p < 3; p++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.45, 2.8), m.crate);
        plank.position.set(-5.25, 1.8 + p * 1.3, zCenter - 1.6);
        plank.rotation.x = (p - 1) * 0.09;
        segGroup.add(plank);
      }

      // Festive colorful string lights on both sides in every room 2..6
      for (let b = 0; b < 5; b++) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), m.bulbColors[b]);
        bulb.position.set(-5.2, 5.6 - Math.sin((b / 4) * Math.PI) * 0.35, zStart + 2.2 + b * 1.7);
        segGroup.add(bulb);
      }

      // "◄ HUMANS" wooden arrow sign & crates visible immediately on Door 2, 4, 6
      if (doorNum === 2 || doorNum === 4 || doorNum === 6) {
        const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.05, 2.8), m.humansSign);
        signBoard.position.set(5.55, 3.7, zCenter + 0.6);
        segGroup.add(signBoard);

        const crate1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), m.crate);
        crate1.position.set(4.5, 0.75, zCenter + 1.4);
        const crate2 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), m.crate);
        crate2.position.set(4.6, 0.65, zCenter - 0.4);
        segGroup.add(crate1, crate2);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 4. БОЛЬШОЙ КОРИДОР (Doors 7–14): Royal navy walls, gold molding, framed paintings, dressers & double sconces
    // -------------------------------------------------------------------------
    case 'grand_hallway': {
      const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 6.4, 11.4), m.navyWall);
      wallL.position.set(-5.82, 5.6, zCenter);
      const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 6.4, 11.4), m.navyWall);
      wallR.position.set(5.82, 5.6, zCenter);
      const trimL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 11.4), m.goldTrim);
      trimL.position.set(-5.78, 2.85, zCenter);
      const trimR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 11.4), m.goldTrim);
      trimR.position.set(5.78, 2.85, zCenter);
      segGroup.add(wallL, wallR, trimL, trimR);

      // Ornate framed paintings & glowing wall sconces
      [-5.62, 5.62].forEach((sx, idx) => {
        const sconcePlate = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.75, 0.45), m.brass);
        sconcePlate.position.set(sx, 4.6, zCenter - 2.4);
        const bulb1 = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 8), m.warmSconce);
        bulb1.position.set(sx > 0 ? sx - 0.2 : sx + 0.2, 4.75, zCenter - 2.55);
        const bulb2 = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 8), m.warmSconce);
        bulb2.position.set(sx > 0 ? sx - 0.2 : sx + 0.2, 4.75, zCenter - 2.25);

        // Framed portrait/landscape painting
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 2.6), m.goldTrim);
        frame.position.set(sx, 4.8, zCenter + 1.8);
        const canvasMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 1.75, 2.15),
          idx === 0 ? m.velvetRed : m.tealWall
        );
        canvasMesh.position.set(sx, 4.8, zCenter + 1.8);

        // Wooden hallway console table
        const dresser = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.9, 2.6), m.mahogany);
        dresser.position.set(sx > 0 ? 4.9 : -4.9, 0.95, zCenter + 1.8);
        segGroup.add(sconcePlate, bulb1, bulb2, frame, canvasMesh, dresser);
      });
      break;
    }

    // -------------------------------------------------------------------------
    // 5. РАЗЛОМАННЫЕ КОМНАТЫ (Doors 15–22): Scorched walls, giant glowing claw slashes, fallen beams & rubble
    // -------------------------------------------------------------------------
    case 'ruined_rooms': {
      const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 8.8, 11.4), m.charredWall);
      wallL.position.set(-5.82, 4.4, zCenter);
      const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 8.8, 11.4), m.charredWall);
      wallR.position.set(5.82, 4.4, zCenter);
      segGroup.add(wallL, wallR);

      const side = doorNum % 2 === 1 ? 5.65 : -5.65;
      for (let c = -1; c <= 1; c++) {
        const slash = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.2, 0.34), m.clawGlow);
        slash.position.set(side, 4.3 + c * 0.2, zCenter + c * 0.95);
        slash.rotation.x = -0.58;
        segGroup.add(slash);
      }

      // Fallen slanted timber beam overhead & smashed furniture on sides
      const fallenBeam = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.45, 0.55), m.plankWood);
      fallenBeam.position.set(0, 6.8, zCenter - 1.5);
      fallenBeam.rotation.z = doorNum % 2 === 0 ? 0.24 : -0.24;

      const brokenCab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4.6, 2.2), m.darkWood);
      brokenCab.position.set(-side * 0.78, 2.1, zCenter + 0.5);
      brokenCab.rotation.z = side > 0 ? 0.22 : -0.22;

      const rubble1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.65, 1.1), m.stoneWall);
      rubble1.position.set(side * 0.68, 0.32, zCenter + 2.1);
      rubble1.rotation.y = 0.4;
      segGroup.add(fallenBeam, brokenCab, rubble1);
      break;
    }

    // -------------------------------------------------------------------------
    // 6. ЛЮКС (Doors 23–30): Emerald-teal luxury walls, wood arches, velvet sofas, coffee tables & bookcases
    // -------------------------------------------------------------------------
    case 'luxury_suite': {
      const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 6.4, 11.4), m.tealWall);
      wallL.position.set(-5.82, 5.6, zCenter);
      const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 6.4, 11.4), m.tealWall);
      wallR.position.set(5.82, 5.6, zCenter);
      segGroup.add(wallL, wallR);

      // Ornate wooden interior arch columns & header beam
      const colL = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7.6, 0.65), m.mahogany);
      colL.position.set(-5.1, 3.8, zCenter);
      const colR = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7.6, 0.65), m.mahogany);
      colR.position.set(5.1, 3.8, zCenter);
      const archBeam = new THREE.Mesh(new THREE.BoxGeometry(11.6, 1.1, 0.7), m.mahogany);
      archBeam.position.set(0, 7.8, zCenter);
      segGroup.add(colL, colR, archBeam);

      // Plush sofa with back & armrests
      const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 3.8), m.velvetRed);
      sofaBase.position.set(-4.5, 0.45, zCenter - 2.2);
      const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.7, 3.8), m.velvetRed);
      sofaBack.position.set(-5.15, 0.95, zCenter - 2.2);
      const coffeeTable = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.65, 2.0), m.darkOak);
      coffeeTable.position.set(-3.0, 0.35, zCenter - 2.2);
      const tableLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.5, 8), m.warmSconce);
      tableLamp.position.set(-3.0, 0.95, zCenter - 2.2);

      // Filled luxury bookcase
      const bookcase = new THREE.Mesh(new THREE.BoxGeometry(1.3, 5.8, 3.2), m.darkWood);
      bookcase.position.set(4.8, 2.9, zCenter + 2.0);
      segGroup.add(sofaBase, sofaBack, coffeeTable, tableLamp, bookcase);
      addBookshelfBooks(segGroup, 4.8, zCenter + 2.0, 2.8, -1, m);
      break;
    }

    // -------------------------------------------------------------------------
    // 7. ЗАРОСШИЙ ПОДВАЛ (Doors 31–38): Exposed brick walls, overhead pipes, draped vines, trapdoor & drain
    // -------------------------------------------------------------------------
    case 'overgrown_basement': {
      const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 8.6, 11.4), m.brickWall);
      wallL.position.set(-5.8, 4.3, zCenter);
      const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 8.6, 11.4), m.brickWall);
      wallR.position.set(5.8, 4.3, zCenter);
      segGroup.add(wallL, wallR);

      // Overhead industrial cellar pipes
      [-3.5, 3.5].forEach((px) => {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 11.4, 8), m.ironMetal);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(px, 7.6, zCenter);
        segGroup.add(pipe);
      });

      // Wooden cellar trapdoor wrapped in thick green vines
      const cellarX = doorNum % 2 === 1 ? -3.6 : 3.6;
      const trapTable = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.65, 4.4), m.plankWood);
      trapTable.position.set(cellarX, 0.35, zCenter);
      segGroup.add(trapTable);

      for (let v = 0; v < 5; v++) {
        const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.3, 8), m.vineGreen);
        vine.position.set(cellarX, 0.72, zCenter - 1.6 + v * 0.8);
        vine.rotation.z = Math.PI / 2 + (v % 2 === 0 ? 0.22 : -0.22);
        vine.rotation.y = (v - 2) * 0.25;
        segGroup.add(vine);
      }

      // Hanging ceiling vines
      for (let hv = 0; hv < 3; hv++) {
        const hangVine = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 3.2, 6), m.vineGreen);
        hangVine.position.set(-3.4 + hv * 3.4, 6.4, zCenter + (hv - 1) * 1.8);
        segGroup.add(hangVine);
      }

      const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 12), m.ironMetal);
      drain.position.set(0, 0.06, zCenter + 1.2);
      segGroup.add(drain);
      break;
    }

    // -------------------------------------------------------------------------
    // 8. КНИЖНЫЙ АРХИВ (Doors 39–45): Walkable stepped mezzanine, green baize table, lamp & filled bookshelves
    // -------------------------------------------------------------------------
    case 'book_archive': {
      const sideX = doorNum % 2 === 1 ? -4.1 : 4.1;
      // Walkable 2-step approach + gallery deck (stepHeight <= 0.45m!)
      addPlatform(sideX, 0, zCenter - 3.6, 2.8, 0.42, 1.2, m.darkWood, 'wood');
      addPlatform(sideX, 0, zCenter - 2.4, 2.8, 0.8, 1.2, m.darkWood, 'wood');
      addPlatform(sideX, 0, zCenter + 1.0, 2.8, 1.05, 5.6, m.darkWood, 'wood');

      const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.85, 3.0), m.greenBaize);
      tableTop.position.set(sideX, 1.48, zCenter + 1.2);
      const deskLamp = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.4, 8), m.warmSconce);
      deskLamp.position.set(sideX, 2.25, zCenter + 1.2);
      segGroup.add(tableTop, deskLamp);

      // Tall wooden bookshelves packed with colorful books along opposite wall
      const shelfX = -sideX * 1.15;
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6.8, 7.8), m.darkWood);
      shelf.position.set(shelfX, 3.4, zCenter);
      segGroup.add(shelf);
      addBookshelfBooks(segGroup, shelfX, zCenter, 7.2, shelfX > 0 ? -1 : 1, m);
      break;
    }

    // -------------------------------------------------------------------------
    // 9. ВХОД В АРХИВЫ (Doors 46–49): Vaulted timber ribs, glowing blue Guiding Candle bookcase & antique clock
    // -------------------------------------------------------------------------
    case 'archive_entrance': {
      const archRib1 = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.7, 0.7), m.darkWood);
      archRib1.position.set(0, 8.6, zCenter - 2.5);
      const archRib2 = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.7, 0.7), m.darkWood);
      archRib2.position.set(0, 8.6, zCenter + 2.5);
      segGroup.add(archRib1, archRib2);

      const bookcase = new THREE.Mesh(new THREE.BoxGeometry(1.3, 6.4, 4.2), m.darkWood);
      bookcase.position.set(4.9, 3.2, zCenter);
      addBookshelfBooks(segGroup, 4.9, zCenter, 3.8, -1, m);

      const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 1.0), m.mahogany);
      pedestal.position.set(3.8, 0.9, zCenter + 2.2);
      const blueCandleGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.95, 10), m.blueCandle);
      blueCandleGlow.position.set(3.8, 2.25, zCenter + 2.2);
      segGroup.add(bookcase, pedestal, blueCandleGlow);

      const clockRim = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.14, 16), m.brass);
      clockRim.rotation.z = Math.PI / 2;
      clockRim.position.set(-5.78, 5.2, zCenter);
      const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.18, 16), m.clockFace);
      clockFace.rotation.z = Math.PI / 2;
      clockFace.position.set(-5.74, 5.2, zCenter);
      segGroup.add(clockRim, clockFace);
      break;
    }

    // -------------------------------------------------------------------------
    // 10. БИБЛИОТЕКА (Door 50): Iconic grand vaulted timber-truss hall, towering 2-tier bookshelves & reading desk
    // -------------------------------------------------------------------------
    case 'library': {
      for (let t = -1; t <= 1; t++) {
        const tz = zCenter + t * 3.5;
        const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.75, 10.6, 0.75), m.darkWood);
        pillarL.position.set(-4.6, 5.3, tz);
        const pillarR = new THREE.Mesh(new THREE.BoxGeometry(0.75, 10.6, 0.75), m.darkWood);
        pillarR.position.set(4.6, 5.3, tz);
        const topBeam = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.65, 0.65), m.darkWood);
        topBeam.position.set(0, 10.2, tz);
        const trussL = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.35, 0.35), m.plankWood);
        trussL.position.set(-2.2, 9.2, tz);
        trussL.rotation.z = 0.45;
        const trussR = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.35, 0.35), m.plankWood);
        trussR.position.set(2.2, 9.2, tz);
        trussR.rotation.z = -0.45;
        segGroup.add(pillarL, pillarR, topBeam, trussL, trussR);
      }

      const libShelfL = new THREE.Mesh(new THREE.BoxGeometry(1.1, 9.0, 10.4), m.darkWood);
      libShelfL.position.set(-5.3, 4.5, zCenter);
      const libShelfR = new THREE.Mesh(new THREE.BoxGeometry(1.1, 9.0, 10.4), m.darkWood);
      libShelfR.position.set(5.3, 4.5, zCenter);
      segGroup.add(libShelfL, libShelfR);
      addBookshelfBooks(segGroup, -5.3, zCenter, 9.6, 1, m);
      addBookshelfBooks(segGroup, 5.3, zCenter, 9.6, -1, m);

      // Library reading desk & glowing lantern on left
      const desk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 3.2), m.mahogany);
      desk.position.set(-3.1, 0.65, zCenter);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), m.warmSconce);
      lamp.position.set(-3.1, 1.65, zCenter);
      segGroup.add(desk, lamp);
      break;
    }

    // -------------------------------------------------------------------------
    // 11. МАГАЗИН ДЖЕФФА (Doors 51–56): Starts right at Door 51! "JEFF SHOP" booth, eyes, item crates & backroom
    // -------------------------------------------------------------------------
    case 'jeff_shop': {
      const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 6.4, 11.4), m.mahogany);
      wallL.position.set(-5.82, 5.6, zCenter);
      const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 6.4, 11.4), m.mahogany);
      wallR.position.set(5.82, 5.6, zCenter);
      segGroup.add(wallL, wallR);

      if (doorNum === 51 || doorNum === 52 || doorNum === 54) {
        const shopGroup = new THREE.Group();
        shopGroup.position.set(-4.3, 0, zCenter);

        const alcove = new THREE.Mesh(new THREE.BoxGeometry(2.2, 5.6, 6.2), m.darkAlcove);
        alcove.position.set(-0.7, 3.2, 0);
        shopGroup.add(alcove);

        const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), m.whiteGlow);
        eye1.position.set(-0.15, 3.6, -0.38);
        const eye2 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), m.whiteGlow);
        eye2.position.set(-0.15, 3.6, 0.38);
        shopGroup.add(eye1, eye2);

        for (let k = -1; k <= 1; k++) {
          const counterCrate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.9, 1.7), m.crate);
          counterCrate.position.set(0.5, 0.95, k * 1.95);
          shopGroup.add(counterCrate);
        }

        const radio = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.75), m.darkWood);
        radio.position.set(0.5, 2.15, -1.95);
        const flashlightItem = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.8, 8), m.brass);
        flashlightItem.rotation.z = Math.PI / 2;
        flashlightItem.position.set(0.5, 2.08, 0);
        const crucifixItem = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 0.55), m.brass);
        crucifixItem.position.set(0.5, 2.25, 1.95);
        const tipJar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.55, 10), m.warmSconce);
        tipJar.position.set(0.95, 2.18, -0.95);
        shopGroup.add(radio, flashlightItem, crucifixItem, tipJar);

        const jeffSign = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.4, 3.8), m.jeffSign);
        jeffSign.position.set(0.4, 6.2, 0);
        shopGroup.add(jeffSign);

        segGroup.add(shopGroup);
      } else {
        // Cozy Jeff backroom storage crates & shelves
        const stack1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), m.crate);
        stack1.position.set(-4.6, 0.8, zCenter - 1.2);
        const stack2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), m.crate);
        stack2.position.set(4.6, 0.7, zCenter + 1.0);
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5.2, 4.4), m.darkWood);
        shelf.position.set(5.1, 2.6, zCenter - 1.5);
        segGroup.add(stack1, stack2, shelf);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 12. ЛАЗАРЕТ (Doors 57–65): Clinical pale walls, checkered floor tiles, beds & Viridis Herb (Door 57 & 60)
    // -------------------------------------------------------------------------
    case 'infirmary': {
      const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 8.6, 11.4), m.infirmaryWall);
      wallL.position.set(-5.82, 4.3, zCenter);
      const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 8.6, 11.4), m.infirmaryWall);
      wallR.position.set(5.82, 4.3, zCenter);
      const floorTile = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.05, 11.8), m.infirmaryFloor);
      floorTile.position.set(0, 0.065, zCenter);
      segGroup.add(wallL, wallR, floorTile);

      [-4.1, 4.1].forEach((bx) => {
        const bedGroup = new THREE.Group();
        bedGroup.position.set(bx, 0, zCenter);
        const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.55, 1.6), m.mattress);
        mattress.position.y = 0.85;
        const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 1.1), m.whiteGlow);
        pillow.position.set(bx < 0 ? -0.7 : 0.7, 1.18, 0);
        const headboard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 1.65), m.ironMetal);
        headboard.position.set(bx < 0 ? -1.1 : 1.1, 0.9, 0);
        const footboard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.25, 1.65), m.ironMetal);
        footboard.position.set(bx < 0 ? 1.1 : -1.1, 0.65, 0);
        bedGroup.add(mattress, pillow, headboard, footboard);
        segGroup.add(bedGroup);
      });

      // Red Cross medical cabinet on wall
      const medCab = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.4, 1.4), m.mattress);
      medCab.position.set(5.55, 3.8, zCenter + 2.8);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.8), m.velvetRed);
      crossH.position.set(5.53, 3.8, zCenter + 2.8);
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.25), m.velvetRed);
      crossV.position.set(5.53, 3.8, zCenter + 2.8);
      segGroup.add(medCab, crossH, crossV);

      if (doorNum === 57 || doorNum === 60) {
        // Glowing Green Herb of Viridis healing station visible immediately at startDoor 57 & milestone 60
        const altar = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 1.2, 8), m.stoneStatue);
        altar.position.set(-4.1, 0.6, zCenter + 2.8);
        const herbPlant = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55), m.herbGlow);
        herbPlant.position.set(-4.1, 1.65, zCenter + 2.8);
        segGroup.add(altar, herbPlant);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 13. ПРОМЕЖУТОЧНЫЙ РАЗЛОМ (Doors 66–74): Cracked blue walls, glowing cyan floor runes & Electric Skull Rift
    // -------------------------------------------------------------------------
    case 'mid_rift': {
      const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 8.6, 11.4), m.riftWall);
      wallL.position.set(-5.82, 4.3, zCenter);
      const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 8.6, 11.4), m.riftWall);
      wallR.position.set(5.82, 4.3, zCenter);
      const floorRune = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.9, 16), m.riftCyan);
      floorRune.rotation.x = -Math.PI / 2;
      floorRune.position.set(0, 0.08, zCenter);
      segGroup.add(wallL, wallR, floorRune);

      // Glowing blue rift crystal shards in every mid_rift room
      const crystalL = new THREE.Mesh(new THREE.OctahedronGeometry(0.75), m.riftBlue);
      crystalL.position.set(-4.8, 1.2, zCenter - 2.0);
      const crystalR = new THREE.Mesh(new THREE.OctahedronGeometry(0.65), m.riftBlue);
      crystalR.position.set(4.8, 1.0, zCenter + 2.2);
      segGroup.add(crystalL, crystalR);

      // Main Electric Lightning Crack & Skull Emblem right at Door 66 (startDoor) & Door 70 & 73
      if (doorNum === 66 || doorNum === 67 || doorNum === 70 || doorNum === 73) {
        const riftGroup = new THREE.Group();
        riftGroup.position.set(5.45, 3.8, zCenter);

        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.58, 12, 12), m.skull);
        riftGroup.add(skull);

        for (let b = 0; b < 6; b++) {
          const angle = (b / 6) * Math.PI * 2 + 0.3;
          const bolt1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.3, 0.22), m.riftCyan);
          bolt1.position.set(0, Math.sin(angle) * 1.1, Math.cos(angle) * 1.1);
          bolt1.rotation.x = angle;
          const bolt2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.6, 0.18), m.riftBlue);
          bolt2.position.set(0, Math.sin(angle + 0.35) * 2.1, Math.cos(angle + 0.35) * 2.1);
          bolt2.rotation.x = angle - 0.5;
          riftGroup.add(bolt1, bolt2);
        }
        segGroup.add(riftGroup);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 14. ВХОД НА УЛИЦУ (Doors 75–82): Heavy medieval stone walls, stone archways & thick green vines
    // -------------------------------------------------------------------------
    case 'courtyard_entrance': {
      const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 8.8, 11.4), m.stoneWall);
      wallL.position.set(-5.8, 4.4, zCenter);
      const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 8.8, 11.4), m.stoneWall);
      wallR.position.set(5.8, 4.4, zCenter);
      segGroup.add(wallL, wallR);

      const archL = new THREE.Mesh(new THREE.BoxGeometry(1.1, 7.6, 0.9), m.stoneWall);
      archL.position.set(-2.9, 3.8, zDoor);
      const archR = new THREE.Mesh(new THREE.BoxGeometry(1.1, 7.6, 0.9), m.stoneWall);
      archR.position.set(2.9, 3.8, zDoor);
      const archTop = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.2, 0.95), m.stoneWall);
      archTop.position.set(0, 7.6, zDoor);
      segGroup.add(archL, archR, archTop);

      for (let v = 0; v < 4; v++) {
        const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 5.2, 8), m.vineGreen);
        vine.position.set(0, 2.2 + v * 1.35, zDoor - 0.45);
        vine.rotation.z = Math.PI / 2 + (v % 2 === 0 ? 0.16 : -0.16);
        segGroup.add(vine);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 15. ВНУТРЕННИЙ ДВОР (Doors 83–90): Open-air rainy courtyard under night sky, arched windows, hedges & Angel Statue
    // -------------------------------------------------------------------------
    case 'courtyard': {
      // Glowing arched amber windows along the wide stone courtyard perimeter walls (x = ±8.35)
      [-8.35, 8.35].forEach((wx) => {
        const winFrame = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.6, 2.2), m.darkWood);
        winFrame.position.set(wx, 5.4, zCenter);
        const winGlass = new THREE.Mesh(new THREE.BoxGeometry(0.32, 3.1, 1.7), m.amberWindow);
        winGlass.position.set(wx, 5.4, zCenter);
        segGroup.add(winFrame, winGlass);
      });

      // Trimmed green courtyard hedges along the cobblestone path
      const hedgeL = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 9.4), m.foliage);
      hedgeL.position.set(-5.8, 0.8, zCenter);
      const hedgeR = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 9.4), m.foliage);
      hedgeR.position.set(5.8, 0.8, zCenter);
      segGroup.add(hedgeL, hedgeR);

      // Iron garden lamppost in every courtyard segment
      const lampSide = doorNum % 2 === 1 ? -3.4 : 3.4;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 4.6, 8), m.ironMetal);
      post.position.set(lampSide, 2.3, zCenter - 2.6);
      const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.6), m.warmSconce);
      lantern.position.set(lampSide, 4.85, zCenter - 2.6);
      segGroup.add(post, lantern);

      // Angel & Glowing Sword Statue in Doors 83 (startDoor), 86, and 90
      if (doorNum === 83 || doorNum === 86 || doorNum === 90) {
        const statueGroup = new THREE.Group();
        statueGroup.position.set(doorNum === 86 ? 3.8 : -3.8, 0, zCenter + 1.0);

        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.45, 2.2, 8), m.stoneStatue);
        pedestal.position.y = 1.1;
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 2.6, 8), m.stoneStatue);
        body.position.y = 3.4;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 10), m.stoneStatue);
        head.position.y = 5.0;
        const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 0.2), m.stoneStatue);
        wingL.position.set(-0.95, 3.8, -0.2);
        wingL.rotation.z = 0.35;
        const wingR = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 0.2), m.stoneStatue);
        wingR.position.set(0.95, 3.8, -0.2);
        wingR.rotation.z = -0.35;
        const sword = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 0.16), m.warmSconce);
        sword.position.set(0, 3.2, 0.65);

        statueGroup.add(pedestal, body, head, wingL, wingR, sword);
        segGroup.add(statueGroup);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 16. РАЗВИЛКА ОРАНЖЕРЕИ (Doors 91–94): Glass conservatory roof open to night sky, iron rafters & planter beds
    // -------------------------------------------------------------------------
    case 'greenhouse_junction': {
      // Translucent glass conservatory roof (now unobstructed by any solid ceiling!)
      const rafterL = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.18, 11.8), m.glassRoof);
      rafterL.position.set(-3.0, 9.2, zCenter);
      rafterL.rotation.z = 0.28;
      const rafterR = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.18, 11.8), m.glassRoof);
      rafterR.position.set(3.0, 9.2, zCenter);
      rafterR.rotation.z = -0.28;
      const ridgeBeam = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 11.8), m.ironMetal);
      ridgeBeam.position.set(0, 10.1, zCenter);
      const archIron = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.35, 0.35), m.ironMetal);
      archIron.position.set(0, 8.2, zCenter);
      segGroup.add(rafterL, rafterR, ridgeBeam, archIron);

      // Brick side planter beds & conservatory bushes
      const planterL = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 8.6), m.brickWall);
      planterL.position.set(-4.5, 0.35, zCenter);
      const planterR = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 8.6), m.brickWall);
      planterR.position.set(4.5, 0.35, zCenter);
      const bushL = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15), m.vineGreen);
      bushL.position.set(-4.3, 1.35, zCenter);
      const bushR = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15), m.vineGreen);
      bushR.position.set(4.3, 1.35, zCenter);
      segGroup.add(planterL, planterR, bushL, bushR);
      break;
    }

    // -------------------------------------------------------------------------
    // 17. КОРИДОР ОРАНЖЕРЕИ (Doors 95–99): Brick+glass greenhouse corridor, glass roof & Snare root traps
    // -------------------------------------------------------------------------
    case 'greenhouse_corridor': {
      const rafterL = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.18, 11.8), m.glassRoof);
      rafterL.position.set(-3.0, 9.2, zCenter);
      rafterL.rotation.z = 0.28;
      const rafterR = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.18, 11.8), m.glassRoof);
      rafterR.position.set(3.0, 9.2, zCenter);
      rafterR.rotation.z = -0.28;
      const ridgeBeam = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 11.8), m.ironMetal);
      ridgeBeam.position.set(0, 10.1, zCenter);
      segGroup.add(rafterL, rafterR, ridgeBeam);

      // Low brick walls with glass conservatory panes
      const lowWallL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.8, 11.4), m.brickWall);
      lowWallL.position.set(-5.8, 1.4, zCenter);
      const lowWallR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.8, 11.4), m.brickWall);
      lowWallR.position.set(5.8, 1.4, zCenter);
      const glassWallL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 5.4, 11.4), m.glassRoof);
      glassWallL.position.set(-5.8, 5.5, zCenter);
      const glassWallR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 5.4, 11.4), m.glassRoof);
      glassWallR.position.set(5.8, 5.5, zCenter);
      segGroup.add(lowWallL, lowWallR, glassWallL, glassWallR);

      // Decorative Snare spiky root patch on the floor (avoid blocking walkway)
      const snareX = doorNum % 2 === 1 ? -2.6 : 2.6;
      const snareDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.12, 10), m.snareMat);
      snareDisc.position.set(snareX, 0.08, zCenter);
      segGroup.add(snareDisc);
      for (let sp = 0; sp < 5; sp++) {
        const a = (sp / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.75, 5), m.snareMat);
        spike.position.set(snareX + Math.cos(a) * 0.55, 0.42, zCenter + Math.sin(a) * 0.55);
        segGroup.add(spike);
      }
      break;
    }

    default:
      break;
  }

  worldRoot.add(segGroup);
}

/**
 * Decorates Door 100 Final Electrical Room (ЭЛЕКТРОЩИТОВАЯ) with glowing green EXIT sign,
 * fluorescent ceiling lights, electrical breaker cabinets, and metal storage racks
 */
export function decorateFinalElectricalRoom(worldRoot: THREE.Group, roomStartZ: number) {
  const elecDecor = new THREE.Group();
  elecDecor.name = 'DoorsElectricalRoomDecor';

  const exitSignMat = new THREE.MeshStandardMaterial({
    map: createSignTexture('🏃 ➔ EXIT / ВЫХОД', {
      bg: '#059669',
      fg: '#ffffff',
      border: '#34d399',
      font: '900 44px sans-serif',
      width: 512,
      height: 140,
    }),
    emissive: 0x10b981,
    emissiveIntensity: 0.95,
  });

  // Visible right ahead upon entering Room 100 (above the back mezzanine/elevator) AND over the entrance
  const exitSignEntry = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.0, 0.2), exitSignMat);
  exitSignEntry.position.set(0, 8.6, roomStartZ + 0.8);
  const exitSignFar = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.3, 0.22), exitSignMat);
  exitSignFar.position.set(0, 16.5, roomStartZ + 66.5);
  elecDecor.add(exitSignEntry, exitSignFar);

  const elecBanner = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 0.85, 0.12),
    getRoomBannerMaterial('ЭЛЕКТРОЩИТОВАЯ')
  );
  elecBanner.position.set(0, 12.2, roomStartZ + 43.0);
  elecDecor.add(elecBanner);

  const tubeMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
  [
    [-8, 12.5, roomStartZ + 18],
    [8, 12.5, roomStartZ + 18],
    [-8, 12.5, roomStartZ + 42],
    [8, 12.5, roomStartZ + 42],
  ].forEach(([lx, ly, lz]) => {
    const tube = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 4.8), tubeMat);
    tube.position.set(lx, ly, lz);
    elecDecor.add(tube);
  });

  const rackMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.75, roughness: 0.4 });
  const breakerMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.45 });
  const ledGreenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const ledRedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  [-15.5, -10.5].forEach((rx, idx) => {
    const rackGroup = new THREE.Group();
    rackGroup.position.set(rx, 0, roomStartZ + 16 + idx * 14);
    for (let s = 1; s <= 4; s++) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 6.4), rackMat);
      shelf.position.y = s * 1.4;
      rackGroup.add(shelf);
    }
    elecDecor.add(rackGroup);
  });

  // Electrical breaker fuse panels along right & back walls
  for (let b = 0; b < 3; b++) {
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4.6, 2.8), breakerMat);
    cabinet.position.set(-17.8, 2.3, roomStartZ + 14 + b * 9);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), b % 2 === 0 ? ledGreenMat : ledRedMat);
    led.position.set(-17.0, 3.6, roomStartZ + 14 + b * 9);
    elecDecor.add(cabinet, led);
  }

  worldRoot.add(elecDecor);
}

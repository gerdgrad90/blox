import * as THREE from 'three';
import { Checkpoint, CollectibleItem, GameId, ObstacleHazard, PlacedBlock, SecretArea } from './types';

export interface WorldBuildResult {
  scene: THREE.Scene;
  worldRoot: THREE.Group;
  gameId: GameId;
  platforms: THREE.Mesh[];
  hazards: ObstacleHazard[];
  checkpoints: Checkpoint[];
  checkpointMeshes: THREE.Group[];
  collectibles: CollectibleItem[];
  collectibleMeshes: Map<string, THREE.Group>;
  dynamicRotators: { group: THREE.Group; speed: number; axis: 'y' | 'z' }[];
  placedBlockMeshes: Map<string, THREE.Mesh>;
  trophyMesh: THREE.Group;
  dummyMesh: THREE.Group;
  lavaSurface?: THREE.Mesh;
  secretAreas: SecretArea[];
}

/**
 * Creates procedural Stud Texture (Roblox classic cylinder top studs)
 */
export function createStudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);

  const cx = 64;
  const cy = 64;
  const r = 36;

  // Outer shadow
  ctx.beginPath();
  ctx.arc(cx, cy + 3, r, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.18;
  ctx.fill();

  // Stud fill
  ctx.globalAlpha = 1.0;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#f0f0f0';
  ctx.fill();

  // Top highlight rim
  ctx.beginPath();
  ctx.arc(cx, cy - 2, r - 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.45;
  ctx.fill();

  ctx.globalAlpha = 1.0;
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 3;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

/**
 * Helper to create a single platform box
 */
function createPlatform(
  worldRoot: THREE.Group,
  platforms: THREE.Mesh[],
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { width: w, height: h, depth: d };
  platforms.push(mesh);
  worldRoot.add(mesh);
  return mesh;
}

/**
 * Universal Game World Builder: switches between 'obby' and 'lava_survival'
 */
export function buildGameWorld(scene: THREE.Scene, gameId: GameId, existingRoot?: THREE.Group): WorldBuildResult {
  if (existingRoot) {
    scene.remove(existingRoot);
    existingRoot.clear();
  }
  const worldRoot = existingRoot || new THREE.Group();
  worldRoot.name = `WorldRoot_${gameId}`;
  scene.add(worldRoot);

  if (gameId === 'lava_survival') {
    return createLavaSurvivalWorld(scene, worldRoot);
  }
  return createObbyWorld(scene, worldRoot);
}

/**
 * Backward compatibility export
 */
export function createBloxWorld(scene: THREE.Scene): WorldBuildResult {
  return buildGameWorld(scene, 'obby');
}

/**
 * ============================================================================
 * GAME 1: PARCOUR BLOX OBBY 3D
 * ============================================================================
 */
function createObbyWorld(scene: THREE.Scene, worldRoot: THREE.Group): WorldBuildResult {
  const platforms: THREE.Mesh[] = [];
  const hazards: ObstacleHazard[] = [];
  const checkpoints: Checkpoint[] = [];
  const checkpointMeshes: THREE.Group[] = [];
  const collectibles: CollectibleItem[] = [];
  const collectibleMeshes = new Map<string, THREE.Group>();
  const dynamicRotators: { group: THREE.Group; speed: number; axis: 'y' | 'z' }[] = [];
  const placedBlockMeshes = new Map<string, THREE.Mesh>();

  const studTexture = createStudTexture();
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.8, map: studTexture });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
  const neonRedMat = new THREE.MeshStandardMaterial({ color: 0xff0044, emissive: 0xff0044, emissiveIntensity: 0.85, roughness: 0.2 });
  const neonBlueMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00b4d8, emissiveIntensity: 0.6, roughness: 0.2 });
  const neonYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.5, roughness: 0.2 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.15, emissive: 0xca8a04, emissiveIntensity: 0.4 });

  // Base Sea Bed below
  const seaBed = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.9 }));
  seaBed.rotation.x = -Math.PI / 2;
  seaBed.position.set(0, -12, 80);
  worldRoot.add(seaBed);

  // --- STAGE 0: Spawn Island ---
  createPlatform(worldRoot, platforms, 0, 0, 0, 14, 2, 14, grassMat);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 0, 'Спавн', 0, 2, 0, true);

  // --- STAGE 1: Stepping Stones & Lava Jumps ---
  createPlatform(worldRoot, platforms, 0, 1, 14, 4, 1.5, 4, rockMat);
  createPlatform(worldRoot, platforms, -3.5, 2.5, 22, 3.5, 1.5, 3.5, rockMat);
  createPlatform(worldRoot, platforms, 3.5, 4.0, 30, 3.5, 1.5, 3.5, rockMat);

  // Lava floor hazard between stage 1 and 2
  const lava1 = createPlatform(worldRoot, platforms, 0, 2.5, 39, 12, 0.8, 8, neonRedMat);
  hazards.push({ id: 'lava_1', type: 'lava', mesh: lava1, damage: 100, active: true });

  createPlatform(worldRoot, platforms, -2.5, 3.5, 39, 2.5, 1.8, 2.5, neonBlueMat);
  createPlatform(worldRoot, platforms, 2.5, 3.5, 39, 2.5, 1.8, 2.5, neonYellowMat);

  // --- STAGE 2: Checkpoint 1 & Neon Zig-Zag Bridge ---
  createPlatform(worldRoot, platforms, 0, 5.0, 48, 10, 2, 8, grassMat);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 1, 'Неоновый Мост', 0, 7.0, 48, false);

  const neonColors = [neonRedMat, neonYellowMat, neonBlueMat, neonRedMat, neonYellowMat];
  for (let i = 0; i < 5; i++) {
    const xOffset = i % 2 === 0 ? -3.0 : 3.0;
    createPlatform(worldRoot, platforms, xOffset, 6.2 + i * 1.2, 58 + i * 7, 3.2, 1.0, 3.2, neonColors[i]);
  }

  // --- STAGE 3: Checkpoint 2 & Rotating Spinner Arm ---
  createPlatform(worldRoot, platforms, 0, 12.5, 96, 12, 2, 12, grassMat);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 2, 'Вращающийся Лазер', 0, 14.5, 96, false);

  // Rotating laser cross hazard
  const spinnerGroup = new THREE.Group();
  spinnerGroup.position.set(0, 15.0, 96);
  const arm1 = new THREE.Mesh(new THREE.BoxGeometry(11, 0.6, 0.6), neonRedMat);
  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 11), neonRedMat);
  spinnerGroup.add(arm1, arm2);
  worldRoot.add(spinnerGroup);
  hazards.push({ id: 'spinner_1', type: 'spinner', mesh: arm1, damage: 45, active: true });
  hazards.push({ id: 'spinner_2', type: 'spinner', mesh: arm2, damage: 45, active: true });
  dynamicRotators.push({ group: spinnerGroup, speed: 1.4, axis: 'y' });

  // --- STAGE 4: Checkpoint 3 & Disappearing Fading Blocks ---
  createPlatform(worldRoot, platforms, 0, 14.0, 114, 8, 2, 8, rockMat);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 3, 'Стеклянный Путь', 0, 16.0, 114, false);

  for (let i = 0; i < 4; i++) {
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
    });
    createPlatform(worldRoot, platforms, (i % 2 === 0 ? -2.2 : 2.2), 15.5 + i * 1.4, 124 + i * 7, 3.0, 0.8, 3.0, glassMat);
  }

  // --- STAGE 5: Checkpoint 4 & Trampoline Jump Pad ---
  createPlatform(worldRoot, platforms, 0, 21.0, 155, 10, 2, 10, grassMat);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 4, 'Супер-Трамплин', 0, 23.0, 155, false);

  // Jump pad
  const padMesh = createPlatform(worldRoot, platforms, 0, 23.0, 161, 4, 0.5, 4, neonYellowMat);
  hazards.push({ id: 'bounce_pad', type: 'trampoline', mesh: padMesh, damage: 0, active: true });

  // Floating Island high above
  createPlatform(worldRoot, platforms, 0, 31.0, 178, 8, 2, 8, rockMat);

  // --- STAGE 6: Checkpoint 5 & Golden Summit ---
  createPlatform(worldRoot, platforms, 0, 35.0, 196, 16, 2, 16, grassMat);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 5, 'Золотая Вершина', 0, 37.0, 196, false);

  // The Golden Cup Trophy
  const trophyMesh = createGoldenTrophy();
  trophyMesh.position.set(0, 37.0, 196);
  worldRoot.add(trophyMesh);
  dynamicRotators.push({ group: trophyMesh, speed: 1.0, axis: 'y' });

  // Practice Dummy
  const dummyMesh = createPracticeDummy();
  dummyMesh.position.set(4, 37.0, 194);
  worldRoot.add(dummyMesh);

  // Coins along the way
  const coinPositions: [number, number, number][] = [
    [0, 3.5, 14],
    [-3.5, 5.0, 22],
    [3.5, 6.5, 30],
    [-3.0, 9.0, 58],
    [3.0, 11.5, 72],
    [0, 17.0, 96],
    [-2.2, 18.0, 124],
    [0, 25.0, 161],
    [0, 33.5, 178],
    [-3.5, 39.0, 196],
    [3.5, 39.0, 196],
  ];

  coinPositions.forEach((pos, idx) => {
    const id = `coin_obby_${idx}`;
    const mesh = createCoinMesh();
    mesh.position.set(pos[0], pos[1], pos[2]);
    worldRoot.add(mesh);
    collectibleMeshes.set(id, mesh);
    collectibles.push({ id, type: 'coin', position: pos, value: 50, collected: false });
    dynamicRotators.push({ group: mesh, speed: 2.2, axis: 'y' });
  });

  // --- SECRET AREA: Тайная Кристальная Комната (Hidden Crystal Chamber) ---
  const secretAreas: SecretArea[] = [];
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0xc084fc,
    emissive: 0x9333ea,
    emissiveIntensity: 0.6,
    roughness: 0.2,
  });
  const secretFloorMat = new THREE.MeshStandardMaterial({
    color: 0x1e1b4b,
    roughness: 0.5,
    metalness: 0.2,
    map: studTexture,
  });

  // Secret stepping bridge branching off Checkpoint 2 (Z = 96, X = -6 -> -26)
  createPlatform(worldRoot, platforms, -8, 11.5, 96, 2.8, 0.8, 2.8, crystalMat);
  createPlatform(worldRoot, platforms, -15, 9.8, 92, 2.8, 0.8, 2.8, crystalMat);
  createPlatform(worldRoot, platforms, -21, 8.2, 86, 2.8, 0.8, 2.8, crystalMat);

  // Hidden Crystal Vault Island
  createPlatform(worldRoot, platforms, -26, 6.5, 80, 10, 2, 10, secretFloorMat);

  // Floating secret crystals
  for (let c = 0; c < 3; c++) {
    const octGeo = new THREE.OctahedronGeometry(0.8, 0);
    const octMesh = new THREE.Mesh(octGeo, crystalMat);
    octMesh.position.set(-26 + (c - 1) * 2.8, 9.2, 80 + (c % 2 === 0 ? 1 : -1));
    worldRoot.add(octMesh);
    dynamicRotators.push({ group: octMesh as any, speed: 2.0 + c * 0.5, axis: 'y' });
  }

  // Secret Big Star Gem (worth 250)
  const secretCoinId = 'coin_secret_crystal';
  const secretCoinMesh = createCoinMesh();
  secretCoinMesh.scale.set(1.6, 1.6, 1.6);
  secretCoinMesh.position.set(-26, 9.2, 80);
  worldRoot.add(secretCoinMesh);
  collectibleMeshes.set(secretCoinId, secretCoinMesh);
  collectibles.push({ id: secretCoinId, type: 'gem', position: [-26, 9.2, 80], value: 250, collected: false });
  dynamicRotators.push({ group: secretCoinMesh, speed: 2.8, axis: 'y' });

  secretAreas.push({
    id: 'secret_crystal_vault',
    name: 'Тайная Кристальная Комната',
    description: 'Скрытая пещера с фиолетовыми кристаллами за пределами трассы!',
    bounds: {
      minX: -32,
      maxX: -20,
      minY: 4,
      maxY: 14,
      minZ: 74,
      maxZ: 88,
    },
  });

  return {
    scene,
    worldRoot,
    gameId: 'obby',
    platforms,
    hazards,
    checkpoints,
    checkpointMeshes,
    collectibles,
    collectibleMeshes,
    dynamicRotators,
    placedBlockMeshes,
    trophyMesh,
    dummyMesh,
    secretAreas,
  };
}

/**
 * ============================================================================
 * GAME 2: THE FLOOR IS LAVA SURVIVAL 3D
 * ============================================================================
 */
function createLavaSurvivalWorld(scene: THREE.Scene, worldRoot: THREE.Group): WorldBuildResult {
  const platforms: THREE.Mesh[] = [];
  const hazards: ObstacleHazard[] = [];
  const checkpoints: Checkpoint[] = [];
  const checkpointMeshes: THREE.Group[] = [];
  const collectibles: CollectibleItem[] = [];
  const collectibleMeshes = new Map<string, THREE.Group>();
  const dynamicRotators: { group: THREE.Group; speed: number; axis: 'y' | 'z' }[] = [];
  const placedBlockMeshes = new Map<string, THREE.Mesh>();

  const studTexture = createStudTexture();

  // Materials for city, construction & boiling magma
  const rooftopMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, map: studTexture });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });
  const brickMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.8 });
  const woodPlankMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 });
  const steelGirderMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6, roughness: 0.35 });
  const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.25 });
  const hazardOrangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.8, roughness: 0.2 });
  const fireNeonMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.9, roughness: 0.2 });

  // 1. Rising Boiling Magma Ocean Plane
  const lavaGeo = new THREE.PlaneGeometry(350, 350, 32, 32);
  const lavaMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xff3b00,
    emissiveIntensity: 0.95,
    roughness: 0.15,
    metalness: 0.1,
  });
  const lavaSurface = new THREE.Mesh(lavaGeo, lavaMat);
  lavaSurface.rotation.x = -Math.PI / 2;
  lavaSurface.position.set(0, -1.0, 75);
  worldRoot.add(lavaSurface);

  // Large floor hazard covering the whole bottom void
  const lavaHazardBox = new THREE.Mesh(new THREE.BoxGeometry(350, 4, 350), lavaMat);
  lavaHazardBox.position.set(0, -3.0, 75);
  worldRoot.add(lavaHazardBox);
  hazards.push({
    id: 'lava_ocean',
    type: 'lava',
    mesh: lavaHazardBox,
    damage: 100,
    active: true,
  });

  // --- STAGE 0: Safe Spawn — "Blox Pizza & Cafe" Rooftop ---
  const spawnBuilding = createPlatform(worldRoot, platforms, 0, 0, 0, 16, 3, 16, rooftopMat);
  // Building walls below sinking into the lava
  const spawnWalls = new THREE.Mesh(new THREE.BoxGeometry(15.6, 20, 15.6), concreteMat);
  spawnWalls.position.set(0, -10, 0);
  worldRoot.add(spawnWalls);

  // Blox Pizza Neon Billboard Sign on spawn
  const signMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.7 });
  const signPost = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 0.4), darkSteelMat);
  signPost.position.set(-6, 4.5, -6);
  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(6, 1.8, 0.4), signMat);
  signBoard.position.set(-3.5, 5.5, -6);
  worldRoot.add(signPost, signBoard);

  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 0, 'Крыша Пиццерии (Старт)', 0, 3, 0, true);

  // --- STAGE 1: Wooden Escape Planks & Industrial Vents ---
  createPlatform(worldRoot, platforms, 0, 2.5, 14, 4, 1.2, 4, darkSteelMat);
  // Air conditioner vent unit
  const acMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 2.4), concreteMat);
  acMesh.position.set(0, 4.0, 14);
  worldRoot.add(acMesh);

  // Narrow Wooden Planks over boiling lava
  createPlatform(worldRoot, platforms, -4.0, 4.0, 22, 2.0, 0.8, 7.0, woodPlankMat);
  createPlatform(worldRoot, platforms, 4.0, 6.0, 31, 2.0, 0.8, 7.0, woodPlankMat);

  // --- STAGE 2: Skyscraper Rooftop with Rotating Laser Hazard ---
  createPlatform(worldRoot, platforms, 0, 8.5, 44, 14, 3, 14, brickMat);
  const towerWalls = new THREE.Mesh(new THREE.BoxGeometry(13.6, 30, 13.6), brickMat);
  towerWalls.position.set(0, -8, 44);
  worldRoot.add(towerWalls);

  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 1, 'Крыша Небоскрёба', 0, 11.5, 44, false);

  // Rotating laser vent hazard
  const laserVentGroup = new THREE.Group();
  laserVentGroup.position.set(0, 12.0, 44);
  const laserBeam1 = new THREE.Mesh(new THREE.BoxGeometry(13, 0.4, 0.4), fireNeonMat);
  const laserBeam2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 13), fireNeonMat);
  laserVentGroup.add(laserBeam1, laserBeam2);
  worldRoot.add(laserVentGroup);
  hazards.push({ id: 'laser_vent_1', type: 'spinner', mesh: laserBeam1, damage: 60, active: true });
  hazards.push({ id: 'laser_vent_2', type: 'spinner', mesh: laserBeam2, damage: 60, active: true });
  dynamicRotators.push({ group: laserVentGroup, speed: 1.8, axis: 'y' });

  // --- STAGE 3: Yellow Industrial Construction Crane ---
  createPlatform(worldRoot, platforms, 0, 14.0, 64, 8, 2, 8, concreteMat);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 2, 'Башенный Кран', 0, 16.0, 64, false);

  // Crane Central Tower (Yellow Steel Girders)
  const craneTower = new THREE.Mesh(new THREE.BoxGeometry(2.5, 24, 2.5), steelGirderMat);
  craneTower.position.set(0, 24, 76);
  worldRoot.add(craneTower);

  // Crane Horizontal Arm Balance Beams
  createPlatform(worldRoot, platforms, 0, 20.0, 76, 2.0, 1.0, 16.0, steelGirderMat);
  createPlatform(worldRoot, platforms, -5.0, 22.0, 84, 3.5, 1.0, 3.5, darkSteelMat);
  createPlatform(worldRoot, platforms, 5.0, 24.0, 92, 3.5, 1.0, 3.5, darkSteelMat);

  // Rotating Crane Counterweight Blade
  const craneSpinner = new THREE.Group();
  craneSpinner.position.set(0, 25.5, 84);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 0.5), hazardOrangeMat);
  craneSpinner.add(blade);
  worldRoot.add(craneSpinner);
  hazards.push({ id: 'crane_blade', type: 'spinner', mesh: blade, damage: 50, active: true });
  dynamicRotators.push({ group: craneSpinner, speed: -1.5, axis: 'y' });

  // --- STAGE 4: Stepping Volcano Pillars & Magma Geysers ---
  createPlatform(worldRoot, platforms, 0, 24.0, 106, 10, 2, 10, rooftopMat);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 3, 'Лавовые Гейзеры', 0, 26.0, 106, false);

  for (let i = 0; i < 4; i++) {
    const xPos = i % 2 === 0 ? -3.5 : 3.5;
    const yPos = 26.0 + i * 2.0;
    const zPos = 117 + i * 8;
    // Molten Pillar
    createPlatform(worldRoot, platforms, xPos, yPos, zPos, 3.2, 1.5, 3.2, darkSteelMat);
    // Molten Rim
    const rim = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 3.6), hazardOrangeMat);
    rim.position.set(xPos, yPos + 1.5, zPos);
    worldRoot.add(rim);
  }

  // --- STAGE 5: Penthouse & Sky Launch Trampoline ---
  createPlatform(worldRoot, platforms, 0, 33.0, 150, 12, 2, 12, concreteMat);
  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 4, 'Пентхаус (Трамплин)', 0, 35.0, 150, false);

  // High-bounce trampoline
  const trampMesh = createPlatform(worldRoot, platforms, 0, 35.0, 158, 4.5, 0.6, 4.5, hazardOrangeMat);
  hazards.push({ id: 'lava_trampoline', type: 'trampoline', mesh: trampMesh, damage: 0, active: true });

  // Floating Cloud Rooftop
  createPlatform(worldRoot, platforms, 0, 44.0, 172, 8, 2, 8, steelGirderMat);

  // --- STAGE 6: VIP Rooftop Helipad & Rescue Helicopter ---
  createPlatform(worldRoot, platforms, 0, 48.0, 192, 18, 3, 18, darkSteelMat);
  const heliTower = new THREE.Mesh(new THREE.BoxGeometry(17.6, 60, 17.6), concreteMat);
  heliTower.position.set(0, 18, 192);
  worldRoot.add(heliTower);

  // Painted Yellow "H" Helipad Ring
  const ringGeo = new THREE.RingGeometry(5.5, 6.5, 32);
  const heliMarkMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide });
  const heliRing = new THREE.Mesh(ringGeo, heliMarkMat);
  heliRing.rotation.x = -Math.PI / 2;
  heliRing.position.set(0, 51.1, 192);
  worldRoot.add(heliRing);

  createCheckPointMesh(worldRoot, checkpoints, checkpointMeshes, 5, 'VIP Вертолётная Площадка', 0, 51.0, 192, false);

  // Blox Rescue Helicopter Model
  const chopperGroup = createRescueHelicopter();
  chopperGroup.position.set(0, 51.5, 192);
  worldRoot.add(chopperGroup);
  // Animate main helicopter rotor
  const mainRotor = chopperGroup.getObjectByName('MainRotor');
  if (mainRotor) {
    dynamicRotators.push({ group: mainRotor as THREE.Group, speed: 18.0, axis: 'y' });
  }

  // Golden Survival Trophy at center of Helipad
  const trophyMesh = createGoldenTrophy();
  trophyMesh.position.set(0, 51.5, 192);
  worldRoot.add(trophyMesh);
  dynamicRotators.push({ group: trophyMesh, speed: 1.2, axis: 'y' });

  // Dummy target to punch
  const dummyMesh = createPracticeDummy();
  dummyMesh.position.set(5.5, 51.5, 190);
  worldRoot.add(dummyMesh);

  // Coins & Red Gems scattered across the rooftops
  const lavaCollectibles: [number, number, number, 'coin' | 'gem'][] = [
    [0, 5.0, 14, 'coin'],
    [-4.0, 6.5, 22, 'coin'],
    [4.0, 8.5, 31, 'gem'],
    [0, 13.5, 44, 'coin'],
    [0, 22.0, 76, 'coin'],
    [-5.0, 24.5, 84, 'gem'],
    [5.0, 26.5, 92, 'coin'],
    [-3.5, 29.5, 117, 'coin'],
    [3.5, 33.5, 133, 'gem'],
    [0, 37.0, 150, 'coin'],
    [0, 46.5, 172, 'gem'],
    [-4.5, 53.0, 192, 'coin'],
    [4.5, 53.0, 192, 'gem'],
  ];

  lavaCollectibles.forEach((item, idx) => {
    const id = `lava_col_${idx}`;
    const isGem = item[3] === 'gem';
    const mesh = isGem ? createGemMesh() : createCoinMesh();
    mesh.position.set(item[0], item[1], item[2]);
    worldRoot.add(mesh);
    collectibleMeshes.set(id, mesh);
    collectibles.push({
      id,
      type: item[3],
      position: [item[0], item[1], item[2]],
      value: isGem ? 100 : 50,
      collected: false,
    });
    dynamicRotators.push({ group: mesh, speed: 2.2, axis: 'y' });
  });

  // --- SECRET AREA: Тайное Убежище Крана (Crane Rooftop Hideout) ---
  const secretAreas: SecretArea[] = [];
  const vipGoldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.8,
    roughness: 0.2,
    emissive: 0xca8a04,
    emissiveIntensity: 0.4,
  });

  // Secret perch high atop the crane counterweight (X: 0, Y: 30, Z: 76)
  createPlatform(worldRoot, platforms, 0, 29.0, 76, 5.0, 1.2, 5.0, vipGoldMat);

  // Secret Diamond Gem on the crane roof
  const secretLavaGemId = 'gem_secret_crane';
  const secretGemMesh = createGemMesh();
  secretGemMesh.scale.set(1.5, 1.5, 1.5);
  secretGemMesh.position.set(0, 31.5, 76);
  worldRoot.add(secretGemMesh);
  collectibleMeshes.set(secretLavaGemId, secretGemMesh);
  collectibles.push({ id: secretLavaGemId, type: 'gem', position: [0, 31.5, 76], value: 300, collected: false });
  dynamicRotators.push({ group: secretGemMesh, speed: 2.5, axis: 'y' });

  secretAreas.push({
    id: 'secret_crane_hideout',
    name: 'Тайное Убежище Крана',
    description: 'Секретная золотая площадка на верхушке башенного крана!',
    bounds: {
      minX: -4,
      maxX: 4,
      minY: 28,
      maxY: 36,
      minZ: 72,
      maxZ: 80,
    },
  });

  return {
    scene,
    worldRoot,
    gameId: 'lava_survival',
    platforms,
    hazards,
    checkpoints,
    checkpointMeshes,
    collectibles,
    collectibleMeshes,
    dynamicRotators,
    placedBlockMeshes,
    trophyMesh,
    dummyMesh,
    lavaSurface,
    secretAreas,
  };
}

/**
 * Creates Checkpoint mesh + Flag
 */
function createCheckPointMesh(
  worldRoot: THREE.Group,
  checkpoints: Checkpoint[],
  checkpointMeshes: THREE.Group[],
  id: number,
  name: string,
  x: number,
  y: number,
  z: number,
  activated: boolean
) {
  checkpoints.push({ id, name, position: [x, y, z], activated });

  const group = new THREE.Group();
  group.position.set(x, y, z);

  // Platform pad
  const padGeo = new THREE.CylinderGeometry(2.2, 2.4, 0.4, 16);
  const padMat = new THREE.MeshStandardMaterial({
    color: activated ? 0x22c55e : 0x64748b,
    roughness: 0.4,
    emissive: activated ? 0x15803d : 0x000000,
    emissiveIntensity: 0.4,
  });
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.name = 'CheckpointPad';

  // Pole
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.2 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(1.5, 1.6, 0);

  // Flag banner
  const flagGeo = new THREE.BoxGeometry(1.2, 0.7, 0.06);
  const flagMat = new THREE.MeshStandardMaterial({
    color: activated ? 0x22c55e : 0xef4444,
    emissive: activated ? 0x16a34a : 0xb91c1c,
    emissiveIntensity: 0.5,
  });
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.name = 'CheckpointFlag';
  flag.position.set(2.1, 2.7, 0);

  group.add(pad, pole, flag);
  worldRoot.add(group);
  checkpointMeshes.push(group);
}

/**
 * Creates 3D Gold Coin
 */
function createCoinMesh(): THREE.Group {
  const group = new THREE.Group();
  const coinGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.18, 16);
  const coinMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.9,
    roughness: 0.15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.35,
  });
  const coin = new THREE.Mesh(coinGeo, coinMat);
  coin.rotation.z = Math.PI / 2;
  group.add(coin);
  return group;
}

/**
 * Creates 3D Diamond Gem
 */
function createGemMesh(): THREE.Group {
  const group = new THREE.Group();
  const gemGeo = new THREE.OctahedronGeometry(0.8, 0);
  const gemMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    metalness: 0.2,
    roughness: 0.1,
    emissive: 0x0284c7,
    emissiveIntensity: 0.8,
  });
  const gem = new THREE.Mesh(gemGeo, gemMat);
  group.add(gem);
  return group;
}

/**
 * Creates Practice Punching Dummy
 */
function createPracticeDummy(): THREE.Group {
  const dummy = new THREE.Group();
  dummy.name = 'PracticeDummy';

  const woodMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
  const strawMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.8 });

  // Post
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.5, 8), woodMat);
  post.position.set(0, 1.75, 0);

  // Body
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.6, 12), strawMat);
  body.position.set(0, 2.2, 0);

  // Target
  const targetMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.4 });
  const target = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.08, 16), targetMat);
  target.rotation.x = Math.PI / 2;
  target.position.set(0, 2.2, 0.72);

  dummy.add(post, body, target);
  return dummy;
}

/**
 * Creates Golden Roblox Summit Trophy
 */
function createGoldenTrophy(): THREE.Group {
  const trophy = new THREE.Group();
  trophy.name = 'GoldenTrophy';

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.9,
    roughness: 0.15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.4,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 2.2), goldMat);
  base.position.set(0, 0.3, 0);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 1.8, 16), goldMat);
  stem.position.set(0, 1.4, 0);

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 0.5, 2.0, 16), goldMat);
  cup.position.set(0, 3.0, 0);

  // Handles
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2 });
  const handleL = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.15, 8, 16, Math.PI), handleMat);
  handleL.position.set(-1.6, 3.0, 0);
  handleL.rotation.z = Math.PI / 2;

  const handleR = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.15, 8, 16, Math.PI), handleMat);
  handleR.position.set(1.6, 3.0, 0);
  handleR.rotation.z = -Math.PI / 2;

  // Star inside cup
  const starMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfef08a, emissiveIntensity: 0.9, roughness: 0.1 });
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), starMat);
  star.position.set(0, 4.2, 0);

  trophy.add(base, stem, cup, handleL, handleR, star);
  return trophy;
}

/**
 * Creates Blox Rescue Helicopter for VIP Helipad in Lava Survival
 */
function createRescueHelicopter(): THREE.Group {
  const heli = new THREE.Group();
  heli.name = 'RescueHelicopter';

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4, metalness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, transparent: true, opacity: 0.7, roughness: 0.1 });
  const skidMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.4 });

  // Main Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 5.0), bodyMat);
  cabin.position.set(0, 2.0, 0);

  // Cockpit Glass
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.8, 2.2), glassMat);
  cockpit.position.set(0, 2.2, 2.2);

  // Tail Boom
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 6.0), bodyMat);
  tail.position.set(0, 2.3, -5.0);

  // Landing Skids
  const skidL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.5, 8), skidMat);
  skidL.rotation.x = Math.PI / 2;
  skidL.position.set(-1.6, 0.4, 0);

  const skidR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.5, 8), skidMat);
  skidR.rotation.x = Math.PI / 2;
  skidR.position.set(1.6, 0.4, 0);

  // Main Rotor Hub & Blades
  const mainRotorGroup = new THREE.Group();
  mainRotorGroup.name = 'MainRotor';
  mainRotorGroup.position.set(0, 3.4, 0);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.8, 8), skidMat);
  const blade1 = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.12, 0.6), bladeMat);
  const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 11.0), bladeMat);
  mainRotorGroup.add(mast, blade1, blade2);

  heli.add(cabin, cockpit, tail, skidL, skidR, mainRotorGroup);
  return heli;
}

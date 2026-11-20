export type StudioToolMode = 'place' | 'select' | 'erase' | 'camera';

export type StudioObjectKind =
  | 'block'
  | 'ramp'
  | 'lava'
  | 'trampoline'
  | 'spinner'
  | 'checkpoint'
  | 'coin'
  | 'gem'
  | 'trophy'
  | 'spawn';

export type StudioMaterialKind = 'plastic' | 'neon' | 'glass' | 'wood' | 'metal';

export type StudioSkyPreset = 'day' | 'sunset' | 'night' | 'cyber';

export type StudioTemplateId = 'empty_baseplate' | 'starter_obby' | 'bounce_tower';

export interface StudioObject {
  id: string;
  kind: StudioObjectKind;
  position: [number, number, number]; // [x, baseY, z]
  size: [number, number, number]; // [width, height, depth]
  rotationY: number; // degrees: 0, 90, 180, 270
  color: string;
  material: StudioMaterialKind;
}

export interface StudioProject {
  version: 1;
  name: string;
  skyPreset: StudioSkyPreset;
  gridSize: 1 | 2 | 4;
  objects: StudioObject[];
  updatedAt: number;
}

export interface StudioRuntimeState {
  mode: 'edit' | 'play';
  tool: StudioToolMode;
  activeKind: StudioObjectKind;
  activeColor: string;
  activeMaterial: StudioMaterialKind;
  activeSize: [number, number, number];
  activeRotationY: number;
  gridSize: 1 | 2 | 4;
  skyPreset: StudioSkyPreset;
  selectedId: string | null;
  selectedObject: StudioObject | null;
  objectCount: number;
  maxObjects: number;
  canUndo: boolean;
  canRedo: boolean;
  projectName: string;
}

export interface StudioPartPreset {
  kind: StudioObjectKind;
  shortTitle: string;
  description: string;
  defaultSize: [number, number, number];
  defaultColor: string;
  defaultMaterial: StudioMaterialKind;
}

export const STUDIO_STORAGE_KEY = 'blox_studio_project_v1';
export const STUDIO_MAX_OBJECTS = 300;

export const STUDIO_COLORS: { hex: string; name: string }[] = [
  { hex: '#38bdf8', name: 'Голубой' },
  { hex: '#22c55e', name: 'Зелёный' },
  { hex: '#facc15', name: 'Жёлтый' },
  { hex: '#f97316', name: 'Оранжевый' },
  { hex: '#ef4444', name: 'Красный' },
  { hex: '#ec4899', name: 'Розовый' },
  { hex: '#a855f7', name: 'Фиолетовый' },
  { hex: '#f8fafc', name: 'Белый' },
  { hex: '#64748b', name: 'Серый' },
  { hex: '#0f172a', name: 'Тёмный' },
];

export const STUDIO_PART_PRESETS: StudioPartPreset[] = [
  {
    kind: 'block',
    shortTitle: 'Блок',
    description: 'Строительный куб / опора',
    defaultSize: [2, 2, 2],
    defaultColor: '#38bdf8',
    defaultMaterial: 'plastic',
  },
  {
    kind: 'block',
    shortTitle: 'Плита',
    description: 'Широкая паркур-платформа',
    defaultSize: [6, 1, 6],
    defaultColor: '#22c55e',
    defaultMaterial: 'plastic',
  },
  {
    kind: 'ramp',
    shortTitle: 'Рампа',
    description: 'Ступенчатый подъём / трап',
    defaultSize: [4, 2, 6],
    defaultColor: '#f59e0b',
    defaultMaterial: 'wood',
  },
  {
    kind: 'lava',
    shortTitle: 'Лава',
    description: 'Опасный Kill-Brick (сброс на чекпоинт)',
    defaultSize: [6, 0.8, 6],
    defaultColor: '#ef4444',
    defaultMaterial: 'neon',
  },
  {
    kind: 'trampoline',
    shortTitle: 'Батут',
    description: 'Супер-прыжок вверх',
    defaultSize: [4, 0.8, 4],
    defaultColor: '#ec4899',
    defaultMaterial: 'neon',
  },
  {
    kind: 'spinner',
    shortTitle: 'Лазер',
    description: 'Вращающаяся лазерная балка',
    defaultSize: [10, 0.8, 1],
    defaultColor: '#f43f5e',
    defaultMaterial: 'neon',
  },
  {
    kind: 'checkpoint',
    shortTitle: 'Чекпоинт',
    description: 'Точка сохранения с флагом',
    defaultSize: [4, 0.5, 4],
    defaultColor: '#22c55e',
    defaultMaterial: 'metal',
  },
  {
    kind: 'coin',
    shortTitle: 'Монета',
    description: 'Золотая монета (+50)',
    defaultSize: [1.5, 1.5, 1.5],
    defaultColor: '#facc15',
    defaultMaterial: 'metal',
  },
  {
    kind: 'gem',
    shortTitle: 'Кристалл',
    description: 'Редкий алмаз (+100)',
    defaultSize: [1.6, 2, 1.6],
    defaultColor: '#a855f7',
    defaultMaterial: 'glass',
  },
  {
    kind: 'trophy',
    shortTitle: 'Финиш',
    description: 'Золотой кубок победы',
    defaultSize: [3, 4, 3],
    defaultColor: '#fbbf24',
    defaultMaterial: 'metal',
  },
  {
    kind: 'spawn',
    shortTitle: 'Спавн',
    description: 'Стартовая площадка игрока',
    defaultSize: [6, 0.5, 6],
    defaultColor: '#0ea5e9',
    defaultMaterial: 'metal',
  },
];

const VALID_KINDS = new Set<StudioObjectKind>([
  'block',
  'ramp',
  'lava',
  'trampoline',
  'spinner',
  'checkpoint',
  'coin',
  'gem',
  'trophy',
  'spawn',
]);

const VALID_MATERIALS = new Set<StudioMaterialKind>(['plastic', 'neon', 'glass', 'wood', 'metal']);
const VALID_SKIES = new Set<StudioSkyPreset>(['day', 'sunset', 'night', 'cyber']);

export function createStudioObjectId(): string {
  return `st_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeStudioRotationY(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  const snapped = Math.round(deg / 90) * 90;
  return ((snapped % 360) + 360) % 360;
}

export function getRotatedStudioFootprint(
  size: [number, number, number],
  rotationY: number
): [number, number, number] {
  const norm = normalizeStudioRotationY(rotationY);
  if (norm === 90 || norm === 270) {
    return [size[2], size[1], size[0]];
  }
  return [size[0], size[1], size[2]];
}

export function computeStudioSnapPosition(
  hitPoint: { x: number; y: number; z: number },
  hitNormal: { x: number; y: number; z: number },
  objectSize: [number, number, number],
  gridSize: number,
  rotationY: number = 0
): [number, number, number] {
  const safeGrid = gridSize > 0 ? gridSize : 1;
  const [effW, effH, effD] = getRotatedStudioFootprint(objectSize, rotationY);

  const offsetX = hitNormal.x * (effW / 2);
  const offsetZ = hitNormal.z * (effD / 2);

  const rawX = hitPoint.x + offsetX;
  const rawZ = hitPoint.z + offsetZ;

  let rawY = hitPoint.y;
  if (hitNormal.y > 0.5) {
    rawY = hitPoint.y;
  } else if (hitNormal.y < -0.5) {
    rawY = hitPoint.y - effH;
  } else {
    // Clicking the vertical side of a part: keep aligned near clicked height
    rawY = Math.floor(hitPoint.y * 2) / 2;
  }

  const snapX = Math.round(rawX / safeGrid) * safeGrid;
  const snapZ = Math.round(rawZ / safeGrid) * safeGrid;
  const snapY = Math.max(0, Math.round(rawY * 2) / 2);

  return [
    Math.max(-116, Math.min(116, Number(snapX.toFixed(2)))),
    Math.max(0, Math.min(120, Number(snapY.toFixed(2)))),
    Math.max(-116, Math.min(116, Number(snapZ.toFixed(2)))),
  ];
}

export function cloneStudioObjects(objects: StudioObject[]): StudioObject[] {
  return objects.map((obj) => ({
    ...obj,
    position: [...obj.position] as [number, number, number],
    size: [...obj.size] as [number, number, number],
  }));
}

export function sanitizeStudioObject(raw: unknown): StudioObject | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const kind = VALID_KINDS.has(obj.kind as StudioObjectKind) ? (obj.kind as StudioObjectKind) : 'block';
  const material = VALID_MATERIALS.has(obj.material as StudioMaterialKind)
    ? (obj.material as StudioMaterialKind)
    : 'plastic';

  const rawPos = Array.isArray(obj.position) ? obj.position : [0, 0, 0];
  const rawSize = Array.isArray(obj.size) ? obj.size : [2, 2, 2];

  const px = Number(rawPos[0]);
  const py = Number(rawPos[1]);
  const pz = Number(rawPos[2]);
  if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) return null;

  const sx = Math.max(0.5, Math.min(40, Number(rawSize[0]) || 2));
  const sy = Math.max(0.5, Math.min(40, Number(rawSize[1]) || 2));
  const sz = Math.max(0.5, Math.min(40, Number(rawSize[2]) || 2));

  const colorStr =
    typeof obj.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(obj.color.trim())
      ? obj.color.trim()
      : '#38bdf8';

  const id =
    typeof obj.id === 'string' && obj.id.trim().length > 0
      ? obj.id.trim().slice(0, 48)
      : createStudioObjectId();

  return {
    id,
    kind,
    position: [
      Math.max(-118, Math.min(118, Number(px.toFixed(2)))),
      Math.max(0, Math.min(120, Number(py.toFixed(2)))),
      Math.max(-118, Math.min(118, Number(pz.toFixed(2)))),
    ],
    size: [Number(sx.toFixed(1)), Number(sy.toFixed(1)), Number(sz.toFixed(1))],
    rotationY: normalizeStudioRotationY(Number(obj.rotationY) || 0),
    color: colorStr,
    material,
  };
}

export function createTemplateProject(templateId: StudioTemplateId): StudioProject {
  const now = Date.now();

  if (templateId === 'empty_baseplate') {
    return {
      version: 1,
      name: 'Чистая База',
      skyPreset: 'day',
      gridSize: 2,
      updatedAt: now,
      objects: [
        {
          id: 'tpl_empty_spawn',
          kind: 'spawn',
          position: [0, 0, 0],
          size: [8, 0.5, 8],
          rotationY: 0,
          color: '#0ea5e9',
          material: 'metal',
        },
      ],
    };
  }

  if (templateId === 'bounce_tower') {
    return {
      version: 1,
      name: 'Башня Прыжков',
      skyPreset: 'sunset',
      gridSize: 2,
      updatedAt: now,
      objects: [
        { id: 'bt_spawn', kind: 'spawn', position: [0, 0, 0], size: [8, 0.5, 8], rotationY: 0, color: '#0ea5e9', material: 'metal' },
        { id: 'bt_b1', kind: 'trampoline', position: [0, 0, 8], size: [4, 0.8, 4], rotationY: 0, color: '#ec4899', material: 'neon' },
        { id: 'bt_p1', kind: 'block', position: [0, 8, 16], size: [8, 1.5, 8], rotationY: 0, color: '#f97316', material: 'plastic' },
        { id: 'bt_c1', kind: 'coin', position: [0, 10, 16], size: [1.5, 1.5, 1.5], rotationY: 0, color: '#facc15', material: 'metal' },
        { id: 'bt_b2', kind: 'trampoline', position: [0, 9.5, 22], size: [4, 0.8, 4], rotationY: 0, color: '#ec4899', material: 'neon' },
        { id: 'bt_p2', kind: 'block', position: [-6, 17.5, 28], size: [8, 1.5, 8], rotationY: 0, color: '#a855f7', material: 'glass' },
        { id: 'bt_cp1', kind: 'checkpoint', position: [-6, 19, 28], size: [4, 0.5, 4], rotationY: 0, color: '#22c55e', material: 'metal' },
        { id: 'bt_b3', kind: 'trampoline', position: [-6, 19, 34], size: [4, 0.8, 4], rotationY: 0, color: '#ec4899', material: 'neon' },
        { id: 'bt_p3', kind: 'block', position: [0, 27, 42], size: [10, 2, 10], rotationY: 0, color: '#22c55e', material: 'plastic' },
        { id: 'bt_gem', kind: 'gem', position: [-3, 29.5, 42], size: [1.6, 2, 1.6], rotationY: 0, color: '#38bdf8', material: 'glass' },
        { id: 'bt_trophy', kind: 'trophy', position: [0, 29, 44], size: [3, 4, 3], rotationY: 0, color: '#fbbf24', material: 'metal' },
      ],
    };
  }

  // Default: 'starter_obby'
  return {
    version: 1,
    name: 'Мой Первый Паркур',
    skyPreset: 'day',
    gridSize: 2,
    updatedAt: now,
    objects: [
      { id: 'so_spawn', kind: 'spawn', position: [0, 0, 0], size: [8, 0.5, 8], rotationY: 0, color: '#0ea5e9', material: 'metal' },
      { id: 'so_p1', kind: 'block', position: [0, 0.5, 10], size: [5, 1.5, 5], rotationY: 0, color: '#22c55e', material: 'plastic' },
      { id: 'so_coin1', kind: 'coin', position: [0, 2.5, 10], size: [1.5, 1.5, 1.5], rotationY: 0, color: '#facc15', material: 'metal' },
      { id: 'so_p2', kind: 'block', position: [4, 2, 18], size: [5, 1.5, 5], rotationY: 0, color: '#38bdf8', material: 'plastic' },
      { id: 'so_p3', kind: 'block', position: [-4, 3.5, 26], size: [5, 1.5, 5], rotationY: 0, color: '#f97316', material: 'plastic' },
      { id: 'so_lava', kind: 'lava', position: [0, 0, 22], size: [18, 0.8, 12], rotationY: 0, color: '#ef4444', material: 'neon' },
      { id: 'so_cp1', kind: 'block', position: [0, 4.5, 36], size: [10, 2, 8], rotationY: 0, color: '#22c55e', material: 'plastic' },
      { id: 'so_flag1', kind: 'checkpoint', position: [0, 6.5, 36], size: [4, 0.5, 4], rotationY: 0, color: '#22c55e', material: 'metal' },
      { id: 'so_ramp', kind: 'ramp', position: [0, 6.5, 44], size: [5, 2.5, 7], rotationY: 0, color: '#f59e0b', material: 'wood' },
      { id: 'so_p4', kind: 'block', position: [0, 9, 54], size: [10, 1.5, 10], rotationY: 0, color: '#a855f7', material: 'glass' },
      { id: 'so_spin', kind: 'spinner', position: [0, 10.8, 54], size: [9, 0.7, 0.8], rotationY: 0, color: '#f43f5e', material: 'neon' },
      { id: 'so_bounce', kind: 'trampoline', position: [0, 10.5, 62], size: [4, 0.8, 4], rotationY: 0, color: '#ec4899', material: 'neon' },
      { id: 'so_finish_pad', kind: 'block', position: [0, 18, 76], size: [12, 2, 12], rotationY: 0, color: '#22c55e', material: 'plastic' },
      { id: 'so_gem', kind: 'gem', position: [-3.5, 20.5, 76], size: [1.6, 2, 1.6], rotationY: 0, color: '#a855f7', material: 'glass' },
      { id: 'so_trophy', kind: 'trophy', position: [0, 20, 78], size: [3, 4, 3], rotationY: 0, color: '#fbbf24', material: 'metal' },
    ],
  };
}

export function sanitizeStudioProject(raw: unknown): StudioProject {
  if (!raw || typeof raw !== 'object') {
    return createTemplateProject('starter_obby');
  }
  const data = raw as Record<string, unknown>;
  const name =
    typeof data.name === 'string' && data.name.trim().length > 0
      ? data.name.trim().slice(0, 40)
      : 'Мой Первый Паркур';
  const skyPreset: StudioSkyPreset = VALID_SKIES.has(data.skyPreset as StudioSkyPreset)
    ? (data.skyPreset as StudioSkyPreset)
    : 'day';
  const rawGrid = Number(data.gridSize);
  const gridSize: 1 | 2 | 4 = rawGrid === 1 || rawGrid === 4 ? rawGrid : 2;

  const objects: StudioObject[] = [];
  if (Array.isArray(data.objects)) {
    for (const item of data.objects) {
      if (objects.length >= STUDIO_MAX_OBJECTS) break;
      const clean = sanitizeStudioObject(item);
      if (clean) objects.push(clean);
    }
  }

  return {
    version: 1,
    name,
    skyPreset,
    gridSize,
    objects,
    updatedAt: typeof data.updatedAt === 'number' && Number.isFinite(data.updatedAt) ? data.updatedAt : Date.now(),
  };
}

export function loadStudioProject(): StudioProject {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return createTemplateProject('starter_obby');
  }
  try {
    const raw = localStorage.getItem(STUDIO_STORAGE_KEY);
    if (!raw) {
      const starter = createTemplateProject('starter_obby');
      saveStudioProject(starter);
      return starter;
    }
    const parsed = JSON.parse(raw);
    return sanitizeStudioProject(parsed);
  } catch {
    return createTemplateProject('starter_obby');
  }
}

export function saveStudioProject(project: StudioProject): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    const clean = sanitizeStudioProject(project);
    localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Ignore quota errors
  }
}

export function exportStudioProjectJson(project: StudioProject): string {
  return JSON.stringify(sanitizeStudioProject(project), null, 2);
}

export function importStudioProjectJson(jsonText: string): StudioProject | null {
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as StudioProject).objects)) {
      return null;
    }
    return sanitizeStudioProject(parsed);
  } catch {
    return null;
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STUDIO_COLORS,
  STUDIO_MAX_OBJECTS,
  STUDIO_PART_PRESETS,
  computeStudioSnapPosition,
  createTemplateProject,
  exportStudioProjectJson,
  getRotatedStudioFootprint,
  importStudioProjectJson,
  loadStudioProject,
  normalizeStudioRotationY,
  saveStudioProject,
} from './studio';

function createMockLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

test('STUDIO_PART_PRESETS and STUDIO_COLORS are properly defined', () => {
  assert.equal(STUDIO_PART_PRESETS.length, 11);
  assert.equal(STUDIO_COLORS.length, 10);
  assert.ok(STUDIO_MAX_OBJECTS >= 300);
});

test('normalizeStudioRotationY wraps to 0/90/180/270 and getRotatedStudioFootprint swaps X/Z at 90/270', () => {
  assert.equal(normalizeStudioRotationY(0), 0);
  assert.equal(normalizeStudioRotationY(90), 90);
  assert.equal(normalizeStudioRotationY(-90), 270);
  assert.equal(normalizeStudioRotationY(450), 90);

  assert.deepEqual(getRotatedStudioFootprint([6, 2, 2], 0), [6, 2, 2]);
  assert.deepEqual(getRotatedStudioFootprint([6, 2, 2], 90), [2, 2, 6]);
  assert.deepEqual(getRotatedStudioFootprint([6, 2, 2], 180), [6, 2, 2]);
  assert.deepEqual(getRotatedStudioFootprint([6, 2, 2], 270), [2, 2, 6]);
});

test('computeStudioSnapPosition snaps cleanly onto baseplate and block top/side surfaces', () => {
  // Baseplate top hit (y = 0)
  const onFloor = computeStudioSnapPosition(
    { x: 3.1, y: 0, z: 7.8 },
    { x: 0, y: 1, z: 0 },
    [2, 2, 2],
    2
  );
  assert.deepEqual(onFloor, [4, 0, 8]);

  // Top of 2-unit block (y = 2)
  const onBlockTop = computeStudioSnapPosition(
    { x: 4.2, y: 2, z: 8.1 },
    { x: 0, y: 1, z: 0 },
    [2, 2, 2],
    2
  );
  assert.deepEqual(onBlockTop, [4, 2, 8]);

  // Side (+X normal) of block at x=5 -> center at 5 + 1 = 6
  const onSide = computeStudioSnapPosition(
    { x: 5, y: 1, z: 8 },
    { x: 1, y: 0, z: 0 },
    [2, 2, 2],
    2
  );
  assert.deepEqual(onSide, [6, 1, 8]);
});

test('createTemplateProject generates starter_obby, bounce_tower, and empty_baseplate', () => {
  const starter = createTemplateProject('starter_obby');
  assert.ok(starter.objects.length >= 10);
  assert.ok(starter.objects.some((o) => o.kind === 'spawn'));
  assert.ok(starter.objects.some((o) => o.kind === 'trophy'));

  const tower = createTemplateProject('bounce_tower');
  assert.ok(tower.objects.some((o) => o.kind === 'trampoline'));
  assert.equal(tower.skyPreset, 'sunset');

  const empty = createTemplateProject('empty_baseplate');
  assert.equal(empty.objects.length, 1);
  assert.equal(empty.objects[0].kind, 'spawn');
});

test('JSON export/import round-trips and rejects malformed JSON safely', () => {
  const tpl = createTemplateProject('bounce_tower');
  const json = exportStudioProjectJson(tpl);
  const imported = importStudioProjectJson(json);
  assert.ok(imported);
  assert.equal(imported.name, tpl.name);
  assert.equal(imported.objects.length, tpl.objects.length);

  assert.equal(importStudioProjectJson('{not json'), null);
  assert.equal(importStudioProjectJson('{"name":"NoObjects"}'), null);
});

test('saveStudioProject and loadStudioProject persist in storage', () => {
  const mockStorage = createMockLocalStorage();
  (globalThis as any).window = globalThis;
  (globalThis as any).localStorage = mockStorage;

  const custom = createTemplateProject('empty_baseplate');
  custom.name = 'Моя База 777';
  saveStudioProject(custom);

  const loaded = loadStudioProject();
  assert.equal(loaded.name, 'Моя База 777');
  assert.equal(loaded.objects.length, 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_ACHIEVEMENTS } from './achievements';
import {
  ALL_PLAYER_TITLES,
  getPlayerTitleById,
  getTitleForAchievement,
  getUnlockedPlayerTitles,
  isTitleUnlocked,
  sanitizeEquippedTitleId,
} from './titles';

test('every achievement in ALL_ACHIEVEMENTS unlocks a unique Player Title', () => {
  const seenIds = new Set<string>();
  for (const ach of ALL_ACHIEVEMENTS) {
    const title = getTitleForAchievement(ach.id);
    assert.ok(title, `Expected achievement "${ach.id}" to map to a Player Title`);
    assert.equal(title.achievementId, ach.id);
    assert.ok(!seenIds.has(title.id), `Duplicate title id "${title.id}"`);
    seenIds.add(title.id);
  }
  assert.equal(ALL_PLAYER_TITLES.length, ALL_ACHIEVEMENTS.length);
});

test('requested example titles Pro Parkourer and Lava Survivor are mapped cleanly', () => {
  const parkourTitle = getTitleForAchievement('jump_50_streak');
  assert.ok(parkourTitle);
  assert.equal(parkourTitle.label, 'Pro Parkourer');
  assert.equal(getPlayerTitleById(parkourTitle.id)?.label, 'Pro Parkourer');

  const lavaTitle = getTitleForAchievement('lava_survivor_60');
  assert.ok(lavaTitle);
  assert.equal(lavaTitle.label, 'Lava Survivor');
  assert.equal(getPlayerTitleById(lavaTitle.id)?.label, 'Lava Survivor');
});

test('getUnlockedPlayerTitles and isTitleUnlocked respect unlocked achievements map', () => {
  const unlocked = {
    jump_50_streak: 1700000000000,
    lava_survivor_60: 1700000005000,
  };

  assert.equal(isTitleUnlocked('pro_parkourer', unlocked), true);
  assert.equal(isTitleUnlocked('lava_survivor', unlocked), true);
  assert.equal(isTitleUnlocked('secret_hunter', unlocked), false);
  assert.equal(isTitleUnlocked('nonexistent_title', unlocked), false);
  assert.equal(isTitleUnlocked(null, unlocked), false);

  const unlockedList = getUnlockedPlayerTitles(unlocked);
  assert.deepEqual(
    unlockedList.map((t) => t.id),
    ['pro_parkourer', 'lava_survivor']
  );
});

test('sanitizeEquippedTitleId rejects locked or invalid title IDs and keeps unlocked ones', () => {
  const unlocked = { jump_50_streak: 1700000000000 };

  assert.equal(sanitizeEquippedTitleId('pro_parkourer', unlocked), 'pro_parkourer');
  assert.equal(sanitizeEquippedTitleId('lava_survivor', unlocked), null);
  assert.equal(sanitizeEquippedTitleId('fake_title', unlocked), null);
  assert.equal(sanitizeEquippedTitleId(null, unlocked), null);
  assert.equal(sanitizeEquippedTitleId('pro_parkourer', {}), null);
});

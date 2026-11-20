import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_QUEST_COUNT,
  QUEST_POOL,
  RESET_INTERVAL_MS,
  advanceQuestProgress,
  claimAllReadyQuestRewards,
  claimQuestReward,
  formatResetCountdown,
  generateRandomDailyQuests,
  getDailyQuestsState,
  rerollQuest,
  saveDailyQuestsState,
} from './quests';

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

test('generateRandomDailyQuests picks 3 unique tasks with distinct categories', () => {
  const quests = generateRandomDailyQuests(DAILY_QUEST_COUNT);
  assert.equal(quests.length, 3);

  const ids = new Set(quests.map((q) => q.id));
  const categories = new Set(quests.map((q) => q.category));
  assert.equal(ids.size, 3);
  assert.equal(categories.size, 3);

  for (const q of quests) {
    assert.equal(q.progress, 0);
    assert.equal(q.completed, false);
    assert.equal(q.claimed, false);
    assert.ok(q.target > 0);
    assert.ok(q.rewardCoins > 0);
  }
});

test('getDailyQuestsState persists quests before 24h and resets cleanly after 24h', () => {
  (globalThis as any).localStorage = createMockLocalStorage();

  const t0 = 1_700_000_000_000;
  const initial = getDailyQuestsState(t0);
  assert.equal(initial.quests.length, 3);
  assert.equal(initial.generatedAt, t0);
  assert.equal(initial.expiresAt, t0 + RESET_INTERVAL_MS);

  // Advance progress on first quest before 24h elapses
  const first = initial.quests[0];
  advanceQuestProgress(first.category, 5, t0 + 60_000);
  const midDay = getDailyQuestsState(t0 + 12 * 60 * 60 * 1000);
  assert.equal(midDay.quests[0].id, first.id);
  assert.equal(midDay.quests[0].progress, Math.min(first.target, 5));

  // After 24h elapses, quests reset with fresh 24h window and zero progress
  const tReset = t0 + RESET_INTERVAL_MS;
  const resetState = getDailyQuestsState(tReset);
  assert.equal(resetState.quests.length, 3);
  assert.equal(resetState.generatedAt, tReset);
  assert.equal(resetState.expiresAt, tReset + RESET_INTERVAL_MS);
  for (const q of resetState.quests) {
    assert.equal(q.progress, 0);
    assert.equal(q.completed, false);
    assert.equal(q.claimed, false);
  }
});

test('advanceQuestProgress and claimQuestReward handle completion and prevent double claims', () => {
  (globalThis as any).localStorage = createMockLocalStorage();

  const t0 = 1_700_000_000_000;
  const jumpQuest = { ...QUEST_POOL.find((q) => q.id === 'quest_jumps_50')!, progress: 0, completed: false, claimed: false };
  const coinQuest = { ...QUEST_POOL.find((q) => q.id === 'quest_collect_coins_10')!, progress: 0, completed: false, claimed: false };
  const lavaQuest = { ...QUEST_POOL.find((q) => q.id === 'quest_survive_lava_60')!, progress: 0, completed: false, claimed: false };

  saveDailyQuestsState({
    quests: [jumpQuest, coinQuest, lavaQuest],
    generatedAt: t0,
    expiresAt: t0 + RESET_INTERVAL_MS,
  });

  // Cannot claim incomplete quest
  const prematureClaim = claimQuestReward('quest_jumps_50', t0 + 1000);
  assert.equal(prematureClaim.claimedQuest, null);

  // Complete jump & lava survival quests by category
  const res1 = advanceQuestProgress('jumps', 50, t0 + 2000);
  assert.equal(res1.newlyCompleted.length, 1);
  assert.equal(res1.newlyCompleted[0].id, 'quest_jumps_50');

  const res2 = advanceQuestProgress('survive_lava', 60, t0 + 3000);
  assert.equal(res2.newlyCompleted.length, 1);
  assert.equal(res2.newlyCompleted[0].id, 'quest_survive_lava_60');

  // Claim jump quest reward
  const claim1 = claimQuestReward('quest_jumps_50', t0 + 4000);
  assert.ok(claim1.claimedQuest);
  assert.equal(claim1.claimedQuest.rewardCoins, jumpQuest.rewardCoins);
  assert.equal(claim1.claimedQuest.rewardGems, jumpQuest.rewardGems);

  // Double-claim must fail
  const duplicateClaim = claimQuestReward('quest_jumps_50', t0 + 5000);
  assert.equal(duplicateClaim.claimedQuest, null);

  // Remaining completed quest (lava) can be claimed via claimAllReadyQuestRewards
  const claimAll = claimAllReadyQuestRewards(t0 + 6000);
  assert.equal(claimAll.claimedQuests.length, 1);
  assert.equal(claimAll.claimedQuests[0].id, 'quest_survive_lava_60');
  assert.equal(claimAll.totalCoins, lavaQuest.rewardCoins);
  assert.equal(claimAll.totalGems, lavaQuest.rewardGems);
});

test('rerollQuest replaces selected task without duplicating active tasks', () => {
  const initial = generateRandomDailyQuests(3);
  const targetId = initial[1].id;
  const updated = rerollQuest(initial, targetId);

  assert.equal(updated.length, 3);
  assert.equal(updated[0].id, initial[0].id);
  assert.equal(updated[2].id, initial[2].id);
  assert.notEqual(updated[1].id, targetId);
  assert.equal(new Set(updated.map((q) => q.id)).size, 3);
});

test('formatResetCountdown formats hours/minutes, minutes/seconds, and expiry cleanly', () => {
  const base = 1_000_000;
  assert.equal(formatResetCountdown(base + 24 * 3600 * 1000, base), '24ч 00м');
  assert.equal(formatResetCountdown(base + (2 * 3600 + 15 * 60) * 1000, base), '02ч 15м');
  assert.equal(formatResetCountdown(base + (12 * 60 + 5) * 1000, base), '12м 05с');
  assert.equal(formatResetCountdown(base, base + 1000), 'Сброс...');
});

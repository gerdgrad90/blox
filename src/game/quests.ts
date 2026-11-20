export type QuestCategory =
  | 'jumps'
  | 'collect_coins'
  | 'survive_lava'
  | 'place_blocks'
  | 'checkpoints'
  | 'open_doors'
  | 'collect_pollen'
  | 'emotes';

export interface DailyQuest {
  id: string;
  category: QuestCategory;
  title: string;
  description: string;
  icon: string;
  target: number;
  progress: number;
  rewardCoins: number;
  rewardGems: number;
  completed: boolean;
  claimed: boolean;
}

export interface DailyQuestsState {
  quests: DailyQuest[];
  generatedAt: number;
  expiresAt: number;
}

export const DAILY_QUEST_COUNT = 3;
export const RESET_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const QUEST_REROLL_COST = 30;
export const QUESTS_UPDATED_EVENT = 'blox:quests-updated';

const STORAGE_KEY_STATE = 'blox_daily_quests_state_v2';
const STORAGE_KEY_QUESTS = 'blox_daily_quests_v1';
const STORAGE_KEY_DATE = 'blox_daily_quests_date_v1';

export const QUEST_POOL: DailyQuest[] = [
  {
    id: 'quest_jumps_50',
    category: 'jumps',
    title: 'Прыгуны Blox',
    description: 'Совершите 50 прыжков в любых режимах игры',
    icon: '🦘',
    target: 50,
    progress: 0,
    rewardCoins: 140,
    rewardGems: 0,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_jump_25',
    category: 'jumps',
    title: 'Прыгучий марафон',
    description: 'Совершите 25 прыжков в паркуре или игре',
    icon: '🏃',
    target: 25,
    progress: 0,
    rewardCoins: 95,
    rewardGems: 0,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_collect_coins_10',
    category: 'collect_coins',
    title: 'Сбор монет',
    description: 'Соберите 10 монет на уровнях',
    icon: '🪙',
    target: 10,
    progress: 0,
    rewardCoins: 120,
    rewardGems: 0,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_collect_coins_15',
    category: 'collect_coins',
    title: 'Золотая лихорадка',
    description: 'Соберите 15 золотых монет на картах',
    icon: '💰',
    target: 15,
    progress: 0,
    rewardCoins: 150,
    rewardGems: 1,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_survive_lava_60',
    category: 'survive_lava',
    title: 'Мастер Лавы',
    description: 'Продержитесь 60 секунд в режиме «Пол — это Лава»',
    icon: '🔥',
    target: 60,
    progress: 0,
    rewardCoins: 180,
    rewardGems: 1,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_survive_lava_30',
    category: 'survive_lava',
    title: 'Герой лавы',
    description: 'Продержитесь 30 секунд в режиме Лава выживания',
    icon: '🌋',
    target: 30,
    progress: 0,
    rewardCoins: 130,
    rewardGems: 0,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_place_blocks_10',
    category: 'place_blocks',
    title: 'Архитектор дня',
    description: 'Постройте 10 блоков с помощью молота BTools',
    icon: '🔨',
    target: 10,
    progress: 0,
    rewardCoins: 105,
    rewardGems: 0,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_place_blocks_5',
    category: 'place_blocks',
    title: 'Быстрый строитель',
    description: 'Поставьте 5 блоков через BTools',
    icon: '🧱',
    target: 5,
    progress: 0,
    rewardCoins: 70,
    rewardGems: 0,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_checkpoints_3',
    category: 'checkpoints',
    title: 'Покоритель этапов',
    description: 'Активируйте 3 чекпоинта на полосе препятствий',
    icon: '🚩',
    target: 3,
    progress: 0,
    rewardCoins: 130,
    rewardGems: 0,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_open_doors_5',
    category: 'open_doors',
    title: 'Исследователь DOORS',
    description: 'Откройте 5 дверей в отеле DOORS',
    icon: '🚪',
    target: 5,
    progress: 0,
    rewardCoins: 150,
    rewardGems: 0,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_collect_pollen_50',
    category: 'collect_pollen',
    title: 'Трудолюбивая пчела',
    description: 'Соберите 50 пыльцы в режиме Bee Farm',
    icon: '🐝',
    target: 50,
    progress: 0,
    rewardCoins: 125,
    rewardGems: 0,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_emotes_3',
    category: 'emotes',
    title: 'Душа компании',
    description: 'Используйте 3 эмоции или VR-жеста в мире',
    icon: '🎉',
    target: 3,
    progress: 0,
    rewardCoins: 90,
    rewardGems: 0,
    completed: false,
    claimed: false,
  },
];

export const DEFAULT_DAILY_QUESTS: DailyQuest[] = QUEST_POOL.slice(0, DAILY_QUEST_COUNT).map((q) => ({ ...q }));
export const ADDITIONAL_DAILY_QUESTS: DailyQuest[] = QUEST_POOL.slice(DAILY_QUEST_COUNT).map((q) => ({ ...q }));

const QUEST_POOL_BY_ID = new Map<string, DailyQuest>(QUEST_POOL.map((q) => [q.id, q]));

function cloneFreshQuest(template: DailyQuest): DailyQuest {
  return {
    ...template,
    progress: 0,
    completed: false,
    claimed: false,
  };
}

function normalizeQuest(raw: Partial<DailyQuest>): DailyQuest | null {
  if (!raw || typeof raw.id !== 'string') return null;
  const template = QUEST_POOL_BY_ID.get(raw.id);
  const target = typeof raw.target === 'number' && raw.target > 0 ? raw.target : template?.target ?? 1;
  const progress =
    typeof raw.progress === 'number' && Number.isFinite(raw.progress)
      ? Math.max(0, Math.min(target, raw.progress))
      : 0;
  const completed = Boolean(raw.completed) || progress >= target;
  const claimed = completed && Boolean(raw.claimed);

  if (!template && !raw.title) return null;

  return {
    id: raw.id,
    category: (raw.category || template?.category || 'jumps') as QuestCategory,
    title: raw.title || template?.title || raw.id,
    description: raw.description || template?.description || '',
    icon: raw.icon || template?.icon || '🎯',
    target,
    progress,
    rewardCoins: typeof raw.rewardCoins === 'number' ? raw.rewardCoins : template?.rewardCoins ?? 50,
    rewardGems: typeof raw.rewardGems === 'number' ? raw.rewardGems : template?.rewardGems ?? 0,
    completed,
    claimed,
  };
}

function shuffleInPlace<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.max(0, Math.min(0.9999999, rng())) * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Generates `count` random daily quests, prioritizing distinct quest categories
 * so the player gets a varied set of tasks (e.g. jump, coins, lava survival).
 */
export function generateRandomDailyQuests(
  count: number = DAILY_QUEST_COUNT,
  rng: () => number = Math.random
): DailyQuest[] {
  const shuffled = shuffleInPlace([...QUEST_POOL], rng);
  const picked: DailyQuest[] = [];
  const usedCategories = new Set<QuestCategory>();

  for (const candidate of shuffled) {
    if (picked.length >= count) break;
    if (!usedCategories.has(candidate.category)) {
      usedCategories.add(candidate.category);
      picked.push(cloneFreshQuest(candidate));
    }
  }

  // Fallback if requested count exceeds unique categories
  if (picked.length < count) {
    const pickedIds = new Set(picked.map((q) => q.id));
    for (const candidate of shuffled) {
      if (picked.length >= count) break;
      if (!pickedIds.has(candidate.id)) {
        pickedIds.add(candidate.id);
        picked.push(cloneFreshQuest(candidate));
      }
    }
  }

  return picked;
}

export function getTodayDateString(now: number = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function notifyQuestsUpdated() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(QUESTS_UPDATED_EVENT));
  }
}

export function saveDailyQuestsState(state: DailyQuestsState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
    localStorage.setItem(STORAGE_KEY_QUESTS, JSON.stringify(state.quests));
    localStorage.setItem(STORAGE_KEY_DATE, getTodayDateString(state.generatedAt));
    notifyQuestsUpdated();
  } catch {}
}

export function getDailyQuestsState(
  now: number = Date.now(),
  rng: () => number = Math.random
): DailyQuestsState {
  if (typeof localStorage === 'undefined') {
    return {
      quests: generateRandomDailyQuests(DAILY_QUEST_COUNT, rng),
      generatedAt: now,
      expiresAt: now + RESET_INTERVAL_MS,
    };
  }

  try {
    const rawState = localStorage.getItem(STORAGE_KEY_STATE);
    if (rawState) {
      const parsed = JSON.parse(rawState) as Partial<DailyQuestsState>;
      if (
        parsed &&
        Array.isArray(parsed.quests) &&
        parsed.quests.length > 0 &&
        typeof parsed.expiresAt === 'number' &&
        now < parsed.expiresAt
      ) {
        const normalized = parsed.quests
          .map((q) => normalizeQuest(q))
          .filter((q): q is DailyQuest => q !== null);
        if (normalized.length > 0) {
          return {
            quests: normalized,
            generatedAt: typeof parsed.generatedAt === 'number' ? parsed.generatedAt : now,
            expiresAt: parsed.expiresAt,
          };
        }
      }
    } else {
      // Seamless one-time migration from legacy v1 storage if it's still from today
      const legacyDate = localStorage.getItem(STORAGE_KEY_DATE);
      const legacyRaw = localStorage.getItem(STORAGE_KEY_QUESTS);
      if (legacyDate === getTodayDateString(now) && legacyRaw) {
        const parsedLegacy = JSON.parse(legacyRaw);
        if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
          const normalized = parsedLegacy
            .map((q) => normalizeQuest(q))
            .filter((q): q is DailyQuest => q !== null);
          if (normalized.length > 0) {
            const migratedState: DailyQuestsState = {
              quests: normalized,
              generatedAt: now,
              expiresAt: now + RESET_INTERVAL_MS,
            };
            saveDailyQuestsState(migratedState);
            return migratedState;
          }
        }
      }
    }
  } catch {}

  const freshState: DailyQuestsState = {
    quests: generateRandomDailyQuests(DAILY_QUEST_COUNT, rng),
    generatedAt: now,
    expiresAt: now + RESET_INTERVAL_MS,
  };
  saveDailyQuestsState(freshState);
  return freshState;
}

export function getStoredDailyQuests(now: number = Date.now()): DailyQuest[] {
  return getDailyQuestsState(now).quests;
}

export function saveStoredDailyQuests(quests: DailyQuest[], now: number = Date.now()): DailyQuestsState {
  let generatedAt = now;
  let expiresAt = now + RESET_INTERVAL_MS;

  if (typeof localStorage !== 'undefined') {
    try {
      const rawState = localStorage.getItem(STORAGE_KEY_STATE);
      if (rawState) {
        const parsed = JSON.parse(rawState) as Partial<DailyQuestsState>;
        if (typeof parsed.expiresAt === 'number' && now < parsed.expiresAt) {
          expiresAt = parsed.expiresAt;
          generatedAt = typeof parsed.generatedAt === 'number' ? parsed.generatedAt : now;
        }
      }
    } catch {}
  }

  const normalized = quests
    .map((q) => normalizeQuest(q))
    .filter((q): q is DailyQuest => q !== null);
  const nextState: DailyQuestsState = {
    quests: normalized,
    generatedAt,
    expiresAt,
  };
  saveDailyQuestsState(nextState);
  return nextState;
}

/**
 * Advances progress for any active incomplete quest matching either `id` or `category`.
 */
export function advanceQuestProgress(
  categoryOrId: QuestCategory | string,
  amount: number = 1,
  now: number = Date.now()
): { state: DailyQuestsState; newlyCompleted: DailyQuest[] } {
  const state = getDailyQuestsState(now);
  if (amount <= 0 || !Number.isFinite(amount)) {
    return { state, newlyCompleted: [] };
  }

  const newlyCompleted: DailyQuest[] = [];
  let changed = false;

  const updatedQuests = state.quests.map((q) => {
    const matches = q.id === categoryOrId || q.category === categoryOrId;
    if (!matches || q.completed) return q;

    const nextProgress = Math.min(q.target, q.progress + amount);
    const justCompleted = nextProgress >= q.target;
    const nextQuest: DailyQuest = {
      ...q,
      progress: nextProgress,
      completed: justCompleted,
    };
    if (justCompleted) {
      newlyCompleted.push(nextQuest);
    }
    if (nextProgress !== q.progress || justCompleted !== q.completed) {
      changed = true;
    }
    return nextQuest;
  });

  if (!changed) {
    return { state, newlyCompleted };
  }

  const nextState: DailyQuestsState = {
    ...state,
    quests: updatedQuests,
  };
  saveDailyQuestsState(nextState);
  return { state: nextState, newlyCompleted };
}

/**
 * Claims the reward for a single completed, unclaimed quest.
 * Prevents double claiming across rapid UI clicks.
 */
export function claimQuestReward(
  questId: string,
  now: number = Date.now()
): { state: DailyQuestsState; claimedQuest: DailyQuest | null } {
  const state = getDailyQuestsState(now);
  let claimedQuest: DailyQuest | null = null;

  const updatedQuests = state.quests.map((q) => {
    if (q.id === questId && q.completed && !q.claimed) {
      const updated = { ...q, claimed: true };
      claimedQuest = updated;
      return updated;
    }
    return q;
  });

  if (!claimedQuest) {
    return { state, claimedQuest: null };
  }

  const nextState: DailyQuestsState = {
    ...state,
    quests: updatedQuests,
  };
  saveDailyQuestsState(nextState);
  return { state: nextState, claimedQuest };
}

export function claimAllReadyQuestRewards(now: number = Date.now()): {
  state: DailyQuestsState;
  claimedQuests: DailyQuest[];
  totalCoins: number;
  totalGems: number;
} {
  const state = getDailyQuestsState(now);
  const claimedQuests: DailyQuest[] = [];
  let totalCoins = 0;
  let totalGems = 0;

  const updatedQuests = state.quests.map((q) => {
    if (q.completed && !q.claimed) {
      const updated = { ...q, claimed: true };
      claimedQuests.push(updated);
      totalCoins += q.rewardCoins;
      totalGems += q.rewardGems;
      return updated;
    }
    return q;
  });

  if (claimedQuests.length === 0) {
    return { state, claimedQuests, totalCoins: 0, totalGems: 0 };
  }

  const nextState: DailyQuestsState = {
    ...state,
    quests: updatedQuests,
  };
  saveDailyQuestsState(nextState);
  return { state: nextState, claimedQuests, totalCoins, totalGems };
}

export function rerollQuest(
  quests: DailyQuest[],
  questIdToReplace: string,
  rng: () => number = Math.random
): DailyQuest[] {
  const activeIds = new Set(quests.map((q) => q.id));
  const otherCategories = new Set(
    quests.filter((q) => q.id !== questIdToReplace).map((q) => q.category)
  );

  // Prefer tasks that are neither active nor sharing a category with remaining quests
  let pool = QUEST_POOL.filter((q) => !activeIds.has(q.id) && !otherCategories.has(q.category));
  if (pool.length === 0) {
    pool = QUEST_POOL.filter((q) => !activeIds.has(q.id));
  }
  if (pool.length === 0) {
    pool = QUEST_POOL.filter((q) => q.id !== questIdToReplace);
  }
  if (pool.length === 0) return quests;

  const idx = Math.floor(Math.max(0, Math.min(0.9999999, rng())) * pool.length);
  const randomReplacement = cloneFreshQuest(pool[idx]);
  return quests.map((q) => (q.id === questIdToReplace ? randomReplacement : q));
}

export function rerollDailyQuest(
  questIdToReplace: string,
  now: number = Date.now(),
  rng: () => number = Math.random
): DailyQuestsState {
  const state = getDailyQuestsState(now);
  const updatedQuests = rerollQuest(state.quests, questIdToReplace, rng);
  const nextState: DailyQuestsState = {
    ...state,
    quests: updatedQuests,
  };
  saveDailyQuestsState(nextState);
  return nextState;
}

export function forceResetDailyQuests(
  now: number = Date.now(),
  rng: () => number = Math.random
): DailyQuestsState {
  const nextState: DailyQuestsState = {
    quests: generateRandomDailyQuests(DAILY_QUEST_COUNT, rng),
    generatedAt: now,
    expiresAt: now + RESET_INTERVAL_MS,
  };
  saveDailyQuestsState(nextState);
  return nextState;
}

export function formatResetCountdown(expiresAt: number, now: number = Date.now()): string {
  const remainingMs = Math.max(0, expiresAt - now);
  if (remainingMs <= 0) return 'Сброс...';

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours >= 1) {
    return `${String(hours).padStart(2, '0')}ч ${String(minutes).padStart(2, '0')}м`;
  }
  return `${String(minutes).padStart(2, '0')}м ${String(seconds).padStart(2, '0')}с`;
}

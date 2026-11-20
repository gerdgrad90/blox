import { Achievement } from './types';

export const ALL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'jump_50_streak',
    title: 'Мастер паркура',
    description: 'Совершите 50 прыжков подряд без единого падения или смерти!',
    icon: '🦘',
    rewardCoins: 100,
    category: 'parkour',
  },
  {
    id: 'secret_area_found',
    title: 'Тайный исследователь',
    description: 'Найдите скрытую секретную зону или пасхалку на карте!',
    icon: '🕵️‍♂️',
    rewardCoins: 150,
    category: 'secret',
  },
  {
    id: 'space_bloxer',
    title: 'Покоритель высот',
    description: 'Взберитесь на высоту более 45 метров с помощью джетпака или блоков!',
    icon: '🚀',
    rewardCoins: 75,
    category: 'mastery',
  },
  {
    id: 'coin_hoarder',
    title: 'Золотая лихорадка',
    description: 'Соберите 10 золотых монет на этапах полосы препятствий!',
    icon: '🪙',
    rewardCoins: 50,
    category: 'parkour',
  },
  {
    id: 'speed_demon',
    title: 'Молния Blox',
    description: 'Разгонитесь до максимальной скорости с катушкой Speed Coil!',
    icon: '⚡',
    rewardCoins: 60,
    category: 'mastery',
  },
  {
    id: 'master_builder',
    title: 'Архитектор BTools',
    description: 'Постройте 10 строительных блоков с помощью строительного молота!',
    icon: '🔨',
    rewardCoins: 50,
    category: 'mastery',
  },
  {
    id: 'bloxy_cola_lover',
    title: 'Глоток жизни',
    description: 'Выпейте легендарную газировку Bloxy Cola и восстановите здоровье!',
    icon: '🥤',
    rewardCoins: 40,
    category: 'survival',
  },
  {
    id: 'lava_survivor_60',
    title: 'Укротитель Лавы',
    description: 'Продержитесь более 60 секунд в режиме «Пол — это лава!» без гибели!',
    icon: '🌋',
    rewardCoins: 120,
    category: 'survival',
  },
];

export const ACHIEVEMENTS_REGISTRY: Record<string, Achievement> = ALL_ACHIEVEMENTS.reduce(
  (acc, ach) => {
    acc[ach.id] = ach;
    return acc;
  },
  {} as Record<string, Achievement>
);

const STORAGE_KEY = 'blox_unlocked_achievements';

export function getStoredUnlockedAchievements(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {};
}

export function saveUnlockedAchievement(id: string): Record<string, number> {
  const current = getStoredUnlockedAchievements();
  if (!current[id]) {
    current[id] = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {}
  }
  return current;
}

export function mergeUnlockedAchievements(
  remoteMap?: Record<string, number> | null
): Record<string, number> {
  const current = getStoredUnlockedAchievements();
  if (!remoteMap || typeof remoteMap !== 'object') return current;
  let changed = false;
  for (const [id, ts] of Object.entries(remoteMap)) {
    if (ACHIEVEMENTS_REGISTRY[id] && typeof ts === 'number' && Number.isFinite(ts) && ts > 0) {
      if (!current[id] || ts < current[id]) {
        current[id] = ts;
        changed = true;
      }
    }
  }
  if (changed && typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {}
  }
  return current;
}

const LIFETIME_COUNTERS_KEY = 'blox_lifetime_counters_v1';

export interface StoredLifetimeCounters {
  totalJumps: number;
  totalDeaths: number;
}

export function getStoredLifetimeCounters(): StoredLifetimeCounters {
  if (typeof window === 'undefined') return { totalJumps: 0, totalDeaths: 0 };
  try {
    const raw = localStorage.getItem(LIFETIME_COUNTERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        totalJumps: Math.max(0, Math.floor(Number(parsed?.totalJumps) || 0)),
        totalDeaths: Math.max(0, Math.floor(Number(parsed?.totalDeaths) || 0)),
      };
    }
  } catch {}
  return { totalJumps: 0, totalDeaths: 0 };
}

export function saveLifetimeCounters(counters: StoredLifetimeCounters): StoredLifetimeCounters {
  const clean: StoredLifetimeCounters = {
    totalJumps: Math.max(0, Math.floor(Number(counters.totalJumps) || 0)),
    totalDeaths: Math.max(0, Math.floor(Number(counters.totalDeaths) || 0)),
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LIFETIME_COUNTERS_KEY, JSON.stringify(clean));
    } catch {}
  }
  return clean;
}


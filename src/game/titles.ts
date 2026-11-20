export type PlayerTitleRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface PlayerTitle {
  id: string;
  achievementId: string;
  label: string;
  subtitleRu: string;
  icon: string;
  accentColor: string;
  bgFrom: string;
  bgTo: string;
  textColor: string;
  borderColor: string;
  rarity: PlayerTitleRarity;
}

export const ALL_PLAYER_TITLES: PlayerTitle[] = [
  {
    id: 'pro_parkourer',
    achievementId: 'jump_50_streak',
    label: 'Pro Parkourer',
    subtitleRu: '50 прыжков подряд без падений',
    icon: '🦘',
    accentColor: '#34d399',
    bgFrom: '#065f46',
    bgTo: '#0e7490',
    textColor: '#ecfdf5',
    borderColor: '#34d399',
    rarity: 'epic',
  },
  {
    id: 'lava_survivor',
    achievementId: 'lava_survivor_60',
    label: 'Lava Survivor',
    subtitleRu: '60+ сек в «Пол — это лава!»',
    icon: '🌋',
    accentColor: '#fb923c',
    bgFrom: '#9a3412',
    bgTo: '#991b1b',
    textColor: '#fff7ed',
    borderColor: '#fb923c',
    rarity: 'legendary',
  },
  {
    id: 'secret_hunter',
    achievementId: 'secret_area_found',
    label: 'Secret Hunter',
    subtitleRu: 'Найдена секретная зона',
    icon: '🕵️‍♂️',
    accentColor: '#e879f9',
    bgFrom: '#581c87',
    bgTo: '#86198f',
    textColor: '#fdf4ff',
    borderColor: '#e879f9',
    rarity: 'legendary',
  },
  {
    id: 'sky_conqueror',
    achievementId: 'space_bloxer',
    label: 'Sky Conqueror',
    subtitleRu: 'Высота 45+ метров',
    icon: '🚀',
    accentColor: '#38bdf8',
    bgFrom: '#0c4a6e',
    bgTo: '#312e81',
    textColor: '#f0f9ff',
    borderColor: '#38bdf8',
    rarity: 'epic',
  },
  {
    id: 'gold_tycoon',
    achievementId: 'coin_hoarder',
    label: 'Gold Tycoon',
    subtitleRu: 'Собрано 10 золотых монет',
    icon: '🪙',
    accentColor: '#fbbf24',
    bgFrom: '#78350f',
    bgTo: '#a16207',
    textColor: '#fffbeb',
    borderColor: '#fbbf24',
    rarity: 'rare',
  },
  {
    id: 'speed_demon',
    achievementId: 'speed_demon',
    label: 'Speed Demon',
    subtitleRu: 'Максимальная скорость Speed Coil',
    icon: '⚡',
    accentColor: '#22d3ee',
    bgFrom: '#164e63',
    bgTo: '#1d4ed8',
    textColor: '#ecfeff',
    borderColor: '#22d3ee',
    rarity: 'rare',
  },
  {
    id: 'master_builder',
    achievementId: 'master_builder',
    label: 'Master Builder',
    subtitleRu: 'Построено 10 блоков BTools',
    icon: '🔨',
    accentColor: '#2dd4bf',
    bgFrom: '#115e59',
    bgTo: '#065f46',
    textColor: '#f0fdfa',
    borderColor: '#2dd4bf',
    rarity: 'rare',
  },
  {
    id: 'cola_legend',
    achievementId: 'bloxy_cola_lover',
    label: 'Cola Legend',
    subtitleRu: 'Выпита Bloxy Cola',
    icon: '🥤',
    accentColor: '#fb7185',
    bgFrom: '#881337',
    bgTo: '#b45309',
    textColor: '#fff1f2',
    borderColor: '#fb7185',
    rarity: 'common',
  },
];

export const PLAYER_TITLES_BY_ID: Record<string, PlayerTitle> = ALL_PLAYER_TITLES.reduce(
  (acc, title) => {
    acc[title.id] = title;
    return acc;
  },
  {} as Record<string, PlayerTitle>
);

export const PLAYER_TITLE_BY_ACHIEVEMENT_ID: Record<string, PlayerTitle> = ALL_PLAYER_TITLES.reduce(
  (acc, title) => {
    acc[title.achievementId] = title;
    return acc;
  },
  {} as Record<string, PlayerTitle>
);

export function getPlayerTitleById(titleId?: string | null): PlayerTitle | null {
  if (!titleId || typeof titleId !== 'string') return null;
  return PLAYER_TITLES_BY_ID[titleId.trim()] || null;
}

export function getTitleForAchievement(achievementId: string): PlayerTitle | null {
  if (!achievementId || typeof achievementId !== 'string') return null;
  return PLAYER_TITLE_BY_ACHIEVEMENT_ID[achievementId] || null;
}

export function isTitleUnlocked(
  titleId: string | null | undefined,
  unlockedAchievements?: Record<string, number> | null
): boolean {
  const title = getPlayerTitleById(titleId);
  if (!title || !unlockedAchievements) return false;
  return Boolean(unlockedAchievements[title.achievementId]);
}

export function getUnlockedPlayerTitles(
  unlockedAchievements?: Record<string, number> | null
): PlayerTitle[] {
  if (!unlockedAchievements) return [];
  return ALL_PLAYER_TITLES.filter((t) => Boolean(unlockedAchievements[t.achievementId]));
}

export function sanitizeEquippedTitleId(
  titleId: string | null | undefined,
  unlockedAchievements?: Record<string, number> | null
): string | null {
  if (!titleId) return null;
  const title = getPlayerTitleById(titleId);
  if (!title) return null;
  return isTitleUnlocked(title.id, unlockedAchievements) ? title.id : null;
}

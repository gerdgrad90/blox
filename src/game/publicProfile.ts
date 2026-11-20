import { SHOP_CATALOG } from './shop';
import { getPlayerTitleById } from './titles';
import {
  CharacterSkin,
  GameId,
  LeaderboardEntry,
  PublicPlayerProfile,
  RemotePlayerInfo,
} from './types';

export interface PublicProfileLookupInput {
  playerKey?: string;
  username?: string;
  clientId?: string;
  remotePlayer?: RemotePlayerInfo | null;
  leaderboardEntry?: LeaderboardEntry | null;
  localFallback?: PublicPlayerProfile | null;
}

export interface EquippedSkinSlotDisplay {
  slot: string;
  name: string;
  icon: string;
}

const PANTS_LABELS: Record<string, string> = {
  rock_jeans: 'Чёрные джинсы Рокера',
  blue_denim: 'Синие джинсы',
  cargo_camo: 'Тактический камуфляж',
  rus_emr_pants: 'Камуфляж EMR + берцы',
  track_pants: 'Спортивные штаны',
  suit_pants: 'Классические брюки',
  custom_pants: 'Кастомные штаны',
};

const DEFAULT_SKIN: CharacterSkin = {
  skinColor: '#e5c298',
  torsoColor: '#141619',
  legsColor: '#18181b',
  headShape: 'round',
  hat: 'rocker_hair',
  face: 'squiggly',
  outfit: 'rock_jacket',
  shirt: 'rock_jacket',
  pants: 'rock_jeans',
  backpack: 'fuel_jetpack',
  name: 'Игрок',
};

function mergeAchievementMaps(
  a?: Record<string, number>,
  b?: Record<string, number>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const src of [a, b]) {
    if (!src || typeof src !== 'object') continue;
    for (const [k, v] of Object.entries(src)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        out[k] = out[k] ? Math.min(out[k], v) : v;
      }
    }
  }
  return out;
}

function normalizeSkin(raw: Partial<CharacterSkin> | undefined, fallbackName: string): CharacterSkin {
  return {
    skinColor: raw?.skinColor || DEFAULT_SKIN.skinColor,
    torsoColor: raw?.torsoColor || DEFAULT_SKIN.torsoColor,
    legsColor: raw?.legsColor || DEFAULT_SKIN.legsColor,
    headShape: raw?.headShape === 'blocky' ? 'blocky' : 'round',
    hat: raw?.hat || DEFAULT_SKIN.hat,
    face: raw?.face || DEFAULT_SKIN.face,
    outfit: raw?.outfit || DEFAULT_SKIN.outfit,
    shirt: raw?.shirt || raw?.outfit || DEFAULT_SKIN.shirt,
    pants: raw?.pants || DEFAULT_SKIN.pants,
    backpack: raw?.backpack || 'none',
    playerTitleId:
      typeof raw?.playerTitleId === 'string' && raw.playerTitleId.trim()
        ? raw.playerTitleId.trim()
        : null,
    name: raw?.name || fallbackName,
  };
}

export function resolveEquippedSkinLoadout(skin: CharacterSkin): EquippedSkinSlotDisplay[] {
  const findHat = SHOP_CATALOG.find(
    (item) => item.type === 'hat' && (item.id === skin.hat || item.skinProperty.hat === skin.hat)
  );
  const findFace = SHOP_CATALOG.find(
    (item) => item.type === 'face' && (item.id === skin.face || item.skinProperty.face === skin.face)
  );
  const shirtKey = skin.shirt || skin.outfit || 'rock_jacket';
  const findShirt = SHOP_CATALOG.find(
    (item) =>
      item.type === 'outfit' &&
      (item.id === shirtKey || item.skinProperty.shirt === shirtKey || item.skinProperty.outfit === shirtKey)
  );
  const findGear = SHOP_CATALOG.find(
    (item) =>
      item.type === 'gear' &&
      (item.id === skin.backpack || item.skinProperty.backpack === skin.backpack)
  );

  const pantsKey = skin.pants || 'rock_jeans';
  const pantsLabel = PANTS_LABELS[pantsKey] || pantsKey;

  return [
    {
      slot: 'Головной убор',
      name: skin.hat === 'none' ? 'Без шапки' : findHat?.name || skin.hat || 'Стандарт',
      icon: findHat?.icon || '🧢',
    },
    {
      slot: 'Лицо',
      name: findFace?.name || skin.face || 'Классика',
      icon: findFace?.icon || '😊',
    },
    {
      slot: 'Верх / Костюм',
      name: findShirt?.name || shirtKey,
      icon: findShirt?.icon || '👕',
    },
    {
      slot: 'Низ / Брюки',
      name: pantsLabel,
      icon: '👖',
    },
    {
      slot: 'Снаряжение / Спина',
      name:
        !skin.backpack || skin.backpack === 'none'
          ? 'Без рюкзака'
          : findGear?.name || skin.backpack,
      icon: findGear?.icon || '🎒',
    },
    {
      slot: 'Форма головы',
      name: skin.headShape === 'blocky' ? 'Классик-куб' : 'Скруглённая',
      icon: '🧱',
    },
    ...(getPlayerTitleById(skin.playerTitleId)
      ? [
          {
            slot: 'Титул',
            name: getPlayerTitleById(skin.playerTitleId)!.label,
            icon: getPlayerTitleById(skin.playerTitleId)!.icon,
          },
        ]
      : []),
  ];
}

export function buildFallbackPublicProfile(input: PublicProfileLookupInput): PublicPlayerProfile {
  if (input.localFallback) {
    return input.localFallback;
  }

  const rp = input.remotePlayer;
  const lb = input.leaderboardEntry;

  const username =
    (rp?.skin?.name || lb?.username || input.username || 'Player').trim().slice(0, 16) || 'Player';
  const playerKey =
    input.playerKey || rp?.playerKey || lb?.playerKey || `guest:${username.toLowerCase()}`;

  const skin = normalizeSkin(rp?.skin || lb?.skin, username);
  const unlockedAchievements = mergeAchievementMaps(rp?.unlockedAchievements);

  return {
    playerKey,
    username,
    bio: rp?.bio || '',
    accountType: playerKey.startsWith('u_') ? 'cloud' : 'guest',
    isOnline: Boolean(rp),
    roomCheckpoint: rp ? rp.checkpoint : undefined,
    skin,
    stats: {
      totalCoins: Math.max(rp?.coins || 0, rp?.lifetimeStats?.totalCoins || 0),
      totalGems: Math.max(rp?.gems || 0, rp?.lifetimeStats?.totalGems || 0),
      completedLevels: Math.max(lb?.completedLevels || 0, rp?.lifetimeStats?.completedLevels || 0),
      victories: Math.max(lb?.victories || 0, rp?.lifetimeStats?.victories || 0),
      bestTimeSeconds: lb?.bestTimeSeconds || rp?.lifetimeStats?.bestTimeSeconds || 0,
      totalTimeSeconds: lb?.totalTimeSeconds || rp?.lifetimeStats?.totalTimeSeconds || 0,
      totalJumps: rp?.lifetimeStats?.totalJumps || 0,
      totalDeaths: rp?.lifetimeStats?.totalDeaths || 0,
    },
    perGameStats: lb?.perGameStats,
    unlockedAchievements,
    leaderboardRank: lb?.rank ?? null,
    updatedAt: lb?.updatedAt || Date.now(),
  };
}

export async function fetchPublicPlayerProfile(
  input: PublicProfileLookupInput
): Promise<PublicPlayerProfile> {
  const fallback = buildFallbackPublicProfile(input);

  const params = new URLSearchParams();
  if (input.playerKey) params.set('playerKey', input.playerKey);
  if (input.username) params.set('username', input.username);
  if (input.clientId) params.set('clientId', input.clientId);
  if (!params.toString()) return fallback;

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`/api/players/profile?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    window.clearTimeout(timer);

    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.toLowerCase().includes('application/json')) {
      return fallback;
    }

    const remote = (await res.json()) as PublicPlayerProfile;
    if (!remote || !remote.username) {
      return fallback;
    }

    // Merge live peer snapshot (e.g. Cloud Relay peer) with server database snapshot
    return {
      playerKey: remote.playerKey || fallback.playerKey,
      username: remote.username || fallback.username,
      bio: remote.bio || fallback.bio,
      accountType: remote.accountType || fallback.accountType,
      isOnline: Boolean(remote.isOnline || fallback.isOnline),
      currentGameId: (remote.currentGameId || fallback.currentGameId) as GameId | undefined,
      roomCheckpoint:
        typeof remote.roomCheckpoint === 'number'
          ? remote.roomCheckpoint
          : fallback.roomCheckpoint,
      skin: normalizeSkin(
        input.remotePlayer?.skin || remote.skin || fallback.skin,
        remote.username || fallback.username
      ),
      stats: {
        totalCoins: Math.max(remote.stats?.totalCoins || 0, fallback.stats.totalCoins || 0),
        totalGems: Math.max(remote.stats?.totalGems || 0, fallback.stats.totalGems || 0),
        completedLevels: Math.max(
          remote.stats?.completedLevels || 0,
          fallback.stats.completedLevels || 0
        ),
        victories: Math.max(remote.stats?.victories || 0, fallback.stats.victories || 0),
        bestTimeSeconds:
          remote.stats?.bestTimeSeconds && fallback.stats.bestTimeSeconds
            ? Math.min(remote.stats.bestTimeSeconds, fallback.stats.bestTimeSeconds)
            : remote.stats?.bestTimeSeconds || fallback.stats.bestTimeSeconds || 0,
        totalTimeSeconds: Math.max(
          remote.stats?.totalTimeSeconds || 0,
          fallback.stats.totalTimeSeconds || 0
        ),
        totalJumps: Math.max(remote.stats?.totalJumps || 0, fallback.stats.totalJumps || 0),
        totalDeaths: Math.max(remote.stats?.totalDeaths || 0, fallback.stats.totalDeaths || 0),
      },
      perGameStats: remote.perGameStats || fallback.perGameStats,
      unlockedAchievements: mergeAchievementMaps(
        remote.unlockedAchievements,
        fallback.unlockedAchievements
      ),
      leaderboardRank:
        typeof remote.leaderboardRank === 'number'
          ? remote.leaderboardRank
          : fallback.leaderboardRank ?? null,
      updatedAt: remote.updatedAt || fallback.updatedAt,
    };
  } catch {
    return fallback;
  }
}

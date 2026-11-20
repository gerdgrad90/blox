import { getStoredAuthToken } from './auth';
import { isFileProtocol } from './env';
import {
  CharacterSkin,
  GameId,
  LeaderboardEntry,
  LeaderboardGameFilter,
  LeaderboardResponse,
} from './types';

const LEADERBOARD_CACHE_KEY = 'blox_global_leaderboard_cache_v1';

export interface SubmitLeaderboardInput {
  playerKey: string;
  username: string;
  gameId: GameId;
  runId: string;
  levelKey: string;
  eventType: 'level_clear' | 'victory';
  elapsedSeconds: number;
  completionTime?: number;
  levelsDelta?: number;
  skin?: Partial<CharacterSkin>;
  bio?: string;
  coins?: number;
  gems?: number;
  totalJumps?: number;
  totalDeaths?: number;
  unlockedAchievements?: Record<string, number>;
}

function getGameViewStats(
  entry: LeaderboardEntry,
  filter: LeaderboardGameFilter
): { completedLevels: number; victories: number; bestTimeSeconds: number } {
  if (filter === 'all') {
    return {
      completedLevels: entry.completedLevels || 0,
      victories: entry.victories || 0,
      bestTimeSeconds: entry.bestTimeSeconds || 0,
    };
  }
  const per = entry.perGameStats?.[filter];
  return {
    completedLevels: per?.completedLevels || 0,
    victories: per?.victories || 0,
    bestTimeSeconds: per?.bestTimeSeconds || 0,
  };
}

export function sortLeaderboardEntries(
  list: LeaderboardEntry[],
  filter: LeaderboardGameFilter = 'all'
): LeaderboardEntry[] {
  const filtered =
    filter === 'all'
      ? list.filter((e) => (e.completedLevels || 0) > 0 || (e.victories || 0) > 0)
      : list.filter((e) => {
          const g = e.perGameStats?.[filter];
          return Boolean(g && (g.completedLevels > 0 || g.victories > 0));
        });

  const sorted = filtered
    .map((entry) => {
      const stats = getGameViewStats(entry, filter);
      return {
        ...entry,
        completedLevels: stats.completedLevels,
        victories: stats.victories,
        bestTimeSeconds: stats.bestTimeSeconds,
      };
    })
    .sort((a, b) => {
      if (b.completedLevels !== a.completedLevels) {
        return b.completedLevels - a.completedLevels;
      }
      const aTime = a.bestTimeSeconds > 0 ? a.bestTimeSeconds : Number.MAX_SAFE_INTEGER;
      const bTime = b.bestTimeSeconds > 0 ? b.bestTimeSeconds : Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) {
        return aTime - bTime;
      }
      if (b.victories !== a.victories) {
        return b.victories - a.victories;
      }
      if (a.totalTimeSeconds !== b.totalTimeSeconds) {
        return a.totalTimeSeconds - b.totalTimeSeconds;
      }
      return a.updatedAt - b.updatedAt;
    });

  return sorted.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));
}

function loadOfflineLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOfflineLeaderboard(entries: LeaderboardEntry[]) {
  try {
    localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify(entries.slice(0, 100)));
  } catch {}
}

function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') || '';
  return ct.toLowerCase().includes('application/json');
}

export async function fetchLeaderboard(
  gameId: LeaderboardGameFilter = 'all',
  viewerPlayerKey?: string
): Promise<LeaderboardResponse> {
  try {
    if (isFileProtocol()) {
      throw new Error('Offline file protocol');
    }
    const params = new URLSearchParams({ gameId });
    if (viewerPlayerKey) {
      params.set('playerKey', viewerPlayerKey);
    }
    const res = await fetch(`/api/leaderboard?${params.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok || !isJsonResponse(res)) {
      throw new Error('Leaderboard endpoint unavailable');
    }
    const data = (await res.json()) as LeaderboardResponse;
    if (gameId === 'all' && Array.isArray(data.entries) && data.entries.length > 0) {
      saveOfflineLeaderboard(data.entries);
    }
    return data;
  } catch {
    const cached = sortLeaderboardEntries(loadOfflineLeaderboard(), gameId);
    const viewerIdx = viewerPlayerKey
      ? cached.findIndex((e) => e.playerKey === viewerPlayerKey)
      : -1;
    return {
      gameId,
      entries: cached.slice(0, 10),
      totalPlayers: cached.length,
      viewerRank: viewerIdx >= 0 ? viewerIdx + 1 : null,
      viewerEntry: viewerIdx >= 0 ? cached[viewerIdx] : null,
      updatedAt: Date.now(),
    };
  }
}

function updateOfflineLeaderboardRecord(input: SubmitLeaderboardInput): LeaderboardResponse {
  const store = loadOfflineLeaderboard();
  const cleanName = input.username.trim().slice(0, 16) || 'Player';
  const now = Date.now();
  const delta = Math.max(1, Math.min(20, Math.floor(input.levelsDelta ?? 1)));
  const elapsed = Math.max(1, Math.floor(input.elapsedSeconds || 1));

  let existing = store.find((e) => e.playerKey === input.playerKey);
  if (!existing) {
    existing = {
      playerKey: input.playerKey,
      username: cleanName,
      completedLevels: 0,
      victories: 0,
      bestTimeSeconds: 0,
      totalTimeSeconds: 0,
      bestGameId: input.gameId,
      perGameStats: {},
      skin: input.skin,
      updatedAt: now,
    };
    store.push(existing);
  }

  existing.username = cleanName;
  if (input.skin) existing.skin = input.skin;
  existing.completedLevels += delta;
  existing.totalTimeSeconds += elapsed;
  existing.updatedAt = now;

  if (!existing.perGameStats) existing.perGameStats = {};
  const gs = existing.perGameStats[input.gameId] || {
    completedLevels: 0,
    victories: 0,
    bestTimeSeconds: 0,
  };
  gs.completedLevels += delta;

  if (input.eventType === 'victory') {
    const clearSec = Math.max(1, Math.floor(input.completionTime ?? elapsed));
    existing.victories += 1;
    gs.victories += 1;
    if (existing.bestTimeSeconds === 0 || clearSec < existing.bestTimeSeconds) {
      existing.bestTimeSeconds = clearSec;
      existing.bestGameId = input.gameId;
    }
    if (gs.bestTimeSeconds === 0 || clearSec < gs.bestTimeSeconds) {
      gs.bestTimeSeconds = clearSec;
    }
  }

  existing.perGameStats[input.gameId] = gs;
  saveOfflineLeaderboard(store);

  const ranked = sortLeaderboardEntries(store, 'all');
  const viewerIdx = ranked.findIndex((e) => e.playerKey === input.playerKey);
  return {
    gameId: 'all',
    entries: ranked.slice(0, 10),
    totalPlayers: ranked.length,
    viewerRank: viewerIdx >= 0 ? viewerIdx + 1 : null,
    viewerEntry: viewerIdx >= 0 ? ranked[viewerIdx] : null,
    updatedAt: now,
  };
}

export async function submitLeaderboardProgress(
  input: SubmitLeaderboardInput
): Promise<LeaderboardResponse | null> {
  try {
    if (isFileProtocol()) {
      throw new Error('Offline file protocol');
    }
    const token = getStoredAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token && !token.startsWith('offline:')) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch('/api/leaderboard/submit', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });

    if (!res.ok || !isJsonResponse(res)) {
      throw new Error('Leaderboard submit failed');
    }

    const data = await res.json();
    if (Array.isArray(data?.entries)) {
      saveOfflineLeaderboard(data.entries);
    }
    return {
      gameId: 'all',
      entries: Array.isArray(data?.entries) ? data.entries : [],
      totalPlayers: typeof data?.totalPlayers === 'number' ? data.totalPlayers : 0,
      viewerRank: typeof data?.rank === 'number' ? data.rank : null,
      viewerEntry: data?.entry || null,
      updatedAt: Date.now(),
    };
  } catch {
    return updateOfflineLeaderboardRecord(input);
  }
}

export function formatLeaderboardTime(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) {
    return '—';
  }
  const whole = Math.max(1, Math.floor(seconds));
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  if (mins === 0) {
    return `${secs}с`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

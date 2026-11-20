export interface FeedbackRecord {
  id: string;
  rating: number;
  message: string;
  author: string;
  contactEmail?: string;
  gameId?: string;
  mode?: string;
  roomId?: string;
  createdAt: number;
  emailDelivered: boolean;
  provider: 'resend' | 'smtp' | 'none' | string;
  deliveryError?: string;
  isRead?: boolean;
  pinned?: boolean;
}

export interface FeedbackSummary {
  averageRating: number;
  ratedCount: number;
  totalLetters: number;
  positivePercent: number;
  unreadCount: number;
  breakdown: Record<'1' | '2' | '3' | '4' | '5', number>;
  byGame: Record<string, { averageRating: number; ratedCount: number; totalLetters: number }>;
}

export interface PublicFeedbackReview {
  id: string;
  author: string;
  rating: number;
  message: string;
  gameId?: string;
  createdAt: number;
}

const ARCHIVE_STORAGE_KEY = 'blox_feedback_archive_v1';

export const EMPTY_FEEDBACK_SUMMARY: FeedbackSummary = {
  averageRating: 0,
  ratedCount: 0,
  totalLetters: 0,
  positivePercent: 0,
  unreadCount: 0,
  breakdown: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 },
  byGame: {},
};

export function readFeedbackArchive(): FeedbackRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ARCHIVE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is FeedbackRecord => Boolean(item && typeof item.id === 'string'));
  } catch {
    return [];
  }
}

export function mergeFeedbackRecords(
  primary: FeedbackRecord[],
  secondary: FeedbackRecord[]
): FeedbackRecord[] {
  const byId = new Map<string, FeedbackRecord>();
  for (const item of secondary) {
    if (item && typeof item.id === 'string') {
      byId.set(item.id, item);
    }
  }
  for (const item of primary) {
    if (!item || typeof item.id !== 'string') continue;
    const prev = byId.get(item.id);
    if (!prev) {
      byId.set(item.id, item);
    } else {
      byId.set(item.id, {
        ...prev,
        ...item,
        emailDelivered: Boolean(prev.emailDelivered || item.emailDelivered),
        isRead: typeof item.isRead === 'boolean' ? item.isRead : prev.isRead,
        pinned: typeof item.pinned === 'boolean' ? item.pinned : prev.pinned,
      });
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    if (Boolean(b.pinned) !== Boolean(a.pinned)) {
      return b.pinned ? 1 : -1;
    }
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

export function saveFeedbackArchive(records: FeedbackRecord[]): FeedbackRecord[] {
  const merged = mergeFeedbackRecords(records, readFeedbackArchive());
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Ignore storage quota errors
    }
  }
  return merged;
}

export function computeClientFeedbackSummary(records: FeedbackRecord[]): FeedbackSummary {
  const breakdown: Record<'1' | '2' | '3' | '4' | '5', number> = {
    '5': 0,
    '4': 0,
    '3': 0,
    '2': 0,
    '1': 0,
  };
  const gameAcc: Record<string, { sum: number; rated: number; total: number }> = {};
  let ratingSum = 0;
  let ratedCount = 0;
  let positiveCount = 0;
  let unreadCount = 0;

  for (const item of records) {
    if (!item.isRead) unreadCount += 1;
    const r = typeof item.rating === 'number' && Number.isFinite(item.rating) ? Math.round(item.rating) : 0;
    const valid = r >= 1 && r <= 5;
    if (valid) {
      ratedCount += 1;
      ratingSum += r;
      breakdown[String(r) as '1' | '2' | '3' | '4' | '5'] += 1;
      if (r >= 4) positiveCount += 1;
    }
    const gId = typeof item.gameId === 'string' && item.gameId.trim() ? item.gameId.trim() : 'other';
    if (!gameAcc[gId]) gameAcc[gId] = { sum: 0, rated: 0, total: 0 };
    gameAcc[gId].total += 1;
    if (valid) {
      gameAcc[gId].rated += 1;
      gameAcc[gId].sum += r;
    }
  }

  const byGame: FeedbackSummary['byGame'] = {};
  for (const [gId, acc] of Object.entries(gameAcc)) {
    byGame[gId] = {
      averageRating: acc.rated > 0 ? Math.round((acc.sum / acc.rated) * 10) / 10 : 0,
      ratedCount: acc.rated,
      totalLetters: acc.total,
    };
  }

  return {
    averageRating: ratedCount > 0 ? Math.round((ratingSum / ratedCount) * 10) / 10 : 0,
    ratedCount,
    totalLetters: records.length,
    positivePercent: ratedCount > 0 ? Math.round((positiveCount / ratedCount) * 100) : 0,
    unreadCount,
    breakdown,
    byGame,
  };
}

export const FEEDBACK_GAME_LABELS: Record<string, string> = {
  doors: '🚪 DOORS',
  obby: '🏃 Паркур Obby',
  lava_survival: '🌋 Лава',
  bee_swarm: '🐝 Bee Farm',
  studio: '🛠️ Студия',
  other: '🎮 Другое',
};

import React, { useCallback, useEffect, useState } from 'react';
import { Crown, Medal, RefreshCw, Trophy, Clock, Layers } from 'lucide-react';
import {
  CharacterSkin,
  GameId,
  LeaderboardEntry,
  LeaderboardGameFilter,
  LeaderboardResponse,
} from '../game/types';
import { fetchLeaderboard, formatLeaderboardTime } from '../game/leaderboard';
import { PublicProfileLookupInput } from '../game/publicProfile';
import { AvatarPortraitIcon } from './AvatarPortraitIcon';

interface LeaderboardPanelProps {
  viewerPlayerKey?: string;
  viewerSkin: CharacterSkin;
  refreshTrigger?: number;
  onInspectPlayer?: (lookup: PublicProfileLookupInput) => void;
}

const FILTER_OPTIONS: { id: LeaderboardGameFilter; label: string }[] = [
  { id: 'all', label: 'Все игры' },
  { id: 'doors', label: 'DOORS' },
  { id: 'obby', label: 'Obby' },
  { id: 'lava_survival', label: 'Лава' },
  { id: 'bee_swarm', label: 'Bee Farm' },
];

const GAME_LABELS: Record<GameId, string> = {
  doors: 'DOORS',
  obby: 'Obby',
  lava_survival: 'Лава',
  bee_swarm: 'Bee Farm',
  studio: 'Студия',
};

function buildSafeAvatarSkin(entry: LeaderboardEntry, fallbackSkin: CharacterSkin): CharacterSkin {
  return {
    skinColor: entry.skin?.skinColor || fallbackSkin.skinColor || '#e5c298',
    torsoColor: entry.skin?.torsoColor || fallbackSkin.torsoColor || '#141619',
    legsColor: entry.skin?.legsColor || fallbackSkin.legsColor || '#18181b',
    headShape: entry.skin?.headShape === 'blocky' ? 'blocky' : 'round',
    hat: entry.skin?.hat || 'rocker_hair',
    face: entry.skin?.face || 'squiggly',
    outfit: entry.skin?.outfit,
    shirt: entry.skin?.shirt,
    pants: entry.skin?.pants,
    backpack: entry.skin?.backpack || 'none',
    name: entry.username,
  };
}

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({
  viewerPlayerKey,
  viewerSkin,
  refreshTrigger = 0,
  onInspectPlayer,
}) => {
  const [filter, setFilter] = useState<LeaderboardGameFilter>('all');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadLeaderboard = useCallback(
    async (silent: boolean = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      try {
        const res = await fetchLeaderboard(filter, viewerPlayerKey);
        setData(res);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter, viewerPlayerKey]
  );

  useEffect(() => {
    void loadLeaderboard(data !== null);
  }, [loadLeaderboard, refreshTrigger]);

  const entries = data?.entries || [];
  const totalPlayers = data?.totalPlayers || 0;
  const viewerRank = data?.viewerRank ?? null;
  const viewerEntry = data?.viewerEntry ?? null;
  const showViewerFooter = Boolean(viewerRank && viewerRank > 10 && viewerEntry);

  return (
    <section
      aria-label="Глобальная таблица лидеров Топ-10"
      data-testid="global-leaderboard"
      className="mt-4 sm:mt-6 bg-slate-900/95 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl"
    >
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Trophy size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                Глобальный рейтинг Топ-10
              </h2>
              <span className="text-xs text-slate-400 tabular-nums">
                {totalPlayers > 0 ? `Всего игроков: ${totalPlayers}` : 'По уровням и лучшему времени'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Сортировка по пройденным уровням, при равенстве — по лучшему времени прохождения
            </p>
          </div>
        </div>

        {/* Filter Segmented Control + Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            role="tablist"
            aria-label="Фильтр рейтинга по играм"
            className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto max-w-full"
          >
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={filter === opt.id}
                onClick={() => setFilter(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  filter === opt.id
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void loadLeaderboard(true)}
            aria-label="Обновить таблицу лидеров"
            title="Обновить рейтинг"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors shrink-0"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Column Headers (Desktop/Tablet) */}
      <div className="hidden sm:grid grid-cols-12 gap-3 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/80">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-6">Игрок</div>
        <div className="col-span-3 text-right flex items-center justify-end gap-1">
          <Layers size={12} className="text-sky-400" />
          <span>Уровни</span>
        </div>
        <div className="col-span-2 text-right flex items-center justify-end gap-1">
          <Clock size={12} className="text-amber-400" />
          <span>Время</span>
        </div>
      </div>

      {/* Leaderboard Rows */}
      <div className="divide-y divide-slate-800/70">
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3 px-3 py-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-slate-800" />
                <div className="w-8 h-8 rounded-full bg-slate-800" />
                <div className="w-32 h-4 rounded bg-slate-800" />
              </div>
              <div className="flex items-center gap-6">
                <div className="w-12 h-4 rounded bg-slate-800" />
                <div className="w-14 h-4 rounded bg-slate-800" />
              </div>
            </div>
          ))
        ) : entries.length === 0 ? (
          <div className="py-8 px-4 text-center">
            <p className="text-sm font-bold text-slate-200">
              Пока нет завершённых уровней в рейтинге
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Пройдите чекпоинт, откройте двери в DOORS или заберите Кубок — и ваш результат сразу попадёт в Топ-10.
            </p>
          </div>
        ) : (
          entries.map((entry, idx) => {
            const rank = entry.rank ?? idx + 1;
            const isSelf = Boolean(viewerPlayerKey && entry.playerKey === viewerPlayerKey);
            const rankTextColor =
              rank === 1
                ? 'text-amber-300'
                : rank === 2
                ? 'text-slate-200'
                : rank === 3
                ? 'text-orange-300'
                : 'text-slate-400';

            return (
              <button
                key={entry.playerKey}
                type="button"
                data-testid={`leaderboard-row-${rank}`}
                onClick={() =>
                  onInspectPlayer?.({
                    playerKey: entry.playerKey,
                    username: entry.username,
                    leaderboardEntry: entry,
                  })
                }
                title={`Открыть публичный профиль игрока ${entry.username}`}
                className={`w-full text-left grid grid-cols-12 items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2.5 transition-colors cursor-pointer group ${
                  isSelf ? 'bg-amber-500/10 hover:bg-amber-500/15' : 'hover:bg-slate-800/45'
                }`}
              >
                {/* Rank */}
                <div className={`col-span-2 sm:col-span-1 flex items-center justify-center font-black tabular-nums text-sm ${rankTextColor}`}>
                  {rank === 1 ? (
                    <Crown size={17} className="text-amber-400" />
                  ) : rank <= 3 ? (
                    <Medal size={16} className={rank === 2 ? 'text-slate-300' : 'text-orange-400'} />
                  ) : (
                    <span>{rank}</span>
                  )}
                </div>

                {/* Player Avatar + Username + Subtle Meta */}
                <div className="col-span-6 flex items-center gap-2.5 min-w-0">
                  <AvatarPortraitIcon
                    skin={buildSafeAvatarSkin(entry, viewerSkin)}
                    size="sm"
                    className="shrink-0 border border-slate-700"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-sm text-white group-hover:text-sky-300 transition-colors truncate">
                        {entry.username}
                      </span>
                      {isSelf && (
                        <span className="text-[11px] font-bold text-amber-300 shrink-0">
                          (Вы)
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                      <span>{GAME_LABELS[entry.bestGameId] || 'Obby'}</span>
                      {entry.victories > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">Побед: {entry.victories}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Completed Levels */}
                <div className="col-span-2 sm:col-span-3 text-right tabular-nums">
                  <span className="text-sm font-black text-sky-300">{entry.completedLevels}</span>
                  <span className="hidden md:inline text-xs text-slate-400 ml-1">ур.</span>
                </div>

                {/* Best Time */}
                <div className="col-span-2 text-right tabular-nums">
                  <span className={`text-sm font-bold ${entry.bestTimeSeconds > 0 ? 'text-emerald-300' : 'text-slate-500'}`}>
                    {formatLeaderboardTime(entry.bestTimeSeconds)}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Viewer Personal Rank Row if Outside Top 10 */}
      {showViewerFooter && viewerEntry && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={() =>
              onInspectPlayer?.({
                playerKey: viewerEntry.playerKey,
                username: viewerEntry.username,
                leaderboardEntry: viewerEntry,
              })
            }
            className="w-full text-left grid grid-cols-12 items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 cursor-pointer transition-colors"
          >
            <div className="col-span-2 sm:col-span-1 text-center font-black text-xs text-amber-300 tabular-nums">
              #{viewerRank}
            </div>
            <div className="col-span-6 flex items-center gap-2.5 min-w-0">
              <AvatarPortraitIcon
                skin={buildSafeAvatarSkin(viewerEntry, viewerSkin)}
                size="sm"
                className="shrink-0 border border-amber-400/50"
              />
              <span className="font-bold text-sm text-white truncate">
                {viewerEntry.username} <span className="text-xs text-amber-300">(Ваше место)</span>
              </span>
            </div>
            <div className="col-span-2 sm:col-span-3 text-right tabular-nums text-sm font-black text-sky-300">
              {viewerEntry.completedLevels} <span className="hidden md:inline text-xs text-slate-400 font-normal">ур.</span>
            </div>
            <div className="col-span-2 text-right tabular-nums text-sm font-bold text-emerald-300">
              {formatLeaderboardTime(viewerEntry.bestTimeSeconds)}
            </div>
          </button>
        </div>
      )}
    </section>
  );
};

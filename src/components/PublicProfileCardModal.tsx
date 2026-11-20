import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Trophy,
  UserPlus,
  Check,
  Lock,
  Layers,
  Clock,
  Coins,
  Gem,
  Footprints,
  RotateCcw,
  ShieldCheck,
  User as UserIcon,
  Tag,
} from 'lucide-react';
import { ALL_ACHIEVEMENTS } from '../game/achievements';
import {
  getPlayerTitleById,
  getTitleForAchievement,
  getUnlockedPlayerTitles,
} from '../game/titles';
import { formatLeaderboardTime } from '../game/leaderboard';
import {
  buildFallbackPublicProfile,
  fetchPublicPlayerProfile,
  PublicProfileLookupInput,
  resolveEquippedSkinLoadout,
} from '../game/publicProfile';
import { GameId, PublicPlayerProfile } from '../game/types';
import { SkinPreviewCanvas } from './SkinPreviewCanvas';
import { PlayerTitleBadge } from './PlayerTitleBadge';

interface PublicProfileCardModalProps {
  lookup: PublicProfileLookupInput;
  viewerUsername?: string;
  equippedTitleId?: string | null;
  onSelectPlayerTitle?: (titleId: string | null) => void;
  isAlreadyFriend?: boolean;
  onAddFriend?: (username: string) => void;
  onClose: () => void;
}

const GAME_TITLES: Record<GameId, string> = {
  doors: 'DOORS',
  obby: 'Obby',
  lava_survival: 'Лава',
  bee_swarm: 'Bee Farm',
  studio: 'Студия 3D',
};

export const PublicProfileCardModal: React.FC<PublicProfileCardModalProps> = ({
  lookup,
  viewerUsername,
  equippedTitleId,
  onSelectPlayerTitle,
  isAlreadyFriend = false,
  onAddFriend,
  onClose,
}) => {
  const [profile, setProfile] = useState<PublicPlayerProfile>(() =>
    buildFallbackPublicProfile(lookup)
  );
  const [loadingRemote, setLoadingRemote] = useState<boolean>(true);
  const [achievementFilter, setAchievementFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [friendAddedNow, setFriendAddedNow] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setProfile(buildFallbackPublicProfile(lookup));
    setLoadingRemote(true);
    setFriendAddedNow(false);

    fetchPublicPlayerProfile(lookup)
      .then((resolved) => {
        if (!cancelled) {
          setProfile(resolved);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingRemote(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lookup]);

  const unlockedMap = profile.unlockedAchievements || {};
  const unlockedCount = ALL_ACHIEVEMENTS.filter((ach) => Boolean(unlockedMap[ach.id])).length;
  const totalAchievements = ALL_ACHIEVEMENTS.length;
  const achievementPct = Math.round((unlockedCount / Math.max(1, totalAchievements)) * 100);

  const filteredAchievements = ALL_ACHIEVEMENTS.filter((ach) => {
    const unlocked = Boolean(unlockedMap[ach.id]);
    if (achievementFilter === 'unlocked') return unlocked;
    if (achievementFilter === 'locked') return !unlocked;
    return true;
  });

  const isSelf = Boolean(
    viewerUsername && profile.username.toLowerCase() === viewerUsername.toLowerCase()
  );
  const activeTitleId =
    isSelf && equippedTitleId !== undefined
      ? equippedTitleId
      : profile.skin.playerTitleId || null;
  const activeTitle = getPlayerTitleById(activeTitleId);
  const unlockedTitles = getUnlockedPlayerTitles(unlockedMap);
  const effectiveSkin = isSelf
    ? { ...profile.skin, playerTitleId: activeTitleId }
    : profile.skin;
  const equippedLoadout = resolveEquippedSkinLoadout(effectiveSkin);

  const perGameEntries = (Object.keys(GAME_TITLES) as GameId[])
    .map((gid) => ({
      gameId: gid,
      label: GAME_TITLES[gid],
      stats: profile.perGameStats?.[gid],
    }))
    .filter((item) => item.stats && (item.stats.completedLevels > 0 || item.stats.victories > 0));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-slate-950/85 backdrop-blur-sm pointer-events-auto"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Публичный профиль игрока ${profile.username}`}
        data-testid="public-profile-card-modal"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[92dvh] rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden text-slate-100"
      >
        {/* Top Modal Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="min-w-0">
            {activeTitle && (
              <div className="mb-1 flex items-center">
                <PlayerTitleBadge title={activeTitle} size="md" />
              </div>
            )}
            <div className="flex items-center gap-2.5 min-w-0">
              <h2
                data-testid="public-profile-username"
                className="text-lg sm:text-xl font-black text-white tracking-tight truncate"
              >
                {profile.username}
              </h2>
              {isSelf && (
                <span className="text-xs font-bold text-amber-300 shrink-0">(Вы)</span>
              )}
            </div>

            {/* Clean unboxed metadata row */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400 mt-0.5">
              <span className="inline-flex items-center gap-1 text-slate-300 font-medium">
                {profile.accountType === 'cloud' ? (
                  <>
                    <ShieldCheck size={13} className="text-emerald-400" />
                    <span>Аккаунт Blox Hub</span>
                  </>
                ) : (
                  <>
                    <UserIcon size={13} className="text-slate-400" />
                    <span>Гостевой профиль</span>
                  </>
                )}
              </span>

              {profile.isOnline && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-400 font-semibold">
                    В игре{profile.currentGameId ? ` (${GAME_TITLES[profile.currentGameId]})` : ''}
                  </span>
                </>
              )}

              {typeof profile.roomCheckpoint === 'number' && profile.isOnline && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">Этап {profile.roomCheckpoint + 1}</span>
                </>
              )}

              {typeof profile.leaderboardRank === 'number' && profile.leaderboardRank > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-300 font-semibold tabular-nums">
                    Рейтинг #{profile.leaderboardRank}
                  </span>
                </>
              )}

              {loadingRemote && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-500">Обновление данных...</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isSelf && onAddFriend && (
              isAlreadyFriend || friendAddedNow ? (
                <span className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-bold text-emerald-300 inline-flex items-center gap-1.5 whitespace-nowrap">
                  <Check size={14} />
                  <span>В друзьях</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onAddFriend(profile.username);
                    setFriendAddedNow(true);
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  <UserPlus size={14} />
                  <span>Добавить в друзья</span>
                </button>
              )
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть профиль"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Main 2-Column Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
            {/* Left Column: Live 3D Equipped Skin & Loadout */}
            <div className="md:col-span-5 flex flex-col gap-4">
              <div className="h-[270px] sm:h-[310px] w-full">
                <SkinPreviewCanvas skin={profile.skin} />
              </div>

              {/* Equipped Skin Items */}
              <div className="pt-3 border-t border-slate-800 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Экипированный скин</h3>
                  <div className="flex items-center gap-1.5" aria-label="Цвета скина">
                    <span
                      title={`Кожа: ${profile.skin.skinColor}`}
                      className="w-3.5 h-3.5 rounded-sm border border-slate-600"
                      style={{ backgroundColor: profile.skin.skinColor }}
                    />
                    <span
                      title={`Торс: ${profile.skin.torsoColor}`}
                      className="w-3.5 h-3.5 rounded-sm border border-slate-600"
                      style={{ backgroundColor: profile.skin.torsoColor }}
                    />
                    <span
                      title={`Ноги: ${profile.skin.legsColor}`}
                      className="w-3.5 h-3.5 rounded-sm border border-slate-600"
                      style={{ backgroundColor: profile.skin.legsColor }}
                    />
                  </div>
                </div>

                <dl className="divide-y divide-slate-800/80 text-xs">
                  {equippedLoadout.map((item) => (
                    <div
                      key={item.slot}
                      className="py-1.5 flex items-center justify-between gap-3"
                    >
                      <dt className="text-slate-400 shrink-0">{item.slot}</dt>
                      <dd className="text-slate-100 font-semibold text-right truncate">
                        <span className="mr-1.5" aria-hidden="true">
                          {item.icon}
                        </span>
                        {item.name}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            {/* Right Column: Bio, Total Stats & Achievements */}
            <div className="md:col-span-7 flex flex-col gap-5">
              {profile.bio && (
                <p className="text-sm text-slate-300 leading-relaxed pb-3 border-b border-slate-800">
                  «{profile.bio}»
                </p>
              )}

              {/* Total Lifetime Stats */}
              <section aria-label="Общая статистика игрока" className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-white">Общая статистика</h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-800 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="bg-slate-950/90 p-3 flex flex-col gap-1">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Layers size={13} className="text-sky-400" />
                      <span>Уровни</span>
                    </span>
                    <span
                      data-testid="public-profile-levels"
                      className="text-lg font-black text-white tabular-nums"
                    >
                      {profile.stats.completedLevels.toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-slate-950/90 p-3 flex flex-col gap-1">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Trophy size={13} className="text-amber-400" />
                      <span>Победы</span>
                    </span>
                    <span
                      data-testid="public-profile-victories"
                      className="text-lg font-black text-amber-300 tabular-nums"
                    >
                      {profile.stats.victories.toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-slate-950/90 p-3 flex flex-col gap-1">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Clock size={13} className="text-emerald-400" />
                      <span>Рекорд</span>
                    </span>
                    <span className="text-lg font-black text-emerald-300 tabular-nums">
                      {formatLeaderboardTime(profile.stats.bestTimeSeconds)}
                    </span>
                  </div>

                  <div className="bg-slate-950/90 p-3 flex flex-col gap-1">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Clock size={13} className="text-slate-400" />
                      <span>Всего в игре</span>
                    </span>
                    <span className="text-lg font-black text-slate-200 tabular-nums">
                      {formatLeaderboardTime(profile.stats.totalTimeSeconds)}
                    </span>
                  </div>

                  <div className="bg-slate-950/90 p-3 flex flex-col gap-1">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Coins size={13} className="text-amber-400" />
                      <span>Монеты</span>
                    </span>
                    <span className="text-base font-extrabold text-amber-300 tabular-nums">
                      {profile.stats.totalCoins.toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-slate-950/90 p-3 flex flex-col gap-1">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Gem size={13} className="text-cyan-400" />
                      <span>Кристаллы</span>
                    </span>
                    <span className="text-base font-extrabold text-cyan-300 tabular-nums">
                      {profile.stats.totalGems.toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-slate-950/90 p-3 flex flex-col gap-1">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Footprints size={13} className="text-indigo-400" />
                      <span>Прыжки</span>
                    </span>
                    <span className="text-base font-extrabold text-slate-100 tabular-nums">
                      {profile.stats.totalJumps.toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-slate-950/90 p-3 flex flex-col gap-1">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <RotateCcw size={13} className="text-rose-400" />
                      <span>Падения</span>
                    </span>
                    <span className="text-base font-extrabold text-slate-100 tabular-nums">
                      {profile.stats.totalDeaths.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Per-Game Breakdown Strip (if available) */}
                {perGameEntries.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pt-1">
                    {perGameEntries.map((item) => (
                      <span key={item.gameId} className="tabular-nums">
                        <strong className="text-slate-200 font-semibold">{item.label}:</strong>{' '}
                        {item.stats?.completedLevels || 0} ур.
                        {item.stats?.bestTimeSeconds
                          ? ` / ${formatLeaderboardTime(item.stats.bestTimeSeconds)}`
                          : ''}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {/* Achievements Showcase */}
              <section
                aria-label="Достижения игрока"
                className="pt-4 border-t border-slate-800 flex flex-col gap-3 flex-1 min-h-0"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <h3 className="text-sm font-bold text-white">Достижения</h3>
                    <p className="text-xs text-slate-400 tabular-nums">
                      Открыто {unlockedCount} из {totalAchievements} ({achievementPct}%)
                    </p>
                  </div>

                  {/* Interactive Filter Tabs */}
                  <div
                    role="tablist"
                    aria-label="Фильтр достижений профиля"
                    className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 self-start sm:self-auto"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={achievementFilter === 'all'}
                      onClick={() => setAchievementFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                        achievementFilter === 'all'
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Все ({totalAchievements})
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={achievementFilter === 'unlocked'}
                      onClick={() => setAchievementFilter('unlocked')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                        achievementFilter === 'unlocked'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Открытые ({unlockedCount})
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={achievementFilter === 'locked'}
                      onClick={() => setAchievementFilter('locked')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                        achievementFilter === 'locked'
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Закрытые ({totalAchievements - unlockedCount})
                    </button>
                  </div>
                </div>

                {/* Progress Track */}
                <div className="h-1.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-300"
                    style={{ width: `${achievementPct}%` }}
                  />
                </div>

                {/* Player Titles Quick Bar (self profile) */}
                {isSelf && onSelectPlayerTitle && (
                  <div
                    data-testid="profile-titles-bar"
                    className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-300 inline-flex items-center gap-1.5">
                        <Tag size={12} className="text-amber-400" />
                        <span>Титул над ником (открыто {unlockedTitles.length}/{totalAchievements})</span>
                      </span>
                      {activeTitle && (
                        <button
                          type="button"
                          data-testid="unequip-player-title-btn"
                          onClick={() => onSelectPlayerTitle(null)}
                          className="text-[11px] font-bold text-slate-400 hover:text-rose-300 cursor-pointer transition-colors"
                        >
                          Снять титул
                        </button>
                      )}
                    </div>
                    {unlockedTitles.length === 0 ? (
                      <p className="text-[11px] text-slate-500">
                        Выполняйте достижения ниже, чтобы разблокировать уникальные префиксы над ником (например, Pro Parkourer или Lava Survivor).
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          data-testid="title-option-none"
                          onClick={() => onSelectPlayerTitle(null)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                            !activeTitleId
                              ? 'bg-slate-700 border-amber-400 text-white'
                              : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          Без титула
                        </button>
                        {unlockedTitles.map((t) => {
                          const selected = activeTitleId === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              data-testid={`title-option-${t.id}`}
                              onClick={() => onSelectPlayerTitle(t.id)}
                              className={`p-0.5 rounded-lg border-2 cursor-pointer transition-all ${
                                selected
                                  ? 'border-white shadow-[0_0_12px_rgba(255,255,255,0.3)] scale-[1.02]'
                                  : 'border-transparent opacity-80 hover:opacity-100'
                              }`}
                            >
                              <PlayerTitleBadge title={t} size="sm" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Achievements List */}
                <div
                  data-testid="public-profile-achievements-list"
                  className="divide-y divide-slate-800/80 border border-slate-800 rounded-2xl bg-slate-950/60 max-h-64 overflow-y-auto"
                >
                  {filteredAchievements.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Нет достижений в выбранном фильтре.
                    </div>
                  ) : (
                    filteredAchievements.map((ach) => {
                      const unlockedAt = unlockedMap[ach.id];
                      const isUnlocked = Boolean(unlockedAt);
                      const rewardTitle = getTitleForAchievement(ach.id);
                      const isTitleEquipped = Boolean(rewardTitle && activeTitleId === rewardTitle.id);

                      return (
                        <div
                          key={ach.id}
                          className={`px-3.5 py-2.5 flex items-center justify-between gap-3 ${
                            isUnlocked ? 'opacity-100' : 'opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 border ${
                                isUnlocked
                                  ? 'bg-amber-500/15 border-amber-400/50 text-amber-300'
                                  : 'bg-slate-900 border-slate-800 text-slate-500'
                              }`}
                            >
                              <span aria-hidden="true">{ach.icon}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs sm:text-sm font-bold text-white truncate">
                                  {ach.title}
                                </span>
                                {rewardTitle && (
                                  <PlayerTitleBadge
                                    title={rewardTitle}
                                    size="xs"
                                    className={isUnlocked ? '' : 'grayscale opacity-70'}
                                  />
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                {ach.description}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 text-right text-[11px] tabular-nums flex items-center gap-2">
                            {isUnlocked ? (
                              <>
                                {isSelf && onSelectPlayerTitle && rewardTitle && (
                                  <button
                                    type="button"
                                    data-testid={`equip-title-btn-${rewardTitle.id}`}
                                    onClick={() =>
                                      onSelectPlayerTitle(isTitleEquipped ? null : rewardTitle.id)
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                                      isTitleEquipped
                                        ? 'bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 hover:bg-rose-500/20 hover:border-rose-400/60 hover:text-rose-200'
                                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                                    }`}
                                  >
                                    {isTitleEquipped ? 'Надет ✓' : 'Надеть'}
                                  </button>
                                )}
                                <span className="hidden sm:inline-flex items-center gap-1 text-emerald-400 font-semibold">
                                  <Check size={13} />
                                  <span>{new Date(unlockedAt).toLocaleDateString()}</span>
                                </span>
                              </>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-500">
                                <Lock size={12} />
                                <span>Закрыто</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-slate-400 truncate">
            Потяните 3D-модель скина, чтобы осмотреть аксессуары спереди и сзади
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0"
          >
            Закрыть
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

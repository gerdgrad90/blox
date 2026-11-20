import React from 'react';
import { Coins, Gem, ShieldCheck, Crown, Settings, User as UserIcon } from 'lucide-react';
import { CharacterSkin } from '../game/types';
import { isUserAdmin } from '../game/controls';
import { getPlayerTitleById } from '../game/titles';
import { AvatarPortraitIcon } from './AvatarPortraitIcon';
import { PlayerTitleBadge } from './PlayerTitleBadge';

interface PlayerProfileHUDProps {
  skin: CharacterSkin;
  username: string;
  coins: number;
  gems: number;
  isCloudAccount?: boolean;
  isGuest?: boolean;
  variant?: 'corner' | 'header';
  onClick?: () => void;
  className?: string;
}

export const PlayerProfileHUD: React.FC<PlayerProfileHUDProps> = ({
  skin,
  username,
  coins,
  gems,
  isCloudAccount = false,
  isGuest = false,
  variant = 'corner',
  onClick,
  className = '',
}) => {
  const isAdmin = isUserAdmin(username) || isUserAdmin(skin.name);
  const isCompact = variant === 'header';
  const equippedTitle = getPlayerTitleById(skin.playerTitleId);

  return (
    <button
      type="button"
      data-testid="player-profile-hud"
      onClick={onClick}
      title="Открыть профиль и настройки"
      aria-label={`Профиль игрока ${username}: ${coins} монет, ${gems} кристаллов. Нажмите, чтобы открыть профиль и настройки.`}
      className={`group relative flex items-center text-left cursor-pointer transition-all backdrop-blur-md border shadow-lg active:scale-[0.98] min-h-[44px] ${
        isCompact
          ? 'gap-2 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/95 border-slate-700/80 hover:border-amber-400/60'
          : 'gap-2 px-2 py-1.5 sm:px-3 sm:py-2 rounded-2xl bg-slate-950/90 hover:bg-slate-900/95 border-slate-700/80 hover:border-amber-400/70 shadow-[0_8px_24px_rgba(0,0,0,0.55)]'
      } ${className}`}
    >
      {/* Live Skin Avatar Thumbnail with Account Status Ring */}
      <div className="relative shrink-0">
        <AvatarPortraitIcon
          skin={skin}
          size={isCompact ? 'sm' : 'md'}
          interactive={false}
          className={
            isAdmin
              ? 'border-2 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.45)]'
              : isCloudAccount
              ? 'border-2 border-emerald-400/80'
              : 'border border-slate-600'
          }
        />
        <span
          className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-950 flex items-center justify-center shadow-sm ${
            isAdmin
              ? 'bg-amber-400 text-slate-950'
              : isCloudAccount
              ? 'bg-emerald-500 text-white'
              : 'bg-slate-700 text-slate-200'
          }`}
        >
          {isAdmin ? (
            <Crown size={9} />
          ) : isCloudAccount ? (
            <ShieldCheck size={9} />
          ) : (
            <UserIcon size={9} />
          )}
        </span>
      </div>

      {/* Username & Currency Totals */}
      <div className="flex flex-col min-w-0">
        {equippedTitle && (
          <div className="mb-0.5 max-w-[115px] sm:max-w-[165px]">
            <PlayerTitleBadge title={equippedTitle} size="xs" />
          </div>
        )}
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            data-testid="player-profile-hud-username"
            className={`font-black text-white truncate leading-tight ${
              isCompact ? 'text-xs max-w-[82px] sm:max-w-[130px]' : 'text-xs sm:text-sm max-w-[96px] sm:max-w-[165px]'
            }`}
          >
            {username}
          </span>
          {isGuest && !isCloudAccount && (
            <span className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-[9px] font-bold text-slate-400 uppercase tracking-wide shrink-0">
              Гость
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          <span
            data-testid="player-profile-hud-coins"
            className="flex items-center gap-1 text-[11px] sm:text-xs font-extrabold text-amber-300 leading-none"
          >
            <Coins size={12} className="text-amber-400 fill-amber-400 shrink-0" />
            <span className="font-mono-numbers">{coins.toLocaleString()}</span>
          </span>
          <span
            data-testid="player-profile-hud-gems"
            title="💎 Кристаллы — ГИПЕР РЕДКИЕ! За 10 💎 можно сменить никнейм."
            className="flex items-center gap-1 text-[11px] sm:text-xs font-extrabold text-cyan-300 leading-none"
          >
            <Gem size={12} className="text-cyan-400 fill-cyan-400 shrink-0" />
            <span className="font-mono-numbers">{gems.toLocaleString()}</span>
          </span>
        </div>
      </div>

      {/* Settings / Menu Indicator */}
      <div
        className={`hidden sm:flex shrink-0 items-center justify-center rounded-lg bg-slate-800/80 group-hover:bg-amber-500/20 border border-slate-700/70 group-hover:border-amber-400/50 text-slate-400 group-hover:text-amber-300 transition-colors ${
          isCompact ? 'p-1.5 ml-0.5' : 'p-1.5 ml-1'
        }`}
      >
        <Settings size={isCompact ? 13 : 14} className="group-hover:rotate-45 transition-transform duration-200" />
      </div>
    </button>
  );
};

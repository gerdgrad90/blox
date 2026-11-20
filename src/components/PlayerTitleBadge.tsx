import React from 'react';
import { PlayerTitle } from '../game/titles';

interface PlayerTitleBadgeProps {
  title: PlayerTitle;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const PlayerTitleBadge: React.FC<PlayerTitleBadgeProps> = ({
  title,
  size = 'sm',
  className = '',
}) => {
  const sizeClasses =
    size === 'xs'
      ? 'px-1.5 py-[1px] text-[9px] gap-1 rounded'
      : size === 'md'
      ? 'px-2.5 py-0.5 text-[11px] gap-1.5 rounded-lg'
      : 'px-2 py-0.5 text-[10px] gap-1 rounded-md';

  return (
    <span
      data-testid="player-title-badge"
      data-title-id={title.id}
      style={{
        backgroundImage: `linear-gradient(90deg, ${title.bgFrom}, ${title.bgTo})`,
        borderColor: title.borderColor,
        color: title.textColor,
      }}
      className={`inline-flex items-center font-black uppercase tracking-wider border leading-tight shadow-sm whitespace-nowrap max-w-full ${sizeClasses} ${className}`}
    >
      <span aria-hidden="true" className="shrink-0 leading-none">
        {title.icon}
      </span>
      <span className="truncate">{title.label}</span>
    </span>
  );
};

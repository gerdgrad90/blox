import React, { useMemo, useState } from 'react';
import { CharacterSkin } from '../game/types';
import { renderAvatarPortrait } from '../game/avatarPortrait';

interface AvatarPortraitIconProps {
  skin: CharacterSkin;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
  title?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarPortraitIconProps['size']>, string> = {
  xs: 'w-6 h-6 rounded-md',
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-11 h-11 rounded-xl',
  lg: 'w-14 h-14 rounded-2xl',
};

export const AvatarPortraitIcon: React.FC<AvatarPortraitIconProps> = ({
  skin,
  size = 'md',
  className = '',
  interactive = true,
  onClick,
  title,
}) => {
  const [tilt, setTilt] = useState<{ rx: number; ry: number }>({ rx: 0, ry: 0 });

  const portraitUrl = useMemo(() => renderAvatarPortrait(skin), [
    skin.skinColor,
    skin.torsoColor,
    skin.legsColor,
    skin.headShape,
    skin.hat,
    skin.face,
    skin.outfit,
    skin.shirt,
    skin.pants,
    skin.backpack,
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
    setTilt({ rx: -ny * 10, ry: nx * 12 });
  };

  const handleMouseLeave = () => {
    if (interactive) setTilt({ rx: 0, ry: 0 });
  };

  return (
    <div
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      title={title}
      style={
        interactive
          ? {
              transform: `perspective(240px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
            }
          : undefined
      }
      className={`relative shrink-0 overflow-hidden border border-slate-600/80 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 shadow-md transition-transform duration-150 flex items-center justify-center ${
        SIZE_CLASSES[size]
      } ${onClick ? 'cursor-pointer hover:scale-105' : ''} ${className}`}
    >
      {portraitUrl ? (
        <img
          src={portraitUrl}
          alt={`Портрет скина ${skin.name}`}
          className="w-full h-full object-cover select-none pointer-events-none"
          draggable={false}
        />
      ) : (
        /* Crisp stylized front-looking fallback if WebGL is unavailable */
        <svg viewBox="0 0 64 64" className="w-full h-full select-none pointer-events-none">
          {/* Shoulders / Outfit */}
          <rect x="10" y="42" width="44" height="22" rx="8" fill={skin.torsoColor || '#141619'} />
          {/* Head */}
          <rect
            x="17"
            y="14"
            width="30"
            height="30"
            rx={skin.headShape === 'blocky' ? 4 : 14}
            fill={skin.skinColor || '#e5c298'}
          />
          {/* Hat / Crown / Hair */}
          {skin.hat === 'crown' && (
            <polygon points="18,16 23,6 32,12 41,6 46,16" fill="#facc15" />
          )}
          {skin.hat === 'rocker_hair' && (
            <path d="M15 22 Q20 6 34 8 Q48 10 49 22 Q40 16 32 18 Q22 15 15 22Z" fill="#0f172a" />
          )}
          {skin.hat === 'cap' && (
            <path d="M16 18 Q32 6 48 18 L52 21 L16 21Z" fill="#dc2626" />
          )}
          {skin.hat === 'top_hat' && (
            <g>
              <rect x="14" y="13" width="36" height="4" rx="2" fill="#0f172a" />
              <rect x="20" y="2" width="24" height="12" rx="2" fill="#1e293b" />
            </g>
          )}
          {skin.hat === '6b47_helmet' && (
            <g>
              <path d="M14 23 Q16 7 32 7 Q48 7 50 23 L48 25 L16 25 Z" fill="#39412c" />
              <rect x="29" y="12" width="6" height="8" rx="1" fill="#262c1e" />
              <path d="M17 25 L23 44 L41 44 L47 25" fill="none" stroke="#141614" strokeWidth="2" />
            </g>
          )}
          {/* Eyes & Brows */}
          {skin.face === 'eye_scar' ? (
            <g>
              <line x1="21" y1="23" x2="29" y2="26" stroke="#111827" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="43" y1="23" x2="35" y2="26" stroke="#111827" strokeWidth="2.2" strokeLinecap="round" />
              <circle cx="26" cy="28" r="2.3" fill="#0c0f14" />
              <circle cx="38" cy="28" r="2.3" fill="#0c0f14" />
              <line x1="38.5" y1="31" x2="38" y2="36.5" stroke="#9a6648" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="25" y1="37" x2="39" y2="37" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
            </g>
          ) : (
            <g>
              <ellipse cx="26" cy="27" rx="2.4" ry="3.2" fill="#111827" />
              <ellipse cx="38" cy="27" rx="2.4" ry="3.2" fill="#111827" />
              <circle cx="25.2" cy="25.8" r="0.9" fill="#ffffff" />
              <circle cx="37.2" cy="25.8" r="0.9" fill="#ffffff" />
              <path d="M25 36 Q32 40 39 36" fill="none" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          )}
        </svg>
      )}
    </div>
  );
};

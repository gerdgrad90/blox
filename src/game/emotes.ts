export type EmoteId =
  | 'wave'
  | 'dance'
  | 'laugh'
  | 'cheer'
  | 'salute'
  | 'flip'
  | 'thumbs_up'
  | 'peace';

export interface EmoteDefinition {
  id: EmoteId;
  label: string;
  emoji: string;
  durationMs: number;
  shortcutKey: string;
  accentColor: string;
  badgeBg: string;
  description: string;
}

export const EMOTE_CATALOG: EmoteDefinition[] = [
  {
    id: 'wave',
    label: 'Помахать',
    emoji: '👋',
    durationMs: 2600,
    shortcutKey: '1',
    accentColor: '#38bdf8',
    badgeBg: 'from-sky-500/25 to-cyan-600/30 border-sky-400/60 text-sky-200',
    description: 'Дружелюбное приветствие рукой',
  },
  {
    id: 'dance',
    label: 'Танец',
    emoji: '💃',
    durationMs: 3600,
    shortcutKey: '2',
    accentColor: '#ec4899',
    badgeBg: 'from-pink-500/25 to-fuchsia-600/30 border-pink-400/60 text-pink-200',
    description: 'Весёлый ритмичный танец',
  },
  {
    id: 'laugh',
    label: 'Смех',
    emoji: '😂',
    durationMs: 2800,
    shortcutKey: '3',
    accentColor: '#facc15',
    badgeBg: 'from-amber-500/25 to-yellow-600/30 border-amber-400/60 text-amber-200',
    description: 'Громко рассмеяться до слёз',
  },
  {
    id: 'cheer',
    label: 'Ура!',
    emoji: '🙌',
    durationMs: 2800,
    shortcutKey: '4',
    accentColor: '#22c55e',
    badgeBg: 'from-emerald-500/25 to-green-600/30 border-emerald-400/60 text-emerald-200',
    description: 'Праздничный прыжок с руками вверх',
  },
  {
    id: 'salute',
    label: 'Салют',
    emoji: '🫡',
    durationMs: 2400,
    shortcutKey: '5',
    accentColor: '#a855f7',
    badgeBg: 'from-purple-500/25 to-violet-600/30 border-purple-400/60 text-purple-200',
    description: 'Отдать честь товарищам',
  },
  {
    id: 'flip',
    label: 'Сальто',
    emoji: '🌀',
    durationMs: 2000,
    shortcutKey: '6',
    accentColor: '#f97316',
    badgeBg: 'from-orange-500/25 to-red-600/30 border-orange-400/60 text-orange-200',
    description: 'Акробатический кувырок на 360°',
  },
  {
    id: 'thumbs_up',
    label: 'Класс!',
    emoji: '👍',
    durationMs: 2500,
    shortcutKey: '7',
    accentColor: '#10b981',
    badgeBg: 'from-emerald-500/25 to-teal-600/30 border-emerald-400/60 text-emerald-200',
    description: 'Показать палец вверх (VR-жест)',
  },
  {
    id: 'peace',
    label: 'Мир!',
    emoji: '✌️',
    durationMs: 2600,
    shortcutKey: '8',
    accentColor: '#22d3ee',
    badgeBg: 'from-cyan-500/25 to-indigo-600/30 border-cyan-400/60 text-cyan-200',
    description: 'Победный жест V двумя пальцами (VR-жест)',
  },
];

export const VALID_EMOTE_IDS: ReadonlySet<EmoteId> = new Set(
  EMOTE_CATALOG.map((item) => item.id)
);

export function isValidEmoteId(value: unknown): value is EmoteId {
  return typeof value === 'string' && VALID_EMOTE_IDS.has(value as EmoteId);
}

export function getEmoteById(id: EmoteId): EmoteDefinition {
  return EMOTE_CATALOG.find((e) => e.id === id) || EMOTE_CATALOG[0];
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameId, HeadShape } from './types';

export type FriendStatus = 'in_game' | 'online' | 'offline';

export interface FriendUser {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
  skinColor: string;
  torsoColor: string;
  legsColor: string;
  headShape?: HeadShape;
  hat?: string;
  face?: string;
  outfit?: string;
  shirt?: string;
  pants?: string;
  backpack?: string;
  status: FriendStatus;
  currentGame?: GameId | null;
  currentRoomId?: string;
  statusText: string;
  mutualCount?: number;
  addedAt: number;
  isCustom?: boolean;
}

export interface GameInvite {
  id: string;
  fromName: string;
  toFriendId: string;
  toFriendName: string;
  gameId: GameId;
  gameTitle: string;
  roomId: string;
  timestamp: number;
}

const STORAGE_KEY = 'blox_friends_v2';
const INVITES_CHANNEL = 'blox_game_invites';

export const INITIAL_FRIENDS: FriendUser[] = [
  {
    id: 'friend_pasha',
    name: 'Pasha_praser',
    username: '@Pasha_praser',
    avatarUrl: './assets/roblox_pasha_praser.png',
    skinColor: '#dfb08c',
    torsoColor: '#354026',
    legsColor: '#303a22',
    headShape: 'round',
    hat: '6b47_helmet',
    face: 'eye_scar',
    outfit: 'classic',
    shirt: 'rus_emr_vest',
    pants: 'rus_emr_pants',
    backpack: 'none',
    status: 'in_game',
    currentGame: 'doors',
    currentRoomId: 'public_doors',
    statusText: 'DOORS: Отель Ужасов [POV]',
    mutualCount: 4,
    addedAt: Date.now() - 86400000 * 4,
  },
  {
    id: 'friend_niko',
    name: 'Niko',
    username: '@Niko444102',
    avatarUrl: './assets/aistudio/Screenshot_20261028_105208_Roblox_e58d30f4.jpg',
    skinColor: '#f5d0a9',
    torsoColor: '#18181b',
    legsColor: '#1e3a8a',
    hat: 'rocker_hair',
    face: 'cool',
    status: 'in_game',
    currentGame: 'bee_swarm',
    currentRoomId: 'public_bee',
    statusText: 'Bee Swarm Simulator 3D',
    mutualCount: 3,
    addedAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'friend_alex',
    name: 'BuilderAlex',
    username: '@AlexBuilds_PRO',
    skinColor: '#fed7aa',
    torsoColor: '#0284c7',
    legsColor: '#0f172a',
    hat: 'cap',
    face: 'smile',
    status: 'in_game',
    currentGame: 'obby',
    currentRoomId: 'public_obby',
    statusText: 'Паркур: Blox Obby 3D (Этап 4)',
    mutualCount: 5,
    addedAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'friend_lava_king',
    name: 'MegaLavaBoy',
    username: '@LavaMaster77',
    skinColor: '#facc15',
    torsoColor: '#ea580c',
    legsColor: '#991b1b',
    hat: 'horns',
    face: 'laugh',
    status: 'in_game',
    currentGame: 'lava_survival',
    currentRoomId: 'public_lava',
    statusText: 'Пол — это Лава! Выживание',
    mutualCount: 2,
    addedAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'friend_pixel',
    name: 'PixelCat',
    username: '@PixelKitten_12',
    skinColor: '#e0e7ff',
    torsoColor: '#ec4899',
    legsColor: '#4f46e5',
    hat: 'headphones',
    face: 'cool',
    status: 'online',
    currentGame: null,
    statusText: 'В лобби Blox Hub',
    mutualCount: 1,
    addedAt: Date.now() - 86400000 * 1,
  },
  {
    id: 'friend_noob',
    name: 'ClassicNoob',
    username: '@ClassicNoob_00',
    skinColor: '#facc15',
    torsoColor: '#0284c7',
    legsColor: '#16a34a',
    hat: 'noob_head',
    face: 'smile',
    status: 'offline',
    currentGame: null,
    statusText: 'Был в сети 45 мин назад',
    mutualCount: 0,
    addedAt: Date.now() - 86400000 * 10,
  },
];

export function getStoredFriends(): FriendUser[] {
  if (typeof window === 'undefined') return INITIAL_FRIENDS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_FRIENDS));
      return INITIAL_FRIENDS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure Niko & Pasha_praser have their real avatarUrl/skin fields
      const mapped = parsed.map((f: FriendUser) => {
        if (f.id === 'friend_niko' && !f.avatarUrl) {
          return {
            ...f,
            avatarUrl: './assets/aistudio/Screenshot_20261028_105208_Roblox_e58d30f4.jpg',
          };
        }
        if (f.id === 'friend_pasha') {
          const pashaDefault = INITIAL_FRIENDS[0];
          return {
            ...pashaDefault,
            ...f,
            avatarUrl: f.avatarUrl || pashaDefault.avatarUrl,
            shirt: f.shirt || pashaDefault.shirt,
            pants: f.pants || pashaDefault.pants,
            hat: f.hat || pashaDefault.hat,
            face: f.face || pashaDefault.face,
          };
        }
        return f;
      });
      if (!mapped.some((f: FriendUser) => f.id === 'friend_pasha')) {
        const updated = [INITIAL_FRIENDS[0], ...mapped];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      }
      return mapped;
    }
    return INITIAL_FRIENDS;
  } catch {
    return INITIAL_FRIENDS;
  }
}

export function saveFriends(friends: FriendUser[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(friends));
  } catch {}
}

export function addFriend(name: string): FriendUser {
  const cleanName = name.trim().slice(0, 16);
  const cleanUsername = `@${cleanName.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user'}`;
  const colors = ['#fed7aa', '#facc15', '#f472b6', '#60a5fa', '#4ade80', '#c084fc'];
  const torsoColors = ['#dc2626', '#2563eb', '#16a34a', '#7c3aed', '#ea580c', '#0f172a'];
  const legColors = ['#1e293b', '#1e3a8a', '#14532d', '#581c87', '#334155'];

  const newFriend: FriendUser = {
    id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    username: cleanUsername,
    skinColor: colors[Math.floor(Math.random() * colors.length)],
    torsoColor: torsoColors[Math.floor(Math.random() * torsoColors.length)],
    legsColor: legColors[Math.floor(Math.random() * legColors.length)],
    hat: 'cap',
    face: 'smile',
    status: 'online',
    currentGame: null,
    statusText: 'В сети (Только что добавлен)',
    mutualCount: 1,
    addedAt: Date.now(),
    isCustom: true,
  };

  const existing = getStoredFriends();
  const updated = [newFriend, ...existing.filter((f) => f.name.toLowerCase() !== cleanName.toLowerCase())];
  saveFriends(updated);
  return newFriend;
}

export function removeFriend(id: string): FriendUser[] {
  const existing = getStoredFriends();
  const updated = existing.filter((f) => f.id !== id);
  saveFriends(updated);
  return updated;
}

export function broadcastGameInvite(invite: GameInvite): void {
  if (typeof window === 'undefined') return;

  // 1. Post to local BroadcastChannel for cross-tab multiplayer
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel(INVITES_CHANNEL);
      bc.postMessage(invite);
      setTimeout(() => bc.close(), 1000);
    } catch {}
  }

  // 2. Dispatch local & cross-device CustomEvents
  try {
    window.dispatchEvent(new CustomEvent('blox_game_invite', { detail: invite }));
    window.dispatchEvent(new CustomEvent('blox_game_invite_outbound', { detail: invite }));
  } catch {}
}

export function getGameDisplayName(gameId: GameId): string {
  switch (gameId) {
    case 'doors':
      return 'DOORS: Отель Ужасов [POV] 🚪';
    case 'bee_swarm':
      return 'Bee Swarm Simulator 3D 🐝';
    case 'lava_survival':
      return 'Пол — это Лава! Выживание 3D 🌋';
    case 'studio':
      return 'Blox Студия 3D 🛠️';
    case 'obby':
    default:
      return 'Паркур: Blox Obby 3D 🏃';
  }
}

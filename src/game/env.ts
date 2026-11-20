/**
 * Runtime environment helpers for Standalone HTML (file://, content://, blob://),
 * Android WebView APK, GitHub Pages static hosting, and PICO Immersive WebXR browsers.
 */

import type { GameId, MultiplayerMode } from './types';

export interface EmbeddedInviteConfig {
  mode: MultiplayerMode;
  gameId: GameId;
  roomId: string;
}

declare global {
  interface Window {
    __BLOX_STANDALONE_HTML__?: boolean;
    __BLOX_SERVER_URL__?: string;
    __BLOX_INVITE_CONFIG__?: Partial<EmbeddedInviteConfig>;
  }
}

export function hasHttpOrigin(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.location?.protocol === 'http:' || window.location?.protocol === 'https:')
  );
}

/**
 * True when running from a downloaded standalone HTML file (file://, content:// on Android,
 * blob:, data:, about:blank, or explicitly tagged by /api/download-html).
 */
export function isStandaloneHtmlRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__BLOX_STANDALONE_HTML__ === true) return true;
  const proto = window.location?.protocol || '';
  if (proto !== 'http:' && proto !== 'https:') {
    return true;
  }
  return false;
}

/**
 * Legacy alias used across auth, leaderboard, and networking modules to skip
 * nonexistent same-origin /api/* and /ws/* calls in standalone HTML / APK builds.
 */
export function isFileProtocol(): boolean {
  return isStandaloneHtmlRuntime();
}

export function getEmbeddedInviteConfig(): EmbeddedInviteConfig | null {
  if (typeof window === 'undefined') return null;
  const raw = window.__BLOX_INVITE_CONFIG__;
  if (!raw || typeof raw !== 'object') return null;

  const validGames: readonly GameId[] = ['doors', 'obby', 'lava_survival', 'bee_swarm', 'studio'];
  const hasValidGame = Boolean(raw.gameId && validGames.includes(raw.gameId as GameId));
  const rawRoom = typeof raw.roomId === 'string' ? raw.roomId.trim() : '';

  if (!hasValidGame && !rawRoom) return null;

  const gameId: GameId = hasValidGame ? (raw.gameId as GameId) : 'doors';
  const mode: MultiplayerMode =
    raw.mode === 'lan_room' || (rawRoom && !rawRoom.startsWith('public_')) ? 'lan_room' : 'online';

  const defaultPublicRoom =
    gameId === 'doors'
      ? 'public_doors'
      : gameId === 'lava_survival'
      ? 'public_lava'
      : gameId === 'bee_swarm'
      ? 'public_bee'
      : gameId === 'studio'
      ? 'public_studio'
      : 'public_obby';

  return {
    mode,
    gameId,
    roomId: (rawRoom || defaultPublicRoom).slice(0, 32),
  };
}

export function isSecureWebXRCapable(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.isSecureContext && typeof navigator !== 'undefined' && 'xr' in navigator)
  );
}

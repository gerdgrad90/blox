/**
 * Configurable Player Controls & Keybinds System
 */

export interface KeybindsConfig {
  forward: string;
  backward: string;
  left: string;
  right: string;
  jump: string;
  sprint: string;
  reset: string;
  backpack: string;
  mute: string;
  tool1: string;
  tool2: string;
  tool3: string;
  tool4: string;
  tool5: string;
  tool6: string;
  tool7: string;
}

export const DEFAULT_KEYBINDS: KeybindsConfig = {
  forward: 'KeyW',
  backward: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  sprint: 'ShiftLeft',
  reset: 'KeyR',
  backpack: 'KeyB',
  mute: 'KeyM',
  tool1: 'Digit1',
  tool2: 'Digit2',
  tool3: 'Digit3',
  tool4: 'Digit4',
  tool5: 'Digit5',
  tool6: 'Digit6',
  tool7: 'Digit7',
};

const STORAGE_KEY = 'blox_custom_keybinds_v1';

export function getKeybinds(): KeybindsConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_KEYBINDS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_KEYBINDS, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_KEYBINDS };
}

export function saveKeybinds(cfg: KeybindsConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {}
}

export function resetKeybinds(): KeybindsConfig {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
  return { ...DEFAULT_KEYBINDS };
}

/**
 * Human-readable key name for UI buttons
 */
export function formatKeyName(code: string): string {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3).toUpperCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'ПРОБЕЛ';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'CTRL';
  if (code === 'AltLeft' || code === 'AltRight') return 'ALT';
  if (code === 'ArrowUp') return '↑';
  if (code === 'ArrowDown') return '↓';
  if (code === 'ArrowLeft') return '←';
  if (code === 'ArrowRight') return '→';
  if (code === 'Enter') return 'ENTER';
  if (code === 'Tab') return 'TAB';
  if (code === 'Escape') return 'ESC';
  if (code === 'Backquote') return '` (Ё)';
  return code;
}

export function isUserAdmin(name: string): boolean {
  if (!name) return false;
  return name.trim().toLowerCase() === 'gerdgrad92';
}

/**
 * Mobile Touch Layout Configuration
 */
export interface MobileLayoutConfig {
  preset: 'standard' | 'reversed' | 'custom';
  joystickSide: 'left' | 'right';
  joystickX: number; // 0..120 px from side edge (default 16)
  joystickY: number; // 20..220 px from bottom edge (default 85)
  joystickScale: number; // 0.75..1.5 (default 1.0)
  joystickOpacity: number; // 0.3..1.0 (default 0.85)

  buttonsSide: 'left' | 'right';
  buttonsX: number; // 0..120 px from side edge (default 16)
  buttonsY: number; // 20..220 px from bottom edge (default 85)
  buttonsScale: number; // 0.75..1.5 (default 1.0)
  jumpScale: number; // 0.75..1.5 (default 1.0)
}

export const DEFAULT_MOBILE_LAYOUT: MobileLayoutConfig = {
  preset: 'standard',
  joystickSide: 'left',
  joystickX: 16,
  joystickY: 85,
  joystickScale: 1.0,
  joystickOpacity: 0.85,
  buttonsSide: 'right',
  buttonsX: 16,
  buttonsY: 85,
  buttonsScale: 1.0,
  jumpScale: 1.0,
};

const MOBILE_STORAGE_KEY = 'blox_custom_mobile_layout_v1';

export function getMobileLayout(): MobileLayoutConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_MOBILE_LAYOUT };
  try {
    const raw = localStorage.getItem(MOBILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_MOBILE_LAYOUT, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_MOBILE_LAYOUT };
}

export function saveMobileLayout(cfg: MobileLayoutConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MOBILE_STORAGE_KEY, JSON.stringify(cfg));
  } catch {}
}

export function resetMobileLayout(): MobileLayoutConfig {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(MOBILE_STORAGE_KEY);
    } catch {}
  }
  return { ...DEFAULT_MOBILE_LAYOUT };
}

import { CharacterSkin, PlayerLifetimeStats } from './types';
import { mergeWithStarterItems } from './shop';
import { isFileProtocol } from './env';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 16;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 64;
export const BIO_MAX = 80;

export const PROTECTED_OWNER_USERNAME = 'gerdgrad92';
export const OWNER_2FA_PIN = '0808';
export const NICKNAME_CHANGE_GEM_COST = 10;
export const HYPER_RARE_GEM_DROP_CHANCE = 0.15;

const AUTH_TOKEN_KEY = 'blox_auth_session_token_v1';
const REMEMBER_ME_KEY = 'blox_auth_remember_me_v1';
const OFFLINE_ACCOUNTS_KEY = 'blox_offline_accounts_v1';

export type AuthPersistenceMode = 'local' | 'session';

export interface CloudUserProfile {
  uid: string;
  username: string;
  bio: string;
  role: 'player';
  coins: number;
  gems: number;
  skin: CharacterSkin;
  ownedItems: string[];
  unlockedAchievements?: Record<string, number>;
  lifetimeStats?: Partial<PlayerLifetimeStats>;
  updatedAt?: number;
}

export function sanitizeUsername(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_]/g, '').slice(0, USERNAME_MAX);
}

export function isValidUsername(name: string): boolean {
  return (
    name.length >= USERNAME_MIN &&
    name.length <= USERNAME_MAX &&
    USERNAME_PATTERN.test(name)
  );
}

export function isProtectedOwnerUsername(rawName: string): boolean {
  if (!rawName) return false;
  const trimmed = rawName.trim().toLowerCase();
  const sanitized = sanitizeUsername(rawName).toLowerCase();
  return trimmed === PROTECTED_OWNER_USERNAME || sanitized === PROTECTED_OWNER_USERNAME;
}

export function requiresTwoFactorForUsername(rawName: string): boolean {
  return isProtectedOwnerUsername(rawName);
}

export function validateGuestNickname(rawName: string): {
  ok: boolean;
  clean: string;
  error?: string;
} {
  const clean = rawName.trim().slice(0, USERNAME_MAX);
  if (clean.length < USERNAME_MIN) {
    return {
      ok: false,
      clean,
      error: `Введите ник гостя (минимум ${USERNAME_MIN} символа).`,
    };
  }
  if (isProtectedOwnerUsername(clean)) {
    return {
      ok: false,
      clean,
      error: `Никнейм «${PROTECTED_OWNER_USERNAME}» защищён и недоступен для гостей. Войдите в аккаунт по паролю и 2FA.`,
    };
  }
  return { ok: true, clean };
}

export function validateNicknameChangeAffordability(
  currentName: string,
  nextName: string,
  gems: number
): { ok: boolean; changed: boolean; cost: number; error?: string } {
  const cur = (currentName || '').trim();
  const next = (nextName || '').trim();
  const changed = cur !== next;
  if (!changed) {
    return { ok: true, changed: false, cost: 0 };
  }
  const safeGems = Math.max(0, Math.floor(Number.isFinite(gems) ? gems : 0));
  if (safeGems < NICKNAME_CHANGE_GEM_COST) {
    return {
      ok: false,
      changed: true,
      cost: NICKNAME_CHANGE_GEM_COST,
      error: `Недостаточно кристаллов для смены ника! Нужно ${NICKNAME_CHANGE_GEM_COST} 💎 (у вас ${safeGems} 💎 — кристаллы гипер редкие).`,
    };
  }
  return { ok: true, changed: true, cost: NICKNAME_CHANGE_GEM_COST };
}

export function getStoredRememberMePreference(): boolean {
  try {
    const raw = localStorage.getItem(REMEMBER_ME_KEY);
    if (raw === 'false' || raw === '0') return false;
    if (raw === 'true' || raw === '1') return true;
  } catch {}
  return true;
}

export function setStoredRememberMePreference(rememberMe: boolean): void {
  try {
    localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? 'true' : 'false');
  } catch {}
}

export function getStoredAuthPersistenceMode(): AuthPersistenceMode | 'none' {
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(AUTH_TOKEN_KEY)) {
      return 'session';
    }
  } catch {}
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(AUTH_TOKEN_KEY)) {
      return 'local';
    }
  } catch {}
  return 'none';
}

export async function syncAuthSessionPersistence(
  rememberMe: boolean
): Promise<AuthPersistenceMode> {
  const mode: AuthPersistenceMode = rememberMe ? 'local' : 'session';
  setStoredRememberMePreference(rememberMe);
  if (typeof window !== 'undefined') {
    try {
      const fb = await import('../firebase');
      await fb.applyFirebaseAuthPersistence(rememberMe);
    } catch {
      // Non-fatal if Firebase Auth SDK is unavailable in offline/restricted contexts
    }
  }
  return mode;
}

export function getStoredAuthToken(): string | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const sessionToken = sessionStorage.getItem(AUTH_TOKEN_KEY);
      if (sessionToken) return sessionToken;
    }
  } catch {}
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string | null, rememberMe?: boolean): void {
  if (!token) {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {}
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(AUTH_TOKEN_KEY);
      }
    } catch {}
    return;
  }

  const persistAcrossRestarts =
    rememberMe !== undefined ? rememberMe : getStoredRememberMePreference();
  setStoredRememberMePreference(persistAcrossRestarts);

  if (persistAcrossRestarts) {
    try {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } catch {}
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(AUTH_TOKEN_KEY);
      }
    } catch {}
  } else {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {}
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(AUTH_TOKEN_KEY, token);
      } else {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
      }
    } catch {}
  }
}

function normalizeProfile(raw: CloudUserProfile): CloudUserProfile {
  return {
    uid: raw.uid,
    username: raw.username,
    bio: raw.bio || '',
    role: 'player',
    coins: Math.max(0, Math.floor(raw.coins || 0)),
    gems: Math.max(0, Math.floor(raw.gems || 0)),
    skin: {
      ...raw.skin,
      name: raw.username,
      headShape: raw.skin?.headShape === 'blocky' ? 'blocky' : 'round',
      playerTitleId:
        typeof raw.skin?.playerTitleId === 'string' && raw.skin.playerTitleId.trim()
          ? raw.skin.playerTitleId.trim()
          : null,
    },
    ownedItems: mergeWithStarterItems(raw.ownedItems || []),
    unlockedAchievements:
      raw.unlockedAchievements && typeof raw.unlockedAchievements === 'object'
        ? raw.unlockedAchievements
        : undefined,
    lifetimeStats:
      raw.lifetimeStats && typeof raw.lifetimeStats === 'object'
        ? {
            totalCoins: Math.max(0, Math.floor(Number(raw.lifetimeStats.totalCoins) || 0)),
            totalGems: Math.max(0, Math.floor(Number(raw.lifetimeStats.totalGems) || 0)),
            completedLevels: Math.max(0, Math.floor(Number(raw.lifetimeStats.completedLevels) || 0)),
            victories: Math.max(0, Math.floor(Number(raw.lifetimeStats.victories) || 0)),
            bestTimeSeconds: Math.max(0, Math.floor(Number(raw.lifetimeStats.bestTimeSeconds) || 0)),
            totalTimeSeconds: Math.max(0, Math.floor(Number(raw.lifetimeStats.totalTimeSeconds) || 0)),
            totalJumps: Math.max(0, Math.floor(Number(raw.lifetimeStats.totalJumps) || 0)),
            totalDeaths: Math.max(0, Math.floor(Number(raw.lifetimeStats.totalDeaths) || 0)),
          }
        : undefined,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
  };
}

function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') || '';
  return ct.toLowerCase().includes('application/json');
}

function isNetworkOrProxyError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error) {
    if (err.message === 'API_UNAVAILABLE') return true;
    const msg = err.message.toLowerCase();
    if (
      msg.includes('failed to fetch') ||
      msg.includes('load failed') ||
      msg.includes('networkerror') ||
      msg.includes('network request failed')
    ) {
      return true;
    }
  }
  return false;
}

// Offline / fallback vault (used in standalone HTML or when API server is unreachable)
interface OfflineStoredAccount {
  profile: CloudUserProfile;
  passwordSalt?: string;
  passwordHash: string;
  recoveryHash?: string;
  createdAt?: number;
}

function hashOfflinePassword(password: string, usernameLower: string): string {
  const input = `${usernameLower}::${password}::blox_salt`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv_${(hash >>> 0).toString(16)}`;
}

function loadOfflineAccounts(): Record<string, OfflineStoredAccount> {
  try {
    const raw = localStorage.getItem(OFFLINE_ACCOUNTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function saveOfflineAccounts(map: Record<string, OfflineStoredAccount>): void {
  try {
    localStorage.setItem(OFFLINE_ACCOUNTS_KEY, JSON.stringify(map));
  } catch {}
}

function encodeUtf8ToBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64UrlToUtf8(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (b64.length % 4)) % 4;
  const padded = b64 + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

async function computeSyncChecksumClient(payload: {
  uid: string;
  username: string;
  passwordSalt: string;
  passwordHash: string;
  updatedAt: number;
}): Promise<string> {
  const canonical = JSON.stringify({
    uid: payload.uid,
    username: payload.username,
    passwordSalt: payload.passwordSalt,
    passwordHash: payload.passwordHash,
    updatedAt: payload.updatedAt,
  });
  const text = `blox_sync_v1:${canonical}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 24);
  }
  return hashOfflinePassword(text, 'checksum');
}

function registerOfflineAccount(input: {
  username: string;
  password: string;
  recoveryCode?: string;
  bio?: string;
  skin: CharacterSkin;
  coins: number;
  gems: number;
  ownedItems?: string[];
  rememberMe?: boolean;
}): CloudUserProfile {
  const cleanUsername = sanitizeUsername(input.username);
  const store = loadOfflineAccounts();
  const lower = cleanUsername.toLowerCase();
  if (store[lower]) {
    throw new Error(`Никнейм «${cleanUsername}» уже занят.`);
  }
  const now = Date.now();
  const profile = normalizeProfile({
    uid: `local_${now.toString(36)}`,
    username: cleanUsername,
    bio: (input.bio || '').trim().slice(0, BIO_MAX),
    role: 'player',
    coins: input.coins,
    gems: input.gems,
    skin: { ...input.skin, name: cleanUsername },
    ownedItems: mergeWithStarterItems(input.ownedItems ?? []),
    updatedAt: now,
  });
  const cleanRecovery = (input.recoveryCode || '').trim().toLowerCase().slice(0, 32);
  store[lower] = {
    profile,
    passwordSalt: `off_${lower}`,
    passwordHash: hashOfflinePassword(input.password, lower),
    ...(cleanRecovery.length >= 3
      ? { recoveryHash: hashOfflinePassword(cleanRecovery, `rec_${lower}`) }
      : {}),
    createdAt: now,
  };
  saveOfflineAccounts(store);
  setStoredAuthToken(`offline:${lower}`, input.rememberMe);
  return profile;
}

function loginOfflineAccount(
  cleanUsername: string,
  password: string,
  twoFactorCode?: string,
  rememberMe?: boolean
): CloudUserProfile {
  const store = loadOfflineAccounts();
  const lower = cleanUsername.toLowerCase();
  const record = store[lower];
  if (!record || record.passwordHash !== hashOfflinePassword(password, lower)) {
    throw new Error('Неверный никнейм или пароль.');
  }
  if (requiresTwoFactorForUsername(cleanUsername)) {
    const cleanCode = (twoFactorCode || '').trim();
    if (!cleanCode) {
      const err = new Error(
        `Пароль верный! Введите код 2FA для входа в аккаунт ${record.profile.username}.`
      ) as Error & { requires2FA?: boolean; twoFactorStep?: 'prompt' | 'invalid' };
      err.requires2FA = true;
      err.twoFactorStep = 'prompt';
      throw err;
    }
    if (cleanCode !== OWNER_2FA_PIN) {
      const err = new Error('Неверный код 2FA. Проверьте пароль 2FA и попробуйте снова.') as Error & {
        requires2FA?: boolean;
        twoFactorStep?: 'prompt' | 'invalid';
      };
      err.requires2FA = true;
      err.twoFactorStep = 'invalid';
      throw err;
    }
  }
  setStoredAuthToken(`offline:${lower}`, rememberMe);
  return normalizeProfile(record.profile);
}

function resetOfflineAccountPassword(input: {
  username: string;
  verificationCode: string;
  newPassword: string;
  rememberMe?: boolean;
}): CloudUserProfile {
  const cleanUsername = sanitizeUsername(input.username);
  const store = loadOfflineAccounts();
  const lower = cleanUsername.toLowerCase();
  const record = store[lower];
  if (!record) {
    throw new Error(`Аккаунт «${cleanUsername}» не найден.`);
  }

  const code = input.verificationCode.trim();
  let verified = false;

  if (requiresTwoFactorForUsername(cleanUsername) && code === OWNER_2FA_PIN) {
    verified = true;
  }

  if (
    !verified &&
    record.recoveryHash &&
    record.recoveryHash === hashOfflinePassword(code.toLowerCase().slice(0, 32), `rec_${lower}`)
  ) {
    verified = true;
  }

  const compactCode = code.replace(/\s+/g, '');
  if (!verified && compactCode.startsWith('BLOXSYNC1.')) {
    try {
      const parsed = JSON.parse(decodeBase64UrlToUtf8(compactCode.slice('BLOXSYNC1.'.length)));
      if (
        parsed &&
        parsed.v === 1 &&
        parsed.uid === record.profile.uid &&
        parsed.passwordHash === record.passwordHash
      ) {
        verified = true;
      }
    } catch {}
  }

  if (!verified) {
    if (requiresTwoFactorForUsername(cleanUsername)) {
      throw new Error(`Неверный код 2FA для сброса пароля аккаунта ${record.profile.username}.`);
    }
    throw new Error(
      record.recoveryHash
        ? 'Неверное секретное слово / PIN восстановления или код BLOXSYNC1.'
        : 'У этого аккаунта не задан PIN восстановления — используйте код BLOXSYNC1.'
    );
  }

  const updatedProfile = normalizeProfile({
    ...record.profile,
    updatedAt: Date.now(),
  });
  store[lower] = {
    ...record,
    profile: updatedProfile,
    passwordHash: hashOfflinePassword(input.newPassword, lower),
  };
  saveOfflineAccounts(store);
  setStoredAuthToken(`offline:${lower}`, input.rememberMe);
  return updatedProfile;
}

async function importOfflineSyncCode(
  rawCode: string,
  confirmPassword?: string,
  twoFactorCode?: string,
  rememberMe?: boolean
): Promise<CloudUserProfile> {
  const cleanedCode = rawCode.replace(/\s+/g, '');
  if (!cleanedCode.startsWith('BLOXSYNC1.')) {
    throw new Error('Неверный формат кода синхронизации (ожидается BLOXSYNC1...).');
  }

  let parsed: any;
  try {
    const jsonText = decodeBase64UrlToUtf8(cleanedCode.slice('BLOXSYNC1.'.length));
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Повреждённый код синхронизации.');
  }

  const username = sanitizeUsername(String(parsed?.username || ''));
  if (!parsed || parsed.v !== 1 || !isValidUsername(username) || !parsed.skin) {
    throw new Error('Код синхронизации не содержит корректный профиль.');
  }

  if (
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof parsed.passwordSalt === 'string' &&
    typeof parsed.passwordHash === 'string' &&
    typeof parsed.checksum === 'string' &&
    !String(parsed.checksum).startsWith('fnv_')
  ) {
    const expected = await computeSyncChecksumClient({
      uid: String(parsed.uid || ''),
      username,
      passwordSalt: parsed.passwordSalt,
      passwordHash: parsed.passwordHash,
      updatedAt: Number(parsed.updatedAt || 0),
    });
    if (expected !== parsed.checksum) {
      throw new Error('Контрольная сумма кода синхронизации не совпадает.');
    }
  }

  const store = loadOfflineAccounts();
  const lower = username.toLowerCase();
  if (requiresTwoFactorForUsername(username)) {
    const cleanCode = (twoFactorCode || '').trim();
    if (!cleanCode) {
      const err = new Error(`Для переноса аккаунта ${username} введите код 2FA.`) as Error & {
        requires2FA?: boolean;
        twoFactorStep?: 'prompt' | 'invalid';
      };
      err.requires2FA = true;
      err.twoFactorStep = 'prompt';
      throw err;
    }
    if (cleanCode !== OWNER_2FA_PIN) {
      const err = new Error('Неверный код 2FA. Попробуйте ещё раз.') as Error & {
        requires2FA?: boolean;
        twoFactorStep?: 'prompt' | 'invalid';
      };
      err.requires2FA = true;
      err.twoFactorStep = 'invalid';
      throw err;
    }
  }
  const existing = store[lower];
  const now = Date.now();
  const importedUpdatedAt =
    typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)
      ? parsed.updatedAt
      : now;

  let finalProfile: CloudUserProfile;

  if (existing) {
    const sameHash = existing.passwordHash === parsed.passwordHash;
    const pwdMatch =
      confirmPassword &&
      existing.passwordHash === hashOfflinePassword(confirmPassword, lower);

    if (!sameHash && !pwdMatch) {
      const err = new Error(
        confirmPassword
          ? 'Неверный пароль существующего аккаунта.'
          : `Аккаунт «${username}» уже есть на этом устройстве. Введите пароль аккаунта для подтверждения.`
      ) as Error & {
        needsPassword?: boolean;
      };
      err.needsPassword = true;
      throw err;
    }

    const mergedItems = mergeWithStarterItems([
      ...(existing.profile.ownedItems || []),
      ...(Array.isArray(parsed.ownedItems) ? parsed.ownedItems : []),
    ]);

    const useImported = importedUpdatedAt >= (existing.profile.updatedAt || 0);
    finalProfile = normalizeProfile({
      uid: existing.profile.uid,
      username,
      bio: useImported ? String(parsed.bio || '') : existing.profile.bio,
      role: 'player',
      coins: useImported && typeof parsed.coins === 'number' ? parsed.coins : existing.profile.coins,
      gems: useImported && typeof parsed.gems === 'number' ? parsed.gems : existing.profile.gems,
      skin: useImported ? parsed.skin : existing.profile.skin,
      ownedItems: mergedItems,
      updatedAt: now,
    });

    store[lower] = {
      ...existing,
      profile: finalProfile,
    };
  } else {
    finalProfile = normalizeProfile({
      uid: typeof parsed.uid === 'string' ? parsed.uid : `local_${now.toString(36)}`,
      username,
      bio: String(parsed.bio || ''),
      role: 'player',
      coins: typeof parsed.coins === 'number' ? parsed.coins : 100,
      gems: typeof parsed.gems === 'number' ? parsed.gems : 0,
      skin: parsed.skin,
      ownedItems: mergeWithStarterItems(Array.isArray(parsed.ownedItems) ? parsed.ownedItems : []),
      updatedAt: now,
    });

    store[lower] = {
      profile: finalProfile,
      passwordSalt: typeof parsed.passwordSalt === 'string' ? parsed.passwordSalt : `off_${lower}`,
      passwordHash:
        typeof parsed.passwordHash === 'string'
          ? parsed.passwordHash
          : hashOfflinePassword(confirmPassword || '1234', lower),
      createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : now,
    };
  }

  saveOfflineAccounts(store);
  setStoredAuthToken(`offline:${lower}`, rememberMe);
  return finalProfile;
}

export async function registerAccount(input: {
  username: string;
  password: string;
  recoveryCode?: string;
  bio?: string;
  skin: CharacterSkin;
  coins: number;
  gems: number;
  ownedItems?: string[];
  rememberMe?: boolean;
}): Promise<CloudUserProfile> {
  const cleanUsername = sanitizeUsername(input.username);
  if (!isValidUsername(cleanUsername)) {
    throw new Error(
      `Никнейм должен быть от ${USERNAME_MIN} до ${USERNAME_MAX} символов (латиница, цифры и _).`
    );
  }
  if (input.password.length < PASSWORD_MIN || input.password.length > PASSWORD_MAX) {
    throw new Error(`Пароль должен содержать от ${PASSWORD_MIN} до ${PASSWORD_MAX} символов.`);
  }

  const persistSession =
    input.rememberMe !== undefined ? input.rememberMe : getStoredRememberMePreference();
  await syncAuthSessionPersistence(persistSession);

  if (isFileProtocol()) {
    return registerOfflineAccount({ ...input, rememberMe: persistSession });
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cleanUsername,
        password: input.password,
        ...(input.recoveryCode && input.recoveryCode.trim().length >= 3
          ? { recoveryCode: input.recoveryCode.trim().slice(0, 32) }
          : {}),
        bio: (input.bio || '').trim().slice(0, BIO_MAX),
        skin: { ...input.skin, name: cleanUsername },
        coins: input.coins,
        gems: input.gems,
        ownedItems: mergeWithStarterItems(input.ownedItems ?? []),
      }),
    });

    if (!isJsonResponse(res)) {
      throw new Error('API_UNAVAILABLE');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.profile || !data?.token) {
      throw new Error(data.error || 'Не удалось создать аккаунт.');
    }

    setStoredAuthToken(data.token, persistSession);
    return normalizeProfile(data.profile);
  } catch (err: unknown) {
    if (isNetworkOrProxyError(err)) {
      return registerOfflineAccount({ ...input, rememberMe: persistSession });
    }
    throw err;
  }
}

export async function loginAccount(
  usernameRaw: string,
  password: string,
  twoFactorCode?: string,
  rememberMe?: boolean
): Promise<CloudUserProfile> {
  const cleanUsername = sanitizeUsername(usernameRaw);
  if (!cleanUsername || !password) {
    throw new Error('Введите никнейм и пароль.');
  }

  const persistSession =
    rememberMe !== undefined ? rememberMe : getStoredRememberMePreference();
  await syncAuthSessionPersistence(persistSession);

  if (isFileProtocol()) {
    return loginOfflineAccount(cleanUsername, password, twoFactorCode, persistSession);
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cleanUsername,
        password,
        ...(twoFactorCode !== undefined ? { twoFactorCode } : {}),
      }),
    });

    if (!isJsonResponse(res)) {
      throw new Error('API_UNAVAILABLE');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.profile || !data?.token) {
      const err = new Error(data.error || 'Неверный никнейм или пароль.') as Error & {
        requires2FA?: boolean;
        twoFactorStep?: 'prompt' | 'invalid';
      };
      if (data?.requires2FA) {
        err.requires2FA = true;
        err.twoFactorStep = data.twoFactorStep === 'invalid' ? 'invalid' : 'prompt';
      }
      throw err;
    }

    setStoredAuthToken(data.token, persistSession);
    return normalizeProfile(data.profile);
  } catch (err: unknown) {
    if (isNetworkOrProxyError(err)) {
      return loginOfflineAccount(cleanUsername, password, twoFactorCode, persistSession);
    }
    throw err;
  }
}

export async function resetAccountPassword(input: {
  username: string;
  verificationCode: string;
  newPassword: string;
  rememberMe?: boolean;
}): Promise<CloudUserProfile> {
  const cleanUsername = sanitizeUsername(input.username);
  const cleanCode = input.verificationCode.trim();
  if (!isValidUsername(cleanUsername)) {
    throw new Error(
      `Введите корректный никнейм аккаунта (от ${USERNAME_MIN} до ${USERNAME_MAX} символов).`
    );
  }
  if (!cleanCode) {
    throw new Error(
      isProtectedOwnerUsername(cleanUsername)
        ? 'Введите код 2FA для подтверждения сброса пароля.'
        : 'Введите секретное слово / PIN восстановления или код BLOXSYNC1.'
    );
  }
  if (input.newPassword.length < PASSWORD_MIN || input.newPassword.length > PASSWORD_MAX) {
    throw new Error(`Новый пароль должен содержать от ${PASSWORD_MIN} до ${PASSWORD_MAX} символов.`);
  }

  const persistSession =
    input.rememberMe !== undefined ? input.rememberMe : getStoredRememberMePreference();
  await syncAuthSessionPersistence(persistSession);

  if (isFileProtocol()) {
    return resetOfflineAccountPassword({
      username: cleanUsername,
      verificationCode: cleanCode,
      newPassword: input.newPassword,
      rememberMe: persistSession,
    });
  }

  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cleanUsername,
        verificationCode: cleanCode,
        newPassword: input.newPassword,
      }),
    });

    if (!isJsonResponse(res)) {
      throw new Error('API_UNAVAILABLE');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.profile || !data?.token) {
      throw new Error(data.error || 'Не удалось сбросить пароль.');
    }

    setStoredAuthToken(data.token, persistSession);
    return normalizeProfile(data.profile);
  } catch (err: unknown) {
    if (isNetworkOrProxyError(err)) {
      return resetOfflineAccountPassword({
        username: cleanUsername,
        verificationCode: cleanCode,
        newPassword: input.newPassword,
        rememberMe: persistSession,
      });
    }
    throw err;
  }
}

export async function fetchCurrentSession(): Promise<CloudUserProfile | null> {
  if (typeof window !== 'undefined') {
    void import('../firebase')
      .then((fb) =>
        fb
          .applyFirebaseAuthPersistence(getStoredRememberMePreference())
          .then(() => fb.waitForFirebaseAuthReady(500))
      )
      .catch(() => {});
  }

  const token = getStoredAuthToken();
  if (!token) return null;

  if (token.startsWith('offline:')) {
    const lower = token.slice('offline:'.length);
    const store = loadOfflineAccounts();
    return store[lower] ? normalizeProfile(store[lower].profile) : null;
  }

  if (isFileProtocol()) {
    return null;
  }

  try {
    const res = await fetch('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!isJsonResponse(res)) return null;
    if (!res.ok) {
      if (res.status === 401) {
        setStoredAuthToken(null);
      }
      return null;
    }
    const data = await res.json().catch(() => null);
    return data?.profile ? normalizeProfile(data.profile) : null;
  } catch {
    return null;
  }
}

export async function updateAccountProfile(updates: {
  username?: string;
  bio?: string;
  skin?: CharacterSkin;
  coins?: number;
  gems?: number;
  ownedItems?: string[];
  unlockedAchievements?: Record<string, number>;
  lifetimeStats?: Partial<PlayerLifetimeStats>;
}): Promise<CloudUserProfile | null> {
  const token = getStoredAuthToken();
  if (!token) return null;

  const updateOffline = () => {
    const oldLower = token.startsWith('offline:')
      ? token.slice('offline:'.length)
      : updates.username?.toLowerCase() || '';
    const store = loadOfflineAccounts();
    const record = store[oldLower];
    if (!record) return null;

    const nextUsername = updates.username
      ? sanitizeUsername(updates.username)
      : record.profile.username;
    const nextLower = nextUsername.toLowerCase();

    const isRenaming = nextUsername !== record.profile.username;
    if (nextLower !== oldLower && store[nextLower]) {
      throw new Error(`Никнейм «${nextUsername}» уже занят.`);
    }

    let nextGems =
      updates.gems !== undefined ? Math.max(0, Math.floor(updates.gems)) : record.profile.gems;
    if (isRenaming) {
      const availableGems = Math.max(record.profile.gems, nextGems);
      const check = validateNicknameChangeAffordability(
        record.profile.username,
        nextUsername,
        availableGems
      );
      if (!check.ok) {
        throw new Error(check.error);
      }
      nextGems = availableGems - NICKNAME_CHANGE_GEM_COST;
    }

    const updated = normalizeProfile({
      ...record.profile,
      username: nextUsername,
      bio: updates.bio !== undefined ? updates.bio.trim().slice(0, BIO_MAX) : record.profile.bio,
      coins: updates.coins !== undefined ? updates.coins : record.profile.coins,
      gems: nextGems,
      skin: updates.skin ? { ...updates.skin, name: nextUsername } : record.profile.skin,
      ownedItems: updates.ownedItems
        ? mergeWithStarterItems([...(record.profile.ownedItems || []), ...updates.ownedItems])
        : record.profile.ownedItems,
      unlockedAchievements: updates.unlockedAchievements
        ? { ...(record.profile.unlockedAchievements || {}), ...updates.unlockedAchievements }
        : record.profile.unlockedAchievements,
      lifetimeStats: updates.lifetimeStats
        ? {
            totalJumps: Math.max(
              record.profile.lifetimeStats?.totalJumps || 0,
              updates.lifetimeStats.totalJumps || 0
            ),
            totalDeaths: Math.max(
              record.profile.lifetimeStats?.totalDeaths || 0,
              updates.lifetimeStats.totalDeaths || 0
            ),
          }
        : record.profile.lifetimeStats,
      updatedAt: Date.now(),
    });

    if (nextLower !== oldLower) {
      delete store[oldLower];
      const keepLocal = getStoredAuthPersistenceMode() !== 'session';
      setStoredAuthToken(`offline:${nextLower}`, keepLocal);
    }
    store[nextLower] = { ...record, profile: updated };
    saveOfflineAccounts(store);
    return updated;
  };

  if (token.startsWith('offline:')) {
    return updateOffline();
  }

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    if (!isJsonResponse(res)) {
      throw new Error('API_UNAVAILABLE');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Не удалось обновить профиль.');
    }
    return data?.profile ? normalizeProfile(data.profile) : null;
  } catch (err: unknown) {
    if (isNetworkOrProxyError(err)) {
      return updateOffline();
    }
    throw err;
  }
}

export async function syncAccountNow(payload?: {
  bio?: string;
  skin?: CharacterSkin;
  coins?: number;
  gems?: number;
  ownedItems?: string[];
  unlockedAchievements?: Record<string, number>;
  lifetimeStats?: Partial<PlayerLifetimeStats>;
  clientUpdatedAt?: number;
}): Promise<CloudUserProfile | null> {
  const token = getStoredAuthToken();
  if (!token) return null;

  if (token.startsWith('offline:')) {
    return fetchCurrentSession();
  }

  try {
    const res = await fetch('/api/auth/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload || {}),
    });
    if (!isJsonResponse(res)) return null;
    if (!res.ok) {
      if (res.status === 401) {
        setStoredAuthToken(null);
      }
      return null;
    }
    const data = await res.json().catch(() => ({}));
    return data?.profile ? normalizeProfile(data.profile) : null;
  } catch {
    return null;
  }
}

export async function exportAccountSyncCode(fallbackProfile?: CloudUserProfile | null): Promise<string> {
  const token = getStoredAuthToken();
  if (!token) {
    throw new Error('Сначала войдите в аккаунт.');
  }

  const buildLocalSyncCode = async (): Promise<string> => {
    const lower = token.startsWith('offline:')
      ? token.slice('offline:'.length)
      : fallbackProfile?.username?.toLowerCase() || '';
    const store = loadOfflineAccounts();
    const record = lower ? store[lower] : undefined;
    const profile = record?.profile || fallbackProfile;
    if (!profile) {
      throw new Error('Не найден профиль для создания кода синхронизации.');
    }

    const now = profile.updatedAt || Date.now();
    const passwordSalt = record?.passwordSalt || `off_${profile.username.toLowerCase()}`;
    const passwordHash =
      record?.passwordHash || hashOfflinePassword(profile.uid, profile.username.toLowerCase());

    const corePayload = {
      v: 1,
      uid: profile.uid,
      username: profile.username,
      bio: profile.bio || '',
      coins: profile.coins,
      gems: profile.gems,
      skin: profile.skin,
      ownedItems: mergeWithStarterItems(profile.ownedItems || []),
      passwordSalt,
      passwordHash,
      createdAt: record?.createdAt || now,
      updatedAt: now,
    };
    const checksum = await computeSyncChecksumClient(corePayload);
    return `BLOXSYNC1.${encodeUtf8ToBase64Url(JSON.stringify({ ...corePayload, checksum }))}`;
  };

  if (token.startsWith('offline:')) {
    return buildLocalSyncCode();
  }

  try {
    const res = await fetch('/api/auth/sync-export', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!isJsonResponse(res)) {
      throw new Error('API_UNAVAILABLE');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.syncCode) {
      throw new Error(data.error || 'Не удалось создать код синхронизации.');
    }
    return String(data.syncCode);
  } catch (err: unknown) {
    if (isNetworkOrProxyError(err)) {
      return buildLocalSyncCode();
    }
    throw err;
  }
}

export async function importAccountSyncCode(
  syncCode: string,
  password?: string,
  twoFactorCode?: string,
  rememberMe?: boolean
): Promise<CloudUserProfile> {
  const cleanedCode = syncCode.replace(/\s+/g, '');
  const persistSession =
    rememberMe !== undefined ? rememberMe : getStoredRememberMePreference();
  await syncAuthSessionPersistence(persistSession);

  try {
    const res = await fetch('/api/auth/sync-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        syncCode: cleanedCode,
        password,
        ...(twoFactorCode !== undefined ? { twoFactorCode } : {}),
      }),
    });

    if (!isJsonResponse(res)) {
      throw new Error('API_UNAVAILABLE');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.profile || !data?.token) {
      const err = new Error(data.error || 'Не удалось импортировать аккаунт по коду.') as Error & {
        needsPassword?: boolean;
        requires2FA?: boolean;
        twoFactorStep?: 'prompt' | 'invalid';
      };
      err.needsPassword = Boolean(data.needsPassword);
      if (data?.requires2FA) {
        err.requires2FA = true;
        err.twoFactorStep = data.twoFactorStep === 'invalid' ? 'invalid' : 'prompt';
      }
      throw err;
    }
    setStoredAuthToken(data.token, persistSession);
    return normalizeProfile(data.profile);
  } catch (err: unknown) {
    if (isNetworkOrProxyError(err)) {
      return importOfflineSyncCode(cleanedCode, password, twoFactorCode, persistSession);
    }
    throw err;
  }
}

export function connectAccountSyncSocket(
  onSync: (profile: CloudUserProfile) => void,
  onForcedLogout: () => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const token = getStoredAuthToken();
  if (!token || token.startsWith('offline:')) return () => {};

  let ws: WebSocket | null = null;
  let closed = false;
  let retryAttempt = 0;
  let reconnectTimer: number | null = null;
  let heartbeatTimer: number | null = null;
  let pongTimeoutTimer: number | null = null;

  const clearTimers = () => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (heartbeatTimer !== null) {
      window.clearTimeout(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (pongTimeoutTimer !== null) {
      window.clearTimeout(pongTimeoutTimer);
      pongTimeoutTimer = null;
    }
  };

  const scheduleHeartbeat = () => {
    if (closed || !ws || ws.readyState !== WebSocket.OPEN) return;
    if (heartbeatTimer !== null) {
      window.clearTimeout(heartbeatTimer);
      heartbeatTimer = null;
    }
    heartbeatTimer = window.setTimeout(() => {
      heartbeatTimer = null;
      if (closed || !ws || ws.readyState !== WebSocket.OPEN) return;
      try {
        ws.send(JSON.stringify({ type: 'ping', clientTs: Date.now() }));
      } catch {
        try {
          ws.close();
        } catch {}
        return;
      }
      if (pongTimeoutTimer !== null) window.clearTimeout(pongTimeoutTimer);
      pongTimeoutTimer = window.setTimeout(() => {
        pongTimeoutTimer = null;
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            ws.close(4008, 'Auth heartbeat timeout');
          } catch {}
        }
      }, 5000);
    }, 25000);
  };

  const scheduleRetry = () => {
    if (closed || reconnectTimer !== null) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const baseDelay = Math.min(30000, 1500 * Math.pow(2, Math.min(retryAttempt, 5)));
    const jittered = Math.round(baseDelay * (0.75 + Math.random() * 0.5));
    retryAttempt = Math.min(retryAttempt + 1, 8);
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, Math.min(30000, jittered));
  };

  const connect = () => {
    if (closed || isFileProtocol()) return;
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      return;
    }
    const latestToken = getStoredAuthToken();
    if (!latestToken || latestToken.startsWith('offline:')) return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws/auth?token=${encodeURIComponent(latestToken)}`;
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
      ws = socket;
    } catch {
      scheduleRetry();
      return;
    }

    socket.onopen = () => {
      if (closed || ws !== socket) return;
      retryAttempt = 0;
      scheduleHeartbeat();
    };

    socket.onmessage = (event) => {
      if (closed || ws !== socket) return;
      if (pongTimeoutTimer !== null) {
        window.clearTimeout(pongTimeoutTimer);
        pongTimeoutTimer = null;
      }
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.type === 'pong') {
          scheduleHeartbeat();
          return;
        }
        if ((msg.type === 'account:synced' || msg.type === 'account:hello') && msg.profile) {
          onSync(normalizeProfile(msg.profile));
        } else if (msg.type === 'account:logged_out') {
          setStoredAuthToken(null);
          onForcedLogout();
        }
      } catch {}
    };

    socket.onclose = (ev) => {
      if (ws === socket) ws = null;
      if (heartbeatTimer !== null) {
        window.clearTimeout(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (pongTimeoutTimer !== null) {
        window.clearTimeout(pongTimeoutTimer);
        pongTimeoutTimer = null;
      }
      if (closed || ev.code === 4001) {
        return;
      }
      scheduleRetry();
    };
  };

  const handleOnlineOrVisible = () => {
    if (closed) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      retryAttempt = 0;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      connect();
    } else {
      scheduleHeartbeat();
    }
  };

  window.addEventListener('online', handleOnlineOrVisible);
  document.addEventListener('visibilitychange', handleOnlineOrVisible);
  connect();

  return () => {
    closed = true;
    clearTimers();
    window.removeEventListener('online', handleOnlineOrVisible);
    document.removeEventListener('visibilitychange', handleOnlineOrVisible);
    if (ws && ws.readyState < WebSocket.CLOSING) {
      ws.close();
    }
  };
}

export async function logoutAccount(allDevices = false): Promise<void> {
  const token = getStoredAuthToken();
  setStoredAuthToken(null);
  if (typeof window !== 'undefined') {
    try {
      const fb = await import('../firebase');
      if (fb.auth.currentUser) {
        await fb.signOutAccount();
      }
    } catch {}
  }
  if (token && !token.startsWith('offline:')) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ allDevices }),
      });
    } catch {}
  }
}

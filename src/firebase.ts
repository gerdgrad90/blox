import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { CharacterSkin } from './game/types';

export type FirebasePersistenceMode = 'local' | 'session';
export const REMEMBER_ME_PREF_KEY = 'blox_auth_remember_me_v1';

export function getRememberMePreference(): boolean {
  try {
    const stored = localStorage.getItem(REMEMBER_ME_PREF_KEY);
    if (stored === 'false' || stored === '0') return false;
    if (stored === 'true' || stored === '1') return true;
  } catch {}
  return true;
}

export function setRememberMePreference(rememberMe: boolean): void {
  try {
    localStorage.setItem(REMEMBER_ME_PREF_KEY, rememberMe ? 'true' : 'false');
  } catch {}
}

// Initialize Firebase App, Auth, and Firestore (must pass firestoreDatabaseId)
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

let currentFirebasePersistenceMode: FirebasePersistenceMode = getRememberMePreference()
  ? 'local'
  : 'session';

export function getFirebasePersistenceMode(): FirebasePersistenceMode {
  return currentFirebasePersistenceMode;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, ms);
    promise
      .then((value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(value);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      });
  });
}

export async function applyFirebaseAuthPersistence(
  rememberMe: boolean
): Promise<FirebasePersistenceMode> {
  const mode: FirebasePersistenceMode = rememberMe ? 'local' : 'session';
  setRememberMePreference(rememberMe);
  currentFirebasePersistenceMode = mode;
  try {
    await withTimeout(
      setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      ),
      800,
      undefined
    );
  } catch {
    // Fallback gracefully in restricted or non-browser environments
  }
  return mode;
}

export async function waitForFirebaseAuthReady(timeoutMs = 600): Promise<User | null> {
  try {
    if (typeof auth.authStateReady === 'function') {
      await withTimeout(auth.authStateReady(), timeoutMs, undefined);
    }
    return auth.currentUser;
  } catch {
    return null;
  }
}

// Align Firebase Auth persistence with saved Remember Me preference on browser boot
if (typeof window !== 'undefined') {
  void setPersistence(
    auth,
    getRememberMePreference() ? browserLocalPersistence : browserSessionPersistence
  ).catch(() => {});
}

// Validate connection to Firestore on boot
async function testConnection() {
  if (typeof window === 'undefined') return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Blueprint-synchronized validation constants (from firebase-blueprint.json)
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 16;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
export const BIO_MAX = 80;
export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
export const ASSET_KEY_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const ASSET_KEY_MAX = 32;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface CloudUserProfile {
  uid: string;
  username: string;
  bio: string;
  role: 'player';
  coins: number;
  gems: number;
  skin: CharacterSkin;
  ownedItems: string[];
  email?: string;
  displayName?: string;
}

export const DEFAULT_OWNED_ITEM_IDS = [
  'rocker_hair',
  'cap',
  'rock_jacket',
  'pizza_tee',
  'squiggly',
  'smile',
  'fuel_jetpack',
  'roblox_classic',
];

export function sanitizeOwnedItems(items?: unknown): string[] {
  const base = new Set<string>(DEFAULT_OWNED_ITEM_IDS);
  if (Array.isArray(items)) {
    for (const raw of items) {
      if (typeof raw === 'string') {
        const key = raw.trim().slice(0, ASSET_KEY_MAX);
        if (key.length >= 1 && ASSET_KEY_PATTERN.test(key)) {
          base.add(key);
        }
      }
      if (base.size >= 50) break;
    }
  }
  return Array.from(base).slice(0, 50);
}

export function sanitizeUsername(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_]/g, '').slice(0, USERNAME_MAX);
  return cleaned;
}

export function isValidUsername(name: string): boolean {
  return (
    name.length >= USERNAME_MIN &&
    name.length <= USERNAME_MAX &&
    USERNAME_PATTERN.test(name)
  );
}

function sanitizeHexColor(val: string | undefined, fallback: string): string {
  if (val && HEX_COLOR_PATTERN.test(val)) return val;
  return fallback;
}

function sanitizeAssetKey(val: string | undefined): string | undefined {
  if (!val) return undefined;
  const trimmed = val.trim().slice(0, ASSET_KEY_MAX);
  if (trimmed.length >= 1 && ASSET_KEY_PATTERN.test(trimmed)) return trimmed;
  return undefined;
}

export function suggestUsernameFromUser(user: User, fallbackName?: string): string {
  const baseFromEmail = user.email ? user.email.split('@')[0] : '';
  const baseFromName = user.displayName || '';
  const candidate =
    sanitizeUsername(fallbackName || '') ||
    sanitizeUsername(baseFromName) ||
    sanitizeUsername(baseFromEmail) ||
    `BloxPlayer_${Math.floor(10 + Math.random() * 89)}`;

  if (candidate.length >= USERNAME_MIN) return candidate;
  return `${candidate}Blox`.slice(0, USERNAME_MAX);
}

export async function signOutAccount(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuthState(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export function parseUserProfileDoc(
  uid: string,
  data: Record<string, unknown>,
  privateInfo?: { email?: string; displayName?: string }
): CloudUserProfile {
  const username = typeof data.username === 'string' ? data.username : 'BloxPlayer';
  const skin: CharacterSkin = {
    name: username,
    skinColor: sanitizeHexColor(typeof data.skinColor === 'string' ? data.skinColor : undefined, '#e5c298'),
    torsoColor: sanitizeHexColor(typeof data.torsoColor === 'string' ? data.torsoColor : undefined, '#141619'),
    legsColor: sanitizeHexColor(typeof data.legsColor === 'string' ? data.legsColor : undefined, '#18181b'),
    headShape: data.headShape === 'blocky' ? 'blocky' : 'round',
    hat: typeof data.hat === 'string' ? data.hat : 'rocker_hair',
    face: typeof data.face === 'string' ? data.face : 'squiggly',
    outfit: typeof data.outfit === 'string' ? data.outfit : 'rock_jacket',
    shirt: typeof data.shirt === 'string' ? data.shirt : undefined,
    pants: typeof data.pants === 'string' ? data.pants : undefined,
    backpack: typeof data.backpack === 'string' ? data.backpack : 'fuel_jetpack',
  };

  return {
    uid,
    username,
    bio: typeof data.bio === 'string' ? data.bio : '',
    role: 'player',
    coins: typeof data.coins === 'number' ? Math.max(0, Math.floor(data.coins)) : 100,
    gems: typeof data.gems === 'number' ? Math.max(0, Math.floor(data.gems)) : 0,
    skin,
    ownedItems: sanitizeOwnedItems(data.ownedItems),
    email: privateInfo?.email,
    displayName: privateInfo?.displayName,
  };
}

export async function fetchUserProfile(uid: string): Promise<CloudUserProfile | null> {
  const userPath = `users/${uid}`;
  let snap;
  try {
    snap = await getDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (!snap.exists()) return null;
  const data = snap.data();

  let email: string | undefined;
  let displayName: string | undefined;
  try {
    const privSnap = await getDoc(doc(db, 'users', uid, 'private', 'info'));
    if (privSnap.exists()) {
      const pData = privSnap.data();
      email = typeof pData.email === 'string' ? pData.email : undefined;
      displayName = typeof pData.displayName === 'string' ? pData.displayName : undefined;
    }
  } catch {
    // Private doc might not exist for legacy/incomplete rows; non-fatal here
  }

  return parseUserProfileDoc(uid, data, { email, displayName });
}

export function subscribeToUserProfile(
  uid: string,
  onProfile: (profile: CloudUserProfile | null) => void,
  cachedPrivateInfo?: { email?: string; displayName?: string }
): () => void {
  const userPath = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snapshot) => {
      if (!snapshot.exists()) {
        onProfile(null);
        return;
      }
      onProfile(parseUserProfileDoc(uid, snapshot.data(), cachedPrivateInfo));
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, userPath);
    }
  );
}

export async function createUserProfile(
  user: User,
  input: {
    username: string;
    bio?: string;
    skin: CharacterSkin;
    coins: number;
    gems: number;
    ownedItems?: string[];
  }
): Promise<CloudUserProfile> {
  const cleanUsername = sanitizeUsername(input.username);
  if (!isValidUsername(cleanUsername)) {
    throw new Error('Никнейм должен содержать от 3 до 16 символов (латиница, цифры или _).');
  }

  const cleanBio = (input.bio || '').trim().slice(0, BIO_MAX);
  const cleanCoins = Math.max(0, Math.min(10000000, Math.floor(input.coins)));
  const cleanGems = Math.max(0, Math.min(1000000, Math.floor(input.gems)));
  const cleanOwnedItems = sanitizeOwnedItems(input.ownedItems);

  const skinColor = sanitizeHexColor(input.skin.skinColor, '#e5c298');
  const torsoColor = sanitizeHexColor(input.skin.torsoColor, '#141619');
  const legsColor = sanitizeHexColor(input.skin.legsColor, '#18181b');
  const headShape = input.skin.headShape === 'blocky' ? 'blocky' : 'round';

  const profilePayload: Record<string, unknown> = {
    uid: user.uid,
    username: cleanUsername,
    bio: cleanBio,
    role: 'player',
    coins: cleanCoins,
    gems: cleanGems,
    skinColor,
    torsoColor,
    legsColor,
    headShape,
    ownedItems: cleanOwnedItems,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const hat = sanitizeAssetKey(input.skin.hat);
  const face = sanitizeAssetKey(input.skin.face);
  const outfit = sanitizeAssetKey(input.skin.outfit);
  const shirt = sanitizeAssetKey(input.skin.shirt);
  const pants = sanitizeAssetKey(input.skin.pants);
  const backpack = sanitizeAssetKey(input.skin.backpack);

  if (hat) profilePayload.hat = hat;
  if (face) profilePayload.face = face;
  if (outfit) profilePayload.outfit = outfit;
  if (shirt) profilePayload.shirt = shirt;
  if (pants) profilePayload.pants = pants;
  if (backpack) profilePayload.backpack = backpack;

  const email = (user.email || 'player@bloxhub.local').slice(0, 160);
  const privatePayload: Record<string, unknown> = {
    uid: user.uid,
    email,
    displayName: (user.displayName || cleanUsername).slice(0, 64),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const userRef = doc(db, 'users', user.uid);
  const privateRef = doc(db, 'users', user.uid, 'private', 'info');

  try {
    const batch = writeBatch(db);
    batch.set(userRef, profilePayload);
    batch.set(privateRef, privatePayload);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }

  return {
    uid: user.uid,
    username: cleanUsername,
    bio: cleanBio,
    role: 'player',
    coins: cleanCoins,
    gems: cleanGems,
    ownedItems: cleanOwnedItems,
    skin: {
      ...input.skin,
      name: cleanUsername,
      skinColor,
      torsoColor,
      legsColor,
      headShape,
    },
    email,
    displayName: user.displayName || cleanUsername,
  };
}

export async function updateUserProfile(
  uid: string,
  patch: {
    username?: string;
    bio?: string;
    skin?: CharacterSkin;
    coins?: number;
    gems?: number;
    ownedItems?: string[];
  }
): Promise<void> {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (typeof patch.username === 'string') {
    const clean = sanitizeUsername(patch.username);
    if (!isValidUsername(clean)) {
      throw new Error('Никнейм должен содержать 3–16 символов (A-Z, 0-9, _).');
    }
    payload.username = clean;
  }

  if (typeof patch.bio === 'string') {
    payload.bio = patch.bio.trim().slice(0, BIO_MAX);
  }

  if (typeof patch.coins === 'number') {
    payload.coins = Math.max(0, Math.min(10000000, Math.floor(patch.coins)));
  }

  if (typeof patch.gems === 'number') {
    payload.gems = Math.max(0, Math.min(1000000, Math.floor(patch.gems)));
  }

  if (Array.isArray(patch.ownedItems)) {
    payload.ownedItems = sanitizeOwnedItems(patch.ownedItems);
  }

  if (patch.skin) {
    payload.skinColor = sanitizeHexColor(patch.skin.skinColor, '#e5c298');
    payload.torsoColor = sanitizeHexColor(patch.skin.torsoColor, '#141619');
    payload.legsColor = sanitizeHexColor(patch.skin.legsColor, '#18181b');
    payload.headShape = patch.skin.headShape === 'blocky' ? 'blocky' : 'round';

    const hat = sanitizeAssetKey(patch.skin.hat);
    const face = sanitizeAssetKey(patch.skin.face);
    const outfit = sanitizeAssetKey(patch.skin.outfit);
    const shirt = sanitizeAssetKey(patch.skin.shirt);
    const pants = sanitizeAssetKey(patch.skin.pants);
    const backpack = sanitizeAssetKey(patch.skin.backpack);

    if (hat) payload.hat = hat;
    if (face) payload.face = face;
    if (outfit) payload.outfit = outfit;
    if (shirt) payload.shirt = shirt;
    if (pants) payload.pants = pants;
    if (backpack) payload.backpack = backpack;
  }

  const userPath = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

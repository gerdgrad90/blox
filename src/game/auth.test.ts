import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NICKNAME_CHANGE_GEM_COST,
  OWNER_2FA_PIN,
  PROTECTED_OWNER_USERNAME,
  fetchCurrentSession,
  getStoredAuthPersistenceMode,
  getStoredAuthToken,
  getStoredRememberMePreference,
  isProtectedOwnerUsername,
  loginAccount,
  logoutAccount,
  registerAccount,
  requiresTwoFactorForUsername,
  resetAccountPassword,
  setStoredAuthToken,
  setStoredRememberMePreference,
  updateAccountProfile,
  validateGuestNickname,
  validateNicknameChangeAffordability,
} from './auth';

test('isProtectedOwnerUsername protects gerdgrad92 regardless of case or whitespace', () => {
  assert.equal(isProtectedOwnerUsername('gerdgrad92'), true);
  assert.equal(isProtectedOwnerUsername('GERDGRAD92'), true);
  assert.equal(isProtectedOwnerUsername('  GerdGrad92  '), true);
  assert.equal(isProtectedOwnerUsername('gerdgrad92!'), true);
  assert.equal(isProtectedOwnerUsername('gerdgrad93'), false);
  assert.equal(isProtectedOwnerUsername('PortalTester'), false);
});

test('validateGuestNickname rejects gerdgrad92 and short names while accepting valid guest names', () => {
  const blocked = validateGuestNickname('gerdgrad92');
  assert.equal(blocked.ok, false);
  assert.match(blocked.error || '', /gerdgrad92/i);

  const blockedUpper = validateGuestNickname(' GERDGRAD92 ');
  assert.equal(blockedUpper.ok, false);

  const tooShort = validateGuestNickname('ab');
  assert.equal(tooShort.ok, false);

  const okGuest = validateGuestNickname('  BloxGuest_77  ');
  assert.equal(okGuest.ok, true);
  assert.equal(okGuest.clean, 'BloxGuest_77');
});

test('requiresTwoFactorForUsername enables 2FA with code 0808 exclusively for gerdgrad92', () => {
  assert.equal(PROTECTED_OWNER_USERNAME, 'gerdgrad92');
  assert.equal(OWNER_2FA_PIN, '0808');
  assert.equal(requiresTwoFactorForUsername('gerdgrad92'), true);
  assert.equal(requiresTwoFactorForUsername('GERDGRAD92'), true);
  assert.equal(requiresTwoFactorForUsername('RandomPlayer'), false);
});

test('loginAccount enforces 2FA (0808) after primary password verification for gerdgrad92', async () => {
  const storage = new Map<string, string>();
  const origLocalStorage = (globalThis as any).localStorage;
  const origFetch = globalThis.fetch;

  (globalThis as any).localStorage = {
    getItem: (k: string) => (storage.has(k) ? storage.get(k)! : null),
    setItem: (k: string, v: string) => storage.set(k, String(v)),
    removeItem: (k: string) => storage.delete(k),
  };
  globalThis.fetch = (async () => {
    throw new TypeError('Failed to fetch');
  }) as any;

  try {
    await registerAccount({
      username: 'gerdgrad92',
      password: 'MySecretPassword',
      skin: {
        skinColor: '#e5c298',
        torsoColor: '#141619',
        legsColor: '#18181b',
        headShape: 'round',
        hat: 'rocker_hair',
        face: 'squiggly',
        outfit: 'rock_jacket',
        backpack: 'fuel_jetpack',
        name: 'gerdgrad92',
      },
      coins: 100,
      gems: 3,
    });

    // 1. Wrong primary password fails without leaking 2FA
    await assert.rejects(
      () => loginAccount('gerdgrad92', 'WrongPass'),
      (err: any) => !err.requires2FA && /Неверный никнейм или пароль/i.test(err.message)
    );

    // 2. Correct primary password without 2FA prompts for 2FA
    await assert.rejects(
      () => loginAccount('gerdgrad92', 'MySecretPassword'),
      (err: any) => err.requires2FA === true && err.twoFactorStep === 'prompt'
    );

    // 3. Wrong 2FA code is rejected
    await assert.rejects(
      () => loginAccount('gerdgrad92', 'MySecretPassword', '1234'),
      (err: any) => err.requires2FA === true && err.twoFactorStep === 'invalid'
    );

    // 4. Correct 2FA code (0808) completes login
    const profile = await loginAccount('gerdgrad92', 'MySecretPassword', '0808');
    assert.equal(profile.username, 'gerdgrad92');
  } finally {
    (globalThis as any).localStorage = origLocalStorage;
    globalThis.fetch = origFetch;
  }
});

test('resetAccountPassword resets gerdgrad92 with 2FA code 0808 and regular accounts with recoveryCode', async () => {
  const storage = new Map<string, string>();
  const origLocalStorage = (globalThis as any).localStorage;
  const origFetch = globalThis.fetch;

  (globalThis as any).localStorage = {
    getItem: (k: string) => (storage.has(k) ? storage.get(k)! : null),
    setItem: (k: string, v: string) => storage.set(k, String(v)),
    removeItem: (k: string) => storage.delete(k),
  };
  globalThis.fetch = (async () => {
    throw new TypeError('Failed to fetch');
  }) as any;

  const baseSkin = {
    skinColor: '#e5c298',
    torsoColor: '#141619',
    legsColor: '#18181b',
    headShape: 'round' as const,
    hat: 'rocker_hair',
    face: 'squiggly',
    outfit: 'rock_jacket',
    backpack: 'fuel_jetpack',
    name: 'gerdgrad92',
  };

  try {
    await registerAccount({
      username: 'gerdgrad92',
      password: 'ForgottenPassword1',
      skin: baseSkin,
      coins: 500,
      gems: 10,
    });

    // Wrong 2FA code rejected
    await assert.rejects(
      () =>
        resetAccountPassword({
          username: 'gerdgrad92',
          verificationCode: '9999',
          newPassword: 'BrandNewPassword',
        }),
      /Неверный код 2FA/i
    );

    // Valid 2FA code (0808) resets password and signs in
    const recoveredOwner = await resetAccountPassword({
      username: 'gerdgrad92',
      verificationCode: '0808',
      newPassword: 'BrandNewPassword',
    });
    assert.equal(recoveredOwner.username, 'gerdgrad92');

    // Old password no longer works, new password + 2FA works
    await assert.rejects(() => loginAccount('gerdgrad92', 'ForgottenPassword1', '0808'));
    const relogged = await loginAccount('gerdgrad92', 'BrandNewPassword', '0808');
    assert.equal(relogged.username, 'gerdgrad92');

    // Regular account with recoveryCode
    await registerAccount({
      username: 'RegularPlayer7',
      password: 'OldPass123',
      recoveryCode: 'mysecretpin',
      skin: { ...baseSkin, name: 'RegularPlayer7' },
      coins: 120,
      gems: 2,
    });

    await assert.rejects(
      () =>
        resetAccountPassword({
          username: 'RegularPlayer7',
          verificationCode: 'wrongpin',
          newPassword: 'NewPass456',
        }),
      /Неверное секретное слово/i
    );

    const recoveredRegular = await resetAccountPassword({
      username: 'RegularPlayer7',
      verificationCode: 'MySecretPin',
      newPassword: 'NewPass456',
    });
    assert.equal(recoveredRegular.username, 'RegularPlayer7');

    const regularRelogin = await loginAccount('RegularPlayer7', 'NewPass456');
    assert.equal(regularRelogin.username, 'RegularPlayer7');
  } finally {
    (globalThis as any).localStorage = origLocalStorage;
    globalThis.fetch = origFetch;
  }
});

test('Remember Me switches between localStorage (survives browser restart) and sessionStorage (clears on restart)', async () => {
  const localMap = new Map<string, string>();
  const sessionMap = new Map<string, string>();
  const origLocalStorage = (globalThis as any).localStorage;
  const origSessionStorage = (globalThis as any).sessionStorage;
  const origFetch = globalThis.fetch;

  (globalThis as any).localStorage = {
    getItem: (k: string) => (localMap.has(k) ? localMap.get(k)! : null),
    setItem: (k: string, v: string) => localMap.set(k, String(v)),
    removeItem: (k: string) => localMap.delete(k),
  };
  (globalThis as any).sessionStorage = {
    getItem: (k: string) => (sessionMap.has(k) ? sessionMap.get(k)! : null),
    setItem: (k: string, v: string) => sessionMap.set(k, String(v)),
    removeItem: (k: string) => sessionMap.delete(k),
  };
  globalThis.fetch = (async () => {
    throw new TypeError('Failed to fetch');
  }) as any;

  const baseSkin = {
    skinColor: '#e5c298',
    torsoColor: '#141619',
    legsColor: '#18181b',
    headShape: 'round' as const,
    hat: 'rocker_hair',
    face: 'squiggly',
    outfit: 'rock_jacket',
    backpack: 'fuel_jetpack',
    name: 'PersistTester',
  };

  try {
    // Default preference is true (keep users logged in across browser restarts)
    assert.equal(getStoredRememberMePreference(), true);

    // 1. Register with rememberMe = true -> stored in localStorage, NOT sessionStorage
    await registerAccount({
      username: 'PersistTester',
      password: 'Password123',
      skin: baseSkin,
      coins: 150,
      gems: 5,
      rememberMe: true,
    });
    assert.equal(getStoredRememberMePreference(), true);
    assert.equal(getStoredAuthPersistenceMode(), 'local');
    assert.equal(localMap.get('blox_auth_session_token_v1'), 'offline:persisttester');
    assert.equal(sessionMap.get('blox_auth_session_token_v1'), undefined);

    // Simulate browser restart (sessionStorage wiped, localStorage retained)
    sessionMap.clear();
    const restoredPersistent = await fetchCurrentSession();
    assert.equal(restoredPersistent?.username, 'PersistTester');

    // 2. Login with rememberMe = false -> stored in sessionStorage, removed from localStorage
    await loginAccount('PersistTester', 'Password123', undefined, false);
    assert.equal(getStoredRememberMePreference(), false);
    assert.equal(getStoredAuthPersistenceMode(), 'session');
    assert.equal(sessionMap.get('blox_auth_session_token_v1'), 'offline:persisttester');
    assert.equal(localMap.get('blox_auth_session_token_v1'), undefined);

    // Active before browser closes
    const activeSession = await fetchCurrentSession();
    assert.equal(activeSession?.username, 'PersistTester');

    // Simulate browser restart (sessionStorage wiped) -> user is logged out
    sessionMap.clear();
    assert.equal(getStoredAuthToken(), null);
    assert.equal(getStoredAuthPersistenceMode(), 'none');
    const afterRestart = await fetchCurrentSession();
    assert.equal(afterRestart, null);

    // 3. Direct preference toggle & token migration + logout clears both storages
    setStoredRememberMePreference(true);
    assert.equal(getStoredRememberMePreference(), true);
    setStoredAuthToken('token_abc', true);
    assert.equal(getStoredAuthPersistenceMode(), 'local');
    setStoredAuthToken('token_abc', false);
    assert.equal(getStoredAuthPersistenceMode(), 'session');
    assert.equal(localMap.get('blox_auth_session_token_v1'), undefined);

    await logoutAccount();
    assert.equal(getStoredAuthToken(), null);
    assert.equal(localMap.get('blox_auth_session_token_v1'), undefined);
    assert.equal(sessionMap.get('blox_auth_session_token_v1'), undefined);
  } finally {
    (globalThis as any).localStorage = origLocalStorage;
    (globalThis as any).sessionStorage = origSessionStorage;
    globalThis.fetch = origFetch;
  }
});

test('Nickname change requires and deducts 10 hyper-rare gems while bio/skin updates stay free', async () => {
  assert.equal(NICKNAME_CHANGE_GEM_COST, 10);

  // Unchanged nickname costs 0 gems
  const unchanged = validateNicknameChangeAffordability('PlayerOne', 'PlayerOne', 0);
  assert.equal(unchanged.ok, true);
  assert.equal(unchanged.changed, false);
  assert.equal(unchanged.cost, 0);

  // Changing nickname with < 10 gems fails
  const tooPoor = validateNicknameChangeAffordability('PlayerOne', 'PlayerTwo', 9);
  assert.equal(tooPoor.ok, false);
  assert.equal(tooPoor.changed, true);
  assert.equal(tooPoor.cost, 10);
  assert.match(tooPoor.error || '', /10 💎/);

  // Changing nickname with >= 10 gems succeeds
  const enough = validateNicknameChangeAffordability('PlayerOne', 'PlayerTwo', 10);
  assert.equal(enough.ok, true);
  assert.equal(enough.changed, true);
  assert.equal(enough.cost, 10);

  // End-to-end offline profile rename deducts exactly 10 gems
  const localMap = new Map<string, string>();
  const origLocalStorage = (globalThis as any).localStorage;
  const origFetch = globalThis.fetch;

  (globalThis as any).localStorage = {
    getItem: (k: string) => (localMap.has(k) ? localMap.get(k)! : null),
    setItem: (k: string, v: string) => localMap.set(k, String(v)),
    removeItem: (k: string) => localMap.delete(k),
  };
  globalThis.fetch = (async () => {
    throw new TypeError('Failed to fetch');
  }) as any;

  try {
    await registerAccount({
      username: 'GemSaver',
      password: 'Password123',
      skin: {
        skinColor: '#e5c298',
        torsoColor: '#141619',
        legsColor: '#18181b',
        headShape: 'round',
        hat: 'rocker_hair',
        face: 'squiggly',
        outfit: 'rock_jacket',
        backpack: 'fuel_jetpack',
        name: 'GemSaver',
      },
      coins: 100,
      gems: 5,
    });

    // Updating bio without changing username succeeds with < 10 gems and does not spend gems
    const bioOnly = await updateAccountProfile({ bio: 'Loving Blox Hub!' });
    assert.equal(bioOnly?.username, 'GemSaver');
    assert.equal(bioOnly?.gems, 5);

    // Renaming with 5 gems fails
    await assert.rejects(
      () => updateAccountProfile({ username: 'GemKing', gems: 5 }),
      /10 💎/
    );

    // Renaming with 14 gems succeeds and leaves 4 gems
    const renamed = await updateAccountProfile({ username: 'GemKing', gems: 14 });
    assert.equal(renamed?.username, 'GemKing');
    assert.equal(renamed?.gems, 4);
  } finally {
    (globalThis as any).localStorage = origLocalStorage;
    globalThis.fetch = origFetch;
  }
});

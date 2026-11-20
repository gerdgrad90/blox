import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  LogIn,
  UserPlus,
  X,
  Dices,
  Check,
  LogOut,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  Loader2,
  AlertCircle,
  Save,
  Lock,
  Settings,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Smartphone,
  Keyboard,
  Shirt,
  ShoppingBag,
  Coins,
  Gem,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Copy,
  Link2,
} from 'lucide-react';
import { CharacterSkin } from '../game/types';
import {
  BIO_MAX,
  CloudUserProfile,
  NICKNAME_CHANGE_GEM_COST,
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  exportAccountSyncCode,
  getStoredAuthToken,
  getStoredRememberMePreference,
  importAccountSyncCode,
  isProtectedOwnerUsername,
  isValidUsername,
  loginAccount,
  logoutAccount,
  registerAccount,
  resetAccountPassword,
  sanitizeUsername,
  setStoredAuthToken,
  setStoredRememberMePreference,
  syncAuthSessionPersistence,
  updateAccountProfile,
  validateGuestNickname,
  validateNicknameChangeAffordability,
} from '../game/auth';
import { AvatarPortraitIcon } from './AvatarPortraitIcon';

interface AuthModalProps {
  cloudProfile: CloudUserProfile | null;
  currentSkin: CharacterSkin;
  ownedItems?: string[];
  coins: number;
  gems: number;
  lastSyncedAt?: number | null;
  isSyncingNow?: boolean;
  onSyncNow?: () => Promise<void> | void;
  locked?: boolean;
  authChecking?: boolean;
  isGuestSession?: boolean;
  onUpdateGuestName?: (name: string) => void;
  onRenameNickname?: (nextName: string) => Promise<{ ok: boolean; error?: string }>;
  isMuted?: boolean;
  onToggleMute?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isTouchMode?: boolean;
  onToggleTouchMode?: () => void;
  vrFeatureEnabled?: boolean;
  onToggleVRFeature?: (next?: boolean) => void;
  onOpenVRModal?: () => void;
  onEnterVRMenu?: () => void;
  onOpenCustomizer?: () => void;
  onOpenControls?: () => void;
  onOpenShop?: () => void;
  onProfileReady: (profile: CloudUserProfile) => void;
  onSignedOut: () => void;
  onContinueAsGuest: (guestName: string) => void;
  onClose: () => void;
}

interface StarterAvatarPreset {
  id: string;
  label: string;
  badge: string;
  skin: Partial<CharacterSkin>;
}

const STARTER_PRESETS: StarterAvatarPreset[] = [
  {
    id: 'current',
    label: 'Текущий скин',
    badge: 'Ваш выбор',
    skin: {},
  },
  {
    id: 'rocker',
    label: 'Рокер Blox',
    badge: 'FUEL Джетпак',
    skin: {
      skinColor: '#e5c298',
      torsoColor: '#141619',
      legsColor: '#18181b',
      headShape: 'round',
      hat: 'rocker_hair',
      face: 'squiggly',
      outfit: 'rock_jacket',
      shirt: 'rock_jacket',
      pants: 'rock_jeans',
      backpack: 'fuel_jetpack',
    },
  },
  {
    id: 'ninja',
    label: 'Тень Ниндзя',
    badge: 'Скрытность',
    skin: {
      skinColor: '#f1c27d',
      torsoColor: '#0f172a',
      legsColor: '#09090b',
      headShape: 'blocky',
      hat: 'top_hat',
      face: 'cool',
      outfit: 'swat_vest',
      shirt: 'swat_vest',
      pants: 'cargo_camo',
      backpack: 'none',
    },
  },
  {
    id: 'golden',
    label: 'Золотой Про',
    badge: 'Чемпион',
    skin: {
      skinColor: '#fed000',
      torsoColor: '#b45309',
      legsColor: '#1e293b',
      headShape: 'round',
      hat: 'crown',
      face: 'happy',
      outfit: 'tuxedo',
      shirt: 'tuxedo',
      pants: 'suit_pants',
      backpack: 'treasure_pack',
    },
  },
];

export const AuthModal: React.FC<AuthModalProps> = ({
  cloudProfile,
  currentSkin,
  ownedItems,
  coins,
  gems,
  lastSyncedAt = null,
  isSyncingNow = false,
  onSyncNow,
  locked = false,
  authChecking = false,
  isGuestSession = false,
  onUpdateGuestName,
  onRenameNickname,
  isMuted = false,
  onToggleMute,
  isFullscreen = false,
  onToggleFullscreen,
  isTouchMode = false,
  onToggleTouchMode,
  vrFeatureEnabled = false,
  onToggleVRFeature,
  onOpenVRModal,
  onEnterVRMenu,
  onOpenCustomizer,
  onOpenControls,
  onOpenShop,
  onProfileReady,
  onSignedOut,
  onContinueAsGuest,
  onClose,
}) => {
  const isUnlockedSession = !locked && Boolean(cloudProfile || isGuestSession);

  const [menuSection, setMenuSection] = useState<'profile' | 'settings' | 'upgrade'>('profile');
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('login');

  const [username, setUsername] = useState<string>(() =>
    cloudProfile?.username ? cloudProfile.username : ''
  );
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [twoFactorRequired, setTwoFactorRequired] = useState<boolean>(false);
  const [twoFactorCode, setTwoFactorCode] = useState<string>('');
  const [recoveryCode, setRecoveryCode] = useState<string>('');
  const [forgotVerificationCode, setForgotVerificationCode] = useState<string>('');
  const [forgotNewPassword, setForgotNewPassword] = useState<string>('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState<string>('');
  const [bio, setBio] = useState<string>(() => cloudProfile?.bio || '');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('current');
  const [guestNickname, setGuestNickname] = useState<string>(() =>
    isGuestSession ? currentSkin.name : ''
  );
  const [exportedSyncCode, setExportedSyncCode] = useState<string | null>(null);
  const [showSyncImport, setShowSyncImport] = useState<boolean>(false);
  const [importCode, setImportCode] = useState<string>('');
  const [importPassword, setImportPassword] = useState<string>('');
  const [importNeedsPassword, setImportNeedsPassword] = useState<boolean>(false);
  const [importTwoFactorCode, setImportTwoFactorCode] = useState<string>('');
  const [importNeeds2FA, setImportNeeds2FA] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => getStoredRememberMePreference());

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleToggleRememberMe = (checked: boolean) => {
    setRememberMe(checked);
    setStoredRememberMePreference(checked);
    const activeToken = getStoredAuthToken();
    if (activeToken) {
      setStoredAuthToken(activeToken, checked);
    }
    void syncAuthSessionPersistence(checked);
  };

  const renderRememberMeCheckbox = (idSuffix: string) => (
    <label
      htmlFor={`auth-remember-me-${idSuffix}`}
      data-testid="auth-remember-me-label"
      className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-colors cursor-pointer select-none ${
        rememberMe
          ? 'bg-emerald-500/10 border-emerald-500/35 hover:border-emerald-400/55'
          : 'bg-slate-950/75 border-slate-800 hover:border-slate-700'
      }`}
    >
      <span className="relative flex items-center justify-center mt-0.5 shrink-0">
        <input
          id={`auth-remember-me-${idSuffix}`}
          type="checkbox"
          data-testid="auth-remember-me-checkbox"
          checked={rememberMe}
          onChange={(e) => handleToggleRememberMe(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-amber-400 ${
            rememberMe
              ? 'bg-emerald-500 border-emerald-400 text-slate-950'
              : 'bg-slate-900 border-slate-600 text-transparent'
          }`}
        >
          <Check size={12} strokeWidth={3} />
        </span>
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-xs font-bold text-slate-100">
          Запомнить меня
        </span>
        <span className="block text-[11px] text-slate-400 mt-0.5">
          {rememberMe
            ? 'Оставаться в системе после перезапуска браузера'
            : 'Только на текущую сессию — выход при закрытии браузера'}
        </span>
      </span>
    </label>
  );

  useEffect(() => {
    if (cloudProfile) {
      setUsername(cloudProfile.username);
      setBio(cloudProfile.bio || '');
      if (menuSection === 'upgrade') setMenuSection('profile');
    } else if (isGuestSession) {
      setGuestNickname(currentSkin.name);
    }
  }, [cloudProfile, isGuestSession, currentSkin.name, menuSection]);

  const handleRandomUsername = () => {
    const prefixes = ['Blox', 'Doors', 'Mega', 'Neon', 'Shadow', 'Lucky', 'Pro', 'Turbo'];
    const suffixes = ['Hero', 'Runner', 'King', 'Ninja', 'Star', 'Gamer', 'Fox', 'Wolf'];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const s = suffixes[Math.floor(Math.random() * suffixes.length)];
    const n = Math.floor(10 + Math.random() * 89);
    const next = sanitizeUsername(`${p}${s}_${n}`);
    setUsername(next);
    setErrorMsg(null);
  };

  const buildChosenSkin = (finalName: string): CharacterSkin => {
    const preset = STARTER_PRESETS.find((p) => p.id === selectedPresetId);
    return {
      ...currentSkin,
      ...(preset ? preset.skin : {}),
      name: finalName,
    };
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    const cleanName = sanitizeUsername(username);
    if (!isValidUsername(cleanName)) {
      setErrorMsg(
        `Никнейм должен быть от ${USERNAME_MIN} до ${USERNAME_MAX} символов (латиница, цифры и _).`
      );
      return;
    }
    if (password.length < PASSWORD_MIN) {
      setErrorMsg(`Введите пароль (минимум ${PASSWORD_MIN} символа).`);
      return;
    }
    if (twoFactorRequired && !twoFactorCode.trim()) {
      setErrorMsg('Введите код двухфакторной аутентификации (2FA).');
      return;
    }

    setIsLoading(true);
    try {
      const profile = await loginAccount(
        cleanName,
        password,
        twoFactorRequired ? twoFactorCode.trim() : undefined,
        rememberMe
      );
      onProfileReady(profile);
      setPassword('');
      setTwoFactorRequired(false);
      setTwoFactorCode('');
      setStatusMsg(`Добро пожаловать обратно, ${profile.username}!`);
      setTimeout(onClose, 350);
    } catch (err: any) {
      if (err?.requires2FA) {
        setTwoFactorRequired(true);
        if (err.twoFactorStep === 'prompt') {
          setStatusMsg(
            err?.message ||
              `Пароль подтверждён! Введите код 2FA для входа в аккаунт ${cleanName}.`
          );
          setErrorMsg(null);
        } else {
          setErrorMsg(err?.message || 'Неверный код 2FA. Попробуйте ещё раз.');
        }
      } else {
        setErrorMsg(err?.message || 'Не удалось войти в аккаунт.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    const cleanName = sanitizeUsername(username);
    if (!isValidUsername(cleanName)) {
      setErrorMsg(
        `Никнейм должен быть от ${USERNAME_MIN} до ${USERNAME_MAX} символов (только латинские буквы, цифры и _).`
      );
      return;
    }
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      setErrorMsg(`Пароль должен содержать от ${PASSWORD_MIN} до ${PASSWORD_MAX} символов.`);
      return;
    }

    setIsLoading(true);
    try {
      const chosenSkin = buildChosenSkin(cleanName);
      const created = await registerAccount({
        username: cleanName,
        password,
        recoveryCode: recoveryCode.trim() || undefined,
        bio: bio.trim().slice(0, BIO_MAX),
        skin: chosenSkin,
        coins,
        gems,
        ownedItems,
        rememberMe,
      });

      onProfileReady(created);
      setPassword('');
      setRecoveryCode('');
      setStatusMsg(`Аккаунт ${created.username} успешно создан!`);
      setTimeout(onClose, 350);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Ошибка создания аккаунта. Попробуйте снова.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    const cleanName = sanitizeUsername(username);
    if (!isValidUsername(cleanName)) {
      setErrorMsg(
        `Введите корректный никнейм (от ${USERNAME_MIN} до ${USERNAME_MAX} символов).`
      );
      return;
    }
    if (!forgotVerificationCode.trim()) {
      setErrorMsg(
        isProtectedOwnerUsername(cleanName)
          ? 'Введите код 2FA владельца для сброса пароля.'
          : 'Введите секретное слово / PIN восстановления или код BLOXSYNC1.'
      );
      return;
    }
    if (forgotNewPassword.length < PASSWORD_MIN || forgotNewPassword.length > PASSWORD_MAX) {
      setErrorMsg(`Новый пароль должен быть от ${PASSWORD_MIN} до ${PASSWORD_MAX} символов.`);
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setErrorMsg('Пароли не совпадают. Проверьте подтверждение нового пароля.');
      return;
    }

    setIsLoading(true);
    try {
      const profile = await resetAccountPassword({
        username: cleanName,
        verificationCode: forgotVerificationCode.trim(),
        newPassword: forgotNewPassword,
        rememberMe,
      });
      onProfileReady(profile);
      setForgotVerificationCode('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');
      setPassword('');
      setStatusMsg(`Пароль для «${profile.username}» обновлён! Вы успешно вошли в аккаунт.`);
      setTimeout(onClose, 450);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Не удалось сбросить пароль.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveExistingProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudProfile) return;
    setErrorMsg(null);
    setStatusMsg(null);

    const cleanName = sanitizeUsername(username);
    if (!isValidUsername(cleanName)) {
      setErrorMsg(
        `Никнейм должен быть от ${USERNAME_MIN} до ${USERNAME_MAX} символов (латиница, цифры, _).`
      );
      return;
    }

    const isRenaming = cleanName !== cloudProfile.username;
    if (isRenaming) {
      const afford = validateNicknameChangeAffordability(cloudProfile.username, cleanName, gems);
      if (!afford.ok) {
        setErrorMsg(afford.error || `Недостаточно кристаллов (нужно ${NICKNAME_CHANGE_GEM_COST} 💎).`);
        return;
      }
    }

    setIsLoading(true);
    try {
      const updatedSkin: CharacterSkin = { ...currentSkin, name: cleanName };
      const updated = await updateAccountProfile({
        ...(isRenaming ? { username: cleanName } : {}),
        bio: bio.trim().slice(0, BIO_MAX),
        skin: updatedSkin,
        coins,
        gems,
        ownedItems,
      });
      if (updated) {
        onProfileReady(updated);
      }
      setStatusMsg(
        isRenaming
          ? `Никнейм изменён на «${cleanName}» (-${NICKNAME_CHANGE_GEM_COST} 💎)! Профиль сохранён.`
          : 'Профиль сохранён!'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Не удалось обновить профиль.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async (allDevices = false) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await logoutAccount(allDevices);
      setPassword('');
      setExportedSyncCode(null);
      onSignedOut();
      setStatusMsg(allDevices ? 'Выход выполнен на всех устройствах.' : 'Вы вышли из аккаунта.');
    } catch {
      setErrorMsg('Ошибка при выходе из аккаунта.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySyncCode = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    setIsLoading(true);
    try {
      const code = await exportAccountSyncCode(cloudProfile);
      setExportedSyncCode(code);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code).catch(() => {});
      }
      setStatusMsg('Код синхронизации аккаунта создан и скопирован! Используйте его на любом устройстве.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Не удалось создать код синхронизации.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportSyncCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importCode.trim()) {
      setErrorMsg('Вставьте код синхронизации аккаунта (BLOXSYNC1...).');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const profile = await importAccountSyncCode(
        importCode.trim(),
        importPassword ? importPassword : undefined,
        importNeeds2FA ? importTwoFactorCode.trim() : undefined,
        rememberMe
      );
      setImportCode('');
      setImportPassword('');
      setImportTwoFactorCode('');
      setImportNeedsPassword(false);
      setImportNeeds2FA(false);
      setShowSyncImport(false);
      onProfileReady(profile);
      setStatusMsg(`Аккаунт ${profile.username} успешно синхронизирован!`);
      setTimeout(onClose, 350);
    } catch (err: any) {
      if (err?.needsPassword) {
        setImportNeedsPassword(true);
      }
      if (err?.requires2FA) {
        setImportNeeds2FA(true);
      }
      setErrorMsg(err?.message || 'Ошибка синхронизации аккаунта по коду.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = () => {
    const check = validateGuestNickname(guestNickname);
    if (!check.ok) {
      setErrorMsg(check.error || 'Некорректный ник гостя.');
      return;
    }
    setErrorMsg(null);
    onContinueAsGuest(check.clean);
  };

  const handleSaveGuestProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    const check = validateGuestNickname(guestNickname);
    if (!check.ok) {
      setErrorMsg(check.error || 'Некорректный никнейм.');
      return;
    }
    if (check.clean === currentSkin.name) {
      setStatusMsg('Никнейм без изменений.');
      return;
    }
    const afford = validateNicknameChangeAffordability(currentSkin.name, check.clean, gems);
    if (!afford.ok) {
      setErrorMsg(afford.error || `Недостаточно кристаллов (нужно ${NICKNAME_CHANGE_GEM_COST} 💎).`);
      return;
    }
    if (onRenameNickname) {
      setIsLoading(true);
      try {
        const res = await onRenameNickname(check.clean);
        if (!res.ok) {
          setErrorMsg(res.error || 'Не удалось сменить никнейм.');
          return;
        }
        setStatusMsg(`Никнейм обновлён на ${check.clean} (-${NICKNAME_CHANGE_GEM_COST} 💎)!`);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    if (onUpdateGuestName) {
      onUpdateGuestName(check.clean);
    } else {
      onContinueAsGuest(check.clean);
    }
    setStatusMsg(`Никнейм обновлён на ${check.clean}!`);
  };

  return (
    <motion.div
      data-testid="auth-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => {
        if (!locked) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/92 backdrop-blur-md pointer-events-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[94dvh] flex flex-col rounded-3xl bg-slate-900 border-2 border-slate-700 shadow-2xl overflow-hidden text-slate-100"
      >
        {/* Top Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-gradient-to-r from-slate-900 via-slate-800/80 to-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 44 44" className="w-9 h-9 shrink-0">
              <g transform="translate(22, 22) rotate(-14)">
                <rect x="-16" y="-16" width="32" height="32" rx="6" fill="#ef4444" stroke="#ffffff" strokeWidth="2.5" />
                <rect x="-6" y="-6" width="12" height="12" rx="2" fill="#0f172a" />
              </g>
            </svg>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide text-white leading-tight">
                {isUnlockedSession
                  ? menuSection === 'settings'
                    ? 'НАСТРОЙКИ ИГРЫ'
                    : 'ПРОФИЛЬ И НАСТРОЙКИ'
                  : 'ВХОД И РЕГИСТРАЦИЯ'}
              </h2>
              <p className="text-xs text-slate-400">
                {cloudProfile
                  ? 'Аккаунт Blox Hub, скин, валюта и настройки'
                  : isUnlockedSession
                  ? 'Гостевой профиль, скин, валюта и настройки игры'
                  : 'Войдите по логину и паролю или создайте аккаунт'}
              </p>
            </div>
          </div>

          {!locked && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть окно входа"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 cursor-pointer transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
          {locked && !authChecking && (
            <div className="mb-4 px-3.5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/35 text-amber-200 text-xs font-bold flex items-center gap-2">
              <Lock size={15} className="text-amber-400 shrink-0" />
              <span>Доступ к игре закрыт — сначала войдите в аккаунт или создайте профиль.</span>
            </div>
          )}

          {authChecking ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-300">
              <Loader2 size={28} className="animate-spin text-red-400" />
              <span className="text-sm font-bold">Проверяем ваш аккаунт...</span>
            </div>
          ) : (
            <>
          {/* Status / Error Banners */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-start gap-2.5">
              <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {statusMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-start gap-2.5">
              <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Top Menu Tabs when Unlocked (Profile vs Settings) */}
          {isUnlockedSession && (
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800 mb-4">
              <button
                type="button"
                data-testid="profile-menu-tab-profile"
                onClick={() => {
                  setMenuSection('profile');
                  setErrorMsg(null);
                  setStatusMsg(null);
                }}
                className={`py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  menuSection === 'profile' || menuSection === 'upgrade'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserIcon size={16} />
                <span>Профиль</span>
              </button>
              <button
                type="button"
                data-testid="profile-menu-tab-settings"
                onClick={() => {
                  setMenuSection('settings');
                  setErrorMsg(null);
                  setStatusMsg(null);
                }}
                className={`py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  menuSection === 'settings'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Settings size={16} />
                <span>Настройки</span>
              </button>
            </div>
          )}

          {/* SETTINGS SECTION (when unlocked and settings tab selected) */}
          {isUnlockedSession && menuSection === 'settings' ? (
            <div className="flex flex-col gap-3" data-testid="profile-settings-panel">
              {/* Sound Toggle */}
              {onToggleMute && (
                <div className="p-3.5 rounded-2xl bg-slate-950/75 border border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${!isMuted ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                      {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white">Звук и шаги</div>
                      <div className="text-xs text-slate-400">Звуковые эффекты игры и шаги по поверхностям</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleMute}
                    className={`px-3.5 py-2 rounded-xl font-black text-xs border cursor-pointer transition-all ${
                      !isMuted
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {isMuted ? 'Выкл' : 'Вкл'}
                  </button>
                </div>
              )}

              {/* Fullscreen Toggle */}
              {onToggleFullscreen && (
                <div className="p-3.5 rounded-2xl bg-slate-950/75 border border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/35 text-sky-400">
                      {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white">Полноэкранный режим</div>
                      <div className="text-xs text-slate-400">Развернуть Blox Hub на весь экран [F]</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleFullscreen}
                    className={`px-3.5 py-2 rounded-xl font-black text-xs border cursor-pointer transition-all ${
                      isFullscreen
                        ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {isFullscreen ? 'Выйти' : 'Включить'}
                  </button>
                </div>
              )}

              {/* Touch Controls Toggle */}
              {onToggleTouchMode && (
                <div className="p-3.5 rounded-2xl bg-slate-950/75 border border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-400">
                      <Smartphone size={18} />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white">Сенсорное управление</div>
                      <div className="text-xs text-slate-400">Экранные джойстики и кнопки действий</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleTouchMode}
                    className={`px-3.5 py-2 rounded-xl font-black text-xs border cursor-pointer transition-all ${
                      isTouchMode
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {isTouchMode ? 'Вкл' : 'Выкл'}
                  </button>
                </div>
              )}

              {/* VR Mode Feature Toggle (PICO 4 / Quest / WebXR) */}
              {onToggleVRFeature && (
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-cyan-500/35 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2.5 rounded-xl border text-base leading-none shrink-0 ${
                        vrFeatureEnabled
                          ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}>
                        🥽
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-white">Режим VR (PICO 4 / WebXR)</div>
                        <div className="text-xs text-slate-400">
                          {vrFeatureEnabled
                            ? 'Включено: в игре доступна кнопка VR [V] и функции шлема (в меню скрыто)'
                            : 'Выключено: кнопка VR скрыта в меню и в игре'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      data-testid="settings-vr-feature-toggle"
                      onClick={() => onToggleVRFeature()}
                      className={`px-3.5 py-2 rounded-xl font-black text-xs border cursor-pointer transition-all shrink-0 ${
                        vrFeatureEnabled
                          ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      {vrFeatureEnabled ? 'Вкл' : 'Выкл'}
                    </button>
                  </div>

                  {vrFeatureEnabled && (onOpenVRModal || onEnterVRMenu) && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                      {onEnterVRMenu && (
                        <button
                          type="button"
                          data-testid="settings-vr-launch-menu-btn"
                          onClick={() => {
                            onClose();
                            onEnterVRMenu();
                          }}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-black text-xs cursor-pointer transition-all"
                        >
                          🥽 Запустить 3D VR Меню
                        </button>
                      )}
                      {onOpenVRModal && (
                        <button
                          type="button"
                          data-testid="settings-open-vr-center-btn"
                          onClick={() => {
                            onClose();
                            onOpenVRModal();
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/45 text-cyan-200 font-bold text-xs cursor-pointer transition-all"
                        >
                          ⚙️ Центр VR и датчики
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Keybinds & Avatar Shortcuts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {onOpenControls && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenControls();
                    }}
                    className="p-3.5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-sky-400/60 text-left flex items-center gap-3 cursor-pointer transition-all"
                  >
                    <Keyboard size={18} className="text-sky-400 shrink-0" />
                    <div>
                      <div className="font-black text-xs text-white">Клавиши и раскладка</div>
                      <div className="text-[11px] text-slate-400">Настроить управление</div>
                    </div>
                  </button>
                )}

                {onOpenCustomizer && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCustomizer();
                    }}
                    className="p-3.5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/60 text-left flex items-center gap-3 cursor-pointer transition-all"
                  >
                    <Shirt size={18} className="text-amber-400 shrink-0" />
                    <div>
                      <div className="font-black text-xs text-white">3D-Скин и Рюкзак</div>
                      <div className="text-[11px] text-slate-400">Изменить облик игрока</div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          ) : cloudProfile ? (
            /* STATE 1: Signed In Account Card / Editor */
            <form onSubmit={handleSaveExistingProfile} className="flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-slate-950/75 border border-emerald-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarPortraitIcon
                    skin={currentSkin}
                    size="lg"
                    className="border-2 border-emerald-400/60"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-base text-white truncate">
                        {cloudProfile.username}
                      </span>
                      <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-300/90 font-semibold truncate mt-0.5">
                      <KeyRound size={12} className="shrink-0" />
                      <span className="truncate">Аккаунт Blox Hub • Скин синхронизирован</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1 text-xs font-black text-amber-400">
                    <Coins size={13} className="fill-amber-400" />
                    <span className="font-mono-numbers">{coins.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-black text-cyan-400">
                    <Gem size={13} className="fill-cyan-400" />
                    <span className="font-mono-numbers">{gems.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {(onOpenCustomizer || onOpenShop) && (
                <div className="grid grid-cols-2 gap-2">
                  {onOpenCustomizer && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCustomizer();
                      }}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Shirt size={14} />
                      <span>Настроить скин</span>
                    </button>
                  )}
                  {onOpenShop && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenShop();
                      }}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <ShoppingBag size={14} />
                      <span>Магазин скинов</span>
                    </button>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Никнейм игрока
                  </label>
                  <span
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${
                      gems >= NICKNAME_CHANGE_GEM_COST
                        ? 'bg-cyan-500/15 border-cyan-400/45 text-cyan-300'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    Смена ника: {NICKNAME_CHANGE_GEM_COST} 💎
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    data-testid="profile-username-input"
                    value={username}
                    onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
                    maxLength={USERNAME_MAX}
                    placeholder="Например: RockBlox_99"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-white font-bold text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleRandomUsername}
                    title="Случайный никнейм"
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 cursor-pointer transition-colors"
                  >
                    <Dices size={18} />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Смена ника стоит {NICKNAME_CHANGE_GEM_COST} 💎 (кристаллы гипер редкие, у вас {gems} 💎). Изменение статуса бесплатно.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Статус / Девиз
                </label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
                  maxLength={BIO_MAX}
                  placeholder="Покоряю 250 дверей отеля DOORS..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-white text-sm outline-none"
                />
              </div>

              {/* Live Account Sync Status & Portable Transfer Code */}
              <div className="p-3.5 rounded-2xl bg-slate-950/75 border border-emerald-500/25 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-black text-emerald-300 truncate">
                        Синхронизация аккаунта активна
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {lastSyncedAt
                          ? `Обновлено в ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                          : 'Вкладки и устройства синхронизируются автоматически'}
                      </div>
                    </div>
                  </div>
                  {onSyncNow && (
                    <button
                      type="button"
                      disabled={isSyncingNow}
                      onClick={() => onSyncNow()}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                    >
                      <RefreshCw size={13} className={isSyncingNow ? 'animate-spin' : ''} />
                      <span>{isSyncingNow ? 'Синхр...' : 'Обновить'}</span>
                    </button>
                  )}
                </div>

                {renderRememberMeCheckbox('signed-in')}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleCopySyncCode}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Copy size={13} />
                    <span>Код синхронизации аккаунта</span>
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleLogout(true)}
                    className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-rose-600/15 border border-slate-700 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Выйти везде
                  </button>
                </div>

                {exportedSyncCode && (
                  <div className="mt-1">
                    <input
                      type="text"
                      readOnly
                      value={exportedSyncCode}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-sky-500/40 text-[11px] font-mono text-sky-200 outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-60 text-white font-black text-sm shadow-[0_4px_0_#065f46] active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>Сохранить профиль</span>
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleLogout(false)}
                  className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-rose-600/20 hover:border-rose-500/50 border border-slate-700 text-rose-300 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut size={16} />
                  <span>Выйти</span>
                </button>
              </div>
            </form>
          ) : isUnlockedSession && isGuestSession && menuSection !== 'upgrade' ? (
            /* STATE 1B: Active Guest Session Profile Card */
            <form onSubmit={handleSaveGuestProfile} className="flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-slate-950/75 border border-amber-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarPortraitIcon
                    skin={currentSkin}
                    size="lg"
                    className="border-2 border-amber-400/60"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-base text-white truncate">
                        {currentSkin.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold text-amber-300 uppercase">
                        Гость
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Прогресс сохраняется локально на этом устройстве
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1 text-xs font-black text-amber-400">
                    <Coins size={13} className="fill-amber-400" />
                    <span className="font-mono-numbers">{coins.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-black text-cyan-400">
                    <Gem size={13} className="fill-cyan-400" />
                    <span className="font-mono-numbers">{gems.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {(onOpenCustomizer || onOpenShop) && (
                <div className="grid grid-cols-2 gap-2">
                  {onOpenCustomizer && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCustomizer();
                      }}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Shirt size={14} />
                      <span>Настроить скин</span>
                    </button>
                  )}
                  {onOpenShop && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenShop();
                      }}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <ShoppingBag size={14} />
                      <span>Магазин скинов</span>
                    </button>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Никнейм гостя
                  </label>
                  <span
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${
                      gems >= NICKNAME_CHANGE_GEM_COST
                        ? 'bg-cyan-500/15 border-cyan-400/45 text-cyan-300'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    Смена ника: {NICKNAME_CHANGE_GEM_COST} 💎
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    data-testid="guest-profile-username-input"
                    value={guestNickname}
                    onChange={(e) => setGuestNickname(e.target.value.slice(0, 16))}
                    maxLength={16}
                    placeholder="Введите ник..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-white font-bold text-sm outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-black text-xs cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    <Save size={14} />
                    <span>{guestNickname.trim() !== currentSkin.name ? `${NICKNAME_CHANGE_GEM_COST} 💎` : 'Сохранить'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Смена ника стоит {NICKNAME_CHANGE_GEM_COST} 💎 (у вас {gems} 💎 — кристаллы гипер редкие).
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-600/15 to-amber-500/10 border border-red-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black text-white">Сохранить прогресс в аккаунте?</div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Создайте аккаунт с паролем, чтобы закрепить скин, монеты и кристаллы.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMenuSection('upgrade');
                    setTab('register');
                    setErrorMsg(null);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs whitespace-nowrap cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                >
                  <UserPlus size={14} />
                  <span>Создать / Войти</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onSignedOut}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-rose-600/20 hover:border-rose-500/50 border border-slate-700 text-rose-300 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut size={14} />
                <span>Выйти на экран входа</span>
              </button>
            </form>
          ) : (
            /* STATE 2: Not Signed In (Username + Password Login/Register/Forgot + Guest) */
            <div>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-slate-950 border border-slate-800 mb-5">
                <button
                  type="button"
                  data-testid="auth-tab-login"
                  onClick={() => {
                    setTab('login');
                    setTwoFactorRequired(false);
                    setTwoFactorCode('');
                    setErrorMsg(null);
                    setStatusMsg(null);
                  }}
                  className={`py-2.5 px-2 rounded-xl font-black text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    tab === 'login'
                      ? 'bg-red-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LogIn size={15} className="shrink-0" />
                  <span>Войти</span>
                </button>
                <button
                  type="button"
                  data-testid="auth-tab-register"
                  onClick={() => {
                    setTab('register');
                    setTwoFactorRequired(false);
                    setTwoFactorCode('');
                    setErrorMsg(null);
                    setStatusMsg(null);
                  }}
                  className={`py-2.5 px-2 rounded-xl font-black text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    tab === 'register'
                      ? 'bg-red-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserPlus size={15} className="shrink-0" />
                  <span>Создать</span>
                </button>
                <button
                  type="button"
                  data-testid="auth-tab-forgot"
                  onClick={() => {
                    setTab('forgot');
                    setTwoFactorRequired(false);
                    setTwoFactorCode('');
                    setErrorMsg(null);
                    setStatusMsg(null);
                  }}
                  className={`py-2.5 px-2 rounded-xl font-black text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    tab === 'forgot'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-amber-300'
                  }`}
                >
                  <KeyRound size={15} className="shrink-0" />
                  <span>Забыл пароль</span>
                </button>
              </div>

              {tab === 'login' ? (
                <div className="flex flex-col gap-4">
                  <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3.5">
                    {twoFactorRequired ? (
                      <div
                        data-testid="auth-2fa-panel"
                        className="p-4 rounded-2xl bg-slate-950/90 border-2 border-amber-400/70 flex flex-col gap-3 shadow-lg"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-300 shrink-0">
                            <ShieldCheck size={20} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-black text-white">
                              2FA подтверждение входа
                            </div>
                            <div className="text-xs text-amber-200/90 truncate">
                              Аккаунт <strong className="text-amber-300">{username}</strong> защищён двухфакторной аутентификацией
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                            Код / Пароль 2FA
                          </label>
                          <input
                            type="password"
                            inputMode="numeric"
                            autoFocus
                            data-testid="login-2fa-input"
                            value={twoFactorCode}
                            onChange={(e) => {
                              setTwoFactorCode(e.target.value.slice(0, 12));
                              if (errorMsg) setErrorMsg(null);
                            }}
                            maxLength={12}
                            placeholder="Введите 4-значный код 2FA..."
                            required
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border-2 border-amber-400/60 focus:border-amber-300 text-white font-mono font-black text-base tracking-[0.25em] text-center outline-none"
                          />
                        </div>

                        {renderRememberMeCheckbox('2fa')}

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            data-testid="login-2fa-back-btn"
                            onClick={() => {
                              setTwoFactorRequired(false);
                              setTwoFactorCode('');
                              setErrorMsg(null);
                              setStatusMsg(null);
                            }}
                            className="px-3.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
                          >
                            ← Назад
                          </button>
                          <button
                            type="submit"
                            data-testid="login-2fa-submit-btn"
                            disabled={isLoading}
                            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-60 text-slate-950 font-black text-sm shadow-[0_4px_0_#92400e] active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {isLoading ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <ShieldCheck size={18} />
                            )}
                            <span>Подтвердить 2FA и войти</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                            Никнейм игрока
                          </label>
                          <input
                            type="text"
                            data-testid="login-username-input"
                            value={username}
                            onChange={(e) => {
                              setUsername(sanitizeUsername(e.target.value));
                              if (errorMsg) setErrorMsg(null);
                            }}
                            maxLength={USERNAME_MAX}
                            placeholder="Введите ваш никнейм..."
                            required
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-white font-bold text-sm outline-none"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                              Пароль
                            </label>
                            <button
                              type="button"
                              data-testid="login-forgot-password-link"
                              onClick={() => {
                                setTab('forgot');
                                setErrorMsg(null);
                                setStatusMsg(null);
                              }}
                              className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer transition-colors"
                            >
                              Забыли пароль?
                            </button>
                          </div>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              data-testid="login-password-input"
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value.slice(0, PASSWORD_MAX));
                                if (errorMsg) setErrorMsg(null);
                              }}
                              maxLength={PASSWORD_MAX}
                              placeholder="Введите пароль..."
                              required
                              className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-white font-bold text-sm outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((prev) => !prev)}
                              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
                            >
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>

                        {renderRememberMeCheckbox('login')}

                        <button
                          type="submit"
                          data-testid="account-login-submit-btn"
                          disabled={isLoading}
                          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-b from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 disabled:opacity-60 text-white font-black text-sm shadow-[0_5px_0_#991b1b] active:translate-y-0.5 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                        >
                          {isLoading ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <LogIn size={18} />
                          )}
                          <span>Войти в аккаунт</span>
                        </button>
                      </>
                    )}
                  </form>

                  <div className="flex items-center gap-3 my-0.5">
                    <div className="h-px bg-slate-800 flex-1" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase">или</span>
                    <div className="h-px bg-slate-800 flex-1" />
                  </div>

                  {/* Quick Guest Entry */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <UserIcon size={14} className="text-amber-400" />
                        Быстрый вход без регистрации
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500">Локально</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={guestNickname}
                        onChange={(e) => {
                          setGuestNickname(e.target.value.slice(0, 16));
                          if (errorMsg) setErrorMsg(null);
                        }}
                        maxLength={16}
                        placeholder="Введите ник гостя (от 3 симв.)..."
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-amber-400 text-white text-xs font-bold outline-none"
                      />
                      <button
                        type="button"
                        data-testid="guest-continue-btn"
                        onClick={handleGuestLogin}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-xs cursor-pointer transition-colors whitespace-nowrap"
                      >
                        Войти как гость
                      </button>
                    </div>
                  </div>

                  {/* Portable Sync Code Import */}
                  <div className="rounded-2xl bg-slate-950/50 border border-slate-800/90 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSyncImport((prev) => !prev);
                        setErrorMsg(null);
                      }}
                      className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-sky-300 hover:bg-slate-900/70 cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Link2 size={14} />
                        Синхронизировать / перенести аккаунт по коду
                      </span>
                      <span className="text-[11px] text-slate-400">{showSyncImport ? 'Скрыть' : 'Открыть'}</span>
                    </button>

                    {showSyncImport && (
                      <form onSubmit={handleImportSyncCode} className="px-3.5 pb-3.5 pt-1 flex flex-col gap-2">
                        <input
                          type="text"
                          value={importCode}
                          onChange={(e) => setImportCode(e.target.value)}
                          placeholder="Вставьте код BLOXSYNC1..."
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-sky-400 text-white text-xs font-mono outline-none"
                        />
                        {importNeedsPassword && (
                          <input
                            type="password"
                            value={importPassword}
                            onChange={(e) => setImportPassword(e.target.value)}
                            placeholder="Пароль существующего аккаунта для слияния..."
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-amber-500/60 text-white text-xs font-bold outline-none"
                          />
                        )}
                        {importNeeds2FA && (
                          <input
                            type="password"
                            inputMode="numeric"
                            value={importTwoFactorCode}
                            onChange={(e) => setImportTwoFactorCode(e.target.value.slice(0, 12))}
                            placeholder="Код 2FA для аккаунта gerdgrad92..."
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-amber-400/70 text-white text-xs font-mono font-bold outline-none"
                          />
                        )}
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-black text-xs cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                        >
                          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                          <span>Импортировать и синхронизировать</span>
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ) : tab === 'forgot' ? (
                /* FORGOT PASSWORD TAB */
                <form
                  onSubmit={handleResetPasswordSubmit}
                  data-testid="auth-forgot-form"
                  className="flex flex-col gap-3.5"
                >
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/35 text-xs text-amber-100 leading-relaxed flex items-start gap-2.5">
                    <KeyRound size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-black text-amber-300 mb-0.5">
                        Восстановление доступа к аккаунту
                      </div>
                      <p className="text-slate-300 text-[11px]">
                        Укажите никнейм аккаунта, введите секретное слово / PIN восстановления или код переноса BLOXSYNC1 и задайте новый пароль.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Никнейм аккаунта
                    </label>
                    <input
                      type="text"
                      data-testid="forgot-username-input"
                      value={username}
                      onChange={(e) => {
                        setUsername(sanitizeUsername(e.target.value));
                        if (errorMsg) setErrorMsg(null);
                      }}
                      maxLength={USERNAME_MAX}
                      placeholder="Введите ваш никнейм..."
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-white font-bold text-sm outline-none"
                    />
                  </div>

                  <AnimatePresence mode="wait" initial={false}>
                    {isProtectedOwnerUsername(username) ? (
                      <motion.div
                        key="forgot-owner-2fa"
                        data-testid="forgot-2fa-animated-panel"
                        initial={{ opacity: 0, y: -12, scale: 0.96, height: 0 }}
                        animate={{ opacity: 1, y: 0, scale: 1, height: 'auto' }}
                        exit={{ opacity: 0, y: -10, scale: 0.96, height: 0 }}
                        transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                        className="overflow-hidden"
                      >
                        <div className="p-3.5 rounded-2xl bg-slate-950/90 border-2 border-amber-400/75 shadow-[0_0_24px_rgba(245,158,11,0.18)] flex flex-col gap-2.5">
                          <div className="flex items-center gap-2.5">
                            <motion.div
                              initial={{ scale: 0.6, rotate: -18 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', stiffness: 420, damping: 20, delay: 0.05 }}
                              className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-300 shrink-0"
                            >
                              <ShieldCheck size={18} />
                            </motion.div>
                            <div className="min-w-0">
                              <div className="text-xs font-black text-amber-300 uppercase tracking-wide">
                                2FA Подтверждение владельца
                              </div>
                              <div className="text-[11px] text-slate-300">
                                Для сброса пароля <strong className="text-white">{username}</strong> введите код 2FA
                              </div>
                            </div>
                          </div>
                          <input
                            type="password"
                            inputMode="numeric"
                            data-testid="forgot-code-input"
                            value={forgotVerificationCode}
                            onChange={(e) => {
                              setForgotVerificationCode(e.target.value);
                              if (errorMsg) setErrorMsg(null);
                            }}
                            placeholder="Введите 4-значный код 2FA..."
                            required
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border-2 border-amber-400/60 focus:border-amber-300 text-white font-mono font-black text-base tracking-[0.25em] text-center outline-none"
                          />
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="forgot-standard-recovery"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                      >
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                          Секретное слово / PIN или BLOXSYNC1
                        </label>
                        <input
                          type="text"
                          data-testid="forgot-code-input"
                          value={forgotVerificationCode}
                          onChange={(e) => {
                            setForgotVerificationCode(e.target.value);
                            if (errorMsg) setErrorMsg(null);
                          }}
                          placeholder="Введите секретное слово / PIN или BLOXSYNC1..."
                          required
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-white font-mono font-bold text-sm outline-none"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Новый пароль
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        data-testid="forgot-new-password-input"
                        value={forgotNewPassword}
                        onChange={(e) => {
                          setForgotNewPassword(e.target.value.slice(0, PASSWORD_MAX));
                          if (errorMsg) setErrorMsg(null);
                        }}
                        maxLength={PASSWORD_MAX}
                        placeholder={`Минимум ${PASSWORD_MIN} символа...`}
                        required
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-white font-bold text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Повторите новый пароль
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      data-testid="forgot-confirm-password-input"
                      value={forgotConfirmPassword}
                      onChange={(e) => {
                        setForgotConfirmPassword(e.target.value.slice(0, PASSWORD_MAX));
                        if (errorMsg) setErrorMsg(null);
                      }}
                      maxLength={PASSWORD_MAX}
                      placeholder="Введите новый пароль ещё раз..."
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-white font-bold text-sm outline-none"
                    />
                  </div>

                  {renderRememberMeCheckbox('forgot')}

                  <button
                    type="submit"
                    data-testid="forgot-submit-btn"
                    disabled={isLoading}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-60 text-slate-950 font-black text-sm shadow-[0_5px_0_#92400e] active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
                  >
                    {isLoading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <KeyRound size={18} />
                    )}
                    <span>Сбросить пароль и войти</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTab('login');
                      setErrorMsg(null);
                      setStatusMsg(null);
                    }}
                    className="w-full py-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer transition-colors"
                  >
                    ← Вернуться ко входу
                  </button>
                </form>
              ) : (
                /* CREATE ACCOUNT TAB */
                <form onSubmit={handleCreateAccount} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Придумайте никнейм
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        data-testid="register-username-input"
                        value={username}
                        onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
                        maxLength={USERNAME_MAX}
                        placeholder="Придумайте новый ник..."
                        required
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-white font-bold text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleRandomUsername}
                        title="Случайный никнейм"
                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 cursor-pointer transition-colors"
                      >
                        <Dices size={18} />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      От {USERNAME_MIN} до {USERNAME_MAX} символов: английские буквы, цифры и _
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Придумайте пароль
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        data-testid="register-password-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value.slice(0, PASSWORD_MAX))}
                        maxLength={PASSWORD_MAX}
                        placeholder={`Минимум ${PASSWORD_MIN} символа...`}
                        required
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-white font-bold text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Секретное слово / PIN восстановления{' '}
                      <span className="text-slate-500 font-normal">(если забудете пароль)</span>
                    </label>
                    <input
                      type="text"
                      data-testid="register-recovery-input"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value.slice(0, 32))}
                      maxLength={32}
                      placeholder="Например: 4-значный PIN или кодовое слово"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-white text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Девиз профиля <span className="text-slate-500 font-normal">(необязательно)</span>
                    </label>
                    <input
                      type="text"
                      value={bio}
                      onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
                      maxLength={BIO_MAX}
                      placeholder="Мастер DOORS и паркура!"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-white text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Стартовый облик персонажа
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {STARTER_PRESETS.map((preset) => {
                        const presetSkin: CharacterSkin = {
                          ...currentSkin,
                          ...preset.skin,
                          name: preset.label,
                        };
                        const active = selectedPresetId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setSelectedPresetId(preset.id)}
                            className={`p-2.5 rounded-2xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                              active
                                ? 'bg-amber-500/15 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                                : 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800'
                            }`}
                          >
                            <AvatarPortraitIcon skin={presetSkin} size="sm" interactive={false} />
                            <div className="min-w-0">
                              <div className="text-xs font-black text-white truncate">{preset.label}</div>
                              <div className="text-[10px] text-slate-400 truncate">{preset.badge}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {renderRememberMeCheckbox('register')}

                  <button
                    type="submit"
                    data-testid="create-account-submit-btn"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 disabled:opacity-60 text-white font-black text-sm shadow-[0_5px_0_#991b1b] active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
                  >
                    {isLoading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Sparkles size={18} />
                    )}
                    <span>Создать аккаунт</span>
                  </button>
                </form>
              )}
            </div>
          )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

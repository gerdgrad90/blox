/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { GameEngine } from './game/engine';
import {
  CharacterSkin,
  EmoteId,
  GameId,
  GameState,
  PlayerStats,
  ToolType,
  Checkpoint,
  MultiplayerSessionConfig,
  RemotePlayerInfo,
  BeeFarmState,
  DoorsGameState,
  Achievement,
  PublicPlayerProfile,
  VoiceChatSnapshot,
  VoiceInputMode,
  VoiceSpatialMode,
} from './game/types';
import { getEmoteById } from './game/emotes';
import type { ActiveEmoteState } from './components/EmoteMenu';
import { MultiplayerClient, normalizeCanonicalRoomId } from './game/network';
import { getEmbeddedInviteConfig } from './game/env';
import { VoiceChatManager } from './game/voice';
import { submitLeaderboardProgress } from './game/leaderboard';
import { filterProfanity } from './game/profanityFilter';
import { sound } from './game/audio';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD } from './components/GameHUD';
import { CustomizerModal } from './components/CustomizerModal';
import { PauseModal } from './components/PauseModal';
import { VictoryModal } from './components/VictoryModal';
import { FeedbackModal } from './components/FeedbackModal';
import { QuestsWidget } from './components/QuestsWidget';
import { ShopModal } from './components/ShopModal';
import { ControlsModal } from './components/ControlsModal';
import { AdminModal } from './components/AdminModal';
import { RoomCodePanel } from './components/RoomCodeModal';
import { AuthModal } from './components/AuthModal';
import { AchievementBanner } from './components/AchievementBanner';
import { PublicProfileCardModal } from './components/PublicProfileCardModal';
import { PublicProfileLookupInput } from './game/publicProfile';
import { createInitialVRState, VRState } from './game/vr';
import { createInitialPortalState, PortalRuntimeState } from './game/portals';
import { hasCompletedVRTutorial, setVRTutorialCompleted } from './game/vrTutorial';
import { VRActiveHUD, VRControlModal } from './components/VRControlModal';
import { VRTutorialModal } from './components/VRTutorialModal';
import { StudioOverlay } from './components/StudioOverlay';
import { STUDIO_MAX_OBJECTS, StudioRuntimeState } from './game/studio';
import { addFriend, getStoredFriends } from './game/friends';
import {
  ACHIEVEMENTS_REGISTRY,
  getStoredLifetimeCounters,
  getStoredUnlockedAchievements,
  mergeUnlockedAchievements,
  saveLifetimeCounters,
  saveUnlockedAchievement,
  StoredLifetimeCounters,
} from './game/achievements';
import {
  getPlayerTitleById,
  getTitleForAchievement,
  sanitizeEquippedTitleId,
} from './game/titles';
import { isUserAdmin, KeybindsConfig, MobileLayoutConfig, getMobileLayout } from './game/controls';
import {
  CloudUserProfile,
  NICKNAME_CHANGE_GEM_COST,
  connectAccountSyncSocket,
  fetchCurrentSession,
  getStoredAuthToken,
  getStoredRememberMePreference,
  isProtectedOwnerUsername,
  isValidUsername,
  sanitizeUsername,
  setStoredAuthToken,
  syncAccountNow,
  updateAccountProfile,
  validateGuestNickname,
  validateNicknameChangeAffordability,
} from './game/auth';
import {
  getStoredOwnedItems,
  mergeWithStarterItems,
  saveStoredOwnedItems,
} from './game/shop';

const SKIN_SYNC_CHANNEL_NAME = 'blox_skin_sync';

function buildSyncSignature(
  skin: CharacterSkin,
  ownedItems: string[],
  coins: number,
  gems: number,
  unlockedAchievements: Record<string, number> = {},
  lifetimeCounters: StoredLifetimeCounters = { totalJumps: 0, totalDeaths: 0 }
): string {
  const sortedItems = [...ownedItems].sort();
  const sortedAchievements = Object.keys(unlockedAchievements).sort();
  return JSON.stringify({
    skin: {
      name: skin.name,
      skinColor: skin.skinColor,
      torsoColor: skin.torsoColor,
      legsColor: skin.legsColor,
      headShape: skin.headShape || 'round',
      hat: skin.hat,
      face: skin.face,
      outfit: skin.outfit,
      shirt: skin.shirt || '',
      pants: skin.pants || '',
      backpack: skin.backpack,
    },
    ownedItems: sortedItems,
    coins,
    gems,
    unlockedAchievements: sortedAchievements,
    totalJumps: lifetimeCounters.totalJumps,
    totalDeaths: lifetimeCounters.totalDeaths,
  });
}

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const networkRef = useRef<MultiplayerClient | null>(null);
  const manualTouchOverride = useRef<boolean>(false);

  // Game state machine
  const [gameState, setGameState] = useState<GameState>('title');
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackVersion, setFeedbackVersion] = useState(0);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isRoomCodeOpen, setIsRoomCodeOpen] = useState(false);
  const [isVRModalOpen, setIsVRModalOpen] = useState(false);
  const [isVRTutorialOpen, setIsVRTutorialOpen] = useState(false);
  const [vrFeatureEnabled, setVrFeatureEnabled] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem('blox_vr_feature_enabled_v1') === 'true';
    } catch {
      return false;
    }
  });
  const hasAutoOpenedVRTutRef = useRef<boolean>(false);
  const prevVrEnabledRef = useRef<boolean>(false);
  const [vrState, setVrState] = useState<VRState>(() => createInitialVRState());
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(true);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isGuestSession, setIsGuestSession] = useState<boolean>(false);
  const [cloudProfile, setCloudProfile] = useState<CloudUserProfile | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isSyncingNow, setIsSyncingNow] = useState<boolean>(false);
  const [ownedItems, setOwnedItems] = useState<string[]>(() => getStoredOwnedItems());
  const [unlockedAchievements, setUnlockedAchievements] = useState<Record<string, number>>(() =>
    getStoredUnlockedAchievements()
  );
  const [activeAchievementBanner, setActiveAchievementBanner] = useState<Achievement | null>(null);
  const [lifetimeCounters, setLifetimeCounters] = useState<StoredLifetimeCounters>(() =>
    getStoredLifetimeCounters()
  );
  const [inspectedProfile, setInspectedProfile] = useState<PublicProfileLookupInput | null>(null);
  const [portalState, setPortalState] = useState<PortalRuntimeState>(() => createInitialPortalState());
  const skinSyncChannelRef = useRef<BroadcastChannel | null>(null);
  const lastSyncedSignatureRef = useRef<string>('');
  const prevRunJumpsRef = useRef<number>(0);
  const prevRunDeathsRef = useRef<number>(0);

  const isAccountLocked = !cloudProfile && !isGuestSession;

  // Admin and cheat states
  const [adminPin, setAdminPin] = useState<string>(() => {
    try {
      return typeof window !== 'undefined' ? sessionStorage.getItem('blox_admin_pin_val') || '' : '';
    } catch {
      return '';
    }
  });
  const isAdminUnlocked = adminPin === '0808';
  const [isGodMode, setIsGodMode] = useState(false);
  const [isFlying, setIsFlying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [jumpMultiplier, setJumpMultiplier] = useState(1);

  const handleUnlockAdmin = useCallback((pin: string) => {
    const clean = pin.trim();
    setAdminPin(clean);
    try {
      sessionStorage.setItem('blox_admin_pin_val', clean);
    } catch {}
  }, []);

  const handleLockAdmin = useCallback(() => {
    setAdminPin('');
    try {
      sessionStorage.removeItem('blox_admin_pin_val');
    } catch {}
  }, []);

  const [isMuted, setIsMuted] = useState(sound.isMuted());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTouchMode, setIsTouchMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.innerWidth < 1024 ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    );
  });

  // Parse URL query parameters (?game=...&room=...) or embedded standalone HTML invite config
  const [sessionConfig, setSessionConfig] = useState<MultiplayerSessionConfig>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const embeddedInvite = getEmbeddedInviteConfig();
      const urlGame = params.get('game') || embeddedInvite?.gameId || null;
      const validGames = ['doors', 'obby', 'lava_survival', 'bee_swarm', 'studio'] as const;
      const gameId =
        urlGame && (validGames as readonly string[]).includes(urlGame)
          ? (urlGame as 'doors' | 'obby' | 'lava_survival' | 'bee_swarm' | 'studio')
          : 'doors';
      const rawRoom = (params.get('room') || embeddedInvite?.roomId || '').trim();
      if (rawRoom && !rawRoom.startsWith('public_') && !rawRoom.endsWith('-main')) {
        const cleanRoom = rawRoom
          .toUpperCase()
          .replace(/[^A-Z0-9_-]/g, '')
          .slice(0, 16);
        if (cleanRoom.length >= 2) {
          return {
            mode: 'lan_room',
            gameId,
            roomId: cleanRoom,
          };
        }
      }
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
        mode: 'online',
        gameId,
        roomId: defaultPublicRoom,
      };
    }
    return {
      mode: 'online',
      gameId: 'doors',
      roomId: 'public_doors',
    };
  });
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayerInfo[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [beeFarmState, setBeeFarmState] = useState<BeeFarmState | undefined>();
  const [doorsState, setDoorsState] = useState<DoorsGameState | undefined>();
  const [studioState, setStudioState] = useState<StudioRuntimeState>({
    mode: 'edit',
    tool: 'place',
    activeKind: 'block',
    activeColor: '#38bdf8',
    activeMaterial: 'plastic',
    activeSize: [2, 2, 2],
    activeRotationY: 0,
    gridSize: 2,
    skyPreset: 'day',
    selectedId: null,
    selectedObject: null,
    objectCount: 0,
    maxObjects: STUDIO_MAX_OBJECTS,
    canUndo: false,
    canRedo: false,
    projectName: 'Мой Первый Паркур',
  });
  const [mobileLayout, setMobileLayout] = useState<MobileLayoutConfig>(() => getMobileLayout());
  const [leaderboardVersion, setLeaderboardVersion] = useState<number>(0);
  const [activeEmote, setActiveEmote] = useState<ActiveEmoteState | null>(null);
  const emoteTimerRef = useRef<number | null>(null);
  const voiceManagerRef = useRef<VoiceChatManager | null>(null);
  const localPosRef = useRef<[number, number, number] | null>(null);
  const remotePositionsRef = useRef<Map<string, [number, number, number]>>(new Map());
  const [voiceState, setVoiceState] = useState<VoiceChatSnapshot>({
    connected: false,
    connecting: false,
    listenOnly: false,
    muted: false,
    deafened: false,
    speaking: false,
    localLevel: 0,
    inputMode: 'open',
    pttActive: false,
    spatialMode: 'room',
    masterVolume: 0.9,
    micPermission: 'prompt',
    statusMessage: null,
    participants: [],
    remoteVoiceCount: 0,
  });

  // Player Skin — Default to the user's custom Roblox skin (Rocker Jacket + Red Visor Hair + FUEL Jetpack + Round Head)
  const [skin, setSkin] = useState<CharacterSkin>(() => {
    const hasAuthToken = Boolean(getStoredAuthToken());
    const num = Math.floor(10 + Math.random() * 89);
    const safeFallbackName = `RockBlox_${num}`;
    try {
      const saved = localStorage.getItem('blox_character_skin');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name) {
          const safeName =
            !hasAuthToken && isProtectedOwnerUsername(parsed.name)
              ? safeFallbackName
              : parsed.name;
          return {
            ...parsed,
            name: safeName,
            headShape: parsed.headShape || 'round',
          };
        }
      }
    } catch {}
    const savedName = typeof window !== 'undefined' ? localStorage.getItem('blox_player_name') : null;
    const resolvedName =
      savedName && (hasAuthToken || !isProtectedOwnerUsername(savedName))
        ? savedName
        : safeFallbackName;
    return {
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
      name: resolvedName,
    };
  });

  // Hotbar & Building
  const [activeTool, setActiveTool] = useState<ToolType>('sword');
  const [selectedColor, setSelectedColor] = useState<string>('#ef4444');

  // Stats with Persistence
  const [stats, setStats] = useState<PlayerStats>(() => {
    let savedCoins = 100; // Starter coins for Roblox Shop
    let savedGems = 0; // Gems are hyper-rare!
    try {
      const sc = localStorage.getItem('blox_player_coins');
      const sg = localStorage.getItem('blox_player_gems');
      if (sc !== null) savedCoins = parseInt(sc, 10) || 0;
      if (sg !== null) savedGems = parseInt(sg, 10) || 0;
    } catch {}
    return {
      hp: 100,
      maxHp: 100,
      coins: savedCoins,
      gems: savedGems,
      currentCheckpoint: 0,
      totalCheckpoints: 6,
      jumps: 0,
      deaths: 0,
      startTime: Date.now(),
      completionTime: 0,
    };
  });

  // Persist coins and gems
  useEffect(() => {
    try {
      localStorage.setItem('blox_player_coins', String(stats.coins));
      localStorage.setItem('blox_player_gems', String(stats.gems));
    } catch {}
  }, [stats.coins, stats.gems]);

  // Chat Feed
  const [chatMessages, setChatMessages] = useState<{ id: string; text: string; author?: string }[]>([
    { id: '1', text: 'Добро пожаловать в Blox World 3D! Выберите игру По сети или По локалке.', author: 'Система' },
  ]);

  // Sync dataset.state with document.body
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  const addChatMessage = useCallback((text: string, author?: string) => {
    const cleanText = filterProfanity(text);
    const cleanAuthor = author ? filterProfanity(author) : undefined;
    setChatMessages((prev) => [
      ...prev.slice(-15),
      { id: String(Date.now() + Math.random()), text: cleanText, author: cleanAuthor },
    ]);
  }, []);

  const latestAchievementsRef = useRef<Record<string, number>>(unlockedAchievements);
  latestAchievementsRef.current = unlockedAchievements;
  const latestLifetimeRef = useRef<StoredLifetimeCounters>(lifetimeCounters);
  latestLifetimeRef.current = lifetimeCounters;
  const latestBioRef = useRef<string>('');
  latestBioRef.current = cloudProfile?.bio || '';

  const latestSyncRef = useRef({
    skin,
    ownedItems,
    coins: stats.coins,
    gems: stats.gems,
  });
  latestSyncRef.current = {
    skin,
    ownedItems,
    coins: stats.coins,
    gems: stats.gems,
  };

  const latestCloudUidRef = useRef<string | null>(null);
  latestCloudUidRef.current = cloudProfile?.uid || null;

  const runIdRef = useRef<string>(`run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const reportedLevelKeysRef = useRef<Set<string>>(new Set());
  const lastDoorsMilestoneRef = useRef<number>(0);

  const resetLeaderboardRunTracking = useCallback(() => {
    runIdRef.current = `run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    reportedLevelKeysRef.current.clear();
    lastDoorsMilestoneRef.current = 0;
  }, []);

  const recordLeaderboardMilestone = useCallback(
    (params: {
      gameId: GameId;
      eventType: 'level_clear' | 'victory';
      levelKey: string;
      elapsedSeconds: number;
      completionTime?: number;
    }) => {
      const dedupKey = `${runIdRef.current}::${params.levelKey}`;
      if (reportedLevelKeysRef.current.has(dedupKey)) return;
      reportedLevelKeysRef.current.add(dedupKey);

      const currentSkin = latestSyncRef.current.skin;
      const username = (currentSkin?.name || 'Player').trim().slice(0, 16) || 'Player';
      const playerKey = latestCloudUidRef.current || `guest:${username.toLowerCase()}`;

      void submitLeaderboardProgress({
        playerKey,
        username,
        gameId: params.gameId,
        runId: runIdRef.current,
        levelKey: params.levelKey,
        eventType: params.eventType,
        elapsedSeconds: Math.max(1, Math.floor(params.elapsedSeconds || 1)),
        completionTime: params.completionTime,
        skin: currentSkin,
        bio: latestBioRef.current,
        coins: latestSyncRef.current.coins,
        gems: latestSyncRef.current.gems,
        totalJumps: latestLifetimeRef.current.totalJumps,
        totalDeaths: latestLifetimeRef.current.totalDeaths,
        unlockedAchievements: latestAchievementsRef.current,
      }).then((res) => {
        if (res) {
          setLeaderboardVersion((v) => v + 1);
        }
      });
    },
    []
  );

  const broadcastSkinSync = useCallback((nextSkin: CharacterSkin, nextOwned: string[]) => {
    try {
      skinSyncChannelRef.current?.postMessage({
        type: 'SKIN_SYNC',
        skin: nextSkin,
        ownedItems: nextOwned,
      });
    } catch {}
  }, []);

  const broadcastAccountEvent = useCallback(
    (event: {
      type: 'ACCOUNT_LOGIN' | 'ACCOUNT_PROFILE' | 'ACCOUNT_LOGOUT';
      token?: string | null;
      rememberMe?: boolean;
      profile?: CloudUserProfile;
    }) => {
      try {
        skinSyncChannelRef.current?.postMessage(event);
      } catch {}
    },
    []
  );

  const applySyncedProfile = useCallback((profile: CloudUserProfile) => {
    const mergedOwned = mergeWithStarterItems(profile.ownedItems);
    const mergedAchievements = mergeUnlockedAchievements(profile.unlockedAchievements);
    const mergedLifetime = saveLifetimeCounters({
      totalJumps: Math.max(
        latestLifetimeRef.current.totalJumps,
        profile.lifetimeStats?.totalJumps || 0
      ),
      totalDeaths: Math.max(
        latestLifetimeRef.current.totalDeaths,
        profile.lifetimeStats?.totalDeaths || 0
      ),
    });

    const sig = buildSyncSignature(
      profile.skin,
      mergedOwned,
      profile.coins,
      profile.gems,
      mergedAchievements,
      mergedLifetime
    );
    lastSyncedSignatureRef.current = sig;
    latestSyncRef.current = {
      skin: profile.skin,
      ownedItems: mergedOwned,
      coins: profile.coins,
      gems: profile.gems,
    };
    latestAchievementsRef.current = mergedAchievements;
    latestLifetimeRef.current = mergedLifetime;

    setCloudProfile((prev) => {
      if (
        prev &&
        prev.uid === profile.uid &&
        prev.username === profile.username &&
        prev.bio === profile.bio &&
        buildSyncSignature(
          prev.skin,
          prev.ownedItems,
          prev.coins,
          prev.gems,
          prev.unlockedAchievements,
          {
            totalJumps: prev.lifetimeStats?.totalJumps || 0,
            totalDeaths: prev.lifetimeStats?.totalDeaths || 0,
          }
        ) === sig
      ) {
        return prev;
      }
      return {
        ...profile,
        ownedItems: mergedOwned,
        unlockedAchievements: mergedAchievements,
        lifetimeStats: {
          ...profile.lifetimeStats,
          totalJumps: mergedLifetime.totalJumps,
          totalDeaths: mergedLifetime.totalDeaths,
          totalCoins: profile.coins,
          totalGems: profile.gems,
        },
      };
    });

    setUnlockedAchievements(mergedAchievements);
    setLifetimeCounters(mergedLifetime);
    setIsGuestSession(false);
    setSkin(profile.skin);
    setOwnedItems(mergedOwned);
    saveStoredOwnedItems(mergedOwned);
    try {
      localStorage.setItem('blox_character_skin', JSON.stringify(profile.skin));
      localStorage.setItem('blox_player_name', profile.username);
    } catch {}
    engineRef.current?.updateSkin(profile.skin);
    networkRef.current?.setPublicProfileMeta({
      playerKey: profile.uid,
      bio: profile.bio || '',
      gems: profile.gems,
      unlockedAchievements: mergedAchievements,
      lifetimeStats: {
        totalCoins: profile.coins,
        totalGems: profile.gems,
        totalJumps: mergedLifetime.totalJumps,
        totalDeaths: mergedLifetime.totalDeaths,
        completedLevels: profile.lifetimeStats?.completedLevels || 0,
        victories: profile.lifetimeStats?.victories || 0,
        bestTimeSeconds: profile.lifetimeStats?.bestTimeSeconds || 0,
        totalTimeSeconds: profile.lifetimeStats?.totalTimeSeconds || 0,
      },
    });
    networkRef.current?.sendSkinUpdate(profile.skin);
    setStats((prev) =>
      prev.coins === profile.coins && prev.gems === profile.gems
        ? prev
        : { ...prev, coins: profile.coins, gems: profile.gems }
    );
    setLastSyncedAt(Date.now());
    setIsAuthOpen(false);
  }, []);

  const clearSessionState = useCallback(
    (msg = 'Вы вышли из аккаунта Blox Hub.') => {
      setCloudProfile(null);
      setIsGuestSession(false);
      setLastSyncedAt(null);
      lastSyncedSignatureRef.current = '';
      setGameState('title');
      setIsCustomizerOpen(false);
      setIsShopOpen(false);
      setIsControlsOpen(false);
      setIsAdminOpen(false);
      setIsFeedbackOpen(false);
      setIsRoomCodeOpen(false);
      setIsAuthOpen(true);
      addChatMessage(msg, 'Система');
    },
    [addChatMessage]
  );

  // Persist owned items locally
  useEffect(() => {
    saveStoredOwnedItems(ownedItems);
  }, [ownedItems]);

  // Cross-tab BroadcastChannel synchronization for full account state, skin & wardrobe
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(SKIN_SYNC_CHANNEL_NAME);
    } catch {
      return;
    }
    skinSyncChannelRef.current = channel;

    channel.onmessage = (event) => {
      const payload = event.data;
      if (!payload || !payload.type) return;

      if (payload.type === 'ACCOUNT_LOGIN' && payload.profile) {
        if (typeof payload.token === 'string' && payload.token) {
          setStoredAuthToken(
            payload.token,
            typeof payload.rememberMe === 'boolean' ? payload.rememberMe : undefined
          );
        }
        applySyncedProfile(payload.profile as CloudUserProfile);
        return;
      }

      if (payload.type === 'ACCOUNT_PROFILE' && payload.profile) {
        applySyncedProfile(payload.profile as CloudUserProfile);
        return;
      }

      if (payload.type === 'ACCOUNT_LOGOUT') {
        setStoredAuthToken(null);
        clearSessionState('Сеанс завершён на другой вкладке.');
        return;
      }

      if (payload.type === 'SKIN_SYNC') {
        if (payload.skin && typeof payload.skin === 'object') {
          const incomingSkin = payload.skin as CharacterSkin;
          setSkin(incomingSkin);
          try {
            localStorage.setItem('blox_character_skin', JSON.stringify(incomingSkin));
            localStorage.setItem('blox_player_name', incomingSkin.name);
          } catch {}
          engineRef.current?.updateSkin(incomingSkin);
          networkRef.current?.sendSkinUpdate(incomingSkin);
        }

        if (Array.isArray(payload.ownedItems)) {
          const merged = mergeWithStarterItems(payload.ownedItems);
          setOwnedItems(merged);
          saveStoredOwnedItems(merged);
        }
      }
    };

    return () => {
      channel.close();
      skinSyncChannelRef.current = null;
    };
  }, [applySyncedProfile, clearSessionState]);

  // Hydrate saved Blox Hub account session on boot (no Google login)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await fetchCurrentSession();
        if (cancelled) return;
        if (profile) {
          applySyncedProfile(profile);
        }
      } catch {
        // Ignore network errors and stay on login modal
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applySyncedProfile]);

  // Real-time cross-device WebSocket sync + focus/visibility & periodic background sync
  const cloudUid = cloudProfile?.uid || null;
  useEffect(() => {
    if (!cloudUid) return;

    const disconnectWs = connectAccountSyncSocket(
      (remoteProfile) => {
        applySyncedProfile(remoteProfile);
        broadcastAccountEvent({ type: 'ACCOUNT_PROFILE', profile: remoteProfile });
      },
      () => {
        clearSessionState('Выполнен выход со всех устройств.');
        broadcastAccountEvent({ type: 'ACCOUNT_LOGOUT' });
      }
    );

    const runQuickSync = async () => {
      const synced = await syncAccountNow({
        ownedItems: latestSyncRef.current.ownedItems,
      });
      if (synced) {
        applySyncedProfile(synced);
      }
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        runQuickSync();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    const intervalId = window.setInterval(runQuickSync, 20000);

    return () => {
      disconnectWs();
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.clearInterval(intervalId);
    };
  }, [cloudUid, applySyncedProfile, clearSessionState, broadcastAccountEvent]);

  // Immediately broadcast updated nickname/skin and re-announce presence when unlocking guest/account modal
  useEffect(() => {
    if (isAccountLocked) return;
    networkRef.current?.sendSkinUpdate(latestSyncRef.current.skin);
    networkRef.current?.announcePresenceNow();
  }, [isAccountLocked]);

  // Keep MultiplayerClient public profile metadata synchronized with local/cloud state
  useEffect(() => {
    const playerKey =
      cloudProfile?.uid || `guest:${(skin.name || 'player').trim().toLowerCase()}`;
    networkRef.current?.setPublicProfileMeta({
      playerKey,
      bio: cloudProfile?.bio || '',
      gems: stats.gems,
      unlockedAchievements,
      lifetimeStats: {
        totalCoins: stats.coins,
        totalGems: stats.gems,
        totalJumps: lifetimeCounters.totalJumps,
        totalDeaths: lifetimeCounters.totalDeaths,
        completedLevels: cloudProfile?.lifetimeStats?.completedLevels || 0,
        victories: cloudProfile?.lifetimeStats?.victories || 0,
        bestTimeSeconds: cloudProfile?.lifetimeStats?.bestTimeSeconds || 0,
        totalTimeSeconds: cloudProfile?.lifetimeStats?.totalTimeSeconds || 0,
      },
    });
  }, [cloudProfile, skin.name, stats.coins, stats.gems, unlockedAchievements, lifetimeCounters]);

  // Debounced server/profile sync of coins, gems, skin, achievements & lifetime stats for signed-in accounts
  useEffect(() => {
    if (!cloudProfile) return;
    const currentSig = buildSyncSignature(
      skin,
      ownedItems,
      stats.coins,
      stats.gems,
      unlockedAchievements,
      lifetimeCounters
    );
    if (currentSig === lastSyncedSignatureRef.current) return;

    const timer = window.setTimeout(() => {
      const mergedOwned = mergeWithStarterItems(ownedItems);
      lastSyncedSignatureRef.current = buildSyncSignature(
        skin,
        mergedOwned,
        stats.coins,
        stats.gems,
        unlockedAchievements,
        lifetimeCounters
      );
      updateAccountProfile({
        skin,
        ownedItems: mergedOwned,
        coins: stats.coins,
        gems: stats.gems,
        unlockedAchievements,
        lifetimeStats: {
          totalCoins: stats.coins,
          totalGems: stats.gems,
          totalJumps: lifetimeCounters.totalJumps,
          totalDeaths: lifetimeCounters.totalDeaths,
        },
      })
        .then((updated) => {
          if (updated) {
            setLastSyncedAt(Date.now());
            broadcastAccountEvent({ type: 'ACCOUNT_PROFILE', profile: updated });
          }
        })
        .catch(() => {});
    }, 900);
    return () => window.clearTimeout(timer);
  }, [
    cloudProfile,
    skin,
    ownedItems,
    stats.coins,
    stats.gems,
    unlockedAchievements,
    lifetimeCounters,
    broadcastAccountEvent,
  ]);

  // Auto-adapt touch mode on mobile viewport resize (unless manually toggled)
  useEffect(() => {
    const handleViewportCheck = () => {
      if (!manualTouchOverride.current) {
        const shouldUseTouch =
          window.innerWidth < 1024 ||
          'ontouchstart' in window ||
          navigator.maxTouchPoints > 0;
        setIsTouchMode(shouldUseTouch);
      }
    };
    window.addEventListener('resize', handleViewportCheck);
    return () => window.removeEventListener('resize', handleViewportCheck);
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      const fsEl =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement;
      setIsFullscreen(Boolean(fsEl));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      const fsEl =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement;

      if (!fsEl) {
        const docEl = document.documentElement as any;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        }
        setIsFullscreen(true);
        addChatMessage('Включен полноэкранный режим 🖥️', 'Система');
      } else {
        const doc = document as any;
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
        setIsFullscreen(false);
        addChatMessage('Выход из полноэкранного режима', 'Система');
      }
    } catch {
      setIsFullscreen((prev) => {
        const next = !prev;
        addChatMessage(
          next ? 'Полноэкранный режим активирован 🖥️' : 'Оконный режим активирован',
          'Система'
        );
        return next;
      });
    }
  }, [addChatMessage]);

  const handleToggleTouchMode = useCallback(() => {
    manualTouchOverride.current = true;
    setIsTouchMode((prev) => {
      const next = !prev;
      if (!next && engineRef.current) {
        engineRef.current.setJoystickInput(0, 0);
      }
      addChatMessage(
        next
          ? 'Сенсорное управление (Телефон) включено 📱'
          : 'Сенсорное управление скрыто ⌨️',
        'Система'
      );
      return next;
    });
  }, [addChatMessage]);

  const resolveRoomChannel = (config: MultiplayerSessionConfig): string => {
    const targetGameId = config.gameId || 'doors';
    return normalizeCanonicalRoomId(config.roomId, config.mode, targetGameId);
  };

  const vrSwitchGameRef = useRef<(gameId: GameId) => void>(() => {});
  const vrReturnToTitleRef = useRef<() => void>(() => {});

  // Initialize Engine & MultiplayerClient once
  useEffect(() => {
    if (!mountRef.current) return;

    const netClient = new MultiplayerClient(skin, {
      onConnectionStatus: (connected) => {
        setIsConnected(connected);
      },
      onInitRoom: (data) => {
        setRemotePlayers(data.players);
        remotePositionsRef.current.clear();
        for (const p of data.players) {
          if (Array.isArray(p.position) && p.position.length === 3) {
            remotePositionsRef.current.set(p.id, p.position);
          }
        }
        voiceManagerRef.current?.syncRoomPeers(
          data.players.map((p) => ({
            id: p.id,
            name: p.skin?.name || 'Игрок',
            voiceEnabled: p.voiceEnabled,
            voiceMuted: p.voiceMuted,
            voiceSpeaking: p.voiceSpeaking,
          }))
        );
        if (engineRef.current) {
          engineRef.current.clearRemotePlayers();
          for (const p of data.players) {
            engineRef.current.upsertRemotePlayer(p);
          }
          for (const b of data.blocks) {
            engineRef.current.applyRemoteBlockPlace(b.key, b.position, b.color);
          }
          if (Array.isArray(data.openedDoors)) {
            for (const doorIdx of data.openedDoors) {
              engineRef.current.applyRemoteDoorOpen(doorIdx);
            }
          }
          if (data.elevatorClosed) {
            engineRef.current.applyRemoteElevatorClose();
          }
        }
      },
      onPlayerJoined: (player) => {
        if (Array.isArray(player.position) && player.position.length === 3) {
          remotePositionsRef.current.set(player.id, player.position);
        }
        voiceManagerRef.current?.upsertPeerMeta({
          id: player.id,
          name: player.skin?.name || 'Игрок',
          voiceEnabled: player.voiceEnabled,
          voiceMuted: player.voiceMuted,
          voiceSpeaking: player.voiceSpeaking,
        });
        setRemotePlayers((prev) => {
          const filtered = prev.filter((p) => p.id !== player.id);
          return [...filtered, player];
        });
        engineRef.current?.upsertRemotePlayer(player);
        addChatMessage(`${player.skin.name} подключился к игре!`, 'Сервер');
      },
      onPlayerUpdated: (update) => {
        if (Array.isArray(update.position) && update.position.length === 3) {
          remotePositionsRef.current.set(update.id, update.position);
        }
        if (update.skin?.name) {
          voiceManagerRef.current?.upsertPeerMeta({
            id: update.id,
            name: update.skin.name,
          });
        }
        engineRef.current?.updateRemotePlayer(update);
        setRemotePlayers((prev) => {
          const exists = prev.some((p) => p.id === update.id);
          if (!exists) {
            const newPeer: RemotePlayerInfo = {
              id: update.id,
              playerKey: update.playerKey,
              bio: update.bio,
              gems: update.gems,
              unlockedAchievements: update.unlockedAchievements,
              lifetimeStats: update.lifetimeStats,
              skin: update.skin || {
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
                name: 'Игрок',
              },
              position: update.position || [0, 1.5, 0],
              rotationY: typeof update.rotationY === 'number' ? update.rotationY : 0,
              isMoving: Boolean(update.isMoving),
              isGrounded: update.isGrounded !== false,
              activeTool: update.activeTool || 'sword',
              checkpoint: typeof update.checkpoint === 'number' ? update.checkpoint : 0,
              coins: typeof update.coins === 'number' ? update.coins : 0,
            };
            return [...prev, newPeer];
          }
          return prev.map((p) =>
            p.id === update.id
              ? {
                  ...p,
                  playerKey: update.playerKey ?? p.playerKey,
                  bio: update.bio ?? p.bio,
                  gems: update.gems ?? p.gems,
                  unlockedAchievements: update.unlockedAchievements ?? p.unlockedAchievements,
                  lifetimeStats: update.lifetimeStats ?? p.lifetimeStats,
                  skin: update.skin ?? p.skin,
                  position: update.position ?? p.position,
                  rotationY: update.rotationY ?? p.rotationY,
                  isMoving: update.isMoving ?? p.isMoving,
                  isGrounded: update.isGrounded ?? p.isGrounded,
                  activeTool: update.activeTool ?? p.activeTool,
                  checkpoint: update.checkpoint ?? p.checkpoint,
                  coins: update.coins ?? p.coins,
                }
              : p
          );
        });
      },
      onPlayerSkinUpdated: (id, newSkin) => {
        engineRef.current?.updateRemotePlayerSkin(id, newSkin);
        voiceManagerRef.current?.upsertPeerMeta({ id, name: newSkin.name });
        setRemotePlayers((prev) =>
          prev.map((p) => (p.id === id ? { ...p, skin: newSkin } : p))
        );
      },
      onPlayerAttacked: (id) => {
        engineRef.current?.triggerRemotePlayerAttack(id);
      },
      onPlayerEmoted: (id, emoteId, durationMs) => {
        engineRef.current?.triggerRemotePlayerEmote(id, emoteId, durationMs);
      },
      onPlayerLeft: (id, name) => {
        remotePositionsRef.current.delete(id);
        voiceManagerRef.current?.handlePeerLeft(id);
        setRemotePlayers((prev) => {
          const leaving = prev.find((p) => p.id === id);
          const displayName = name || leaving?.skin.name;
          if (displayName) {
            addChatMessage(`${displayName} вышел с сервера.`, 'Сервер');
          }
          return prev.filter((p) => p.id !== id);
        });
        engineRef.current?.removeRemotePlayer(id);
      },
      onBlockPlaced: (block) => {
        engineRef.current?.applyRemoteBlockPlace(block.key, block.position, block.color);
      },
      onBlockRemoved: (key) => {
        engineRef.current?.applyRemoteBlockRemove(key);
      },
      onDoorOpened: (doorIndex) => {
        engineRef.current?.applyRemoteDoorOpen(doorIndex);
      },
      onElevatorClosed: () => {
        engineRef.current?.applyRemoteElevatorClose();
      },
      onChatMessage: (msg) => {
        addChatMessage(msg.text, msg.author);
      },
      onLeaderboardUpdated: () => {
        setLeaderboardVersion((v) => v + 1);
      },
      onRoomGameDetected: (detectedGameId) => {
        setSessionConfig((prev) =>
          prev.gameId === detectedGameId ? prev : { ...prev, gameId: detectedGameId }
        );
        if (engineRef.current && engineRef.current.currentGameId !== detectedGameId) {
          engineRef.current.loadGameWorld(detectedGameId);
        }
      },
      onVoiceStateUpdated: (vState) => {
        voiceManagerRef.current?.handleRemoteVoiceState(vState);
        setRemotePlayers((prev) =>
          prev.map((p) =>
            p.id === vState.id
              ? {
                  ...p,
                  voiceEnabled: vState.enabled,
                  voiceMuted: vState.muted,
                  voiceSpeaking: vState.speaking,
                }
              : p
          )
        );
      },
      onVoiceSignal: (signal) => {
        void voiceManagerRef.current?.handleSignal(signal);
      },
    });

    networkRef.current = netClient;

    const voiceManager = new VoiceChatManager(
      {
        getSelfId: () => netClient.getSelfId(),
        sendVoiceState: (state) => netClient.sendVoiceState(state),
        sendVoiceSignal: (to, sig) => netClient.sendVoiceSignal(to, sig),
      },
      skin.name
    );
    voiceManagerRef.current = voiceManager;
    const unsubscribeVoice = voiceManager.subscribe((snap) => {
      setVoiceState(snap);
    });

    const engine = new GameEngine(mountRef.current, skin, {
      onStatsUpdate: (newStats) => {
        setStats(newStats);

        // Safely accumulate jump/death deltas across restarts & game switches
        let jumpDelta = 0;
        if (newStats.jumps > prevRunJumpsRef.current) {
          jumpDelta = newStats.jumps - prevRunJumpsRef.current;
        }
        prevRunJumpsRef.current = newStats.jumps;

        let deathDelta = 0;
        if (newStats.deaths > prevRunDeathsRef.current) {
          deathDelta = newStats.deaths - prevRunDeathsRef.current;
        }
        prevRunDeathsRef.current = newStats.deaths;

        if (jumpDelta > 0 || deathDelta > 0) {
          const nextCounters = saveLifetimeCounters({
            totalJumps: latestLifetimeRef.current.totalJumps + jumpDelta,
            totalDeaths: latestLifetimeRef.current.totalDeaths + deathDelta,
          });
          latestLifetimeRef.current = nextCounters;
          setLifetimeCounters(nextCounters);
        }
      },
      onAchievementUnlocked: (id, meta) => {
        const nextAchievements = saveUnlockedAchievement(id);
        latestAchievementsRef.current = nextAchievements;
        setUnlockedAchievements(nextAchievements);
        setActiveAchievementBanner(ACHIEVEMENTS_REGISTRY[id] || meta);

        // Auto-equip the newly unlocked Player Title if the player doesn't have one equipped yet
        const unlockedTitle = getTitleForAchievement(id);
        if (unlockedTitle && !latestSyncRef.current.skin.playerTitleId) {
          const updatedSkin: CharacterSkin = {
            ...latestSyncRef.current.skin,
            playerTitleId: unlockedTitle.id,
          };
          latestSyncRef.current.skin = updatedSkin;
          setSkin(updatedSkin);
          try {
            localStorage.setItem('blox_character_skin', JSON.stringify(updatedSkin));
          } catch {}
          engineRef.current?.updateSkin(updatedSkin);
          networkRef.current?.sendSkinUpdate(updatedSkin);
          addChatMessage(
            `Разблокирован и надет титул «${unlockedTitle.icon} ${unlockedTitle.label}»!`,
            'Титулы'
          );
        }

        networkRef.current?.sendProfileUpdate({
          unlockedAchievements: nextAchievements,
          lifetimeStats: {
            totalCoins: latestSyncRef.current.coins,
            totalGems: latestSyncRef.current.gems,
            totalJumps: latestLifetimeRef.current.totalJumps,
            totalDeaths: latestLifetimeRef.current.totalDeaths,
          },
        });
      },
      onCheckpointReached: (cp: Checkpoint) => {
        addChatMessage(`Чекпоинт "${cp.name}" активирован!`, 'Чекпоинт');
        if (cp.id >= 1 && engineRef.current) {
          const elapsedSec = Math.max(
            1,
            Math.floor((Date.now() - engineRef.current.stats.startTime) / 1000)
          );
          recordLeaderboardMilestone({
            gameId: engineRef.current.currentGameId,
            eventType: 'level_clear',
            levelKey: `${engineRef.current.currentGameId}_cp_${cp.id}`,
            elapsedSeconds: elapsedSec,
          });
        }
      },
      onChatMessage: (msg: string, author?: string) => {
        addChatMessage(msg, author);
      },
      onVictory: (finalStats: PlayerStats) => {
        setGameState('victory');
        setStats(finalStats);
        if (engineRef.current) {
          const activeGameId = engineRef.current.currentGameId;
          const finishSec = Math.max(1, Math.floor(finalStats.completionTime || 1));
          recordLeaderboardMilestone({
            gameId: activeGameId,
            eventType: 'victory',
            levelKey: `${activeGameId}_victory`,
            elapsedSeconds: finishSec,
            completionTime: finishSec,
          });
        }
      },
      onToolChanged: (tool: ToolType) => {
        setActiveTool(tool);
      },
      onBeeFarmUpdate: (state) => {
        setBeeFarmState(state);
      },
      onDoorsStateUpdate: (state) => {
        setDoorsState(state);
        if (engineRef.current?.currentGameId === 'doors' && state.currentDoorNumber >= 2) {
          const milestoneDoor =
            state.currentDoorNumber < 5
              ? 2
              : Math.floor(state.currentDoorNumber / 5) * 5;
          if (milestoneDoor > lastDoorsMilestoneRef.current) {
            lastDoorsMilestoneRef.current = milestoneDoor;
            const elapsedSec = Math.max(
              1,
              Math.floor((Date.now() - engineRef.current.stats.startTime) / 1000)
            );
            recordLeaderboardMilestone({
              gameId: 'doors',
              eventType: 'level_clear',
              levelKey: `doors_door_${milestoneDoor}`,
              elapsedSeconds: elapsedSec,
            });
          }
        }
      },
      onLocalMove: (state) => {
        localPosRef.current = state.position;
        networkRef.current?.sendMoveUpdate(state);
      },
      onLocalAttack: () => {
        networkRef.current?.sendAttack();
      },
      onVRStateUpdate: (nextVrState) => {
        setVrState(nextVrState);
        const wasEnabled = prevVrEnabledRef.current;
        prevVrEnabledRef.current = nextVrState.enabled;
        if (!wasEnabled && nextVrState.enabled && !hasAutoOpenedVRTutRef.current && !hasCompletedVRTutorial()) {
          hasAutoOpenedVRTutRef.current = true;
          setIsVRModalOpen(false);
          setIsVRTutorialOpen(true);
        }
      },
      onVRGestureEmote: (emoteId, durationMs) => {
        if (emoteTimerRef.current !== null) {
          window.clearTimeout(emoteTimerRef.current);
          emoteTimerRef.current = null;
        }
        setActiveEmote({
          id: emoteId,
          endsAt: Date.now() + durationMs,
          durationMs,
        });
        emoteTimerRef.current = window.setTimeout(() => {
          setActiveEmote(null);
          emoteTimerRef.current = null;
        }, durationMs);
        networkRef.current?.sendEmote(emoteId, durationMs);
      },
      onVRSwitchGame: (targetGameId) => {
        vrSwitchGameRef.current(targetGameId);
      },
      onVRReturnToTitle: () => {
        vrReturnToTitleRef.current();
      },
      onPortalStateUpdate: (nextPortal) => {
        setPortalState(nextPortal);
      },
      onLocalBlockPlace: (key, position, color) => {
        networkRef.current?.sendBlockPlace(key, position, color);
      },
      onLocalBlockRemove: (key) => {
        networkRef.current?.sendBlockRemove(key);
      },
      onLocalDoorOpen: (doorIndex, doorNumber) => {
        networkRef.current?.sendDoorOpen(doorIndex, doorNumber);
      },
      onLocalElevatorClose: () => {
        networkRef.current?.sendElevatorClose();
      },
      onStudioStateChange: (nextStudioState) => {
        setStudioState(nextStudioState);
      },
    });

    engineRef.current = engine;
    engine.setVRFeatureEnabled(vrFeatureEnabled);
    const initialGameId = sessionConfig.gameId || 'doors';
    engine.loadGameWorld(initialGameId);

    // Connect initially using resolved room channel (honors ?game=...&room=... invite links)
    netClient.connectToRoom(
      resolveRoomChannel(sessionConfig),
      sessionConfig.mode,
      skin,
      initialGameId
    );

    // Check ?autostart=1 in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setGameState('playing');
    }

    return () => {
      unsubscribeVoice();
      voiceManager.dispose();
      voiceManagerRef.current = null;
      netClient.dispose();
      networkRef.current = null;
      engine.dispose();
      engineRef.current = null;
    };
  }, []); // Run once

  // Keep voice display name synced with skin name
  useEffect(() => {
    voiceManagerRef.current?.setSelfName(skin.name);
  }, [skin.name]);

  // Update 3D proximity voice attenuation at ~10Hz when proximity mode is active
  useEffect(() => {
    if (!voiceState.connected || voiceState.spatialMode !== 'proximity') return;
    const timer = window.setInterval(() => {
      voiceManagerRef.current?.updateSpatialPositions(
        localPosRef.current,
        remotePositionsRef.current
      );
    }, 100);
    return () => window.clearInterval(timer);
  }, [voiceState.connected, voiceState.spatialMode]);

  // Voice Chat keyboard shortcuts: [T] Push-to-Talk, [M] Quick Mute Toggle
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    };

    const handleVoiceKeyDown = (e: KeyboardEvent) => {
      if (isAccountLocked || gameState !== 'playing') return;
      if (isTypingTarget(e.target)) return;
      if (e.code === 'KeyT' && !e.repeat) {
        voiceManagerRef.current?.setPushToTalkActive(true);
      } else if (e.code === 'KeyM' && !e.repeat && voiceManagerRef.current?.getSnapshot().connected) {
        voiceManagerRef.current.toggleMute();
      }
    };

    const handleVoiceKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyT') {
        voiceManagerRef.current?.setPushToTalkActive(false);
      }
    };

    const handleVoiceBlur = () => {
      voiceManagerRef.current?.setPushToTalkActive(false);
    };

    window.addEventListener('keydown', handleVoiceKeyDown);
    window.addEventListener('keyup', handleVoiceKeyUp);
    window.addEventListener('blur', handleVoiceBlur);
    return () => {
      window.removeEventListener('keydown', handleVoiceKeyDown);
      window.removeEventListener('keyup', handleVoiceKeyUp);
      window.removeEventListener('blur', handleVoiceBlur);
    };
  }, [gameState, isAccountLocked]);

  // Keep networkRef.current heartbeat synchronized on tab wake, window focus, and network transitions
  useEffect(() => {
    const syncNetworkHeartbeat = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      networkRef.current?.syncHeartbeat(true);
    };
    window.addEventListener('focus', syncNetworkHeartbeat);
    window.addEventListener('online', syncNetworkHeartbeat);
    document.addEventListener('visibilitychange', syncNetworkHeartbeat);
    const handleOutboundInvite = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail) {
        networkRef.current?.sendGameInvite(customEv.detail);
      }
    };
    window.addEventListener('blox_game_invite_outbound', handleOutboundInvite);
    return () => {
      window.removeEventListener('focus', syncNetworkHeartbeat);
      window.removeEventListener('online', syncNetworkHeartbeat);
      document.removeEventListener('visibilitychange', syncNetworkHeartbeat);
      window.removeEventListener('blox_game_invite_outbound', handleOutboundInvite);
    };
  }, []);

  // Keyboard shortcut listener for Pause (Escape / P) and Fullscreen (F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAccountLocked) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (gameState === 'playing') {
          setGameState('paused');
        } else if (gameState === 'paused') {
          setGameState('playing');
        }
      } else if (e.code === 'KeyF' && sessionConfig.gameId !== 'doors') {
        e.preventDefault();
        handleToggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, handleToggleFullscreen, sessionConfig.gameId, isAccountLocked]);

  const applyMultiplayerSession = useCallback(
    (config: MultiplayerSessionConfig, forceReloadWorld: boolean = false) => {
      const targetGameId = config.gameId || 'doors';
      const normalizedConfig: MultiplayerSessionConfig = {
        ...config,
        gameId: targetGameId,
      };
      setSessionConfig(normalizedConfig);
      if (!engineRef.current || !networkRef.current) return;

      const gameChanged = engineRef.current.currentGameId !== targetGameId;
      if (gameChanged || forceReloadWorld) {
        engineRef.current.loadGameWorld(targetGameId);
      }

      const activeSkin = latestSyncRef.current.skin || skin;

      if (normalizedConfig.mode === 'local_coop') {
        engineRef.current.clearRemotePlayers();
        setRemotePlayers([]);
        remotePositionsRef.current.clear();
        voiceManagerRef.current?.resetForRoomChange();
        engineRef.current.setLocalCoopMode(true);
      } else {
        engineRef.current.setLocalCoopMode(false);
        const roomChannel = resolveRoomChannel(normalizedConfig);
        const channelChanged = networkRef.current.currentRoomId !== roomChannel;
        if (channelChanged || gameChanged || forceReloadWorld) {
          engineRef.current.clearRemotePlayers();
          setRemotePlayers([]);
          remotePositionsRef.current.clear();
          voiceManagerRef.current?.resetForRoomChange();
          networkRef.current.connectToRoom(
            roomChannel,
            normalizedConfig.mode,
            activeSkin,
            targetGameId
          );
          networkRef.current.syncHeartbeat(true);
        }
      }
    },
    [skin]
  );

  const startGame = useCallback(
    (config: MultiplayerSessionConfig = sessionConfig) => {
      if (isAccountLocked) {
        setIsAuthOpen(true);
        return;
      }
      resetLeaderboardRunTracking();
      applyMultiplayerSession(config, true);
      setGameState('playing');
      if (engineRef.current) {
        engineRef.current.stats.startTime = Date.now();
        engineRef.current.stats.completionTime = 0;
      }
      const gameLabel =
        config.gameId === 'doors'
          ? '🚪 DOORS: Отель Ужасов [Вид от 1-го лица POV]'
          : config.gameId === 'bee_swarm'
          ? '🐝 Bee Farm Simulator 3D'
          : config.gameId === 'lava_survival'
          ? '🌋 Пол — это Лава! Выживание 3D'
          : config.gameId === 'studio'
          ? '🛠️ Blox Студия 3D'
          : '🏃 Паркур: Blox Obby 3D';
      if (config.mode === 'online') {
        addChatMessage(`Вы вошли в игру «${gameLabel}» (Онлайн)!`, 'Сервер');
      } else if (config.mode === 'lan_room') {
        addChatMessage(`Игра «${gameLabel}» — комната [${config.roomId}]! 🏠`, 'Мультиплеер');
      } else {
        addChatMessage(`Игра «${gameLabel}» — 2 Игрока на 1 ПК: Игрок 1 (WASD+Пробел), Игрок 2 (Стрелки+Enter)! 🎮`, 'Локалка');
      }
    },
    [applyMultiplayerSession, sessionConfig, addChatMessage, isAccountLocked, resetLeaderboardRunTracking]
  );

  const handlePause = () => {
    setGameState('paused');
  };

  const handleResume = () => {
    setGameState('playing');
  };

  const handleRestart = () => {
    resetLeaderboardRunTracking();
    if (engineRef.current) {
      engineRef.current.currentCheckpointId = 0;
      engineRef.current.stats.coins = 0;
      engineRef.current.stats.gems = 0;
      engineRef.current.stats.jumps = 0;
      engineRef.current.stats.deaths = 0;
      engineRef.current.stats.startTime = Date.now();
      engineRef.current.stats.completionTime = 0;
      engineRef.current.respawnPlayer(true);
    }
    setGameState('playing');
  };

  const handleReturnToTitle = useCallback(() => {
    setGameState('title');
  }, []);

  vrReturnToTitleRef.current = handleReturnToTitle;
  vrSwitchGameRef.current = (targetGameId: GameId) => {
    const publicRoom =
      targetGameId === 'doors'
        ? 'public_doors'
        : targetGameId === 'lava_survival'
        ? 'public_lava'
        : targetGameId === 'bee_swarm'
        ? 'public_bee'
        : targetGameId === 'studio'
        ? 'public_studio'
        : 'public_obby';
    const nextConfig: MultiplayerSessionConfig = {
      ...sessionConfig,
      gameId: targetGameId,
      roomId: sessionConfig.mode === 'online' ? publicRoom : sessionConfig.roomId,
    };
    resetLeaderboardRunTracking();
    applyMultiplayerSession(nextConfig, true);
    setGameState('playing');
    if (engineRef.current) {
      engineRef.current.stats.startTime = Date.now();
      engineRef.current.stats.completionTime = 0;
    }
  };

  useEffect(() => {
    engineRef.current?.setVRFeatureEnabled(vrFeatureEnabled);
  }, [vrFeatureEnabled]);

  const handleToggleVRFeature = useCallback((force?: boolean) => {
    setVrFeatureEnabled((prev) => {
      const next = typeof force === 'boolean' ? force : !prev;
      try {
        localStorage.setItem('blox_vr_feature_enabled_v1', next ? 'true' : 'false');
      } catch {}
      engineRef.current?.setVRFeatureEnabled(next);
      if (!next) {
        setIsVRModalOpen(false);
        setIsVRTutorialOpen(false);
      }
      return next;
    });
  }, []);

  const handleEnterVRMainMenu = useCallback(() => {
    if (isAccountLocked) {
      setIsAuthOpen(true);
      return;
    }
    // Suppress auto-opening the 2D VR tutorial overlay so the 3D Floating VR Main Menu is immediately visible
    hasAutoOpenedVRTutRef.current = true;
    setIsVRTutorialOpen(false);
    setIsVRModalOpen(false);
    setVrFeatureEnabled(true);
    try {
      localStorage.setItem('blox_vr_feature_enabled_v1', 'true');
    } catch {}
    startGame(sessionConfig);
    if (engineRef.current) {
      engineRef.current.setVRFeatureEnabled(true);
      if (!engineRef.current.vrState.enabled) {
        engineRef.current.toggleVRMode(true);
      }
      engineRef.current.toggleVRMainMenu(true);
      if (engineRef.current.vrState.immersiveSupported && !engineRef.current.vrState.inWebXRSession) {
        void engineRef.current.startWebXRSession();
      }
    }
  }, [isAccountLocked, sessionConfig, startGame]);

  const handleRespawn = () => {
    if (engineRef.current) {
      engineRef.current.respawnPlayer(true);
    }
  };

  const handleSelectTool = (tool: ToolType) => {
    setActiveTool(tool);
    if (engineRef.current) {
      engineRef.current.selectTool(tool);
    }
  };

  const handleSelectColor = (color: string) => {
    setSelectedColor(color);
    if (engineRef.current) {
      engineRef.current.setBlockColor(color);
    }
  };

  const handleTriggerEmote = useCallback(
    (emoteId: EmoteId) => {
      if (emoteTimerRef.current !== null) {
        window.clearTimeout(emoteTimerRef.current);
        emoteTimerRef.current = null;
      }
      const def = getEmoteById(emoteId);
      const result = engineRef.current?.triggerLocalEmote(emoteId);
      const durationMs = result?.durationMs || def.durationMs;
      setActiveEmote({
        id: emoteId,
        endsAt: Date.now() + durationMs,
        durationMs,
      });
      emoteTimerRef.current = window.setTimeout(() => {
        setActiveEmote(null);
        emoteTimerRef.current = null;
      }, durationMs);

      if (sessionConfig.mode !== 'local_coop') {
        networkRef.current?.sendEmote(emoteId, durationMs);
      }
    },
    [sessionConfig.mode]
  );

  const handleCancelEmote = useCallback(() => {
    if (emoteTimerRef.current !== null) {
      window.clearTimeout(emoteTimerRef.current);
      emoteTimerRef.current = null;
    }
    engineRef.current?.cancelLocalEmote();
    setActiveEmote(null);
  }, []);

  const handleSaveSkin = useCallback(
    (newSkin: CharacterSkin) => {
      if (!cloudProfile && isProtectedOwnerUsername(newSkin.name)) {
        addChatMessage('Никнейм «gerdgrad92» защищён и недоступен для гостей.', 'Система');
        return;
      }
      const validatedSkin: CharacterSkin = {
        ...newSkin,
        playerTitleId: sanitizeEquippedTitleId(
          newSkin.playerTitleId,
          latestAchievementsRef.current
        ),
      };
      latestSyncRef.current.skin = validatedSkin;
      const currentOwned = mergeWithStarterItems(latestSyncRef.current.ownedItems);
      setSkin(validatedSkin);
      try {
        localStorage.setItem('blox_character_skin', JSON.stringify(validatedSkin));
        localStorage.setItem('blox_player_name', validatedSkin.name);
      } catch {}
      if (engineRef.current) {
        engineRef.current.updateSkin(validatedSkin);
      }
      networkRef.current?.sendSkinUpdate(validatedSkin);
      broadcastSkinSync(validatedSkin, currentOwned);

      if (cloudProfile) {
        lastSyncedSignatureRef.current = buildSyncSignature(
          validatedSkin,
          currentOwned,
          latestSyncRef.current.coins,
          latestSyncRef.current.gems
        );
        updateAccountProfile({
          skin: validatedSkin,
          ownedItems: currentOwned,
          coins: latestSyncRef.current.coins,
          gems: latestSyncRef.current.gems,
        }).catch(() => {});
      }

      addChatMessage(`Скин обновлен на "${validatedSkin.name}"!`, 'Гардероб');
    },
    [cloudProfile, broadcastSkinSync, addChatMessage]
  );

  const handleSelectPlayerTitle = useCallback(
    (titleId: string | null) => {
      const safeTitleId = sanitizeEquippedTitleId(titleId, latestAchievementsRef.current);
      if (titleId && !safeTitleId) {
        addChatMessage('Сначала откройте соответствующее достижение для этого титула!', 'Титулы');
        return;
      }
      const updatedSkin: CharacterSkin = {
        ...latestSyncRef.current.skin,
        playerTitleId: safeTitleId,
      };
      handleSaveSkin(updatedSkin);
      const chosen = getPlayerTitleById(safeTitleId);
      if (chosen) {
        addChatMessage(`Титул «${chosen.icon} ${chosen.label}» установлен над вашим ником!`, 'Титулы');
      } else {
        addChatMessage('Титул снят.', 'Титулы');
      }
    },
    [handleSaveSkin, addChatMessage]
  );

  const handleOwnedItemsChange = useCallback(
    (updatedOwned: string[]) => {
      const merged = mergeWithStarterItems(updatedOwned);
      latestSyncRef.current.ownedItems = merged;
      const currentSkinVal = latestSyncRef.current.skin;
      setOwnedItems(merged);
      saveStoredOwnedItems(merged);
      broadcastSkinSync(currentSkinVal, merged);

      if (cloudProfile) {
        lastSyncedSignatureRef.current = buildSyncSignature(
          currentSkinVal,
          merged,
          latestSyncRef.current.coins,
          latestSyncRef.current.gems
        );
        updateAccountProfile({
          ownedItems: merged,
          skin: currentSkinVal,
          coins: latestSyncRef.current.coins,
          gems: latestSyncRef.current.gems,
        }).catch(() => {});
      }
    },
    [cloudProfile, broadcastSkinSync]
  );

  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
    addChatMessage(muted ? 'Звук выключен 🔇' : 'Звук включен 🔊');
  };

  const handleRewardClaimed = useCallback((coinsToAdd: number, gemsToAdd: number) => {
    setStats((prev) => ({
      ...prev,
      coins: prev.coins + coinsToAdd,
      gems: prev.gems + gemsToAdd,
    }));
  }, []);

  const handleSpendCurrency = useCallback(
    (coinsToSpend: number, gemsToSpend: number) => {
      const nextCoins = Math.max(0, latestSyncRef.current.coins - coinsToSpend);
      const nextGems = Math.max(0, latestSyncRef.current.gems - gemsToSpend);
      latestSyncRef.current.coins = nextCoins;
      latestSyncRef.current.gems = nextGems;
      setStats((prev) => ({
        ...prev,
        coins: Math.max(0, prev.coins - coinsToSpend),
        gems: Math.max(0, prev.gems - gemsToSpend),
      }));
      if (cloudProfile) {
        lastSyncedSignatureRef.current = buildSyncSignature(
          latestSyncRef.current.skin,
          latestSyncRef.current.ownedItems,
          nextCoins,
          nextGems
        );
        updateAccountProfile({
          coins: nextCoins,
          gems: nextGems,
        }).catch(() => {});
      }
    },
    [cloudProfile]
  );

  const handleSendChatMessage = (msg: string) => {
    const cleanMsg = filterProfanity(msg);
    const cleanAuthor = filterProfanity(skin.name);
    addChatMessage(cleanMsg, cleanAuthor);
    networkRef.current?.sendChatMessage(cleanMsg, cleanAuthor);
  };

  const handleJoystickMove = useCallback((x: number, y: number) => {
    if (engineRef.current) {
      engineRef.current.setJoystickInput(x, y);
    }
  }, []);

  const handleMobileJump = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.triggerJump();
    }
  }, []);

  const handleMobileAction = useCallback((removeBlock: boolean = false) => {
    if (engineRef.current) {
      engineRef.current.triggerAction(removeBlock);
    }
  }, []);

  // Keyboard shortcut [F2] to toggle Admin Panel
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (isAccountLocked) return;
      if (e.key === 'F2') {
        e.preventDefault();
        setIsAdminOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [isAccountLocked]);

  // Controls Keybinds update
  const handleKeybindsChange = useCallback((config: KeybindsConfig) => {
    if (engineRef.current) {
      engineRef.current.setKeybinds(config);
    }
  }, []);

  // Admin Panel Action Handlers (exclusive for gerdgrad92)
  const handleSetGodMode = useCallback((enabled: boolean) => {
    setIsGodMode(enabled);
    engineRef.current?.setGodMode(enabled);
  }, []);

  const handleSetFlyMode = useCallback((enabled: boolean) => {
    setIsFlying(enabled);
    engineRef.current?.setFlyMode(enabled);
  }, []);

  const handleSetSpeedMultiplier = useCallback((val: number) => {
    setSpeedMultiplier(val);
    engineRef.current?.setSpeedMultiplier(val);
  }, []);

  const handleSetJumpMultiplier = useCallback((val: number) => {
    setJumpMultiplier(val);
    engineRef.current?.setJumpMultiplier(val);
  }, []);

  const handleTeleportToCheckpoint = useCallback((id: number) => {
    engineRef.current?.teleportToCheckpoint(id);
  }, []);

  const handleAddCurrency = useCallback((coins: number, gems: number) => {
    setStats((prev) => ({
      ...prev,
      coins: Math.max(0, prev.coins + coins),
      gems: Math.max(0, prev.gems + gems),
    }));
    addChatMessage(`💰 [ADMIN]: Начислено +${coins.toLocaleString()} монет и +${gems.toLocaleString()} гемов!`, 'Админ');
  }, [addChatMessage]);

  const handleBroadcastMessage = useCallback((msg: string) => {
    const cleanMsg = filterProfanity(msg);
    const cleanAuthor = filterProfanity(skin.name);
    addChatMessage(`📢 [СЕРВЕР]: ${cleanMsg}`, `${cleanAuthor} 👑`);
    networkRef.current?.sendChatMessage(`📢 [СЕРВЕР]: ${cleanMsg}`, `${cleanAuthor} 👑`);
  }, [skin.name, addChatMessage]);

  const handleTriggerAdminBlast = useCallback(() => {
    engineRef.current?.triggerAdminBlast();
  }, []);

  const handleEquipAdminCrown = useCallback(() => {
    const updatedSkin: CharacterSkin = {
      ...skin,
      hat: 'crown',
    };
    handleSaveSkin(updatedSkin);
    addChatMessage('👑 Корона Администратора Blox экипирована!', 'Гардероб');
  }, [skin, handleSaveSkin, addChatMessage]);

  const handleHealPlayer = useCallback(() => {
    engineRef.current?.healPlayer();
  }, []);

  const handleUpgradeScooper = useCallback(() => {
    return engineRef.current?.upgradeScooper() ?? false;
  }, []);

  const handleUpgradeBackpack = useCallback(() => {
    return engineRef.current?.upgradeBackpack() ?? false;
  }, []);

  const handleHatchBeeEgg = useCallback(() => {
    return engineRef.current?.hatchBeeEgg() ?? false;
  }, []);

  const handleDoorsInteract = useCallback(() => {
    engineRef.current?.interactInDoors();
  }, []);

  const handleDoorsToggleCrouch = useCallback(() => {
    engineRef.current?.toggleDoorsCrouch();
  }, []);

  const handleDoorsToggleFlashlight = useCallback(() => {
    engineRef.current?.toggleDoorsFlashlight();
  }, []);

  const handleDoorsTeleport100 = useCallback(() => {
    engineRef.current?.teleportToDoor100();
  }, []);

  const handleDoorsTriggerRush = useCallback(() => {
    engineRef.current?.triggerDoorsRushEvent();
  }, []);

  const handleChangeSkinName = useCallback((name: string) => {
    handleSaveSkin({ ...skin, name });
  }, [skin, handleSaveSkin]);

  const handleRenameNickname = useCallback(
    async (rawNextName: string): Promise<{ ok: boolean; error?: string }> => {
      const currentName = cloudProfile?.username || latestSyncRef.current.skin.name || '';
      const trimmed = rawNextName.trim().slice(0, 16);

      if (cloudProfile) {
        const clean = sanitizeUsername(trimmed);
        if (!isValidUsername(clean)) {
          return {
            ok: false,
            error: 'Никнейм должен быть от 3 до 16 символов (латиница, цифры и _).',
          };
        }
        const afford = validateNicknameChangeAffordability(
          currentName,
          clean,
          latestSyncRef.current.gems
        );
        if (!afford.changed) {
          return { ok: true };
        }
        if (!afford.ok) {
          return { ok: false, error: afford.error };
        }
        try {
          const updated = await updateAccountProfile({
            username: clean,
            skin: { ...latestSyncRef.current.skin, name: clean },
            coins: latestSyncRef.current.coins,
            gems: latestSyncRef.current.gems,
            ownedItems: latestSyncRef.current.ownedItems,
          });
          if (updated) {
            applySyncedProfile(updated);
            broadcastAccountEvent({ type: 'ACCOUNT_PROFILE', profile: updated });
            addChatMessage(
              `💎 Никнейм изменён на «${updated.username}» (-${NICKNAME_CHANGE_GEM_COST} 💎)!`,
              'Профиль'
            );
            return { ok: true };
          }
          return { ok: false, error: 'Не удалось обновить никнейм.' };
        } catch (err: any) {
          return { ok: false, error: err?.message || 'Не удалось сменить никнейм.' };
        }
      }

      const guestCheck = validateGuestNickname(trimmed);
      if (!guestCheck.ok) {
        return { ok: false, error: guestCheck.error || 'Некорректный никнейм.' };
      }
      const afford = validateNicknameChangeAffordability(
        currentName,
        guestCheck.clean,
        latestSyncRef.current.gems
      );
      if (!afford.changed) {
        return { ok: true };
      }
      if (!afford.ok) {
        return { ok: false, error: afford.error };
      }
      handleSpendCurrency(0, NICKNAME_CHANGE_GEM_COST);
      handleSaveSkin({ ...latestSyncRef.current.skin, name: guestCheck.clean });
      addChatMessage(
        `💎 Никнейм изменён на «${guestCheck.clean}» (-${NICKNAME_CHANGE_GEM_COST} 💎)!`,
        'Профиль'
      );
      return { ok: true };
    },
    [cloudProfile, applySyncedProfile, broadcastAccountEvent, addChatMessage, handleSpendCurrency, handleSaveSkin]
  );

  const handleAuthProfileReady = useCallback(
    (profile: CloudUserProfile) => {
      applySyncedProfile(profile);
      broadcastAccountEvent({
        type: 'ACCOUNT_LOGIN',
        token: getStoredAuthToken(),
        rememberMe: getStoredRememberMePreference(),
        profile,
      });
      addChatMessage(`Аккаунт ${profile.username} синхронизирован!`, 'Система');
    },
    [applySyncedProfile, broadcastAccountEvent, addChatMessage]
  );

  const handleManualSyncAccount = useCallback(async () => {
    if (!cloudProfile || isSyncingNow) return;
    setIsSyncingNow(true);
    try {
      const synced = await syncAccountNow({
        bio: cloudProfile.bio,
        skin: latestSyncRef.current.skin,
        ownedItems: latestSyncRef.current.ownedItems,
        coins: latestSyncRef.current.coins,
        gems: latestSyncRef.current.gems,
        unlockedAchievements: latestAchievementsRef.current,
        lifetimeStats: {
          totalCoins: latestSyncRef.current.coins,
          totalGems: latestSyncRef.current.gems,
          totalJumps: latestLifetimeRef.current.totalJumps,
          totalDeaths: latestLifetimeRef.current.totalDeaths,
        },
        clientUpdatedAt: Date.now(),
      });
      if (synced) {
        applySyncedProfile(synced);
        broadcastAccountEvent({ type: 'ACCOUNT_PROFILE', profile: synced });
      }
    } finally {
      setIsSyncingNow(false);
    }
  }, [cloudProfile, isSyncingNow, applySyncedProfile, broadcastAccountEvent]);

  const handleOpenSelfProfileCard = useCallback(() => {
    const username = cloudProfile?.username || skin.name || 'Player';
    const playerKey = cloudProfile?.uid || `guest:${username.toLowerCase()}`;
    const localFallback: PublicPlayerProfile = {
      playerKey,
      username,
      bio: cloudProfile?.bio || '',
      accountType: cloudProfile ? 'cloud' : 'guest',
      isOnline: true,
      currentGameId: sessionConfig.gameId,
      roomCheckpoint: stats.currentCheckpoint,
      skin,
      stats: {
        totalCoins: stats.coins,
        totalGems: stats.gems,
        completedLevels: cloudProfile?.lifetimeStats?.completedLevels || 0,
        victories: cloudProfile?.lifetimeStats?.victories || 0,
        bestTimeSeconds: cloudProfile?.lifetimeStats?.bestTimeSeconds || 0,
        totalTimeSeconds: cloudProfile?.lifetimeStats?.totalTimeSeconds || 0,
        totalJumps: lifetimeCounters.totalJumps,
        totalDeaths: lifetimeCounters.totalDeaths,
      },
      unlockedAchievements,
      leaderboardRank: null,
      updatedAt: Date.now(),
    };
    setInspectedProfile({
      playerKey,
      username,
      localFallback,
    });
  }, [cloudProfile, skin, sessionConfig.gameId, stats, lifetimeCounters, unlockedAchievements]);

  const handleAuthSignedOut = useCallback(() => {
    broadcastAccountEvent({ type: 'ACCOUNT_LOGOUT' });
    clearSessionState('Вы вышли из аккаунта Blox Hub.');
  }, [broadcastAccountEvent, clearSessionState]);

  const handleContinueAsGuest = useCallback((guestName: string) => {
    const check = validateGuestNickname(guestName);
    if (!check.ok) {
      addChatMessage(check.error || 'Некорректный ник гостя.', 'Система');
      return;
    }
    const clean = check.clean;
    const updated = { ...skin, name: clean };
    setSkin(updated);
    try {
      localStorage.setItem('blox_character_skin', JSON.stringify(updated));
      localStorage.setItem('blox_player_name', updated.name);
    } catch {}
    engineRef.current?.updateSkin(updated);
    networkRef.current?.sendSkinUpdate(updated);
    setIsGuestSession(true);
    setIsAuthOpen(false);
    addChatMessage(`Вы вошли как гость (${clean}).`, 'Система');
  }, [skin, addChatMessage]);

  const handleCloseAuth = useCallback(() => {
    if (isAccountLocked) return;
    setIsAuthOpen(false);
  }, [isAccountLocked]);

  const onlineCount = 1 + remotePlayers.length + (sessionConfig.mode === 'local_coop' ? 1 : 0);

  return (
    <main
      data-fullscreen={isFullscreen ? 'true' : 'false'}
      data-touch={isTouchMode ? 'true' : 'false'}
      data-multiplayer={sessionConfig.mode}
      className="relative w-full h-full overflow-hidden bg-slate-950 select-none touch-none"
    >
      {/* 3D WebGL Canvas isolated mount container */}
      <div
        ref={mountRef}
        data-testid="three-canvas-container"
        className={`absolute inset-0 w-full h-full z-0 ${
          isAccountLocked ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'
        }`}
      />

      {/* Screen Views based on Game State (locked & non-interactive until signed in) */}
      <div
        aria-hidden={isAccountLocked}
        className={
          isAccountLocked
            ? 'pointer-events-none select-none opacity-25 blur-sm transition-all duration-200'
            : 'contents'
        }
      >
        {gameState === 'title' && (
          <TitleScreen
            onStartGame={startGame}
            onOpenCustomizer={() => setIsCustomizerOpen(true)}
            skin={skin}
            onChangeSkin={handleSaveSkin}
            onRenameNickname={handleRenameNickname}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            sessionConfig={sessionConfig}
            onChangeSessionConfig={applyMultiplayerSession}
            onlineCount={onlineCount}
            isConnected={isConnected}
            onOpenFeedback={() => setIsFeedbackOpen(true)}
            onOpenShop={() => setIsShopOpen(true)}
            onOpenControls={() => setIsControlsOpen(true)}
            onOpenAdmin={() => setIsAdminOpen(true)}
            isAdminUnlocked={isAdminUnlocked}
            onOpenRoomCode={() => setIsRoomCodeOpen(true)}
            onOpenAuth={() => setIsAuthOpen(true)}
            cloudProfile={cloudProfile}
            isGuestSession={isGuestSession}
            coins={stats.coins}
            gems={stats.gems}
            isModalOpen={isAccountLocked || isAuthOpen || isCustomizerOpen || isShopOpen || isControlsOpen || isAdminOpen || isFeedbackOpen || isRoomCodeOpen || Boolean(inspectedProfile)}
            remotePlayers={remotePlayers}
            viewerPlayerKey={cloudProfile?.uid || `guest:${(skin.name || 'player').toLowerCase()}`}
            leaderboardVersion={leaderboardVersion}
            feedbackVersion={feedbackVersion}
            onInspectPlayer={setInspectedProfile}
            onInspectSelfProfile={handleOpenSelfProfileCard}
          />
        )}
      </div>

      {!isAccountLocked &&
        (gameState === 'playing' || gameState === 'paused') &&
        !(sessionConfig.gameId === 'studio' && studioState.mode === 'edit') && (
        <GameHUD
          stats={stats}
          activeTool={activeTool}
          onSelectTool={handleSelectTool}
          onRespawn={handleRespawn}
          onPause={handlePause}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          chatMessages={chatMessages}
          onSendChatMessage={handleSendChatMessage}
          selectedColor={selectedColor}
          onSelectColor={handleSelectColor}
          skin={skin}
          onOpenCustomizer={() => setIsCustomizerOpen(true)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          isTouchMode={isTouchMode}
          onToggleTouchMode={handleToggleTouchMode}
          onJoystickMove={handleJoystickMove}
          onJump={handleMobileJump}
          onAction={handleMobileAction}
          sessionConfig={sessionConfig}
          remotePlayers={remotePlayers}
          isConnected={isConnected}
          onOpenFeedback={() => setIsFeedbackOpen(true)}
          onOpenShop={() => setIsShopOpen(true)}
          onOpenControls={() => setIsControlsOpen(true)}
          onOpenAdmin={() => setIsAdminOpen(true)}
          isAdminUnlocked={isAdminUnlocked}
          beeFarmState={beeFarmState}
          onUpgradeScooper={handleUpgradeScooper}
          onUpgradeBackpack={handleUpgradeBackpack}
          onHatchBeeEgg={handleHatchBeeEgg}
          doorsState={doorsState}
          onDoorsInteract={handleDoorsInteract}
          onDoorsToggleCrouch={handleDoorsToggleCrouch}
          onDoorsToggleFlashlight={handleDoorsToggleFlashlight}
          onDoorsTeleport100={handleDoorsTeleport100}
          onDoorsSelectRoom={(roomId) => engineRef.current?.teleportToDoorsRoom(roomId)}
          onDoorsTriggerRush={handleDoorsTriggerRush}
          onOpenRoomCode={() => setIsRoomCodeOpen(true)}
          mobileLayout={mobileLayout}
          cloudProfile={cloudProfile}
          isGuestSession={isGuestSession}
          onOpenAuth={() => setIsAuthOpen(true)}
          onInspectPlayer={setInspectedProfile}
          onInspectSelfProfile={handleOpenSelfProfileCard}
          onTriggerEmote={handleTriggerEmote}
          onCancelEmote={handleCancelEmote}
          activeEmote={activeEmote}
          isEmoteDisabled={
            gameState !== 'playing' ||
            isAuthOpen ||
            isCustomizerOpen ||
            isShopOpen ||
            isControlsOpen ||
            isAdminOpen ||
            isFeedbackOpen ||
            isRoomCodeOpen ||
            isVRModalOpen ||
            isVRTutorialOpen ||
            Boolean(inspectedProfile)
          }
          vrEnabled={vrFeatureEnabled && vrState.enabled}
          vrState={vrState}
          onToggleVR={vrFeatureEnabled ? () => engineRef.current?.toggleVRMode() : undefined}
          onOpenVRModal={vrFeatureEnabled ? () => setIsVRModalOpen(true) : undefined}
          onToggleVRControlsHint={vrFeatureEnabled ? () => engineRef.current?.toggleVRControlsHint() : undefined}
          onToggleVRMainMenu={vrFeatureEnabled ? () => engineRef.current?.toggleVRMainMenu() : undefined}
          onCalibrateVRHeight={vrFeatureEnabled ? () => engineRef.current?.calibrateVRStandingHeight() : undefined}
          onReturnToTitle={() => {
            if (engineRef.current?.vrState.enabled) {
              engineRef.current.toggleVRMode(false);
            }
            handleReturnToTitle();
          }}
          portalState={portalState}
          onFirePortal={(kind) => engineRef.current?.firePortal(kind)}
          onClearPortals={() => engineRef.current?.clearPortals()}
          voiceState={voiceState}
          onVoiceJoin={() => {
            void voiceManagerRef.current?.joinVoice();
          }}
          onVoiceLeave={() => {
            voiceManagerRef.current?.leaveVoice();
          }}
          onVoiceToggleMute={() => {
            voiceManagerRef.current?.toggleMute();
          }}
          onVoiceToggleDeafen={() => {
            voiceManagerRef.current?.toggleDeafen();
          }}
          onVoiceSetInputMode={(mode: VoiceInputMode) => {
            voiceManagerRef.current?.setInputMode(mode);
          }}
          onVoiceSetPttActive={(active: boolean) => {
            voiceManagerRef.current?.setPushToTalkActive(active);
          }}
          onVoiceSetSpatialMode={(mode: VoiceSpatialMode) => {
            voiceManagerRef.current?.setSpatialMode(mode);
          }}
          onVoiceSetMasterVolume={(vol: number) => {
            voiceManagerRef.current?.setMasterVolume(vol);
          }}
          onVoiceSetPeerVolume={(peerId: string, vol: number) => {
            voiceManagerRef.current?.setPeerVolume(peerId, vol);
          }}
          onVoiceTogglePeerMute={(peerId: string) => {
            voiceManagerRef.current?.togglePeerMute(peerId);
          }}
        />
      )}

      {/* Brief Dimensional Portal Warp Flash Vignette */}
      {gameState === 'playing' && portalState.warpFlash > 0.02 && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 pointer-events-none transition-opacity duration-75"
          style={{
            opacity: Math.min(0.65, portalState.warpFlash * 0.65),
            boxShadow:
              portalState.warpColor === 'blue'
                ? 'inset 0 0 140px 45px rgba(0, 229, 255, 0.95)'
                : 'inset 0 0 140px 45px rgba(255, 115, 0, 0.95)',
          }}
        />
      )}

      {!isAccountLocked && gameState === 'playing' && sessionConfig.gameId === 'studio' && (
        <StudioOverlay
          studioState={studioState}
          onSetPlayMode={(play) => engineRef.current?.setStudioPlayMode(play)}
          onSetTool={(tool) => engineRef.current?.setStudioTool(tool)}
          onSelectPartPreset={(kind, size, color, material) =>
            engineRef.current?.setStudioPartPreset(kind, size, color, material)
          }
          onSetColor={(color) => engineRef.current?.setStudioColor(color)}
          onSetMaterial={(mat) => engineRef.current?.setStudioMaterial(mat)}
          onSetSize={(size) => engineRef.current?.setStudioSize(size)}
          onRotate={() => engineRef.current?.rotateStudioSelectionOrBrush()}
          onSetGridSize={(grid) => engineRef.current?.setStudioGridSize(grid)}
          onSetSkyPreset={(sky) => engineRef.current?.setStudioSkyPreset(sky)}
          onRenameProject={(name) => engineRef.current?.renameStudioProject(name)}
          onNudgeSelected={(dx, dy, dz) => engineRef.current?.nudgeSelectedStudioObject(dx, dy, dz)}
          onDuplicateSelected={() => engineRef.current?.duplicateSelectedStudioObject()}
          onDeleteSelected={() => engineRef.current?.deleteSelectedStudioObject()}
          onUndo={() => engineRef.current?.undoStudio()}
          onRedo={() => engineRef.current?.redoStudio()}
          onLoadTemplate={(tpl) => engineRef.current?.loadStudioTemplate(tpl)}
          onExportJson={() => engineRef.current?.exportStudioJson() ?? '{}'}
          onImportJson={(json) => engineRef.current?.importStudioProject(json) ?? false}
          onPause={handlePause}
        />
      )}

      {!isAccountLocked && (gameState === 'playing' || gameState === 'paused') && (
        <VRActiveHUD
          vrState={vrState}
          doorsState={doorsState}
          isDoorsMode={sessionConfig.gameId === 'doors'}
          onDoorsInteract={handleDoorsInteract}
          onOpenModal={() => setIsVRModalOpen(true)}
          onOpenTutorial={() => setIsVRTutorialOpen(true)}
          onToggleProfile={() =>
            engineRef.current?.setVRControllerProfile(
              vrState.controllerProfile === 'pico4' ? 'quest_touch' : 'pico4'
            )
          }
          onToggleTracking={() =>
            engineRef.current?.setVRTrackingMode(
              vrState.trackingMode === 'controllers' ? 'hands' : 'controllers'
            )
          }
          onToggleStereo={() =>
            engineRef.current?.setVRDisplayMode(
              vrState.displayMode === 'stereo_sbs' ? 'mono_6dof' : 'stereo_sbs'
            )
          }
          onSnapTurn={(dir) => engineRef.current?.triggerVRSnapTurn(dir)}
          onTeleport={() => engineRef.current?.triggerVRTeleport()}
          onCalibrateHeight={() => engineRef.current?.calibrateVRStandingHeight()}
          onChangeHeightOffset={(heightOffset) =>
            engineRef.current?.setVROptions({ heightOffset })
          }
          onToggleControlsHint={() => engineRef.current?.toggleVRControlsHint()}
          onToggleVRMenu={() => engineRef.current?.toggleVRMainMenu()}
          onReturnToTitle={() => {
            engineRef.current?.toggleVRMode(false);
            handleReturnToTitle();
          }}
          portalGunActive={activeTool === 'portal_gun'}
          onTogglePortalGun={() => {
            const nextTool: ToolType = activeTool === 'portal_gun' ? 'sword' : 'portal_gun';
            handleSelectTool(nextTool);
          }}
          onTriggerGesture={(gestureId) => engineRef.current?.triggerVRGesture(gestureId)}
          onDisableVR={() => engineRef.current?.toggleVRMode(false)}
        />
      )}

      <VRControlModal
        isOpen={isVRModalOpen}
        vrState={vrState}
        onClose={() => setIsVRModalOpen(false)}
        onToggleVR={(force) => engineRef.current?.toggleVRMode(force)}
        onStartWebXR={() => engineRef.current?.startWebXRSession()}
        onSetTrackingMode={(mode) => engineRef.current?.setVRTrackingMode(mode)}
        onSetControllerProfile={(profile) => engineRef.current?.setVRControllerProfile(profile)}
        onSetDisplayMode={(mode) => engineRef.current?.setVRDisplayMode(mode)}
        onSetOptions={(opts) => engineRef.current?.setVROptions(opts)}
        onCalibrateHeight={() => engineRef.current?.calibrateVRStandingHeight()}
        onSnapTurn={(dir) => engineRef.current?.triggerVRSnapTurn(dir)}
        onTeleport={() => engineRef.current?.triggerVRTeleport()}
        onHapticPulse={() => engineRef.current?.triggerVRHapticPulse(0.85, 65)}
        onRecenter={() => engineRef.current?.recenterVRPose()}
        onTriggerGesture={(gestureId) => engineRef.current?.triggerVRGesture(gestureId)}
        onOpenTutorial={() => setIsVRTutorialOpen(true)}
      />

      <VRTutorialModal
        isOpen={isVRTutorialOpen}
        vrState={vrState}
        onClose={() => {
          setVRTutorialCompleted(true);
          setIsVRTutorialOpen(false);
        }}
        onComplete={() => {
          setVRTutorialCompleted(true);
          setIsVRTutorialOpen(false);
        }}
        onSetControllerProfile={(profile) => engineRef.current?.setVRControllerProfile(profile)}
        onSetTrackingMode={(mode) => engineRef.current?.setVRTrackingMode(mode)}
        onSetDisplayMode={(mode) => engineRef.current?.setVRDisplayMode(mode)}
        onSnapTurn={(dir) => engineRef.current?.triggerVRSnapTurn(dir)}
        onTeleport={() => engineRef.current?.triggerVRTeleport()}
        onHapticPulse={() => engineRef.current?.triggerVRHapticPulse(0.85, 65)}
        onRecenter={() => engineRef.current?.recenterVRPose()}
        onOpenVRSettings={() => setIsVRModalOpen(true)}
      />

      {/* Animated Modals (Pause, Victory, Wardrobe Customizer, Controls, Admin) */}
      <AnimatePresence>
        {gameState === 'paused' && (
          <PauseModal
            key="pause-modal"
            stats={stats}
            onResume={handleResume}
            onRestart={handleRestart}
            onReturnToTitle={handleReturnToTitle}
            onOpenCustomizer={() => setIsCustomizerOpen(true)}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            onOpenFeedback={() => setIsFeedbackOpen(true)}
            onOpenControls={() => setIsControlsOpen(true)}
            onOpenAdmin={() => setIsAdminOpen(true)}
            onOpenAuth={() => setIsAuthOpen(true)}
            accountUsername={cloudProfile?.username || null}
            isAdmin={isAdminUnlocked}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gameState === 'victory' && (
          <VictoryModal
            key="victory-modal"
            stats={stats}
            onPlayAgain={handleRestart}
            onReturnToTitle={handleReturnToTitle}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCustomizerOpen && (
          <CustomizerModal
            key="customizer-modal"
            currentSkin={skin}
            gems={stats.gems}
            unlockedAchievements={unlockedAchievements}
            isCloudSynced={Boolean(cloudProfile)}
            onRenameNickname={handleRenameNickname}
            onSave={handleSaveSkin}
            onClose={() => setIsCustomizerOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isShopOpen && (
          <ShopModal
            key="shop-modal"
            currentSkin={skin}
            coins={stats.coins}
            gems={stats.gems}
            ownedItems={ownedItems}
            isCloudSynced={Boolean(cloudProfile)}
            onOwnedItemsChange={handleOwnedItemsChange}
            onUpdateSkin={handleSaveSkin}
            onSpendCurrency={handleSpendCurrency}
            onClose={() => setIsShopOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isControlsOpen && (
          <ControlsModal
            key="controls-modal"
            onClose={() => setIsControlsOpen(false)}
            onKeybindsChange={handleKeybindsChange}
            mobileLayout={mobileLayout}
            onMobileLayoutChange={setMobileLayout}
            vrFeatureEnabled={vrFeatureEnabled}
            onToggleVRFeature={handleToggleVRFeature}
            onOpenVRModal={() => setIsVRModalOpen(true)}
            onEnterVRMenu={gameState === 'title' ? handleEnterVRMainMenu : undefined}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAdminOpen && (
          <AdminModal
            key="admin-modal"
            currentSkin={skin}
            isAdminUnlocked={isAdminUnlocked}
            adminPin={adminPin}
            onUnlockAdmin={handleUnlockAdmin}
            onLockAdmin={handleLockAdmin}
            currentGameId={sessionConfig.gameId || 'obby'}
            stats={stats}
            remotePlayers={remotePlayers}
            onClose={() => setIsAdminOpen(false)}
            onSetGodMode={handleSetGodMode}
            isGodMode={isGodMode}
            onSetFlyMode={handleSetFlyMode}
            isFlying={isFlying}
            onSetSpeedMultiplier={handleSetSpeedMultiplier}
            speedMultiplier={speedMultiplier}
            onSetJumpMultiplier={handleSetJumpMultiplier}
            jumpMultiplier={jumpMultiplier}
            onTeleportToCheckpoint={handleTeleportToCheckpoint}
            onAddCurrency={handleAddCurrency}
            onBroadcastMessage={handleBroadcastMessage}
            onTriggerAdminBlast={handleTriggerAdminBlast}
            onEquipAdminCrown={handleEquipAdminCrown}
            onHealPlayer={handleHealPlayer}
            onChangeSkinName={handleChangeSkinName}
            onTeleportToDoorsRoom={(target) => engineRef.current?.teleportToDoorsRoom(target)}
            onTriggerDoorsRush={handleDoorsTriggerRush}
            onTriggerDoorsScreech={() => engineRef.current?.triggerDoorsScreechEvent()}
            onGrantBeeHoney={(amount) => engineRef.current?.grantBeeHoney(amount)}
            onInspectPlayer={setInspectedProfile}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFeedbackOpen && (
          <FeedbackModal
            key="feedback-modal"
            authorName={cloudProfile?.username || skin.name}
            gameId={sessionConfig.gameId}
            mode={sessionConfig.mode}
            roomId={sessionConfig.roomId}
            onSummaryUpdated={() => setFeedbackVersion((v) => v + 1)}
            onClose={() => {
              setIsFeedbackOpen(false);
              setFeedbackVersion((v) => v + 1);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRoomCodeOpen && (
          <RoomCodePanel
            key="room-code-modal"
            sessionConfig={sessionConfig}
            onJoinOrCreateRoom={(cfg) => {
              startGame(cfg);
              setIsRoomCodeOpen(false);
            }}
            onClose={() => setIsRoomCodeOpen(false)}
            onlineCount={onlineCount}
            isConnected={isConnected}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(isAccountLocked || isAuthOpen) && (
          <AuthModal
            key="auth-modal"
            cloudProfile={cloudProfile}
            currentSkin={skin}
            ownedItems={ownedItems}
            coins={stats.coins}
            gems={stats.gems}
            lastSyncedAt={lastSyncedAt}
            isSyncingNow={isSyncingNow}
            onSyncNow={handleManualSyncAccount}
            locked={isAccountLocked}
            authChecking={!authReady}
            isGuestSession={isGuestSession}
            onUpdateGuestName={(name) => handleSaveSkin({ ...skin, name })}
            onRenameNickname={handleRenameNickname}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            isTouchMode={isTouchMode}
            onToggleTouchMode={handleToggleTouchMode}
            vrFeatureEnabled={vrFeatureEnabled}
            onToggleVRFeature={handleToggleVRFeature}
            onOpenVRModal={() => setIsVRModalOpen(true)}
            onEnterVRMenu={gameState === 'title' ? handleEnterVRMainMenu : undefined}
            onOpenCustomizer={() => setIsCustomizerOpen(true)}
            onOpenControls={() => setIsControlsOpen(true)}
            onOpenShop={() => setIsShopOpen(true)}
            onProfileReady={handleAuthProfileReady}
            onSignedOut={handleAuthSignedOut}
            onContinueAsGuest={handleContinueAsGuest}
            onClose={handleCloseAuth}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {inspectedProfile && (
          <PublicProfileCardModal
            key="public-profile-modal"
            lookup={inspectedProfile}
            viewerUsername={cloudProfile?.username || skin.name}
            equippedTitleId={skin.playerTitleId || null}
            onSelectPlayerTitle={handleSelectPlayerTitle}
            isAlreadyFriend={getStoredFriends().some(
              (f) =>
                f.name.toLowerCase() ===
                (inspectedProfile.username || inspectedProfile.remotePlayer?.skin?.name || '').toLowerCase()
            )}
            onAddFriend={(targetName) => {
              addFriend(targetName);
              addChatMessage(`Игрок ${targetName} добавлен в друзья!`, 'Система');
            }}
            onClose={() => setInspectedProfile(null)}
          />
        )}
      </AnimatePresence>

      {!isAccountLocked && (
        <>
          <AchievementBanner
            achievement={activeAchievementBanner}
            equippedTitleId={skin.playerTitleId || null}
            onEquipTitle={handleSelectPlayerTitle}
            onDismiss={() => setActiveAchievementBanner(null)}
          />
          {!(gameState === 'playing' && sessionConfig.gameId === 'studio' && studioState.mode === 'edit') && (
            <QuestsWidget onRewardClaimed={handleRewardClaimed} playerCoins={stats.coins} />
          )}
        </>
      )}
    </main>
  );
}

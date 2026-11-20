import type { EmoteId } from './emotes';
export type { EmoteId } from './emotes';

export type GameState = 'title' | 'playing' | 'paused' | 'gameover' | 'victory';

export type GameId = 'obby' | 'lava_survival' | 'bee_swarm' | 'doors' | 'studio';

export type SurfaceType = 'wood' | 'stone' | 'grass';

export type ToolType =
  | 'sword'
  | 'speed_coil'
  | 'gravity_coil'
  | 'hammer'
  | 'jetpack_boost'
  | 'bloxy_cola'
  | 'pollen_collector'
  | 'portal_gun'
  | 'dance';

export type MultiplayerMode = 'online' | 'lan_room' | 'local_coop';

export interface MultiplayerSessionConfig {
  mode: MultiplayerMode;
  roomId: string;
  gameId?: GameId;
  player2Name?: string;
}

export type ShirtOutfit =
  | 'rock_jacket'
  | 'red_hoodie'
  | 'blue_windbreaker'
  | 'tuxedo'
  | 'pizza_tee'
  | 'swat_vest'
  | 'rus_emr_vest'
  | 'custom_shirt';

export type PantsOutfit =
  | 'rock_jeans'
  | 'blue_denim'
  | 'cargo_camo'
  | 'rus_emr_pants'
  | 'track_pants'
  | 'suit_pants'
  | 'custom_pants';

export type HeadShape = 'round' | 'blocky';

export interface CharacterSkin {
  skinColor: string; // Head & hands color, e.g. '#e5c298' or '#fed000'
  torsoColor: string; // Shirt color, e.g. '#141619' or '#0055ff'
  legsColor: string; // Pants color, e.g. '#18181b' or '#32b400'
  headShape?: HeadShape; // 'round' (spherical/smooth) or 'blocky' (classic 6-sided)
  hat: string;
  face: string;
  outfit?: string;
  shirt?: string;
  pants?: string;
  backpack?: string;
  playerTitleId?: string | null;
  name: string;
}

export interface RemotePlayerInfo {
  id: string;
  playerKey?: string;
  bio?: string;
  gems?: number;
  unlockedAchievements?: Record<string, number>;
  lifetimeStats?: Partial<PlayerLifetimeStats>;
  skin: CharacterSkin;
  position: [number, number, number];
  rotationY: number;
  isMoving: boolean;
  isGrounded: boolean;
  activeTool: ToolType;
  checkpoint: number;
  coins: number;
  isLocalCoop?: boolean;
  activeEmote?: { id: EmoteId; expiresAt: number } | null;
  voiceEnabled?: boolean;
  voiceMuted?: boolean;
  voiceSpeaking?: boolean;
}

export type VoiceSignalType = 'offer' | 'answer' | 'ice';
export type VoiceSpatialMode = 'room' | 'proximity';
export type VoiceInputMode = 'open' | 'ptt';

export interface VoicePeerBroadcastState {
  id: string;
  enabled: boolean;
  muted: boolean;
  speaking: boolean;
}

export interface VoiceSignalPacket {
  from: string;
  to: string;
  signalType: VoiceSignalType;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  signalId?: string;
}

export interface VoiceParticipantInfo {
  id: string;
  name: string;
  isSelf: boolean;
  enabled: boolean;
  muted: boolean;
  speaking: boolean;
  level: number;
  connectionState: 'connected' | 'connecting' | 'local' | 'idle';
  volume: number;
  locallyMuted: boolean;
  distanceMeters: number | null;
  effectiveGain: number;
}

export interface VoiceChatSnapshot {
  connected: boolean;
  connecting: boolean;
  listenOnly: boolean;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  localLevel: number;
  inputMode: VoiceInputMode;
  pttActive: boolean;
  spatialMode: VoiceSpatialMode;
  masterVolume: number;
  micPermission: 'prompt' | 'granted' | 'denied' | 'unavailable';
  statusMessage: string | null;
  participants: VoiceParticipantInfo[];
  remoteVoiceCount: number;
}

export interface Checkpoint {
  id: number;
  name: string;
  position: [number, number, number];
  activated: boolean;
}

export interface CollectibleItem {
  id: string;
  type: 'coin' | 'gem';
  position: [number, number, number];
  value: number;
  collected: boolean;
}

export interface PlacedBlock {
  id: string;
  position: [number, number, number];
  color: string;
  materialType: 'plastic' | 'neon' | 'glass';
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  coins: number;
  gems: number;
  currentCheckpoint: number;
  totalCheckpoints: number;
  jumps: number;
  deaths: number;
  startTime: number;
  completionTime: number;
}

export interface ObstacleHazard {
  id: string;
  type: 'lava' | 'spinner' | 'crumbling' | 'trampoline' | 'speed_pad' | 'fall_trap';
  mesh?: any;
  meshId?: number;
  bounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  damage?: number;
  active?: boolean;
  customData?: Record<string, any>;
}

export interface SecretArea {
  id: string;
  name: string;
  description: string;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rewardCoins: number;
  category: 'parkour' | 'secret' | 'mastery' | 'survival';
  unlockedAt?: number;
}

export interface BeePet {
  id: string;
  name: string;
  type: 'basic' | 'rad' | 'bomber' | 'royal_gold';
  level: number;
  color: string;
  speed: number;
  gatherPower: number;
}

export interface FlowerFieldZone {
  id: string;
  name: string;
  flowerType: 'sunflower' | 'clover' | 'rose' | 'dandelion';
  color: string;
  pollenPerHarvest: number;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

export interface BeeFarmState {
  pollen: number;
  maxPollen: number;
  honey: number;
  bees: BeePet[];
  scooperLevel: number;
  scooperName: string;
  scooperPower: number;
  hiveLevel: number;
  currentField: FlowerFieldZone | null;
}

export type DoorsRoomTypeId =
  | 'elevator'
  | 'reception'
  | 'invitation_room'
  | 'grand_hallway'
  | 'ruined_rooms'
  | 'luxury_suite'
  | 'overgrown_basement'
  | 'book_archive'
  | 'archive_entrance'
  | 'library'
  | 'jeff_shop'
  | 'infirmary'
  | 'mid_rift'
  | 'courtyard_entrance'
  | 'courtyard'
  | 'greenhouse_junction'
  | 'greenhouse_corridor'
  | 'electrical_room';

export interface DoorsRoomDefinition {
  id: DoorsRoomTypeId;
  title: string;
  subtitle: string;
  startDoor: number;
  endDoor: number;
  icon: string;
}

export const DOORS_ROOMS_ATLAS: DoorsRoomDefinition[] = [
  { id: 'elevator', title: 'ЛИФТ', subtitle: 'Стартовый деревянный лифт отеля', startDoor: 0, endDoor: 0, icon: '🛗' },
  { id: 'reception', title: 'СТОЙКА АДМИНИСТРАТОРА', subtitle: 'Лобби, звонок, ключ 0001 и тележка с багажом', startDoor: 1, endDoor: 1, icon: '🛎️' },
  { id: 'invitation_room', title: 'КОМНАТА ПРИГЛАШЕНИЯ', subtitle: 'Заколоченный проход, гирлянда и знак HUMANS', startDoor: 2, endDoor: 6, icon: '🪧' },
  { id: 'grand_hallway', title: 'БОЛЬШОЙ КОРИДОР', subtitle: 'Длинный коридор с бра и тёмными панелями', startDoor: 7, endDoor: 14, icon: '🕯️' },
  { id: 'ruined_rooms', title: 'РАЗЛОМАННЫЕ КОМНАТЫ', subtitle: 'Следы когтей монстра на стенах и обломки', startDoor: 15, endDoor: 22, icon: '🐾' },
  { id: 'luxury_suite', title: 'ЛЮКС', subtitle: 'Апартаменты с арками, гостиной и книжными шкафами', startDoor: 23, endDoor: 30, icon: '🛋️' },
  { id: 'overgrown_basement', title: 'ЗАРОСШИЙ ПОДВАЛ', subtitle: 'Кирпичный подвал и люк в зелёных лозах', startDoor: 31, endDoor: 38, icon: '🌿' },
  { id: 'book_archive', title: 'КНИЖНЫЙ АРХИВ', subtitle: 'Двухуровневый зал с лестницей и зелёным столом', startDoor: 39, endDoor: 45, icon: '📚' },
  { id: 'archive_entrance', title: 'ВХОД В АРХИВЫ', subtitle: 'Сводчатый зал с часами и синей свечой', startDoor: 46, endDoor: 49, icon: '🕯️' },
  { id: 'library', title: 'БИБЛИОТЕКА', subtitle: 'Дверь 0050: Арочный зал и красный ковёр', startDoor: 50, endDoor: 50, icon: '📖' },
  { id: 'jeff_shop', title: 'МАГАЗИН ДЖЕФФА', subtitle: 'Лавка JEFF SHOP со светящимися глазами и предметами', startDoor: 51, endDoor: 56, icon: '🛒' },
  { id: 'infirmary', title: 'ЛАЗАРЕТ', subtitle: 'Больничные койки, каталки и лечебная трава', startDoor: 57, endDoor: 65, icon: '🏥' },
  { id: 'mid_rift', title: 'ПРОМЕЖУТОЧНЫЙ РАЗЛОМ', subtitle: 'Голубой электрический разлом с черепом', startDoor: 66, endDoor: 74, icon: '⚡' },
  { id: 'courtyard_entrance', title: 'ВХОД НА УЛИЦУ', subtitle: 'Каменные арочные ворота в зелёных лианах', startDoor: 75, endDoor: 82, icon: '🚪' },
  { id: 'courtyard', title: 'ВНУТРЕННИЙ ДВОР', subtitle: 'Дождливый двор со статуей ангела с мечом', startDoor: 83, endDoor: 90, icon: '🗿' },
  { id: 'greenhouse_junction', title: 'РАЗВИЛКА ОРАНЖЕРЕИ', subtitle: 'Стеклянная крыша, клумбы и кирпичная плитка', startDoor: 91, endDoor: 94, icon: '🪴' },
  { id: 'greenhouse_corridor', title: 'КОРИДОР ОРАНЖЕРЕИ', subtitle: 'Решётчатые двери 0095–0099 и ловушки Snare', startDoor: 95, endDoor: 99, icon: '栅' },
  { id: 'electrical_room', title: 'ЭЛЕКТРОЩИТОВАЯ', subtitle: 'Дверь 0100: Выход, стеллажи, Фигура и лифт', startDoor: 100, endDoor: 100, icon: '🔋' },
];

export interface DoorsGameState {
  currentDoorNumber: number; // 0 to 100
  isCrouching: boolean;
  isHidingInCloset: boolean;
  flashlightOn: boolean;
  lightFlickerIntensity: number; // 0..1
  activeEntity: 'none' | 'rush' | 'eyes' | 'screech' | 'figure' | 'silence' | 'dupe' | 'gloom' | 'glitch' | 'snare' | 'stalker';
  entityWarningText: string | null;
  screechActive: boolean;
  eyesActive: boolean;
  rushActive: boolean;
  rushWarningSeconds?: number;
  rushDistanceMeters?: number;
  silenceActive: boolean;
  gloomActive: boolean;
  inDoor100Room: boolean;
  figureDistance: number;
  figureAlerted: boolean;
  nearInteractable: {
    type: 'door' | 'closet' | 'elevator_button' | 'screech' | 'generator' | 'vault' | 'jeff_shop' | 'rift' | 'infirmary_herb';
    label: string;
    doorIndex?: number;
    closetId?: string;
  } | null;
  elevatorClosing: boolean;
  activePuzzle?: 'generator' | 'vault' | null;
  phaseName: string;
  currentRoomId?: DoorsRoomTypeId;
  currentRoomTitle?: string;
}

export type LeaderboardGameFilter = 'all' | GameId;

export interface LeaderboardGameStats {
  completedLevels: number;
  victories: number;
  bestTimeSeconds: number;
}

export interface LeaderboardEntry {
  rank?: number;
  playerKey: string;
  username: string;
  completedLevels: number;
  victories: number;
  bestTimeSeconds: number;
  totalTimeSeconds: number;
  bestGameId: GameId;
  perGameStats?: Partial<Record<GameId, LeaderboardGameStats>>;
  skin?: Partial<CharacterSkin>;
  updatedAt: number;
}

export interface LeaderboardResponse {
  gameId: LeaderboardGameFilter;
  entries: LeaderboardEntry[];
  totalPlayers: number;
  viewerRank: number | null;
  viewerEntry: LeaderboardEntry | null;
  updatedAt: number;
}

export interface PlayerLifetimeStats {
  totalCoins: number;
  totalGems: number;
  completedLevels: number;
  victories: number;
  bestTimeSeconds: number;
  totalTimeSeconds: number;
  totalJumps: number;
  totalDeaths: number;
}

export interface PublicPlayerProfile {
  playerKey: string;
  username: string;
  bio: string;
  accountType: 'cloud' | 'guest';
  isOnline?: boolean;
  currentGameId?: GameId;
  roomCheckpoint?: number;
  skin: CharacterSkin;
  stats: PlayerLifetimeStats;
  perGameStats?: Partial<Record<GameId, LeaderboardGameStats>>;
  unlockedAchievements: Record<string, number>;
  leaderboardRank?: number | null;
  updatedAt?: number;
}


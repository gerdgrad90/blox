export type GameState = 'title' | 'playing' | 'paused' | 'gameover' | 'victory';

export type GameId = 'obby' | 'lava_survival';

export type ToolType =
  | 'sword'
  | 'speed_coil'
  | 'gravity_coil'
  | 'hammer'
  | 'jetpack_boost'
  | 'bloxy_cola'
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
  | 'custom_shirt';

export type PantsOutfit =
  | 'rock_jeans'
  | 'blue_denim'
  | 'cargo_camo'
  | 'track_pants'
  | 'suit_pants'
  | 'custom_pants';

export interface CharacterSkin {
  skinColor: string; // Head & hands color, e.g. '#e5c298' or '#fed000'
  torsoColor: string; // Shirt color, e.g. '#141619' or '#0055ff'
  legsColor: string; // Pants color, e.g. '#18181b' or '#32b400'
  hat: 'none' | 'cap' | 'crown' | 'headphones' | 'visor' | 'viking' | 'rocker_hair';
  face: 'smile' | 'cool' | 'determined' | 'derp' | 'squiggly';
  outfit?: 'classic' | 'rock_jacket'; // Backward compatibility
  shirt?: ShirtOutfit;
  pants?: PantsOutfit;
  backpack?: 'none' | 'fuel_jetpack' | 'roblox_classic' | 'treasure_pack';
  name: string;
}

export interface RemotePlayerInfo {
  id: string;
  skin: CharacterSkin;
  position: [number, number, number];
  rotationY: number;
  isMoving: boolean;
  isGrounded: boolean;
  activeTool: ToolType;
  checkpoint: number;
  coins: number;
  isLocalCoop?: boolean;
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


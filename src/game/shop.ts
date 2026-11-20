export interface ShopItem {
  id: string;
  name: string;
  type: 'hat' | 'outfit' | 'face' | 'gear';
  priceCoins: number;
  priceGems: number;
  icon: string;
  description: string;
  skinProperty: {
    hat?: string;
    shirt?: string;
    pants?: string;
    face?: string;
    backpack?: string;
    outfit?: string;
  };
}

export const FREE_STARTER_ITEM_IDS = [
  'rocker_hair',
  'cap',
  '6b47_helmet',
  'rock_jacket',
  'pizza_tee',
  'rus_emr_vest',
  'squiggly',
  'smile',
  'eye_scar',
  'fuel_jetpack',
  'roblox_classic',
];

export const SHOP_CATALOG: ShopItem[] = [
  // Hats
  {
    id: 'rocker_hair',
    name: 'Рокерские волосы',
    type: 'hat',
    priceCoins: 0,
    priceGems: 0,
    icon: '🎸',
    description: 'Классическая прическа истинного рокера с красным козырьком.',
    skinProperty: { hat: 'rocker_hair' },
  },
  {
    id: 'cap',
    name: 'Красная Кепка Blox',
    type: 'hat',
    priceCoins: 0,
    priceGems: 0,
    icon: '🧢',
    description: 'Спортивная красная кепка Blox для паркура и города.',
    skinProperty: { hat: 'cap' },
  },
  {
    id: '6b47_helmet',
    name: 'Тактический шлем 6Б47',
    type: 'hat',
    priceCoins: 0,
    priceGems: 0,
    icon: '🪖',
    description: 'Оливковый шлем 6Б47 с креплением ПНВ и ремешком (скин Военный).',
    skinProperty: { hat: '6b47_helmet' },
  },
  {
    id: 'headphones',
    name: 'DJ Наушники',
    type: 'hat',
    priceCoins: 80,
    priceGems: 0,
    icon: '🎧',
    description: 'Стильные студийные наушники для крутых треков.',
    skinProperty: { hat: 'headphones' },
  },
  {
    id: 'visor',
    name: 'Кибер-Визор',
    type: 'hat',
    priceCoins: 90,
    priceGems: 0,
    icon: '⚡',
    description: 'Светящийся неоновый визор будущего.',
    skinProperty: { hat: 'visor' },
  },
  {
    id: 'top_hat',
    name: 'Цилиндр Джентльмена',
    type: 'hat',
    priceCoins: 100,
    priceGems: 0,
    icon: '🎩',
    description: 'Элегантный высокий цилиндр с красной лентой.',
    skinProperty: { hat: 'top_hat' },
  },
  {
    id: 'viking',
    name: 'Шлем Викинга',
    type: 'hat',
    priceCoins: 120,
    priceGems: 0,
    icon: '⚔️',
    description: 'Боевой рогатый шлем бесстрашного покорителя башен.',
    skinProperty: { hat: 'viking' },
  },
  {
    id: 'ninja_headband',
    name: 'Повязка Ниндзя',
    type: 'hat',
    priceCoins: 140,
    priceGems: 1,
    icon: '🥷',
    description: 'Легендарная повязка мастера скрытности со стальной пластиной.',
    skinProperty: { hat: 'ninja_headband' },
  },
  {
    id: 'gold_crown',
    name: 'Золотая Корона',
    type: 'hat',
    priceCoins: 200,
    priceGems: 2,
    icon: '👑',
    description: 'Корона победителя Obby. Показывает ваш высокий статус!',
    skinProperty: { hat: 'crown' },
  },
  {
    id: 'valkyrie_helm',
    name: 'Шлем Валькирии',
    type: 'hat',
    priceCoins: 280,
    priceGems: 3,
    icon: '🪽',
    description: 'Редкий крылатый шлем с золотым гребнем и сиянием.',
    skinProperty: { hat: 'valkyrie_helm' },
  },

  // Outfits
  {
    id: 'rock_jacket',
    name: 'Косуха Рокера',
    type: 'outfit',
    priceCoins: 0,
    priceGems: 0,
    icon: '🧥',
    description: 'Кожаная куртка с гитарой и черными джинсами.',
    skinProperty: { outfit: 'rock_jacket', shirt: 'rock_jacket', pants: 'rock_jeans' },
  },
  {
    id: 'pizza_tee',
    name: 'Футболка Bloxy Pizza',
    type: 'outfit',
    priceCoins: 0,
    priceGems: 0,
    icon: '🍕',
    description: 'Фирменная белая футболка с куском горячей пиццы.',
    skinProperty: { outfit: 'classic', shirt: 'pizza_tee', pants: 'blue_denim' },
  },
  {
    id: 'red_hoodie',
    name: 'Красное Худи Blox',
    type: 'outfit',
    priceCoins: 80,
    priceGems: 0,
    icon: '🔥',
    description: 'Удобное красное худи со шнурками и эмблемой Blox.',
    skinProperty: { outfit: 'classic', shirt: 'red_hoodie', pants: 'track_pants' },
  },
  {
    id: 'blue_windbreaker',
    name: 'Синяя Ветровка',
    type: 'outfit',
    priceCoins: 90,
    priceGems: 0,
    icon: '🌊',
    description: 'Легкая спортивная ветровка с молнией.',
    skinProperty: { outfit: 'classic', shirt: 'blue_windbreaker', pants: 'blue_denim' },
  },
  {
    id: 'tuxedo',
    name: 'Смокинг Агента',
    type: 'outfit',
    priceCoins: 160,
    priceGems: 1,
    icon: '🤵',
    description: 'Элегантный черный костюм с красной бабочкой.',
    skinProperty: { outfit: 'classic', shirt: 'tuxedo', pants: 'suit_pants' },
  },
  {
    id: 'swat_vest',
    name: 'Бронежилет SWAT',
    type: 'outfit',
    priceCoins: 220,
    priceGems: 2,
    icon: '🛡️',
    description: 'Тактическое снаряжение специального назначения и камуфляж.',
    skinProperty: { outfit: 'classic', shirt: 'swat_vest', pants: 'cargo_camo' },
  },
  {
    id: 'rus_emr_vest',
    name: 'Бронежилет + Форма EMR',
    type: 'outfit',
    priceCoins: 0,
    priceGems: 0,
    icon: '🦺',
    description: 'Тактический оливковый жилет с подсумками и камуфляж EMR с флагом (скин Военный).',
    skinProperty: { outfit: 'classic', shirt: 'rus_emr_vest', pants: 'rus_emr_pants' },
  },

  // Faces
  {
    id: 'squiggly',
    name: 'Волнистая ухмылка',
    type: 'face',
    priceCoins: 0,
    priceGems: 0,
    icon: '〰️',
    description: 'Фирменная озорная улыбка скина Губби человек.',
    skinProperty: { face: 'squiggly' },
  },
  {
    id: 'smile',
    name: 'Классическая улыбка',
    type: 'face',
    priceCoins: 0,
    priceGems: 0,
    icon: '😊',
    description: 'Классическое дружелюбное лицо Roblox.',
    skinProperty: { face: 'smile' },
  },
  {
    id: 'cool',
    name: 'Крутые очки 😎',
    type: 'face',
    priceCoins: 60,
    priceGems: 0,
    icon: '🕶️',
    description: 'Солнцезащитные очки в стиле Pro gamer.',
    skinProperty: { face: 'cool' },
  },
  {
    id: 'tough',
    name: 'Суровый 😠',
    type: 'face',
    priceCoins: 80,
    priceGems: 0,
    icon: '😤',
    description: 'Решительное лицо для тех, кто не боится трудностей.',
    skinProperty: { face: 'tough' },
  },
  {
    id: 'xd',
    name: 'Лицо XD 😆',
    type: 'face',
    priceCoins: 100,
    priceGems: 1,
    icon: '😆',
    description: 'Веселое смеющееся лицо для победных моментов.',
    skinProperty: { face: 'xd' },
  },
  {
    id: 'eye_scar',
    name: 'Шрам у глаза (Eye Scar)',
    type: 'face',
    priceCoins: 0,
    priceGems: 0,
    icon: '🤨',
    description: 'Серьёзный взгляд с нахмуренными бровями и шрамом под глазом (скин Военный).',
    skinProperty: { face: 'eye_scar' },
  },

  // Gear / Backpacks
  {
    id: 'fuel_jetpack',
    name: 'Джетпак FUEL',
    type: 'gear',
    priceCoins: 0,
    priceGems: 0,
    icon: '🚀',
    description: 'Стандартный реактивный ранец с плазменной тягой.',
    skinProperty: { backpack: 'fuel_jetpack' },
  },
  {
    id: 'roblox_classic',
    name: 'Рюкзак Blox Explorer',
    type: 'gear',
    priceCoins: 0,
    priceGems: 0,
    icon: '🎒',
    description: 'Красный походный рюкзак с фирменной эмблемой Blox.',
    skinProperty: { backpack: 'roblox_classic' },
  },
  {
    id: 'treasure_pack',
    name: 'Сундук Сокровищ',
    type: 'gear',
    priceCoins: 150,
    priceGems: 1,
    icon: '💎',
    description: 'Рюкзак-сундук искателя с сияющими аметистами.',
    skinProperty: { backpack: 'treasure_pack' },
  },
  {
    id: 'golden_jetpack',
    name: 'Золотой Джетпак',
    type: 'gear',
    priceCoins: 240,
    priceGems: 2,
    icon: '🌟',
    description: 'Позолоченный ракетный ранец с голубым турбо-пламенем.',
    skinProperty: { backpack: 'golden_jetpack' },
  },
  {
    id: 'neon_wings',
    name: 'Неоновые Крылья',
    type: 'gear',
    priceCoins: 320,
    priceGems: 3,
    icon: '🦋',
    description: 'Футуристические световые кибер-крылья за спиной.',
    skinProperty: { backpack: 'neon_wings' },
  },
];

const STORAGE_KEY_OWNED = 'blox_owned_items_v1';

export function mergeWithStarterItems(items: string[]): string[] {
  const set = new Set<string>([...FREE_STARTER_ITEM_IDS, ...items]);
  return Array.from(set);
}

export function getStoredOwnedItems(): string[] {
  if (typeof window === 'undefined') return [...FREE_STARTER_ITEM_IDS];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OWNED);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return mergeWithStarterItems(parsed.filter((x) => typeof x === 'string'));
      }
    }
  } catch {}
  return [...FREE_STARTER_ITEM_IDS];
}

export function saveStoredOwnedItems(itemIds: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_OWNED, JSON.stringify(mergeWithStarterItems(itemIds)));
  } catch {}
}

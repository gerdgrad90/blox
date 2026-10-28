import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Check, Sparkles, Flame, Rocket, Shirt, Dices, User } from 'lucide-react';
import { CharacterSkin, ShirtOutfit, PantsOutfit } from '../game/types';
import { SkinPreviewCanvas } from './SkinPreviewCanvas';

interface CustomizerModalProps {
  currentSkin: CharacterSkin;
  onSave: (skin: CharacterSkin) => void;
  onClose: () => void;
}

export const CustomizerModal: React.FC<CustomizerModalProps> = ({
  currentSkin,
  onSave,
  onClose,
}) => {
  const [skin, setSkin] = useState<CharacterSkin>(() => {
    return {
      ...currentSkin,
      shirt: currentSkin.shirt || (currentSkin.outfit === 'rock_jacket' ? 'rock_jacket' : 'custom_shirt'),
      pants: currentSkin.pants || (currentSkin.outfit === 'rock_jacket' ? 'rock_jeans' : 'custom_pants'),
    };
  });

  const skinColors = [
    { label: 'Персиковая (Мой скин)', color: '#e5c298' },
    { label: 'Blox Yellow', color: '#fed000' },
    { label: 'Загар', color: '#f5d0a9' },
    { label: 'Светлая', color: '#ffdfba' },
    { label: 'Смуглая', color: '#8d5524' },
    { label: 'Ледяной', color: '#38bdf8' },
  ];

  const shirtColors = [
    { label: 'Черная кожанка', color: '#141619' },
    { label: 'Классический синий', color: '#0055ff' },
    { label: 'Красное худи', color: '#dc2626' },
    { label: 'Темный графит', color: '#1e293b' },
    { label: 'Пурпурный', color: '#9333ea' },
    { label: 'Изумрудный', color: '#059669' },
  ];

  const pantsColors = [
    { label: 'Черные джинсы', color: '#18181b' },
    { label: 'Классический зеленый', color: '#32b400' },
    { label: 'Синие джинсы', color: '#1e3a8a' },
    { label: 'Хаки', color: '#d97706' },
    { label: 'Бирюзовые', color: '#0891b2' },
  ];

  const shirts: { id: ShirtOutfit; label: string; icon: string; desc: string }[] = [
    { id: 'rock_jacket', label: 'Кожанка Рокера', icon: '🎸', desc: 'Черная куртка с гитарой' },
    { id: 'red_hoodie', label: 'Худи Blox (Красное)', icon: '🔴', desc: 'Теплое худи со шнурками' },
    { id: 'blue_windbreaker', label: 'Ветровка Blox', icon: '🔵', desc: 'Спортивная куртка с молнией' },
    { id: 'tuxedo', label: 'Смокинг с Бабочкой', icon: '👔', desc: 'Строгий вечерний смокинг' },
    { id: 'pizza_tee', label: 'Bloxy Pizza', icon: '🍕', desc: 'Футболка с принтом пиццы' },
    { id: 'swat_vest', label: 'Жилет SWAT Спецназ', icon: '🛡️', desc: 'Тактический жилет с подсумками' },
    { id: 'custom_shirt', label: 'Своя Футболка', icon: '👕', desc: 'Выбирайте любой цвет торса' },
  ];

  const pantsList: { id: PantsOutfit; label: string; icon: string; desc: string }[] = [
    { id: 'rock_jeans', label: 'Черные Джинсы', icon: '👖', desc: 'Рваный деним и зеленые кеды' },
    { id: 'blue_denim', label: 'Синие Джинсы', icon: '👖', desc: 'Классические джинсы с ремнем' },
    { id: 'cargo_camo', label: 'Камуфляж Карго', icon: '🩳', desc: 'Военный камуфляж с берцами' },
    { id: 'track_pants', label: 'Спортивки Track', icon: '👟', desc: 'Штаны с белыми полосками' },
    { id: 'suit_pants', label: 'Брюки Смокинга', icon: '👔', desc: 'Строгие черные туфли и брюки' },
    { id: 'custom_pants', label: 'Свои Брюки', icon: '🩲', desc: 'Выбирайте любой цвет брюк' },
  ];

  const hats: { id: CharacterSkin['hat']; label: string }[] = [
    { id: 'rocker_hair', label: '🎸 Прическа + Козырек (Мой скин)' },
    { id: 'cap', label: '🧢 Красная Кепка Blox' },
    { id: 'crown', label: '👑 Золотая Корона' },
    { id: 'headphones', label: '🎧 Геймерские Наушники' },
    { id: 'visor', label: '⚡ Кибер-Визор' },
    { id: 'viking', label: '⚔️ Шлем Викинга' },
    { id: 'none', label: 'Без шляпы' },
  ];

  const faces: { id: CharacterSkin['face']; label: string }[] = [
    { id: 'squiggly', label: '〰️ Волнистая ухмылка (Мой скин)' },
    { id: 'smile', label: '😊 Классическая улыбка' },
    { id: 'cool', label: '😎 Крутые очки' },
    { id: 'determined', label: '😤 Решительный' },
    { id: 'derp', label: '🤪 Веселый дерп' },
  ];

  // Random nickname generator
  const handleRandomizeName = () => {
    const prefixes = ['Pro', 'Blox', 'Mega', 'Super', 'Epic', 'Speedy', 'Cool', 'Neon', 'Fire', 'Shadow', 'Lucky', 'Hyper'];
    const suffixes = ['Runner', 'Master', 'Gamer', 'Knight', 'Ninja', 'Player', 'Hero', 'Boy', 'Star', 'King', 'Bloxer', 'Rox'];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const s = suffixes[Math.floor(Math.random() * suffixes.length)];
    const n = Math.floor(10 + Math.random() * 89);
    setSkin((prev) => ({ ...prev, name: `${p}${s}_${n}` }));
  };

  // Quick Preset buttons (preserves player's custom nickname!)
  const applyPreset = (presetName: string) => {
    const currentName = skin.name || 'RockJetBlox';
    if (presetName === 'my_roblox_skin') {
      setSkin({
        skinColor: '#e5c298',
        torsoColor: '#141619',
        legsColor: '#18181b',
        hat: 'rocker_hair',
        face: 'squiggly',
        outfit: 'rock_jacket',
        shirt: 'rock_jacket',
        pants: 'rock_jeans',
        backpack: 'fuel_jetpack',
        name: currentName,
      });
    } else if (presetName === 'classic_noob') {
      setSkin({
        skinColor: '#fed000',
        torsoColor: '#0055ff',
        legsColor: '#32b400',
        hat: 'none',
        face: 'smile',
        outfit: 'classic',
        shirt: 'custom_shirt',
        pants: 'custom_pants',
        backpack: 'none',
        name: currentName,
      });
    } else if (presetName === 'cool_kid') {
      setSkin({
        skinColor: '#f5d0a9',
        torsoColor: '#dc2626',
        legsColor: '#1e3a8a',
        hat: 'cap',
        face: 'cool',
        outfit: 'classic',
        shirt: 'red_hoodie',
        pants: 'blue_denim',
        backpack: 'roblox_classic',
        name: currentName,
      });
    } else if (presetName === 'blox_king') {
      setSkin({
        skinColor: '#ffdfba',
        torsoColor: '#9333ea',
        legsColor: '#0f172a',
        hat: 'crown',
        face: 'determined',
        outfit: 'classic',
        shirt: 'tuxedo',
        pants: 'suit_pants',
        backpack: 'fuel_jetpack',
        name: currentName,
      });
    } else if (presetName === 'swat_special') {
      setSkin({
        skinColor: '#e5c298',
        torsoColor: '#1e293b',
        legsColor: '#334155',
        hat: 'headphones',
        face: 'cool',
        outfit: 'classic',
        shirt: 'swat_vest',
        pants: 'cargo_camo',
        backpack: 'roblox_classic',
        name: currentName,
      });
    } else if (presetName === 'pizza_boy') {
      setSkin({
        skinColor: '#f5d0a9',
        torsoColor: '#f1f5f9',
        legsColor: '#1e3a8a',
        hat: 'cap',
        face: 'derp',
        outfit: 'classic',
        shirt: 'pizza_tee',
        pants: 'blue_denim',
        backpack: 'treasure_pack',
        name: currentName,
      });
    }
  };

  const handleSave = () => {
    // Keep outfit in sync with shirt for legacy backward compatibility
    const updated: CharacterSkin = {
      ...skin,
      outfit: skin.shirt === 'rock_jacket' ? 'rock_jacket' : 'classic',
    };
    onSave(updated);
    onClose();
  };

  const isMyCustomSkinActive =
    skin.hat === 'rocker_hair' &&
    (skin.shirt === 'rock_jacket' || skin.outfit === 'rock_jacket') &&
    skin.backpack === 'fuel_jetpack';

  const activeShirt = skin.shirt || (skin.outfit === 'rock_jacket' ? 'rock_jacket' : 'custom_shirt');
  const activePants = skin.pants || (skin.outfit === 'rock_jacket' ? 'rock_jeans' : 'custom_pants');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 pointer-events-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28, mass: 0.85 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl rounded-3xl bg-slate-900 border-2 border-slate-700 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-4 sm:p-5 pb-3.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Sparkles size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Гардероб Персонажа</h2>
              <p className="text-xs text-slate-400">Выбирайте одежду, рюкзак и меняйте никнейм</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Main Body: 3D Preview on Left | Customization Controls on Right */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Left Column: Interactive 3D Real-time Skin Preview */}
          <div className="w-full md:w-[320px] lg:w-[360px] shrink-0 p-3.5 sm:p-4 flex flex-col gap-2.5 bg-slate-950/70 border-b md:border-b-0 md:border-r border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">3D ПРИМЕРКА:</span>
              <span className="text-[10px] text-amber-300 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                Вращайте на 360°
              </span>
            </div>

            <div className="flex-1 min-h-[220px] sm:min-h-[280px]">
              <SkinPreviewCanvas skin={skin} />
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs flex items-center justify-between">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-slate-400 font-medium">Рюкзак на спине:</span>
                <span className="text-sky-300 font-bold truncate">
                  {skin.backpack === 'fuel_jetpack'
                    ? '🚀 Джетпак FUEL'
                    : skin.backpack === 'roblox_classic'
                    ? '🎒 Рюкзак Blox'
                    : skin.backpack === 'treasure_pack'
                    ? '💎 Сундук Сокровищ'
                    : 'Без рюкзака'}
                </span>
              </div>
              <span className="text-[11px] font-bold text-amber-300 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 truncate max-w-[130px]">
                {skin.name || 'Игрок'}
              </span>
            </div>
          </div>

          {/* Right Column: Scrollable Customization Options */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 py-3.5 flex flex-col gap-4">
            {/* 1. NICKNAME INPUT BAR (Highlighted at top!) */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-2 border-amber-500/40 shadow-md">
              <label className="block text-xs font-black text-amber-400 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User size={14} className="text-amber-400" />
                  <span>ВАШ НИКНЕЙМ:</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {skin.name.length}/16
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={skin.name}
                  onChange={(e) => setSkin({ ...skin, name: e.target.value.slice(0, 16) })}
                  placeholder="Введите никнейм..."
                  maxLength={16}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-black text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={handleRandomizeName}
                  title="Сгенерировать случайный ник"
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                >
                  <Dices size={16} />
                  <span>Случайный</span>
                </button>
              </div>
            </div>

            {/* FEATURED USER ROBLOX SKIN CARD */}
            <div
              onClick={() => applyPreset('my_roblox_skin')}
              className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                isMyCustomSkinActive
                  ? 'bg-gradient-to-r from-amber-500/20 via-rose-500/15 to-sky-500/20 border-amber-400 shadow-lg'
                  : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex -space-x-2 shrink-0">
                  <img
                    src="/assets/aistudio/Screenshot_20261028_015800_Roblox_873253ee.jpg"
                    alt="Мой скин спереди"
                    className="w-12 h-14 object-cover rounded-xl border-2 border-amber-400 shadow-md"
                  />
                  <img
                    src="/assets/aistudio/Screenshot_20261028_015811_Roblox_7f92e85b.jpg"
                    alt="Мой скин сзади (FUEL Джетпак)"
                    className="w-12 h-14 object-cover rounded-xl border-2 border-sky-400 shadow-md"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Flame size={15} className="text-amber-400 shrink-0" />
                    <span className="font-black text-sm text-white truncate">
                      Мой Скин Blox
                    </span>
                    {isMyCustomSkinActive && (
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black">
                        АКТИВЕН
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Кожанка с электрогитарой, прическа с красным козырьком и реактивный ранец <strong className="text-sky-300">FUEL</strong>!
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Presets Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
              <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Пресеты:</span>
              <button
                type="button"
                onClick={() => applyPreset('my_roblox_skin')}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-xs font-bold text-amber-300 cursor-pointer whitespace-nowrap"
              >
                🔥 Мой Скин
              </button>
              <button
                type="button"
                onClick={() => applyPreset('classic_noob')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer whitespace-nowrap"
              >
                ⭐ Classic Noob
              </button>
              <button
                type="button"
                onClick={() => applyPreset('cool_kid')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-blue-500/30 text-xs font-bold text-blue-300 cursor-pointer whitespace-nowrap"
              >
                🧢 Cool Bloxer
              </button>
              <button
                type="button"
                onClick={() => applyPreset('blox_king')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-purple-500/30 text-xs font-bold text-purple-300 cursor-pointer whitespace-nowrap"
              >
                👑 Король Obby
              </button>
              <button
                type="button"
                onClick={() => applyPreset('swat_special')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-emerald-500/30 text-xs font-bold text-emerald-300 cursor-pointer whitespace-nowrap"
              >
                🛡️ Спецназ
              </button>
              <button
                type="button"
                onClick={() => applyPreset('pizza_boy')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-orange-500/30 text-xs font-bold text-orange-300 cursor-pointer whitespace-nowrap"
              >
                🍕 Пицца Blox
              </button>
            </div>

            {/* 2. SHIRTS / TOPS SELECTION (ВЕРХНЯЯ ОДЕЖДА) */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Shirt size={14} className="text-amber-400" />
                  <span>ВЕРХНЯЯ ОДЕЖДА (РУБАШКИ / ХУДИ / КУРТКИ):</span>
                </span>
                <span className="text-[11px] text-sky-400 font-semibold">
                  {shirts.find((s) => s.id === activeShirt)?.label}
                </span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {shirts.map((s) => {
                  const isSelected = activeShirt === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSkin({ ...skin, shirt: s.id, outfit: s.id === 'rock_jacket' ? 'rock_jacket' : 'classic' })}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md ring-1 ring-amber-400/50'
                          : 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold flex items-center gap-1.5">
                          <span>{s.icon}</span>
                          <span className="truncate">{s.label}</span>
                        </span>
                        {isSelected && <Check size={14} className="text-amber-400 shrink-0" />}
                      </div>
                      <span className="text-[10px] text-slate-400 truncate">{s.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. PANTS / BOTTOMS SELECTION (НИЖНЯЯ ОДЕЖДА) */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span>👖</span>
                  <span>НИЖНЯЯ ОДЕЖДА (БРЮКИ / ДЖИНСЫ / КАРГО):</span>
                </span>
                <span className="text-[11px] text-sky-400 font-semibold">
                  {pantsList.find((p) => p.id === activePants)?.label}
                </span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {pantsList.map((p) => {
                  const isSelected = activePants === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSkin({ ...skin, pants: p.id })}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                        isSelected
                          ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-md ring-1 ring-sky-400/50'
                          : 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold flex items-center gap-1.5">
                          <span>{p.icon}</span>
                          <span className="truncate">{p.label}</span>
                        </span>
                        {isSelected && <Check size={14} className="text-sky-400 shrink-0" />}
                      </div>
                      <span className="text-[10px] text-slate-400 truncate">{p.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. BACKPACK / JETPACK OPTIONS */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Rocket size={14} className="text-sky-400" />
                <span>РЮКЗАК / ДЖЕТПАК НА СПИНУ:</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setSkin({ ...skin, backpack: 'fuel_jetpack' })}
                  className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                    skin.backpack === 'fuel_jetpack'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400'
                  }`}
                >
                  🚀 Джетпак FUEL
                </button>
                <button
                  type="button"
                  onClick={() => setSkin({ ...skin, backpack: 'roblox_classic' })}
                  className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                    skin.backpack === 'roblox_classic'
                      ? 'bg-rose-500/20 border-rose-400 text-rose-300 shadow'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400'
                  }`}
                >
                  🎒 Рюкзак Blox
                </button>
                <button
                  type="button"
                  onClick={() => setSkin({ ...skin, backpack: 'treasure_pack' })}
                  className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                    skin.backpack === 'treasure_pack'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400'
                  }`}
                >
                  💎 Сундук Сокровищ
                </button>
                <button
                  type="button"
                  onClick={() => setSkin({ ...skin, backpack: 'none' })}
                  className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                    !skin.backpack || skin.backpack === 'none'
                      ? 'bg-slate-700/60 border-slate-500 text-slate-200'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400'
                  }`}
                >
                  Без рюкзака
                </button>
              </div>
            </div>

            {/* 5. HATS / HAIR */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">ПРИЧЕСКА / ГОЛОВНОЙ УБОР:</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {hats.map((hat) => (
                  <button
                    key={hat.id}
                    type="button"
                    onClick={() => setSkin({ ...skin, hat: hat.id })}
                    className={`p-2 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                      skin.hat === hat.id
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-300'
                    }`}
                  >
                    {hat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 6. FACES */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">ЛИЦО:</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {faces.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSkin({ ...skin, face: f.id })}
                    className={`p-2 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                      skin.face === f.id
                        ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                        : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 7. COLOR PALETTES */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">ЦВЕТ КОЖИ:</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {skinColors.map((sc) => (
                    <button
                      key={sc.color}
                      type="button"
                      onClick={() => setSkin({ ...skin, skinColor: sc.color })}
                      style={{ backgroundColor: sc.color }}
                      title={sc.label}
                      className={`w-7 h-7 rounded-lg border-2 transition-all cursor-pointer flex items-center justify-center ${
                        skin.skinColor === sc.color ? 'border-white scale-110 shadow' : 'border-black/30'
                      }`}
                    >
                      {skin.skinColor === sc.color && <Check size={13} className="text-black" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                  ЦВЕТ ТОРСА {activeShirt === 'custom_shirt' && <span className="text-amber-400">(Активен)</span>}:
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {shirtColors.map((sc) => (
                    <button
                      key={sc.color}
                      type="button"
                      onClick={() => setSkin({ ...skin, torsoColor: sc.color })}
                      style={{ backgroundColor: sc.color }}
                      title={sc.label}
                      className={`w-7 h-7 rounded-lg border-2 transition-all cursor-pointer flex items-center justify-center ${
                        skin.torsoColor === sc.color ? 'border-white scale-110 shadow' : 'border-black/30'
                      }`}
                    >
                      {skin.torsoColor === sc.color && <Check size={13} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                  ЦВЕТ БРЮК {activePants === 'custom_pants' && <span className="text-sky-400">(Активен)</span>}:
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {pantsColors.map((pc) => (
                    <button
                      key={pc.color}
                      type="button"
                      onClick={() => setSkin({ ...skin, legsColor: pc.color })}
                      style={{ backgroundColor: pc.color }}
                      title={pc.label}
                      className={`w-7 h-7 rounded-lg border-2 transition-all cursor-pointer flex items-center justify-center ${
                        skin.legsColor === pc.color ? 'border-white scale-110 shadow' : 'border-black/30'
                      }`}
                    >
                      {skin.legsColor === pc.color && <Check size={13} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Buttons - Fixed */}
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5 pt-3 border-t border-slate-800 bg-slate-900 shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <span>Имя:</span>
            <strong className="text-amber-300 font-bold">{skin.name || 'Игрок'}</strong>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold cursor-pointer transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-900/40 cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <Check size={16} />
              <span>Сохранить скин</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

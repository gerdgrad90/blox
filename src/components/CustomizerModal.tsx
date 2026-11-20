import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Check, Sparkles, Flame, Rocket, Shirt, Dices, User, CloudCheck, Lock, Tag } from 'lucide-react';
import { CharacterSkin, ShirtOutfit, PantsOutfit } from '../game/types';
import {
  NICKNAME_CHANGE_GEM_COST,
  isProtectedOwnerUsername,
  validateNicknameChangeAffordability,
} from '../game/auth';
import { ALL_PLAYER_TITLES, getPlayerTitleById, isTitleUnlocked } from '../game/titles';
import { SkinPreviewCanvas } from './SkinPreviewCanvas';
import { PlayerTitleBadge } from './PlayerTitleBadge';

interface CustomizerModalProps {
  currentSkin: CharacterSkin;
  gems?: number;
  unlockedAchievements?: Record<string, number>;
  isCloudSynced?: boolean;
  onRenameNickname?: (nextName: string) => Promise<{ ok: boolean; error?: string }>;
  onSave: (skin: CharacterSkin) => void;
  onClose: () => void;
}

export const CustomizerModal: React.FC<CustomizerModalProps> = ({
  currentSkin,
  gems = 0,
  unlockedAchievements = {},
  isCloudSynced = false,
  onRenameNickname,
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
    { label: 'Персиковая (Губби человек)', color: '#e5c298' },
    { label: 'Тёплый беж (Военный)', color: '#dfb08c' },
    { label: 'Blox Yellow', color: '#fed000' },
    { label: 'Загар', color: '#f5d0a9' },
    { label: 'Светлая', color: '#ffdfba' },
    { label: 'Смуглая', color: '#8d5524' },
    { label: 'Ледяной', color: '#38bdf8' },
  ];

  const shirtColors = [
    { label: 'Черная кожанка', color: '#141619' },
    { label: 'Оливковый тактический', color: '#354026' },
    { label: 'Классический синий', color: '#0055ff' },
    { label: 'Красное худи', color: '#dc2626' },
    { label: 'Темный графит', color: '#1e293b' },
    { label: 'Пурпурный', color: '#9333ea' },
    { label: 'Изумрудный', color: '#059669' },
  ];

  const pantsColors = [
    { label: 'Черные джинсы', color: '#18181b' },
    { label: 'Камуфляж EMR', color: '#303a22' },
    { label: 'Классический зеленый', color: '#32b400' },
    { label: 'Синие джинсы', color: '#1e3a8a' },
    { label: 'Хаки', color: '#d97706' },
    { label: 'Бирюзовые', color: '#0891b2' },
  ];

  const shirts: { id: ShirtOutfit; label: string; icon: string; desc: string }[] = [
    { id: 'rock_jacket', label: 'Кожанка Рокера', icon: '🎸', desc: 'Черная куртка с гитарой' },
    { id: 'rus_emr_vest', label: 'Бронежилет EMR', icon: '🦺', desc: 'Оливковый жилет и камуфляж с флагом' },
    { id: 'red_hoodie', label: 'Худи Blox (Красное)', icon: '🔴', desc: 'Теплое худи со шнурками' },
    { id: 'blue_windbreaker', label: 'Ветровка Blox', icon: '🔵', desc: 'Спортивная куртка с молнией' },
    { id: 'tuxedo', label: 'Смокинг с Бабочкой', icon: '👔', desc: 'Строгий вечерний смокинг' },
    { id: 'pizza_tee', label: 'Bloxy Pizza', icon: '🍕', desc: 'Футболка с принтом пиццы' },
    { id: 'swat_vest', label: 'Жилет SWAT Спецназ', icon: '🛡️', desc: 'Тактический жилет с подсумками' },
    { id: 'custom_shirt', label: 'Своя Футболка', icon: '👕', desc: 'Выбирайте любой цвет торса' },
  ];

  const pantsList: { id: PantsOutfit; label: string; icon: string; desc: string }[] = [
    { id: 'rock_jeans', label: 'Черные Джинсы', icon: '👖', desc: 'Рваный деним и зеленые кеды' },
    { id: 'rus_emr_pants', label: 'Камуфляж EMR + берцы', icon: '🪖', desc: 'Цифровой камуфляж и чёрные берцы' },
    { id: 'blue_denim', label: 'Синие Джинсы', icon: '👖', desc: 'Классические джинсы с ремнем' },
    { id: 'cargo_camo', label: 'Камуфляж Карго', icon: '🩳', desc: 'Военный камуфляж с берцами' },
    { id: 'track_pants', label: 'Спортивки Track', icon: '👟', desc: 'Штаны с белыми полосками' },
    { id: 'suit_pants', label: 'Брюки Смокинга', icon: '👔', desc: 'Строгие черные туфли и брюки' },
    { id: 'custom_pants', label: 'Свои Брюки', icon: '🩲', desc: 'Выбирайте любой цвет брюк' },
  ];

  const hats: { id: CharacterSkin['hat']; label: string }[] = [
    { id: 'rocker_hair', label: '🎸 Прическа + Козырек (Губби человек)' },
    { id: '6b47_helmet', label: '🪖 Шлем 6Б47 (Военный)' },
    { id: 'cap', label: '🧢 Красная Кепка Blox' },
    { id: 'crown', label: '👑 Золотая Корона' },
    { id: 'headphones', label: '🎧 Геймерские Наушники' },
    { id: 'visor', label: '⚡ Кибер-Визор' },
    { id: 'viking', label: '⚔️ Шлем Викинга' },
    { id: 'ninja_headband', label: '🥷 Повязка Ниндзя' },
    { id: 'valkyrie_helm', label: '🪽 Шлем Валькирии' },
    { id: 'top_hat', label: '🎩 Цилиндр' },
    { id: 'none', label: 'Без шляпы' },
  ];

  const faces: { id: CharacterSkin['face']; label: string }[] = [
    { id: 'squiggly', label: '〰️ Волнистая ухмылка (Губби человек)' },
    { id: 'eye_scar', label: '🤨 Шрам у глаза (Военный)' },
    { id: 'smile', label: '😊 Классическая улыбка' },
    { id: 'cool', label: '😎 Крутые очки' },
    { id: 'determined', label: '😤 Решительный' },
    { id: 'tough', label: '😠 Суровый' },
    { id: 'xd', label: '😆 Лицо XD' },
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

  // Quick Preset buttons (preserves player's custom nickname & equipped title!)
  const applyPreset = (presetName: string) => {
    const currentName = skin.name || 'RockJetBlox';
    const currentTitleId = skin.playerTitleId || null;
    if (presetName === 'my_roblox_skin') {
      setSkin({
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
        playerTitleId: currentTitleId,
        name: currentName,
      });
    } else if (presetName === 'classic_noob') {
      setSkin({
        skinColor: '#fed000',
        torsoColor: '#0055ff',
        legsColor: '#32b400',
        headShape: 'blocky',
        hat: 'none',
        face: 'smile',
        outfit: 'classic',
        shirt: 'custom_shirt',
        pants: 'custom_pants',
        backpack: 'none',
        playerTitleId: currentTitleId,
        name: currentName,
      });
    } else if (presetName === 'cool_kid') {
      setSkin({
        skinColor: '#f5d0a9',
        torsoColor: '#dc2626',
        legsColor: '#1e3a8a',
        headShape: 'round',
        hat: 'cap',
        face: 'cool',
        outfit: 'classic',
        shirt: 'red_hoodie',
        pants: 'blue_denim',
        backpack: 'roblox_classic',
        playerTitleId: currentTitleId,
        name: currentName,
      });
    } else if (presetName === 'blox_king') {
      setSkin({
        skinColor: '#ffdfba',
        torsoColor: '#9333ea',
        legsColor: '#0f172a',
        headShape: 'round',
        hat: 'crown',
        face: 'determined',
        outfit: 'classic',
        shirt: 'tuxedo',
        pants: 'suit_pants',
        backpack: 'fuel_jetpack',
        playerTitleId: currentTitleId,
        name: currentName,
      });
    } else if (presetName === 'swat_special') {
      setSkin({
        skinColor: '#e5c298',
        torsoColor: '#1e293b',
        legsColor: '#334155',
        headShape: 'blocky',
        hat: 'headphones',
        face: 'cool',
        outfit: 'classic',
        shirt: 'swat_vest',
        pants: 'cargo_camo',
        backpack: 'roblox_classic',
        playerTitleId: currentTitleId,
        name: currentName,
      });
    } else if (presetName === 'pizza_boy') {
      setSkin({
        skinColor: '#f5d0a9',
        torsoColor: '#f1f5f9',
        legsColor: '#1e3a8a',
        headShape: 'round',
        hat: 'cap',
        face: 'derp',
        outfit: 'classic',
        shirt: 'pizza_tee',
        pants: 'blue_denim',
        backpack: 'treasure_pack',
        playerTitleId: currentTitleId,
        name: currentName,
      });
    } else if (presetName === 'niko_friend') {
      setSkin({
        skinColor: '#e5c298',
        torsoColor: '#1e293b',
        legsColor: '#1e3a8a',
        headShape: 'round',
        hat: 'rocker_hair',
        face: 'cool',
        outfit: 'classic',
        shirt: 'red_hoodie',
        pants: 'blue_denim',
        backpack: 'fuel_jetpack',
        playerTitleId: currentTitleId,
        name: currentName,
      });
    } else if (presetName === 'pasha_friend') {
      setSkin({
        skinColor: '#dfb08c',
        torsoColor: '#354026',
        legsColor: '#303a22',
        headShape: 'round',
        hat: '6b47_helmet',
        face: 'eye_scar',
        outfit: 'classic',
        shirt: 'rus_emr_vest',
        pants: 'rus_emr_pants',
        backpack: 'none',
        playerTitleId: currentTitleId,
        name: currentName,
      });
    }
  };

  const [nameError, setNameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isNicknameChanged = skin.name.trim() !== currentSkin.name.trim();

  const handleSave = async () => {
    const nextCleanName = skin.name.trim().slice(0, 16);
    if (!isCloudSynced && isProtectedOwnerUsername(nextCleanName)) {
      setNameError('Никнейм «gerdgrad92» защищён и недоступен для гостей. Выберите другой ник.');
      return;
    }

    if (nextCleanName !== currentSkin.name.trim()) {
      const afford = validateNicknameChangeAffordability(currentSkin.name, nextCleanName, gems);
      if (!afford.ok) {
        setNameError(afford.error || `Нужно ${NICKNAME_CHANGE_GEM_COST} 💎 для смены ника.`);
        return;
      }
      if (onRenameNickname) {
        setIsSaving(true);
        setNameError(null);
        try {
          const res = await onRenameNickname(nextCleanName);
          if (!res.ok) {
            setNameError(res.error || 'Не удалось сменить никнейм.');
            return;
          }
        } finally {
          setIsSaving(false);
        }
      }
    }

    setNameError(null);
    // Keep outfit in sync with shirt for legacy backward compatibility
    const updated: CharacterSkin = {
      ...skin,
      name: nextCleanName || currentSkin.name,
      outfit: skin.shirt === 'rock_jacket' ? 'rock_jacket' : 'classic',
    };
    onSave(updated);
    onClose();
  };

  const activeShirt = skin.shirt || (skin.outfit === 'rock_jacket' ? 'rock_jacket' : 'custom_shirt');
  const activePants = skin.pants || (skin.outfit === 'rock_jacket' ? 'rock_jeans' : 'custom_pants');

  const isMyCustomSkinActive =
    skin.hat === 'rocker_hair' &&
    (skin.shirt === 'rock_jacket' || skin.outfit === 'rock_jacket') &&
    skin.backpack === 'fuel_jetpack';

  const isPashaFriendSkinActive =
    skin.hat === '6b47_helmet' &&
    skin.face === 'eye_scar' &&
    activeShirt === 'rus_emr_vest' &&
    activePants === 'rus_emr_pants';

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
        className="w-full max-w-4xl rounded-3xl bg-slate-900 border-2 border-slate-700 shadow-2xl flex flex-col max-h-[94dvh] overflow-hidden"
      >
        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-4 sm:p-5 pb-3.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-white">Гардероб Персонажа</h2>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    isCloudSynced
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                  }`}
                >
                  <CloudCheck size={11} />
                  <span>{isCloudSynced ? 'Облачная синхронизация' : 'Синхронизация между окнами'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">Выбирайте одежду, рюкзак и синхронизируйте скин на всех экранах</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Main Body: Scrollable on Mobile, Split Fixed Preview on Desktop */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto md:overflow-hidden">
          {/* Left Column: Interactive 3D Real-time Skin Preview */}
          <div className="w-full md:w-[320px] lg:w-[360px] shrink-0 p-3 sm:p-4 flex flex-col gap-2 bg-slate-950/70 border-b md:border-b-0 md:border-r border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">3D ПРИМЕРКА:</span>
              <span className="text-[10px] text-amber-300 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                Вращайте на 360°
              </span>
            </div>

            <div className="h-[240px] sm:h-[270px] md:h-auto md:flex-1 md:min-h-[300px]">
              <SkinPreviewCanvas skin={skin} />
            </div>

            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs flex items-center justify-between">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-slate-400 font-medium">Рюкзак на спине:</span>
                <span className="text-sky-300 font-bold truncate">
                  {skin.backpack === 'fuel_jetpack'
                    ? '🚀 Джетпак FUEL'
                    : skin.backpack === 'golden_jetpack'
                    ? '🌟 Золотой Джетпак'
                    : skin.backpack === 'neon_wings'
                    ? '🦋 Неоновые Крылья'
                    : skin.backpack === 'roblox_classic'
                    ? '🎒 Рюкзак Blox'
                    : skin.backpack === 'treasure_pack'
                    ? '💎 Сундук Сокровищ'
                    : 'Без рюкзака'}
                </span>
              </div>
              <div className="flex flex-col items-end gap-0.5 max-w-[155px]">
                {getPlayerTitleById(skin.playerTitleId) && (
                  <PlayerTitleBadge
                    title={getPlayerTitleById(skin.playerTitleId)!}
                    size="xs"
                  />
                )}
                <span className="text-[11px] font-bold text-amber-300 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 truncate max-w-full">
                  {skin.name || 'Игрок'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Customization Options */}
          <div className="flex-none md:flex-1 md:overflow-y-auto p-3.5 sm:p-5 py-3.5 flex flex-col gap-4">
            {/* 1. NICKNAME INPUT BAR (Highlighted at top!) */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-2 border-amber-500/40 shadow-md">
              <label className="block text-xs font-black text-amber-400 mb-1.5 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 flex-wrap">
                  <User size={14} className="text-amber-400" />
                  <span>ВАШ НИКНЕЙМ:</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md border text-[10px] font-black ${
                      gems >= NICKNAME_CHANGE_GEM_COST
                        ? 'bg-cyan-500/15 border-cyan-400/45 text-cyan-300'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    Смена: {NICKNAME_CHANGE_GEM_COST} 💎
                  </span>
                </span>
                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                  {skin.name.length}/16
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={skin.name}
                  onChange={(e) => {
                    setSkin({ ...skin, name: e.target.value.slice(0, 16) });
                    if (nameError) setNameError(null);
                  }}
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
              <p className="mt-1.5 text-[11px] text-slate-400">
                {isNicknameChanged
                  ? gems >= NICKNAME_CHANGE_GEM_COST
                    ? `При сохранении спишется ${NICKNAME_CHANGE_GEM_COST} 💎 за смену ника (у вас ${gems} 💎).`
                    : `Для смены ника нужно ${NICKNAME_CHANGE_GEM_COST} 💎 (у вас ${gems} 💎 — кристаллы гипер редкие). Скин и титул меняются бесплатно.`
                  : `Смена ника стоит ${NICKNAME_CHANGE_GEM_COST} 💎 (у вас ${gems} 💎). Изменение скина и титула — бесплатно.`}
              </p>
              {nameError && (
                <p
                  data-testid="customizer-name-error"
                  className="mt-2 text-xs font-bold text-rose-400"
                >
                  {nameError}
                </p>
              )}
            </div>

            {/* 1.5 PLAYER TITLE SELECTOR (UNLOCKED VIA ACHIEVEMENTS) */}
            <div
              data-testid="customizer-titles-section"
              className="p-3.5 rounded-2xl bg-slate-950/85 border border-slate-700/80 shadow-md"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                  <Tag size={14} className="text-amber-400" />
                  <span>ТИТУЛ НАД НИКОМ (ДОСТИЖЕНИЯ):</span>
                </span>
                <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                  {ALL_PLAYER_TITLES.filter((t) => isTitleUnlocked(t.id, unlockedAchievements)).length}/
                  {ALL_PLAYER_TITLES.length} открыто
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  data-testid="customizer-title-none"
                  onClick={() => setSkin((prev) => ({ ...prev, playerTitleId: null }))}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                    !skin.playerTitleId
                      ? 'bg-slate-700 border-amber-400 text-white shadow'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  Без титула
                </button>
                {ALL_PLAYER_TITLES.map((title) => {
                  const unlocked = isTitleUnlocked(title.id, unlockedAchievements);
                  const selected = skin.playerTitleId === title.id;
                  return (
                    <button
                      key={title.id}
                      type="button"
                      disabled={!unlocked}
                      data-testid={`customizer-title-${title.id}`}
                      title={
                        unlocked
                          ? `${title.label} — ${title.subtitleRu}`
                          : `Закрыто: ${title.subtitleRu}`
                      }
                      onClick={() => {
                        if (!unlocked) return;
                        setSkin((prev) => ({ ...prev, playerTitleId: title.id }));
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border-2 text-xs font-bold transition-all ${
                        unlocked
                          ? selected
                            ? 'border-white bg-slate-800 shadow-[0_0_12px_rgba(255,255,255,0.25)] cursor-pointer'
                            : 'border-slate-700/80 bg-slate-900/90 hover:border-slate-500 cursor-pointer'
                          : 'border-slate-800 bg-slate-950/60 text-slate-500 opacity-55 cursor-not-allowed'
                      }`}
                    >
                      {unlocked ? (
                        <PlayerTitleBadge title={title} size="xs" />
                      ) : (
                        <>
                          <Lock size={11} className="text-slate-500 shrink-0" />
                          <span className="text-[11px] font-bold">{title.label}</span>
                        </>
                      )}
                      {selected && <Check size={12} className="text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* FEATURED ROBLOX SKINS: MY SKIN & FRIEND PASHA_PRASER */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              <div
                onClick={() => applyPreset('my_roblox_skin')}
                className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-3 ${
                  isMyCustomSkinActive
                    ? 'bg-gradient-to-r from-amber-500/20 via-rose-500/15 to-sky-500/20 border-amber-400 shadow-lg'
                    : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-700'
                }`}
              >
                <div className="flex -space-x-2 shrink-0">
                  <img
                    src="./assets/aistudio/Screenshot_20261028_015800_Roblox_873253ee.jpg"
                    alt="Губби человек спереди"
                    className="w-11 h-13 object-cover rounded-xl border-2 border-amber-400 shadow-md"
                  />
                  <img
                    src="./assets/aistudio/Screenshot_20261028_015811_Roblox_7f92e85b.jpg"
                    alt="Губби человек сзади (FUEL Джетпак)"
                    className="w-11 h-13 object-cover rounded-xl border-2 border-sky-400 shadow-md"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Flame size={14} className="text-amber-400 shrink-0" />
                    <span className="font-black text-xs sm:text-sm text-white truncate">
                      Губби человек
                    </span>
                    {isMyCustomSkinActive && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-black">
                        АКТИВЕН
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2">
                    Кожанка с гитарой, козырёк и ранец <strong className="text-sky-300">FUEL</strong>
                  </p>
                </div>
              </div>

              <div
                onClick={() => applyPreset('pasha_friend')}
                className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-3 ${
                  isPashaFriendSkinActive
                    ? 'bg-gradient-to-r from-emerald-500/20 via-lime-500/15 to-slate-800/40 border-emerald-400 shadow-lg'
                    : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-700'
                }`}
              >
                <img
                  src="./assets/roblox_pasha_praser.png"
                  alt="Скин Военный"
                  className="w-13 h-13 object-contain bg-slate-900 rounded-xl border-2 border-emerald-400/80 shadow-md shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm shrink-0">🪖</span>
                    <span className="font-black text-xs sm:text-sm text-white truncate">
                      Военный
                    </span>
                    {isPashaFriendSkinActive && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-400 text-slate-950 text-[9px] font-black">
                        АКТИВЕН
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2">
                    Шлем 6Б47, жилет с подсумками, камуфляж EMR и шрам у глаза
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
                🔥 Губби человек
              </button>
              <button
                type="button"
                onClick={() => applyPreset('pasha_friend')}
                className="px-3 py-1.5 rounded-xl bg-lime-500/20 hover:bg-lime-500/30 border border-lime-400/50 text-xs font-bold text-lime-300 cursor-pointer whitespace-nowrap"
              >
                🪖 Военный
              </button>
              <button
                type="button"
                onClick={() => applyPreset('niko_friend')}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-xs font-bold text-emerald-300 cursor-pointer whitespace-nowrap"
              >
                🟢 Блоксер
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                  onClick={() => setSkin({ ...skin, backpack: 'golden_jetpack' })}
                  className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                    skin.backpack === 'golden_jetpack'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400'
                  }`}
                >
                  🌟 Золотой Джетпак
                </button>
                <button
                  type="button"
                  onClick={() => setSkin({ ...skin, backpack: 'neon_wings' })}
                  className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                    skin.backpack === 'neon_wings'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400'
                  }`}
                >
                  🦋 Неоновые Крылья
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

            {/* 6. HEAD SHAPE (Круглая / Классическая блочная) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-300">ФОРМА ГОЛОВЫ:</label>
                <span className="text-[10px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                  {skin.headShape === 'blocky' ? 'Квадратная (Блочная)' : '⚪ Круглая (Губби человек)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSkin({ ...skin, headShape: 'round' })}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    (skin.headShape || 'round') === 'round'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md ring-1 ring-amber-400/40'
                      : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="text-xl">⚪</span>
                  <div className="flex flex-col text-left">
                    <span className="text-white font-bold">Круглая Голова</span>
                    <span className="text-[10px] text-slate-400 font-normal">Сферическая (Военный / Губби человек)</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSkin({ ...skin, headShape: 'blocky' })}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    skin.headShape === 'blocky'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-md ring-1 ring-sky-400/40'
                      : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="text-xl">⬛</span>
                  <div className="flex flex-col text-left">
                    <span className="text-white font-bold">Блочная Голова</span>
                    <span className="text-[10px] text-slate-400 font-normal">Классическая квадратная 6-гранная</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 7. FACES */}
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
              disabled={isSaving}
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-bold shadow-lg shadow-emerald-900/40 cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <Check size={16} />
              <span>
                {isNicknameChanged
                  ? `Сохранить (-${NICKNAME_CHANGE_GEM_COST} 💎)`
                  : 'Сохранить скин'}
              </span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, RotateCcw, Check, Keyboard, Smartphone, Sliders, ArrowUp, Sword, Eye } from 'lucide-react';
import {
  KeybindsConfig,
  formatKeyName,
  getKeybinds,
  saveKeybinds,
  resetKeybinds,
  MobileLayoutConfig,
  DEFAULT_MOBILE_LAYOUT,
  getMobileLayout,
  saveMobileLayout,
  resetMobileLayout,
} from '../game/controls';

interface ControlsModalProps {
  onClose: () => void;
  onKeybindsChange: (config: KeybindsConfig) => void;
  mobileLayout?: MobileLayoutConfig;
  onMobileLayoutChange?: (layout: MobileLayoutConfig) => void;
  vrFeatureEnabled?: boolean;
  onToggleVRFeature?: (next?: boolean) => void;
  onOpenVRModal?: () => void;
  onEnterVRMenu?: () => void;
}

export const ControlsModal: React.FC<ControlsModalProps> = ({
  onClose,
  onKeybindsChange,
  mobileLayout: propMobileLayout,
  onMobileLayoutChange,
  vrFeatureEnabled = false,
  onToggleVRFeature,
  onOpenVRModal,
  onEnterVRMenu,
}) => {
  const [activeTab, setActiveTab] = useState<'keyboard' | 'mobile' | 'vr'>('mobile');
  const [config, setConfig] = useState<KeybindsConfig>(() => getKeybinds());
  const [activeBindingField, setActiveBindingField] = useState<keyof KeybindsConfig | null>(null);

  // Mobile layout state
  const [mobileConfig, setMobileConfig] = useState<MobileLayoutConfig>(() => propMobileLayout || getMobileLayout());

  const updateMobile = (partial: Partial<MobileLayoutConfig>) => {
    const updated: MobileLayoutConfig = {
      ...mobileConfig,
      ...partial,
    };
    setMobileConfig(updated);
    saveMobileLayout(updated);
    onMobileLayoutChange?.(updated);
  };

  const applyPreset = (preset: 'standard' | 'reversed') => {
    if (preset === 'standard') {
      updateMobile({
        preset: 'standard',
        joystickSide: 'left',
        joystickX: 16,
        joystickY: 85,
        buttonsSide: 'right',
        buttonsX: 16,
        buttonsY: 85,
      });
    } else {
      updateMobile({
        preset: 'reversed',
        joystickSide: 'right',
        joystickX: 16,
        joystickY: 85,
        buttonsSide: 'left',
        buttonsX: 16,
        buttonsY: 85,
      });
    }
  };

  const handleResetMobile = () => {
    const def = resetMobileLayout();
    setMobileConfig(def);
    onMobileLayoutChange?.(def);
  };

  useEffect(() => {
    if (!activeBindingField) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape cancels binding
      if (e.code === 'Escape') {
        setActiveBindingField(null);
        return;
      }

      const updated = {
        ...config,
        [activeBindingField]: e.code,
      };

      setConfig(updated);
      saveKeybinds(updated);
      onKeybindsChange(updated);
      setActiveBindingField(null);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [activeBindingField, config, onKeybindsChange]);

  const handleResetKeyboard = () => {
    const def = resetKeybinds();
    setConfig(def);
    onKeybindsChange(def);
    setActiveBindingField(null);
  };

  const sections: {
    title: string;
    items: { field: keyof KeybindsConfig; label: string; desc?: string }[];
  }[] = [
    {
      title: '🏃 Передвижение персонажа',
      items: [
        { field: 'forward', label: 'Вперед', desc: 'Бег вперед' },
        { field: 'backward', label: 'Назад', desc: 'Бег назад' },
        { field: 'left', label: 'Влево', desc: 'Стрейф влево' },
        { field: 'right', label: 'Вправо', desc: 'Стрейф вправо' },
        { field: 'jump', label: 'Прыжок', desc: 'Прыжок / Взлёт на джетпаке' },
        { field: 'sprint', label: 'Спринт', desc: 'Ускоренный бег (+40%)' },
      ],
    },
    {
      title: '⚡ Действия и горячие клавиши',
      items: [
        { field: 'reset', label: 'Сброс / Респавн', desc: 'Возврат на чекпоинт' },
        { field: 'backpack', label: 'Рюкзак Blox', desc: 'Открыть инвентарь предметов' },
        { field: 'mute', label: 'Вкл/Выкл Звук', desc: 'Быстрое отключение музыки и звуков' },
      ],
    },
    {
      title: '🎒 Слоты хотбара предметов (1-7)',
      items: [
        { field: 'tool1', label: 'Слот 1', desc: 'Меч Blox' },
        { field: 'tool2', label: 'Слот 2', desc: 'Speed Coil' },
        { field: 'tool3', label: 'Слот 3', desc: 'Gravity Coil' },
        { field: 'tool4', label: 'Слот 4', desc: 'Молот BTools' },
        { field: 'tool5', label: 'Слот 5', desc: 'Джетпак FUEL' },
        { field: 'tool6', label: 'Слот 6', desc: 'Bloxy Cola' },
        { field: 'tool7', label: 'Слот 7', desc: 'Танец Blox' },
      ],
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm pointer-events-auto"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 15 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-3xl bg-slate-900 border-2 border-slate-700 shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden"
      >
        {/* Header with Nav Tabs */}
        <div className="flex items-center justify-between p-3.5 sm:p-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 shrink-0">
              <Sliders size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-black text-white flex items-center gap-2 truncate">
                <span>Настройки Управления</span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Кастомизация сенсора и клавиатуры
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть настройки"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher Pills */}
        <div className="px-3.5 sm:px-5 pt-2.5 pb-2 border-b border-slate-800 grid grid-cols-3 sm:flex items-center gap-2 bg-slate-950/50 shrink-0">
          <button
            type="button"
            data-testid="controls-tab-mobile"
            onClick={() => setActiveTab('mobile')}
            className={`min-h-[40px] flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              activeTab === 'mobile'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone size={16} className="shrink-0" />
            <span className="truncate">Сенсор</span>
          </button>

          <button
            type="button"
            data-testid="controls-tab-keyboard"
            onClick={() => setActiveTab('keyboard')}
            className={`min-h-[40px] flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              activeTab === 'keyboard'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Keyboard size={16} className="shrink-0" />
            <span className="truncate">Клавиатура (ПК)</span>
          </button>

          <button
            type="button"
            data-testid="controls-tab-vr"
            onClick={() => setActiveTab('vr')}
            className={`min-h-[40px] flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              activeTab === 'vr'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span className="text-sm shrink-0">🥽</span>
            <span className="truncate">VR (PICO / Quest)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {activeTab === 'vr' ? (
            /* VR PICO / QUEST CONTROLS REFERENCE TAB */
            <div className="space-y-4" data-testid="controls-vr-panel">
              {onToggleVRFeature && (
                <div className="rounded-2xl border-2 border-cyan-500/45 bg-slate-950/90 p-3.5 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-black text-sm text-white flex items-center gap-2">
                        <span>🥽</span>
                        <span>Режим VR (PICO 4 / Quest / WebXR)</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {vrFeatureEnabled
                          ? 'Функция VR включена: в игре доступна кнопка VR [V] и все функции шлема (в главном меню кнопка скрыта).'
                          : 'Функция VR отключена: кнопка VR скрыта в главном меню и в игре.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      data-testid="controls-vr-feature-toggle"
                      onClick={() => onToggleVRFeature()}
                      className={`px-4 py-2 rounded-xl font-black text-xs border cursor-pointer transition-all shrink-0 ${
                        vrFeatureEnabled
                          ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-sm shadow-cyan-500/30'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
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
                          data-testid="controls-vr-launch-menu-btn"
                          onClick={() => {
                            onClose();
                            onEnterVRMenu();
                          }}
                          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-black text-xs cursor-pointer transition-all"
                        >
                          🥽 Запустить 3D VR Меню
                        </button>
                      )}
                      {onOpenVRModal && (
                        <button
                          type="button"
                          data-testid="controls-vr-open-center-btn"
                          onClick={() => {
                            onClose();
                            onOpenVRModal();
                          }}
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/50 text-cyan-200 font-bold text-xs cursor-pointer transition-all"
                        >
                          ⚙️ Центр VR и датчики PICO
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-cyan-500/40 bg-cyan-950/30 p-3.5 text-xs text-cyan-100">
                <div className="font-black text-cyan-300 text-sm mb-1">
                  🥽 Куда смотришь — туда и идёшь (PICO 4 / Ultra / Quest WebXR)
                </div>
                <p className="text-cyan-100/85 leading-relaxed">
                  Левый стик всегда двигает вас относительно взгляда шлема. Кнопка <b>[X]</b> на левом контроллере
                  открывает <b>3D Главное меню VR</b> прямо перед глазами (наводите луч и жмите Курок), а кнопка{' '}
                  <b>[Y]</b> или нажатие левого стика <b>(L3)</b> сразу убирает/показывает 3D-памятку кнопок!
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-cyan-500/35 bg-slate-950/80 p-3.5 space-y-2">
                  <div className="text-xs font-black uppercase tracking-wider text-cyan-300">
                    🎮 Левый контроллер (L)
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {[
                      ['Левый стик', 'Ходьба в сторону взгляда шлема'],
                      ['Кнопка [X]', 'Открыть / закрыть 3D Главное меню VR'],
                      ['Кнопка [Y] / L3', 'Скрыть / показать 3D-памятку кнопок на руке'],
                      ['Хват L (Grip L)', 'Мгновенный VR-телепорт по зелёному лучу'],
                      ['Курок L (в меню)', 'Выбор кнопки в 3D Главном меню VR'],
                      ['На запястье', '3D-часы: HP, Монеты, № Двери и таймер Раша'],
                    ].map(([btn, desc]) => (
                      <div key={btn} className="flex items-center justify-between gap-2 rounded-lg bg-slate-900 px-2.5 py-1.5 border border-slate-800">
                        <span className="font-mono font-black text-cyan-300 shrink-0">{btn}</span>
                        <span className="text-slate-200 text-right text-[11px]">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-500/35 bg-slate-950/80 p-3.5 space-y-2">
                  <div className="text-xs font-black uppercase tracking-wider text-amber-300">
                    🎮 Правый контроллер (R)
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {[
                      ['Правый стик', 'Плавный или Snap-поворот камеры (±45°)'],
                      ['Курок R (Trigger)', 'Открыть дверь / Спрятаться в шкаф / Меч / Совок'],
                      ['Кнопка [A]', 'Прыжок (в Obby) / Присяд от Фигуры (в DOORS)'],
                      ['Кнопка [B]', 'VR-телепорт (в Obby) / Фонарик и Скрич (в DOORS)'],
                      ['Хват R (Grip R)', 'Без курка — жест 👍 Эмоция в мультиплеере'],
                      ['Клавиши ПК в VR', 'Q / X = поворот, T = телепорт, V = вкл/выкл VR'],
                    ].map(([btn, desc]) => (
                      <div key={btn} className="flex items-center justify-between gap-2 rounded-lg bg-slate-900 px-2.5 py-1.5 border border-slate-800">
                        <span className="font-mono font-black text-amber-300 shrink-0">{btn}</span>
                        <span className="text-slate-200 text-right text-[11px]">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-3.5 text-xs">
                <div className="font-black text-rose-300 mb-1">⚡ Как выжить при атаке Раша (Rush) в DOORS:</div>
                <div className="text-rose-100/90 leading-relaxed">
                  Когда свет мерцает и звучит гул, за <b>4 секунды</b> появится красный таймер прямо перед глазами в VR
                  и на экране. Подбегите к деревянному шкафу у стены и нажмите <b>Курок R</b> или <b>[E]</b> — внутри шкафа
                  загорится зелёный щит <b>🛡️ БЕЗОПАСНО</b>!
                </div>
              </div>
            </div>
          ) : activeTab === 'mobile' ? (
            /* MOBILE CONTROLS CUSTOMIZATION TAB */
            <div className="space-y-5">
              {/* Ready Presets */}
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                  Быстрые пресеты раскладки:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => applyPreset('standard')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 ${
                      mobileConfig.joystickSide === 'left' && mobileConfig.buttonsSide === 'right'
                        ? 'bg-emerald-500/15 border-emerald-400 text-white shadow-md'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                      🕹️
                    </div>
                    <div>
                      <div className="text-xs font-black text-white">Стандарт (Правша)</div>
                      <div className="text-[11px] text-slate-400">
                        Джойстик слева, Прыжок и Атака справа
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset('reversed')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 ${
                      mobileConfig.joystickSide === 'right' && mobileConfig.buttonsSide === 'left'
                        ? 'bg-amber-500/15 border-amber-400 text-white shadow-md'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
                      🔄
                    </div>
                    <div>
                      <div className="text-xs font-black text-white">Левша (Зеркально)</div>
                      <div className="text-[11px] text-slate-400">
                        Джойстик справа, Прыжок и Атака слева
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Interactive Phone Screen Live Preview */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-bold flex items-center gap-1.5 text-slate-300">
                    <Eye size={14} className="text-emerald-400" />
                    Предпросмотр экрана смартфона:
                  </span>
                  <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">
                    Горизонтальная ориентация
                  </span>
                </div>

                {/* Simulated Screen Box */}
                <div className="relative w-full h-36 sm:h-44 rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-slate-700 overflow-hidden shadow-inner">
                  {/* Subtle 3D Grid floor lines in preview */}
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-sky-950/20 to-transparent pointer-events-none" />

                  {/* Preview Joystick */}
                  <div
                    style={{
                      bottom: `${Math.round(mobileConfig.joystickY * 0.35)}px`,
                      ...(mobileConfig.joystickSide === 'left'
                        ? { left: `${Math.round(mobileConfig.joystickX * 0.45 + 10)}px` }
                        : { right: `${Math.round(mobileConfig.joystickX * 0.45 + 10)}px` }),
                      transform: `scale(${mobileConfig.joystickScale * 0.75})`,
                      opacity: mobileConfig.joystickOpacity,
                    }}
                    className="absolute w-16 h-16 rounded-full bg-slate-800/90 border-2 border-sky-400 flex items-center justify-center shadow-lg transition-all"
                  >
                    <div className="w-7 h-7 rounded-full bg-sky-400/80 shadow border border-white" />
                  </div>

                  {/* Preview Action Buttons */}
                  <div
                    style={{
                      bottom: `${Math.round(mobileConfig.buttonsY * 0.35)}px`,
                      ...(mobileConfig.buttonsSide === 'left'
                        ? { left: `${Math.round(mobileConfig.buttonsX * 0.45 + 10)}px` }
                        : { right: `${Math.round(mobileConfig.buttonsX * 0.45 + 10)}px` }),
                      transform: `scale(${mobileConfig.buttonsScale * 0.75})`,
                      opacity: mobileConfig.joystickOpacity,
                    }}
                    className="absolute flex items-end gap-1.5 transition-all"
                  >
                    <div className="w-9 h-9 rounded-full bg-amber-500/90 border border-amber-200 text-slate-950 flex items-center justify-center shadow">
                      <Sword size={14} />
                    </div>
                    <div
                      style={{ transform: `scale(${mobileConfig.jumpScale || 1.0})` }}
                      className="w-11 h-11 rounded-full bg-emerald-500/90 border-2 border-emerald-200 text-white flex items-center justify-center shadow"
                    >
                      <ArrowUp size={18} strokeWidth={3} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sliders for Joystick */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-sky-400 tracking-wider">
                    🕹️ Настройки Джойстика
                  </h4>
                  <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => updateMobile({ joystickSide: 'left', preset: 'custom' })}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        mobileConfig.joystickSide === 'left'
                          ? 'bg-sky-500 text-slate-950 font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Слева
                    </button>
                    <button
                      type="button"
                      onClick={() => updateMobile({ joystickSide: 'right', preset: 'custom' })}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        mobileConfig.joystickSide === 'right'
                          ? 'bg-sky-500 text-slate-950 font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Справа
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="flex justify-between text-slate-300 font-semibold mb-1">
                      <span>Отступ от края (X):</span>
                      <span className="font-mono text-sky-400 font-bold">{mobileConfig.joystickX} px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="120"
                      step="4"
                      value={mobileConfig.joystickX}
                      onChange={(e) => updateMobile({ joystickX: Number(e.target.value), preset: 'custom' })}
                      className="w-full accent-sky-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 font-semibold mb-1">
                      <span>Высота от низа (Y):</span>
                      <span className="font-mono text-sky-400 font-bold">{mobileConfig.joystickY} px</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="200"
                      step="5"
                      value={mobileConfig.joystickY}
                      onChange={(e) => updateMobile({ joystickY: Number(e.target.value), preset: 'custom' })}
                      className="w-full accent-sky-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 font-semibold mb-1">
                      <span>Размер джойстика:</span>
                      <span className="font-mono text-sky-400 font-bold">
                        {Math.round(mobileConfig.joystickScale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.75"
                      max="1.4"
                      step="0.05"
                      value={mobileConfig.joystickScale}
                      onChange={(e) =>
                        updateMobile({ joystickScale: Number(e.target.value), preset: 'custom' })
                      }
                      className="w-full accent-sky-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 font-semibold mb-1">
                      <span>Прозрачность сенсора:</span>
                      <span className="font-mono text-sky-400 font-bold">
                        {Math.round(mobileConfig.joystickOpacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.35"
                      max="1.0"
                      step="0.05"
                      value={mobileConfig.joystickOpacity}
                      onChange={(e) =>
                        updateMobile({ joystickOpacity: Number(e.target.value), preset: 'custom' })
                      }
                      className="w-full accent-sky-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Sliders for Action Buttons & Jump */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-emerald-400 tracking-wider">
                    🦘 Кнопка Прыжка и Действия
                  </h4>
                  <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => updateMobile({ buttonsSide: 'left', preset: 'custom' })}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        mobileConfig.buttonsSide === 'left'
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Слева
                    </button>
                    <button
                      type="button"
                      onClick={() => updateMobile({ buttonsSide: 'right', preset: 'custom' })}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        mobileConfig.buttonsSide === 'right'
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Справа
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="flex justify-between text-slate-300 font-semibold mb-1">
                      <span>Отступ от края (X):</span>
                      <span className="font-mono text-emerald-400 font-bold">{mobileConfig.buttonsX} px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="120"
                      step="4"
                      value={mobileConfig.buttonsX}
                      onChange={(e) => updateMobile({ buttonsX: Number(e.target.value), preset: 'custom' })}
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 font-semibold mb-1">
                      <span>Высота от низа (Y):</span>
                      <span className="font-mono text-emerald-400 font-bold">{mobileConfig.buttonsY} px</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="200"
                      step="5"
                      value={mobileConfig.buttonsY}
                      onChange={(e) => updateMobile({ buttonsY: Number(e.target.value), preset: 'custom' })}
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 font-semibold mb-1">
                      <span>Размер кнопки Прыжка:</span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {Math.round(mobileConfig.jumpScale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.8"
                      max="1.4"
                      step="0.05"
                      value={mobileConfig.jumpScale}
                      onChange={(e) =>
                        updateMobile({ jumpScale: Number(e.target.value), preset: 'custom' })
                      }
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 font-semibold mb-1">
                      <span>Размер кнопок действий:</span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {Math.round(mobileConfig.buttonsScale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.8"
                      max="1.4"
                      step="0.05"
                      value={mobileConfig.buttonsScale}
                      onChange={(e) =>
                        updateMobile({ buttonsScale: Number(e.target.value), preset: 'custom' })
                      }
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* KEYBOARD TAB */
            <div className="space-y-5">
              {activeBindingField && (
                <div className="p-3 rounded-2xl bg-amber-500/20 border-2 border-amber-400 text-amber-200 text-xs font-bold text-center animate-pulse">
                  🎮 Нажмите любую клавишу на клавиатуре (или ESC для отмены)...
                </div>
              )}

              {sections.map((sec, sIdx) => (
                <div key={sIdx} className="space-y-2.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    {sec.title}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sec.items.map((it) => {
                      const isListening = activeBindingField === it.field;
                      const currentCode = config[it.field];
                      const keyText = formatKeyName(currentCode);

                      return (
                        <div
                          key={it.field}
                          onClick={() => setActiveBindingField(it.field)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                            isListening
                              ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400/50 text-white'
                              : 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-bold block text-white truncate">{it.label}</span>
                            {it.desc && <span className="text-[10px] text-slate-400 truncate block">{it.desc}</span>}
                          </div>
                          <span
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-black min-w-[54px] text-center shrink-0 border ${
                              isListening
                                ? 'bg-amber-400 text-slate-950 border-amber-300 animate-bounce'
                                : 'bg-slate-800 text-amber-300 border-slate-700'
                            }`}
                          >
                            {isListening ? '...' : keyText}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="space-y-2.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  🚪 Горячие клавиши DOORS, VR и Режимов
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { key: 'E / ЛКМ', label: 'Открыть дверь / В шкаф от Раша / Лифт' },
                    { key: 'C / Ctrl', label: 'Присесть / Тихий шаг (против Фигуры на 100)' },
                    { key: 'F', label: 'Фонарик и вспышка от Скрича / Фулскрин' },
                    { key: 'G', label: 'Колесо эмоций и танцев' },
                    { key: 'V', label: 'Вкл / Выкл 6DoF VR режим (PICO / Quest)' },
                    { key: 'H', label: 'Скрыть / Показать панель слотов' },
                  ].map((shortcut) => (
                    <div
                      key={shortcut.key}
                      className="p-2.5 rounded-xl border bg-slate-950/70 border-slate-800 text-slate-300 flex items-center justify-between gap-2"
                    >
                      <span className="text-xs font-bold text-white truncate">{shortcut.label}</span>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-black bg-slate-800 text-cyan-300 border border-slate-700 shrink-0">
                        {shortcut.key}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 pb-safe border-t border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 shrink-0">
          {activeTab !== 'vr' ? (
            <button
              type="button"
              onClick={activeTab === 'mobile' ? handleResetMobile : handleResetKeyboard}
              className="min-h-[42px] flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-colors"
            >
              <RotateCcw size={14} />
              <span>{activeTab === 'mobile' ? 'Сбросить сенсор' : 'Сбросить клавиши'}</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">
              В шлеме PICO 4: [X] = 3D Главное меню VR · [Y] или клик стика L3 = убрать/вернуть 3D-памятку
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer shadow-md transition-colors"
          >
            <Check size={16} />
            <span>Готово</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

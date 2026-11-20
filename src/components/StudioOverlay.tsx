import React, { useState } from 'react';
import {
  Play,
  Square,
  Hammer,
  MousePointer,
  Trash2,
  Move,
  Undo2,
  Redo2,
  RotateCw,
  Copy,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Download,
  Upload,
  Pause,
  Sun,
  Sunset,
  Moon,
  Cpu,
  Check,
  Grid,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Layers,
} from 'lucide-react';
import {
  STUDIO_COLORS,
  STUDIO_PART_PRESETS,
  StudioMaterialKind,
  StudioObjectKind,
  StudioProject,
  StudioRuntimeState,
  StudioToolMode,
} from '../game/studio';

interface StudioOverlayProps {
  studioState: StudioRuntimeState;
  onSetPlayMode: (play: boolean) => void;
  onSetTool: (tool: StudioToolMode) => void;
  onSelectPartPreset: (
    kind: StudioObjectKind,
    defaultSize: [number, number, number],
    defaultColor: string,
    defaultMaterial: StudioMaterialKind
  ) => void;
  onSetColor: (color: string) => void;
  onSetMaterial: (mat: StudioMaterialKind) => void;
  onSetSize: (size: [number, number, number]) => void;
  onRotate: () => void;
  onSetGridSize: (grid: 1 | 2 | 4) => void;
  onSetSkyPreset: (sky: StudioProject['skyPreset']) => void;
  onRenameProject: (name: string) => void;
  onNudgeSelected: (dx: number, dy: number, dz: number) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onLoadTemplate: (tpl: 'empty_baseplate' | 'starter_obby' | 'bounce_tower') => void;
  onExportJson: () => string;
  onImportJson: (json: string) => boolean;
  onPause: () => void;
}

const MATERIAL_OPTIONS: { id: StudioMaterialKind; label: string }[] = [
  { id: 'plastic', label: 'Пластик' },
  { id: 'neon', label: 'Неон' },
  { id: 'glass', label: 'Стекло' },
  { id: 'wood', label: 'Дерево' },
  { id: 'metal', label: 'Металл' },
];

const KIND_ICONS: Record<StudioObjectKind, string> = {
  block: '🧱',
  ramp: '📐',
  lava: '🌋',
  trampoline: '🦘',
  spinner: '🌀',
  checkpoint: '🚩',
  coin: '🪙',
  gem: '💎',
  trophy: '🏆',
  spawn: '🎯',
};

export const StudioOverlay: React.FC<StudioOverlayProps> = ({
  studioState,
  onSetPlayMode,
  onSetTool,
  onSelectPartPreset,
  onSetColor,
  onSetMaterial,
  onSetSize,
  onRotate,
  onSetGridSize,
  onSetSkyPreset,
  onRenameProject,
  onNudgeSelected,
  onDuplicateSelected,
  onDeleteSelected,
  onUndo,
  onRedo,
  onLoadTemplate,
  onExportJson,
  onImportJson,
  onPause,
}) => {
  const [isDockOpen, setIsDockOpen] = useState(true);
  const [dockTab, setDockTab] = useState<'parts' | 'inspector' | 'world'>('parts');
  const [projectNameDraft, setProjectNameDraft] = useState(studioState.projectName);
  const [jsonBuffer, setJsonBuffer] = useState('');
  const [jsonNotice, setJsonNotice] = useState<string | null>(null);

  React.useEffect(() => {
    setProjectNameDraft(studioState.projectName);
  }, [studioState.projectName]);

  const isPlaytest = studioState.mode === 'play';
  const activeColor = studioState.selectedObject?.color ?? studioState.activeColor;
  const activeMaterial = studioState.selectedObject?.material ?? studioState.activeMaterial;
  const activeSize = studioState.selectedObject?.size ?? studioState.activeSize;

  const handleStepSize = (axisIdx: 0 | 1 | 2, delta: number) => {
    const next: [number, number, number] = [...activeSize] as [number, number, number];
    const min = axisIdx === 1 ? 0.5 : 1;
    next[axisIdx] = Math.max(min, Math.min(40, Number((next[axisIdx] + delta).toFixed(1))));
    onSetSize(next);
  };

  const handleCopyJson = async () => {
    const exported = onExportJson();
    setJsonBuffer(exported);
    try {
      await navigator.clipboard?.writeText(exported);
      setJsonNotice('JSON скопирован в буфер!');
    } catch {
      setJsonNotice('JSON выгружен в поле ниже.');
    }
    setTimeout(() => setJsonNotice(null), 2600);
  };

  const handleApplyImport = () => {
    if (!jsonBuffer.trim()) return;
    const ok = onImportJson(jsonBuffer);
    setJsonNotice(ok ? 'Карта успешно загружена!' : 'Ошибка формата JSON.');
    setTimeout(() => setJsonNotice(null), 2600);
  };

  return (
    <div
      data-testid="studio-overlay"
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4"
    >
      {/* TOP BAR */}
      <div
        className={`w-full flex flex-wrap items-center gap-2 pointer-events-none ${
          isPlaytest ? 'justify-center pt-0.5' : 'justify-between'
        }`}
      >
        {/* Left / Center in Playtest: Studio Branding + Mode Playtest Toggle */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-950/95 border border-slate-700/80 rounded-2xl px-2.5 py-1.5 shadow-xl">
          {!isPlaytest && (
            <div className="hidden sm:flex items-center gap-2 pr-2 border-r border-slate-800">
              <span className="text-lg">🛠️</span>
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-black text-white tracking-wide whitespace-nowrap">
                  BLOX СТУДИЯ 3D
                </span>
                <span className="text-[10px] text-slate-400 font-semibold truncate max-w-[140px]">
                  {studioState.projectName} · {studioState.objectCount}/{studioState.maxObjects}
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            data-testid="studio-playtest-btn"
            onClick={() => onSetPlayMode(!isPlaytest)}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap shrink-0 ${
              isPlaytest
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md'
            }`}
          >
            {isPlaytest ? <Square size={14} className="fill-white" /> : <Play size={14} className="fill-slate-950" />}
            <span>{isPlaytest ? 'В редактор' : 'Тест'}</span>
          </button>

          {!isPlaytest && (
            <>
              <div className="h-6 w-px bg-slate-800 mx-0.5 hidden md:block" />

              {/* Tool Switcher */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                {(
                  [
                    { id: 'place', label: 'Ставить', icon: Hammer, testId: 'studio-tool-place' },
                    { id: 'select', label: 'Выбор', icon: MousePointer, testId: 'studio-tool-select' },
                    { id: 'erase', label: 'Удалить', icon: Trash2, testId: 'studio-tool-erase' },
                    { id: 'camera', label: 'Обзор', icon: Move, testId: 'studio-tool-camera' },
                  ] as const
                ).map((t) => {
                  const Icon = t.icon;
                  const active = studioState.tool === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      data-testid={t.testId}
                      onClick={() => onSetTool(t.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? t.id === 'erase'
                            ? 'bg-rose-600 text-white'
                            : 'bg-sky-500 text-slate-950'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <Icon size={13} />
                      <span className="hidden lg:inline">{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Undo / Redo / Rotate */}
              <div className="hidden sm:flex items-center gap-1">
                <button
                  type="button"
                  data-testid="studio-undo-btn"
                  disabled={!studioState.canUndo}
                  onClick={onUndo}
                  title="Отменить (Ctrl+Z)"
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-35 border border-slate-700 text-slate-200 cursor-pointer transition-colors"
                >
                  <Undo2 size={15} />
                </button>
                <button
                  type="button"
                  data-testid="studio-redo-btn"
                  disabled={!studioState.canRedo}
                  onClick={onRedo}
                  title="Повторить (Ctrl+Y)"
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-35 border border-slate-700 text-slate-200 cursor-pointer transition-colors"
                >
                  <Redo2 size={15} />
                </button>
                <button
                  type="button"
                  data-testid="studio-rotate-btn"
                  onClick={onRotate}
                  title="Повернуть на 90° [R]"
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  <RotateCw size={13} />
                  <span>90°</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right: Controls Hint + Pause Button (Hidden during Playtest because GameHUD shows Menu/Pause) */}
        {!isPlaytest && (
          <div className="pointer-events-auto flex items-center gap-2 shrink-0">
            <div className="hidden 2xl:flex items-center gap-2 bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-1.5 text-[11px] text-slate-300 font-medium whitespace-nowrap">
              <span>ЛКМ: действие</span>
              <span className="text-slate-600">·</span>
              <span>ПКМ: крутить камеру</span>
              <span className="text-slate-600">·</span>
              <span>WASD + E/Q: полёт</span>
              <span className="text-slate-600">·</span>
              <span>Колёсико: зум</span>
            </div>

            <button
              type="button"
              onClick={onPause}
              aria-label="Меню паузы"
              className="min-w-[40px] min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-950/95 hover:bg-slate-900 border border-slate-700 text-slate-200 hover:text-white flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-colors shrink-0"
            >
              <Pause size={15} />
              <span className="hidden sm:inline">Меню</span>
            </button>
          </div>
        )}
      </div>

      {/* BOTTOM COLLAPSIBLE DOCK (Hidden in Playtest Mode so HUD takes over) */}
      {!isPlaytest && (
        <div className="w-full max-w-5xl mx-auto pointer-events-auto flex flex-col items-center">
          {/* Collapse / Tab Handle Row */}
          <div className="flex items-center gap-1.5 bg-slate-950/95 border border-b-0 border-slate-700/80 rounded-t-2xl px-2.5 pt-1.5 pb-1 shadow-lg">
            {(
              [
                { id: 'parts', label: 'Предметы' },
                { id: 'inspector', label: studioState.selectedObject ? 'Выделенный блок' : 'Свойства кисти' },
                { id: 'world', label: 'Мир и JSON' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setDockTab(tab.id);
                  setIsDockOpen(true);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  dockTab === tab.id && isDockOpen
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}

            <button
              type="button"
              data-testid="studio-dock-toggle"
              onClick={() => setIsDockOpen((v) => !v)}
              className="ml-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              {isDockOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              <span>{isDockOpen ? 'Скрыть' : 'Панель'}</span>
            </button>
          </div>

          {isDockOpen && (
            <div className="w-full bg-slate-950/95 border border-slate-700/80 rounded-2xl p-3 shadow-2xl">
              {dockTab === 'parts' && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-400">
                      Нажмите на объект, затем кликните по 3D-поверхности для размещения
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Grid size={13} className="text-sky-400" />
                      <span className="text-[11px] font-bold text-slate-300">Сетка:</span>
                      {([1, 2, 4] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => onSetGridSize(g)}
                          className={`px-2 py-0.5 rounded text-[11px] font-black cursor-pointer transition-colors ${
                            studioState.gridSize === g
                              ? 'bg-sky-500 text-slate-950'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {g}s
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-11 gap-1.5">
                    {STUDIO_PART_PRESETS.map((preset, idx) => {
                      const isActive =
                        studioState.tool === 'place' &&
                        studioState.activeKind === preset.kind &&
                        studioState.activeSize[0] === preset.defaultSize[0] &&
                        studioState.activeSize[2] === preset.defaultSize[2];
                      return (
                        <button
                          key={`${preset.kind}_${idx}`}
                          type="button"
                          data-testid={`studio-preset-${preset.kind}-${idx}`}
                          onClick={() =>
                            onSelectPartPreset(
                              preset.kind,
                              preset.defaultSize,
                              preset.defaultColor,
                              preset.defaultMaterial
                            )
                          }
                          title={preset.description}
                          className={`p-2 rounded-xl border text-left flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                            isActive
                              ? 'bg-sky-500/20 border-sky-400 text-white shadow'
                              : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-base">{KIND_ICONS[preset.kind]}</span>
                            <span
                              className="w-2.5 h-2.5 rounded-sm border border-white/30"
                              style={{ backgroundColor: preset.defaultColor }}
                            />
                          </div>
                          <span className="text-[10px] font-extrabold text-center leading-tight truncate w-full">
                            {preset.shortTitle}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {dockTab === 'inspector' && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                  {/* Colors */}
                  <div className="md:col-span-4 flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-slate-400">
                      Цвет {studioState.selectedObject ? '(выбранного)' : '(кисти)'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {STUDIO_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => onSetColor(c.hex)}
                          title={c.name}
                          className={`w-6 h-6 rounded-lg border-2 cursor-pointer transition-transform ${
                            activeColor.toLowerCase() === c.hex.toLowerCase()
                              ? 'border-white scale-110'
                              : 'border-slate-700 hover:scale-105'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Materials */}
                  <div className="md:col-span-4 flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-slate-400">Материал</span>
                    <div className="flex flex-wrap gap-1">
                      {MATERIAL_OPTIONS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onSetMaterial(m.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                            activeMaterial === m.id
                              ? 'bg-sky-500 text-slate-950'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dimensions + Selected Object Actions */}
                  <div className="md:col-span-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-400">
                        Размер W×H×D
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-white">
                        {(['W', 'H', 'D'] as const).map((label, idx) => (
                          <div
                            key={label}
                            className="flex items-center gap-0.5 bg-slate-900 border border-slate-800 rounded-lg px-1 py-0.5"
                          >
                            <button
                              type="button"
                              onClick={() => handleStepSize(idx as 0 | 1 | 2, idx === 1 ? -0.5 : -1)}
                              className="px-1 text-slate-400 hover:text-white cursor-pointer"
                            >
                              -
                            </button>
                            <span className="min-w-[26px] text-center font-bold">
                              {label}:{activeSize[idx]}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStepSize(idx as 0 | 1 | 2, idx === 1 ? 0.5 : 1)}
                              className="px-1 text-slate-400 hover:text-white cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {studioState.selectedObject ? (
                      <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1 border-t border-slate-800">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onNudgeSelected(-studioState.gridSize, 0, 0)}
                            title="Сдвиг -X"
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 cursor-pointer"
                          >
                            <ArrowLeft size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onNudgeSelected(studioState.gridSize, 0, 0)}
                            title="Сдвиг +X"
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 cursor-pointer"
                          >
                            <ArrowRight size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onNudgeSelected(0, 1, 0)}
                            title="Поднять +Y"
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-emerald-300 cursor-pointer"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onNudgeSelected(0, -1, 0)}
                            title="Опустить -Y"
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-300 cursor-pointer"
                          >
                            <ArrowDown size={13} />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={onDuplicateSelected}
                            className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Copy size={12} />
                            <span>Дубль</span>
                          </button>
                          <button
                            type="button"
                            onClick={onDeleteSelected}
                            className="px-2 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={12} />
                            <span>Удал.</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500">
                        Выберите любой блок на карте инструментом «Выбор», чтобы сдвигать или дублировать его.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {dockTab === 'world' && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                  {/* Sky & Project Name */}
                  <div className="md:col-span-4 flex flex-col gap-2">
                    <span className="text-[11px] font-bold text-slate-400">Название и Небо</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={projectNameDraft}
                        maxLength={40}
                        onChange={(e) => setProjectNameDraft(e.target.value)}
                        onBlur={() => onRenameProject(projectNameDraft)}
                        className="flex-1 min-w-0 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white outline-none focus:border-sky-400"
                      />
                      <button
                        type="button"
                        onClick={() => onRenameProject(projectNameDraft)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold cursor-pointer shrink-0"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {(
                        [
                          { id: 'day', label: 'День', icon: Sun },
                          { id: 'sunset', label: 'Закат', icon: Sunset },
                          { id: 'night', label: 'Ночь', icon: Moon },
                          { id: 'cyber', label: 'Кибер', icon: Cpu },
                        ] as const
                      ).map((sky) => {
                        const Icon = sky.icon;
                        const active = studioState.skyPreset === sky.id;
                        return (
                          <button
                            key={sky.id}
                            type="button"
                            onClick={() => onSetSkyPreset(sky.id)}
                            className={`py-1.5 px-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                              active
                                ? 'bg-sky-500 text-slate-950'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                            }`}
                          >
                            <Icon size={12} />
                            <span>{sky.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Starter Templates */}
                  <div className="md:col-span-4 flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                      <Layers size={12} className="text-amber-400" />
                      <span>Готовые шаблоны карт</span>
                    </span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {(
                        [
                          { id: 'starter_obby', label: '🏃 Мой Первый Паркур', testId: 'studio-tpl-obby' },
                          { id: 'bounce_tower', label: '🦘 Башня Прыжков', testId: 'studio-tpl-tower' },
                          { id: 'empty_baseplate', label: '🟦 Чистая База (Только Спавн)', testId: 'studio-tpl-empty' },
                        ] as const
                      ).map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          data-testid={tpl.testId}
                          onClick={() => onLoadTemplate(tpl.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left text-xs font-bold text-slate-200 cursor-pointer transition-colors flex items-center justify-between"
                        >
                          <span className="truncate">{tpl.label}</span>
                          <Sparkles size={12} className="text-amber-400 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* JSON Export / Import */}
                  <div className="md:col-span-4 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400">Экспорт / Импорт JSON</span>
                      {jsonNotice && <span className="text-[10px] font-bold text-emerald-400">{jsonNotice}</span>}
                    </div>
                    <textarea
                      value={jsonBuffer}
                      onChange={(e) => setJsonBuffer(e.target.value)}
                      rows={2}
                      placeholder="Нажмите «Экспорт» или вставьте JSON карты..."
                      className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-200 outline-none focus:border-sky-400 resize-none"
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleCopyJson}
                        className="flex-1 py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Download size={12} />
                        <span>Экспорт</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyImport}
                        className="flex-1 py-1 px-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Upload size={12} />
                        <span>Импорт</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

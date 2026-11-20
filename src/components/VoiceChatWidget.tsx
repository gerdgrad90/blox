import React from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  Volume2,
  VolumeX,
  PhoneOff,
  Radio,
  Globe,
  MapPin,
  Users,
  X,
  SlidersHorizontal,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type {
  VoiceChatSnapshot,
  VoiceInputMode,
  VoiceSpatialMode,
} from '../game/types';

interface VoiceChatWidgetProps {
  voiceState: VoiceChatSnapshot;
  isPanelOpen: boolean;
  onTogglePanel: () => void;
  onClosePanel: () => void;
  onJoinVoice: () => void;
  onLeaveVoice: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onSetInputMode: (mode: VoiceInputMode) => void;
  onSetPttActive: (active: boolean) => void;
  onSetSpatialMode: (mode: VoiceSpatialMode) => void;
  onSetMasterVolume: (volume: number) => void;
  onSetPeerVolume: (peerId: string, volume: number) => void;
  onTogglePeerMute: (peerId: string) => void;
}

export const VoiceChatWidget: React.FC<VoiceChatWidgetProps> = ({
  voiceState,
  isPanelOpen,
  onTogglePanel,
  onClosePanel,
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
  onToggleDeafen,
  onSetInputMode,
  onSetPttActive,
  onSetSpatialMode,
  onSetMasterVolume,
  onSetPeerVolume,
  onTogglePeerMute,
}) => {
  const effectiveMuted =
    voiceState.listenOnly ||
    voiceState.deafened ||
    voiceState.muted ||
    (voiceState.inputMode === 'ptt' && !voiceState.pttActive);

  const activeCount = voiceState.participants.length;

  return (
    <div className="relative flex items-center" data-testid="voice-chat-widget">
      {!voiceState.connected ? (
        <button
          type="button"
          data-testid="voice-join-btn"
          onClick={onJoinVoice}
          disabled={voiceState.connecting}
          title="Подключиться к голосовому чату комнаты"
          className={`min-h-[42px] min-w-[42px] flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border shadow-lg cursor-pointer transition-all ${
            voiceState.connecting
              ? 'bg-emerald-500/30 border-emerald-400/70 text-emerald-200'
              : 'bg-slate-900/90 hover:bg-slate-800 border-emerald-500/50 text-emerald-300 font-bold'
          }`}
        >
          {voiceState.connecting ? (
            <Loader2 size={17} className="animate-spin text-emerald-300 shrink-0" />
          ) : (
            <Mic size={17} className="text-emerald-400 shrink-0" />
          )}
          <span className="hidden sm:inline text-xs sm:text-sm">
            {voiceState.connecting ? 'Войс...' : 'Войс'}
          </span>
          {voiceState.remoteVoiceCount > 0 && !voiceState.connecting && (
            <span
              data-testid="voice-remote-count-badge"
              className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-md bg-emerald-500 text-slate-950 font-black text-[10px] font-mono-numbers"
            >
              {voiceState.remoteVoiceCount}
            </span>
          )}
        </button>
      ) : (
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950/95 border border-emerald-500/60 shadow-[0_0_18px_rgba(16,185,129,0.2)]">
          {/* Mic Mute / PTT Indicator */}
          <button
            type="button"
            data-testid="voice-mic-toggle"
            onClick={onToggleMute}
            title={
              voiceState.listenOnly
                ? 'Режим прослушивания (нет доступа к микрофону)'
                : voiceState.inputMode === 'ptt'
                ? 'Режим рации: зажмите [T] чтобы говорить'
                : effectiveMuted
                ? 'Включить микрофон [M]'
                : 'Выключить микрофон [M]'
            }
            className={`relative min-h-[34px] min-w-[34px] px-2 flex items-center justify-center gap-1 rounded-lg border transition-all cursor-pointer ${
              voiceState.speaking
                ? 'bg-emerald-500 border-emerald-300 text-slate-950 shadow-[0_0_14px_rgba(16,185,129,0.75)]'
                : voiceState.listenOnly || voiceState.muted || voiceState.deafened
                ? 'bg-rose-600/90 hover:bg-rose-500 border-rose-400/80 text-white'
                : voiceState.inputMode === 'ptt'
                ? voiceState.pttActive
                  ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/60 text-amber-300'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/60 text-emerald-300'
            }`}
          >
            {voiceState.listenOnly || voiceState.muted || voiceState.deafened ? (
              <MicOff size={16} />
            ) : voiceState.inputMode === 'ptt' ? (
              <Radio size={16} />
            ) : (
              <Mic size={16} />
            )}
            {voiceState.inputMode === 'ptt' && !voiceState.listenOnly && !voiceState.muted && (
              <span className="hidden md:inline text-[10px] font-black tracking-wide">[T]</span>
            )}
            {voiceState.speaking && (
              <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
            )}
          </button>

          {/* Deafen Toggle */}
          <button
            type="button"
            data-testid="voice-deafen-toggle"
            onClick={onToggleDeafen}
            title={voiceState.deafened ? 'Включить звук голосов' : 'Отключить звук всех голосов'}
            className={`min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
              voiceState.deafened
                ? 'bg-rose-600/90 hover:bg-rose-500 border-rose-400/80 text-white'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            {voiceState.deafened ? <VolumeX size={16} /> : <Headphones size={16} />}
          </button>

          {/* Voice Settings / Participants Popover Toggle */}
          <button
            type="button"
            data-testid="voice-panel-toggle"
            onClick={onTogglePanel}
            title="Настройки и участники войс-чата"
            className={`min-h-[34px] px-2 flex items-center justify-center gap-1 rounded-lg border transition-all cursor-pointer ${
              isPanelOpen
                ? 'bg-sky-500 border-sky-300 text-slate-950 font-black'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-emerald-300 font-bold'
            }`}
          >
            <SlidersHorizontal size={14} />
            <span className="text-xs font-mono-numbers">{activeCount}</span>
          </button>
        </div>
      )}

      {/* Expandable Voice Chat Popover */}
      <AnimatePresence>
        {voiceState.connected && isPanelOpen && (
          <motion.div
            data-testid="voice-chat-panel"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className="fixed sm:absolute top-16 sm:top-full right-2 sm:right-0 sm:mt-2 w-[calc(100vw-1rem)] max-w-[340px] rounded-2xl bg-slate-950/95 backdrop-blur-md border border-slate-700/80 shadow-2xl p-3.5 text-slate-100 z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
                  <Mic size={16} className="text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-white leading-tight truncate">
                    Войс-чат комнаты
                  </div>
                  <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>
                      {voiceState.listenOnly
                        ? 'Режим прослушивания'
                        : voiceState.deafened
                        ? 'Звук отключён'
                        : 'WebRTC P2P активен'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClosePanel}
                aria-label="Закрыть панель войс-чата"
                className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Inline status / permission notice */}
            {voiceState.statusMessage && (
              <div
                data-testid="voice-status-message"
                className="mt-2.5 px-2.5 py-2 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-[11px] font-semibold leading-snug"
              >
                {voiceState.statusMessage}
              </div>
            )}

            {/* Live Microphone Meter */}
            {!voiceState.listenOnly && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                  <span>Уровень микрофона</span>
                  <span className={voiceState.speaking ? 'text-emerald-400' : 'text-slate-400'}>
                    {effectiveMuted
                      ? voiceState.inputMode === 'ptt' && !voiceState.muted && !voiceState.deafened
                        ? 'Зажмите [T]'
                        : 'Выключен'
                      : voiceState.speaking
                      ? 'Вы говорите'
                      : 'Тишина'}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700/80">
                  <div
                    className={`h-full transition-all duration-75 ${
                      voiceState.speaking
                        ? 'bg-gradient-to-r from-emerald-400 to-lime-300'
                        : 'bg-sky-500/70'
                    }`}
                    style={{
                      width: `${Math.min(100, Math.round(voiceState.localLevel * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Input Mode: Open Mic vs Push-to-Talk */}
            <div className="mt-3">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                Режим микрофона
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  data-testid="voice-mode-open"
                  onClick={() => onSetInputMode('open')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    voiceState.inputMode === 'open'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <Mic size={13} />
                  <span>Открытый</span>
                </button>
                <button
                  type="button"
                  data-testid="voice-mode-ptt"
                  onClick={() => onSetInputMode('ptt')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    voiceState.inputMode === 'ptt'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <Radio size={13} />
                  <span>Рация [T]</span>
                </button>
              </div>

              {voiceState.inputMode === 'ptt' && !voiceState.listenOnly && (
                <button
                  type="button"
                  data-testid="voice-ptt-hold-btn"
                  onPointerDown={() => onSetPttActive(true)}
                  onPointerUp={() => onSetPttActive(false)}
                  onPointerLeave={() => onSetPttActive(false)}
                  onPointerCancel={() => onSetPttActive(false)}
                  className={`mt-1.5 w-full py-2 rounded-xl text-xs font-black border transition-all cursor-pointer select-none ${
                    voiceState.pttActive
                      ? 'bg-emerald-500 border-emerald-300 text-slate-950 shadow-[0_0_16px_rgba(16,185,129,0.5)]'
                      : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/60 text-amber-200'
                  }`}
                >
                  {voiceState.pttActive
                    ? '🎙️ ИДЁТ ПЕРЕДАЧА ГОЛОСА...'
                    : '🎙️ Удерживайте кнопку или [T] чтобы говорить'}
                </button>
              )}
            </div>

            {/* Spatial Range Mode: Room vs 3D Proximity */}
            <div className="mt-3">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                Дальность слышимости
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  data-testid="voice-spatial-room"
                  onClick={() => onSetSpatialMode('room')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    voiceState.spatialMode === 'room'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <Globe size={13} />
                  <span>Вся комната</span>
                </button>
                <button
                  type="button"
                  data-testid="voice-spatial-proximity"
                  onClick={() => onSetSpatialMode('proximity')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    voiceState.spatialMode === 'proximity'
                      ? 'bg-purple-500/20 border-purple-400 text-purple-200'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <MapPin size={13} />
                  <span>3D Близость</span>
                </button>
              </div>
            </div>

            {/* Master Volume */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-1">
                <span className="flex items-center gap-1.5">
                  <Volume2 size={13} className="text-sky-400" />
                  Громкость голосов
                </span>
                <span className="font-mono-numbers text-sky-300">
                  {Math.round(voiceState.masterVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                data-testid="voice-master-volume"
                min={0}
                max={100}
                value={Math.round(voiceState.masterVolume * 100)}
                onChange={(e) => onSetMasterVolume(Number(e.target.value) / 100)}
                className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Participants */}
            <div className="mt-3 pt-2.5 border-t border-slate-800">
              <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                <span className="flex items-center gap-1">
                  <Users size={12} />
                  Участники в войсе ({voiceState.participants.length})
                </span>
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                {voiceState.participants.map((p) => (
                  <div
                    key={p.id}
                    className={`p-2 rounded-xl border transition-colors ${
                      p.speaking
                        ? 'bg-emerald-500/15 border-emerald-400/60'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            p.speaking
                              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                              : p.muted || p.locallyMuted
                              ? 'bg-rose-500'
                              : 'bg-slate-500'
                          }`}
                        />
                        <span className="text-xs font-bold text-white truncate">
                          {p.name}
                        </span>
                        {p.isSelf && (
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[9px] font-black uppercase">
                            Вы
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!p.isSelf && voiceState.spatialMode === 'proximity' && p.distanceMeters !== null && (
                          <span className="text-[10px] font-mono-numbers font-bold text-purple-300">
                            {p.distanceMeters}м
                          </span>
                        )}
                        {!p.isSelf && (
                          <span
                            className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                              p.connectionState === 'connected'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {p.connectionState === 'connected' ? 'P2P' : '...'}
                          </span>
                        )}
                        {p.muted && <MicOff size={12} className="text-rose-400" />}
                        {!p.isSelf && (
                          <button
                            type="button"
                            onClick={() => onTogglePeerMute(p.id)}
                            title={p.locallyMuted ? 'Размутить игрока' : 'Замутить игрока'}
                            className={`w-6 h-6 rounded-lg border flex items-center justify-center cursor-pointer ${
                              p.locallyMuted
                                ? 'bg-rose-500/25 border-rose-400 text-rose-300'
                                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                            }`}
                          >
                            {p.locallyMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {!p.isSelf && !p.locallyMuted && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={150}
                          value={Math.round(p.volume * 100)}
                          onChange={(e) => onSetPeerVolume(p.id, Number(e.target.value) / 100)}
                          className="w-full accent-sky-400 cursor-pointer h-1 bg-slate-800 rounded-lg"
                        />
                        <span className="text-[10px] font-mono-numbers text-slate-400 w-8 text-right">
                          {Math.round(p.volume * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                {voiceState.participants.length <= 1 && (
                  <div className="text-[11px] text-slate-400 leading-snug bg-slate-900/60 border border-slate-800/80 rounded-xl px-2.5 py-2">
                    Вы в голосовом канале комнаты. Другие игроки смогут говорить с вами, когда нажмут «Войс».
                  </div>
                )}
              </div>
            </div>

            {/* Disconnect Button */}
            <button
              type="button"
              data-testid="voice-leave-btn"
              onClick={() => {
                onClosePanel();
                onLeaveVoice();
              }}
              className="mt-3 w-full py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 border border-rose-400/60 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg cursor-pointer transition-all"
            >
              <PhoneOff size={14} />
              <span>Отключиться от войса</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface VoiceActiveSpeakersOverlayProps {
  voiceState: VoiceChatSnapshot;
}

export const VoiceActiveSpeakersOverlay: React.FC<VoiceActiveSpeakersOverlayProps> = ({
  voiceState,
}) => {
  const activeSpeakers = voiceState.participants.filter((p) => p.speaking && !p.locallyMuted);
  if (!voiceState.connected || activeSpeakers.length === 0) return null;

  return (
    <div
      data-testid="voice-active-speakers"
      className="flex flex-col gap-1 pointer-events-none mt-1"
    >
      {activeSpeakers.slice(0, 4).map((sp) => (
        <div
          key={sp.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/90 border border-emerald-400/70 text-emerald-200 text-[11px] font-bold shadow-lg w-fit"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <Mic size={12} className="text-emerald-300 shrink-0" />
          <span className="truncate max-w-[140px]">{sp.name}</span>
          {!sp.isSelf && voiceState.spatialMode === 'proximity' && sp.distanceMeters !== null && (
            <span className="text-[10px] font-mono-numbers text-emerald-300/80">
              {sp.distanceMeters}м
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { GameEngine } from './game/engine';
import {
  CharacterSkin,
  GameState,
  PlayerStats,
  ToolType,
  Checkpoint,
  MultiplayerSessionConfig,
  RemotePlayerInfo,
} from './game/types';
import { MultiplayerClient } from './game/network';
import { sound } from './game/audio';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD } from './components/GameHUD';
import { CustomizerModal } from './components/CustomizerModal';
import { PauseModal } from './components/PauseModal';
import { VictoryModal } from './components/VictoryModal';
import { FeedbackModal } from './components/FeedbackModal';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const networkRef = useRef<MultiplayerClient | null>(null);
  const manualTouchOverride = useRef<boolean>(false);

  // Game state machine
  const [gameState, setGameState] = useState<GameState>('title');
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
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

  // Multiplayer Session Configuration (Online vs LAN Room vs Local 2P Co-op)
  const [sessionConfig, setSessionConfig] = useState<MultiplayerSessionConfig>({
    mode: 'online',
    roomId: 'public_obby',
  });
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayerInfo[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Player Skin — Default to the user's custom Roblox skin (Rocker Jacket + Red Visor Hair + FUEL Jetpack)
  const [skin, setSkin] = useState<CharacterSkin>(() => {
    try {
      const saved = localStorage.getItem('blox_character_skin');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name) return parsed;
      }
    } catch {}
    const savedName = typeof window !== 'undefined' ? localStorage.getItem('blox_player_name') : null;
    const num = Math.floor(10 + Math.random() * 89);
    return {
      skinColor: '#e5c298',
      torsoColor: '#141619',
      legsColor: '#18181b',
      hat: 'rocker_hair',
      face: 'squiggly',
      outfit: 'rock_jacket',
      shirt: 'rock_jacket',
      pants: 'rock_jeans',
      backpack: 'fuel_jetpack',
      name: savedName || `RockBlox_${num}`,
    };
  });

  // Hotbar & Building
  const [activeTool, setActiveTool] = useState<ToolType>('sword');
  const [selectedColor, setSelectedColor] = useState<string>('#ef4444');

  // Stats
  const [stats, setStats] = useState<PlayerStats>({
    hp: 100,
    maxHp: 100,
    coins: 0,
    gems: 0,
    currentCheckpoint: 0,
    totalCheckpoints: 6,
    jumps: 0,
    deaths: 0,
    startTime: Date.now(),
    completionTime: 0,
  });

  // Chat Feed
  const [chatMessages, setChatMessages] = useState<{ id: string; text: string; author?: string }[]>([
    { id: '1', text: 'Добро пожаловать в Blox World 3D! Выберите игру По сети или По локалке.', author: 'Система' },
  ]);

  // Sync dataset.state with document.body
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  const addChatMessage = useCallback((text: string, author?: string) => {
    setChatMessages((prev) => [...prev.slice(-15), { id: String(Date.now() + Math.random()), text, author }]);
  }, []);

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

  // Initialize Engine & MultiplayerClient once
  useEffect(() => {
    if (!mountRef.current) return;

    const netClient = new MultiplayerClient(skin, {
      onConnectionStatus: (connected) => {
        setIsConnected(connected);
      },
      onInitRoom: (data) => {
        setRemotePlayers(data.players);
        if (engineRef.current) {
          engineRef.current.clearRemotePlayers();
          for (const p of data.players) {
            engineRef.current.upsertRemotePlayer(p);
          }
          for (const b of data.blocks) {
            engineRef.current.applyRemoteBlockPlace(b.key, b.position, b.color);
          }
        }
      },
      onPlayerJoined: (player) => {
        setRemotePlayers((prev) => {
          const filtered = prev.filter((p) => p.id !== player.id);
          return [...filtered, player];
        });
        engineRef.current?.upsertRemotePlayer(player);
        addChatMessage(`${player.skin.name} подключился к игре!`, 'Сервер');
      },
      onPlayerUpdated: (update) => {
        engineRef.current?.updateRemotePlayer(update);
        setRemotePlayers((prev) =>
          prev.map((p) =>
            p.id === update.id
              ? {
                  ...p,
                  position: update.position ?? p.position,
                  rotationY: update.rotationY ?? p.rotationY,
                  isMoving: update.isMoving ?? p.isMoving,
                  isGrounded: update.isGrounded ?? p.isGrounded,
                  activeTool: update.activeTool ?? p.activeTool,
                  checkpoint: update.checkpoint ?? p.checkpoint,
                  coins: update.coins ?? p.coins,
                }
              : p
          )
        );
      },
      onPlayerSkinUpdated: (id, newSkin) => {
        engineRef.current?.updateRemotePlayerSkin(id, newSkin);
        setRemotePlayers((prev) =>
          prev.map((p) => (p.id === id ? { ...p, skin: newSkin } : p))
        );
      },
      onPlayerAttacked: (id) => {
        engineRef.current?.triggerRemotePlayerAttack(id);
      },
      onPlayerLeft: (id, name) => {
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
      onChatMessage: (msg) => {
        addChatMessage(msg.text, msg.author);
      },
    });

    networkRef.current = netClient;

    const engine = new GameEngine(mountRef.current, skin, {
      onStatsUpdate: (newStats) => {
        setStats(newStats);
      },
      onCheckpointReached: (cp: Checkpoint) => {
        addChatMessage(`Чекпоинт "${cp.name}" активирован!`, 'Чекпоинт');
      },
      onChatMessage: (msg: string, author?: string) => {
        addChatMessage(msg, author);
      },
      onVictory: (finalStats: PlayerStats) => {
        setGameState('victory');
        setStats(finalStats);
      },
      onToolChanged: (tool: ToolType) => {
        setActiveTool(tool);
      },
      onLocalMove: (state) => {
        networkRef.current?.sendMoveUpdate(state);
      },
      onLocalAttack: () => {
        networkRef.current?.sendAttack();
      },
      onLocalBlockPlace: (key, position, color) => {
        networkRef.current?.sendBlockPlace(key, position, color);
      },
      onLocalBlockRemove: (key) => {
        networkRef.current?.sendBlockRemove(key);
      },
    });

    engineRef.current = engine;

    // Connect initially to Online mode so live player count is visible in the Roblox menu
    netClient.connectToRoom('public_obby', 'online', skin);

    // Check ?autostart=1 in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setGameState('playing');
    }

    return () => {
      netClient.dispose();
      networkRef.current = null;
      engine.dispose();
      engineRef.current = null;
    };
  }, []); // Run once

  // Keyboard shortcut listener for Pause (Escape / P) and Fullscreen (F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (gameState === 'playing') {
          setGameState('paused');
        } else if (gameState === 'paused') {
          setGameState('playing');
        }
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        handleToggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, handleToggleFullscreen]);

  const applyMultiplayerSession = useCallback(
    (config: MultiplayerSessionConfig) => {
      const targetGameId = config.gameId || 'obby';
      const normalizedConfig: MultiplayerSessionConfig = {
        ...config,
        gameId: targetGameId,
      };
      setSessionConfig(normalizedConfig);
      if (!engineRef.current || !networkRef.current) return;

      engineRef.current.loadGameWorld(targetGameId);

      if (normalizedConfig.mode === 'local_coop') {
        engineRef.current.clearRemotePlayers();
        setRemotePlayers([]);
        engineRef.current.setLocalCoopMode(true);
      } else {
        engineRef.current.setLocalCoopMode(false);
        engineRef.current.clearRemotePlayers();
        setRemotePlayers([]);
        const roomChannel =
          normalizedConfig.mode === 'online'
            ? `${targetGameId}-main`
            : `${targetGameId}-${normalizedConfig.roomId}`;
        networkRef.current.connectToRoom(roomChannel, normalizedConfig.mode, skin);
      }
    },
    [skin]
  );

  const startGame = useCallback(
    (config: MultiplayerSessionConfig = sessionConfig) => {
      applyMultiplayerSession(config);
      setGameState('playing');
      if (engineRef.current) {
        engineRef.current.stats.startTime = Date.now();
        engineRef.current.stats.completionTime = 0;
      }
      const gameLabel =
        config.gameId === 'lava_survival'
          ? '🌋 Пол — это Лава! Выживание 3D'
          : '🏃 Паркур: Blox Obby 3D';
      if (config.mode === 'online') {
        addChatMessage(`Вы вошли в игру «${gameLabel}» (Онлайн)! Откройте 🎒 Рюкзак [B] для Джетпака и Колы!`, 'Сервер');
      } else if (config.mode === 'lan_room') {
        addChatMessage(`Игра «${gameLabel}» — локальная комната [${config.roomId}]! 🏠`, 'Локалка');
      } else {
        addChatMessage(`Игра «${gameLabel}» — 2 Игрока на 1 ПК: Игрок 1 (WASD+Пробел), Игрок 2 (Стрелки+Enter)! 🎮`, 'Локалка');
      }
    },
    [applyMultiplayerSession, sessionConfig, addChatMessage]
  );

  const handlePause = () => {
    setGameState('paused');
  };

  const handleResume = () => {
    setGameState('playing');
  };

  const handleRestart = () => {
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

  const handleReturnToTitle = () => {
    setGameState('title');
  };

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

  const handleSaveSkin = (newSkin: CharacterSkin) => {
    setSkin(newSkin);
    try {
      localStorage.setItem('blox_character_skin', JSON.stringify(newSkin));
      localStorage.setItem('blox_player_name', newSkin.name);
    } catch {}
    if (engineRef.current) {
      engineRef.current.updateSkin(newSkin);
    }
    networkRef.current?.sendSkinUpdate(newSkin);
    addChatMessage(`Скин обновлен на "${newSkin.name}"!`, 'Гардероб');
  };

  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
    addChatMessage(muted ? 'Звук выключен 🔇' : 'Звук включен 🔊');
  };

  const handleSendChatMessage = (msg: string) => {
    addChatMessage(msg, skin.name);
    networkRef.current?.sendChatMessage(msg, skin.name);
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
        className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing"
      />

      {/* Screen Views based on Game State */}
      {gameState === 'title' && (
        <TitleScreen
          onStartGame={startGame}
          onOpenCustomizer={() => setIsCustomizerOpen(true)}
          skin={skin}
          onChangeSkin={handleSaveSkin}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          sessionConfig={sessionConfig}
          onChangeSessionConfig={applyMultiplayerSession}
          onlineCount={onlineCount}
          isConnected={isConnected}
          onOpenFeedback={() => setIsFeedbackOpen(true)}
        />
      )}

      {(gameState === 'playing' || gameState === 'paused') && (
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
        />
      )}

      {/* Animated Modals (Pause, Victory, Wardrobe Customizer) */}
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
            onSave={handleSaveSkin}
            onClose={() => setIsCustomizerOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFeedbackOpen && (
          <FeedbackModal
            key="feedback-modal"
            onClose={() => setIsFeedbackOpen(false)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/GameEngine';
import { LEVELS } from './game/levels';
import type { FreeCamGesture, GameHudSnapshot } from './game/types';
import { TitleOverlay } from './components/TitleOverlay';
import { HudOverlay } from './components/HudOverlay';
import { ModalOverlay } from './components/ModalOverlay';

const INITIAL_HUD: GameHudSnapshot = {
  phase: 'title',
  levelIndex: 0,
  levelCount: LEVELS.length,
  levelName: LEVELS[0].name,
  levelSubtitle: LEVELS[0].subtitle,
  score: 0,
  bestScore: 0,
  stars: 0,
  starThresholds: LEVELS[0].starThresholds,
  pigsRemaining: LEVELS[0].pigs.length,
  pigsTotal: LEVELS[0].pigs.length,
  birdQueue: [...LEVELS[0].birds],
  activeBird: LEVELS[0].birds[0],
  abilityReady: false,
  abilityUsed: false,
  cameraMode: 'aim',
  freeCamGesture: 'orbit',
  isPulling: false,
  pullPower: 0,
  pullAngleDeg: 0,
  muted: false,
  unusedBirdBonus: 0,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<GameHudSnapshot>(INITIAL_HUD);
  const [selectedTitleLevel, setSelectedTitleLevel] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleToggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const syncFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        handleToggleFullscreen();
      }
    };
    document.addEventListener('fullscreenchange', syncFs);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', syncFs);
      window.removeEventListener('keydown', onKey);
    };
  }, [handleToggleFullscreen]);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart') === '1';

    const engine = new GameEngine(
      mount,
      (snapshot) => {
        setHud(snapshot);
      },
      autostart,
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleSelectTitleLevel = useCallback((idx: number) => {
    setSelectedTitleLevel(idx);
    engineRef.current?.loadLevel(idx, 'title');
  }, []);

  const handleStart = useCallback((idx: number) => {
    engineRef.current?.startGame(idx);
  }, []);

  const handleToggleCamera = useCallback(() => {
    engineRef.current?.toggleCameraMode();
  }, []);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
  }, []);

  const handleRestart = useCallback(() => {
    engineRef.current?.restartLevel();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.setPhase('playing');
  }, []);

  const handleNextLevel = useCallback(() => {
    engineRef.current?.nextLevel();
  }, []);

  const handleTitle = useCallback(() => {
    engineRef.current?.loadLevel(selectedTitleLevel, 'title');
  }, [selectedTitleLevel]);

  const handleTriggerAbility = useCallback(() => {
    engineRef.current?.activateCurrentBirdAbility();
  }, []);

  const handleSetFreeCamGesture = useCallback((gesture: FreeCamGesture) => {
    engineRef.current?.setFreeCamGesture(gesture);
  }, []);

  const handleResetFreeCamView = useCallback(() => {
    engineRef.current?.resetFreeCamView();
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1a221c]">
      {/* Isolated WebGL canvas mount */}
      <div
        ref={canvasMountRef}
        data-testid="game-canvas-mount"
        className="w-full h-full"
      />

      {hud.phase === 'title' && (
        <TitleOverlay
          selectedLevel={selectedTitleLevel}
          isFullscreen={isFullscreen}
          onSelectLevel={handleSelectTitleLevel}
          onStart={handleStart}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}

      {hud.phase !== 'title' && (
        <HudOverlay
          hud={hud}
          isFullscreen={isFullscreen}
          onToggleCamera={handleToggleCamera}
          onToggleMute={handleToggleMute}
          onToggleFullscreen={handleToggleFullscreen}
          onRestart={handleRestart}
          onPause={handlePause}
          onTriggerAbility={handleTriggerAbility}
          onSetFreeCamGesture={handleSetFreeCamGesture}
          onResetFreeCamView={handleResetFreeCamView}
        />
      )}

      <ModalOverlay
        hud={hud}
        onResume={handleResume}
        onRestart={handleRestart}
        onNextLevel={handleNextLevel}
        onTitle={handleTitle}
      />
    </div>
  );
}

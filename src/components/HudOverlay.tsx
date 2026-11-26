import { useRef } from 'react';
import {
  Camera,
  Compass,
  Eye,
  Flame,
  Maximize2,
  Minimize2,
  Move,
  Pause,
  Rotate3d,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import type { BirdType, FreeCamGesture, GameHudSnapshot } from '../game/types';
import { BirdPortraitSvg, PigSocketSvg, StarSvg } from './BirdIcons';

interface HudOverlayProps {
  hud: GameHudSnapshot;
  isFullscreen: boolean;
  onToggleCamera: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onRestart: () => void;
  onPause: () => void;
  onTriggerAbility: () => void;
  onSetFreeCamGesture: (gesture: FreeCamGesture) => void;
  onResetFreeCamView: () => void;
}

const BIRD_ABILITY_META: Record<
  BirdType,
  {
    name: string;
    ability: string;
    cta: string;
    ctaSub: string;
    buttonClasses: string;
    iconBgClasses: string;
  }
> = {
  red: {
    name: 'Rojo',
    ability: 'Onda de Choque',
    cta: '¡Onda!',
    ctaSub: 'Choque · [Espacio]',
    buttonClasses:
      'bg-gradient-to-b from-[#ff645e] via-[#d42222] to-[#870e12] text-[#fffaf2] border-[#ffc6be] border-b-[#4a0507] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.42),0_8px_22px_rgba(212,34,34,0.52)] hover:from-[#ff7873]',
    iconBgClasses: 'bg-[#5c080b]/55 border-[#ffd0c7]/60 text-[#ffe6a3]',
  },
  yellow: {
    name: 'Amarillo',
    ability: 'Impulso Supersónico',
    cta: '¡Impulso!',
    ctaSub: 'Supersónico · [Espacio]',
    buttonClasses:
      'bg-gradient-to-b from-[#ffe86b] via-[#f09e14] to-[#b86206] text-[#241302] border-[#fff6c2] border-b-[#693302] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.6),0_8px_24px_rgba(240,158,20,0.52)] hover:from-[#fff08a]',
    iconBgClasses: 'bg-[#5e3102]/25 border-[#fff5bf]/75 text-[#2b1502]',
  },
  black: {
    name: 'Negro',
    ability: 'Explosión Radial',
    cta: '¡Detonar!',
    ctaSub: 'Explosión · [Espacio]',
    buttonClasses:
      'bg-gradient-to-b from-[#ff7f3f] via-[#d92a18] to-[#820d08] text-[#fffaf2] border-[#ffd08a] border-b-[#470503] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.42),0_8px_24px_rgba(220,50,20,0.56)] hover:from-[#ff9359]',
    iconBgClasses: 'bg-[#4f0804]/55 border-[#ffd28f]/65 text-[#ffe17d]',
  },
};

const AAA_UTILITY_BTN =
  'aaa-glass aaa-chamfer-sm border border-[#b78f4e]/35 text-[#f2e7d3] shadow-[inset_0_1px_0_rgba(255,235,195,0.16),0_6px_16px_rgba(0,0,0,0.48)] hover:border-[#f2c86b] hover:text-[#ffe8a6] active:translate-y-[1px] transition-all cursor-pointer';

const AAA_GOLD_ACTIVE_BTN =
  'aaa-chamfer-sm border border-[#fff0b3]/85 border-b-2 border-b-[#7a4a08] bg-gradient-to-b from-[#ffe082] via-[#e8a832] to-[#b87616] text-[#1f1306] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_5px_16px_rgba(232,168,50,0.46)] hover:from-[#ffea9e] active:translate-y-[1px] transition-all cursor-pointer';

export function HudOverlay({
  hud,
  isFullscreen,
  onToggleCamera,
  onToggleMute,
  onToggleFullscreen,
  onRestart,
  onPause,
  onTriggerAbility,
  onSetFreeCamGesture,
  onResetFreeCamView,
}: HudOverlayProps) {
  const starPct = Math.min(100, Math.round((hud.score / hud.starThresholds[2]) * 100));
  const pigsDefeated = hud.pigsTotal - hud.pigsRemaining;
  const lastAbilityTriggerMs = useRef(0);

  const fireAbilityOnce = () => {
    const now = performance.now();
    if (now - lastAbilityTriggerMs.current < 160) return;
    lastAbilityTriggerMs.current = now;
    onTriggerAbility();
  };

  const renderAbilityIcon = (bird: BirdType) => {
    if (bird === 'yellow') return <Zap className="w-5 h-5 fill-current" />;
    if (bird === 'black') return <Flame className="w-5 h-5 fill-current" />;
    return <Sparkles className="w-5 h-5" />;
  };

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-5 z-10">
      {/* Top Perimeter Bar */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left: AAA Score, Level & Pig Sockets Plaque */}
        <div
          className="pointer-events-auto aaa-glass aaa-chamfer px-4 py-2.5 border border-[#c89c54]/40 shadow-[inset_0_1px_0_rgba(255,235,195,0.16),0_10px_28px_rgba(0,0,0,0.55)]"
        >
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div>
              <div className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#e6c07b]">
                Nivel {hud.levelIndex + 1}/{hud.levelCount} · {hud.levelName}
              </div>
              <div className="flex items-baseline gap-2.5 mt-0.5">
                <span
                  data-testid="hud-score"
                  className="font-mono-tac text-2xl sm:text-3xl font-bold text-[#fff8ea] leading-none [text-shadow:0_2px_6px_rgba(0,0,0,0.65)]"
                >
                  {hud.score.toLocaleString('es-ES')}
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#b7aa93]">
                  Puntos
                </span>
              </div>
            </div>

            <div className="h-9 w-px bg-gradient-to-b from-transparent via-[#a88248]/55 to-transparent" />

            {/* Pig vitality sockets */}
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1" aria-label={`Cerdos restantes: ${hud.pigsRemaining}`}>
                {Array.from({ length: hud.pigsTotal }).map((_, i) => (
                  <PigSocketSvg key={i} alive={i >= pigsDefeated} />
                ))}
              </div>
              {/* Star progress bar */}
              <div className="mt-1.5 flex items-center gap-1.5 w-full justify-end">
                <div className="w-20 sm:w-24 h-2 rounded-full bg-[#120d09] border border-[#4f3d29] overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-[#d99b1c] to-[#ffe159] transition-all duration-200"
                    style={{ width: `${starPct}%` }}
                  />
                </div>
                <div className="flex items-center -space-x-1">
                  {[1, 2, 3].map((s) => (
                    <StarSvg key={s} filled={hud.stars >= s} size={14} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top-Right: AAA Beveled Utility Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleCamera();
            }}
            aria-label={
              hud.cameraMode === 'inspect'
                ? 'Volver a cámara de disparo [C]'
                : 'Activar cámara libre [C]'
            }
            className={`h-10 px-3.5 font-extrabold text-xs tracking-wide uppercase flex items-center gap-1.5 ${
              hud.cameraMode === 'inspect' ? AAA_GOLD_ACTIVE_BTN : AAA_UTILITY_BTN
            }`}
          >
            {hud.cameraMode === 'inspect' ? <Camera className="w-4 h-4" /> : <Eye className="w-4 h-4 text-[#f0c76e]" />}
            <span className="hidden sm:inline">
              {hud.cameraMode === 'inspect' ? 'Resortera [C]' : 'Cámara Libre [C]'}
            </span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={hud.muted ? 'Activar sonido [M]' : 'Silenciar sonido [M]'}
            className={`w-10 h-10 flex items-center justify-center ${AAA_UTILITY_BTN}`}
          >
            {hud.muted ? <VolumeX className="w-4 h-4 text-[#ff7373]" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleFullscreen();
            }}
            aria-label={isFullscreen ? 'Salir de pantalla completa [F]' : 'Pantalla completa [F]'}
            className={`w-10 h-10 flex items-center justify-center ${AAA_UTILITY_BTN}`}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-[#ffd75e]" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            aria-label="Reiniciar nivel [R]"
            className={`w-10 h-10 flex items-center justify-center ${AAA_UTILITY_BTN}`}
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            aria-label="Pausar juego [P]"
            className={`w-10 h-10 flex items-center justify-center ${AAA_UTILITY_BTN}`}
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Perimeter Bar */}
      <div className="flex items-end justify-between gap-3">
        {/* Bottom-Left: Active Bird & Queue Card */}
        <div
          className="pointer-events-auto aaa-glass aaa-chamfer px-3.5 py-2.5 border border-[#c89c54]/40 flex items-center gap-3 shadow-[inset_0_1px_0_rgba(255,235,195,0.16),0_10px_28px_rgba(0,0,0,0.55)]"
        >
          {hud.activeBird ? (
            <div className="flex items-center gap-2.5">
              <BirdPortraitSvg type={hud.activeBird} size={38} />
              <div>
                <div className="text-xs font-black text-[#fff6e5] uppercase tracking-wider">
                  {BIRD_ABILITY_META[hud.activeBird].name}
                </div>
                <div className="text-[11px] font-bold text-[#f0c05e]">
                  {BIRD_ABILITY_META[hud.activeBird].ability}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs font-bold text-[#c9bca6]">Sin pájaros activos</div>
          )}

          {hud.birdQueue.length > 0 && (
            <>
              <div className="h-8 w-px bg-gradient-to-b from-transparent via-[#7a5d3b] to-transparent" />
              <div className="flex items-center gap-1.5" aria-label={`Cola: ${hud.birdQueue.length} restantes`}>
                {hud.birdQueue.map((b, idx) => (
                  <div key={idx} className="opacity-95">
                    <BirdPortraitSvg type={b} size={26} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Bottom-Right: Aim Readout, Dedicated Mid-Flight Ability Trigger, Free-Cam Touch Pad, or Hint */}
        <div className="flex flex-col items-end gap-2">
          {hud.abilityReady && hud.activeBird && !hud.isPulling && (
            <button
              type="button"
              tabIndex={-1}
              data-testid="ability-trigger-btn"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                fireAbilityOnce();
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.currentTarget.blur();
                fireAbilityOnce();
              }}
              aria-label={`Activar habilidad ${BIRD_ABILITY_META[hud.activeBird].ability} [Espacio]`}
              className={`pointer-events-auto aaa-chamfer group relative flex items-center gap-3 px-4 py-2.5 border-2 border-b-[4px] active:translate-y-[2px] active:border-b-[2px] transition-all cursor-pointer ${BIRD_ABILITY_META[hud.activeBird].buttonClasses}`}
            >
              <span
                className={`w-9 h-9 aaa-chamfer-sm border flex items-center justify-center shrink-0 shadow-inner ${BIRD_ABILITY_META[hud.activeBird].iconBgClasses}`}
              >
                {renderAbilityIcon(hud.activeBird)}
              </span>
              <span className="text-left leading-tight">
                <span className="font-display block text-sm sm:text-base font-black uppercase tracking-wider">
                  {BIRD_ABILITY_META[hud.activeBird].cta}
                </span>
                <span className="block text-[10px] sm:text-[11px] font-bold opacity-90">
                  {BIRD_ABILITY_META[hud.activeBird].ctaSub}
                </span>
              </span>
            </button>
          )}

          {hud.isPulling ? (
            <div
              className="aaa-glass aaa-chamfer px-4 py-2 border border-[#e6b655]/65 shadow-[inset_0_1px_0_rgba(255,235,195,0.2),0_8px_20px_rgba(0,0,0,0.5)] text-right"
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e6c48a]">
                Tensión · Ángulo
              </div>
              <div className="font-mono-tac text-xl font-bold text-[#fff8ea]">
                {hud.pullPower}% <span className="text-[#ffd24d] text-base">{hud.pullAngleDeg}°</span>
              </div>
            </div>
          ) : hud.cameraMode === 'inspect' ? (
            <div
              data-testid="freecam-controls"
              className="pointer-events-auto flex flex-col items-end gap-1.5"
            >
              <div
                className="aaa-glass aaa-chamfer p-1.5 border border-[#b78f4e]/40 shadow-[inset_0_1px_0_rgba(255,235,195,0.16),0_8px_20px_rgba(0,0,0,0.5)] flex items-center gap-1.5"
              >
                <button
                  type="button"
                  tabIndex={-1}
                  aria-pressed={hud.freeCamGesture === 'orbit'}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSetFreeCamGesture('orbit');
                  }}
                  className={`h-9 px-3 text-xs font-extrabold uppercase tracking-wide flex items-center gap-1.5 ${
                    hud.freeCamGesture === 'orbit' ? AAA_GOLD_ACTIVE_BTN : AAA_UTILITY_BTN
                  }`}
                >
                  <Rotate3d className="w-3.5 h-3.5" />
                  <span>Rotar</span>
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  aria-pressed={hud.freeCamGesture === 'pan'}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSetFreeCamGesture('pan');
                  }}
                  className={`h-9 px-3 text-xs font-extrabold uppercase tracking-wide flex items-center gap-1.5 ${
                    hud.freeCamGesture === 'pan' ? AAA_GOLD_ACTIVE_BTN : AAA_UTILITY_BTN
                  }`}
                >
                  <Move className="w-3.5 h-3.5" />
                  <span>Mover</span>
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onResetFreeCamView();
                  }}
                  aria-label="Centrar cámara libre"
                  className={`h-9 px-3 text-xs font-extrabold uppercase tracking-wide flex items-center gap-1.5 ${AAA_UTILITY_BTN}`}
                >
                  <Compass className="w-3.5 h-3.5 text-[#ffd24d]" />
                  <span className="hidden sm:inline">Centrar</span>
                </button>
              </div>
              <div
                className="hidden md:block aaa-glass aaa-chamfer-sm px-3 py-1 border border-[#b78f4e]/30 shadow-md"
              >
                <span className="text-[11px] font-semibold text-[#e6dfd1]">
                  1 dedo: {hud.freeCamGesture === 'pan' ? 'Mover mapa' : 'Rotar'} · 2 dedos / rueda: Zoom · WASD mover
                </span>
              </div>
            </div>
          ) : !hud.abilityReady ? (
            <div
              className="hidden sm:block aaa-glass aaa-chamfer-sm px-3.5 py-1.5 border border-[#b78f4e]/30 shadow-[inset_0_1px_0_rgba(255,235,195,0.12),0_4px_12px_rgba(0,0,0,0.45)]"
            >
              <span className="text-xs font-semibold text-[#ede6d8]">
                Arrastrar para tensar · Tocar botón o pantalla en vuelo para habilidad
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

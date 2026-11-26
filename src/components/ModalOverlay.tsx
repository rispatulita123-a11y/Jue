import type { GameHudSnapshot } from '../game/types';
import { StarSvg } from './BirdIcons';

interface ModalOverlayProps {
  hud: GameHudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onNextLevel: () => void;
  onTitle: () => void;
}

export function ModalOverlay({
  hud,
  onResume,
  onRestart,
  onNextLevel,
  onTitle,
}: ModalOverlayProps) {
  if (hud.phase !== 'paused' && hud.phase !== 'victory' && hud.phase !== 'defeat') {
    return null;
  }

  const isVictory = hud.phase === 'victory';
  const isDefeat = hud.phase === 'defeat';
  const isLastLevel = hud.levelIndex >= hud.levelCount - 1;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(12, 16, 13, 0.68)' }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="aaa-glass aaa-chamfer w-full max-w-md border border-[#d6a95c]/55 p-6 sm:p-7 shadow-[inset_0_1px_0_rgba(255,235,195,0.22),0_26px_64px_rgba(0,0,0,0.82)] text-center"
      >
        {hud.phase === 'paused' && (
          <>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#e6c48a]">
              Nivel {hud.levelIndex + 1} · {hud.levelName}
            </p>
            <h2 className="font-display mt-1.5 text-3xl font-black tracking-wide text-[#fff8ea] [text-shadow:0_2px_8px_rgba(0,0,0,0.7)]">
              Pausa
            </h2>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onResume();
                }}
                className="aaa-chamfer-sm w-full py-3 bg-gradient-to-b from-[#6fd849] via-[#439c25] to-[#276812] hover:from-[#7fe658] active:translate-y-[1.5px] text-white font-display font-black uppercase tracking-[0.14em] border border-[#c8ffaa]/75 border-b-[3px] border-b-[#153c08] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.38),0_8px_20px_rgba(67,156,37,0.38)] [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] transition-all cursor-pointer"
              >
                Continuar
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onRestart();
                }}
                className="aaa-glass aaa-chamfer-sm w-full py-2.5 hover:border-[#e6b655] active:translate-y-[1px] text-[#f5efe4] font-extrabold tracking-wide border border-[#b78f4e]/45 shadow-[inset_0_1px_0_rgba(255,235,195,0.16)] transition-all cursor-pointer"
              >
                Reiniciar Nivel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onTitle();
                }}
                className="aaa-chamfer-sm w-full py-2.5 bg-[#16120f]/90 hover:border-[#b78f4e]/60 active:translate-y-[1px] text-[#cfc2ab] font-bold tracking-wide border border-[#6e5a3e]/40 shadow-[inset_0_1px_0_rgba(255,235,195,0.1)] transition-all cursor-pointer"
              >
                Menú Principal
              </button>
            </div>
          </>
        )}

        {(isVictory || isDefeat) && (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d7b887]">
              Nivel {hud.levelIndex + 1} · {hud.levelName}
            </p>
            <h2
              className={`font-display mt-1.5 text-3xl font-black tracking-wide ${
                isVictory ? 'text-[#f7c625]' : 'text-[#f06458]'
              }`}
            >
              {isVictory ? '¡Nivel Completado!' : '¡Fortaleza Intacta!'}
            </h2>

            {isVictory && (
              <div className="mt-4 flex items-center justify-center gap-3">
                {[1, 2, 3].map((s) => (
                  <StarSvg key={s} filled={hud.stars >= s} size={46} />
                ))}
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3 text-left">
              <div className="aaa-chamfer-sm p-3 bg-[#120f0c]/90 border border-[#b78f4e]/30">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#b7aa93]">
                  Puntuación
                </div>
                <div className="font-mono-tac text-2xl font-bold text-[#fff8ea]">
                  {hud.score.toLocaleString('es-ES')}
                </div>
              </div>

              <div className="aaa-chamfer-sm p-3 bg-[#120f0c]/90 border border-[#b78f4e]/30">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#b7aa93]">
                  {isVictory ? 'Mejor Marca' : 'Cerdos Restantes'}
                </div>
                <div className="font-mono-tac text-2xl font-bold text-[#fff8ea]">
                  {isVictory
                    ? hud.bestScore.toLocaleString('es-ES')
                    : `${hud.pigsRemaining} / ${hud.pigsTotal}`}
                </div>
              </div>
            </div>

            {isVictory && hud.unusedBirdBonus > 0 && (
              <p className="font-mono-tac mt-3 text-xs font-bold text-[#9de67c]">
                Bono de pájaros sin usar: +{hud.unusedBirdBonus.toLocaleString('es-ES')} pts
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3">
              {isVictory ? (
                <button
                  type="button"
                  data-start="true"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    if (isLastLevel) onRestart();
                    else onNextLevel();
                  }}
                  className="aaa-chamfer-sm w-full py-3 bg-gradient-to-b from-[#6fd849] via-[#439c25] to-[#276812] hover:from-[#7fe658] active:translate-y-[1.5px] text-white font-display font-black uppercase tracking-[0.14em] border border-[#c8ffaa]/75 border-b-[3px] border-b-[#153c08] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.38),0_8px_20px_rgba(67,156,37,0.38)] [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] transition-all cursor-pointer"
                >
                  {isLastLevel ? 'Volver a Jugar' : 'Siguiente Nivel'}
                </button>
              ) : (
                <button
                  type="button"
                  data-start="true"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onRestart();
                  }}
                  className="aaa-chamfer-sm w-full py-3 bg-gradient-to-b from-[#d9392b] via-[#9e1713] to-[#5a0808] hover:from-[#eb4535] active:translate-y-[1.5px] text-white font-display font-black uppercase tracking-[0.14em] border border-[#f5c870]/80 border-b-[3px] border-b-[#2c0303] shadow-[inset_0_1.5px_0_rgba(255,232,185,0.4),0_8px_22px_rgba(180,28,22,0.45)] [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] transition-all cursor-pointer"
                >
                  Reintentar Nivel
                </button>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onRestart();
                  }}
                  className="aaa-glass aaa-chamfer-sm py-2.5 hover:border-[#e6b655] active:translate-y-[1px] text-[#f5efe4] font-extrabold text-sm border border-[#b78f4e]/45 shadow-[inset_0_1px_0_rgba(255,235,195,0.16)] transition-all cursor-pointer"
                >
                  Reiniciar
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTitle();
                  }}
                  className="aaa-chamfer-sm py-2.5 bg-[#16120f]/90 hover:border-[#b78f4e]/60 active:translate-y-[1px] text-[#cfc2ab] font-bold text-sm border border-[#6e5a3e]/40 shadow-[inset_0_1px_0_rgba(255,235,195,0.1)] transition-all cursor-pointer"
                >
                  Menú
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { ChevronRight, Flame, Maximize2, Minimize2, MoveHorizontal } from 'lucide-react';
import { LEVELS } from '../game/levels';
import { LevelMaterialIcon } from './BirdIcons';

interface TitleOverlayProps {
  selectedLevel: number;
  isFullscreen: boolean;
  onSelectLevel: (idx: number) => void;
  onStart: (idx: number) => void;
  onToggleFullscreen: () => void;
}

const LEVEL_MATERIAL_LABELS = ['Madera y Piedra', 'Cristal y Acero', 'Granito Fortificado'];

function SlingshotCrestEmblem({ className = 'w-16 h-16 sm:w-20 sm:h-20' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      className={`${className} shrink-0 drop-shadow-[0_8px_20px_rgba(0,0,0,0.65)]`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="crestRim" x1="12" y1="6" x2="84" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FCE4A6" />
          <stop offset="35%" stopColor="#C89342" />
          <stop offset="70%" stopColor="#6D4B21" />
          <stop offset="100%" stopColor="#E4B865" />
        </linearGradient>
        <linearGradient id="crestField" x1="48" y1="8" x2="48" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#261B15" />
          <stop offset="55%" stopColor="#14110F" />
          <stop offset="100%" stopColor="#090807" />
        </linearGradient>
        <linearGradient id="walnutWood" x1="30" y1="22" x2="66" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9A6035" />
          <stop offset="48%" stopColor="#66391C" />
          <stop offset="100%" stopColor="#3B1E0E" />
        </linearGradient>
        <linearGradient id="emberPlume" x1="48" y1="18" x2="54" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF0A8" />
          <stop offset="38%" stopColor="#FF7724" />
          <stop offset="100%" stopColor="#B81914" />
        </linearGradient>
      </defs>

      {/* Outer chamfered shield crest */}
      <polygon
        points="20,6 76,6 90,20 90,66 48,91 6,66 6,20"
        fill="url(#crestField)"
        stroke="url(#crestRim)"
        strokeWidth="2.8"
      />
      <polygon
        points="23,11 73,11 85,23 85,63 48,85 11,63 11,23"
        fill="none"
        stroke="rgba(252,228,166,0.22)"
        strokeWidth="1"
      />

      {/* Incandescent feather silhouette rising behind slingshot */}
      <path
        d="M48 15C55 24 58 34 54 46C51 54 46 57 44 61C41 53 40 43 43 32C44 25 46 20 48 15Z"
        fill="url(#emberPlume)"
        opacity="0.92"
      />
      <path
        d="M54 24C61 30 63 39 58 49C55 54 51 56 49 58C51 49 52 38 54 24Z"
        fill="#FF9F38"
        opacity="0.55"
      />

      {/* Carved Walnut Slingshot Y-Frame */}
      <path
        d="M48 77V51M48 51L29 25M48 51L67 25"
        stroke="#1C0E07"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M48 77V51M48 51L29 25M48 51L67 25"
        stroke="url(#walnutWood)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Wrought-iron yoke collar & brass ferrules */}
      <rect x="42.5" y="48" width="11" height="8" rx="1.5" fill="#2A2F36" stroke="#C89342" strokeWidth="1.2" />
      <rect x="25.5" y="22.5" width="7" height="5" rx="1.2" transform="rotate(-36 29 25)" fill="#D9A852" stroke="#2D1C09" strokeWidth="0.9" />
      <rect x="63.5" y="22.5" width="7" height="5" rx="1.2" transform="rotate(36 67 25)" fill="#D9A852" stroke="#2D1C09" strokeWidth="0.9" />

      {/* Taut leather elastic bands converging on central pouch */}
      <path
        d="M29 26L48 45L67 26"
        stroke="#E4B574"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="48" cy="45" r="5.2" fill="#2B1A12" stroke="#E6B868" strokeWidth="1.5" />
      <circle cx="48" cy="45" r="2.2" fill="#FF6E2B" />

      {/* Corner rivets */}
      <circle cx="21" cy="14" r="1.4" fill="#E4B865" />
      <circle cx="75" cy="14" r="1.4" fill="#E4B865" />
      <circle cx="48" cy="83" r="1.4" fill="#E4B865" />
    </svg>
  );
}

export function TitleOverlay({
  selectedLevel,
  isFullscreen,
  onSelectLevel,
  onStart,
  onToggleFullscreen,
}: TitleOverlayProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStart(selectedLevel);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart, selectedLevel]);

  return (
    <div className="fixed inset-0 pointer-events-none z-20 flex flex-col justify-between p-4 sm:p-6 lg:p-10">
      {/* Atmospheric left-edge gradient scrim on desktop & subtle edge protection on mobile */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none bg-gradient-to-b from-[#0b0908]/70 via-transparent to-[#0b0908]/85 lg:bg-gradient-to-r lg:from-[#0b0908]/78 lg:via-[#0b0908]/28 lg:to-transparent"
      />

      {/* Top Row: AAA Crest & Title Lockup (Left) + Minimalist Fullscreen HUD Toggle (Right) */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="pointer-events-auto flex items-center gap-3.5 sm:gap-5 max-w-xl">
          <SlingshotCrestEmblem className="w-14 h-14 sm:w-20 sm:h-20" />

          <div className="min-w-0">
            <div className="relative">
              {/* Engraved 3D relief shadow layer */}
              <span
                aria-hidden="true"
                className="font-display block text-[1.65rem] sm:text-4xl lg:text-[2.65rem] font-black tracking-[0.06em] leading-[1.02] text-[#170e09] translate-y-[2.5px] select-none"
              >
                PLUMA &amp; FURIA
              </span>
              {/* Brushed metallic-stone beveled main title */}
              <h1
                className="font-display absolute inset-0 text-[1.65rem] sm:text-4xl lg:text-[2.65rem] font-black tracking-[0.06em] leading-[1.02] bg-gradient-to-b from-[#fffaf0] via-[#efe1c8] to-[#a68f70] bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,0.75)]"
              >
                PLUMA &amp; FURIA
              </h1>
            </div>

            {/* Forged gold/bronze subtitle with metallic divider rules */}
            <div className="mt-1.5 flex items-center gap-2.5 sm:gap-3">
              <span className="h-[1px] w-6 sm:w-10 bg-gradient-to-r from-transparent via-[#d8a148] to-[#ffe196]" />
              <span className="font-display text-[11px] sm:text-sm font-extrabold uppercase tracking-[0.32em] bg-gradient-to-b from-[#ffe99e] via-[#dfa23c] to-[#9a6316] bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
                DEMOLICIÓN 3D
              </span>
              <span className="h-[1px] flex-1 max-w-[72px] bg-gradient-to-l from-transparent via-[#d8a148] to-[#ffe196]" />
            </div>
          </div>
        </div>

        {/* Top-Right Minimalist Translucent Fullscreen HUD Button */}
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleFullscreen();
          }}
          aria-label={isFullscreen ? 'Salir de pantalla completa [F]' : 'Pantalla completa [F]'}
          className="pointer-events-auto aaa-glass aaa-chamfer-sm w-11 h-11 flex items-center justify-center border border-[#d6a95c]/35 text-[#efe4cf] hover:border-[#f4cd78] hover:text-[#ffe39c] shadow-[inset_0_1px_0_rgba(255,235,190,0.16),0_6px_18px_rgba(0,0,0,0.5)] active:translate-y-[1px] transition-all cursor-pointer shrink-0"
        >
          {isFullscreen ? (
            <Minimize2 className="w-4.5 h-4.5 text-[#f6cb6b]" />
          ) : (
            <Maximize2 className="w-4.5 h-4.5" />
          )}
        </button>
      </div>

      {/* Main Menu Stack: Left-aligned tactical column on lg+, bottom-docked on mobile vertical so center 3D breathes */}
      <div className="relative z-10 flex flex-col justify-end lg:justify-center lg:my-auto lg:max-w-[430px] gap-3.5 sm:gap-5">
        {/* Tactical Level Selector */}
        <div
          className="pointer-events-auto flex flex-col gap-2"
          role="group"
          aria-label="Seleccionar nivel"
        >
          <div className="hidden sm:flex items-center justify-between px-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#c7b59a]">
              Operaciones de Asedio
            </span>
            <span className="font-mono-tac text-[10px] text-[#e8ba62]">
              0{selectedLevel + 1} / 0{LEVELS.length}
            </span>
          </div>

          {LEVELS.map((lvl, idx) => {
            const active = idx === selectedLevel;
            return (
              <button
                key={lvl.id}
                type="button"
                aria-pressed={active}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSelectLevel(idx);
                }}
                className={`aaa-glass aaa-chamfer aaa-card-sheen group relative w-full text-left px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center gap-3 transition-all duration-200 cursor-pointer border active:translate-y-[1.5px] ${
                  active
                    ? 'border-[#f0bd5e]/70 lg:translate-x-2 shadow-[inset_0_1px_0_rgba(255,234,175,0.22),0_0_24px_rgba(232,162,48,0.22),0_10px_24px_rgba(0,0,0,0.55)]'
                    : 'border-[#8f7958]/28 hover:border-[#d6a95c]/55 hover:lg:translate-x-1 shadow-[inset_0_1px_0_rgba(255,240,210,0.08),0_6px_16px_rgba(0,0,0,0.45)]'
                }`}
              >
                {/* Glowing warm amber left indicator bar on active card */}
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-1.5 bottom-1.5 w-[3.5px] transition-all duration-200 ${
                    active
                      ? 'bg-gradient-to-b from-[#ffe79c] via-[#efa52c] to-[#9b550c] shadow-[0_0_12px_rgba(246,184,65,0.85)] opacity-100'
                      : 'bg-[#7d684a]/40 opacity-0 group-hover:opacity-70'
                  }`}
                />

                {/* Minimalist material icon badge */}
                <span
                  className={`w-9 h-9 sm:w-10 sm:h-10 aaa-chamfer-sm shrink-0 flex items-center justify-center border transition-colors ${
                    active
                      ? 'bg-[#2a1d11]/90 border-[#f0bd5e]/55'
                      : 'bg-[#171310]/85 border-[#6c5b43]/35 group-hover:border-[#b89254]/50'
                  }`}
                >
                  <LevelMaterialIcon levelIndex={idx} active={active} />
                </span>

                {/* Level name & material subtitle */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono-tac text-[11px] font-bold ${
                        active ? 'text-[#f6cb6b]' : 'text-[#9e8d76]'
                      }`}
                    >
                      0{lvl.id}
                    </span>
                    <span
                      className={`text-sm sm:text-[15px] font-extrabold tracking-wide truncate ${
                        active ? 'text-[#fff7e6]' : 'text-[#dcd0be] group-hover:text-[#fff4df]'
                      }`}
                    >
                      {lvl.id}. {lvl.name}
                    </span>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 mt-0.5 text-[11px] text-[#a99982]">
                    <span className={active ? 'text-[#e5bf79]' : ''}>
                      {LEVEL_MATERIAL_LABELS[idx]}
                    </span>
                    <span aria-hidden="true" className="text-[#665744]">
                      ·
                    </span>
                    <span className="truncate">{lvl.pigs.length} objetivos</span>
                  </div>
                </div>

                <ChevronRight
                  className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                    active
                      ? 'text-[#f6cb6b] translate-x-0.5'
                      : 'text-[#6e5f4b] group-hover:text-[#c9a96d] group-hover:translate-x-0.5'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Forged Crimson-to-Ember Primary CTA */}
        <button
          type="button"
          data-start="true"
          onClick={(e) => {
            e.currentTarget.blur();
            onStart(selectedLevel);
          }}
          className="pointer-events-auto aaa-chamfer relative overflow-hidden group w-full sm:w-auto sm:min-w-[290px] px-7 py-3.5 sm:py-4 bg-gradient-to-b from-[#d9392b] via-[#9e1713] to-[#5a0808] hover:from-[#eb4535] hover:via-[#b81d18] active:translate-y-[2px] border border-[#f5c870]/80 border-b-[3px] border-b-[#2c0303] shadow-[inset_0_1.5px_0_rgba(255,232,185,0.45),0_12px_30px_rgba(180,28,22,0.52),0_4px_12px_rgba(0,0,0,0.6)] transition-all cursor-pointer flex items-center justify-center gap-3"
        >
          {/* Periodic metallic sheen sweep */}
          <span
            aria-hidden="true"
            className="aaa-sheen-bar pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-transparent via-[#fff2c8]/55 to-transparent"
          />

          <Flame className="w-5 h-5 text-[#ffd273] shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
          <span className="font-display text-base sm:text-lg font-black tracking-[0.14em] uppercase text-[#fff9ed] [text-shadow:0_2px_4px_rgba(0,0,0,0.65)]">
            Jugar Nivel {selectedLevel + 1}
          </span>
        </button>

        {/* Mobile compact hint inside bottom dock */}
        <div className="flex sm:hidden items-center justify-center gap-2 text-[11px] font-medium text-[#cfc1aa] pt-0.5">
          <MoveHorizontal className="w-3.5 h-3.5 text-[#f0be64]" />
          <span>Arrastrar para apuntar · Tocar en vuelo para habilidad</span>
        </div>
      </div>

      {/* Desktop/Tablet Bottom Tactical Control Strip */}
      <div className="relative z-10 hidden sm:flex justify-center">
        <div className="aaa-glass aaa-chamfer-sm pointer-events-auto inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-4 py-2 border border-[#b78f4e]/30 shadow-[inset_0_1px_0_rgba(255,236,195,0.12),0_8px_24px_rgba(0,0,0,0.55)] text-xs text-[#dfd3bf]">
          <span className="inline-flex items-center gap-1.5">
            <MoveHorizontal className="w-3.5 h-3.5 text-[#f2c165]" />
            <span>Arrastrar para apuntar y tensar</span>
          </span>
          <span className="h-3 w-px bg-[#756146]/55" aria-hidden="true" />
          <span className="inline-flex items-center gap-1.5">
            <kbd className="aaa-kbd">ESPACIO</kbd>
            <span>Habilidad en vuelo</span>
          </span>
          <span className="h-3 w-px bg-[#756146]/55" aria-hidden="true" />
          <span className="inline-flex items-center gap-1.5">
            <kbd className="aaa-kbd">C</kbd>
            <span>Cámara libre</span>
          </span>
          <span className="h-3 w-px bg-[#756146]/55" aria-hidden="true" />
          <span className="inline-flex items-center gap-1.5">
            <kbd className="aaa-kbd">F</kbd>
            <span>Pantalla completa</span>
          </span>
        </div>
      </div>
    </div>
  );
}

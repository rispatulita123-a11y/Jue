import type { BirdType } from '../game/types';

export function BirdPortraitSvg({
  type,
  size = 34,
}: {
  type: BirdType;
  size?: number;
}) {
  if (type === 'yellow') {
    return (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <path
          d="M18 4L31 28C31.5 29.5 30.2 31 28.5 31H7.5C5.8 31 4.5 29.5 5 28L18 4Z"
          fill="#F2C21A"
          stroke="#2A1C0E"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="M10 27C13 24 23 24 26 27H10Z" fill="#FAF4DC" />
        <path d="M16 4L14 1M18 4L19 0.5M20 5L23 2" stroke="#2A1C0E" strokeWidth="2" strokeLinecap="round" />
        <circle cx="14.5" cy="18.5" r="2.7" fill="#FFFDF7" stroke="#2A1C0E" strokeWidth="1.2" />
        <circle cx="21.5" cy="18.5" r="2.7" fill="#FFFDF7" stroke="#2A1C0E" strokeWidth="1.2" />
        <circle cx="15.2" cy="18.5" r="1.2" fill="#181411" />
        <circle cx="20.8" cy="18.5" r="1.2" fill="#181411" />
        <path d="M11 15L17 17M25 15L19 17" stroke="#3B180E" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M18 20L22.5 22.5L18 24.5L15.5 22.5Z" fill="#F49D1A" stroke="#2A1C0E" strokeWidth="1.3" />
      </svg>
    );
  }

  if (type === 'black') {
    return (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <path d="M18 7C18 4 21 3 23 4" stroke="#7A5F3D" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="24" cy="4.2" r="2.3" fill="#FF7A1A" stroke="#FFD966" strokeWidth="1.2" />
        <circle cx="18" cy="20" r="12" fill="#252830" stroke="#0D0F14" strokeWidth="2.2" />
        <ellipse cx="18" cy="25" rx="6.5" ry="4.2" fill="#5D626E" />
        <circle cx="14" cy="17.5" r="2.6" fill="#FFFDF7" stroke="#0D0F14" strokeWidth="1.2" />
        <circle cx="22" cy="17.5" r="2.6" fill="#FFFDF7" stroke="#0D0F14" strokeWidth="1.2" />
        <circle cx="14.5" cy="17.5" r="1.2" fill="#0D0F14" />
        <circle cx="21.5" cy="17.5" r="1.2" fill="#0D0F14" />
        <path d="M10.5 14L17 15.8M25.5 14L19 15.8" stroke="#0D0F14" strokeWidth="2.3" strokeLinecap="round" />
        <path d="M18 19.5L22 21.8L18 23.8L15 21.8Z" fill="#F49D1A" stroke="#0D0F14" strokeWidth="1.2" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <path d="M16 7L13 3M18 7L19 2" stroke="#D92525" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="18" cy="20" r="11.5" fill="#D92525" stroke="#2A120E" strokeWidth="2.2" />
      <ellipse cx="18" cy="25.5" rx="7" ry="4.4" fill="#F2DEC2" />
      <circle cx="14.2" cy="18" r="2.8" fill="#FFFDF7" stroke="#2A120E" strokeWidth="1.2" />
      <circle cx="21.8" cy="18" r="2.8" fill="#FFFDF7" stroke="#2A120E" strokeWidth="1.2" />
      <circle cx="14.8" cy="18" r="1.25" fill="#181210" />
      <circle cx="21.2" cy="18" r="1.25" fill="#181210" />
      <path d="M10.5 14.5L17.2 16.5M25.5 14.5L18.8 16.5" stroke="#181210" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M18 19.8L22.5 22L18 24.4L15 22Z" fill="#F49D1A" stroke="#2A120E" strokeWidth="1.2" />
    </svg>
  );
}

export function PigSocketSvg({ alive }: { alive: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="12.5"
        r="9"
        fill={alive ? '#67C43E' : 'rgba(255,255,255,0.08)'}
        stroke={alive ? '#1E3F12' : 'rgba(255,255,255,0.24)'}
        strokeWidth="1.8"
      />
      {alive ? (
        <>
          <ellipse cx="12" cy="14" rx="4.2" ry="3" fill="#8AE05E" stroke="#1E3F12" strokeWidth="1.1" />
          <circle cx="10.4" cy="14" r="0.9" fill="#1E3F12" />
          <circle cx="13.6" cy="14" r="0.9" fill="#1E3F12" />
          <circle cx="8" cy="10.5" r="1.6" fill="#FFFFFF" />
          <circle cx="16" cy="10.5" r="1.6" fill="#FFFFFF" />
          <circle cx="8.2" cy="10.5" r="0.7" fill="#151515" />
          <circle cx="15.8" cy="10.5" r="0.7" fill="#151515" />
        </>
      ) : (
        <path d="M8.5 9.5L15.5 15.5M15.5 9.5L8.5 15.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function StarSvg({ filled, size = 34 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M16 2.5L20.1 10.8L29.2 12.1L22.6 18.5L24.2 27.6L16 23.3L7.8 27.6L9.4 18.5L2.8 12.1L11.9 10.8L16 2.5Z"
        fill={filled ? '#F7C625' : 'rgba(255,255,255,0.12)'}
        stroke={filled ? '#6E4905' : 'rgba(255,255,255,0.28)'}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LevelMaterialIcon({
  levelIndex,
  active,
}: {
  levelIndex: number;
  active: boolean;
}) {
  const stroke = active ? '#f6d17a' : '#b7aa95';
  const accent = active ? '#ffab4c' : '#857762';

  if (levelIndex === 1) {
    // Puente de Cristal — geometric faceted crystal bridge prism
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2.5L20 9L12 21.5L4 9L12 2.5Z"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill={active ? 'rgba(120, 200, 255, 0.16)' : 'rgba(140, 180, 210, 0.08)'}
        />
        <path d="M4 9H20M12 2.5V21.5M7.8 9L12 21.5L16.2 9" stroke={accent} strokeWidth="1.15" />
      </svg>
    );
  }

  if (levelIndex === 2) {
    // Ciudadela de Granito — monolithic fortified granite keep
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 20V8H7V5H10V8H14V5H17V8H20V20H4Z"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill={active ? 'rgba(240, 150, 75, 0.14)' : 'rgba(180, 170, 155, 0.07)'}
        />
        <path d="M10 20V14.5C10 13.4 10.9 12.5 12 12.5C13.1 12.5 14 13.4 14 14.5V20" stroke={accent} strokeWidth="1.3" />
        <path d="M4 12H20" stroke={stroke} strokeOpacity="0.45" strokeWidth="1" />
      </svg>
    );
  }

  // Atalaya del Valle — carved timber watchtower & grain
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 20L7.5 8H16.5L19 20H5Z"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill={active ? 'rgba(220, 150, 65, 0.15)' : 'rgba(190, 145, 95, 0.08)'}
      />
      <path d="M6 8L12 3.2L18 8H6Z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8.5 13H15.5M9.5 17H14.5M12 8V20" stroke={accent} strokeWidth="1.15" />
    </svg>
  );
}


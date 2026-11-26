import type { LevelDefinition } from './types';

// Slingshot sits at (-15, 0, 0). Fortresses are built around (+10..+20, y, -5..+5).
export const SLINGSHOT_ORIGIN = { x: -15, y: 3.1, z: 0 };

export const LEVELS: LevelDefinition[] = [
  {
    id: 1,
    name: 'Atalaya del Valle',
    subtitle: 'Torre fortificada con almenas y mirador de cristal',
    birds: ['red', 'yellow', 'red', 'black'],
    fortressCenter: { x: 13.5, y: 2.6, z: 0 },
    starThresholds: [18000, 32000, 44000],
    blocks: [
      // Stone foundation plinths
      { x: 11.5, y: 0.45, z: -2.2, w: 1.5, h: 0.9, d: 1.5, material: 'stone' },
      { x: 11.5, y: 0.45, z: 2.2, w: 1.5, h: 0.9, d: 1.5, material: 'stone' },
      { x: 15.5, y: 0.45, z: -2.2, w: 1.5, h: 0.9, d: 1.5, material: 'stone' },
      { x: 15.5, y: 0.45, z: 2.2, w: 1.5, h: 0.9, d: 1.5, material: 'stone' },

      // Lower wooden pillars
      { x: 11.5, y: 2.3, z: -2.2, w: 0.78, h: 2.8, d: 0.78, material: 'wood' },
      { x: 11.5, y: 2.3, z: 2.2, w: 0.78, h: 2.8, d: 0.78, material: 'wood' },
      { x: 15.5, y: 2.3, z: -2.2, w: 0.78, h: 2.8, d: 0.78, material: 'wood' },
      { x: 15.5, y: 2.3, z: 2.2, w: 0.78, h: 2.8, d: 0.78, material: 'wood' },

      // Front glass shield wall & flanking defensive crates
      { x: 9.6, y: 1.3, z: 0, w: 0.45, h: 2.6, d: 3.2, material: 'glass' },
      { x: 9.4, y: 0.55, z: -2.35, w: 1.1, h: 1.1, d: 1.1, material: 'wood' },
      { x: 9.4, y: 0.55, z: 2.35, w: 1.1, h: 1.1, d: 1.1, material: 'wood' },
      { x: 13.5, y: 0.45, z: -2.65, w: 1.9, h: 0.9, d: 0.75, material: 'stone' },
      { x: 13.5, y: 0.45, z: 2.65, w: 1.9, h: 0.9, d: 0.75, material: 'stone' },

      // First floor beams & deck
      { x: 11.5, y: 3.95, z: 0, w: 0.9, h: 0.5, d: 5.6, material: 'wood' },
      { x: 15.5, y: 3.95, z: 0, w: 0.9, h: 0.5, d: 5.6, material: 'wood' },
      { x: 13.5, y: 4.45, z: 0, w: 5.4, h: 0.5, d: 5.4, material: 'wood' },

      // Second story glass lookout & rear stone piers
      { x: 12.0, y: 5.85, z: -1.5, w: 0.68, h: 2.3, d: 0.68, material: 'glass' },
      { x: 12.0, y: 5.85, z: 1.5, w: 0.68, h: 2.3, d: 0.68, material: 'glass' },
      { x: 15.0, y: 5.85, z: -1.5, w: 0.7, h: 2.3, d: 0.7, material: 'stone' },
      { x: 15.0, y: 5.85, z: 1.5, w: 0.7, h: 2.3, d: 0.7, material: 'stone' },

      // Roof deck, corner battlements & central glass lantern
      { x: 13.5, y: 7.25, z: 0, w: 4.4, h: 0.5, d: 4.4, material: 'wood' },
      { x: 11.85, y: 7.85, z: -1.65, w: 0.7, h: 0.7, d: 0.7, material: 'stone' },
      { x: 11.85, y: 7.85, z: 1.65, w: 0.7, h: 0.7, d: 0.7, material: 'stone' },
      { x: 15.15, y: 7.85, z: -1.65, w: 0.7, h: 0.7, d: 0.7, material: 'stone' },
      { x: 15.15, y: 7.85, z: 1.65, w: 0.7, h: 0.7, d: 0.7, material: 'stone' },
      { x: 13.5, y: 7.95, z: 0, w: 1.4, h: 0.9, d: 1.4, material: 'glass' },
      { x: 13.5, y: 8.54, z: 0, w: 1.65, h: 0.28, d: 1.65, material: 'wood' },
    ],
    pigs: [
      { x: 13.5, y: 0.62, z: 0, radius: 0.62, variant: 'grunt' },
      { x: 13.5, y: 5.3, z: 0, radius: 0.6, variant: 'helmet' },
      { x: 17.5, y: 0.58, z: 1.8, radius: 0.58, variant: 'grunt' },
    ],
  },
  {
    id: 2,
    name: 'Puente de Cristal',
    subtitle: 'Bastiones gemelos unidos por galería elevada',
    birds: ['yellow', 'red', 'black', 'yellow', 'red'],
    fortressCenter: { x: 14.5, y: 2.8, z: 0 },
    starThresholds: [24000, 38000, 52000],
    blocks: [
      // Left bastion (z = -3.2)
      { x: 12.0, y: 1.4, z: -4.4, w: 1.0, h: 2.8, d: 1.0, material: 'stone' },
      { x: 16.0, y: 1.4, z: -4.4, w: 1.0, h: 2.8, d: 1.0, material: 'stone' },
      { x: 12.0, y: 1.4, z: -2.0, w: 1.0, h: 2.8, d: 1.0, material: 'wood' },
      { x: 16.0, y: 1.4, z: -2.0, w: 1.0, h: 2.8, d: 1.0, material: 'wood' },
      { x: 14.0, y: 3.1, z: -3.2, w: 5.4, h: 0.6, d: 3.6, material: 'wood' },
      { x: 12.0, y: 3.75, z: -4.4, w: 0.8, h: 0.7, d: 0.8, material: 'stone' },
      { x: 16.0, y: 3.75, z: -4.4, w: 0.8, h: 0.7, d: 0.8, material: 'stone' },

      // Right bastion (z = +3.2)
      { x: 12.0, y: 1.4, z: 2.0, w: 1.0, h: 2.8, d: 1.0, material: 'wood' },
      { x: 16.0, y: 1.4, z: 2.0, w: 1.0, h: 2.8, d: 1.0, material: 'wood' },
      { x: 12.0, y: 1.4, z: 4.4, w: 1.0, h: 2.8, d: 1.0, material: 'stone' },
      { x: 16.0, y: 1.4, z: 4.4, w: 1.0, h: 2.8, d: 1.0, material: 'stone' },
      { x: 14.0, y: 3.1, z: 3.2, w: 5.4, h: 0.6, d: 3.6, material: 'wood' },
      { x: 12.0, y: 3.75, z: 4.4, w: 0.8, h: 0.7, d: 0.8, material: 'stone' },
      { x: 16.0, y: 3.75, z: 4.4, w: 0.8, h: 0.7, d: 0.8, material: 'stone' },

      // Central glass bridge connecting bastions
      { x: 14.0, y: 3.675, z: 0, w: 3.8, h: 0.55, d: 4.8, material: 'glass' },

      // Upper bridge pavilion with timber ridge & pinnacles
      { x: 12.8, y: 5.0, z: -1.3, w: 0.65, h: 2.1, d: 0.65, material: 'glass' },
      { x: 15.2, y: 5.0, z: -1.3, w: 0.65, h: 2.1, d: 0.65, material: 'glass' },
      { x: 12.8, y: 5.0, z: 1.3, w: 0.65, h: 2.1, d: 0.65, material: 'glass' },
      { x: 15.2, y: 5.0, z: 1.3, w: 0.65, h: 2.1, d: 0.65, material: 'glass' },
      { x: 14.0, y: 6.3, z: 0, w: 4.0, h: 0.5, d: 4.0, material: 'wood' },
      { x: 14.0, y: 6.8, z: 0, w: 3.0, h: 0.5, d: 1.2, material: 'wood' },
      { x: 14.0, y: 6.9, z: -1.4, w: 0.65, h: 0.7, d: 0.65, material: 'stone' },
      { x: 14.0, y: 6.9, z: 1.4, w: 0.65, h: 0.7, d: 0.65, material: 'stone' },

      // Front wooden palisades, stone parapet & rear supply crate
      { x: 9.6, y: 0.9, z: -3.2, w: 0.6, h: 1.8, d: 2.2, material: 'wood' },
      { x: 9.6, y: 0.9, z: 3.2, w: 0.6, h: 1.8, d: 2.2, material: 'wood' },
      { x: 9.1, y: 0.55, z: 0, w: 0.85, h: 1.1, d: 2.2, material: 'stone' },
      { x: 10.2, y: 1.1, z: 0, w: 0.45, h: 2.2, d: 2.0, material: 'glass' },
      { x: 17.5, y: 0.55, z: 0, w: 1.1, h: 1.1, d: 1.1, material: 'wood' },
    ],
    pigs: [
      { x: 14.0, y: 0.58, z: -3.2, radius: 0.58, variant: 'grunt' },
      { x: 14.0, y: 0.58, z: 3.2, radius: 0.58, variant: 'grunt' },
      { x: 14.0, y: 0.6, z: 0, radius: 0.6, variant: 'helmet' },
      { x: 14.0, y: 4.57, z: 0, radius: 0.62, variant: 'helmet' },
    ],
  },
  {
    id: 3,
    name: 'Ciudadela de Granito',
    subtitle: 'Búnker fortificado y cúpula del Rey Cerdo',
    birds: ['black', 'yellow', 'black', 'red', 'yellow'],
    fortressCenter: { x: 15.0, y: 3.2, z: 0 },
    starThresholds: [32000, 48000, 64000],
    blocks: [
      // Heavy outer stone bunker pillars
      { x: 11.4, y: 1.6, z: -3.6, w: 1.2, h: 3.2, d: 1.2, material: 'stone' },
      { x: 11.4, y: 1.6, z: 0, w: 1.1, h: 3.2, d: 1.1, material: 'stone' },
      { x: 11.4, y: 1.6, z: 3.6, w: 1.2, h: 3.2, d: 1.2, material: 'stone' },

      { x: 15.0, y: 1.6, z: -3.6, w: 1.1, h: 3.2, d: 1.1, material: 'wood' },
      { x: 15.0, y: 1.6, z: 3.6, w: 1.1, h: 3.2, d: 1.1, material: 'wood' },

      { x: 18.4, y: 1.6, z: -3.6, w: 1.2, h: 3.2, d: 1.2, material: 'stone' },
      { x: 18.4, y: 1.6, z: 0, w: 1.1, h: 3.2, d: 1.1, material: 'stone' },
      { x: 18.4, y: 1.6, z: 3.6, w: 1.2, h: 3.2, d: 1.2, material: 'stone' },

      // Side stone buttresses
      { x: 15.0, y: 1.1, z: -4.85, w: 1.8, h: 2.2, d: 0.9, material: 'stone' },
      { x: 15.0, y: 1.1, z: 4.85, w: 1.8, h: 2.2, d: 0.9, material: 'stone' },

      // Heavy stone roof deck (solid continuous stone deck + timber bridge center)
      { x: 14.9, y: 3.55, z: -2.45, w: 8.2, h: 0.7, d: 3.3, material: 'stone' },
      { x: 14.9, y: 3.55, z: 0, w: 8.2, h: 0.7, d: 1.6, material: 'wood' },
      { x: 14.9, y: 3.55, z: 2.45, w: 8.2, h: 0.7, d: 3.3, material: 'stone' },

      // Lower deck battlements
      { x: 11.4, y: 4.275, z: -3.4, w: 0.85, h: 0.75, d: 0.85, material: 'stone' },
      { x: 11.4, y: 4.275, z: 3.4, w: 0.85, h: 0.75, d: 0.85, material: 'stone' },
      { x: 18.4, y: 4.275, z: -3.4, w: 0.85, h: 0.75, d: 0.85, material: 'stone' },
      { x: 18.4, y: 4.275, z: 3.4, w: 0.85, h: 0.75, d: 0.85, material: 'stone' },

      // Upper royal keep
      { x: 13.0, y: 5.1, z: -2.2, w: 0.85, h: 2.4, d: 0.85, material: 'wood' },
      { x: 13.0, y: 5.1, z: 2.2, w: 0.85, h: 2.4, d: 0.85, material: 'wood' },
      { x: 16.8, y: 5.1, z: -2.2, w: 0.85, h: 2.4, d: 0.85, material: 'stone' },
      { x: 16.8, y: 5.1, z: 2.2, w: 0.85, h: 2.4, d: 0.85, material: 'stone' },

      // Glass clerestory shields, royal roof & crowned cupola
      { x: 12.2, y: 5.0, z: 0, w: 0.45, h: 2.2, d: 2.8, material: 'glass' },
      { x: 14.9, y: 6.58, z: 0, w: 5.4, h: 0.55, d: 5.4, material: 'wood' },
      { x: 14.9, y: 7.4, z: 0, w: 2.0, h: 1.1, d: 2.0, material: 'glass' },
      { x: 14.9, y: 8.11, z: 0, w: 2.25, h: 0.32, d: 2.25, material: 'stone' },

      // Forward armor shield & outer crate barricades
      { x: 9.2, y: 1.1, z: -1.6, w: 0.85, h: 2.2, d: 2.1, material: 'stone' },
      { x: 9.2, y: 1.1, z: 1.6, w: 0.85, h: 2.2, d: 2.1, material: 'stone' },
      { x: 7.8, y: 0.5, z: -2.4, w: 1.0, h: 1.0, d: 1.0, material: 'wood' },
      { x: 7.8, y: 0.5, z: 2.4, w: 1.0, h: 1.0, d: 1.0, material: 'wood' },
    ],
    pigs: [
      { x: 13.8, y: 0.58, z: -1.8, radius: 0.58, variant: 'grunt' },
      { x: 13.8, y: 0.58, z: 1.8, radius: 0.58, variant: 'grunt' },
      { x: 16.6, y: 0.6, z: -1.8, radius: 0.6, variant: 'helmet' },
      { x: 16.6, y: 0.6, z: 1.8, radius: 0.6, variant: 'helmet' },
      { x: 14.9, y: 4.65, z: 0, radius: 0.74, variant: 'king' },
    ],
  },
];

export function computeStars(score: number, thresholds: [number, number, number]): number {
  if (score >= thresholds[2]) return 3;
  if (score >= thresholds[1]) return 2;
  if (score >= thresholds[0]) return 1;
  return 0;
}

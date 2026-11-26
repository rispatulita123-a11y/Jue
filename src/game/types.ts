export type BirdType = 'red' | 'yellow' | 'black';

export type BlockMaterialType = 'glass' | 'wood' | 'stone';

export type PigVariant = 'grunt' | 'helmet' | 'king';

export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'defeat';

export type CameraMode = 'aim' | 'follow' | 'inspect';

export type FreeCamGesture = 'orbit' | 'pan';

export type BodyKind = 'bird' | 'pig' | 'block';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface BlockBlueprint {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  material: BlockMaterialType;
  ry?: number;
}

export interface PigBlueprint {
  x: number;
  y: number;
  z: number;
  radius: number;
  variant: PigVariant;
}

export interface LevelDefinition {
  id: number;
  name: string;
  subtitle: string;
  birds: BirdType[];
  blocks: BlockBlueprint[];
  pigs: PigBlueprint[];
  starThresholds: [number, number, number];
  fortressCenter: Vec3;
}

export interface CollisionEvent {
  type: 'impact' | 'destroy' | 'pig_pop' | 'explosion' | 'shockwave';
  position: Vec3;
  intensity: number;
  material?: BlockMaterialType | 'pig' | 'ground';
  bodyId?: string;
  birdType?: BirdType;
  scoreDelta: number;
  impactPoint?: Vec3;
  impactDir?: Vec3;
  impulse?: number;
  isGroundContact?: boolean;
}

export interface GameHudSnapshot {
  phase: GamePhase;
  levelIndex: number;
  levelCount: number;
  levelName: string;
  levelSubtitle: string;
  score: number;
  bestScore: number;
  stars: number;
  starThresholds: [number, number, number];
  pigsRemaining: number;
  pigsTotal: number;
  birdQueue: BirdType[];
  activeBird: BirdType | null;
  abilityReady: boolean;
  abilityUsed: boolean;
  cameraMode: CameraMode;
  freeCamGesture: FreeCamGesture;
  isPulling: boolean;
  pullPower: number; // 0..100
  pullAngleDeg: number;
  muted: boolean;
  unusedBirdBonus: number;
}

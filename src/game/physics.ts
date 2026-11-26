import type {
  BirdType,
  BlockMaterialType,
  BodyKind,
  CollisionEvent,
  PigVariant,
  Quat,
  Vec3,
} from './types';

export interface MaterialPhysicsProps {
  density: number;
  hp: number;
  restitution: number;
  friction: number;
  damageThreshold: number;
  score: number;
}

export const BLOCK_MATERIAL_PROPS: Record<BlockMaterialType, MaterialPhysicsProps> = {
  glass: {
    density: 1.15,
    hp: 26,
    restitution: 0.24,
    friction: 0.34,
    damageThreshold: 3.6,
    score: 500,
  },
  wood: {
    density: 1.55,
    hp: 68,
    restitution: 0.2,
    friction: 0.56,
    damageThreshold: 5.4,
    score: 750,
  },
  stone: {
    density: 2.7,
    hp: 175,
    restitution: 0.14,
    friction: 0.72,
    damageThreshold: 8.6,
    score: 1200,
  },
};

export const BIRD_PHYSICS_PROPS: Record<
  BirdType,
  { radius: number; mass: number; restitution: number; friction: number; damageMultiplier: number }
> = {
  red: { radius: 0.44, mass: 3.4, restitution: 0.42, friction: 0.52, damageMultiplier: 1.15 },
  yellow: { radius: 0.42, mass: 2.9, restitution: 0.38, friction: 0.42, damageMultiplier: 1.35 },
  black: { radius: 0.52, mass: 5.2, restitution: 0.28, friction: 0.62, damageMultiplier: 1.65 },
};

export const PIG_VARIANT_PROPS: Record<
  PigVariant,
  { hp: number; score: number; mass: number; damageThreshold: number }
> = {
  grunt: { hp: 24, score: 5000, mass: 2.2, damageThreshold: 3.1 },
  helmet: { hp: 52, score: 6500, mass: 2.8, damageThreshold: 4.5 },
  king: { hp: 82, score: 9000, mass: 3.5, damageThreshold: 5.2 },
};

export interface RigidBody {
  id: string;
  kind: BodyKind;
  shape: 'sphere' | 'box';
  position: Vec3;
  velocity: Vec3;
  quaternion: Quat;
  angularVelocity: Vec3;
  mass: number;
  invMass: number;
  halfExtents: Vec3; // box half sizes, or (r, r, r) for sphere
  radius: number;
  invInertiaLocal: Vec3;
  restitution: number;
  friction: number;
  hp: number;
  maxHp: number;
  damageThreshold: number;
  scoreValue: number;
  material?: BlockMaterialType;
  birdType?: BirdType;
  pigVariant?: PigVariant;
  isStatic: boolean;
  isSleeping: boolean;
  sleepTimer: number;
  alive: boolean;
  launched: boolean;
  hitFlashTimer: number;
  damageMultiplier: number;
  lastImpactPoint?: Vec3;
  lastImpactDir?: Vec3;
  lastImpactSpeed: number;
  groundSlideDustCooldown: number;
}

export interface PhysicsWorld {
  bodies: RigidBody[];
  gravity: number;
  events: CollisionEvent[];
  simTime: number;
}

// --- Vector & Quaternion Helpers ---

export function v3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function v3Dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function v3Cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function v3LenSq(a: Vec3): number {
  return a.x * a.x + a.y * a.y + a.z * a.z;
}

export function v3Len(a: Vec3): number {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}

export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const half = angle * 0.5;
  const s = Math.sin(half);
  return {
    x: axis.x * s,
    y: axis.y * s,
    z: axis.z * s,
    w: Math.cos(half),
  };
}

export function quatNormalize(q: Quat): void {
  const len = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  if (len > 1e-8) {
    const inv = 1 / len;
    q.x *= inv;
    q.y *= inv;
    q.z *= inv;
    q.w *= inv;
  } else {
    q.x = 0;
    q.y = 0;
    q.z = 0;
    q.w = 1;
  }
}

export function rotateVecByQuat(v: Vec3, q: Quat): Vec3 {
  const ix = q.w * v.x + q.y * v.z - q.z * v.y;
  const iy = q.w * v.y + q.z * v.x - q.x * v.z;
  const iz = q.w * v.z + q.x * v.y - q.y * v.x;
  const iw = -q.x * v.x - q.y * v.y - q.z * v.z;
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  };
}

export function rotateVecByQuatInv(v: Vec3, q: Quat): Vec3 {
  return rotateVecByQuat(v, { x: -q.x, y: -q.y, z: -q.z, w: q.w });
}

function getBoxAxes(q: Quat): [Vec3, Vec3, Vec3] {
  const x = q.x,
    y = q.y,
    z = q.z,
    w = q.w;
  const x2 = x + x,
    y2 = y + y,
    z2 = z + z;
  const xx = x * x2,
    xy = x * y2,
    xz = x * z2;
  const yy = y * y2,
    yz = y * z2,
    zz = z * z2;
  const wx = w * x2,
    wy = w * y2,
    wz = w * z2;

  return [
    { x: 1 - (yy + zz), y: xy + wz, z: xz - wy },
    { x: xy - wz, y: 1 - (xx + zz), z: yz + wx },
    { x: xz + wy, y: yz - wx, z: 1 - (xx + yy) },
  ];
}

function applyWorldInvInertia(body: RigidBody, v: Vec3): Vec3 {
  if (body.invMass === 0) return { x: 0, y: 0, z: 0 };
  if (body.shape === 'sphere') {
    const k = body.invInertiaLocal.x;
    return { x: v.x * k, y: v.y * k, z: v.z * k };
  }
  const local = rotateVecByQuatInv(v, body.quaternion);
  local.x *= body.invInertiaLocal.x;
  local.y *= body.invInertiaLocal.y;
  local.z *= body.invInertiaLocal.z;
  return rotateVecByQuat(local, body.quaternion);
}

// --- World & Body Factory ---

export function createPhysicsWorld(gravity = -19.5): PhysicsWorld {
  return {
    bodies: [],
    gravity,
    events: [],
    simTime: 0,
  };
}

export function createBlockBody(
  id: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  material: BlockMaterialType,
  ry = 0,
): RigidBody {
  const props = BLOCK_MATERIAL_PROPS[material];
  const volume = Math.max(0.05, w * h * d);
  const mass = volume * props.density;
  const ix = (mass / 12) * (h * h + d * d);
  const iy = (mass / 12) * (w * w + d * d);
  const iz = (mass / 12) * (w * w + h * h);

  return {
    id,
    kind: 'block',
    shape: 'box',
    position: { x, y, z },
    velocity: { x: 0, y: 0, z: 0 },
    quaternion: quatFromAxisAngle({ x: 0, y: 1, z: 0 }, ry),
    angularVelocity: { x: 0, y: 0, z: 0 },
    mass,
    invMass: 1 / mass,
    halfExtents: { x: w * 0.5, y: h * 0.5, z: d * 0.5 },
    radius: Math.sqrt(w * w + h * h + d * d) * 0.5,
    invInertiaLocal: { x: 1 / ix, y: 1 / iy, z: 1 / iz },
    restitution: props.restitution,
    friction: props.friction,
    hp: props.hp,
    maxHp: props.hp,
    damageThreshold: props.damageThreshold,
    scoreValue: props.score,
    material,
    isStatic: false,
    isSleeping: true,
    sleepTimer: 0,
    alive: true,
    launched: true,
    hitFlashTimer: 0,
    damageMultiplier: 1,
    lastImpactSpeed: 0,
    groundSlideDustCooldown: 0,
  };
}

export function createPigBody(
  id: string,
  x: number,
  y: number,
  z: number,
  radius: number,
  variant: PigVariant,
): RigidBody {
  const props = PIG_VARIANT_PROPS[variant];
  const inertia = (2 / 5) * props.mass * radius * radius;
  return {
    id,
    kind: 'pig',
    shape: 'sphere',
    position: { x, y, z },
    velocity: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    mass: props.mass,
    invMass: 1 / props.mass,
    halfExtents: { x: radius, y: radius, z: radius },
    radius,
    invInertiaLocal: { x: 1 / inertia, y: 1 / inertia, z: 1 / inertia },
    restitution: 0.3,
    friction: 0.55,
    hp: props.hp,
    maxHp: props.hp,
    damageThreshold: props.damageThreshold,
    scoreValue: props.score,
    pigVariant: variant,
    isStatic: false,
    isSleeping: true,
    sleepTimer: 0,
    alive: true,
    launched: true,
    hitFlashTimer: 0,
    damageMultiplier: 1,
    lastImpactSpeed: 0,
    groundSlideDustCooldown: 0,
  };
}

export function createBirdBody(
  id: string,
  birdType: BirdType,
  x: number,
  y: number,
  z: number,
): RigidBody {
  const props = BIRD_PHYSICS_PROPS[birdType];
  const inertia = (2 / 5) * props.mass * props.radius * props.radius;
  return {
    id,
    kind: 'bird',
    shape: 'sphere',
    position: { x, y, z },
    velocity: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    mass: props.mass,
    invMass: 1 / props.mass,
    halfExtents: { x: props.radius, y: props.radius, z: props.radius },
    radius: props.radius,
    invInertiaLocal: { x: 1 / inertia, y: 1 / inertia, z: 1 / inertia },
    restitution: props.restitution,
    friction: props.friction,
    hp: 9999,
    maxHp: 9999,
    damageThreshold: 999,
    scoreValue: 0,
    birdType,
    isStatic: false,
    isSleeping: false,
    sleepTimer: 0,
    alive: true,
    launched: false,
    hitFlashTimer: 0,
    damageMultiplier: props.damageMultiplier,
    lastImpactSpeed: 0,
    groundSlideDustCooldown: 0,
  };
}

export function wakeAllNearby(world: PhysicsWorld, origin: Vec3, radius: number): void {
  const r2 = radius * radius;
  for (const b of world.bodies) {
    if (!b.alive || b.isStatic) continue;
    const dx = b.position.x - origin.x;
    const dy = b.position.y - origin.y;
    const dz = b.position.z - origin.z;
    if (dx * dx + dy * dy + dz * dz <= r2) {
      b.isSleeping = false;
      b.sleepTimer = 0;
    }
  }
}

function wakeAllBodies(world: PhysicsWorld): void {
  for (const b of world.bodies) {
    if (b.alive && !b.isStatic) {
      b.isSleeping = false;
      b.sleepTimer = 0;
    }
  }
}

// --- Damage & Collision Event Accounting ---

function applyImpactDamage(
  world: PhysicsWorld,
  body: RigidBody,
  impactSpeed: number,
  contactPoint: Vec3,
  other: RigidBody | null,
  contactNormal?: Vec3,
): void {
  if (!body.alive || body.kind === 'bird') return;
  if (world.simTime < 0.65 && (!other || other.kind !== 'bird')) {
    // Ignore initial settling impulses before any bird impact
    return;
  }

  const mult = other ? other.damageMultiplier : 0.85;
  const massFactor = other ? Math.min(2.6, Math.max(0.45, other.mass / Math.max(0.5, body.mass))) : 0.9;
  const effectiveSpeed = impactSpeed * mult * Math.sqrt(massFactor);

  if (effectiveSpeed <= body.damageThreshold) return;

  // Compute incoming impact direction vector for directional fracture & crack placement
  let dirX = body.position.x - contactPoint.x;
  let dirY = body.position.y - contactPoint.y;
  let dirZ = body.position.z - contactPoint.z;
  if (other) {
    const dvx = other.velocity.x - body.velocity.x;
    const dvy = other.velocity.y - body.velocity.y;
    const dvz = other.velocity.z - body.velocity.z;
    const dvLen = Math.hypot(dvx, dvy, dvz);
    if (dvLen > 0.5) {
      dirX = dvx / dvLen;
      dirY = dvy / dvLen;
      dirZ = dvz / dvLen;
    }
  } else if (contactNormal) {
    dirX = -contactNormal.x;
    dirY = -contactNormal.y;
    dirZ = -contactNormal.z;
  }
  const dirLen = Math.hypot(dirX, dirY, dirZ) || 1;
  const impactDir = { x: dirX / dirLen, y: dirY / dirLen, z: dirZ / dirLen };

  body.lastImpactPoint = { ...contactPoint };
  body.lastImpactDir = impactDir;
  body.lastImpactSpeed = effectiveSpeed;

  const damage = (effectiveSpeed - body.damageThreshold) * 6.8;
  body.hp -= damage;
  body.hitFlashTimer = 0.06;

  if (body.hp <= 0) {
    body.alive = false;
    world.events.push({
      type: body.kind === 'pig' ? 'pig_pop' : 'destroy',
      position: { ...body.position },
      intensity: Math.min(1.5, damage / 35 + 0.4),
      material: body.kind === 'pig' ? 'pig' : body.material,
      bodyId: body.id,
      scoreDelta: body.scoreValue,
      impactPoint: { ...contactPoint },
      impactDir,
      impulse: effectiveSpeed,
    });
  } else if (damage > 3.5) {
    world.events.push({
      type: 'impact',
      position: { ...contactPoint },
      intensity: Math.min(1.0, damage / 40),
      material: body.kind === 'pig' ? 'pig' : body.material,
      bodyId: body.id,
      scoreDelta: Math.round(damage * 4),
      impactPoint: { ...contactPoint },
      impactDir,
      impulse: effectiveSpeed,
    });
  }
}

// --- Contact Manifold Solver ---

interface ContactPoint {
  point: Vec3;
  normal: Vec3; // points from A -> B
  penetration: number;
}

function solveContactPoint(
  world: PhysicsWorld,
  a: RigidBody,
  b: RigidBody | null,
  cp: ContactPoint,
  reportDamage: boolean,
  contactCount = 1,
): void {
  const n = cp.normal;
  const aStatic = a.isStatic || a.isSleeping;
  const bStatic = !b || b.isStatic || b.isSleeping;
  const invMassA = aStatic ? 0 : a.invMass;
  const invMassB = bStatic ? 0 : b!.invMass;
  const totalInvMass = invMassA + invMassB;
  if (totalInvMass <= 0) return;

  // Positional correction divided across manifold contacts to avoid over-correction
  const slop = 0.003;
  const percent = 0.45 / Math.max(1, contactCount);
  const corrMag = (Math.max(cp.penetration - slop, 0) / totalInvMass) * percent;
  if (corrMag > 0) {
    if (!aStatic) {
      a.position.x -= n.x * corrMag * invMassA;
      a.position.y -= n.y * corrMag * invMassA;
      a.position.z -= n.z * corrMag * invMassA;
    }
    if (b && !bStatic) {
      b.position.x += n.x * corrMag * invMassB;
      b.position.y += n.y * corrMag * invMassB;
      b.position.z += n.z * corrMag * invMassB;
    }
  }

  const rA = {
    x: cp.point.x - a.position.x,
    y: cp.point.y - a.position.y,
    z: cp.point.z - a.position.z,
  };
  const rB = b
    ? {
        x: cp.point.x - b.position.x,
        y: cp.point.y - b.position.y,
        z: cp.point.z - b.position.z,
      }
    : { x: 0, y: 0, z: 0 };

  const wxrA = aStatic ? { x: 0, y: 0, z: 0 } : v3Cross(a.angularVelocity, rA);
  const velA = aStatic
    ? { x: 0, y: 0, z: 0 }
    : {
        x: a.velocity.x + wxrA.x,
        y: a.velocity.y + wxrA.y,
        z: a.velocity.z + wxrA.z,
      };

  let velB = { x: 0, y: 0, z: 0 };
  if (b && !bStatic) {
    const wxrB = v3Cross(b.angularVelocity, rB);
    velB = {
      x: b.velocity.x + wxrB.x,
      y: b.velocity.y + wxrB.y,
      z: b.velocity.z + wxrB.z,
    };
  }

  const rv = {
    x: velB.x - velA.x,
    y: velB.y - velA.y,
    z: velB.z - velA.z,
  };

  const velAlongNormal = v3Dot(rv, n);
  if (velAlongNormal > 0) return; // separating

  const impactSpeed = -velAlongNormal;
  if (impactSpeed > 1.15) {
    if (a.isSleeping || (b && b.isSleeping)) {
      wakeAllNearby(world, cp.point, 5.0);
    }
    a.isSleeping = false;
    a.sleepTimer = 0;
    if (b) {
      b.isSleeping = false;
      b.sleepTimer = 0;
    }
  }

  const e =
    impactSpeed < 1.5
      ? 0
      : b
        ? Math.min(a.restitution, b.restitution)
        : a.restitution;

  const rAxN = v3Cross(rA, n);
  const invIA_rAxN = aStatic ? { x: 0, y: 0, z: 0 } : applyWorldInvInertia(a, rAxN);
  const angTermA = aStatic ? 0 : v3Dot(v3Cross(invIA_rAxN, rA), n);

  let angTermB = 0;
  if (b && !bStatic) {
    const rBxN = v3Cross(rB, n);
    const invIB_rBxN = applyWorldInvInertia(b, rBxN);
    angTermB = v3Dot(v3Cross(invIB_rBxN, rB), n);
  }

  const denom = totalInvMass + angTermA + angTermB;
  if (denom <= 1e-8) return;

  const j = (-(1 + e) * velAlongNormal) / denom;
  const impulse = { x: n.x * j, y: n.y * j, z: n.z * j };

  if (!aStatic) {
    a.velocity.x -= impulse.x * invMassA;
    a.velocity.y -= impulse.y * invMassA;
    a.velocity.z -= impulse.z * invMassA;
    const torqueA = v3Cross(rA, impulse);
    const dAngA = applyWorldInvInertia(a, torqueA);
    a.angularVelocity.x -= dAngA.x;
    a.angularVelocity.y -= dAngA.y;
    a.angularVelocity.z -= dAngA.z;
  }

  if (b && !bStatic) {
    b.velocity.x += impulse.x * invMassB;
    b.velocity.y += impulse.y * invMassB;
    b.velocity.z += impulse.z * invMassB;
    const torqueB = v3Cross(rB, impulse);
    const dAngB = applyWorldInvInertia(b, torqueB);
    b.angularVelocity.x += dAngB.x;
    b.angularVelocity.y += dAngB.y;
    b.angularVelocity.z += dAngB.z;
  }

  // Friction impulse
  const tangent = {
    x: rv.x - n.x * velAlongNormal,
    y: rv.y - n.y * velAlongNormal,
    z: rv.z - n.z * velAlongNormal,
  };
  const tLen = v3Len(tangent);
  if (tLen > 1e-5) {
    tangent.x /= tLen;
    tangent.y /= tLen;
    tangent.z /= tLen;

    const rAxT = v3Cross(rA, tangent);
    const tAngA = aStatic ? 0 : v3Dot(v3Cross(applyWorldInvInertia(a, rAxT), rA), tangent);
    let tAngB = 0;
    if (b && !bStatic) {
      const rBxT = v3Cross(rB, tangent);
      tAngB = v3Dot(v3Cross(applyWorldInvInertia(b, rBxT), rB), tangent);
    }
    const jtRaw = -v3Dot(rv, tangent) / (totalInvMass + tAngA + tAngB);
    const mu = b ? Math.sqrt(a.friction * b.friction) : a.friction;
    const jt = Math.max(-j * mu, Math.min(j * mu, jtRaw));

    const fImp = { x: tangent.x * jt, y: tangent.y * jt, z: tangent.z * jt };
    if (!aStatic) {
      a.velocity.x -= fImp.x * invMassA;
      a.velocity.y -= fImp.y * invMassA;
      a.velocity.z -= fImp.z * invMassA;
      const fAngA = applyWorldInvInertia(a, v3Cross(rA, fImp));
      a.angularVelocity.x -= fAngA.x;
      a.angularVelocity.y -= fAngA.y;
      a.angularVelocity.z -= fAngA.z;
    }

    if (b && !bStatic) {
      b.velocity.x += fImp.x * invMassB;
      b.velocity.y += fImp.y * invMassB;
      b.velocity.z += fImp.z * invMassB;
      const fAngB = applyWorldInvInertia(b, v3Cross(rB, fImp));
      b.angularVelocity.x += fAngB.x;
      b.angularVelocity.y += fAngB.y;
      b.angularVelocity.z += fAngB.z;
    }
  }

  if (reportDamage) {
    applyImpactDamage(world, a, impactSpeed, cp.point, b, n);
    if (b) {
      applyImpactDamage(world, b, impactSpeed, cp.point, a, { x: -n.x, y: -n.y, z: -n.z });
    } else {
      // Ground slam or sliding dust puff at contact point
      const horizSlideSpeed = Math.hypot(rv.x - n.x * velAlongNormal, rv.z - n.z * velAlongNormal);
      if (impactSpeed > 4.5 && a.kind === 'bird') {
        world.events.push({
          type: 'impact',
          position: { ...cp.point },
          intensity: Math.min(1, impactSpeed / 22),
          material: 'ground',
          bodyId: a.id,
          scoreDelta: 0,
          isGroundContact: true,
        });
      } else if (
        world.simTime > 0.65 &&
        a.kind === 'block' &&
        a.groundSlideDustCooldown <= 0 &&
        (impactSpeed > 2.2 || horizSlideSpeed > 1.8)
      ) {
        a.groundSlideDustCooldown = 0.16;
        world.events.push({
          type: 'impact',
          position: { ...cp.point },
          intensity: Math.min(1, Math.max(impactSpeed, horizSlideSpeed) / 14),
          material: a.material ?? 'ground',
          bodyId: a.id,
          scoreDelta: 0,
          isGroundContact: true,
        });
      }
    }
  }
}

// --- Collision Detection Primitives ---

function collideSphereGround(
  world: PhysicsWorld,
  body: RigidBody,
  reportDamage: boolean,
): void {
  const lowestY = body.position.y - body.radius;
  if (lowestY < 0) {
    solveContactPoint(
      world,
      body,
      null,
      {
        point: { x: body.position.x, y: 0, z: body.position.z },
        normal: { x: 0, y: -1, z: 0 }, // A -> ground (downward)
        penetration: -lowestY,
      },
      reportDamage,
    );
  }
}

function collideBoxGround(
  world: PhysicsWorld,
  body: RigidBody,
  reportDamage: boolean,
): void {
  const axes = getBoxAxes(body.quaternion);
  const hx = body.halfExtents.x;
  const hy = body.halfExtents.y;
  const hz = body.halfExtents.z;

  // Quick broadphase check
  if (body.position.y - body.radius > 0.02) return;

  const contacts: ContactPoint[] = [];
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sy = -1; sy <= 1; sy += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        const px =
          body.position.x +
          axes[0].x * sx * hx +
          axes[1].x * sy * hy +
          axes[2].x * sz * hz;
        const py =
          body.position.y +
          axes[0].y * sx * hx +
          axes[1].y * sy * hy +
          axes[2].y * sz * hz;
        const pz =
          body.position.z +
          axes[0].z * sx * hx +
          axes[1].z * sy * hy +
          axes[2].z * sz * hz;

        if (py < 0) {
          contacts.push({
            point: { x: px, y: 0, z: pz },
            normal: { x: 0, y: -1, z: 0 },
            penetration: -py,
          });
        }
      }
    }
  }

  const rev = (world.simTime * 1000 | 0) % 2 === 1;
  for (let k = 0; k < contacts.length; k++) {
    const i = rev ? contacts.length - 1 - k : k;
    solveContactPoint(world, body, null, contacts[i], reportDamage && k === 0, contacts.length);
  }
}

function collideSphereSphere(
  world: PhysicsWorld,
  a: RigidBody,
  b: RigidBody,
  reportDamage: boolean,
): void {
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const dz = b.position.z - a.position.z;
  const rSum = a.radius + b.radius;
  const distSq = dx * dx + dy * dy + dz * dz;
  if (distSq >= rSum * rSum) return;

  const dist = Math.sqrt(distSq);
  const n =
    dist > 1e-6
      ? { x: dx / dist, y: dy / dist, z: dz / dist }
      : { x: 0, y: 1, z: 0 };
  const penetration = rSum - dist;
  const point = {
    x: a.position.x + n.x * (a.radius - penetration * 0.5),
    y: a.position.y + n.y * (a.radius - penetration * 0.5),
    z: a.position.z + n.z * (a.radius - penetration * 0.5),
  };

  solveContactPoint(world, a, b, { point, normal: n, penetration }, reportDamage);
}

function collideSphereBox(
  world: PhysicsWorld,
  sphere: RigidBody,
  box: RigidBody,
  reportDamage: boolean,
): void {
  // Transform sphere center to box local space
  const rel = {
    x: sphere.position.x - box.position.x,
    y: sphere.position.y - box.position.y,
    z: sphere.position.z - box.position.z,
  };
  const localCenter = rotateVecByQuatInv(rel, box.quaternion);
  const hx = box.halfExtents.x;
  const hy = box.halfExtents.y;
  const hz = box.halfExtents.z;

  const clamped = {
    x: Math.max(-hx, Math.min(hx, localCenter.x)),
    y: Math.max(-hy, Math.min(hy, localCenter.y)),
    z: Math.max(-hz, Math.min(hz, localCenter.z)),
  };

  const diff = {
    x: localCenter.x - clamped.x,
    y: localCenter.y - clamped.y,
    z: localCenter.z - clamped.z,
  };
  const distSq = v3LenSq(diff);
  if (distSq >= sphere.radius * sphere.radius) return;

  let localNormal: Vec3;
  let penetration: number;
  let localClosest = clamped;

  if (distSq > 1e-8) {
    const dist = Math.sqrt(distSq);
    // Normal from sphere -> box is -diff/dist
    localNormal = { x: -diff.x / dist, y: -diff.y / dist, z: -diff.z / dist };
    penetration = sphere.radius - dist;
  } else {
    // Sphere center inside box: push out nearest face
    const dx = hx - Math.abs(localCenter.x);
    const dy = hy - Math.abs(localCenter.y);
    const dz = hz - Math.abs(localCenter.z);
    if (dx < dy && dx < dz) {
      const sign = localCenter.x >= 0 ? 1 : -1;
      localNormal = { x: -sign, y: 0, z: 0 };
      localClosest = { x: sign * hx, y: localCenter.y, z: localCenter.z };
      penetration = dx + sphere.radius;
    } else if (dy < dz) {
      const sign = localCenter.y >= 0 ? 1 : -1;
      localNormal = { x: 0, y: -sign, z: 0 };
      localClosest = { x: localCenter.x, y: sign * hy, z: localCenter.z };
      penetration = dy + sphere.radius;
    } else {
      const sign = localCenter.z >= 0 ? 1 : -1;
      localNormal = { x: 0, y: 0, z: -sign };
      localClosest = { x: localCenter.x, y: localCenter.y, z: sign * hz };
      penetration = dz + sphere.radius;
    }
  }

  const worldNormal = rotateVecByQuat(localNormal, box.quaternion);
  const worldClosest = rotateVecByQuat(localClosest, box.quaternion);
  const contactPoint = {
    x: box.position.x + worldClosest.x,
    y: box.position.y + worldClosest.y,
    z: box.position.z + worldClosest.z,
  };

  solveContactPoint(
    world,
    sphere,
    box,
    { point: contactPoint, normal: worldNormal, penetration },
    reportDamage,
  );
}

// --- SAT + Face-Clipped OBB-OBB Collision ---

function getFaceVertices(
  center: Vec3,
  axes: [Vec3, Vec3, Vec3],
  ext: [number, number, number],
  faceAxisIdx: number,
  faceSign: number,
): Vec3[] {
  const uIdx = (faceAxisIdx + 1) % 3;
  const vIdx = (faceAxisIdx + 2) % 3;
  const nAxis = axes[faceAxisIdx];
  const uAxis = axes[uIdx];
  const vAxis = axes[vIdx];

  const fc = {
    x: center.x + nAxis.x * ext[faceAxisIdx] * faceSign,
    y: center.y + nAxis.y * ext[faceAxisIdx] * faceSign,
    z: center.z + nAxis.z * ext[faceAxisIdx] * faceSign,
  };

  const eu = ext[uIdx];
  const ev = ext[vIdx];
  const signs: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];

  return signs.map(([su, sv]) => ({
    x: fc.x + uAxis.x * eu * su + vAxis.x * ev * sv,
    y: fc.y + uAxis.y * eu * su + vAxis.y * ev * sv,
    z: fc.z + uAxis.z * eu * su + vAxis.z * ev * sv,
  }));
}

function clipPolyAgainstPlane(poly: Vec3[], planePoint: Vec3, planeNormal: Vec3): Vec3[] {
  if (poly.length === 0) return [];
  const out: Vec3[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const dCur =
      (cur.x - planePoint.x) * planeNormal.x +
      (cur.y - planePoint.y) * planeNormal.y +
      (cur.z - planePoint.z) * planeNormal.z;
    const dPrev =
      (prev.x - planePoint.x) * planeNormal.x +
      (prev.y - planePoint.y) * planeNormal.y +
      (prev.z - planePoint.z) * planeNormal.z;

    const curIn = dCur <= 1e-4;
    const prevIn = dPrev <= 1e-4;

    if (curIn !== prevIn) {
      const denom = dPrev - dCur;
      const t = Math.abs(denom) > 1e-8 ? dPrev / denom : 0.5;
      out.push({
        x: prev.x + (cur.x - prev.x) * t,
        y: prev.y + (cur.y - prev.y) * t,
        z: prev.z + (cur.z - prev.z) * t,
      });
    }
    if (curIn) {
      out.push(cur);
    }
  }
  return out;
}

function collideBoxBox(
  world: PhysicsWorld,
  a: RigidBody,
  b: RigidBody,
  reportDamage: boolean,
): void {
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const dz = b.position.z - a.position.z;
  const maxR = a.radius + b.radius;
  if (dx * dx + dy * dy + dz * dz > maxR * maxR) return;

  const axesA = getBoxAxes(a.quaternion);
  const axesB = getBoxAxes(b.quaternion);
  const extA: [number, number, number] = [a.halfExtents.x, a.halfExtents.y, a.halfExtents.z];
  const extB: [number, number, number] = [b.halfExtents.x, b.halfExtents.y, b.halfExtents.z];
  const tVec = { x: dx, y: dy, z: dz };

  // Compute rotation matrix R[i][j] = dot(A[i], B[j])
  const R: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const AbsR: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      R[i][j] = v3Dot(axesA[i], axesB[j]);
      AbsR[i][j] = Math.abs(R[i][j]) + 1e-6;
    }
  }

  let minPen = Infinity;
  let bestAxisIndex = -1; // 0-2: A faces, 3-5: B faces, 6-14: edge cross
  let bestAxis: Vec3 = { x: 0, y: 1, z: 0 };

  // Test 3 axes of A
  for (let i = 0; i < 3; i++) {
    const ra = extA[i];
    const rb = extB[0] * AbsR[i][0] + extB[1] * AbsR[i][1] + extB[2] * AbsR[i][2];
    const dist = v3Dot(tVec, axesA[i]);
    const pen = ra + rb - Math.abs(dist);
    if (pen <= 0) return;
    if (pen < minPen) {
      minPen = pen;
      bestAxisIndex = i;
      const sign = dist >= 0 ? 1 : -1;
      bestAxis = {
        x: axesA[i].x * sign,
        y: axesA[i].y * sign,
        z: axesA[i].z * sign,
      };
    }
  }

  // Test 3 axes of B
  for (let j = 0; j < 3; j++) {
    const ra = extA[0] * AbsR[0][j] + extA[1] * AbsR[1][j] + extA[2] * AbsR[2][j];
    const rb = extB[j];
    const dist = v3Dot(tVec, axesB[j]);
    const pen = ra + rb - Math.abs(dist);
    if (pen <= 0) return;
    // Slight bias toward face contacts over near-tie to stabilize stacks
    if (pen < minPen - 1e-4) {
      minPen = pen;
      bestAxisIndex = 3 + j;
      const sign = dist >= 0 ? 1 : -1;
      bestAxis = {
        x: axesB[j].x * sign,
        y: axesB[j].y * sign,
        z: axesB[j].z * sign,
      };
    }
  }

  // Test 9 cross-product edge axes
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const cross = v3Cross(axesA[i], axesB[j]);
      const lenSq = v3LenSq(cross);
      if (lenSq < 1e-5) continue; // parallel edges
      const invLen = 1 / Math.sqrt(lenSq);
      const axis = { x: cross.x * invLen, y: cross.y * invLen, z: cross.z * invLen };

      const ra =
        extA[0] * Math.abs(v3Dot(axesA[0], axis)) +
        extA[1] * Math.abs(v3Dot(axesA[1], axis)) +
        extA[2] * Math.abs(v3Dot(axesA[2], axis));
      const rb =
        extB[0] * Math.abs(v3Dot(axesB[0], axis)) +
        extB[1] * Math.abs(v3Dot(axesB[1], axis)) +
        extB[2] * Math.abs(v3Dot(axesB[2], axis));

      const dist = v3Dot(tVec, axis);
      const pen = ra + rb - Math.abs(dist);
      if (pen <= 0) return;
      // Favor face contacts unless edge penetration is clearly smaller
      if (pen * 1.05 < minPen) {
        minPen = pen;
        bestAxisIndex = 6 + i * 3 + j;
        const sign = dist >= 0 ? 1 : -1;
        bestAxis = { x: axis.x * sign, y: axis.y * sign, z: axis.z * sign };
      }
    }
  }

  if (bestAxisIndex < 0) return;

  const contacts: ContactPoint[] = [];

  if (bestAxisIndex < 6) {
    // Face-to-face / face-to-vertex clipping manifold
    const refIsA = bestAxisIndex < 3;
    const refBody = refIsA ? a : b;
    const incBody = refIsA ? b : a;
    const refAxes = refIsA ? axesA : axesB;
    const incAxes = refIsA ? axesB : axesA;
    const refExt = refIsA ? extA : extB;
    const incExt = refIsA ? extB : extA;
    const refAxisIdx = refIsA ? bestAxisIndex : bestAxisIndex - 3;

    // Normal outward from refBody toward incBody
    const refOutNormal = refIsA
      ? bestAxis
      : { x: -bestAxis.x, y: -bestAxis.y, z: -bestAxis.z };
    const refSign = v3Dot(refOutNormal, refAxes[refAxisIdx]) >= 0 ? 1 : -1;

    // Find incident face most anti-parallel to refOutNormal
    let incFaceIdx = 0;
    let incFaceSign = 1;
    let minDot = Infinity;
    for (let k = 0; k < 3; k++) {
      const d = v3Dot(incAxes[k], refOutNormal);
      if (d < minDot) {
        minDot = d;
        incFaceIdx = k;
        incFaceSign = 1;
      }
      if (-d < minDot) {
        minDot = -d;
        incFaceIdx = k;
        incFaceSign = -1;
      }
    }

    let poly = getFaceVertices(
      incBody.position,
      incAxes,
      incExt,
      incFaceIdx,
      incFaceSign,
    );

    // Clip incident face against the 4 side planes of the reference face
    const uIdx = (refAxisIdx + 1) % 3;
    const vIdx = (refAxisIdx + 2) % 3;
    const refPlaneOrigin = {
      x: refBody.position.x + refAxes[refAxisIdx].x * refExt[refAxisIdx] * refSign,
      y: refBody.position.y + refAxes[refAxisIdx].y * refExt[refAxisIdx] * refSign,
      z: refBody.position.z + refAxes[refAxisIdx].z * refExt[refAxisIdx] * refSign,
    };

    for (const sideIdx of [uIdx, vIdx]) {
      for (const sideSign of [-1, 1]) {
        const planeN = {
          x: refAxes[sideIdx].x * sideSign,
          y: refAxes[sideIdx].y * sideSign,
          z: refAxes[sideIdx].z * sideSign,
        };
        const planeP = {
          x: refBody.position.x + planeN.x * refExt[sideIdx],
          y: refBody.position.y + planeN.y * refExt[sideIdx],
          z: refBody.position.z + planeN.z * refExt[sideIdx],
        };
        poly = clipPolyAgainstPlane(poly, planeP, planeN);
      }
    }

    for (const pt of poly) {
      const sep =
        (pt.x - refPlaneOrigin.x) * refOutNormal.x +
        (pt.y - refPlaneOrigin.y) * refOutNormal.y +
        (pt.z - refPlaneOrigin.z) * refOutNormal.z;
      if (sep <= 0.015) {
        contacts.push({
          point: pt,
          normal: bestAxis, // always A -> B
          penetration: Math.max(0.001, -sep),
        });
      }
    }
  }

  if (contacts.length === 0) {
    // Fallback contact at midpoint along bestAxis
    const pA = {
      x: a.position.x + bestAxis.x * Math.min(a.radius, minPen * 0.5 + extA[0] * 0.5),
      y: a.position.y + bestAxis.y * Math.min(a.radius, minPen * 0.5 + extA[1] * 0.5),
      z: a.position.z + bestAxis.z * Math.min(a.radius, minPen * 0.5 + extA[2] * 0.5),
    };
    const pB = {
      x: b.position.x - bestAxis.x * Math.min(b.radius, minPen * 0.5 + extB[0] * 0.5),
      y: b.position.y - bestAxis.y * Math.min(b.radius, minPen * 0.5 + extB[1] * 0.5),
      z: b.position.z - bestAxis.z * Math.min(b.radius, minPen * 0.5 + extB[2] * 0.5),
    };
    contacts.push({
      point: {
        x: (pA.x + pB.x) * 0.5,
        y: (pA.y + pB.y) * 0.5,
        z: (pA.z + pB.z) * 0.5,
      },
      normal: bestAxis,
      penetration: minPen,
    });
  }

  const rev = ((world.simTime * 1000) | 0) % 2 === 1;
  for (let k = 0; k < contacts.length; k++) {
    const i = rev ? contacts.length - 1 - k : k;
    solveContactPoint(world, a, b, contacts[i], reportDamage && k === 0, contacts.length);
  }
}

// --- Physics Step ---

export function stepPhysicsWorld(world: PhysicsWorld, rawDt: number): CollisionEvent[] {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  if (dt <= 0) return [];

  world.events.length = 0;
  const substeps = 4;
  const subDt = dt / substeps;

  for (let step = 0; step < substeps; step++) {
    world.simTime += subDt;

    // 1. Integrate forces & velocities
    for (const b of world.bodies) {
      if (!b.alive || b.isStatic || !b.launched) continue;
      if (b.hitFlashTimer > 0) {
        b.hitFlashTimer = Math.max(0, b.hitFlashTimer - subDt);
      }
      if (b.groundSlideDustCooldown > 0) {
        b.groundSlideDustCooldown = Math.max(0, b.groundSlideDustCooldown - subDt);
      }

      if (b.isSleeping) continue;

      b.velocity.y += world.gravity * subDt;

      // Mild air damping
      const linDamp = Math.pow(0.992, subDt * 60);
      const angDamp = Math.pow(0.975, subDt * 60);
      b.velocity.x *= linDamp;
      b.velocity.y *= linDamp;
      b.velocity.z *= linDamp;
      b.angularVelocity.x *= angDamp;
      b.angularVelocity.y *= angDamp;
      b.angularVelocity.z *= angDamp;
    }

    // 2. Iterative constraint & contact resolution (Symmetric Gauss-Seidel)
    const solverIters = 8;
    const bodies = world.bodies;
    const count = bodies.length;

    for (let iter = 0; iter < solverIters; iter++) {
      const reportDamage = iter === 0;
      const reverse = iter % 2 === 1;

      for (let idx = 0; idx < count; idx++) {
        const i = reverse ? count - 1 - idx : idx;
        const a = bodies[i];
        if (!a.alive || !a.launched || a.isSleeping) continue;

        if (a.shape === 'sphere') {
          collideSphereGround(world, a, reportDamage);
        } else {
          collideBoxGround(world, a, reportDamage);
        }
      }

      for (let idxA = 0; idxA < count; idxA++) {
        const i = reverse ? count - 1 - idxA : idxA;
        const a = bodies[i];
        if (!a.alive || !a.launched) continue;

        for (let j = i + 1; j < count; j++) {
          const b = bodies[j];
          if (!b.alive || !b.launched) continue;
          if (a.isSleeping && b.isSleeping) continue;

          if (a.shape === 'sphere' && b.shape === 'sphere') {
            collideSphereSphere(world, a, b, reportDamage);
          } else if (a.shape === 'sphere' && b.shape === 'box') {
            collideSphereBox(world, a, b, reportDamage);
          } else if (a.shape === 'box' && b.shape === 'sphere') {
            collideSphereBox(world, b, a, reportDamage);
          } else {
            collideBoxBox(world, a, b, reportDamage);
          }
        }
      }
    }

    // 3. Integrate positions & orientations + sleeping check
    for (const b of world.bodies) {
      if (!b.alive || b.isStatic || !b.launched || b.isSleeping) continue;

      b.position.x += b.velocity.x * subDt;
      b.position.y += b.velocity.y * subDt;
      b.position.z += b.velocity.z * subDt;

      // Integrate quaternion: q += 0.5 * (w * q) * dt
      const wx = b.angularVelocity.x;
      const wy = b.angularVelocity.y;
      const wz = b.angularVelocity.z;
      const qx = b.quaternion.x;
      const qy = b.quaternion.y;
      const qz = b.quaternion.z;
      const qw = b.quaternion.w;

      b.quaternion.x += 0.5 * (wx * qw + wy * qz - wz * qy) * subDt;
      b.quaternion.y += 0.5 * (wy * qw + wz * qx - wx * qz) * subDt;
      b.quaternion.z += 0.5 * (wz * qw + wx * qy - wy * qx) * subDt;
      b.quaternion.w += 0.5 * (-wx * qx - wy * qy - wz * qz) * subDt;
      quatNormalize(b.quaternion);

      // Out-of-bounds cleanup
      if (b.position.y < -15 || Math.abs(b.position.x) > 120 || Math.abs(b.position.z) > 120) {
        if (b.kind === 'pig') {
          b.alive = false;
          world.events.push({
            type: 'pig_pop',
            position: { ...b.position },
            intensity: 0.7,
            material: 'pig',
            bodyId: b.id,
            scoreDelta: b.scoreValue,
          });
        } else if (b.kind === 'block') {
          b.alive = false;
        }
      }

      // Sleep settling
      const linSq = v3LenSq(b.velocity);
      const angSq = v3LenSq(b.angularVelocity);
      if (linSq < 0.045 && angSq < 0.06 && b.kind !== 'bird') {
        b.sleepTimer += subDt;
        if (b.sleepTimer > 0.45) {
          b.isSleeping = true;
          b.velocity.x = 0;
          b.velocity.y = 0;
          b.velocity.z = 0;
          b.angularVelocity.x = 0;
          b.angularVelocity.y = 0;
          b.angularVelocity.z = 0;
        }
      } else {
        b.sleepTimer = 0;
      }
    }
  }

  return world.events;
}

// --- Bird Abilities ---

export function triggerBirdAbility(
  world: PhysicsWorld,
  bird: RigidBody,
): CollisionEvent[] {
  if (!bird.alive || !bird.launched || !bird.birdType) return [];
  const emitted: CollisionEvent[] = [];

  if (bird.birdType === 'red') {
    // Solid impact shockwave pulse with quadratic distance attenuation
    const radius = 5.4;
    wakeAllNearby(world, bird.position, radius + 2);
    for (const b of world.bodies) {
      if (!b.alive || b === bird) continue;
      const dx = b.position.x - bird.position.x;
      const dy = b.position.y - bird.position.y;
      const dz = b.position.z - bird.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < radius && dist > 1e-4) {
        const normD = dist / radius;
        const falloff = Math.max(0, 1 - normD * normD);
        const push = (28 * falloff) / Math.max(0.8, b.mass);
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;
        b.velocity.x += nx * push;
        b.velocity.y += (ny + 0.35) * push;
        b.velocity.z += nz * push;
        b.isSleeping = false;
        if (b.kind !== 'bird') {
          b.lastImpactPoint = { ...bird.position };
          b.lastImpactDir = { x: nx, y: ny, z: nz };
          applyImpactDamage(world, b, 11 * falloff + b.damageThreshold, bird.position, bird);
        }
      }
    }
    const ev: CollisionEvent = {
      type: 'shockwave',
      position: { ...bird.position },
      intensity: 0.9,
      birdType: 'red',
      scoreDelta: 0,
    };
    emitted.push(ev);
  } else if (bird.birdType === 'yellow') {
    // Supersonic boost along current flight direction (or forward if slowed)
    const speed = v3Len(bird.velocity);
    let nx = 1;
    let ny = -0.05;
    let nz = 0;
    if (speed > 0.5) {
      nx = bird.velocity.x / speed;
      ny = bird.velocity.y / speed;
      nz = bird.velocity.z / speed;
    }
    const newSpeed = Math.max(42, speed * 2.35);
    bird.velocity.x = nx * newSpeed;
    bird.velocity.y = ny * newSpeed - 1.2;
    bird.velocity.z = nz * newSpeed;
    bird.damageMultiplier = 2.6;
    bird.isSleeping = false;
    const ev: CollisionEvent = {
      type: 'shockwave',
      position: { ...bird.position },
      intensity: 1.0,
      birdType: 'yellow',
      scoreDelta: 0,
    };
    emitted.push(ev);
  } else if (bird.birdType === 'black') {
    // Massive radial explosion with physical inverse-square/quadratic attenuation by mass
    const radius = 9.0;
    wakeAllBodies(world);
    for (const b of world.bodies) {
      if (!b.alive || b === bird) continue;
      const dx = b.position.x - bird.position.x;
      const dy = b.position.y - bird.position.y;
      const dz = b.position.z - bird.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < radius) {
        const safeDist = Math.max(0.35, dist);
        const normD = dist / radius;
        // Quadratic distance attenuation (strong near core, smooth decay to 0 at edge)
        const quadFalloff = (1 - normD * normD) / (1 + 0.35 * normD * normD);
        const nx = dx / safeDist;
        const ny = dy / safeDist;
        const nz = dz / safeDist;
        const impulseMag = 64 * quadFalloff;
        b.velocity.x += nx * (impulseMag / b.mass);
        b.velocity.y += (ny + 0.45) * (impulseMag / b.mass);
        b.velocity.z += nz * (impulseMag / b.mass);
        b.angularVelocity.x += (Math.random() - 0.5) * 16 * quadFalloff;
        b.angularVelocity.y += (Math.random() - 0.5) * 10 * quadFalloff;
        b.angularVelocity.z += (Math.random() - 0.5) * 16 * quadFalloff;
        b.isSleeping = false;

        if (b.kind !== 'bird') {
          const impactDir = { x: nx, y: ny, z: nz };
          const blastContact = {
            x: b.position.x - nx * Math.min(b.radius * 0.65, safeDist * 0.45),
            y: b.position.y - ny * Math.min(b.radius * 0.65, safeDist * 0.45),
            z: b.position.z - nz * Math.min(b.radius * 0.65, safeDist * 0.45),
          };
          b.lastImpactPoint = blastContact;
          b.lastImpactDir = impactDir;
          b.lastImpactSpeed = 24 * quadFalloff;

          const blastDmg = 225 * quadFalloff;
          b.hp -= blastDmg;
          b.hitFlashTimer = 0.08;
          if (b.hp <= 0) {
            b.alive = false;
            emitted.push({
              type: b.kind === 'pig' ? 'pig_pop' : 'destroy',
              position: { ...b.position },
              intensity: 1.35 * quadFalloff + 0.25,
              material: b.kind === 'pig' ? 'pig' : b.material,
              bodyId: b.id,
              scoreDelta: b.scoreValue,
              impactPoint: blastContact,
              impactDir,
              impulse: 24 * quadFalloff,
            });
          } else if (blastDmg > 12) {
            emitted.push({
              type: 'impact',
              position: blastContact,
              intensity: Math.min(1.0, blastDmg / 80),
              material: b.kind === 'pig' ? 'pig' : b.material,
              bodyId: b.id,
              scoreDelta: 0,
              impactPoint: blastContact,
              impactDir,
            });
          }
        }
      }
    }
    bird.alive = false;
    emitted.push({
      type: 'explosion',
      position: { ...bird.position },
      intensity: 1.6,
      birdType: 'black',
      scoreDelta: 0,
    });
  }

  return emitted;
}

export function isWorldSettled(world: PhysicsWorld): boolean {
  for (const b of world.bodies) {
    if (!b.alive || !b.launched || b.isSleeping) continue;
    const speedSq = v3LenSq(b.velocity);
    const angSq = v3LenSq(b.angularVelocity);
    if (b.kind === 'bird') {
      if (speedSq > 0.25 || b.position.y > b.radius + 0.35) return false;
    } else if (speedSq > 0.14 || angSq > 0.18) {
      return false;
    }
  }
  return true;
}

export function predictTrajectory(
  origin: Vec3,
  velocity: Vec3,
  gravity: number,
  steps = 26,
  dtStep = 0.08,
): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i * dtStep;
    const x = origin.x + velocity.x * t;
    const y = origin.y + velocity.y * t + 0.5 * gravity * t * t;
    const z = origin.z + velocity.z * t;
    if (y < 0.1) break;
    pts.push({ x, y, z });
  }
  return pts;
}

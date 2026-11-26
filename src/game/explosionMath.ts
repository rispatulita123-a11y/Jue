import type { Vec3 } from './types';

/**
 * Sedov-Taylor blast wave radius expansion: rapid initial supersonic push,
 * decelerating organically as atmospheric mass is swept up.
 */
export function computeShockwaveRadius(age: number, maxRadius: number, duration: number): number {
  if (age <= 0 || duration <= 0) return 0;
  const t = Math.min(1, age / duration);
  return maxRadius * Math.pow(t, 0.54);
}

/**
 * Acoustic/pressure wave transit delay (seconds) from epicenter to camera.
 */
export function computeAcousticTransitDelay(distanceMeters: number): number {
  const clamped = Math.max(0, distanceMeters);
  return Math.min(0.32, clamped / 95);
}

/**
 * Stochastic turbulent fireball light intensity envelope.
 * Produces an intense sub-50ms ignition spike followed by multi-frequency
 * blackbody flame flicker as soot crusts fold over incandescent plasma.
 */
export function computeStochasticFireIntensity(
  age: number,
  maxAge: number,
  elapsed: number,
): number {
  if (age < 0 || age >= maxAge || maxAge <= 0) return 0;
  const t = age / maxAge;
  const flashSpike = age < 0.06 ? 1.45 * (1 - age / 0.06) : 0;
  const envelope = Math.pow(1 - t, 1.85);
  const flicker =
    0.82 +
    0.22 * Math.sin(elapsed * 43.0 + age * 19.0) +
    0.14 * Math.cos(elapsed * 71.0 - age * 31.0);
  return Math.max(0, (envelope * flicker + flashSpike));
}

function potentialField(x: number, y: number, z: number, t: number): [number, number, number] {
  const p1 = Math.sin(y * 1.15 + t * 1.7) * Math.cos(z * 1.05 - t * 1.2);
  const p2 = Math.sin(z * 1.25 - t * 1.4) * Math.cos(x * 1.1 + t * 1.5);
  const p3 = Math.sin(x * 1.08 + t * 1.3) * Math.cos(y * 1.22 + t * 1.1);
  return [p1, p2, p3];
}

/**
 * Divergence-free-inspired 3D Curl Noise via finite differences of a smooth vector potential.
 */
export function computeCurlNoise3D(x: number, y: number, z: number, time: number): Vec3 {
  const eps = 0.08;
  const inv2Eps = 1 / (2 * eps);

  const [, py1, pz1] = potentialField(x + eps, y, z, time);
  const [, py0, pz0] = potentialField(x - eps, y, z, time);
  const [pxy1, , pzy1] = potentialField(x, y + eps, z, time);
  const [pxy0, , pzy0] = potentialField(x, y - eps, z, time);
  const [pxz1, pyz1] = potentialField(x, y, z + eps, time);
  const [pxz0, pyz0] = potentialField(x, y, z - eps, time);

  const dFz_dy = (pzy1 - pzy0) * inv2Eps;
  const dFy_dz = (pyz1 - pyz0) * inv2Eps;
  const dFx_dz = (pxz1 - pxz0) * inv2Eps;
  const dFz_dx = (pz1 - pz0) * inv2Eps;
  const dFy_dx = (py1 - py0) * inv2Eps;
  const dFx_dy = (pxy1 - pxy0) * inv2Eps;

  return {
    x: dFz_dy - dFy_dz,
    y: dFx_dz - dFz_dx,
    z: dFy_dx - dFx_dy,
  };
}

/**
 * Analytical Toroidal Vortex Ring + Thermal Buoyancy + Curl Advection velocity field
 * for realistic mushroom-cap roll and central stem entrainment.
 */
export function computeToroidalVortexVelocity(
  px: number,
  py: number,
  pz: number,
  cx: number,
  cy: number,
  cz: number,
  age: number,
  ringRadius: number,
  strength: number,
): Vec3 {
  const rx = px - cx;
  const ry = py - cy;
  const rz = pz - cz;
  const horizDist = Math.hypot(rx, rz);
  const safeHoriz = Math.max(0.05, horizDist);
  const hx = rx / safeHoriz;
  const hz = rz / safeHoriz;

  // Distance to the toroidal ring core circle at radius = ringRadius
  const ringOffset = horizDist - ringRadius;
  const distToRing = Math.hypot(ringOffset, ry);
  const coreRadius = Math.max(0.65, ringRadius * 0.72);
  const falloff = Math.exp(-(distToRing * distToRing) / (coreRadius * coreRadius * 1.45));

  // Toroidal circulation:
  // inside ring (ringOffset < 0): strong upward lift
  // top of ring (ry > 0): outward radial curl
  // outer skirt (ringOffset > 0): downward curl
  // base (ry < 0): inward entrainment
  const circSpeed = strength * falloff * (1 / (1 + age * 0.55));
  const vRadial = (ry / Math.max(0.4, distToRing)) * circSpeed;
  const vAxial = (-ringOffset / Math.max(0.4, distToRing)) * circSpeed;

  // Global thermal buoyancy decays smoothly as smoke cools
  const thermalLift = strength * 0.42 * Math.exp(-age * 0.48);

  const curl = computeCurlNoise3D(px * 0.35, py * 0.35, pz * 0.35, age * 1.4);
  const curlAmp = strength * 0.32;

  return {
    x: hx * vRadial + curl.x * curlAmp,
    y: vAxial + thermalLift + curl.y * curlAmp * 0.65,
    z: hz * vRadial + curl.z * curlAmp,
  };
}

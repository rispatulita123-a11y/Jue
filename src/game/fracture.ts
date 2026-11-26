import * as THREE from 'three';
import type { BlockMaterialType, Vec3 } from './types';

export interface PolyFace {
  normal: Vec3;
  vertices: Vec3[];
  isInner: boolean;
}

export interface FracturePieceData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  innerMask: Float32Array;
  localOffset: Vec3;
  halfExtents: Vec3;
  volumeRatio: number;
  distanceFromImpact: number;
  pieceClass: 'major' | 'minor';
}

export interface FracturePieceSpec extends FracturePieceData {
  geometry: THREE.BufferGeometry;
}

function seededRand(seed: number): () => number {
  let s = (Math.floor(seed * 2147483647) ^ 0x9e3779b9) >>> 0;
  if (s === 0) s = 0x6d2b79f5;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function spatialHash3(x: number, y: number, z: number, seed: number): number {
  const qx = Math.round(x * 1000) * 0.001;
  const qy = Math.round(y * 1000) * 0.001;
  const qz = Math.round(z * 1000) * 0.001;
  const n = Math.sin(qx * 127.1 + qy * 311.7 + qz * 74.7 + seed * 19.3) * 43758.5453123;
  return (n - Math.floor(n)) * 2 - 1;
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-8) return { x: 0, y: 1, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function createBoxPolyhedron(hx: number, hy: number, hz: number): PolyFace[] {
  return [
    {
      normal: { x: 1, y: 0, z: 0 },
      isInner: false,
      vertices: [
        { x: hx, y: -hy, z: hz },
        { x: hx, y: -hy, z: -hz },
        { x: hx, y: hy, z: -hz },
        { x: hx, y: hy, z: hz },
      ],
    },
    {
      normal: { x: -1, y: 0, z: 0 },
      isInner: false,
      vertices: [
        { x: -hx, y: -hy, z: -hz },
        { x: -hx, y: -hy, z: hz },
        { x: -hx, y: hy, z: hz },
        { x: -hx, y: hy, z: -hz },
      ],
    },
    {
      normal: { x: 0, y: 1, z: 0 },
      isInner: false,
      vertices: [
        { x: -hx, y: hy, z: hz },
        { x: hx, y: hy, z: hz },
        { x: hx, y: hy, z: -hz },
        { x: -hx, y: hy, z: -hz },
      ],
    },
    {
      normal: { x: 0, y: -1, z: 0 },
      isInner: false,
      vertices: [
        { x: -hx, y: -hy, z: -hz },
        { x: hx, y: -hy, z: -hz },
        { x: hx, y: -hy, z: hz },
        { x: -hx, y: -hy, z: hz },
      ],
    },
    {
      normal: { x: 0, y: 0, z: 1 },
      isInner: false,
      vertices: [
        { x: -hx, y: -hy, z: hz },
        { x: hx, y: -hy, z: hz },
        { x: hx, y: hy, z: hz },
        { x: -hx, y: hy, z: hz },
      ],
    },
    {
      normal: { x: 0, y: 0, z: -1 },
      isInner: false,
      vertices: [
        { x: hx, y: -hy, z: -hz },
        { x: -hx, y: -hy, z: -hz },
        { x: -hx, y: hy, z: -hz },
        { x: hx, y: hy, z: -hz },
      ],
    },
  ];
}

function dedupePoints3D(pts: Vec3[], eps = 1e-4): Vec3[] {
  const out: Vec3[] = [];
  const eps2 = eps * eps;
  for (const p of pts) {
    let dup = false;
    for (const q of out) {
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const dz = p.z - q.z;
      if (dx * dx + dy * dy + dz * dz < eps2) {
        dup = true;
        break;
      }
    }
    if (!dup) out.push(p);
  }
  return out;
}

/**
 * Clips a convex polyhedron against the half-space dot(p, planeNormal) <= planeDist.
 * Returns null if the polyhedron is completely clipped away.
 */
export function clipConvexPolyhedron(
  faces: PolyFace[],
  planeNormal: Vec3,
  planeDist: number,
  markCapInner = true,
): PolyFace[] | null {
  const n = normalize(planeNormal);
  const eps = 1e-5;
  const outFaces: PolyFace[] = [];
  const capPoints: Vec3[] = [];
  let anyInside = false;
  let anyClipped = false;

  for (const face of faces) {
    const verts = face.vertices;
    if (verts.length < 3) continue;

    const dists = verts.map((v) => dot(v, n) - planeDist);
    const newVerts: Vec3[] = [];

    for (let i = 0; i < verts.length; i++) {
      const cur = verts[i];
      const next = verts[(i + 1) % verts.length];
      const dCur = dists[i];
      const dNext = dists[(i + 1) % verts.length];

      const curIn = dCur <= eps;
      const nextIn = dNext <= eps;

      if (curIn) {
        anyInside = true;
        newVerts.push(cur);
      } else {
        anyClipped = true;
      }

      if (curIn !== nextIn) {
        const denom = dCur - dNext;
        const t = Math.abs(denom) > 1e-8 ? dCur / denom : 0.5;
        const inter: Vec3 = {
          x: cur.x + (next.x - cur.x) * t,
          y: cur.y + (next.y - cur.y) * t,
          z: cur.z + (next.z - cur.z) * t,
        };
        newVerts.push(inter);
        capPoints.push(inter);
      } else if (Math.abs(dCur) <= eps) {
        capPoints.push(cur);
      }
    }

    const cleaned = dedupePoints3D(newVerts, 1e-4);
    if (cleaned.length >= 3) {
      outFaces.push({
        normal: face.normal,
        vertices: cleaned,
        isInner: face.isInner,
      });
    }
  }

  if (!anyInside || outFaces.length === 0) return null;

  if (anyClipped) {
    const uniqueCap = dedupePoints3D(capPoints, 1e-4);
    if (uniqueCap.length >= 3) {
      // Build orthonormal 2D frame on cap plane to sort CCW around n
      const ref: Vec3 = Math.abs(n.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
      const uAxis = normalize(cross(ref, n));
      const vAxis = cross(n, uAxis);

      const cx = uniqueCap.reduce((s, p) => s + p.x, 0) / uniqueCap.length;
      const cy = uniqueCap.reduce((s, p) => s + p.y, 0) / uniqueCap.length;
      const cz = uniqueCap.reduce((s, p) => s + p.z, 0) / uniqueCap.length;

      uniqueCap.sort((a, b) => {
        const da = { x: a.x - cx, y: a.y - cy, z: a.z - cz };
        const db = { x: b.x - cx, y: b.y - cy, z: b.z - cz };
        const angA = Math.atan2(dot(da, vAxis), dot(da, uAxis));
        const angB = Math.atan2(dot(db, vAxis), dot(db, uAxis));
        return angA - angB;
      });

      outFaces.push({
        normal: n,
        vertices: uniqueCap,
        isInner: markCapInner,
      });
    }
  }

  return outFaces.length >= 4 ? outFaces : null;
}

export interface Point2D {
  u: number;
  v: number;
}

/**
 * Clips a 2D convex polygon against half-plane dot(p, n) <= dist.
 */
export function clipPolygon2D(poly: Point2D[], nu: number, nv: number, dist: number): Point2D[] {
  if (poly.length < 3) return [];
  const eps = 1e-5;
  const out: Point2D[] = [];

  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const next = poly[(i + 1) % poly.length];
    const dCur = cur.u * nu + cur.v * nv - dist;
    const dNext = next.u * nu + next.v * nv - dist;
    const curIn = dCur <= eps;
    const nextIn = dNext <= eps;

    if (curIn) out.push(cur);
    if (curIn !== nextIn) {
      const denom = dCur - dNext;
      const t = Math.abs(denom) > 1e-8 ? dCur / denom : 0.5;
      out.push({
        u: cur.u + (next.u - cur.u) * t,
        v: cur.v + (next.v - cur.v) * t,
      });
    }
  }

  // Dedupe nearby points
  const cleaned: Point2D[] = [];
  for (const p of out) {
    const last = cleaned[cleaned.length - 1];
    if (!last || Math.hypot(p.u - last.u, p.v - last.v) > 1e-4) {
      cleaned.push(p);
    }
  }
  if (
    cleaned.length > 2 &&
    Math.hypot(cleaned[0].u - cleaned[cleaned.length - 1].u, cleaned[0].v - cleaned[cleaned.length - 1].v) < 1e-4
  ) {
    cleaned.pop();
  }
  return cleaned.length >= 3 ? cleaned : [];
}

function extrude2DPolygonToPolyFaces(
  poly: Point2D[],
  thinAxis: 0 | 1 | 2,
  uAxis: 0 | 1 | 2,
  vAxis: 0 | 1 | 2,
  halfThick: number,
): PolyFace[] {
  const toVec3 = (u: number, v: number, t: number): Vec3 => {
    const arr = [0, 0, 0];
    arr[uAxis] = u;
    arr[vAxis] = v;
    arr[thinAxis] = t;
    return { x: arr[0], y: arr[1], z: arr[2] };
  };

  // Ensure CCW winding in (u, v)
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    area += a.u * b.v - b.u * a.v;
  }
  const ordered = area >= 0 ? poly : [...poly].reverse();

  const frontVerts = ordered.map((p) => toVec3(p.u, p.v, halfThick));
  const backVerts = [...ordered].reverse().map((p) => toVec3(p.u, p.v, -halfThick));

  const fNormal = normalize(
    cross(sub(frontVerts[1], frontVerts[0]), sub(frontVerts[2], frontVerts[0])),
  );
  const bNormal = { x: -fNormal.x, y: -fNormal.y, z: -fNormal.z };

  const faces: PolyFace[] = [
    { normal: fNormal, vertices: frontVerts, isInner: false },
    { normal: bNormal, vertices: backVerts, isInner: false },
  ];

  // Side fractured edge faces -> marked isInner = true for bright crystal edge glint!
  for (let i = 0; i < ordered.length; i++) {
    const a = ordered[i];
    const b = ordered[(i + 1) % ordered.length];
    const p0 = toVec3(a.u, a.v, -halfThick);
    const p1 = toVec3(b.u, b.v, -halfThick);
    const p2 = toVec3(b.u, b.v, halfThick);
    const p3 = toVec3(a.u, a.v, halfThick);
    const sideNormal = normalize(cross(sub(p1, p0), sub(p2, p0)));
    faces.push({
      normal: sideNormal,
      vertices: [p0, p1, p2, p3],
      isInner: true,
    });
  }

  return faces;
}

function finalizeFacesToPieceData(
  faces: PolyFace[],
  parentHalfExtents: Vec3,
  localImpact: Vec3,
  material: BlockMaterialType,
  grainAxis: 0 | 1 | 2,
  seed: number,
): FracturePieceData | null {
  // Compute centroid and bounding box
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  let sumX = 0,
    sumY = 0,
    sumZ = 0;
  let vertCount = 0;

  for (const f of faces) {
    for (const v of f.vertices) {
      sumX += v.x;
      sumY += v.y;
      sumZ += v.z;
      vertCount++;
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.z < minZ) minZ = v.z;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
      if (v.z > maxZ) maxZ = v.z;
    }
  }
  if (vertCount < 4) return null;

  const sx = (maxX - minX) * 0.5;
  const sy = (maxY - minY) * 0.5;
  const sz = (maxZ - minZ) * 0.5;
  const minDim = material === 'glass' ? 0.008 : 0.022;
  if (sx < minDim || sy < minDim || sz < minDim) return null;

  const cx = sumX / vertCount;
  const cy = sumY / vertCount;
  const cz = sumZ / vertCount;

  // Triangulate all convex polygon faces
  let triCount = 0;
  for (const f of faces) {
    if (f.vertices.length >= 3) triCount += f.vertices.length - 2;
  }
  if (triCount < 4) return null;

  const positions = new Float32Array(triCount * 9);
  const normals = new Float32Array(triCount * 9);
  const uvs = new Float32Array(triCount * 6);
  const innerMask = new Float32Array(triCount * 3);

  const perturbVertex = (v: Vec3, isInnerFace: boolean): Vec3 => {
    if (material === 'glass') {
      return { x: v.x - cx, y: v.y - cy, z: v.z - cz };
    }
    // Check if vertex lies strictly on original exterior boundary
    const nearExtX = Math.abs(Math.abs(v.x) - parentHalfExtents.x) < 0.008;
    const nearExtY = Math.abs(Math.abs(v.y) - parentHalfExtents.y) < 0.008;
    const nearExtZ = Math.abs(Math.abs(v.z) - parentHalfExtents.z) < 0.008;
    const isCorner = (nearExtX ? 1 : 0) + (nearExtY ? 1 : 0) + (nearExtZ ? 1 : 0) >= 2;
    if (isCorner && !isInnerFace) {
      return { x: v.x - cx, y: v.y - cy, z: v.z - cz };
    }

    const h1 = spatialHash3(v.x, v.y, v.z, seed);
    const h2 = spatialHash3(v.y, v.z, v.x, seed + 13);
    const h3 = spatialHash3(v.z, v.x, v.y, seed + 29);

    if (material === 'wood') {
      // Jagged longitudinal splinter tips along the grain axis!
      const grainJitter = Math.min(0.18, Math.max(sx, sy, sz) * 0.22);
      const perpJitter = Math.min(0.03, Math.min(sx, sy, sz) * 0.12);
      return {
        x: v.x - cx + (grainAxis === 0 ? h1 * grainJitter : nearExtX ? 0 : h1 * perpJitter),
        y: v.y - cy + (grainAxis === 1 ? h2 * grainJitter : nearExtY ? 0 : h2 * perpJitter),
        z: v.z - cz + (grainAxis === 2 ? h3 * grainJitter : nearExtZ ? 0 : h3 * perpJitter),
      };
    }

    // Stone: craggy cleaved rock faces
    const rockAmp = Math.min(0.075, Math.min(sx, sy, sz) * 0.26);
    return {
      x: v.x - cx + (nearExtX ? 0 : h1 * rockAmp),
      y: v.y - cy + (nearExtY ? 0 : h2 * rockAmp),
      z: v.z - cz + (nearExtZ ? 0 : h3 * rockAmp),
    };
  };

  let pIdx = 0;
  let uvIdx = 0;
  let mIdx = 0;

  for (const f of faces) {
    if (f.vertices.length < 3) continue;
    const perturbed = f.vertices.map((v) => perturbVertex(v, f.isInner));

    const v0 = perturbed[0];
    for (let i = 1; i < perturbed.length - 1; i++) {
      const v1 = perturbed[i];
      const v2 = perturbed[i + 1];

      // Compute exact triangle normal after perturbation
      const e1 = sub(v1, v0);
      const e2 = sub(v2, v0);
      let fn = cross(e1, e2);
      const fnLen = Math.hypot(fn.x, fn.y, fn.z);
      if (fnLen < 1e-7) {
        fn = f.normal;
      } else {
        fn = { x: fn.x / fnLen, y: fn.y / fnLen, z: fn.z / fnLen };
        if (dot(fn, f.normal) < 0) {
          fn = { x: -fn.x, y: -fn.y, z: -fn.z };
        }
      }

      const tri = [v0, v1, v2];
      const absNx = Math.abs(fn.x);
      const absNy = Math.abs(fn.y);
      const absNz = Math.abs(fn.z);

      for (const tv of tri) {
        positions[pIdx] = tv.x;
        positions[pIdx + 1] = tv.y;
        positions[pIdx + 2] = tv.z;

        normals[pIdx] = fn.x;
        normals[pIdx + 1] = fn.y;
        normals[pIdx + 2] = fn.z;
        pIdx += 3;

        // Triplanar world-scale UV projection (prevents stretching on irregular fracture faces)
        const wx = tv.x + cx;
        const wy = tv.y + cy;
        const wz = tv.z + cz;
        if (absNy >= absNx && absNy >= absNz) {
          uvs[uvIdx] = wx * 0.55 + 0.5;
          uvs[uvIdx + 1] = wz * 0.55 + 0.5;
        } else if (absNx >= absNz) {
          uvs[uvIdx] = wz * 0.55 + 0.5;
          uvs[uvIdx + 1] = wy * 0.55 + 0.5;
        } else {
          uvs[uvIdx] = wx * 0.55 + 0.5;
          uvs[uvIdx + 1] = wy * 0.55 + 0.5;
        }
        uvIdx += 2;

        innerMask[mIdx++] = f.isInner ? 1.0 : 0.0;
      }
    }
  }

  if (mIdx === 0) return null;

  const actualCount = mIdx;
  const parentVol = Math.max(0.01, parentHalfExtents.x * parentHalfExtents.y * parentHalfExtents.z * 8);
  const pieceVol = Math.min(parentVol, sx * sy * sz * 5.2);
  const volumeRatio = Math.max(0.03, Math.min(0.65, pieceVol / parentVol));
  const distImpact = Math.hypot(cx - localImpact.x, cy - localImpact.y, cz - localImpact.z);

  return {
    positions: actualCount * 3 === positions.length ? positions : positions.slice(0, actualCount * 3),
    normals: actualCount * 3 === normals.length ? normals : normals.slice(0, actualCount * 3),
    uvs: actualCount * 2 === uvs.length ? uvs : uvs.slice(0, actualCount * 2),
    innerMask: actualCount === innerMask.length ? innerMask : innerMask.slice(0, actualCount),
    localOffset: { x: cx, y: cy, z: cz },
    halfExtents: { x: sx, y: sy, z: sz },
    volumeRatio,
    distanceFromImpact: distImpact,
    pieceClass: volumeRatio >= 0.085 ? 'major' : 'minor',
  };
}

function generateGlassFractureData(
  halfExtents: Vec3,
  localImpact: Vec3,
  seed: number,
): FracturePieceData[] {
  const rand = seededRand(seed);
  // Pick thinnest dimension as the pane thickness axis
  const dims = [halfExtents.x, halfExtents.y, halfExtents.z];
  let thinAxis: 0 | 1 | 2 = 0;
  if (dims[1] < dims[thinAxis]) thinAxis = 1;
  if (dims[2] < dims[thinAxis]) thinAxis = 2;

  const uAxis = ((thinAxis + 1) % 3) as 0 | 1 | 2;
  const vAxis = ((thinAxis + 2) % 3) as 0 | 1 | 2;
  const hu = dims[uAxis];
  const hv = dims[vAxis];
  const hThick = dims[thinAxis];

  const impArr = [localImpact.x, localImpact.y, localImpact.z];
  const impU = Math.max(-hu * 0.9, Math.min(hu * 0.9, impArr[uAxis]));
  const impV = Math.max(-hv * 0.9, Math.min(hv * 0.9, impArr[vAxis]));

  // Radial + concentric crack seeds radiating from the exact impact point
  const seeds: Point2D[] = [];
  const innerRays = 6;
  const outerRays = 7;
  const maxSpan = Math.hypot(hu, hv);

  for (let i = 0; i < innerRays; i++) {
    const ang = (i / innerRays) * Math.PI * 2 + (rand() - 0.5) * 0.42;
    const r = maxSpan * (0.14 + rand() * 0.16);
    seeds.push({
      u: Math.max(-hu * 0.95, Math.min(hu * 0.95, impU + Math.cos(ang) * r)),
      v: Math.max(-hv * 0.95, Math.min(hv * 0.95, impV + Math.sin(ang) * r)),
    });
  }
  for (let i = 0; i < outerRays; i++) {
    const ang = (i / outerRays) * Math.PI * 2 + 0.31 + (rand() - 0.5) * 0.48;
    const r = maxSpan * (0.42 + rand() * 0.45);
    seeds.push({
      u: Math.max(-hu * 0.96, Math.min(hu * 0.96, impU + Math.cos(ang) * r)),
      v: Math.max(-hv * 0.96, Math.min(hv * 0.96, impV + Math.sin(ang) * r)),
    });
  }

  const baseRect: Point2D[] = [
    { u: -hu, v: -hv },
    { u: hu, v: -hv },
    { u: hu, v: hv },
    { u: -hu, v: hv },
  ];

  const pieces: FracturePieceData[] = [];
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    let poly = baseRect;
    for (let j = 0; j < seeds.length; j++) {
      if (i === j) continue;
      const o = seeds[j];
      const du = o.u - s.u;
      const dv = o.v - s.v;
      const len = Math.hypot(du, dv);
      if (len < 1e-4) continue;
      const nu = du / len;
      const nv = dv / len;
      const midU = (s.u + o.u) * 0.5;
      const midV = (s.v + o.v) * 0.5;
      const dist = midU * nu + midV * nv;
      poly = clipPolygon2D(poly, nu, nv, dist);
      if (poly.length < 3) break;
    }
    if (poly.length < 3) continue;

    const faces = extrude2DPolygonToPolyFaces(poly, thinAxis, uAxis, vAxis, hThick * 0.96);
    const data = finalizeFacesToPieceData(
      faces,
      halfExtents,
      localImpact,
      'glass',
      thinAxis,
      seed + i * 31,
    );
    if (data) pieces.push(data);
  }

  return pieces;
}

function generate3DVoronoiFractureData(
  halfExtents: Vec3,
  material: 'wood' | 'stone',
  localImpact: Vec3,
  seed: number,
): FracturePieceData[] {
  const rand = seededRand(seed);
  const dims = [halfExtents.x, halfExtents.y, halfExtents.z];
  let grainAxis: 0 | 1 | 2 = 0;
  if (dims[1] > dims[grainAxis]) grainAxis = 1;
  if (dims[2] > dims[grainAxis]) grainAxis = 2;

  const vol = dims[0] * dims[1] * dims[2] * 8;
  const siteCount = material === 'wood' ? Math.min(10, Math.max(6, Math.round(6 + vol * 0.35))) : Math.min(11, Math.max(7, Math.round(7 + vol * 0.32)));

  const imp: Vec3 = {
    x: Math.max(-halfExtents.x * 0.9, Math.min(halfExtents.x * 0.9, localImpact.x)),
    y: Math.max(-halfExtents.y * 0.9, Math.min(halfExtents.y * 0.9, localImpact.y)),
    z: Math.max(-halfExtents.z * 0.9, Math.min(halfExtents.z * 0.9, localImpact.z)),
  };

  const sites: Vec3[] = [];
  for (let i = 0; i < siteCount; i++) {
    const nearImpact = i < Math.ceil(siteCount * 0.55);
    if (material === 'wood') {
      // Anisotropic Voronoi metric: tight splits perpendicular to grain, elongated along grain!
      const spreadAlong = nearImpact ? 0.45 : 0.92;
      const spreadCross = nearImpact ? 0.42 : 0.88;
      const sx =
        grainAxis === 0
          ? imp.x * (nearImpact ? 0.7 : 0.15) + (rand() * 2 - 1) * halfExtents.x * spreadAlong
          : imp.x * (nearImpact ? 0.6 : 0.1) + (rand() * 2 - 1) * halfExtents.x * spreadCross;
      const sy =
        grainAxis === 1
          ? imp.y * (nearImpact ? 0.7 : 0.15) + (rand() * 2 - 1) * halfExtents.y * spreadAlong
          : imp.y * (nearImpact ? 0.6 : 0.1) + (rand() * 2 - 1) * halfExtents.y * spreadCross;
      const sz =
        grainAxis === 2
          ? imp.z * (nearImpact ? 0.7 : 0.15) + (rand() * 2 - 1) * halfExtents.z * spreadAlong
          : imp.z * (nearImpact ? 0.6 : 0.1) + (rand() * 2 - 1) * halfExtents.z * spreadCross;
      sites.push({
        x: Math.max(-halfExtents.x * 0.94, Math.min(halfExtents.x * 0.94, sx)),
        y: Math.max(-halfExtents.y * 0.94, Math.min(halfExtents.y * 0.94, sy)),
        z: Math.max(-halfExtents.z * 0.94, Math.min(halfExtents.z * 0.94, sz)),
      });
    } else {
      // Stone: dense angular rubble clustered near impact, larger boulders farther out
      const rScale = nearImpact ? 0.48 : 0.94;
      const centerMix = nearImpact ? 0.72 : 0.12;
      sites.push({
        x: Math.max(
          -halfExtents.x * 0.94,
          Math.min(halfExtents.x * 0.94, imp.x * centerMix + (rand() * 2 - 1) * halfExtents.x * rScale),
        ),
        y: Math.max(
          -halfExtents.y * 0.94,
          Math.min(halfExtents.y * 0.94, imp.y * centerMix + (rand() * 2 - 1) * halfExtents.y * rScale),
        ),
        z: Math.max(
          -halfExtents.z * 0.94,
          Math.min(halfExtents.z * 0.94, imp.z * centerMix + (rand() * 2 - 1) * halfExtents.z * rScale),
        ),
      });
    }
  }

  // Metric scaling for anisotropic wood fracture planes
  const metricScale: Vec3 =
    material === 'wood'
      ? {
          x: grainAxis === 0 ? 0.28 : 1.0,
          y: grainAxis === 1 ? 0.28 : 1.0,
          z: grainAxis === 2 ? 0.28 : 1.0,
        }
      : { x: 1, y: 1, z: 1 };

  const baseBox = createBoxPolyhedron(halfExtents.x, halfExtents.y, halfExtents.z);
  const pieces: FracturePieceData[] = [];

  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    let cell: PolyFace[] | null = baseBox;

    for (let j = 0; j < sites.length; j++) {
      if (i === j || !cell) continue;
      const o = sites[j];
      const rawDiff = {
        x: (o.x - s.x) * metricScale.x,
        y: (o.y - s.y) * metricScale.y,
        z: (o.z - s.z) * metricScale.z,
      };
      const len = Math.hypot(rawDiff.x, rawDiff.y, rawDiff.z);
      if (len < 1e-4) continue;
      const planeNormal = { x: rawDiff.x / len, y: rawDiff.y / len, z: rawDiff.z / len };
      const mid = {
        x: (s.x + o.x) * 0.5,
        y: (s.y + o.y) * 0.5,
        z: (s.z + o.z) * 0.5,
      };
      const planeDist = dot(mid, planeNormal);
      cell = clipConvexPolyhedron(cell, planeNormal, planeDist, true);
    }

    if (!cell) continue;
    const data = finalizeFacesToPieceData(
      cell,
      halfExtents,
      imp,
      material,
      grainAxis,
      seed + i * 53,
    );
    if (data) pieces.push(data);
  }

  return pieces;
}

export function generateFractureData(
  halfExtents: Vec3,
  material: BlockMaterialType,
  localImpact: Vec3,
  seed = 1,
): FracturePieceData[] {
  if (material === 'glass') {
    const pieces = generateGlassFractureData(halfExtents, localImpact, seed);
    if (pieces.length >= 3) return pieces;
  }
  const pieces = generate3DVoronoiFractureData(
    halfExtents,
    material === 'glass' ? 'stone' : material,
    localImpact,
    seed,
  );
  if (pieces.length > 0) return pieces;

  // Deterministic fallback split into 4 asymmetric angular wedges (never a raw cube/sphere)
  const base = createBoxPolyhedron(halfExtents.x, halfExtents.y, halfExtents.z);
  const splitA = clipConvexPolyhedron(base, { x: 0.92, y: 0.35, z: 0.17 }, 0, true);
  const splitB = clipConvexPolyhedron(base, { x: -0.92, y: -0.35, z: -0.17 }, 0, true);
  const fallback: FracturePieceData[] = [];
  for (const [idx, cell] of [splitA, splitB].entries()) {
    if (!cell) continue;
    const data = finalizeFacesToPieceData(
      cell,
      halfExtents,
      localImpact,
      material,
      0,
      seed + idx * 17,
    );
    if (data) fallback.push(data);
  }
  return fallback;
}

export function buildFractureBufferGeometry(data: FracturePieceData): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
  geo.setAttribute('aInnerFace', new THREE.BufferAttribute(data.innerMask, 1));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export function generateFracturePieces(
  halfExtents: Vec3,
  material: BlockMaterialType,
  localImpact: Vec3,
  seed = 1,
): FracturePieceSpec[] {
  const raw = generateFractureData(halfExtents, material, localImpact, seed);
  return raw.map((d) => ({
    ...d,
    geometry: buildFractureBufferGeometry(d),
  }));
}

/**
 * Generates multi-variant irregular procedural secondary debris geometries
 * (ZERO basic spheres or boxes!) for InstancedMesh pools.
 */
export function createSecondaryDebrisVariants(
  material: BlockMaterialType,
  variantCount = 3,
): THREE.BufferGeometry[] {
  const variants: THREE.BufferGeometry[] = [];

  for (let v = 0; v < variantCount; v++) {
    const rand = seededRand(v * 97 + (material === 'wood' ? 11 : material === 'glass' ? 23 : 37));
    if (material === 'wood') {
      // Long irregular fractured wood splinter with pointed jagged tips
      const len = 0.42 + rand() * 0.22;
      const thick = 0.042 + rand() * 0.025;
      const shape = new THREE.Shape();
      shape.moveTo(-len, -thick * (0.3 + rand() * 0.5));
      shape.lineTo(-len * 0.25, -thick * (0.9 + rand() * 0.4));
      shape.lineTo(len * 0.65, -thick * (0.4 + rand() * 0.5));
      shape.lineTo(len * (0.95 + rand() * 0.2), thick * (0.1 + rand() * 0.2));
      shape.lineTo(len * 0.3, thick * (0.85 + rand() * 0.4));
      shape.lineTo(-len * 0.45, thick * (0.7 + rand() * 0.35));
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: thick * 1.15,
        bevelEnabled: false,
        curveSegments: 1,
      });
      geo.center();
      geo.computeVertexNormals();
      const count = geo.attributes.position.count;
      const inner = new Float32Array(count);
      const nAttr = geo.attributes.normal;
      for (let i = 0; i < count; i++) {
        // Side split faces get lighter fibrous wood inner tint
        inner[i] = Math.abs(nAttr.getZ(i)) < 0.65 ? 1.0 : 0.25;
      }
      geo.setAttribute('aInnerFace', new THREE.BufferAttribute(inner, 1));
      variants.push(geo);
    } else if (material === 'glass') {
      // Sharp polygonal/triangular crystal shard
      const pts: Point2D[] = [];
      const sides = v === 0 ? 3 : v === 1 ? 4 : 5;
      for (let i = 0; i < sides; i++) {
        const ang = (i / sides) * Math.PI * 2 + (rand() - 0.5) * 0.45;
        const r = 0.14 + rand() * 0.16;
        pts.push({ u: Math.cos(ang) * r * (i === 0 ? 1.45 : 1.0), v: Math.sin(ang) * r });
      }
      const faces = extrude2DPolygonToPolyFaces(pts, 2, 0, 1, 0.024 + rand() * 0.012);
      const data = finalizeFacesToPieceData(
        faces,
        { x: 0.3, y: 0.3, z: 0.04 },
        { x: 0, y: 0, z: 0 },
        'glass',
        2,
        v * 41 + 5,
      );
      if (data) {
        variants.push(buildFractureBufferGeometry(data));
      }
    } else {
      // Angular cleaved granite rubble chunk via plane clipping
      let poly: PolyFace[] | null = createBoxPolyhedron(0.22, 0.16, 0.19);
      const cuts = [
        { x: 0.72, y: 0.58, z: 0.38 },
        { x: -0.64, y: 0.52, z: -0.56 },
        { x: 0.35, y: -0.78, z: 0.51 },
        { x: -0.52, y: -0.35, z: 0.77 },
      ];
      for (let c = 0; c < cuts.length; c++) {
        const raw = cuts[c];
        const n = normalize({
          x: raw.x + (rand() - 0.5) * 0.35,
          y: raw.y + (rand() - 0.5) * 0.35,
          z: raw.z + (rand() - 0.5) * 0.35,
        });
        if (poly) {
          poly = clipConvexPolyhedron(poly, n, 0.11 + rand() * 0.06, c % 2 === 0);
        }
      }
      if (poly) {
        const data = finalizeFacesToPieceData(
          poly,
          { x: 0.25, y: 0.2, z: 0.22 },
          { x: 0, y: 0, z: 0 },
          'stone',
          0,
          v * 73 + 9,
        );
        if (data) {
          variants.push(buildFractureBufferGeometry(data));
        }
      }
    }
  }

  return variants;
}

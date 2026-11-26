import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clipConvexPolyhedron,
  clipPolygon2D,
  createBoxPolyhedron,
  createSecondaryDebrisVariants,
  generateFractureData,
} from './fracture';

test('clipPolygon2D clips square cleanly against diagonal half-plane', () => {
  const rect = [
    { u: -1, v: -1 },
    { u: 1, v: -1 },
    { u: 1, v: 1 },
    { u: -1, v: 1 },
  ];
  const clipped = clipPolygon2D(rect, Math.SQRT1_2, Math.SQRT1_2, 0);
  assert.equal(clipped.length, 3, 'Diagonal clip through origin should produce a triangle');
  for (const pt of clipped) {
    assert.ok(Number.isFinite(pt.u) && Number.isFinite(pt.v));
    assert.ok(pt.u * Math.SQRT1_2 + pt.v * Math.SQRT1_2 <= 1e-4);
  }
});

test('clipConvexPolyhedron splits box and creates distinct inner cap face', () => {
  const box = createBoxPolyhedron(1, 0.5, 0.5);
  const half = clipConvexPolyhedron(box, { x: 1, y: 0.25, z: 0 }, 0, true);
  assert.ok(half && half.length >= 5, 'Clipped polyhedron should have >= 5 faces');
  const innerFaces = half!.filter((f) => f.isInner);
  assert.equal(innerFaces.length, 1, 'Exactly one newly cleaved inner cap face should be marked');
});

test('generateFractureData creates irregular Voronoi chunks with inner faces for wood, stone, and glass', () => {
  const cases: Array<{
    material: 'wood' | 'stone' | 'glass';
    halfExtents: { x: number; y: number; z: number };
    impact: { x: number; y: number; z: number };
    minPieces: number;
  }> = [
    {
      material: 'wood',
      halfExtents: { x: 1.5, y: 0.24, z: 0.35 },
      impact: { x: -0.9, y: 0.1, z: 0 },
      minPieces: 5,
    },
    {
      material: 'stone',
      halfExtents: { x: 0.55, y: 1.1, z: 0.55 },
      impact: { x: -0.45, y: 0.2, z: 0.1 },
      minPieces: 5,
    },
    {
      material: 'glass',
      halfExtents: { x: 0.22, y: 1.1, z: 1.0 },
      impact: { x: -0.1, y: 0.3, z: -0.2 },
      minPieces: 6,
    },
  ];

  for (const c of cases) {
    const pieces = generateFractureData(c.halfExtents, c.material, c.impact, 42);
    assert.ok(
      pieces.length >= c.minPieces,
      `Expected >= ${c.minPieces} pieces for ${c.material}, got ${pieces.length}`,
    );

    let hasInnerFaceVerts = false;
    let hasOuterFaceVerts = false;
    let hasNonNan = true;
    let minImpDist = Infinity;
    let maxImpDist = 0;

    for (const p of pieces) {
      assert.ok(p.positions.length >= 12);
      assert.equal(p.positions.length, p.normals.length);
      assert.equal(p.uvs.length * 3, p.positions.length * 2);
      assert.equal(p.innerMask.length * 3, p.positions.length);

      for (let i = 0; i < p.positions.length; i++) {
        if (!Number.isFinite(p.positions[i]) || !Number.isFinite(p.normals[i])) {
          hasNonNan = false;
        }
      }
      for (let i = 0; i < p.innerMask.length; i++) {
        if (p.innerMask[i] > 0.5) hasInnerFaceVerts = true;
        else hasOuterFaceVerts = true;
      }

      minImpDist = Math.min(minImpDist, p.distanceFromImpact);
      maxImpDist = Math.max(maxImpDist, p.distanceFromImpact);
    }

    assert.ok(hasNonNan, `${c.material} fracture vertices must all be finite`);
    assert.ok(hasInnerFaceVerts, `${c.material} pieces must tag newly broken internal faces`);
    assert.ok(hasOuterFaceVerts, `${c.material} pieces must retain exterior faces`);
    assert.ok(maxImpDist > minImpDist, `${c.material} pieces should span away from impact site`);
  }
});

test('createSecondaryDebrisVariants produces 3 non-empty procedural geometries per material', () => {
  for (const mat of ['wood', 'stone', 'glass'] as const) {
    const variants = createSecondaryDebrisVariants(mat, 3);
    assert.equal(variants.length, 3, `Expected 3 variants for ${mat}`);
    for (const geo of variants) {
      const pos = geo.attributes.position;
      const inner = geo.attributes.aInnerFace;
      assert.ok(pos && pos.count >= 6, `${mat} variant must have geometry vertices`);
      assert.ok(inner && inner.count === pos.count, `${mat} variant must include aInnerFace`);
      geo.dispose();
    }
  }
});

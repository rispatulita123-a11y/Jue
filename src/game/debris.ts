import * as THREE from 'three';
import type { BirdType, BlockMaterialType, Quat, Vec3 } from './types';
import type { TextureLibrary } from './textures';
import { createFractureSurfaceMaterial, groundHeightAt } from './models';
import { createSecondaryDebrisVariants, generateFracturePieces } from './fracture';

export interface ActiveBlockObstacle {
  position: Vec3;
  halfExtents: Vec3;
}

export interface MaterialPhysicsTuning {
  gravity: number;
  bounce: number;
  slideFriction: number;
  airDrag: number;
  angDamp: number;
  spinScale: number;
}

const MATERIAL_DEBRIS_TUNING: Record<BlockMaterialType, MaterialPhysicsTuning> = {
  stone: {
    gravity: -22.0,
    bounce: 0.12,
    slideFriction: 0.66,
    airDrag: 0.992,
    angDamp: 0.72,
    spinScale: 7.5,
  },
  wood: {
    gravity: -19.5,
    bounce: 0.24,
    slideFriction: 0.76,
    airDrag: 0.986,
    angDamp: 0.82,
    spinScale: 14.5,
  },
  glass: {
    gravity: -19.0,
    bounce: 0.27,
    slideFriction: 0.93,
    airDrag: 0.988,
    angDamp: 0.9,
    spinScale: 18.0,
  },
};

/**
 * 2D spatial heightfield storing accumulated settled rubble height above groundHeightAt(x, z)
 * so falling fragments pile naturally atop earlier wreckage.
 */
class RubbleHeightfield {
  private readonly minX = -30;
  private readonly maxX = 42;
  private readonly minZ = -20;
  private readonly maxZ = 20;
  private readonly cellSize = 0.35;
  private readonly cols: number;
  private readonly rows: number;
  private heights: Float32Array;

  constructor() {
    this.cols = Math.ceil((this.maxX - this.minX) / this.cellSize);
    this.rows = Math.ceil((this.maxZ - this.minZ) / this.cellSize);
    this.heights = new Float32Array(this.cols * this.rows);
  }

  public reset(): void {
    this.heights.fill(0);
  }

  public sample(x: number, z: number): number {
    const cx = Math.floor((x - this.minX) / this.cellSize);
    const cz = Math.floor((z - this.minZ) / this.cellSize);
    if (cx < 0 || cx >= this.cols || cz < 0 || cz >= this.rows) return 0;
    return this.heights[cz * this.cols + cx];
  }

  public stamp(x: number, z: number, radiusX: number, radiusZ: number, addedHeight: number): void {
    const rx = Math.max(this.cellSize, radiusX);
    const rz = Math.max(this.cellSize, radiusZ);
    const c0 = Math.max(0, Math.floor((x - rx - this.minX) / this.cellSize));
    const c1 = Math.min(this.cols - 1, Math.ceil((x + rx - this.minX) / this.cellSize));
    const r0 = Math.max(0, Math.floor((z - rz - this.minZ) / this.cellSize));
    const r1 = Math.min(this.rows - 1, Math.ceil((z + rz - this.minZ) / this.cellSize));

    for (let r = r0; r <= r1; r++) {
      const cellZ = this.minZ + (r + 0.5) * this.cellSize;
      const nz = (cellZ - z) / rz;
      for (let c = c0; c <= c1; c++) {
        const cellX = this.minX + (c + 0.5) * this.cellSize;
        const nx = (cellX - x) / rx;
        const d2 = nx * nx + nz * nz;
        if (d2 >= 1) continue;
        const weight = 1 - d2;
        const idx = r * this.cols + c;
        this.heights[idx] = Math.min(2.6, this.heights[idx] + addedHeight * weight * 0.52);
      }
    }
  }
}

/**
 * Static merged demolition geometry chunk per material.
 * Sleeps settled Voronoi chunks into single draw-call static buffers with zero CPU cost.
 */
class StaticMergedDemolitionLayer {
  private readonly maxVertices = 36000; // 12,000 triangles per batch
  private scene: THREE.Scene;
  private material: THREE.Material;
  private castShadow: boolean;
  private batches: Array<{
    mesh: THREE.Mesh;
    pos: Float32Array;
    norm: Float32Array;
    uv: Float32Array;
    inner: Float32Array;
    vertCount: number;
  }> = [];

  private _v = new THREE.Vector3();
  private _n = new THREE.Vector3();
  private _normalMat = new THREE.Matrix3();

  constructor(scene: THREE.Scene, material: THREE.Material, castShadow: boolean) {
    this.scene = scene;
    this.material = material;
    this.castShadow = castShadow;
  }

  private createBatch() {
    const pos = new Float32Array(this.maxVertices * 3);
    const norm = new Float32Array(this.maxVertices * 3);
    const uv = new Float32Array(this.maxVertices * 2);
    const inner = new Float32Array(this.maxVertices);

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(pos, 3);
    const normAttr = new THREE.BufferAttribute(norm, 3);
    const uvAttr = new THREE.BufferAttribute(uv, 2);
    const innerAttr = new THREE.BufferAttribute(inner, 1);

    geo.setAttribute('position', posAttr);
    geo.setAttribute('normal', normAttr);
    geo.setAttribute('uv', uvAttr);
    geo.setAttribute('aInnerFace', innerAttr);
    geo.setDrawRange(0, 0);

    const mesh = new THREE.Mesh(geo, this.material);
    mesh.castShadow = this.castShadow;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    this.scene.add(mesh);

    const batch = { mesh, pos, norm, uv, inner, vertCount: 0 };
    this.batches.push(batch);
    return batch;
  }

  public appendGeometry(srcGeo: THREE.BufferGeometry, worldMatrix: THREE.Matrix4): void {
    const srcPos = srcGeo.attributes.position as THREE.BufferAttribute;
    const srcNorm = srcGeo.attributes.normal as THREE.BufferAttribute;
    const srcUv = srcGeo.attributes.uv as THREE.BufferAttribute;
    const srcInner = srcGeo.attributes.aInnerFace as THREE.BufferAttribute | undefined;
    if (!srcPos || !srcNorm) return;

    const count = srcPos.count;
    if (count === 0 || count > this.maxVertices) return;

    let batch = this.batches[this.batches.length - 1];
    if (!batch || batch.vertCount + count > this.maxVertices) {
      batch = this.createBatch();
    }

    this._normalMat.getNormalMatrix(worldMatrix);
    const base = batch.vertCount;

    for (let i = 0; i < count; i++) {
      this._v.fromBufferAttribute(srcPos, i).applyMatrix4(worldMatrix);
      this._n.fromBufferAttribute(srcNorm, i).applyMatrix3(this._normalMat).normalize();

      const pIdx = (base + i) * 3;
      batch.pos[pIdx] = this._v.x;
      batch.pos[pIdx + 1] = this._v.y;
      batch.pos[pIdx + 2] = this._v.z;

      batch.norm[pIdx] = this._n.x;
      batch.norm[pIdx + 1] = this._n.y;
      batch.norm[pIdx + 2] = this._n.z;

      const uIdx = (base + i) * 2;
      if (srcUv) {
        batch.uv[uIdx] = srcUv.getX(i);
        batch.uv[uIdx + 1] = srcUv.getY(i);
      }
      batch.inner[base + i] = srcInner ? srcInner.getX(i) : 0;
    }

    batch.vertCount += count;
    const geo = batch.mesh.geometry;
    geo.setDrawRange(0, batch.vertCount);
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.normal as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.uv as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aInnerFace as THREE.BufferAttribute).needsUpdate = true;
  }

  public reset(): void {
    for (const b of this.batches) {
      this.scene.remove(b.mesh);
      b.mesh.geometry.dispose();
    }
    this.batches = [];
  }

  public dispose(): void {
    this.reset();
  }
}

interface ActiveVoronoiChunk {
  mesh: THREE.Mesh;
  material: BlockMaterialType;
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  avx: number;
  avy: number;
  avz: number;
  halfExtents: Vec3;
  supportRadius: number;
  age: number;
  sleepTimer: number;
  settledGroundHit: boolean;
}

interface SecondaryDebrisItem {
  active: boolean;
  sleeping: boolean;
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  avx: number;
  avy: number;
  avz: number;
  sx: number;
  sy: number;
  sz: number;
  supportHeight: number;
  sleepTimer: number;
  transientLife: number; // < 0 means permanent persistent rubble
  transientMaxLife: number;
}

class PersistentInstancedPool {
  public mesh: THREE.InstancedMesh;
  private items: SecondaryDebrisItem[];
  private cursor = 0;
  private tuning: MaterialPhysicsTuning;
  private rubble: RubbleHeightfield;
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();
  private isTransient: boolean;

  constructor(
    scene: THREE.Scene,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    capacity: number,
    tuning: MaterialPhysicsTuning,
    rubble: RubbleHeightfield,
    castShadow = false,
    isTransient = false,
  ) {
    this.tuning = tuning;
    this.rubble = rubble;
    this.isTransient = isTransient;

    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = castShadow;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);

    this.items = Array.from({ length: capacity }, () => ({
      active: false,
      sleeping: false,
      px: 0,
      py: -999,
      pz: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      avx: 0,
      avy: 0,
      avz: 0,
      sx: 0,
      sy: 0,
      sz: 0,
      supportHeight: 0.06,
      sleepTimer: 0,
      transientLife: -1,
      transientMaxLife: 1,
    }));

    this.reset();
  }

  public reset(): void {
    this.cursor = 0;
    this.dummy.position.set(0, -999, 0);
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i];
      p.active = false;
      p.sleeping = false;
      p.sleepTimer = 0;
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.color.setHex(0xffffff));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  public spawn(opts: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    sx: number;
    sy: number;
    sz: number;
    supportHeight?: number;
    spin?: number;
    hexColor: number;
    transientLife?: number;
  }): void {
    const idx = this.cursor;
    this.cursor = (this.cursor + 1) % this.items.length;
    const p = this.items[idx];
    const spin = opts.spin ?? this.tuning.spinScale;

    p.active = true;
    p.sleeping = false;
    p.px = opts.x;
    p.py = opts.y;
    p.pz = opts.z;
    p.vx = opts.vx;
    p.vy = opts.vy;
    p.vz = opts.vz;
    p.rx = Math.random() * Math.PI * 2;
    p.ry = Math.random() * Math.PI * 2;
    p.rz = Math.random() * Math.PI * 2;
    p.avx = (Math.random() - 0.5) * spin;
    p.avy = (Math.random() - 0.5) * spin;
    p.avz = (Math.random() - 0.5) * spin;
    p.sx = opts.sx;
    p.sy = opts.sy;
    p.sz = opts.sz;
    p.supportHeight = opts.supportHeight ?? 0.05;
    p.sleepTimer = 0;
    p.transientLife = this.isTransient ? opts.transientLife ?? 1.8 : -1;
    p.transientMaxLife = p.transientLife;

    this.color.setHex(opts.hexColor);
    this.mesh.setColorAt(idx, this.color);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this.dummy.position.set(p.px, p.py, p.pz);
    this.dummy.rotation.set(p.rx, p.ry, p.rz);
    this.dummy.scale.set(p.sx, p.sy, p.sz);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(idx, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  public applyBlastImpulse(ox: number, oy: number, oz: number, radius: number, strength: number): void {
    const rSq = radius * radius;
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i];
      if (!p.active) continue;
      const dx = p.px - ox;
      const dy = p.py - oy;
      const dz = p.pz - oz;
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq >= rSq) continue;
      const dist = Math.max(0.25, Math.sqrt(dSq));
      const normD = dist / radius;
      const falloff = (1 - normD * normD) / (1 + 0.35 * normD * normD);
      const spd = strength * falloff;
      p.sleeping = false;
      p.sleepTimer = 0;
      p.vx += (dx / dist) * spd;
      p.vy += ((dy / dist) + 0.55) * spd;
      p.vz += (dz / dist) * spd;
      p.avx += (Math.random() - 0.5) * 20 * falloff;
      p.avy += (Math.random() - 0.5) * 14 * falloff;
      p.avz += (Math.random() - 0.5) * 20 * falloff;
    }
  }

  public update(dt: number, elapsed: number, flutter = 0): void {
    let dirty = false;
    const damp = Math.pow(this.tuning.airDrag, dt * 60);

    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i];
      if (!p.active || p.sleeping) continue;
      dirty = true;

      if (this.isTransient && p.transientLife > 0) {
        p.transientLife -= dt;
        if (p.transientLife <= 0) {
          p.active = false;
          this.dummy.position.set(0, -999, 0);
          this.dummy.scale.set(0, 0, 0);
          this.dummy.updateMatrix();
          this.mesh.setMatrixAt(i, this.dummy.matrix);
          continue;
        }
      }

      p.vy += this.tuning.gravity * dt;
      p.vx *= damp;
      p.vy *= damp;
      p.vz *= damp;

      if (flutter > 0) {
        p.vx += Math.sin(elapsed * 8.2 + i * 1.7) * flutter * dt;
        p.vz += Math.cos(elapsed * 7.1 + i * 2.1) * flutter * 0.7 * dt;
      }

      p.px += p.vx * dt;
      p.py += p.vy * dt;
      p.pz += p.vz * dt;

      const floorY =
        groundHeightAt(p.px, p.pz) +
        (this.isTransient ? 0 : this.rubble.sample(p.px, p.pz)) +
        p.supportHeight;

      let onGround = false;
      if (p.py <= floorY) {
        p.py = floorY;
        onGround = true;
        if (Math.abs(p.vy) > 1.05) {
          p.vy = Math.abs(p.vy) * this.tuning.bounce;
          p.avx *= 0.65;
          p.avz *= 0.65;
        } else {
          p.vy = 0;
        }
        p.vx *= this.tuning.slideFriction;
        p.vz *= this.tuning.slideFriction;
        p.avx *= this.tuning.angDamp;
        p.avy *= this.tuning.angDamp;
        p.avz *= this.tuning.angDamp;
      }

      p.rx += p.avx * dt;
      p.ry += p.avy * dt;
      p.rz += p.avz * dt;

      if (!this.isTransient && onGround) {
        const speedSq = p.vx * p.vx + p.vy * p.vy + p.vz * p.vz;
        const angSq = p.avx * p.avx + p.avy * p.avy + p.avz * p.avz;
        if (speedSq < 0.08 && angSq < 0.14) {
          p.sleepTimer += dt;
          if (p.sleepTimer >= 0.25) {
            p.sleeping = true;
            p.vx = 0;
            p.vy = 0;
            p.vz = 0;
            p.avx = 0;
            p.avy = 0;
            p.avz = 0;
            // Gently flatten resting tilt for lying splinters/shards
            p.rx *= 0.35;
            p.rz *= 0.35;
          }
        } else {
          p.sleepTimer = 0;
        }
      }

      const scaleMul =
        this.isTransient && p.transientLife < 0.35
          ? Math.max(0.01, p.transientLife / 0.35)
          : 1.0;

      this.dummy.position.set(p.px, p.py, p.pz);
      this.dummy.rotation.set(p.rx, p.ry, p.rz);
      this.dummy.scale.set(p.sx * scaleMul, p.sy * scaleMul, p.sz * scaleMul);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }

    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach((m) => m.dispose());
    } else {
      this.mesh.material.dispose();
    }
  }
}

function createFeatherGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.14, 0);
  shape.quadraticCurveTo(-0.02, 0.065, 0.14, 0.012);
  shape.quadraticCurveTo(0.02, -0.055, -0.14, 0);
  return new THREE.ShapeGeometry(shape, 4);
}

/**
 * Coordinates Tier-1 Voronoi fractured polyhedral chunks (with sleep -> static merged demolition batches)
 * and Tier-2 persistent irregular procedural secondary debris (wood splinters, jagged stone rubble, glass shards)
 * plus transient bird plumage. Broken material debris NEVER fades out or vanishes.
 */
export class PersistentDebrisManager {
  private scene: THREE.Scene;
  private isSoftwareGl: boolean;
  private rubble = new RubbleHeightfield();

  private fractureMaterials: Record<BlockMaterialType, THREE.MeshStandardMaterial>;
  private staticLayers: Record<BlockMaterialType, StaticMergedDemolitionLayer>;
  private activeChunks: ActiveVoronoiChunk[] = [];
  private readonly maxActiveVoronoi = 135;

  private secondaryPools: Record<BlockMaterialType, PersistentInstancedPool[]>;
  private feathers: PersistentInstancedPool;

  private onGroundSlam?: (
    material: BlockMaterialType,
    x: number,
    y: number,
    z: number,
    speed: number,
  ) => void;

  private _quat = new THREE.Quaternion();
  private _invQuat = new THREE.Quaternion();
  private _deltaQuat = new THREE.Quaternion();
  private _vec = new THREE.Vector3();
  private _localImpact = new THREE.Vector3();
  private _worldMatrix = new THREE.Matrix4();
  private _scaleOne = new THREE.Vector3(1, 1, 1);

  constructor(
    scene: THREE.Scene,
    textures: TextureLibrary,
    isSoftwareGl: boolean,
    onGroundSlam?: (
      material: BlockMaterialType,
      x: number,
      y: number,
      z: number,
      speed: number,
    ) => void,
  ) {
    this.scene = scene;
    this.isSoftwareGl = isSoftwareGl;
    this.onGroundSlam = onGroundSlam;

    this.fractureMaterials = {
      wood: createFractureSurfaceMaterial(textures, 'wood', isSoftwareGl),
      stone: createFractureSurfaceMaterial(textures, 'stone', isSoftwareGl),
      glass: createFractureSurfaceMaterial(textures, 'glass', isSoftwareGl),
    };

    this.staticLayers = {
      wood: new StaticMergedDemolitionLayer(scene, this.fractureMaterials.wood, !isSoftwareGl),
      stone: new StaticMergedDemolitionLayer(scene, this.fractureMaterials.stone, !isSoftwareGl),
      glass: new StaticMergedDemolitionLayer(scene, this.fractureMaterials.glass, false),
    };

    const makeSecondaryPoolSet = (matType: BlockMaterialType, capPerVariant: number) => {
      const variants = createSecondaryDebrisVariants(matType, 3);
      return variants.map(
        (geo) =>
          new PersistentInstancedPool(
            scene,
            geo,
            this.fractureMaterials[matType],
            capPerVariant,
            MATERIAL_DEBRIS_TUNING[matType],
            this.rubble,
            false,
            false,
          ),
      );
    };

    this.secondaryPools = {
      wood: makeSecondaryPoolSet('wood', 160),
      stone: makeSecondaryPoolSet('stone', 160),
      glass: makeSecondaryPoolSet('glass', 160),
    };

    this.feathers = new PersistentInstancedPool(
      scene,
      createFeatherGeometry(),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.78,
        side: THREE.DoubleSide,
      }),
      100,
      {
        gravity: -2.9,
        bounce: 0.05,
        slideFriction: 0.7,
        airDrag: 0.92,
        angDamp: 0.85,
        spinScale: 8,
      },
      this.rubble,
      false,
      true,
    );
  }

  public spawnBlockFracture(
    material: BlockMaterialType,
    pos: Vec3,
    halfExtents: Vec3,
    quat: Quat,
    bodyVel: Vec3,
    impactPoint?: Vec3,
    impactDir?: Vec3,
    impactSpeed = 10,
  ): void {
    this._quat.set(quat.x, quat.y, quat.z, quat.w);
    this._invQuat.copy(this._quat).invert();

    if (impactPoint) {
      this._localImpact
        .set(impactPoint.x - pos.x, impactPoint.y - pos.y, impactPoint.z - pos.z)
        .applyQuaternion(this._invQuat);
    } else {
      this._localImpact.set(-halfExtents.x * 0.4, 0, 0);
    }

    const seed =
      Math.abs(pos.x * 13.7 + pos.y * 31.3 + pos.z * 7.9 + this._localImpact.x * 19.1) + 1;
    const pieces = generateFracturePieces(halfExtents, material, this._localImpact, seed);
    const tuning = MATERIAL_DEBRIS_TUNING[material];

    const dirX = impactDir?.x ?? (bodyVel.x !== 0 ? Math.sign(bodyVel.x) : 0.7);
    const dirY = impactDir?.y ?? 0.25;
    const dirZ = impactDir?.z ?? 0;
    const dirLen = Math.hypot(dirX, dirY, dirZ) || 1;
    const ndx = dirX / dirLen;
    const ndy = dirY / dirLen;
    const ndz = dirZ / dirLen;

    const baseImp = Math.min(18, Math.max(4.5, impactSpeed * 0.58));

    // If active Voronoi chunks are near cap, sleep oldest ones immediately into static batches
    while (this.activeChunks.length + pieces.length > this.maxActiveVoronoi && this.activeChunks.length > 0) {
      const oldest = this.activeChunks.shift()!;
      this.bakeChunkToStaticLayer(oldest);
    }

    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      // Transform local piece centroid to world space
      this._vec.set(piece.localOffset.x, piece.localOffset.y, piece.localOffset.z).applyQuaternion(this._quat);
      const wx = pos.x + this._vec.x;
      const wy = Math.max(0.08, pos.y + this._vec.y);
      const wz = pos.z + this._vec.z;

      const mesh = new THREE.Mesh(piece.geometry, this.fractureMaterials[material]);
      mesh.position.set(wx, wy, wz);
      mesh.quaternion.copy(this._quat);
      mesh.castShadow = !this.isSoftwareGl && material !== 'glass';
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // Proximity to exact impact point amplifies kinetic ejection
      const prox = 1 / (1 + piece.distanceFromImpact * 0.85);
      const scatterDirX = piece.localOffset.x - this._localImpact.x;
      const scatterDirY = piece.localOffset.y - this._localImpact.y;
      const scatterDirZ = piece.localOffset.z - this._localImpact.z;
      this._vec.set(scatterDirX, scatterDirY, scatterDirZ).applyQuaternion(this._quat);
      const sLen = Math.hypot(this._vec.x, this._vec.y, this._vec.z) || 1;
      const sx = this._vec.x / sLen;
      const sy = this._vec.y / sLen;
      const sz = this._vec.z / sLen;

      const massFactor = Math.max(0.45, 1.15 - piece.volumeRatio * 1.1);
      const kick = baseImp * (0.45 + prox * 0.95) * massFactor;
      const radialBurst = (2.2 + Math.random() * 4.2) * (0.6 + prox * 0.7);

      const vx = bodyVel.x * 0.65 + ndx * kick * 0.72 + sx * radialBurst;
      const vy =
        bodyVel.y * 0.55 +
        Math.max(1.2, ndy * kick * 0.48 + sy * radialBurst * 0.65) +
        Math.random() * 2.4;
      const vz = bodyVel.z * 0.65 + ndz * kick * 0.72 + sz * radialBurst;

      const spinAmp = tuning.spinScale * (0.4 + prox * 0.8) * massFactor;
      const supportRadius = Math.max(
        0.04,
        Math.min(piece.halfExtents.x, piece.halfExtents.y, piece.halfExtents.z) * 0.82,
      );

      this.activeChunks.push({
        mesh,
        material,
        px: wx,
        py: wy,
        pz: wz,
        vx,
        vy,
        vz,
        qx: this._quat.x,
        qy: this._quat.y,
        qz: this._quat.z,
        qw: this._quat.w,
        avx: (Math.random() - 0.5) * spinAmp,
        avy: (Math.random() - 0.5) * spinAmp * 0.75,
        avz: (Math.random() - 0.5) * spinAmp,
        halfExtents: piece.halfExtents,
        supportRadius,
        age: 0,
        sleepTimer: 0,
        settledGroundHit: false,
      });
    }

    // Spawn irregular procedural secondary micro-debris (persistent splinters, gravel, fine glass shards)
    this.spawnSecondaryDebrisBurst(material, pos, halfExtents, bodyVel, impactPoint, impactDir, impactSpeed);
  }

  private spawnSecondaryDebrisBurst(
    material: BlockMaterialType,
    pos: Vec3,
    halfExtents: Vec3,
    bodyVel: Vec3,
    impactPoint?: Vec3,
    impactDir?: Vec3,
    impactSpeed = 10,
  ): void {
    const pools = this.secondaryPools[material];
    const vol = halfExtents.x * halfExtents.y * halfExtents.z * 8;
    const density = Math.min(1.8, Math.max(0.75, Math.pow(vol, 0.25)));
    const count = Math.round((material === 'glass' ? 16 : material === 'wood' ? 14 : 15) * density);

    const originX = impactPoint?.x ?? pos.x;
    const originY = impactPoint?.y ?? pos.y;
    const originZ = impactPoint?.z ?? pos.z;
    const dirX = impactDir?.x ?? 0.5;
    const dirY = impactDir?.y ?? 0.35;
    const dirZ = impactDir?.z ?? 0;

    for (let i = 0; i < count; i++) {
      const pool = pools[i % pools.length];
      const theta = Math.random() * Math.PI * 2;
      const spd = (3.0 + Math.random() * 7.5) * Math.min(1.5, Math.max(0.7, impactSpeed * 0.08));
      const sc =
        material === 'stone'
          ? 0.45 + Math.random() * 0.75 // mix of gravel & medium jagged chunks
          : material === 'wood'
            ? 0.75 + Math.random() * 0.85
            : 0.65 + Math.random() * 0.95;

      const palette =
        material === 'wood'
          ? i % 3 === 0
            ? 0xe3b878
            : i % 3 === 1
              ? 0xc48b48
              : 0x9b642c
          : material === 'glass'
            ? i % 3 === 0
              ? 0xebfaff
              : i % 3 === 1
                ? 0xbceeff
                : 0xffffff
            : i % 3 === 0
              ? 0xa4acb5
              : i % 3 === 1
                ? 0x828992
                : 0x676e77;

      pool.spawn({
        x: originX + (Math.random() - 0.5) * Math.min(1.2, halfExtents.x * 1.4),
        y: Math.max(0.14, originY + (Math.random() - 0.5) * Math.min(1.2, halfExtents.y * 1.4)),
        z: originZ + (Math.random() - 0.5) * Math.min(1.2, halfExtents.z * 1.4),
        vx: bodyVel.x * 0.5 + dirX * 3.5 + Math.cos(theta) * spd,
        vy: bodyVel.y * 0.35 + dirY * 2.5 + 2.2 + Math.random() * 5.8,
        vz: bodyVel.z * 0.5 + dirZ * 3.5 + Math.sin(theta) * spd,
        sx: material === 'wood' ? sc * (0.9 + Math.random() * 0.7) : sc * (0.75 + Math.random() * 0.5),
        sy: material === 'wood' ? sc * 0.75 : sc * (0.7 + Math.random() * 0.5),
        sz: material === 'glass' ? 0.9 + Math.random() * 0.5 : sc * (0.75 + Math.random() * 0.5),
        supportHeight: material === 'glass' ? 0.025 : sc * 0.06,
        hexColor: palette,
      });
    }
  }

  public spawnImpactChips(
    material: BlockMaterialType,
    x: number,
    y: number,
    z: number,
    dirX = 0,
    dirY = 0.4,
    dirZ = 0,
    count = 5,
  ): void {
    const pools = this.secondaryPools[material];
    for (let i = 0; i < count; i++) {
      const pool = pools[i % pools.length];
      const theta = Math.random() * Math.PI * 2;
      const spd = 2.5 + Math.random() * 5.5;
      const sc = 0.42 + Math.random() * 0.45;
      pool.spawn({
        x: x + (Math.random() - 0.5) * 0.3,
        y: Math.max(0.1, y + (Math.random() - 0.5) * 0.25),
        z: z + (Math.random() - 0.5) * 0.3,
        vx: -dirX * 2.2 + Math.cos(theta) * spd,
        vy: 1.8 + Math.max(0, dirY * 2) + Math.random() * 3.5,
        vz: -dirZ * 2.2 + Math.sin(theta) * spd,
        sx: sc,
        sy: sc,
        sz: sc,
        supportHeight: material === 'glass' ? 0.02 : sc * 0.05,
        hexColor:
          material === 'wood'
            ? 0xd6a05a
            : material === 'glass'
              ? 0xe4f9ff
              : 0x8e959e,
      });
    }
  }

  public spawnBlastRubble(x: number, y: number, z: number, count: number): void {
    const pools = this.secondaryPools.stone;
    for (let i = 0; i < count; i++) {
      const pool = pools[i % pools.length];
      const theta = Math.random() * Math.PI * 2;
      const sp = 5.5 + Math.random() * 12.5;
      const sc = 0.5 + Math.random() * 0.85;
      pool.spawn({
        x: x + (Math.random() - 0.5) * 0.8,
        y: Math.max(0.18, y),
        z: z + (Math.random() - 0.5) * 0.8,
        vx: Math.cos(theta) * sp,
        vy: 3.5 + Math.random() * 9.5,
        vz: Math.sin(theta) * sp,
        sx: sc,
        sy: sc * 0.8,
        sz: sc,
        supportHeight: sc * 0.08,
        hexColor: i % 2 === 0 ? 0x45403b : 0x68625a,
      });
    }
  }

  public spawnFeathers(birdType: BirdType, x: number, y: number, z: number, count = 10): void {
    const color =
      birdType === 'red' ? 0xe02828 : birdType === 'yellow' ? 0xf5cb24 : 0x2f333b;
    for (let i = 0; i < count; i++) {
      this.feathers.spawn({
        x: x + (Math.random() - 0.5) * 0.45,
        y: y + (Math.random() - 0.5) * 0.45,
        z: z + (Math.random() - 0.5) * 0.45,
        vx: (Math.random() - 0.5) * 8.5,
        vy: 1.8 + Math.random() * 5.2,
        vz: (Math.random() - 0.5) * 8.5,
        sx: 0.9 + Math.random() * 0.6,
        sy: 0.9 + Math.random() * 0.6,
        sz: 1,
        spin: 8,
        hexColor: color,
        transientLife: 1.65 + Math.random() * 0.55,
      });
    }
  }

  public applyBlastImpulse(ox: number, oy: number, oz: number, radius: number, strength: number): void {
    const rSq = radius * radius;
    for (const c of this.activeChunks) {
      const dx = c.px - ox;
      const dy = c.py - oy;
      const dz = c.pz - oz;
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq >= rSq) continue;
      const dist = Math.max(0.3, Math.sqrt(dSq));
      const normD = dist / radius;
      const falloff = (1 - normD * normD) / (1 + 0.35 * normD * normD);
      const spd = strength * falloff;
      c.sleepTimer = 0;
      c.vx += (dx / dist) * spd;
      c.vy += ((dy / dist) + 0.5) * spd;
      c.vz += (dz / dist) * spd;
      c.avx += (Math.random() - 0.5) * 14 * falloff;
      c.avy += (Math.random() - 0.5) * 10 * falloff;
      c.avz += (Math.random() - 0.5) * 14 * falloff;
    }

    for (const mat of ['wood', 'stone', 'glass'] as BlockMaterialType[]) {
      for (const pool of this.secondaryPools[mat]) {
        pool.applyBlastImpulse(ox, oy, oz, radius, strength * 1.15);
      }
    }
  }

  private bakeChunkToStaticLayer(c: ActiveVoronoiChunk): void {
    this._vec.set(c.px, c.py, c.pz);
    this._quat.set(c.qx, c.qy, c.qz, c.qw);
    this._worldMatrix.compose(this._vec, this._quat, this._scaleOne);

    this.staticLayers[c.material].appendGeometry(c.mesh.geometry, this._worldMatrix);
    this.rubble.stamp(
      c.px,
      c.pz,
      Math.max(0.22, c.halfExtents.x),
      Math.max(0.22, c.halfExtents.z),
      Math.min(0.35, c.supportRadius * 1.1),
    );

    this.scene.remove(c.mesh);
    c.mesh.geometry.dispose();
  }

  public update(
    dt: number,
    elapsed: number,
    obstacles: ActiveBlockObstacle[] = [],
  ): void {
    // Update active Voronoi chunks and transition settled ones into static merged layers
    for (let i = this.activeChunks.length - 1; i >= 0; i--) {
      const c = this.activeChunks[i];
      const tuning = MATERIAL_DEBRIS_TUNING[c.material];
      c.age += dt;

      c.vy += tuning.gravity * dt;
      const damp = Math.pow(tuning.airDrag, dt * 60);
      c.vx *= damp;
      c.vy *= damp;
      c.vz *= damp;

      c.px += c.vx * dt;
      c.py += c.vy * dt;
      c.pz += c.vz * dt;

      // Light obstacle deflection against standing fortress blocks
      for (let k = 0; k < obstacles.length; k++) {
        const ob = obstacles[k];
        const dx = c.px - ob.position.x;
        const dy = c.py - ob.position.y;
        const dz = c.pz - ob.position.z;
        const ex = ob.halfExtents.x + c.supportRadius * 0.7;
        const ey = ob.halfExtents.y + c.supportRadius * 0.7;
        const ez = ob.halfExtents.z + c.supportRadius * 0.7;
        if (Math.abs(dx) < ex && Math.abs(dy) < ey && Math.abs(dz) < ez) {
          const ox = ex - Math.abs(dx);
          const oy = ey - Math.abs(dy);
          const oz = ez - Math.abs(dz);
          if (oy <= ox && oy <= oz) {
            const s = dy >= 0 ? 1 : -1;
            c.py += s * oy;
            if (c.vy * s < 0) c.vy = -c.vy * tuning.bounce;
            c.vx *= 0.82;
            c.vz *= 0.82;
          } else if (ox <= oz) {
            const s = dx >= 0 ? 1 : -1;
            c.px += s * ox;
            if (c.vx * s < 0) c.vx = -c.vx * (tuning.bounce + 0.12);
          } else {
            const s = dz >= 0 ? 1 : -1;
            c.pz += s * oz;
            if (c.vz * s < 0) c.vz = -c.vz * (tuning.bounce + 0.12);
          }
        }
      }

      const floorY = groundHeightAt(c.px, c.pz) + this.rubble.sample(c.px, c.pz) + c.supportRadius;
      let onGround = false;
      if (c.py <= floorY) {
        c.py = floorY;
        onGround = true;
        const impactVy = Math.abs(c.vy);
        if (impactVy > 2.8 && !c.settledGroundHit) {
          c.settledGroundHit = true;
          this.onGroundSlam?.(c.material, c.px, floorY - c.supportRadius, c.pz, impactVy);
        }
        if (impactVy > 1.1) {
          c.vy = impactVy * tuning.bounce;
          c.avx *= 0.62;
          c.avz *= 0.62;
        } else {
          c.vy = 0;
        }
        c.vx *= tuning.slideFriction;
        c.vz *= tuning.slideFriction;
        c.avx *= tuning.angDamp;
        c.avy *= tuning.angDamp;
        c.avz *= tuning.angDamp;
      }

      // Integrate quaternion
      const halfDt = 0.5 * dt;
      const dqx = c.avx * halfDt;
      const dqy = c.avy * halfDt;
      const dqz = c.avz * halfDt;
      const qx = c.qx;
      const qy = c.qy;
      const qz = c.qz;
      const qw = c.qw;
      c.qx += dqx * qw + dqy * qz - dqz * qy;
      c.qy += dqy * qw + dqz * qx - dqx * qz;
      c.qz += dqz * qw + dqx * qy - dqy * qx;
      c.qw += -dqx * qx - dqy * qy - dqz * qz;
      const qLen = Math.hypot(c.qx, c.qy, c.qz, c.qw) || 1;
      c.qx /= qLen;
      c.qy /= qLen;
      c.qz /= qLen;
      c.qw /= qLen;

      c.mesh.position.set(c.px, c.py, c.pz);
      c.mesh.quaternion.set(c.qx, c.qy, c.qz, c.qw);

      const speedSq = c.vx * c.vx + c.vy * c.vy + c.vz * c.vz;
      const angSq = c.avx * c.avx + c.avy * c.avy + c.avz * c.avz;
      if (onGround && speedSq < 0.1 && angSq < 0.16) {
        c.sleepTimer += dt;
      } else {
        c.sleepTimer = 0;
      }

      if (c.sleepTimer >= 0.32 || (c.age > 5.0 && c.py <= floorY + 0.25)) {
        this.activeChunks.splice(i, 1);
        this.bakeChunkToStaticLayer(c);
      }
    }

    for (const mat of ['wood', 'stone', 'glass'] as BlockMaterialType[]) {
      for (const pool of this.secondaryPools[mat]) {
        pool.update(dt, elapsed);
      }
    }
    this.feathers.update(dt, elapsed, 7.5);
  }

  public reset(): void {
    for (const c of this.activeChunks) {
      this.scene.remove(c.mesh);
      c.mesh.geometry.dispose();
    }
    this.activeChunks = [];
    this.rubble.reset();

    for (const mat of ['wood', 'stone', 'glass'] as BlockMaterialType[]) {
      this.staticLayers[mat].reset();
      for (const pool of this.secondaryPools[mat]) {
        pool.reset();
      }
    }
    this.feathers.reset();
  }

  public dispose(): void {
    this.reset();
    for (const mat of ['wood', 'stone', 'glass'] as BlockMaterialType[]) {
      this.staticLayers[mat].dispose();
      for (const pool of this.secondaryPools[mat]) {
        pool.dispose();
      }
      this.fractureMaterials[mat].dispose();
    }
    this.feathers.dispose();
  }
}

import * as THREE from 'three';
import type { BirdType, BlockMaterialType, PigVariant } from './types';
import type { TextureLibrary } from './textures';

export interface SlingshotRig {
  group: THREE.Group;
  leftAnchor: THREE.Vector3;
  rightAnchor: THREE.Vector3;
  pouchGroup: THREE.Group;
  leftBand: THREE.Mesh;
  rightBand: THREE.Mesh;
  updateBands: (pouchWorldPos: THREE.Vector3, lookDir: THREE.Vector3) => void;
}

export interface BirdVisual {
  group: THREE.Group;
  fuseTip?: THREE.Mesh;
  fuseLight?: THREE.PointLight;
  wingLeft: THREE.Object3D;
  wingRight: THREE.Object3D;
}

export interface BlockMaterialSet {
  wood: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  ironTrim: THREE.MeshStandardMaterial;
  darkWoodTrim: THREE.MeshStandardMaterial;
  stoneTrim: THREE.MeshStandardMaterial;
  glassFrame: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export interface DamageUniforms {
  uDamage: { value: number };
  uImpactLocal: { value: THREE.Vector3 };
}

export interface DetailedBlockVisual {
  group: THREE.Group;
  primaryMat: THREE.MeshStandardMaterial;
  damageUniforms: DamageUniforms;
  geometries: THREE.BufferGeometry[];
}

const CRACK_GLSL_HELPERS = /* glsl */ `
float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return fract(sin(p) * 43758.5453123);
}

// Returns vec2(minDist, secondMinDist - minDist) for Voronoi crack ridge detection
vec2 voronoiCrack3D(vec3 x) {
  vec3 n = floor(x);
  vec3 f = fract(x);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int k = -1; k <= 1; k++) {
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec3 g = vec3(float(i), float(j), float(k));
        vec3 o = hash33(n + g);
        vec3 r = g + o - f;
        float d = dot(r, r);
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
  }
  return vec2(sqrt(max(0.0001, d1)), sqrt(max(0.0001, d2)) - sqrt(max(0.0001, d1)));
}
`;

export function enhanceBlockMaterialWithDamage<T extends THREE.MeshStandardMaterial>(
  mat: T,
  matType: BlockMaterialType,
): DamageUniforms {
  const uniforms: DamageUniforms = {
    uDamage: { value: 0.0 },
    uImpactLocal: { value: new THREE.Vector3(0, 0, 0) },
  };
  const typeCode = matType === 'wood' ? 0 : matType === 'stone' ? 1 : 2;
  mat.userData.damageUniforms = uniforms;
  mat.customProgramCacheKey = () => `block-damage-${typeCode}`;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDamage = uniforms.uDamage;
    shader.uniforms.uImpactLocal = uniforms.uImpactLocal;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vDmgLocalPos;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vDmgLocalPos = position;`,
      );

    const crackFrag =
      typeCode === 0
        ? /* glsl */ `
          // Wood: anisotropic longitudinal stress splits + exposed light sapwood fibers
          if (uDamage > 0.02) {
            float impactDist = length(vDmgLocalPos - uImpactLocal);
            float localMask = clamp(1.18 - impactDist * 0.28 + uDamage * 0.72, 0.0, 1.0);
            vec3 woodCoord = vec3(vDmgLocalPos.x * 1.4, vDmgLocalPos.y * 5.2, vDmgLocalPos.z * 5.2);
            vec2 vor = voronoiCrack3D(woodCoord + vec3(0.0, sin(vDmgLocalPos.x * 3.5) * 0.35, 0.0));
            float thresh = mix(0.015, 0.145, uDamage) * localMask;
            float splitMask = 1.0 - smoothstep(thresh * 0.35, thresh + 0.025, vor.y);
            float fiberLip = (1.0 - smoothstep(thresh, thresh + 0.09, vor.y)) * (1.0 - splitMask);
            float fiberGrain = 0.85 + 0.15 * sin(vDmgLocalPos.x * 46.0 + vDmgLocalPos.y * 18.0);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.90, 0.74, 0.50) * fiberGrain, fiberLip * 0.75 * uDamage);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.11, 0.06, 0.03), splitMask * 0.88);
          }`
        : typeCode === 1
          ? /* glsl */ `
            // Stone: deep jagged Voronoi fissures + pale chipped spall lips
            if (uDamage > 0.02) {
              float impactDist = length(vDmgLocalPos - uImpactLocal);
              float localMask = clamp(1.22 - impactDist * 0.25 + uDamage * 0.78, 0.0, 1.0);
              vec3 stCoord = vDmgLocalPos * 2.85 + vec3(sin(vDmgLocalPos.y * 7.0), cos(vDmgLocalPos.z * 7.0), sin(vDmgLocalPos.x * 7.0)) * 0.12;
              vec2 vor = voronoiCrack3D(stCoord);
              float thresh = mix(0.015, 0.16, uDamage) * localMask;
              float fissure = 1.0 - smoothstep(thresh * 0.28, thresh + 0.018, vor.y);
              float spallLip = (1.0 - smoothstep(thresh, thresh + 0.085, vor.y)) * (1.0 - fissure);
              diffuseColor.rgb += vec3(0.15, 0.15, 0.16) * spallLip * uDamage;
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.08, 0.08, 0.09), fissure * 0.86);
            }`
          : /* glsl */ `
            // Glass: crisp radial + concentric spiderweb fracture lines radiating from impact
            if (uDamage > 0.02) {
              vec3 d = vDmgLocalPos - uImpactLocal;
              float r = length(d);
              float ang = atan(d.y + d.z * 0.45, d.x + d.z * 0.75);
              float spoke = abs(sin(ang * 7.0 + sin(r * 6.0) * 0.55));
              float spokeLine = 1.0 - smoothstep(0.02, 0.065 + uDamage * 0.055, spoke);
              float ring = abs(fract(r * 2.6) - 0.5) * 2.0;
              float ringLine = 1.0 - smoothstep(0.03, 0.08 + uDamage * 0.05, 1.0 - ring);
              float web = max(spokeLine, ringLine * 0.85) * clamp(1.25 - r * 0.22 + uDamage * 0.65, 0.0, 1.0);
              float webStrength = web * clamp(uDamage * 1.35, 0.0, 1.0);
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.99, 1.0), webStrength * 0.92);
              diffuseColor.a = clamp(diffuseColor.a + webStrength * 0.45, 0.0, 0.98);
            }`;

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uDamage;
        uniform vec3 uImpactLocal;
        varying vec3 vDmgLocalPos;
        ${CRACK_GLSL_HELPERS}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        ${crackFrag}`,
      );
  };

  return uniforms;
}

export function createFractureSurfaceMaterial(
  textures: TextureLibrary,
  materialType: BlockMaterialType,
  isSoftwareGl: boolean,
): THREE.MeshStandardMaterial {
  let mat: THREE.MeshStandardMaterial;
  if (materialType === 'glass') {
    mat = new THREE.MeshPhysicalMaterial({
      color: 0xd4f4ff,
      map: textures.glass.map,
      roughnessMap: textures.glass.roughnessMap,
      normalMap: textures.glass.normalMap,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughness: 0.05,
      metalness: 0.06,
      ior: 1.52,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      specularIntensity: 1.0,
      transmission: isSoftwareGl ? 0 : 0.65,
      transparent: true,
      opacity: isSoftwareGl ? 0.72 : 0.88,
      envMapIntensity: 1.35,
      side: THREE.DoubleSide,
    });
  } else if (materialType === 'wood') {
    mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.wood.map,
      roughnessMap: textures.wood.roughnessMap,
      normalMap: textures.wood.normalMap,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.72,
      metalness: 0.02,
      envMapIntensity: 0.55,
    });
  } else {
    mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.stone.map,
      roughnessMap: textures.stone.roughnessMap,
      normalMap: textures.stone.normalMap,
      normalScale: new THREE.Vector2(1.05, 1.05),
      roughness: 0.88,
      metalness: 0.05,
      envMapIntensity: 0.48,
    });
  }

  const typeCode = materialType === 'wood' ? 0 : materialType === 'stone' ? 1 : 2;
  mat.customProgramCacheKey = () => `fracture-inner-${typeCode}`;
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aInnerFace;
        varying float vInnerFace;
        varying vec3 vFracLocalPos;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vInnerFace = aInnerFace;
        vFracLocalPos = position;`,
      );

    const innerColorPatch =
      typeCode === 0
        ? /* glsl */ `
          if (vInnerFace > 0.4) {
            float fiber = 0.86 + 0.14 * sin(vFracLocalPos.x * 58.0 + sin(vFracLocalPos.y * 26.0) * 1.6);
            vec3 rawWood = vec3(0.91, 0.76, 0.51) * fiber;
            diffuseColor.rgb = mix(diffuseColor.rgb, rawWood, clamp(vInnerFace * 0.88, 0.0, 1.0));
          }`
        : typeCode === 1
          ? /* glsl */ `
            if (vInnerFace > 0.4) {
              float grain = hash31(floor(vFracLocalPos * 42.0));
              float mica = step(0.84, grain) * 0.22;
              vec3 rawGranite = vec3(0.66, 0.68, 0.71) * (0.85 + grain * 0.28) + vec3(mica);
              diffuseColor.rgb = mix(diffuseColor.rgb, rawGranite, clamp(vInnerFace * 0.86, 0.0, 1.0));
            }`
          : /* glsl */ `
            if (vInnerFace > 0.4) {
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.99, 1.0), 0.65);
              diffuseColor.a = max(diffuseColor.a, 0.9);
            }`;

    const innerRoughnessPatch =
      typeCode === 0
        ? `if (vInnerFace > 0.4) { roughnessFactor = clamp(roughnessFactor + 0.16, 0.05, 1.0); }`
        : typeCode === 1
          ? `if (vInnerFace > 0.4) { roughnessFactor = clamp(roughnessFactor + 0.08, 0.05, 1.0); }`
          : `if (vInnerFace > 0.4) { roughnessFactor = clamp(roughnessFactor + 0.14, 0.02, 0.4); }`;

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying float vInnerFace;
        varying vec3 vFracLocalPos;
        ${CRACK_GLSL_HELPERS}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        ${innerColorPatch}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        ${innerRoughnessPatch}`,
      );
  };

  return mat;
}

export function groundHeightAt(x: number, z: number): number {
  // Flat playable meadow strip from x in [-26, 26], z in [-11.5, 11.5]
  const dx = Math.max(0, Math.abs(x) - 26);
  const dz = Math.max(0, Math.abs(z) - 11.5);
  const distOut = Math.sqrt(dx * dx + dz * dz);
  if (distOut <= 0) return 0;

  const hillWave =
    Math.sin(x * 0.085) * Math.cos(z * 0.095) * 1.55 +
    Math.sin(x * 0.04 + z * 0.05) * 2.4 +
    Math.cos(x * 0.022 - z * 0.03) * 1.3 +
    2.4;
  const blend = Math.min(1, distOut / 14);
  const smooth = blend * blend * (3 - 2 * blend);
  return smooth * (distOut * 0.27 + hillWave * 0.68);
}

export function createBlockMaterials(
  textures: TextureLibrary,
  isSoftwareGl: boolean,
): BlockMaterialSet {
  const wood = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.wood.map,
    roughnessMap: textures.wood.roughnessMap,
    normalMap: textures.wood.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 0.68,
    metalness: 0.02,
    envMapIntensity: 0.58,
  });

  const stone = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.stone.map,
    roughnessMap: textures.stone.roughnessMap,
    normalMap: textures.stone.normalMap,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughness: 0.86,
    metalness: 0.05,
    envMapIntensity: 0.48,
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xbfefff,
    map: textures.glass.map,
    roughnessMap: textures.glass.roughnessMap,
    normalMap: textures.glass.normalMap,
    normalScale: new THREE.Vector2(0.25, 0.25),
    roughness: 0.06,
    metalness: 0.02,
    ior: 1.5,
    clearcoat: 0.95,
    clearcoatRoughness: 0.06,
    specularIntensity: 0.85,
    transmission: isSoftwareGl ? 0 : 0.82,
    thickness: 0.55,
    attenuationColor: new THREE.Color(0x74d0f2),
    attenuationDistance: 2.4,
    transparent: true,
    opacity: isSoftwareGl ? 0.58 : 0.92,
    envMapIntensity: 1.15,
  });

  const ironTrim = new THREE.MeshStandardMaterial({
    color: 0x2c3038,
    roughness: 0.38,
    metalness: 0.84,
    envMapIntensity: 0.9,
  });

  const darkWoodTrim = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.slingshotWood.map,
    roughnessMap: textures.slingshotWood.roughnessMap,
    normalMap: textures.slingshotWood.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.74,
    metalness: 0.02,
    envMapIntensity: 0.48,
  });

  const stoneTrim = new THREE.MeshStandardMaterial({
    color: 0xc2c7ce,
    map: textures.stone.map,
    roughnessMap: textures.stone.roughnessMap,
    normalMap: textures.stone.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.9,
    metalness: 0.04,
    envMapIntensity: 0.42,
  });

  const glassFrame = new THREE.MeshStandardMaterial({
    color: 0x30363e,
    roughness: 0.46,
    metalness: 0.72,
    envMapIntensity: 0.82,
  });

  return {
    wood,
    stone,
    glass,
    ironTrim,
    darkWoodTrim,
    stoneTrim,
    glassFrame,
    dispose: () => {
      wood.dispose();
      stone.dispose();
      glass.dispose();
      ironTrim.dispose();
      darkWoodTrim.dispose();
      stoneTrim.dispose();
      glassFrame.dispose();
    },
  };
}

export function createBeveledBlockGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const bevel = Math.min(0.045, Math.min(w, h, d) * 0.12);
  const iw = Math.max(0.02, w - bevel * 2);
  const ih = Math.max(0.02, h - bevel * 2);
  const id = Math.max(0.02, d - bevel * 2);

  const shape = new THREE.Shape();
  shape.moveTo(-iw * 0.5, -ih * 0.5);
  shape.lineTo(iw * 0.5, -ih * 0.5);
  shape.lineTo(iw * 0.5, ih * 0.5);
  shape.lineTo(-iw * 0.5, ih * 0.5);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: id,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 2,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

export function createDetailedBlockVisual(
  w: number,
  h: number,
  d: number,
  material: BlockMaterialType,
  blockMaterials: BlockMaterialSet,
  isSoftwareGl: boolean,
): DetailedBlockVisual {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const primaryMat = blockMaterials[material].clone();
  const damageUniforms = enhanceBlockMaterialWithDamage(primaryMat, material);
  const cast = !isSoftwareGl && material !== 'glass';

  const addPart = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    px = 0,
    py = 0,
    pz = 0,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => {
    geometries.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    if (rx !== 0 || ry !== 0 || rz !== 0) m.rotation.set(rx, ry, rz);
    m.castShadow = cast;
    m.receiveShadow = true;
    group.add(m);
  };

  if (material === 'glass') {
    const frameThick = Math.min(0.075, Math.min(w, h, d) * 0.18);
    const coreGeo = createBeveledBlockGeometry(
      Math.max(0.08, w - frameThick * 0.6),
      Math.max(0.08, h - frameThick * 0.6),
      Math.max(0.08, d - frameThick * 0.6),
    );
    addPart(coreGeo, primaryMat);

    const topBotGeo = new THREE.BoxGeometry(w, frameThick, d);
    addPart(topBotGeo, blockMaterials.glassFrame, 0, h * 0.5 - frameThick * 0.5, 0);
    addPart(topBotGeo.clone(), blockMaterials.glassFrame, 0, -h * 0.5 + frameThick * 0.5, 0);

    if (w >= d) {
      const sideGeo = new THREE.BoxGeometry(frameThick, Math.max(0.05, h - frameThick * 2), d);
      addPart(sideGeo, blockMaterials.glassFrame, -w * 0.5 + frameThick * 0.5, 0, 0);
      addPart(sideGeo.clone(), blockMaterials.glassFrame, w * 0.5 - frameThick * 0.5, 0, 0);
      if (w >= 2.0 && h >= 1.4) {
        const mullionGeo = new THREE.BoxGeometry(frameThick * 0.7, h - frameThick * 2, d * 0.92);
        addPart(mullionGeo, blockMaterials.glassFrame, 0, 0, 0);
      }
    } else {
      const sideGeo = new THREE.BoxGeometry(w, Math.max(0.05, h - frameThick * 2), frameThick);
      addPart(sideGeo, blockMaterials.glassFrame, 0, 0, -d * 0.5 + frameThick * 0.5);
      addPart(sideGeo.clone(), blockMaterials.glassFrame, 0, 0, d * 0.5 - frameThick * 0.5);
      if (d >= 2.0 && h >= 1.4) {
        const mullionGeo = new THREE.BoxGeometry(w * 0.92, h - frameThick * 2, frameThick * 0.7);
        addPart(mullionGeo, blockMaterials.glassFrame, 0, 0, 0);
      }
    }
    return { group, primaryMat, damageUniforms, geometries };
  }

  if (material === 'wood') {
    const coreGeo = createBeveledBlockGeometry(w * 0.985, h * 0.985, d * 0.985);
    addPart(coreGeo, primaryMat);

    const isVerticalPillar = h >= w * 1.6 && h >= d * 1.6;
    const isLongSpan = !isVerticalPillar && (w >= 2.2 || d >= 2.2);
    const isCrate = !isVerticalPillar && !isLongSpan && w <= 1.6 && h <= 1.6 && d <= 1.6;

    if (isVerticalPillar) {
      const bandH = 0.11;
      const bandGeo = new THREE.BoxGeometry(w + 0.02, bandH, d + 0.02);
      addPart(bandGeo, blockMaterials.ironTrim, 0, h * 0.5 - 0.14, 0);
      addPart(bandGeo.clone(), blockMaterials.ironTrim, 0, -h * 0.5 + 0.14, 0);
      const shoeGeo = new THREE.BoxGeometry(w + 0.03, 0.14, d + 0.03);
      addPart(shoeGeo, blockMaterials.darkWoodTrim, 0, -h * 0.5 + 0.07, 0);
    } else if (isLongSpan) {
      const strapW = 0.14;
      if (w >= d) {
        const strapGeo = new THREE.BoxGeometry(strapW, h + 0.02, d + 0.02);
        addPart(strapGeo, blockMaterials.ironTrim, -w * 0.36, 0, 0);
        addPart(strapGeo.clone(), blockMaterials.ironTrim, w * 0.36, 0, 0);
        const railGeo = new THREE.BoxGeometry(w * 0.96, 0.08, d + 0.025);
        addPart(railGeo, blockMaterials.darkWoodTrim, 0, -h * 0.5 + 0.06, 0);
      } else {
        const strapGeo = new THREE.BoxGeometry(w + 0.02, h + 0.02, strapW);
        addPart(strapGeo, blockMaterials.ironTrim, 0, 0, -d * 0.36);
        addPart(strapGeo.clone(), blockMaterials.ironTrim, 0, 0, d * 0.36);
      }
    } else if (isCrate) {
      const edge = 0.1;
      const hBar = new THREE.BoxGeometry(w + 0.015, edge, d + 0.015);
      addPart(hBar, blockMaterials.darkWoodTrim, 0, h * 0.5 - edge * 0.5, 0);
      addPart(hBar.clone(), blockMaterials.darkWoodTrim, 0, -h * 0.5 + edge * 0.5, 0);
      const diagLen = Math.hypot(w * 0.78, h * 0.78);
      const diagX = new THREE.BoxGeometry(diagLen, 0.09, d + 0.02);
      addPart(diagX, blockMaterials.darkWoodTrim, 0, 0, 0, 0, 0, Math.atan2(h, w));
      const diagZ = new THREE.BoxGeometry(w + 0.02, 0.09, Math.hypot(d * 0.78, h * 0.78));
      addPart(diagZ, blockMaterials.darkWoodTrim, 0, 0, 0, Math.atan2(h, d), 0, 0);
    }
    return { group, primaryMat, damageUniforms, geometries };
  }

  const coreGeo = createBeveledBlockGeometry(w * 0.985, h * 0.985, d * 0.985);
  addPart(coreGeo, primaryMat);

  const isStonePillar = h >= w * 1.55 && h >= d * 1.55;
  const isWideWall = !isStonePillar && (w >= 1.7 || d >= 1.7);

  if (isStonePillar) {
    const capH = Math.min(0.18, h * 0.12);
    const capGeo = new THREE.BoxGeometry(w + 0.03, capH, d + 0.03);
    addPart(capGeo, blockMaterials.stoneTrim, 0, h * 0.5 - capH * 0.5, 0);
    addPart(capGeo.clone(), blockMaterials.stoneTrim, 0, -h * 0.5 + capH * 0.5, 0);
  } else if (isWideWall) {
    const trimH = Math.min(0.13, h * 0.22);
    const corniceGeo = new THREE.BoxGeometry(w + 0.02, trimH, d + 0.02);
    addPart(corniceGeo, blockMaterials.stoneTrim, 0, h * 0.5 - trimH * 0.5, 0);
    if (h >= 1.5) {
      const midBand = new THREE.BoxGeometry(w + 0.025, 0.08, d + 0.025);
      addPart(midBand, blockMaterials.ironTrim, 0, 0, 0);
    }
  } else {
    const copingH = Math.min(0.14, h * 0.2);
    const copingGeo = new THREE.BoxGeometry(w + 0.025, copingH, d + 0.025);
    addPart(copingGeo, blockMaterials.stoneTrim, 0, h * 0.5 - copingH * 0.5, 0);
  }

  return { group, primaryMat, damageUniforms, geometries };
}

function createBirdBodyGeometry(birdType: BirdType, radius: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const segs = 22;
  for (let i = 0; i <= segs; i++) {
    const t = (i / segs) * Math.PI;
    const y = -Math.cos(t) * radius;
    let r = Math.sin(t) * radius;
    if (birdType === 'yellow') {
      const factor = 1.18 - 0.58 * (i / segs);
      r *= Math.max(0.05, factor);
    } else if (birdType === 'black') {
      const pear = 1.07 - 0.19 * (i / segs);
      r *= pear;
    } else {
      r *= 1.0 + 0.09 * Math.sin(t * 2) - 0.04 * Math.cos(t * 3);
    }
    pts.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  const geo = new THREE.LatheGeometry(pts, 32);
  geo.computeVertexNormals();
  return geo;
}

function createSculptedFeatherGeometry(length: number, width: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -width * 0.25);
  shape.quadraticCurveTo(length * 0.55, -width * 0.58, length, 0);
  shape.quadraticCurveTo(length * 0.55, width * 0.58, 0, width * 0.25);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width * 0.14,
    bevelEnabled: true,
    bevelThickness: width * 0.06,
    bevelSize: width * 0.05,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.computeVertexNormals();
  return geo;
}

function createEyeMesh(size: number, irisHex = 0x3b2210): THREE.Group {
  const eyeGroup = new THREE.Group();
  const scleraMat = new THREE.MeshPhysicalMaterial({
    color: 0xfbf9f2,
    roughness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
  });
  const limbalMat = new THREE.MeshPhysicalMaterial({
    color: 0x160e08,
    roughness: 0.12,
    clearcoat: 1.0,
  });
  const irisMat = new THREE.MeshPhysicalMaterial({
    color: irisHex,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x050507 });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const sclera = new THREE.Mesh(new THREE.SphereGeometry(size, 18, 14), scleraMat);
  sclera.scale.set(0.85, 1.08, 0.72);
  eyeGroup.add(sclera);

  const limbal = new THREE.Mesh(new THREE.SphereGeometry(size * 0.62, 14, 12), limbalMat);
  limbal.position.set(size * 0.39, 0, 0);
  limbal.scale.set(0.54, 0.92, 0.92);
  eyeGroup.add(limbal);

  const iris = new THREE.Mesh(new THREE.SphereGeometry(size * 0.54, 14, 12), irisMat);
  iris.position.set(size * 0.44, 0, 0);
  iris.scale.set(0.55, 0.9, 0.9);
  eyeGroup.add(iris);

  const pupil = new THREE.Mesh(new THREE.SphereGeometry(size * 0.33, 12, 10), pupilMat);
  pupil.position.set(size * 0.55, 0, 0);
  pupil.scale.set(0.5, 0.85, 0.85);
  eyeGroup.add(pupil);

  const glint = new THREE.Mesh(new THREE.SphereGeometry(size * 0.13, 8, 8), glintMat);
  glint.position.set(size * 0.65, size * 0.24, size * 0.22);
  eyeGroup.add(glint);

  return eyeGroup;
}

export function createBirdModel(birdType: BirdType, radius: number, isSoftwareGl: boolean): BirdVisual {
  const group = new THREE.Group();

  const mainColor =
    birdType === 'red' ? 0xc81e1e : birdType === 'yellow' ? 0xebb815 : 0x20232a;
  const secondaryFeatherColor =
    birdType === 'red' ? 0x991212 : birdType === 'yellow' ? 0xc79208 : 0x15171c;
  const bellyColor =
    birdType === 'red' ? 0xf2dec2 : birdType === 'yellow' ? 0xf8f3db : 0x5c616d;

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: mainColor,
    roughness: birdType === 'black' ? 0.52 : 0.68,
    metalness: 0.03,
    sheen: birdType === 'black' ? 0.18 : 0.52,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(mainColor).lerp(new THREE.Color(0xffe9c2), 0.38),
  });
  const featherAccentMat = new THREE.MeshPhysicalMaterial({
    color: secondaryFeatherColor,
    roughness: 0.64,
    metalness: 0.04,
    sheen: 0.45,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0xffdfa8),
  });
  const bellyMat = new THREE.MeshPhysicalMaterial({
    color: bellyColor,
    roughness: 0.78,
    sheen: 0.35,
    sheenRoughness: 0.72,
    metalness: 0.0,
  });
  const beakMat = new THREE.MeshPhysicalMaterial({
    color: 0xf49d1a,
    roughness: 0.3,
    metalness: 0.04,
    clearcoat: 0.35,
    clearcoatRoughness: 0.25,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x16161a,
    roughness: 0.6,
    metalness: 0.06,
  });

  // 1. Primary sculpted body
  const bodyMesh = new THREE.Mesh(createBirdBodyGeometry(birdType, radius), bodyMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // 2. Sculpted feathered belly patch
  const belly = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.72, 18, 14), bellyMat);
  belly.position.set(radius * 0.34, -radius * 0.28, 0);
  belly.scale.set(0.75, 0.78, 0.88);
  group.add(belly);

  // 3. Dual-part keratin beak
  const upperBeak = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.26, radius * 0.56, 16), beakMat);
  upperBeak.rotation.z = -Math.PI * 0.48;
  upperBeak.position.set(radius * 1.04, -radius * 0.02, 0);
  upperBeak.scale.set(0.85, 1, 1.12);
  upperBeak.castShadow = true;
  group.add(upperBeak);

  const lowerBeak = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.2, radius * 0.4, 14), beakMat);
  lowerBeak.rotation.z = -Math.PI * 0.58;
  lowerBeak.position.set(radius * 0.94, -radius * 0.16, 0);
  lowerBeak.scale.set(0.7, 1, 0.96);
  group.add(lowerBeak);

  // 4 & 5. Glossy Clearcoat Corneal Eyes
  const eyeOffsetX = birdType === 'yellow' ? radius * 0.66 : radius * 0.8;
  const eyeY = radius * 0.14;
  const eyeZ = radius * 0.3;
  const irisTint = birdType === 'red' ? 0x6b2f10 : birdType === 'yellow' ? 0x455a1f : 0x523414;

  const eyeL = createEyeMesh(radius * 0.24, irisTint);
  eyeL.position.set(eyeOffsetX, eyeY, -eyeZ);
  eyeL.rotation.y = 0.25;
  group.add(eyeL);

  const eyeR = createEyeMesh(radius * 0.24, irisTint);
  eyeR.position.set(eyeOffsetX, eyeY, eyeZ);
  eyeR.rotation.y = -0.25;
  group.add(eyeR);

  // 6. Sculpted V-brows
  const browGeo = new THREE.BoxGeometry(radius * 0.12, radius * 0.12, radius * 0.44);
  const browMat = birdType === 'red' ? darkMat : new THREE.MeshStandardMaterial({ color: 0x3b180e, roughness: 0.7 });
  const browL = new THREE.Mesh(browGeo, browMat);
  browL.position.set(eyeOffsetX + radius * 0.08, eyeY + radius * 0.25, -eyeZ * 0.85);
  browL.rotation.set(0.32, 0.2, 0);
  group.add(browL);

  const browR = new THREE.Mesh(browGeo, browMat);
  browR.position.set(eyeOffsetX + radius * 0.08, eyeY + radius * 0.25, eyeZ * 0.85);
  browR.rotation.set(-0.32, -0.2, 0);
  group.add(browR);

  // 7. Layered multi-feather wings (3 overlapping primaries per side)
  const wingFeatherGeo = createSculptedFeatherGeometry(radius * 0.56, radius * 0.24);
  const buildWing = (side: -1 | 1) => {
    const wg = new THREE.Group();
    wg.position.set(-radius * 0.06, -radius * 0.04, side * radius * 0.86);
    for (let f = 0; f < 3; f++) {
      const fm = new THREE.Mesh(wingFeatherGeo, f === 0 ? bodyMat : featherAccentMat);
      fm.rotation.y = Math.PI + side * (0.28 + f * 0.14);
      fm.rotation.z = -0.18 + f * 0.22;
      fm.position.set(-f * radius * 0.06, -f * radius * 0.05, side * f * radius * 0.03);
      fm.castShadow = true;
      wg.add(fm);
    }
    group.add(wg);
    return wg;
  };
  const wingLeft = buildWing(-1);
  const wingRight = buildWing(1);

  // 8. Layered sculpted tail fan (4 overlapping feathers)
  const tailGeo = createSculptedFeatherGeometry(radius * 0.62, radius * 0.2);
  for (let i = -1.5; i <= 1.5; i += 1) {
    const tail = new THREE.Mesh(tailGeo, darkMat);
    tail.position.set(-radius * 0.85, radius * 0.06 + Math.abs(i) * radius * 0.05, i * radius * 0.09);
    tail.rotation.y = Math.PI + i * 0.2;
    tail.rotation.z = -0.16 - Math.abs(i) * 0.08;
    group.add(tail);
  }

  // 9. Species-specific Sculpted Crest / Fuse
  let fuseTip: THREE.Mesh | undefined;
  let fuseLight: THREE.PointLight | undefined;

  if (birdType === 'red') {
    const crestGeo = createSculptedFeatherGeometry(radius * 0.54, radius * 0.22);
    for (let i = 0; i < 2; i++) {
      const plume = new THREE.Mesh(crestGeo, i === 0 ? bodyMat : featherAccentMat);
      plume.position.set(-radius * (0.04 + i * 0.14), radius * (0.94 - i * 0.08), 0);
      plume.rotation.y = Math.PI;
      plume.rotation.z = -0.36 - i * 0.32;
      plume.castShadow = true;
      group.add(plume);
    }
  } else if (birdType === 'yellow') {
    const spikeGeo = createSculptedFeatherGeometry(radius * 0.56, radius * 0.18);
    for (let i = 0; i < 3; i++) {
      const spike = new THREE.Mesh(spikeGeo, i === 1 ? bodyMat : featherAccentMat);
      spike.position.set(-radius * 0.1 * i, radius * 0.92, (i - 1) * radius * 0.1);
      spike.rotation.y = Math.PI + (i - 1) * 0.16;
      spike.rotation.z = -0.45 - i * 0.18;
      group.add(spike);
    }
  } else {
    const fuseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, radius * 0.92, 0),
      new THREE.Vector3(-radius * 0.12, radius * 1.25, radius * 0.08),
      new THREE.Vector3(-radius * 0.28, radius * 1.44, -radius * 0.04),
    ]);
    const fuseMesh = new THREE.Mesh(
      new THREE.TubeGeometry(fuseCurve, 12, radius * 0.065, 8, false),
      new THREE.MeshStandardMaterial({ color: 0x8b6f47, roughness: 0.9 }),
    );
    group.add(fuseMesh);

    fuseTip = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.13, 10, 10),
      new THREE.MeshStandardMaterial({
        color: 0xffaa22,
        emissive: 0xff5500,
        emissiveIntensity: 3.2,
        roughness: 0.2,
      }),
    );
    fuseTip.position.set(-radius * 0.28, radius * 1.44, -radius * 0.04);
    group.add(fuseTip);

    if (!isSoftwareGl) {
      fuseLight = new THREE.PointLight(0xff6b1a, 1.5, 5);
      fuseLight.position.copy(fuseTip.position);
      group.add(fuseLight);
    }
  }

  return { group, fuseTip, fuseLight, wingLeft, wingRight };
}

export function createPigModel(radius: number, variant: PigVariant): THREE.Group {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0x67c43e,
    roughness: 0.36,
    metalness: 0.02,
    clearcoat: 0.42,
    clearcoatRoughness: 0.24,
  });
  const snoutMat = new THREE.MeshPhysicalMaterial({
    color: 0x8ae05e,
    roughness: 0.3,
    metalness: 0.02,
    clearcoat: 0.48,
    clearcoatRoughness: 0.22,
  });
  const nostrilMat = new THREE.MeshStandardMaterial({
    color: 0x1e4a12,
    roughness: 0.85,
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 20), skinMat);
  body.scale.set(1.04, 0.94, 1.04);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const snout = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.36, radius * 0.42, radius * 0.28, 18),
    snoutMat,
  );
  snout.rotation.z = Math.PI * 0.5;
  snout.position.set(-radius * 0.92, -radius * 0.06, 0);
  snout.scale.set(1.0, 1.0, 1.24);
  snout.castShadow = true;
  group.add(snout);

  const nosGeo = new THREE.SphereGeometry(radius * 0.085, 10, 8);
  const nosL = new THREE.Mesh(nosGeo, nostrilMat);
  nosL.position.set(-radius * 1.05, -radius * 0.03, -radius * 0.16);
  nosL.scale.set(0.4, 1.15, 0.85);
  group.add(nosL);

  const nosR = new THREE.Mesh(nosGeo, nostrilMat);
  nosR.position.set(-radius * 1.05, -radius * 0.03, radius * 0.16);
  nosR.scale.set(0.4, 1.15, 0.85);
  group.add(nosR);

  const eyeL = createEyeMesh(radius * 0.21, 0x2b3612);
  eyeL.position.set(-radius * 0.72, radius * 0.16, -radius * 0.44);
  eyeL.rotation.y = Math.PI - 0.32;
  group.add(eyeL);

  const eyeR = createEyeMesh(radius * 0.21, 0x2b3612);
  eyeR.position.set(-radius * 0.72, radius * 0.16, radius * 0.44);
  eyeR.rotation.y = Math.PI + 0.32;
  group.add(eyeR);

  const earGeo = new THREE.CylinderGeometry(radius * 0.18, radius * 0.14, radius * 0.14, 14);
  const earL = new THREE.Mesh(earGeo, skinMat);
  earL.position.set(-radius * 0.15, radius * 0.78, -radius * 0.62);
  earL.rotation.set(-0.45, 0.2, 0.35);
  group.add(earL);

  const earR = new THREE.Mesh(earGeo, skinMat);
  earR.position.set(-radius * 0.15, radius * 0.78, radius * 0.62);
  earR.rotation.set(0.45, -0.2, 0.35);
  group.add(earR);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(radius * 0.94, -radius * 0.1, 0),
    new THREE.Vector3(radius * 1.12, radius * 0.05, radius * 0.1),
    new THREE.Vector3(radius * 1.05, radius * 0.18, -radius * 0.06),
  ]);
  const tailMesh = new THREE.Mesh(
    new THREE.TubeGeometry(tailCurve, 10, radius * 0.05, 8, false),
    snoutMat,
  );
  group.add(tailMesh);

  if (variant === 'helmet') {
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x6f7b87,
      roughness: 0.32,
      metalness: 0.86,
    });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.04, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
      steelMat,
    );
    dome.position.y = radius * 0.12;
    dome.castShadow = true;
    group.add(dome);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.02, radius * 0.06, 10, 24),
      steelMat,
    );
    rim.rotation.x = Math.PI * 0.5;
    rim.position.y = radius * 0.15;
    group.add(rim);
  } else if (variant === 'king') {
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf5bd2e,
      roughness: 0.2,
      metalness: 0.94,
    });
    const crownBand = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.58, radius * 0.5, radius * 0.34, 18),
      goldMat,
    );
    crownBand.position.y = radius * 0.94;
    crownBand.castShadow = true;
    group.add(crownBand);

    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const prong = new THREE.Mesh(
        new THREE.ConeGeometry(radius * 0.12, radius * 0.28, 8),
        goldMat,
      );
      prong.position.set(
        Math.cos(ang) * radius * 0.45,
        radius * 1.2,
        Math.sin(ang) * radius * 0.45,
      );
      group.add(prong);
    }

    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(radius * 0.12, 0),
      new THREE.MeshPhysicalMaterial({
        color: 0xe6294b,
        roughness: 0.06,
        clearcoat: 1.0,
      }),
    );
    gem.position.set(-radius * 0.52, radius * 0.95, 0);
    group.add(gem);
  }

  return group;
}

export function createSlingshotModel(
  origin: { x: number; y: number; z: number },
  textures: TextureLibrary,
): SlingshotRig {
  const group = new THREE.Group();
  group.position.set(origin.x, 0, origin.z);

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.slingshotWood.map,
    roughnessMap: textures.slingshotWood.roughnessMap,
    normalMap: textures.slingshotWood.normalMap,
    normalScale: new THREE.Vector2(0.46, 0.46),
    roughness: 0.82,
    metalness: 0.02,
  });

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.stone.map,
    roughnessMap: textures.stone.roughnessMap,
    normalMap: textures.stone.normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.88,
  });

  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.leather.map,
    roughnessMap: textures.leather.roughnessMap,
    normalMap: textures.leather.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.66,
  });

  const forgedIronMat = new THREE.MeshStandardMaterial({
    color: 0x272b32,
    roughness: 0.36,
    metalness: 0.88,
    envMapIntensity: 0.95,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd9a84e,
    roughness: 0.24,
    metalness: 0.92,
    envMapIntensity: 1.05,
  });

  // 1. Two-tier carved stone & wrought-iron anchor plinth (grounded at y = 0)
  const plinthBase = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.48, 0.24, 18), stoneMat);
  plinthBase.position.y = 0.12;
  plinthBase.receiveShadow = true;
  plinthBase.castShadow = true;
  group.add(plinthBase);

  const plinthCap = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 1.12, 0.22, 16), stoneMat);
  plinthCap.position.y = 0.33;
  plinthCap.receiveShadow = true;
  plinthCap.castShadow = true;
  group.add(plinthCap);

  // Forged iron socket flange + 4 anchor bolts
  const baseCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.54, 0.2, 16), forgedIronMat);
  baseCollar.position.y = 0.5;
  baseCollar.castShadow = true;
  group.add(baseCollar);

  const boltGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.12, 6);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    const bolt = new THREE.Mesh(boltGeo, brassMat);
    bolt.position.set(Math.cos(a) * 0.42, 0.54, Math.sin(a) * 0.42);
    group.add(bolt);
  }

  // 2. Main carved walnut trunk
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 1.75, 18), woodMat);
  trunk.position.y = 1.32;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  // Stitched leather grip wrap + brass binding rings
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.305, 0.78, 18), leatherMat);
  grip.position.y = 1.15;
  grip.castShadow = true;
  group.add(grip);

  const ringGeo = new THREE.TorusGeometry(0.295, 0.028, 8, 22);
  for (const ry of [0.76, 1.54]) {
    const ring = new THREE.Mesh(ringGeo, brassMat);
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = ry;
    group.add(ring);
  }

  // Forged iron Y-junction reinforcement yoke & rivets
  const yokeBand = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.27, 0.32, 16), forgedIronMat);
  yokeBand.position.y = 1.98;
  yokeBand.castShadow = true;
  group.add(yokeBand);

  const rivetGeo = new THREE.SphereGeometry(0.036, 8, 8);
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const rivet = new THREE.Mesh(rivetGeo, brassMat);
    rivet.position.set(Math.cos(ang) * 0.29, 1.98, Math.sin(ang) * 0.29);
    group.add(rivet);
  }

  // 3 & 4. Left & Right curved carved Y-fork branches (TubeGeometry)
  const leftForkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.95, 0),
    new THREE.Vector3(0.05, 2.45, -0.58),
    new THREE.Vector3(0.0, 3.15, -0.92),
  ]);
  const leftFork = new THREE.Mesh(new THREE.TubeGeometry(leftForkCurve, 16, 0.17, 14, false), woodMat);
  leftFork.castShadow = true;
  group.add(leftFork);

  const rightForkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.95, 0),
    new THREE.Vector3(0.05, 2.45, 0.58),
    new THREE.Vector3(0.0, 3.15, 0.92),
  ]);
  const rightFork = new THREE.Mesh(
    new THREE.TubeGeometry(rightForkCurve, 16, 0.17, 14, false),
    woodMat,
  );
  rightFork.castShadow = true;
  group.add(rightFork);

  // 5 & 6. Forged iron & brass fork ferrules + leather anchor collars
  for (const zSide of [-0.92, 0.92]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.185, 14, 12), woodMat);
    cap.position.set(0, 3.16, zSide);
    group.add(cap);

    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.195, 0.24, 16), brassMat);
    ferrule.position.set(0, 3.04, zSide);
    ferrule.castShadow = true;
    group.add(ferrule);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.032, 8, 18), forgedIronMat);
    collar.rotation.x = Math.PI * 0.5;
    collar.position.set(0, 2.93, zSide);
    group.add(collar);
  }

  // 7. Worn Stitched Leather Pouch (beveled ExtrudeGeometry)
  const pouchGroup = new THREE.Group();
  const pouchShape = new THREE.Shape();
  pouchShape.moveTo(-0.28, -0.22);
  pouchShape.quadraticCurveTo(0, -0.34, 0.28, -0.22);
  pouchShape.lineTo(0.32, 0.22);
  pouchShape.quadraticCurveTo(0, 0.34, -0.32, 0.22);
  pouchShape.closePath();
  const pouchGeo = new THREE.ExtrudeGeometry(pouchShape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  pouchGeo.center();
  const pouchMesh = new THREE.Mesh(pouchGeo, leatherMat);
  pouchMesh.rotation.y = Math.PI * 0.5;
  pouchMesh.castShadow = true;
  pouchGroup.add(pouchMesh);
  group.add(pouchGroup);

  // 8 & 9. Tensioned tanned-leather elastic bands
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.leather.map,
    roughnessMap: textures.leather.roughnessMap,
    roughness: 0.48,
    metalness: 0.04,
  });
  const bandGeo = new THREE.CylinderGeometry(0.068, 0.068, 1, 10);
  const leftBand = new THREE.Mesh(bandGeo, bandMat);
  leftBand.castShadow = true;
  const rightBand = new THREE.Mesh(bandGeo, bandMat);
  rightBand.castShadow = true;
  group.add(leftBand, rightBand);

  const leftAnchor = new THREE.Vector3(origin.x, 3.05, origin.z - 0.92);
  const rightAnchor = new THREE.Vector3(origin.x, 3.05, origin.z + 0.92);

  const upAxis = new THREE.Vector3(0, 1, 0);
  const tmpLocalPouch = new THREE.Vector3();
  const tmpLocalAnchor = new THREE.Vector3();
  const tmpDiff = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpLookTarget = new THREE.Vector3();

  const updateBands = (pouchWorldPos: THREE.Vector3, lookDir: THREE.Vector3) => {
    tmpLocalPouch.copy(pouchWorldPos).sub(group.position);
    pouchGroup.position.copy(tmpLocalPouch);
    tmpLookTarget.copy(pouchWorldPos).add(lookDir);
    pouchGroup.lookAt(tmpLookTarget);

    const updateOne = (band: THREE.Mesh, anchorWorld: THREE.Vector3) => {
      tmpLocalAnchor.copy(anchorWorld).sub(group.position);
      tmpDiff.copy(tmpLocalPouch).sub(tmpLocalAnchor);
      const len = Math.max(0.05, tmpDiff.length());
      band.position.copy(tmpLocalAnchor).addScaledVector(tmpDiff, 0.5);
      tmpDiff.normalize();
      tmpQuat.setFromUnitVectors(upAxis, tmpDiff);
      band.quaternion.copy(tmpQuat);
      const thickness = Math.max(0.45, 1.15 - len * 0.11);
      band.scale.set(thickness, len, thickness);
    };

    updateOne(leftBand, leftAnchor);
    updateOne(rightBand, rightAnchor);
  };

  updateBands(new THREE.Vector3(origin.x, origin.y, origin.z), new THREE.Vector3(1, 0, 0));

  return {
    group,
    leftAnchor,
    rightAnchor,
    pouchGroup,
    leftBand,
    rightBand,
    updateBands,
  };
}

export function buildEnvironment(
  scene: THREE.Scene,
  textures: TextureLibrary,
  isSoftwareGl: boolean,
): { clouds: THREE.Group[]; dispose: () => void } {
  const disposables: Array<{ dispose: () => void }> = [];

  // 1. Sculpted PBR terrain mesh with organic vertex color blending (meadow, golden slope grass, stone ridges)
  const terrainGeo = new THREE.PlaneGeometry(210, 165, 108, 84);
  terrainGeo.rotateX(-Math.PI * 0.5);
  const posAttr = terrainGeo.attributes.position;
  const tColors = new Float32Array(posAttr.count * 3);
  const colMeadow = new THREE.Color(0x9cb376);
  const colDryGrass = new THREE.Color(0xcab678);
  const colSlopeRock = new THREE.Color(0x7c7b74);
  const colTmp = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const y = groundHeightAt(x, z);
    posAttr.setY(i, y);

    const patch = Math.sin(x * 0.12 + z * 0.08) * 0.5 + 0.5;
    const slopeMix = Math.min(1, Math.max(0, (y - 2.4) / 7.5));
    colTmp.copy(colMeadow).lerp(colDryGrass, patch * 0.55);
    colTmp.lerp(colSlopeRock, slopeMix * 0.72);
    tColors[i * 3] = colTmp.r;
    tColors[i * 3 + 1] = colTmp.g;
    tColors[i * 3 + 2] = colTmp.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(tColors, 3));
  terrainGeo.computeVertexNormals();
  disposables.push(terrainGeo);

  const terrainMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    map: textures.grass.map,
    roughnessMap: textures.grass.roughnessMap,
    normalMap: textures.grass.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.9,
    metalness: 0.0,
    envMapIntensity: 0.38,
  });
  disposables.push(terrainMat);

  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.receiveShadow = true;
  scene.add(terrain);

  // Compacted earth & gravel trail between slingshot and fortress (gently curved shoulder edges)
  const pathGeo = new THREE.PlaneGeometry(44, 7.6, 28, 6);
  pathGeo.rotateX(-Math.PI * 0.5);
  const pPos = pathGeo.attributes.position;
  for (let i = 0; i < pPos.count; i++) {
    const px = pPos.getX(i);
    const pz = pPos.getZ(i);
    // Subtle natural path wander & slight crown in center
    const edgeFactor = Math.abs(pz) / 3.8;
    const crown = Math.max(0, 1 - edgeFactor * edgeFactor) * 0.025;
    pPos.setZ(i, pz + Math.sin(px * 0.14) * 0.42);
    pPos.setY(i, crown);
  }
  pathGeo.computeVertexNormals();

  const pathMat = new THREE.MeshStandardMaterial({
    color: 0xebd9be,
    map: textures.dirt.map,
    roughnessMap: textures.dirt.roughnessMap,
    normalMap: textures.dirt.normalMap,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughness: 0.92,
    envMapIntensity: 0.28,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const pathMesh = new THREE.Mesh(pathGeo, pathMat);
  pathMesh.position.set(1, 0.015, 0);
  pathMesh.receiveShadow = true;
  scene.add(pathMesh);
  disposables.push(pathGeo, pathMat);

  // Scattered gravel stones along the compacted trail edges
  const pebbleGeo = new THREE.DodecahedronGeometry(0.11, 0);
  const pebbleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.stone.map,
    roughness: 0.88,
    metalness: 0.04,
  });
  const pebbleCount = 72;
  const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleCount);
  pebbles.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  for (let i = 0; i < pebbleCount; i++) {
    const px = -20 + ((i * 53) % 42);
    const side = i % 2 === 0 ? 1 : -1;
    const pz = side * (3.1 + (i % 5) * 0.26) + Math.sin(px * 0.14) * 0.42;
    const sc = 0.55 + (i % 4) * 0.35;
    dummy.position.set(px, 0.02, pz);
    dummy.rotation.set(i * 0.5, i * 1.1, i * 0.3);
    dummy.scale.set(sc * 1.25, sc * 0.58, sc);
    dummy.updateMatrix();
    pebbles.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.09, 0.14, 0.48 + (i % 4) * 0.09);
    pebbles.setColorAt(i, tint);
  }
  pebbles.instanceMatrix.needsUpdate = true;
  if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
  pebbles.computeBoundingSphere();
  scene.add(pebbles);
  disposables.push(pebbleGeo, pebbleMat);

  // 2. Instanced Multi-Tier Organic Conifers (Root-flared bark trunk + 5 staggered irregular bough tiers)
  const treeCoords: Array<[number, number, number]> = [];
  const treeSeeds = [
    [-34, -18], [-28, -22], [-18, -20], [-6, -24], [8, -22], [22, -24], [34, -19], [42, -12],
    [-36, 18], [-24, 21], [-10, 23], [6, 22], [20, 24], [36, 20], [44, 10],
    [38, -2], [41, 4], [33, -10], [35, 12], [-38, -5], [-40, 7], [-32, 12], [-30, -11],
    [14, -27], [28, -29], [-14, -29], [2, 28], [26, 28], [-20, 29], [47, -22], [49, 18],
    [29, -17], [40, -24], [-25, -16], [12, 26], [32, 25],
  ];
  for (let i = 0; i < treeSeeds.length; i++) {
    const [tx, tz] = treeSeeds[i];
    const scale = 0.88 + ((i * 37) % 100) * 0.0038;
    treeCoords.push([tx, tz, scale]);
  }

  const perturbCone = (geo: THREE.BufferGeometry, amp: number, seed: number) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i);
      const vy = p.getY(i);
      const vz = p.getZ(i);
      const r = Math.hypot(vx, vz);
      if (r > 0.14) {
        const ang = Math.atan2(vz, vx);
        const branchLobe = Math.sin(ang * 6 + vy * 2.3 + seed) * amp;
        const droop = Math.cos(ang * 4 - vy * 1.6) * (amp * 0.55);
        const wave = 1 + branchLobe + droop;
        p.setX(i, vx * wave);
        p.setZ(i, vz * wave);
        p.setY(i, vy + (Math.sin(ang * 7 + seed) - 0.35) * amp * 0.45);
      }
    }
    geo.computeVertexNormals();
  };

  // Flared root-to-trunk lathe profile
  const trunkPts = [
    new THREE.Vector2(0.68, 0),
    new THREE.Vector2(0.46, 0.55),
    new THREE.Vector2(0.36, 2.2),
    new THREE.Vector2(0.18, 4.4),
  ];
  const trunkGeo = new THREE.LatheGeometry(trunkPts, 10);
  trunkGeo.computeVertexNormals();
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.bark.map,
    roughnessMap: textures.bark.roughnessMap,
    normalMap: textures.bark.normalMap,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughness: 0.9,
  });

  const tierSpecs: Array<[number, number, number, number, number]> = [
    [2.35, 2.5, 3.05, 0.13, 1.1],
    [1.98, 2.3, 4.15, 0.14, 2.7],
    [1.6, 2.1, 5.2, 0.14, 4.3],
    [1.22, 1.85, 6.15, 0.15, 5.9],
    [0.82, 1.55, 7.05, 0.14, 7.4],
  ];

  const canopyGeos = tierSpecs.map(([r, h, y, amp, seed]) => {
    const g = new THREE.ConeGeometry(r, h, 14, 4);
    g.translate(0, y, 0);
    perturbCone(g, amp, seed);
    return g;
  });

  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.pineNeedles.map,
    roughnessMap: textures.pineNeedles.roughnessMap,
    normalMap: textures.pineNeedles.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.86,
    metalness: 0.0,
    envMapIntensity: 0.28,
  });

  const treeCount = treeCoords.length;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  trunks.castShadow = !isSoftwareGl;
  trunks.receiveShadow = true;

  const canopyMeshes = canopyGeos.map((g, idx) => {
    const im = new THREE.InstancedMesh(g, canopyMat, treeCount);
    im.castShadow = !isSoftwareGl;
    im.receiveShadow = idx < 3;
    return im;
  });

  for (let i = 0; i < treeCount; i++) {
    const [tx, tz, sc] = treeCoords[i];
    const ty = groundHeightAt(tx, tz) - 0.12;
    dummy.position.set(tx, ty, tz);
    dummy.rotation.set(0, (i * 1.7) % (Math.PI * 2), 0);
    dummy.scale.set(sc, sc * (0.92 + (i % 3) * 0.09), sc);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);

    canopyMeshes.forEach((im, tIdx) => {
      im.setMatrixAt(i, dummy.matrix);
      const lum = 0.62 + tIdx * 0.065 + (i % 5) * 0.04;
      tint.setHSL(0.28 + (i % 4) * 0.015, 0.26, Math.min(0.95, lum));
      im.setColorAt(i, tint);
    });
  }
  trunks.instanceMatrix.needsUpdate = true;
  trunks.computeBoundingSphere();
  canopyMeshes.forEach((im) => {
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
  });

  scene.add(trunks, ...canopyMeshes);
  disposables.push(trunkGeo, trunkMat, canopyMat, ...canopyGeos);

  // 3. Instanced Sculpted Mossy Granite Boulders
  const rockGeo = new THREE.DodecahedronGeometry(1.18, 2);
  const rockPos = rockGeo.attributes.position;
  for (let i = 0; i < rockPos.count; i++) {
    const vx = rockPos.getX(i);
    const vy = rockPos.getY(i);
    const vz = rockPos.getZ(i);
    const crag =
      1 +
      Math.sin(vx * 3.1 + vy * 2.4) * 0.16 +
      Math.cos(vz * 3.7 - vx * 1.9) * 0.12;
    rockPos.setXYZ(i, vx * crag, vy * crag, vz * crag);
  }
  rockGeo.computeVertexNormals();

  // Blend granite rock grey with lush moss on top-facing facets
  const rockNorm = rockGeo.attributes.normal;
  const rCols = new Float32Array(rockPos.count * 3);
  const cGranite = new THREE.Color(0xb8bcc2);
  const cMoss = new THREE.Color(0x527337);
  for (let i = 0; i < rockPos.count; i++) {
    const ny = rockNorm.getY(i);
    const mossMix = Math.min(1, Math.max(0, (ny - 0.26) * 2.0));
    colTmp.copy(cGranite).lerp(cMoss, mossMix * 0.85);
    rCols[i * 3] = colTmp.r;
    rCols[i * 3 + 1] = colTmp.g;
    rCols[i * 3 + 2] = colTmp.b;
  }
  rockGeo.setAttribute('color', new THREE.BufferAttribute(rCols, 3));

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    map: textures.stone.map,
    roughnessMap: textures.stone.roughnessMap,
    normalMap: textures.stone.normalMap,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughness: 0.88,
  });
  const rockCount = 32;
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rocks.castShadow = !isSoftwareGl;
  rocks.receiveShadow = true;

  for (let i = 0; i < rockCount; i++) {
    const angle = (i / rockCount) * Math.PI * 2;
    const rad = 26 + (i % 4) * 5.5;
    const rx = Math.cos(angle) * rad * 1.18;
    const rz = Math.sin(angle) * rad * 0.72;
    const ry = groundHeightAt(rx, rz) + 0.08;
    const sc = 0.72 + (i % 5) * 0.34;
    dummy.position.set(rx, ry, rz);
    dummy.rotation.set(i * 0.15, i * 1.3, i * 0.12);
    dummy.scale.set(sc * 1.25, sc * 0.74, sc);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.24, 0.08, 0.68 + (i % 3) * 0.08);
    rocks.setColorAt(i, tint);
  }
  rocks.instanceMatrix.needsUpdate = true;
  if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
  rocks.computeBoundingSphere();
  scene.add(rocks);
  disposables.push(rockGeo, rockMat);

  // 3b. Instanced Multi-Blade Meadow Grass Clumps along path edges & boulders
  const makeClumpGeometry = (): THREE.BufferGeometry => {
    const blades: THREE.BufferGeometry[] = [];
    for (let b = 0; b < 4; b++) {
      const g = new THREE.ConeGeometry(0.036, 0.4, 4);
      g.translate(0, 0.2, 0);
      const ang = (b / 4) * Math.PI * 2 + 0.35;
      g.rotateZ(0.28);
      g.rotateY(ang);
      g.translate(Math.cos(ang) * 0.04, 0, Math.sin(ang) * 0.04);
      blades.push(g);
    }
    const posLen = blades.reduce((s, g) => s + g.attributes.position.count, 0);
    const positions = new Float32Array(posLen * 3);
    const normals = new Float32Array(posLen * 3);
    const indices: number[] = [];
    let vOff = 0;
    for (const g of blades) {
      const p = g.attributes.position.array as Float32Array;
      const n = g.attributes.normal.array as Float32Array;
      positions.set(p, vOff * 3);
      normals.set(n, vOff * 3);
      if (g.index) {
        for (let k = 0; k < g.index.count; k++) {
          indices.push(g.index.getX(k) + vOff);
        }
      }
      vOff += g.attributes.position.count;
      g.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    merged.setIndex(indices);
    return merged;
  };

  const tuftGeo = makeClumpGeometry();
  const tuftMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.84,
    metalness: 0.0,
    envMapIntensity: 0.22,
  });
  const tuftCount = 190;
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, tuftCount);
  for (let i = 0; i < tuftCount; i++) {
    const gx = -26 + ((i * 67) % 62);
    const side = i % 2 === 0 ? 1 : -1;
    const band = i % 3 === 0 ? 3.8 + (i % 5) * 0.45 : 13.5 + ((i * 13) % 10);
    const gz = side * band;
    const gy = groundHeightAt(gx, gz) - 0.03;
    dummy.position.set(gx, gy, gz);
    dummy.rotation.set(0, i * 1.17, 0);
    const sc = 0.8 + (i % 5) * 0.14;
    dummy.scale.set(sc, sc * (0.85 + (i % 4) * 0.12), sc);
    dummy.updateMatrix();
    tufts.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.24 + (i % 5) * 0.014, 0.48, 0.09 + (i % 4) * 0.015);
    tufts.setColorAt(i, tint);
  }
  tufts.instanceMatrix.needsUpdate = true;
  if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
  tufts.computeBoundingSphere();
  scene.add(tufts);
  disposables.push(tuftGeo, tuftMat);

  // 4. Golden-hour drifting stratocumulus sky wisps (high & soft so title lockup reads cleanly)
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffebd6,
    roughness: 1.0,
    metalness: 0.0,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
  });
  const cloudSphereGeo = new THREE.SphereGeometry(1, 14, 10);
  disposables.push(cloudMat, cloudSphereGeo);

  const clouds: THREE.Group[] = [];
  for (let c = 0; c < 8; c++) {
    const cg = new THREE.Group();
    const puffs = 5 + (c % 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(cloudSphereGeo, cloudMat);
      const pr = 2.4 + ((p + c) % 3) * 0.95;
      puff.scale.set(pr * 2.15, pr * 0.48, pr * 1.15);
      puff.position.set((p - puffs * 0.5) * 2.8, ((p % 2) - 0.35) * 0.42, (p % 3 - 1) * 0.7);
      cg.add(puff);
    }
    cg.position.set(-60 + c * 20, 29 + (c % 3) * 4.5, -52 - (c % 4) * 12);
    scene.add(cg);
    clouds.push(cg);
  }

  return {
    clouds,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}

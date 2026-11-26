import * as THREE from 'three';

export interface ProceduralPBRSet {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
}

export interface TextureLibrary {
  wood: ProceduralPBRSet;
  stone: ProceduralPBRSet;
  glass: ProceduralPBRSet;
  grass: ProceduralPBRSet;
  dirt: ProceduralPBRSet;
  slingshotWood: ProceduralPBRSet;
  leather: ProceduralPBRSet;
  bark: ProceduralPBRSet;
  pineNeedles: ProceduralPBRSet;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

function hash2d(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number, period = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const wrap = (n: number) => (period > 0 ? ((n % period) + period) % period : n);
  const x0 = wrap(ix);
  const x1 = wrap(ix + 1);
  const y0 = wrap(iy);
  const y1 = wrap(iy + 1);
  const a = hash2d(x0, y0, seed);
  const b = hash2d(x1, y0, seed);
  const c = hash2d(x0, y1, seed);
  const d = hash2d(x1, y1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, seed: number, octaves = 4, basePeriod = 0): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    const p = basePeriod > 0 ? Math.round(basePeriod * freq) : 0;
    val += amp * smoothNoise(x * freq, y * freq, seed + i * 19, p);
    freq *= 2;
    amp *= 0.5;
  }
  return val;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function configureTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  maxAniso: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAniso;
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a tileable tangent-space normal map using a 3x3 Sobel filter
 * over a normalized height buffer [0..1].
 */
function buildNormalCanvasFromHeight(
  heightBuf: Float32Array,
  size: number,
  strength: number,
): HTMLCanvasElement {
  const [cNrm, ctxNrm] = makeCanvas(size);
  const imgNrm = ctxNrm.createImageData(size, size);

  const sampleH = (x: number, y: number) => {
    const wx = ((x % size) + size) % size;
    const wy = ((y % size) + size) % size;
    return heightBuf[wy * size + wx];
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = sampleH(x - 1, y - 1);
      const t = sampleH(x, y - 1);
      const tr = sampleH(x + 1, y - 1);
      const l = sampleH(x - 1, y);
      const r = sampleH(x + 1, y);
      const bl = sampleH(x - 1, y + 1);
      const b = sampleH(x, y + 1);
      const br = sampleH(x + 1, y + 1);

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;

      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const invLen = 1.0 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * size + x) * 4;
      imgNrm.data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      imgNrm.data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      imgNrm.data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      imgNrm.data[idx + 3] = 255;
    }
  }

  ctxNrm.putImageData(imgNrm, 0, 0);
  return cNrm;
}

function finalizePBRSet(
  cCol: HTMLCanvasElement,
  cRgh: HTMLCanvasElement,
  cBmp: HTMLCanvasElement,
  heightBuf: Float32Array,
  size: number,
  normalStrength: number,
  maxAniso: number,
  repeatX = 1,
  repeatY = 1,
): ProceduralPBRSet {
  const cNrm = buildNormalCanvasFromHeight(heightBuf, size, normalStrength);
  return {
    map: configureTexture(cCol, true, maxAniso, repeatX, repeatY),
    roughnessMap: configureTexture(cRgh, false, maxAniso, repeatX, repeatY),
    bumpMap: configureTexture(cBmp, false, maxAniso, repeatX, repeatY),
    normalMap: configureTexture(cNrm, false, maxAniso, repeatX, repeatY),
  };
}

function generateWoodSet(
  size: number,
  maxAniso: number,
  baseR: number,
  baseG: number,
  baseB: number,
  seed: number,
): ProceduralPBRSet {
  const [cCol, ctxCol] = makeCanvas(size);
  const [cRgh, ctxRgh] = makeCanvas(size);
  const [cBmp, ctxBmp] = makeCanvas(size);

  const imgCol = ctxCol.createImageData(size, size);
  const imgRgh = ctxRgh.createImageData(size, size);
  const imgBmp = ctxBmp.createImageData(size, size);
  const heightBuf = new Float32Array(size * size);

  const knots = [
    { x: size * 0.28, y: size * 0.4, r: size * 0.085 },
    { x: size * 0.76, y: size * 0.72, r: size * 0.065 },
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;

      let warp = fbm(nx * 5, ny * 18, seed, 4) * 0.35;
      for (const k of knots) {
        const dx = x - k.x;
        const dy = (y - k.y) * 0.45;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < k.r * 2.5) {
          warp += Math.exp((-d * d) / (k.r * k.r)) * 1.4;
        }
      }

      const ringVal = Math.sin((nx * 14 + warp * 4.5) * Math.PI * 2) * 0.5 + 0.5;
      const fineFiber = fbm(nx * 48, ny * 8, seed + 5, 3);
      const plankSeam = Math.abs(((ny * 4) % 1) - 0.5) > 0.485 ? 0.35 : 1.0;

      const shade = (0.76 + ringVal * 0.26 + (fineFiber - 0.5) * 0.14) * plankSeam;
      imgCol.data[idx] = Math.min(255, Math.max(0, Math.round(baseR * shade)));
      imgCol.data[idx + 1] = Math.min(255, Math.max(0, Math.round(baseG * shade)));
      imgCol.data[idx + 2] = Math.min(255, Math.max(0, Math.round(baseB * shade)));
      imgCol.data[idx + 3] = 255;

      const rVal = Math.round((0.46 + (1 - ringVal) * 0.18 + (1 - plankSeam) * 0.2) * 255);
      imgRgh.data[idx] = imgRgh.data[idx + 1] = imgRgh.data[idx + 2] = Math.min(255, rVal);
      imgRgh.data[idx + 3] = 255;

      const hVal = Math.min(1, Math.max(0, (0.45 + ringVal * 0.35 + (fineFiber - 0.5) * 0.2) * plankSeam));
      heightBuf[y * size + x] = hVal;
      const bVal = Math.round(hVal * 255);
      imgBmp.data[idx] = imgBmp.data[idx + 1] = imgBmp.data[idx + 2] = bVal;
      imgBmp.data[idx + 3] = 255;
    }
  }

  ctxCol.putImageData(imgCol, 0, 0);
  ctxRgh.putImageData(imgRgh, 0, 0);
  ctxBmp.putImageData(imgBmp, 0, 0);

  return finalizePBRSet(cCol, cRgh, cBmp, heightBuf, size, 2.2, maxAniso);
}

function generateBarkSet(size: number, maxAniso: number): ProceduralPBRSet {
  const [cCol, ctxCol] = makeCanvas(size);
  const [cRgh, ctxRgh] = makeCanvas(size);
  const [cBmp, ctxBmp] = makeCanvas(size);

  const imgCol = ctxCol.createImageData(size, size);
  const imgRgh = ctxRgh.createImageData(size, size);
  const imgBmp = ctxBmp.createImageData(size, size);
  const heightBuf = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;

      const ridge = Math.abs(fbm(nx * 14, ny * 4, 241, 4, 14) - 0.5) * 2.0;
      const plates = fbm(nx * 24, ny * 9, 263, 3, 24);
      const lichen = fbm(nx * 8, ny * 8, 281, 3, 8);
      const mossMix = Math.max(0, lichen - 0.62) * 2.2;

      const hVal = Math.min(1, Math.max(0, ridge * 0.65 + plates * 0.35));
      heightBuf[y * size + x] = hVal;

      const shade = 0.45 + hVal * 0.62;
      const r = 92 * shade * (1 - mossMix) + 68 * mossMix;
      const g = 66 * shade * (1 - mossMix) + 92 * mossMix;
      const b = 46 * shade * (1 - mossMix) + 46 * mossMix;

      imgCol.data[idx] = Math.min(255, Math.round(r));
      imgCol.data[idx + 1] = Math.min(255, Math.round(g));
      imgCol.data[idx + 2] = Math.min(255, Math.round(b));
      imgCol.data[idx + 3] = 255;

      const rVal = Math.round((0.84 + (1 - hVal) * 0.14) * 255);
      imgRgh.data[idx] = imgRgh.data[idx + 1] = imgRgh.data[idx + 2] = Math.min(255, rVal);
      imgRgh.data[idx + 3] = 255;

      const bVal = Math.round(hVal * 255);
      imgBmp.data[idx] = imgBmp.data[idx + 1] = imgBmp.data[idx + 2] = bVal;
      imgBmp.data[idx + 3] = 255;
    }
  }

  ctxCol.putImageData(imgCol, 0, 0);
  ctxRgh.putImageData(imgRgh, 0, 0);
  ctxBmp.putImageData(imgBmp, 0, 0);

  return finalizePBRSet(cCol, cRgh, cBmp, heightBuf, size, 3.4, maxAniso, 1, 2);
}

function generatePineNeedlesSet(size: number, maxAniso: number): ProceduralPBRSet {
  const [cCol, ctxCol] = makeCanvas(size);
  const [cRgh, ctxRgh] = makeCanvas(size);
  const [cBmp, ctxBmp] = makeCanvas(size);

  const imgCol = ctxCol.createImageData(size, size);
  const imgRgh = ctxRgh.createImageData(size, size);
  const imgBmp = ctxBmp.createImageData(size, size);
  const heightBuf = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;

      const cluster = fbm(nx * 10, ny * 10, 311, 4, 10);
      const needles = fbm(nx * 44, ny * 22, 331, 3, 44);
      const streak = Math.sin((nx * 36 + needles * 2.2) * Math.PI * 2) * 0.5 + 0.5;
      const hVal = Math.min(1, Math.max(0, cluster * 0.45 + needles * 0.35 + streak * 0.2));
      heightBuf[y * size + x] = hVal;

      const tip = Math.max(0, hVal - 0.55) * 1.1;
      imgCol.data[idx] = Math.min(255, Math.round(28 + cluster * 24 + tip * 32));
      imgCol.data[idx + 1] = Math.min(255, Math.round(58 + cluster * 38 + tip * 42));
      imgCol.data[idx + 2] = Math.min(255, Math.round(24 + cluster * 18 + tip * 14));
      imgCol.data[idx + 3] = 255;

      const rVal = Math.round((0.76 + (1 - hVal) * 0.18) * 255);
      imgRgh.data[idx] = imgRgh.data[idx + 1] = imgRgh.data[idx + 2] = Math.min(255, rVal);
      imgRgh.data[idx + 3] = 255;

      const bVal = Math.round(hVal * 255);
      imgBmp.data[idx] = imgBmp.data[idx + 1] = imgBmp.data[idx + 2] = bVal;
      imgBmp.data[idx + 3] = 255;
    }
  }

  ctxCol.putImageData(imgCol, 0, 0);
  ctxRgh.putImageData(imgRgh, 0, 0);
  ctxBmp.putImageData(imgBmp, 0, 0);

  return finalizePBRSet(cCol, cRgh, cBmp, heightBuf, size, 2.8, maxAniso, 2, 2);
}

function generateStoneSet(size: number, maxAniso: number): ProceduralPBRSet {
  const [cCol, ctxCol] = makeCanvas(size);
  const [cRgh, ctxRgh] = makeCanvas(size);
  const [cBmp, ctxBmp] = makeCanvas(size);

  const imgCol = ctxCol.createImageData(size, size);
  const imgRgh = ctxRgh.createImageData(size, size);
  const imgBmp = ctxBmp.createImageData(size, size);
  const heightBuf = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;

      const macro = fbm(nx * 6, ny * 6, 11, 4);
      const grit = fbm(nx * 36, ny * 36, 47, 3);
      const pores = hash2d(x, y, 91) > 0.965 ? 0.62 : 1.0;

      const crackNoise = Math.abs(fbm(nx * 10, ny * 10, 77, 3) - 0.5);
      const crack = crackNoise < 0.018 ? 0.58 : 1.0;

      const edgeX = Math.min(nx, 1 - nx);
      const edgeY = Math.min(ny, 1 - ny);
      const bevel = Math.min(edgeX, edgeY) < 0.03 ? 0.72 : 1.0;

      const lum = (0.58 + macro * 0.24 + (grit - 0.5) * 0.16) * pores * crack * bevel;
      const base = Math.round(176 * lum);
      imgCol.data[idx] = Math.min(255, base + 5);
      imgCol.data[idx + 1] = Math.min(255, base + 4);
      imgCol.data[idx + 2] = Math.min(255, base + 7);
      imgCol.data[idx + 3] = 255;

      const rVal = Math.round((0.74 + (1 - macro) * 0.2 + (1 - pores) * 0.15) * 255);
      imgRgh.data[idx] = imgRgh.data[idx + 1] = imgRgh.data[idx + 2] = Math.min(255, rVal);
      imgRgh.data[idx + 3] = 255;

      const hVal = Math.min(1, Math.max(0, (0.35 + grit * 0.45 + macro * 0.2) * pores * crack * bevel));
      heightBuf[y * size + x] = hVal;
      const bVal = Math.round(hVal * 255);
      imgBmp.data[idx] = imgBmp.data[idx + 1] = imgBmp.data[idx + 2] = bVal;
      imgBmp.data[idx + 3] = 255;
    }
  }

  ctxCol.putImageData(imgCol, 0, 0);
  ctxRgh.putImageData(imgRgh, 0, 0);
  ctxBmp.putImageData(imgBmp, 0, 0);

  return finalizePBRSet(cCol, cRgh, cBmp, heightBuf, size, 2.8, maxAniso);
}

function generateGlassSet(size: number, maxAniso: number): ProceduralPBRSet {
  const [cCol, ctxCol] = makeCanvas(size);
  const [cRgh, ctxRgh] = makeCanvas(size);
  const [cBmp, ctxBmp] = makeCanvas(size);

  const imgCol = ctxCol.createImageData(size, size);
  const imgRgh = ctxRgh.createImageData(size, size);
  const imgBmp = ctxBmp.createImageData(size, size);
  const heightBuf = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;

      const frost = fbm(nx * 14, ny * 14, 123, 3);
      const streak = Math.abs(Math.sin((nx + ny * 0.7) * 28 + frost * 2.5)) > 0.96 ? 1 : 0;
      const edgeDist = Math.min(nx, 1 - nx, ny, 1 - ny);
      const edgeFrost = edgeDist < 0.08 ? (0.08 - edgeDist) * 6 : 0;

      imgCol.data[idx] = Math.min(255, Math.round(218 + frost * 28 + edgeFrost * 22));
      imgCol.data[idx + 1] = Math.min(255, Math.round(244 + frost * 11));
      imgCol.data[idx + 2] = 255;
      imgCol.data[idx + 3] = 255;

      const rVal = Math.round((0.04 + frost * 0.09 + streak * 0.14 + edgeFrost * 0.18) * 255);
      imgRgh.data[idx] = imgRgh.data[idx + 1] = imgRgh.data[idx + 2] = Math.min(255, rVal);
      imgRgh.data[idx + 3] = 255;

      const hVal = Math.min(1, Math.max(0, 0.5 + (frost - 0.5) * 0.25 + streak * 0.2));
      heightBuf[y * size + x] = hVal;
      const bVal = Math.round(hVal * 255);
      imgBmp.data[idx] = imgBmp.data[idx + 1] = imgBmp.data[idx + 2] = bVal;
      imgBmp.data[idx + 3] = 255;
    }
  }

  ctxCol.putImageData(imgCol, 0, 0);
  ctxRgh.putImageData(imgRgh, 0, 0);
  ctxBmp.putImageData(imgBmp, 0, 0);

  return finalizePBRSet(cCol, cRgh, cBmp, heightBuf, size, 1.0, maxAniso);
}

function generateGrassSet(size: number, maxAniso: number): ProceduralPBRSet {
  const [cCol, ctxCol] = makeCanvas(size);
  const [cRgh, ctxRgh] = makeCanvas(size);
  const [cBmp, ctxBmp] = makeCanvas(size);

  const imgCol = ctxCol.createImageData(size, size);
  const imgRgh = ctxRgh.createImageData(size, size);
  const imgBmp = ctxBmp.createImageData(size, size);
  const heightBuf = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;

      const patch = fbm(nx * 4, ny * 4, 31, 4, 4);
      const blade = fbm(nx * 36, ny * 36, 67, 3, 36);
      const clover = fbm(nx * 14, ny * 14, 199, 3, 14);
      const soilMix = Math.max(0, 0.36 - patch) * 1.45;
      const dryTip = Math.max(0, clover - 0.62) * 1.3;

      const r = (48 + blade * 28 + dryTip * 52) * (1 - soilMix) + 88 * soilMix;
      const g = (88 + patch * 38 + blade * 22 + dryTip * 20) * (1 - soilMix) + 70 * soilMix;
      const b = (30 + blade * 12) * (1 - soilMix) + 42 * soilMix;

      imgCol.data[idx] = Math.min(255, Math.round(r));
      imgCol.data[idx + 1] = Math.min(255, Math.round(g));
      imgCol.data[idx + 2] = Math.min(255, Math.round(b));
      imgCol.data[idx + 3] = 255;

      const rVal = Math.round((0.82 + (1 - blade) * 0.14) * 255);
      imgRgh.data[idx] = imgRgh.data[idx + 1] = imgRgh.data[idx + 2] = Math.min(255, rVal);
      imgRgh.data[idx + 3] = 255;

      const hVal = Math.min(1, Math.max(0, 0.3 + blade * 0.55 + clover * 0.15));
      heightBuf[y * size + x] = hVal;
      const bVal = Math.round(hVal * 255);
      imgBmp.data[idx] = imgBmp.data[idx + 1] = imgBmp.data[idx + 2] = bVal;
      imgBmp.data[idx + 3] = 255;
    }
  }

  ctxCol.putImageData(imgCol, 0, 0);
  ctxRgh.putImageData(imgRgh, 0, 0);
  ctxBmp.putImageData(imgBmp, 0, 0);

  return finalizePBRSet(cCol, cRgh, cBmp, heightBuf, size, 2.5, maxAniso, 18, 18);
}

function generateDirtSet(size: number, maxAniso: number): ProceduralPBRSet {
  const [cCol, ctxCol] = makeCanvas(size);
  const [cRgh, ctxRgh] = makeCanvas(size);
  const [cBmp, ctxBmp] = makeCanvas(size);

  const imgCol = ctxCol.createImageData(size, size);
  const imgRgh = ctxRgh.createImageData(size, size);
  const imgBmp = ctxBmp.createImageData(size, size);
  const heightBuf = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;

      const earth = fbm(nx * 6, ny * 6, 103, 4, 6);
      const grit = fbm(nx * 28, ny * 28, 151, 3, 28);
      // Subtle wheel rut compaction along Z edges of path
      const rut = Math.exp(-Math.pow((ny - 0.25) * 6, 2)) + Math.exp(-Math.pow((ny - 0.75) * 6, 2));
      const pebbleNoise = smoothNoise(nx * 44, ny * 44, 179, 44);
      const pebble = pebbleNoise > 0.78 ? 1.2 : 1.0;
      const shade = (0.74 + earth * 0.28 + (grit - 0.5) * 0.18 - rut * 0.08) * pebble;

      imgCol.data[idx] = Math.min(255, Math.round(134 * shade));
      imgCol.data[idx + 1] = Math.min(255, Math.round(104 * shade));
      imgCol.data[idx + 2] = Math.min(255, Math.round(72 * shade));
      imgCol.data[idx + 3] = 255;

      const rVal = Math.round((0.84 + (1 - grit) * 0.14 - rut * 0.06) * 255);
      imgRgh.data[idx] = imgRgh.data[idx + 1] = imgRgh.data[idx + 2] = Math.min(255, rVal);
      imgRgh.data[idx + 3] = 255;

      const hVal = Math.min(1, Math.max(0, 0.35 + grit * 0.42 + (pebble > 1 ? 0.24 : 0) - rut * 0.1));
      heightBuf[y * size + x] = hVal;
      const bVal = Math.round(hVal * 255);
      imgBmp.data[idx] = imgBmp.data[idx + 1] = imgBmp.data[idx + 2] = bVal;
      imgBmp.data[idx + 3] = 255;
    }
  }

  ctxCol.putImageData(imgCol, 0, 0);
  ctxRgh.putImageData(imgRgh, 0, 0);
  ctxBmp.putImageData(imgBmp, 0, 0);

  return finalizePBRSet(cCol, cRgh, cBmp, heightBuf, size, 2.7, maxAniso, 8, 2);
}

function generateLeatherSet(size: number, maxAniso: number): ProceduralPBRSet {
  const [cCol, ctxCol] = makeCanvas(size);
  const [cRgh, ctxRgh] = makeCanvas(size);
  const [cBmp, ctxBmp] = makeCanvas(size);

  const imgCol = ctxCol.createImageData(size, size);
  const imgRgh = ctxRgh.createImageData(size, size);
  const imgBmp = ctxBmp.createImageData(size, size);
  const heightBuf = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;

      const grain = fbm(nx * 28, ny * 28, 211, 3);
      const wear = fbm(nx * 6, ny * 6, 223, 3);
      const shade = 0.65 + grain * 0.25 + wear * 0.22;

      imgCol.data[idx] = Math.min(255, Math.round(92 * shade));
      imgCol.data[idx + 1] = Math.min(255, Math.round(54 * shade));
      imgCol.data[idx + 2] = Math.min(255, Math.round(34 * shade));
      imgCol.data[idx + 3] = 255;

      const rVal = Math.round((0.66 + (1 - wear) * 0.22) * 255);
      imgRgh.data[idx] = imgRgh.data[idx + 1] = imgRgh.data[idx + 2] = Math.min(255, rVal);
      imgRgh.data[idx + 3] = 255;

      const hVal = Math.min(1, Math.max(0, 0.4 + grain * 0.5));
      heightBuf[y * size + x] = hVal;
      const bVal = Math.round(hVal * 255);
      imgBmp.data[idx] = imgBmp.data[idx + 1] = imgBmp.data[idx + 2] = bVal;
      imgBmp.data[idx + 3] = 255;
    }
  }

  ctxCol.putImageData(imgCol, 0, 0);
  ctxRgh.putImageData(imgRgh, 0, 0);
  ctxBmp.putImageData(imgBmp, 0, 0);

  return finalizePBRSet(cCol, cRgh, cBmp, heightBuf, size, 2.0, maxAniso);
}

function generateContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const [canvas, ctx] = makeCanvas(size);
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.48,
  );
  grad.addColorStop(0, 'rgba(10, 10, 8, 0.72)');
  grad.addColorStop(0.55, 'rgba(10, 10, 8, 0.28)');
  grad.addColorStop(1, 'rgba(10, 10, 8, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createTextureLibrary(renderer: THREE.WebGLRenderer): TextureLibrary {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
  const wood = generateWoodSet(256, maxAniso, 198, 142, 82, 17);
  const slingshotWood = generateWoodSet(256, maxAniso, 118, 66, 34, 53);
  const stone = generateStoneSet(256, maxAniso);
  const glass = generateGlassSet(256, maxAniso);
  const grass = generateGrassSet(256, maxAniso);
  const dirt = generateDirtSet(256, maxAniso);
  const leather = generateLeatherSet(128, maxAniso);
  const bark = generateBarkSet(256, maxAniso);
  const pineNeedles = generatePineNeedlesSet(256, maxAniso);
  const contactShadow = generateContactShadowTexture();

  const allSets = [wood, slingshotWood, stone, glass, grass, dirt, leather, bark, pineNeedles];

  return {
    wood,
    stone,
    glass,
    grass,
    dirt,
    slingshotWood,
    leather,
    bark,
    pineNeedles,
    contactShadow,
    dispose: () => {
      for (const s of allSets) {
        s.map.dispose();
        s.roughnessMap.dispose();
        s.bumpMap.dispose();
        s.normalMap.dispose();
      }
      contactShadow.dispose();
    },
  };
}

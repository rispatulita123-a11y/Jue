import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import type {
  BirdType,
  CameraMode,
  FreeCamGesture,
  GameHudSnapshot,
  GamePhase,
} from './types';
import { computeStars, LEVELS, SLINGSHOT_ORIGIN } from './levels';
import {
  BIRD_PHYSICS_PROPS,
  createBirdBody,
  createBlockBody,
  createPhysicsWorld,
  createPigBody,
  isWorldSettled,
  predictTrajectory,
  stepPhysicsWorld,
  triggerBirdAbility,
  wakeAllNearby,
  type PhysicsWorld,
  type RigidBody,
} from './physics';
import { createTextureLibrary, type TextureLibrary } from './textures';
import {
  buildEnvironment,
  createBirdModel,
  createBlockMaterials,
  createDetailedBlockVisual,
  createPigModel,
  createSlingshotModel,
  type BirdVisual,
  type BlockMaterialSet,
  type DamageUniforms,
  type SlingshotRig,
} from './models';
import { AmbientAtmosphere, VfxManager } from './vfx';
import type { ActiveBlockObstacle } from './debris';
import { ProceduralAudioEngine } from './audio';

interface BodyVisualEntry {
  body: RigidBody;
  mesh: THREE.Object3D;
  birdVisual?: BirdVisual;
  shadowDisc?: THREE.Mesh;
  damageUniforms?: DamageUniforms;
  materials: THREE.MeshStandardMaterial[];
  baseEmissives: THREE.Color[];
  dispose: () => void;
}

const SLINGSHOT_REST = new THREE.Vector3(SLINGSHOT_ORIGIN.x, SLINGSHOT_ORIGIN.y, SLINGSHOT_ORIGIN.z);
const MAX_PULL_DIST = 3.5;
const LAUNCH_MULTIPLIER = 9.6;

interface LevelAtmospherePreset {
  sunDir: THREE.Vector3;
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  rimColor: number;
  rimIntensity: number;
  fogColor: number;
  moteTint: number;
  skyTurbidity: number;
  skyRayleigh: number;
  vignetteStrength: number;
  menuCamPos: [number, number, number];
  menuLookAt: [number, number, number];
}

const LEVEL_ATMOSPHERES: LevelAtmospherePreset[] = [
  {
    // Level 1: Atalaya del Valle — Warm Alpine Golden Hour
    sunDir: new THREE.Vector3(0.62, 0.27, 0.73).normalize(),
    sunColor: 0xffca86,
    sunIntensity: 2.65,
    hemiSky: 0x86bcf0,
    hemiGround: 0x4d492b,
    hemiIntensity: 0.72,
    rimColor: 0x9ec8f8,
    rimIntensity: 0.45,
    fogColor: 0xd9ad7f,
    moteTint: 0xffe29c,
    skyTurbidity: 2.6,
    skyRayleigh: 1.95,
    vignetteStrength: 0.28,
    menuCamPos: [-21.4, 3.65, -4.4],
    menuLookAt: [14.0, 2.85, 1.8],
  },
  {
    // Level 2: Puente de Cristal — Crisp Alpenglow Twilight & Crystal Highlights
    sunDir: new THREE.Vector3(0.46, 0.34, -0.82).normalize(),
    sunColor: 0xffdeb3,
    sunIntensity: 2.55,
    hemiSky: 0x77b7f5,
    hemiGround: 0x3b4e40,
    hemiIntensity: 0.74,
    rimColor: 0xffcfa3,
    rimIntensity: 0.5,
    fogColor: 0xbfd0e3,
    moteTint: 0xdbeeff,
    skyTurbidity: 2.2,
    skyRayleigh: 1.75,
    vignetteStrength: 0.3,
    menuCamPos: [-21.0, 4.45, -4.6],
    menuLookAt: [14.0, 2.65, 1.6],
  },
  {
    // Level 3: Ciudadela de Granito — Dramatic Amber Siege Dusk
    sunDir: new THREE.Vector3(0.75, 0.21, 0.63).normalize(),
    sunColor: 0xff9f58,
    sunIntensity: 2.75,
    hemiSky: 0x6b8eb8,
    hemiGround: 0x3c2c22,
    hemiIntensity: 0.68,
    rimColor: 0x88b0df,
    rimIntensity: 0.46,
    fogColor: 0xc98356,
    moteTint: 0xffb66b,
    skyTurbidity: 4.1,
    skyRayleigh: 2.45,
    vignetteStrength: 0.36,
    menuCamPos: [-21.6, 3.15, -4.1],
    menuLookAt: [14.5, 3.15, 1.7],
  },
];

const CinematicLensShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignetteStrength: { value: 0.28 },
    aberration: { value: 0.0011 },
    uShockwave: { value: new THREE.Vector4(0.5, 0.5, 0, 0) },
    uAspect: { value: 1.6 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float vignetteStrength;
    uniform float aberration;
    uniform vec4 uShockwave;
    uniform float uAspect;
    varying vec2 vUv;
    void main() {
      vec2 sc = (vUv - uShockwave.xy) * vec2(max(0.25, uAspect), 1.0);
      float scDist = length(sc);
      float ringDiff = scDist - uShockwave.z;
      float waveBand = exp(-ringDiff * ringDiff * 640.0) * (1.0 - smoothstep(0.0, 0.14, abs(ringDiff)));
      vec2 waveDir = scDist > 0.0001 ? sc / scDist : vec2(0.0);
      vec2 refractShift = waveDir * vec2(1.0 / max(0.25, uAspect), 1.0) * waveBand * uShockwave.w;
      vec2 baseUv = clamp(vUv - refractShift, vec2(0.001), vec2(0.999));

      vec2 offset = baseUv - 0.5;
      float dist2 = dot(offset, offset);
      vec2 shift = offset * dist2 * aberration * 2.5 + waveDir * waveBand * uShockwave.w * 0.32;
      float r = texture2D(tDiffuse, clamp(baseUv + shift, vec2(0.001), vec2(0.999))).r;
      float g = texture2D(tDiffuse, baseUv).g;
      float b = texture2D(tDiffuse, clamp(baseUv - shift, vec2(0.001), vec2(0.999))).b;
      vec3 col = vec3(r, g, b);
      float vig = 1.0 - dist2 * vignetteStrength * 1.45;
      col *= clamp(vig, 0.55, 1.0);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class GameEngine {
  private container: HTMLElement;
  private onHudChange: (snapshot: GameHudSnapshot) => void;
  private isSoftwareGl: boolean;

  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private lensPass: ShaderPass | null = null;
  private depthTarget: THREE.WebGLRenderTarget | null = null;
  private depthOverrideMat: THREE.MeshBasicMaterial | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private orbitControls: OrbitControls;

  private sky!: Sky;
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private rimLight!: THREE.DirectionalLight;

  private textures: TextureLibrary;
  private blockMaterials: BlockMaterialSet;
  private slingshot: SlingshotRig;
  private vfx: VfxManager;
  private ambientAtmos: AmbientAtmosphere;
  public audio: ProceduralAudioEngine;
  private envCleanup: { clouds: THREE.Group[]; dispose: () => void };

  private trajectoryDots: THREE.InstancedMesh;
  private trajectoryDotGeo: THREE.BufferGeometry;
  private trajectoryDotMat: THREE.MeshBasicMaterial;

  private waitingBirdGroup = new THREE.Group();
  private levelGroup = new THREE.Group();
  private visuals = new Map<string, BodyVisualEntry>();

  private world: PhysicsWorld = createPhysicsWorld(-19.5);
  private phase: GamePhase = 'title';
  private cameraMode: CameraMode = 'aim';
  private freeCamGesture: FreeCamGesture = 'orbit';
  private levelIndex = 0;
  private score = 0;
  private bestScores: number[] = LEVELS.map(() => 0);
  private birdQueue: BirdType[] = [];
  private activeBirdBody: RigidBody | null = null;
  private abilityUsed = false;
  private unusedBirdBonus = 0;
  private pressedKeys = new Set<string>();

  // Slingshot drag state
  private isPulling = false;
  private dragStartClient = { x: 0, y: 0 };
  private pullOffset = new THREE.Vector3(0, 0, 0);
  private launchVelocity = new THREE.Vector3(0, 0, 0);

  // Turn & Juice timers
  private flightTimer = 0;
  private settleTimer = 0;
  private turnEndDelay = 0;
  private pendingTurnAdvance = false;
  private hitstopTimer = 0;
  private cameraTrauma = 0;
  private titleOrbitAngle = 0;
  private lastHudEmitMs = 0;
  private pointerParallax = new THREE.Vector2(0, 0);
  private pointerParallaxTarget = new THREE.Vector2(0, 0);

  // Smooth atmosphere transition scratch
  private _sunDirCurrent = new THREE.Vector3(0.62, 0.27, 0.73).normalize();
  private _sunColorTarget = new THREE.Color(0xffca86);
  private _hemiSkyTarget = new THREE.Color(0x86bcf0);
  private _hemiGroundTarget = new THREE.Color(0x4d492b);
  private _rimColorTarget = new THREE.Color(0x9ec8f8);
  private _fogColorTarget = new THREE.Color(0xd9ad7f);
  private _moteColorCurrent = new THREE.Color(0xffe29c);
  private _moteColorTarget = new THREE.Color(0xffe29c);

  // Camera smoothing
  private camPosCurrent = new THREE.Vector3(-21.4, 3.65, -4.4);
  private camLookCurrent = new THREE.Vector3(14.0, 2.85, 1.8);
  private camPosTarget = new THREE.Vector3(-21.4, 3.65, -4.4);
  private camLookTarget = new THREE.Vector3(14.0, 2.85, 1.8);

  // Scratch objects (zero GC in render loop)
  private _dummy = new THREE.Object3D();
  private _vecA = new THREE.Vector3();
  private _vecB = new THREE.Vector3();
  private _vecC = new THREE.Vector3();
  private _vecD = new THREE.Vector3();
  private _quat = new THREE.Quaternion();
  private _invQuat = new THREE.Quaternion();
  private _obstacles: ActiveBlockObstacle[] = [];
  private _lastTime = performance.now();
  private frameId = 0;
  private disposed = false;

  constructor(
    container: HTMLElement,
    onHudChange: (snapshot: GameHudSnapshot) => void,
    autostart = false,
  ) {
    this.container = container;
    this.onHudChange = onHudChange;
    this.audio = new ProceduralAudioEngine();

    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2') || probe.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    document.documentElement.dataset.gpu = this.isSoftwareGl ? 'false' : 'true';

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      preserveDrawingBuffer: this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.AgXToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const horizonColor = new THREE.Color(LEVEL_ATMOSPHERES[0].fogColor);
    this.scene.background = horizonColor;
    this.scene.fog = new THREE.Fog(LEVEL_ATMOSPHERES[0].fogColor, 34, 155);

    this.camera = new THREE.PerspectiveCamera(46, width / height, 0.25, 260);
    this.camera.position.copy(this.camPosCurrent);
    this.camera.lookAt(this.camLookCurrent);

    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enabled = false;
    this.orbitControls.enableDamping = !this.isSoftwareGl;
    this.orbitControls.dampingFactor = 0.085;
    this.orbitControls.screenSpacePanning = false;
    this.orbitControls.panSpeed = 1.25;
    this.orbitControls.rotateSpeed = 0.85;
    this.orbitControls.zoomSpeed = 1.1;
    this.orbitControls.maxPolarAngle = Math.PI * 0.485;
    this.orbitControls.minDistance = 4.5;
    this.orbitControls.maxDistance = 58;
    this.orbitControls.target.set(13, 3, 0);
    this.applyFreeCamTouchMapping();

    // Golden-hour outdoor IBL environment
    const initialPreset = LEVEL_ATMOSPHERES[0];
    const envScene = this.createOutdoorEnvScene(initialPreset.sunDir);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    this.scene.environmentIntensity = 0.64;
    pmrem.dispose();
    envScene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).geometry.dispose();
        const m = (obj as THREE.Mesh).material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });

    this.setupAtmosphereAndLights(initialPreset);

    this.textures = createTextureLibrary(this.renderer);
    this.blockMaterials = createBlockMaterials(this.textures, this.isSoftwareGl);
    this.envCleanup = buildEnvironment(this.scene, this.textures, this.isSoftwareGl);

    this.slingshot = createSlingshotModel(SLINGSHOT_ORIGIN, this.textures);
    this.scene.add(this.slingshot.group);
    this.scene.add(this.waitingBirdGroup);
    this.scene.add(this.levelGroup);

    this.vfx = new VfxManager(this.scene, this.textures, this.isSoftwareGl);
    this.ambientAtmos = new AmbientAtmosphere(this.scene);

    // 3D Parabolic Trajectory Dots (InstancedMesh)
    this.trajectoryDotGeo = new THREE.SphereGeometry(0.14, 10, 8);
    this.trajectoryDotMat = new THREE.MeshBasicMaterial({
      color: 0xfff8dc,
      transparent: true,
      opacity: 0.9,
    });
    this.trajectoryDots = new THREE.InstancedMesh(
      this.trajectoryDotGeo,
      this.trajectoryDotMat,
      26,
    );
    this.trajectoryDots.frustumCulled = false;
    this.trajectoryDots.visible = false;
    this.scene.add(this.trajectoryDots);

    // Post-processing (EffectComposer + Selective HDR Bloom + AgX Output + Lens Finish + Depth Pre-Pass) on hardware GPUs
    if (!this.isSoftwareGl) {
      const depthTex = new THREE.DepthTexture(
        Math.max(1, Math.floor(width * 0.5)),
        Math.max(1, Math.floor(height * 0.5)),
      );
      depthTex.minFilter = THREE.NearestFilter;
      depthTex.magFilter = THREE.NearestFilter;
      depthTex.generateMipmaps = false;
      this.depthTarget = new THREE.WebGLRenderTarget(
        Math.max(1, Math.floor(width * 0.5)),
        Math.max(1, Math.floor(height * 0.5)),
        {
          depthBuffer: true,
          depthTexture: depthTex,
        },
      );
      this.depthOverrideMat = new THREE.MeshBasicMaterial({ colorWrite: false });

      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.15,
        0.28,
        2.15,
      );
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
      this.lensPass = new ShaderPass(CinematicLensShader);
      this.lensPass.uniforms['uAspect'].value = width / Math.max(1, height);
      this.composer.addPass(this.lensPass);
    }

    this.loadLevel(0, autostart ? 'playing' : 'title');

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.emitHud(true);
    this._lastTime = performance.now();
    this.tick();
  }

  private createOutdoorEnvScene(sunDir: THREE.Vector3): THREE.Scene {
    const env = new THREE.Scene();
    const skyHem = new THREE.Mesh(
      new THREE.SphereGeometry(20, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45),
      new THREE.MeshBasicMaterial({ color: 0x5c96d6, side: THREE.BackSide }),
    );
    env.add(skyHem);

    // Warm golden sunset horizon band for PBR rim & glass reflections
    const horizonBand = new THREE.Mesh(
      new THREE.CylinderGeometry(19.5, 19.5, 5.2, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffb96e, side: THREE.BackSide }),
    );
    horizonBand.position.y = 0.8;
    env.add(horizonBand);

    const groundHem = new THREE.Mesh(
      new THREE.SphereGeometry(20, 24, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
      new THREE.MeshBasicMaterial({ color: 0x3b4428, side: THREE.BackSide }),
    );
    env.add(groundHem);

    const sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd896 }),
    );
    sunDisc.position.copy(sunDir).multiplyScalar(16);
    env.add(sunDisc);

    return env;
  }

  private setupAtmosphereAndLights(preset: LevelAtmospherePreset): void {
    this.sky = new Sky();
    this.sky.scale.setScalar(450);
    const skyUniforms = this.sky.material.uniforms;
    skyUniforms['turbidity'].value = preset.skyTurbidity;
    skyUniforms['rayleigh'].value = preset.skyRayleigh;
    skyUniforms['mieCoefficient'].value = 0.0022;
    skyUniforms['mieDirectionalG'].value = 0.78;
    if (skyUniforms['showSunDisc']) {
      skyUniforms['showSunDisc'].value = 0.0;
    }
    this._sunDirCurrent.copy(preset.sunDir);
    skyUniforms['sunPosition'].value.copy(preset.sunDir);
    this.scene.add(this.sky);

    // Low golden-hour directional sun key light casting long sculptural shadows
    this.sunLight = new THREE.DirectionalLight(preset.sunColor, preset.sunIntensity);
    this.sunLight.position.copy(preset.sunDir).multiplyScalar(55);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.radius = 2.8;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 115;
    this.sunLight.shadow.camera.left = -36;
    this.sunLight.shadow.camera.right = 36;
    this.sunLight.shadow.camera.top = 22;
    this.sunLight.shadow.camera.bottom = -14;
    this.sunLight.shadow.bias = -0.0003;
    this.sunLight.shadow.normalBias = 0.018;
    this.scene.add(this.sunLight);

    // Sky azure / warm olive earth hemisphere fill light
    this.hemiLight = new THREE.HemisphereLight(
      preset.hemiSky,
      preset.hemiGround,
      preset.hemiIntensity,
    );
    this.scene.add(this.hemiLight);

    // Soft cool sky bounce fill on camera-facing shadowed surfaces
    this.rimLight = new THREE.DirectionalLight(preset.rimColor, preset.rimIntensity);
    this.rimLight.position.set(-24, 16, -22);
    this.scene.add(this.rimLight);
  }

  private updateAtmosphereSmooth(dt: number): void {
    const preset = LEVEL_ATMOSPHERES[this.levelIndex] ?? LEVEL_ATMOSPHERES[0];
    const alpha = 1 - Math.exp(-3.4 * dt);

    // During gameplay keep sun slightly higher for high-contrast block readability
    const playBoostY = this.phase === 'playing' ? 0.24 : 0;
    this._vecD.set(preset.sunDir.x, preset.sunDir.y + playBoostY, preset.sunDir.z).normalize();
    this._sunDirCurrent.lerp(this._vecD, alpha).normalize();

    this.sunLight.position.copy(this._sunDirCurrent).multiplyScalar(55);
    this._sunColorTarget.setHex(preset.sunColor);
    this.sunLight.color.lerp(this._sunColorTarget, alpha);
    this.sunLight.intensity = THREE.MathUtils.lerp(
      this.sunLight.intensity,
      preset.sunIntensity,
      alpha,
    );

    this._hemiSkyTarget.setHex(preset.hemiSky);
    this._hemiGroundTarget.setHex(preset.hemiGround);
    this.hemiLight.color.lerp(this._hemiSkyTarget, alpha);
    this.hemiLight.groundColor.lerp(this._hemiGroundTarget, alpha);
    this.hemiLight.intensity = THREE.MathUtils.lerp(
      this.hemiLight.intensity,
      preset.hemiIntensity,
      alpha,
    );

    this._rimColorTarget.setHex(preset.rimColor);
    this.rimLight.color.lerp(this._rimColorTarget, alpha);
    this.rimLight.intensity = THREE.MathUtils.lerp(
      this.rimLight.intensity,
      preset.rimIntensity,
      alpha,
    );

    const skyUniforms = this.sky.material.uniforms;
    skyUniforms['sunPosition'].value.copy(this._sunDirCurrent);
    skyUniforms['turbidity'].value = THREE.MathUtils.lerp(
      skyUniforms['turbidity'].value,
      preset.skyTurbidity,
      alpha,
    );
    skyUniforms['rayleigh'].value = THREE.MathUtils.lerp(
      skyUniforms['rayleigh'].value,
      preset.skyRayleigh,
      alpha,
    );

    this._fogColorTarget.setHex(preset.fogColor);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.lerp(this._fogColorTarget, alpha);
      const targetNear = this.phase === 'title' ? 34 : 54;
      const targetFar = this.phase === 'title' ? 152 : 192;
      this.scene.fog.near = THREE.MathUtils.lerp(this.scene.fog.near, targetNear, alpha);
      this.scene.fog.far = THREE.MathUtils.lerp(this.scene.fog.far, targetFar, alpha);
    }
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.lerp(this._fogColorTarget, alpha);
    }

    this._moteColorTarget.setHex(preset.moteTint);
    this._moteColorCurrent.lerp(this._moteColorTarget, alpha);

    if (this.lensPass) {
      this.lensPass.uniforms['vignetteStrength'].value = THREE.MathUtils.lerp(
        this.lensPass.uniforms['vignetteStrength'].value,
        this.phase === 'title' ? preset.vignetteStrength : 0.18,
        alpha,
      );
    }
  }

  private clearLevelVisuals(): void {
    for (const entry of this.visuals.values()) {
      this.levelGroup.remove(entry.mesh);
      if (entry.shadowDisc) this.levelGroup.remove(entry.shadowDisc);
      entry.dispose();
    }
    this.visuals.clear();
    this.vfx.reset();

    while (this.waitingBirdGroup.children.length > 0) {
      const ch = this.waitingBirdGroup.children[0];
      this.waitingBirdGroup.remove(ch);
    }
  }

  public loadLevel(index: number, nextPhase: GamePhase = 'playing'): void {
    this.clearLevelVisuals();
    this.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
    const lvl = LEVELS[this.levelIndex];

    this.world = createPhysicsWorld(-19.5);
    this.score = 0;
    this.unusedBirdBonus = 0;
    this.birdQueue = [...lvl.birds];
    this.activeBirdBody = null;
    this.abilityUsed = false;
    this.isPulling = false;
    this.pullOffset.set(0, 0, 0);
    this.trajectoryDots.visible = false;
    this.pendingTurnAdvance = false;
    this.flightTimer = 0;
    this.settleTimer = 0;
    this.turnEndDelay = 0;
    this.cameraMode = 'aim';
    this.orbitControls.enabled = false;
    this.phase = nextPhase;
    document.body.dataset.state =
      nextPhase === 'victory' || nextPhase === 'defeat' ? 'gameover' : nextPhase;

    // Create fortress blocks
    lvl.blocks.forEach((b, idx) => {
      const id = `blk-${idx}`;
      const body = createBlockBody(id, b.x, b.y, b.z, b.w, b.h, b.d, b.material, b.ry ?? 0);
      this.world.bodies.push(body);

      const detailed = createDetailedBlockVisual(
        b.w,
        b.h,
        b.d,
        b.material,
        this.blockMaterials,
        this.isSoftwareGl,
      );
      detailed.group.position.set(b.x, b.y, b.z);
      detailed.group.quaternion.set(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w,
      );
      this.levelGroup.add(detailed.group);

      const shadowDisc =
        b.y - b.h * 0.5 < 1.25
          ? this.createShadowDisc(Math.max(b.w, b.d) * 1.48)
          : undefined;
      if (shadowDisc) {
        shadowDisc.position.set(b.x, 0.02, b.z);
        this.levelGroup.add(shadowDisc);
      }

      this.visuals.set(id, {
        body,
        mesh: detailed.group,
        shadowDisc,
        damageUniforms: detailed.damageUniforms,
        materials: [detailed.primaryMat],
        baseEmissives: [detailed.primaryMat.emissive.clone()],
        dispose: () => {
          detailed.geometries.forEach((g) => g.dispose());
          detailed.primaryMat.dispose();
          if (shadowDisc) {
            shadowDisc.geometry.dispose();
            (shadowDisc.material as THREE.Material).dispose();
          }
        },
      });
    });

    // Create pigs
    lvl.pigs.forEach((p, idx) => {
      const id = `pig-${idx}`;
      const body = createPigBody(id, p.x, p.y, p.z, p.radius, p.variant);
      this.world.bodies.push(body);

      const pigGroup = createPigModel(p.radius, p.variant);
      pigGroup.position.set(p.x, p.y, p.z);
      this.levelGroup.add(pigGroup);

      const mats: THREE.MeshStandardMaterial[] = [];
      const baseEms: THREE.Color[] = [];
      pigGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = (obj as THREE.Mesh).material;
          if (m instanceof THREE.MeshStandardMaterial) {
            mats.push(m);
            baseEms.push(m.emissive.clone());
          }
        }
      });

      const shadowDisc = this.createShadowDisc(p.radius * 2.1);
      shadowDisc.position.set(p.x, 0.025, p.z);
      this.levelGroup.add(shadowDisc);

      this.visuals.set(id, {
        body,
        mesh: pigGroup,
        shadowDisc,
        materials: mats,
        baseEmissives: baseEms,
        dispose: () => {
          pigGroup.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
              (obj as THREE.Mesh).geometry.dispose();
            }
          });
          mats.forEach((m) => m.dispose());
          shadowDisc.geometry.dispose();
          (shadowDisc.material as THREE.Material).dispose();
        },
      });
    });

    this.loadNextBirdInSlingshot();
    this.snapCameraForCurrentMode();
    this.emitHud(true);
  }

  private createShadowDisc(diameter: number): THREE.Mesh {
    const geo = new THREE.CircleGeometry(diameter * 0.5, 16);
    geo.rotateX(-Math.PI * 0.5);
    const mat = new THREE.MeshBasicMaterial({
      map: this.textures.contactShadow,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    return new THREE.Mesh(geo, mat);
  }

  private loadNextBirdInSlingshot(): void {
    // Rebuild waiting bird queue visuals
    while (this.waitingBirdGroup.children.length > 0) {
      this.waitingBirdGroup.remove(this.waitingBirdGroup.children[0]);
    }

    if (this.birdQueue.length === 0) {
      this.activeBirdBody = null;
      this.slingshot.updateBands(SLINGSHOT_REST, new THREE.Vector3(1, 0, 0));
      return;
    }

    const nextType = this.birdQueue[0];
    const props = BIRD_PHYSICS_PROPS[nextType];
    const id = `bird-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const body = createBirdBody(id, nextType, SLINGSHOT_REST.x, SLINGSHOT_REST.y, SLINGSHOT_REST.z);
    body.launched = false;
    this.world.bodies.push(body);
    this.activeBirdBody = body;
    this.abilityUsed = false;

    const birdVisual = createBirdModel(nextType, props.radius, this.isSoftwareGl);
    birdVisual.group.position.copy(SLINGSHOT_REST);
    this.levelGroup.add(birdVisual.group);

    const mats: THREE.MeshStandardMaterial[] = [];
    const baseEms: THREE.Color[] = [];
    birdVisual.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = (obj as THREE.Mesh).material;
        if (m instanceof THREE.MeshStandardMaterial) {
          mats.push(m);
          baseEms.push(m.emissive.clone());
        }
      }
    });

    const shadowDisc = this.createShadowDisc(props.radius * 2.2);
    shadowDisc.position.set(SLINGSHOT_REST.x, 0.025, SLINGSHOT_REST.z);
    this.levelGroup.add(shadowDisc);

    this.visuals.set(id, {
      body,
      mesh: birdVisual.group,
      birdVisual,
      shadowDisc,
      materials: mats,
      baseEmissives: baseEms,
      dispose: () => {
        birdVisual.group.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            (obj as THREE.Mesh).geometry.dispose();
          }
        });
        mats.forEach((m) => m.dispose());
        shadowDisc.geometry.dispose();
        (shadowDisc.material as THREE.Material).dispose();
      },
    });

    this.slingshot.updateBands(SLINGSHOT_REST, new THREE.Vector3(1, 0, 0));

    // Render remaining birds waiting beside the slingshot
    for (let i = 1; i < this.birdQueue.length; i++) {
      const qType = this.birdQueue[i];
      const qRadius = BIRD_PHYSICS_PROPS[qType].radius * 0.92;
      const qVis = createBirdModel(qType, qRadius, true);
      qVis.group.position.set(SLINGSHOT_ORIGIN.x - 1.6 - i * 1.35, qRadius + 0.04, 1.8 + (i % 2) * 0.7);
      qVis.group.rotation.y = 0.25;
      this.waitingBirdGroup.add(qVis.group);
    }
  }

  public startGame(levelIdx?: number): void {
    this.audio.unlock();
    if (typeof levelIdx === 'number' && levelIdx !== this.levelIndex) {
      this.loadLevel(levelIdx, 'playing');
    } else {
      this.phase = 'playing';
      document.body.dataset.state = 'playing';
      this.cameraMode = 'aim';
      this.orbitControls.enabled = false;
      this.snapCameraForCurrentMode();
      this.emitHud(true);
    }
    this.renderFrame();
  }

  public setPhase(next: GamePhase): void {
    this.phase = next;
    document.body.dataset.state =
      next === 'victory' || next === 'defeat' ? 'gameover' : next;
    if (next === 'paused') {
      this.isPulling = false;
      this.trajectoryDots.visible = false;
    }
    this.emitHud(true);
  }

  public togglePause(): void {
    if (this.phase === 'playing') {
      this.setPhase('paused');
    } else if (this.phase === 'paused') {
      this.setPhase('playing');
    }
  }

  public toggleMute(): void {
    this.audio.setMuted(!this.audio.muted);
    this.emitHud(true);
  }

  private applyFreeCamTouchMapping(): void {
    if (this.freeCamGesture === 'pan') {
      this.orbitControls.touches = {
        ONE: THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.DOLLY_ROTATE,
      };
      this.orbitControls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      };
    } else {
      this.orbitControls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      };
      this.orbitControls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
    }
  }

  public setFreeCamGesture(gesture: FreeCamGesture): void {
    this.freeCamGesture = gesture;
    this.applyFreeCamTouchMapping();
    this.emitHud(true);
  }

  public resetFreeCamView(): void {
    if (this.cameraMode !== 'inspect') return;
    const fc = LEVELS[this.levelIndex].fortressCenter;
    this.orbitControls.target.set(fc.x - 4, fc.y, fc.z);
    this.camera.position.set(fc.x - 16, fc.y + 9.5, fc.z + 20);
    this.orbitControls.update();
  }

  public toggleCameraMode(): void {
    if (this.phase !== 'playing') return;

    if (this.cameraMode !== 'inspect') {
      this.isPulling = false;
      this.trajectoryDots.visible = false;
      this.cameraMode = 'inspect';
      this.orbitControls.enabled = true;
      this.applyFreeCamTouchMapping();
      const fc = LEVELS[this.levelIndex].fortressCenter;
      this.orbitControls.target.set(fc.x - 3, fc.y, fc.z);
      this.camera.position.set(fc.x - 15, fc.y + 9.0, fc.z + 19.5);
      this.orbitControls.update();
    } else {
      this.cameraMode = this.activeBirdBody?.launched ? 'follow' : 'aim';
      this.orbitControls.enabled = false;
    }
    this.emitHud(true);
  }

  public restartLevel(): void {
    this.audio.unlock();
    this.loadLevel(this.levelIndex, 'playing');
  }

  public nextLevel(): void {
    this.audio.unlock();
    const nextIdx = (this.levelIndex + 1) % LEVELS.length;
    this.loadLevel(nextIdx, 'playing');
  }

  private computeTitleCameraTargets(posOut: THREE.Vector3, lookOut: THREE.Vector3): void {
    const preset = LEVEL_ATMOSPHERES[this.levelIndex] ?? LEVEL_ATMOSPHERES[0];
    const aspect = this.camera.aspect || 1.6;
    const desktopMix = THREE.MathUtils.clamp((aspect - 0.65) / 0.6, 0, 1);

    // Mobile portrait: frame entire slingshot + perched bird + fortress in mid-band without edge cropping
    const mobPosX = -24.8;
    const mobPosY = 4.95;
    const mobPosZ = -0.15;
    const mobLookX = 3.0;
    const mobLookY = 2.55;
    const mobLookZ = -0.45;

    posOut.set(
      THREE.MathUtils.lerp(mobPosX, preset.menuCamPos[0], desktopMix),
      THREE.MathUtils.lerp(mobPosY, preset.menuCamPos[1], desktopMix),
      THREE.MathUtils.lerp(mobPosZ, preset.menuCamPos[2], desktopMix),
    );
    lookOut.set(
      THREE.MathUtils.lerp(mobLookX, preset.menuLookAt[0], desktopMix),
      THREE.MathUtils.lerp(mobLookY, preset.menuLookAt[1], desktopMix),
      THREE.MathUtils.lerp(mobLookZ, preset.menuLookAt[2], desktopMix),
    );
  }

  private snapCameraForCurrentMode(): void {
    if (this.phase === 'title') {
      this.computeTitleCameraTargets(this.camPosTarget, this.camLookTarget);
      // Only snap instantaneously on initial boot (when switching levels in menu, glide smoothly!)
      if (this.camPosCurrent.distanceToSquared(this.camPosTarget) > 36) {
        this.camPosCurrent.copy(this.camPosTarget);
        this.camLookCurrent.copy(this.camLookTarget);
        this.camera.position.copy(this.camPosCurrent);
        this.camera.lookAt(this.camLookCurrent);
      }
    } else {
      this.camPosTarget.set(SLINGSHOT_ORIGIN.x - 11.2, 6.2, 14.5);
      this.camLookTarget.set(-0.8, 3.1, 0);
      this.camPosCurrent.copy(this.camPosTarget);
      this.camLookCurrent.copy(this.camLookTarget);
      this.camera.position.copy(this.camPosCurrent);
      this.camera.lookAt(this.camLookCurrent);
    }
  }

  // --- Input Handling ---

  private onPointerDown = (e: PointerEvent): void => {
    if (this.phase !== 'playing') return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.audio.unlock();

    // If bird is in flight (and not orbiting in free-cam), trigger ability!
    if (this.cameraMode !== 'inspect' && this.activeBirdBody && this.activeBirdBody.launched) {
      this.activateCurrentBirdAbility();
      return;
    }

    if (this.cameraMode !== 'aim' || !this.activeBirdBody) return;

    this.isPulling = true;
    this.dragStartClient = { x: e.clientX, y: e.clientY };
    this.pullOffset.set(-1.1, -0.35, 0);
    this.updatePullState();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isPulling || this.phase !== 'playing' || !this.activeBirdBody) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const dx = (e.clientX - this.dragStartClient.x) / Math.max(220, rect.width * 0.28);
    const dy = (e.clientY - this.dragStartClient.y) / Math.max(200, rect.height * 0.34);

    // Dragging down-left pulls directly along the slingshot-to-fortress line with zero lateral drift
    const pullBack = THREE.MathUtils.clamp((-dx * 2.2 + dy * 1.2) + 1.05, 0.45, MAX_PULL_DIST);
    const pullY = THREE.MathUtils.clamp(-dy * 2.4 - 0.35, -2.3, 1.2);
    const rawZ = dx * 0.55 + dy * 0.5;
    const pullZ = Math.abs(rawZ) < 0.14 ? 0 : THREE.MathUtils.clamp(rawZ, -1.6, 1.6);

    this.pullOffset.set(-pullBack, pullY, pullZ);
    if (this.pullOffset.length() > MAX_PULL_DIST) {
      this.pullOffset.setLength(MAX_PULL_DIST);
    }

    this.updatePullState();
    this.audio.playStretch(this.pullOffset.length() / MAX_PULL_DIST);
  };

  private onPointerUp = (): void => {
    if (!this.isPulling) return;
    this.isPulling = false;
    this.trajectoryDots.visible = false;

    if (this.phase === 'playing' && this.activeBirdBody && !this.activeBirdBody.launched) {
      if (this.pullOffset.length() > 0.55) {
        this.launchActiveBird();
      } else {
        // Cancel shot cleanly
        this.pullOffset.set(0, 0, 0);
        this.activeBirdBody.position.x = SLINGSHOT_REST.x;
        this.activeBirdBody.position.y = SLINGSHOT_REST.y;
        this.activeBirdBody.position.z = SLINGSHOT_REST.z;
        this.slingshot.updateBands(SLINGSHOT_REST, new THREE.Vector3(1, 0, 0));
        this.emitHud(true);
      }
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    this.pressedKeys.add(e.code);
    if (e.code === 'KeyM') {
      this.toggleMute();
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.phase === 'playing' || this.phase === 'paused') {
        this.togglePause();
      }
      return;
    }
    if (this.phase !== 'playing') return;

    if (e.code === 'KeyR') {
      this.restartLevel();
      return;
    }
    if (e.code === 'KeyC') {
      this.toggleCameraMode();
      return;
    }
    if (e.code === 'Space') {
      if (this.activeBirdBody && this.activeBirdBody.launched) {
        e.preventDefault();
        this.activateCurrentBirdAbility();
      }
    }
    // Optional keyboard lateral aim nudge while pulling
    if (this.isPulling && (e.code === 'ArrowLeft' || e.code === 'KeyA')) {
      this.pullOffset.z = Math.min(1.8, this.pullOffset.z + 0.16);
      this.updatePullState();
    } else if (this.isPulling && (e.code === 'ArrowRight' || e.code === 'KeyD')) {
      this.pullOffset.z = Math.max(-1.8, this.pullOffset.z - 0.16);
      this.updatePullState();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.pressedKeys.delete(e.code);
  };

  private onWindowBlur = (): void => {
    this.pressedKeys.clear();
    if (this.isPulling) {
      this.isPulling = false;
      this.trajectoryDots.visible = false;
      this.emitHud(true);
    }
  };

  private onResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.phase === 'title') {
      this.computeTitleCameraTargets(this.camPosTarget, this.camLookTarget);
      this.camPosCurrent.copy(this.camPosTarget);
      this.camLookCurrent.copy(this.camLookTarget);
      this.camera.position.copy(this.camPosCurrent);
      this.camera.lookAt(this.camLookCurrent);
    }
    this.renderer.setSize(width, height);
    if (this.depthTarget) {
      this.depthTarget.setSize(
        Math.max(1, Math.floor(width * 0.5)),
        Math.max(1, Math.floor(height * 0.5)),
      );
    }
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }
    if (this.lensPass) {
      this.lensPass.uniforms['uAspect'].value = width / Math.max(1, height);
    }
    this.renderFrame();
  };

  private onWindowPointerMove = (e: PointerEvent): void => {
    if (this.phase === 'title') {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      this.pointerParallaxTarget.set(
        THREE.MathUtils.clamp((e.clientX / w - 0.5) * 2, -1, 1),
        THREE.MathUtils.clamp((e.clientY / h - 0.5) * 2, -1, 1),
      );
    }
    this.onPointerMove(e);
  };

  private onDeviceOrientation = (e: DeviceOrientationEvent): void => {
    if (this.phase !== 'title') return;
    if (typeof e.gamma === 'number' && typeof e.beta === 'number') {
      this.pointerParallaxTarget.set(
        THREE.MathUtils.clamp(e.gamma / 28, -1, 1),
        THREE.MathUtils.clamp((e.beta - 35) / 28, -1, 1),
      );
    }
  };

  private bindEvents(): void {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onWindowPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('deviceorientation', this.onDeviceOrientation, { passive: true });
  }

  private unbindEvents(): void {
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onWindowPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('deviceorientation', this.onDeviceOrientation);
  }

  private updatePullState(): void {
    if (!this.activeBirdBody) return;
    const birdPos = this._vecA.copy(SLINGSHOT_REST).add(this.pullOffset);
    this.activeBirdBody.position.x = birdPos.x;
    this.activeBirdBody.position.y = birdPos.y;
    this.activeBirdBody.position.z = birdPos.z;

    this.launchVelocity.copy(this.pullOffset).multiplyScalar(-LAUNCH_MULTIPLIER);
    const dir = this._vecB.copy(this.launchVelocity).normalize();
    this.slingshot.updateBands(birdPos, dir);

    // Update 3D parabolic trajectory dots
    const pts = predictTrajectory(
      { x: birdPos.x, y: birdPos.y, z: birdPos.z },
      { x: this.launchVelocity.x, y: this.launchVelocity.y, z: this.launchVelocity.z },
      this.world.gravity,
      26,
      0.075,
    );
    this.trajectoryDots.visible = pts.length > 0;
    for (let i = 0; i < 26; i++) {
      if (i < pts.length) {
        const s = 1 - (i / 26) * 0.55;
        this._dummy.position.set(pts[i].x, pts[i].y, pts[i].z);
        this._dummy.scale.setScalar(s);
      } else {
        this._dummy.position.set(0, -999, 0);
        this._dummy.scale.setScalar(0);
      }
      this._dummy.updateMatrix();
      this.trajectoryDots.setMatrixAt(i, this._dummy.matrix);
    }
    this.trajectoryDots.instanceMatrix.needsUpdate = true;
    this.emitHud(false);
  }

  private launchActiveBird(): void {
    if (!this.activeBirdBody) return;
    const b = this.activeBirdBody;
    b.launched = true;
    b.isSleeping = false;
    b.velocity.x = this.launchVelocity.x;
    b.velocity.y = this.launchVelocity.y;
    b.velocity.z = this.launchVelocity.z;

    // Wake nearby fortress blocks proactively on launch
    const fc = LEVELS[this.levelIndex].fortressCenter;
    wakeAllNearby(this.world, fc, 14);

    this.birdQueue.shift();
    this.flightTimer = 0;
    this.settleTimer = 0;
    this.cameraMode = 'follow';
    this.orbitControls.enabled = false;
    this.slingshot.updateBands(SLINGSHOT_REST, new THREE.Vector3(1, 0, 0));
    this.audio.playLaunch(b.birdType ?? 'red');
    this.vfx.spawnFeathers(b.birdType ?? 'red', b.position.x, b.position.y, b.position.z, 6);
    this.emitHud(true);
  }

  public activateCurrentBirdAbility(): void {
    if (!this.activeBirdBody || !this.activeBirdBody.launched || this.abilityUsed) return;
    if (!this.activeBirdBody.alive) return;

    this.abilityUsed = true;
    const b = this.activeBirdBody;
    const birdType = b.birdType ?? 'red';
    this.audio.playAbility(birdType);

    const camDist = this.camera.position.distanceTo(
      this._vecA.set(b.position.x, b.position.y, b.position.z),
    );
    const events = triggerBirdAbility(this.world, b);
    if (birdType === 'black') {
      this.hitstopTimer = 0.055;
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.95);
      this.vfx.spawnExplosion(b.position.x, b.position.y, b.position.z, true, camDist);
    } else if (birdType === 'red') {
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.48);
      this.vfx.spawnExplosion(b.position.x, b.position.y, b.position.z, false, camDist);
    } else if (birdType === 'yellow') {
      this.vfx.spawnSupersonicBoost(
        b.position.x,
        b.position.y,
        b.position.z,
        b.velocity.x,
        b.velocity.y,
        b.velocity.z,
      );
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.32);
    }

    this.processCollisionEvents(events);
    this.emitHud(true);
  }

  private processCollisionEvents(events: ReturnType<typeof stepPhysicsWorld>): void {
    let scoreChanged = false;
    for (const ev of events) {
      if (ev.scoreDelta > 0) {
        this.score += ev.scoreDelta;
        scoreChanged = true;
      }

      if (ev.type === 'pig_pop') {
        this.audio.playPigPop();
        this.vfx.spawnMaterialImpact('pig', ev.position.x, ev.position.y, ev.position.z, true);
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.32);
        this.hitstopTimer = Math.max(this.hitstopTimer, 0.035);
      } else if (ev.type === 'destroy') {
        this.audio.playImpact(ev.material, ev.intensity, true);
        this.cameraTrauma = Math.min(1, this.cameraTrauma + ev.intensity * 0.28);
      } else if (ev.type === 'impact' && ev.isGroundContact) {
        this.vfx.spawnGroundContactDust(
          ev.material === 'wood' || ev.material === 'stone' || ev.material === 'glass'
            ? ev.material
            : 'ground',
          ev.position.x,
          ev.position.y,
          ev.position.z,
          Math.min(1, ev.intensity),
        );
        if (ev.intensity > 0.38) {
          this.audio.playImpact(ev.material, ev.intensity * 0.7, false);
        }
      } else if (ev.type === 'impact' && ev.intensity > 0.28) {
        this.audio.playImpact(ev.material, ev.intensity, false);
        this.vfx.spawnMaterialImpact(
          ev.material,
          ev.position.x,
          ev.position.y,
          ev.position.z,
          false,
          ev.impactDir,
        );
        if (ev.intensity > 0.6) {
          this.cameraTrauma = Math.min(1, this.cameraTrauma + ev.intensity * 0.16);
        }
      }
    }

    // Remove dead visual entries and spawn directional Voronoi fracture debris
    for (const [id, entry] of this.visuals.entries()) {
      if (!entry.body.alive) {
        if (entry.body.kind === 'bird' && entry.body.birdType) {
          this.vfx.spawnFeathers(
            entry.body.birdType,
            entry.body.position.x,
            entry.body.position.y,
            entry.body.position.z,
            10,
          );
        } else if (entry.body.kind === 'block' && entry.body.material) {
          this.vfx.spawnBlockFracture(
            entry.body.material,
            entry.body.position,
            entry.body.halfExtents,
            entry.body.quaternion,
            entry.body.velocity,
            entry.body.lastImpactPoint,
            entry.body.lastImpactDir,
            entry.body.lastImpactSpeed,
          );
        }
        this.levelGroup.remove(entry.mesh);
        if (entry.shadowDisc) this.levelGroup.remove(entry.shadowDisc);
        entry.dispose();
        this.visuals.delete(id);
      }
    }

    if (scoreChanged) {
      this.emitHud(false);
    }
  }

  private updateTurnLifecycle(dt: number): void {
    if (this.phase !== 'playing') return;

    const pigsAlive = this.world.bodies.filter((b) => b.kind === 'pig' && b.alive).length;
    if (pigsAlive === 0 && !this.pendingTurnAdvance) {
      this.pendingTurnAdvance = true;
      this.turnEndDelay = 0.75;
    }

    if (this.pendingTurnAdvance) {
      this.turnEndDelay -= dt;
      if (this.turnEndDelay <= 0) {
        this.pendingTurnAdvance = false;
        if (pigsAlive === 0) {
          this.unusedBirdBonus = this.birdQueue.length * 10000;
          this.score += this.unusedBirdBonus;
          if (this.score > this.bestScores[this.levelIndex]) {
            this.bestScores[this.levelIndex] = this.score;
          }
          this.audio.playVictory();
          this.setPhase('victory');
        } else if (this.birdQueue.length > 0) {
          this.cameraMode = 'aim';
          this.orbitControls.enabled = false;
          this.loadNextBirdInSlingshot();
          this.emitHud(true);
        } else {
          this.audio.playDefeat();
          this.setPhase('defeat');
        }
      }
      return;
    }

    if (this.activeBirdBody && this.activeBirdBody.launched) {
      this.flightTimer += dt;
      if (isWorldSettled(this.world) || this.flightTimer > 5.8) {
        this.settleTimer += dt;
        if (this.settleTimer > 0.55 || this.flightTimer > 6.5) {
          this.pendingTurnAdvance = true;
          this.turnEndDelay = 0.25;
        }
      } else {
        this.settleTimer = 0;
      }
    }
  }

  private syncVisualsAndShadows(dt: number, elapsed: number): void {
    for (const entry of this.visuals.values()) {
      const b = entry.body;
      entry.mesh.position.set(b.position.x, b.position.y, b.position.z);
      entry.mesh.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);

      // Update bird idle 3/4 hero turn + breathing in menu, wing flutter in flight & bomb fuse glow
      if (entry.birdVisual) {
        if (this.phase === 'title' && b === this.activeBirdBody && !b.launched) {
          entry.mesh.position.y = b.position.y + Math.sin(elapsed * 2.4) * 0.032;
          entry.mesh.rotation.y = 0.95 + Math.sin(elapsed * 0.85) * 0.14;
          entry.mesh.rotation.z = Math.sin(elapsed * 1.4) * 0.04;
          const idleFlap = Math.sin(elapsed * 2.4) * 0.06;
          entry.birdVisual.wingLeft.rotation.x = idleFlap;
          entry.birdVisual.wingRight.rotation.x = -idleFlap;
        } else {
          const speed = Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z);
          if (b.launched && speed > 2) {
            const flap = Math.sin(elapsed * 22) * 0.45;
            entry.birdVisual.wingLeft.rotation.x = flap;
            entry.birdVisual.wingRight.rotation.x = -flap;
          }
        }
        if (entry.birdVisual.fuseTip) {
          const pulse = 3.2 + Math.sin(elapsed * 26) * 1.1;
          const m = entry.birdVisual.fuseTip.material as THREE.MeshStandardMaterial;
          m.emissiveIntensity = pulse;
        }
      }

      // Hit flash & structural stress weathering feedback
      if (b.hitFlashTimer > 0) {
        b.hitFlashTimer = Math.max(0, b.hitFlashTimer - dt);
        for (const m of entry.materials) {
          m.emissive.setHex(0xffffff);
          m.emissiveIntensity = 0.55;
        }
      } else {
        for (let i = 0; i < entry.materials.length; i++) {
          entry.materials[i].emissive.copy(entry.baseEmissives[i]);
          entry.materials[i].emissiveIntensity = 1.0;
        }
      }

      if (b.kind === 'block' && b.maxHp > 0) {
        const hpRatio = Math.max(0, Math.min(1, b.hp / b.maxHp));
        if (b.material !== 'glass' && entry.materials[0]) {
          const wearShade = 0.72 + 0.28 * hpRatio;
          entry.materials[0].color.setRGB(wearShade, wearShade, wearShade);
        }
        if (entry.damageUniforms) {
          entry.damageUniforms.uDamage.value = 1 - hpRatio;
          if (b.lastImpactPoint) {
            this._invQuat
              .set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w)
              .invert();
            this._vecA
              .set(
                b.lastImpactPoint.x - b.position.x,
                b.lastImpactPoint.y - b.position.y,
                b.lastImpactPoint.z - b.position.z,
              )
              .applyQuaternion(this._invQuat);
            entry.damageUniforms.uImpactLocal.value.copy(this._vecA);
          }
        }
      }

      // Ground contact shadow disc
      if (entry.shadowDisc) {
        entry.shadowDisc.position.set(b.position.x, 0.024, b.position.z);
        const halfH = b.kind === 'block' ? b.halfExtents.y : b.radius;
        const h = Math.max(0, b.position.y - halfH);
        const fade = Math.max(0.06, 1 - h / 6.5);
        const mat = entry.shadowDisc.material as THREE.MeshBasicMaterial;
        mat.opacity = (b.kind === 'block' ? 0.36 : 0.48) * fade;
        const sc = 1 + h * 0.14;
        entry.shadowDisc.scale.set(sc, 1, sc);
      }
    }
  }

  private updateCamera(dt: number): void {
    const fc = LEVELS[this.levelIndex].fortressCenter;

    if (this.phase === 'title') {
      this.titleOrbitAngle += dt * 0.24;
      const pAlpha = 1 - Math.exp(-4.5 * dt);
      this.pointerParallax.lerp(this.pointerParallaxTarget, pAlpha);

      this.computeTitleCameraTargets(this._vecC, this._vecD);
      const swayX = Math.sin(this.titleOrbitAngle) * 0.55;
      const swayY = Math.sin(this.titleOrbitAngle * 0.72) * 0.18;
      const swayZ = Math.cos(this.titleOrbitAngle * 0.85) * 0.65;

      this.camPosTarget.set(
        this._vecC.x + swayX - this.pointerParallax.x * 0.35,
        this._vecC.y + swayY - this.pointerParallax.y * 0.32,
        this._vecC.z + swayZ + this.pointerParallax.x * 0.78,
      );
      this.camLookTarget.set(
        this._vecD.x,
        this._vecD.y - this.pointerParallax.y * 0.25,
        this._vecD.z + this.pointerParallax.x * 0.55,
      );
    } else if (this.cameraMode === 'inspect') {
      // Smooth WASD / Arrow camera pan in Free Camera mode
      const panSpeed = 22 * dt;
      this._vecA.set(0, 0, 0);
      this.camera.getWorldDirection(this._vecB);
      this._vecB.y = 0;
      if (this._vecB.lengthSq() > 0.0001) this._vecB.normalize();
      const right = this._dummy.position.crossVectors(this._vecB, this.camera.up).normalize();

      if (this.pressedKeys.has('KeyW') || this.pressedKeys.has('ArrowUp')) {
        this._vecA.addScaledVector(this._vecB, panSpeed);
      }
      if (this.pressedKeys.has('KeyS') || this.pressedKeys.has('ArrowDown')) {
        this._vecA.addScaledVector(this._vecB, -panSpeed);
      }
      if (this.pressedKeys.has('KeyD') || this.pressedKeys.has('ArrowRight')) {
        this._vecA.addScaledVector(right, panSpeed);
      }
      if (this.pressedKeys.has('KeyA') || this.pressedKeys.has('ArrowLeft')) {
        this._vecA.addScaledVector(right, -panSpeed);
      }
      if (this._vecA.lengthSq() > 0) {
        this.camera.position.add(this._vecA);
        this.orbitControls.target.add(this._vecA);
      }

      this.orbitControls.update();
      // Keep free camera anchored safely above valley terrain
      this.orbitControls.target.x = THREE.MathUtils.clamp(this.orbitControls.target.x, -32, 34);
      this.orbitControls.target.y = THREE.MathUtils.clamp(this.orbitControls.target.y, 0.8, 16);
      this.orbitControls.target.z = THREE.MathUtils.clamp(this.orbitControls.target.z, -26, 26);
      if (this.camera.position.y < 1.2) this.camera.position.y = 1.2;
      return;
    } else if (this.cameraMode === 'follow' && this.activeBirdBody && this.activeBirdBody.launched) {
      const bx = this.activeBirdBody.position.x;
      const by = this.activeBirdBody.position.y;
      const bz = this.activeBirdBody.position.z;
      const lookX = THREE.MathUtils.clamp(bx + 6, -4, fc.x + 2);
      this.camPosTarget.set(
        THREE.MathUtils.clamp(bx - 10, -22, fc.x - 6),
        Math.max(4.8, by + 3.8),
        THREE.MathUtils.clamp(bz + 12.5, 9.5, 17),
      );
      this.camLookTarget.set(lookX, Math.max(2.0, by * 0.65 + 1.2), bz * 0.4);
    } else {
      // Aim mode: hero slingshot in lower-left foreground, fortress in right-center
      const pullRatio = this.isPulling ? this.pullOffset.length() / MAX_PULL_DIST : 0;
      this.camPosTarget.set(
        SLINGSHOT_ORIGIN.x - 11.2 - pullRatio * 1.1,
        6.2 + pullRatio * 0.45,
        14.5 + this.pullOffset.z * 0.4,
      );
      this.camLookTarget.set(-0.8, 3.1 - this.pullOffset.y * 0.35, -this.pullOffset.z * 1.4);
    }

    const alpha = 1 - Math.exp(-6.5 * dt);
    this.camPosCurrent.lerp(this.camPosTarget, alpha);
    this.camLookCurrent.lerp(this.camLookTarget, alpha);

    this.camera.position.copy(this.camPosCurrent);
    if (this.cameraTrauma > 0) {
      const shake = this.cameraTrauma * this.cameraTrauma * 0.55;
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake;
      this.camera.position.z += (Math.random() - 0.5) * shake;
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.9);
    }
    this.camera.lookAt(this.camLookCurrent);
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this._lastTime) / 1000;
    this._lastTime = now;
    const maxDt = this.isSoftwareGl ? 0.085 : 0.05;
    const dt = Math.min(Math.max(rawDt, 0.001), maxDt);
    const elapsed = now * 0.001;

    // Drift horizon clouds gently
    for (let i = 0; i < this.envCleanup.clouds.length; i++) {
      const c = this.envCleanup.clouds[i];
      c.position.x += dt * (0.45 + (i % 3) * 0.15);
      if (c.position.x > 85) c.position.x = -85;
    }

    if (this.phase === 'playing') {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      } else {
        if (dt > 0.045) {
          const half = dt * 0.5;
          const ev1 = stepPhysicsWorld(this.world, half);
          if (ev1.length > 0) this.processCollisionEvents(ev1);
          const ev2 = stepPhysicsWorld(this.world, half);
          if (ev2.length > 0) this.processCollisionEvents(ev2);
        } else {
          const events = stepPhysicsWorld(this.world, dt);
          if (events.length > 0) {
            this.processCollisionEvents(events);
          }
        }
        this.updateTurnLifecycle(dt);
      }
    }

    this.updateAtmosphereSmooth(dt);
    this.syncVisualsAndShadows(dt, elapsed);
    let obsCount = 0;
    for (const entry of this.visuals.values()) {
      const b = entry.body;
      if (b.alive && b.kind === 'block') {
        if (obsCount < this._obstacles.length) {
          const ob = this._obstacles[obsCount];
          ob.position = b.position;
          ob.halfExtents = b.halfExtents;
        } else {
          this._obstacles.push({ position: b.position, halfExtents: b.halfExtents });
        }
        obsCount++;
      }
    }
    this._obstacles.length = obsCount;
    this.vfx.update(dt, elapsed, this.camera, this._obstacles);
    const acousticPulse = this.vfx.consumeDelayedCameraPulse();
    if (acousticPulse > 0) {
      this.cameraTrauma = Math.min(1, this.cameraTrauma + acousticPulse);
    }

    const viewW = this.container.clientWidth || window.innerWidth;
    const viewH = this.container.clientHeight || window.innerHeight;
    this.vfx.setEnvironmentContext(
      this._sunDirCurrent,
      this.depthTarget ? this.depthTarget.depthTexture : null,
      this.camera.near,
      this.camera.far,
      viewW,
      viewH,
    );
    this.renderer.toneMappingExposure = Math.max(0.72, 1.06 + this.vfx.getExposureOffset());
    if (this.lensPass) {
      this.lensPass.uniforms['uAspect'].value = viewW / Math.max(1, viewH);
      this.vfx.getActiveShockwaveScreenData(
        this.camera,
        this.lensPass.uniforms['uShockwave'].value as THREE.Vector4,
      );
    }

    this.ambientAtmos.update(elapsed, this._moteColorCurrent.getHex());
    this.updateCamera(dt);
    this.renderFrame();

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private renderFrame(): void {
    if (this.composer && !this.isSoftwareGl) {
      if (this.depthTarget && this.depthOverrideMat) {
        const prevTarget = this.renderer.getRenderTarget();
        const prevSkyVisible = this.sky.visible;
        const prevVfxVisible = this.vfx.vfxGroup.visible;
        const prevTrajVisible = this.trajectoryDots.visible;
        this.sky.visible = false;
        this.vfx.vfxGroup.visible = false;
        this.trajectoryDots.visible = false;
        this.scene.overrideMaterial = this.depthOverrideMat;
        this.renderer.setRenderTarget(this.depthTarget);
        this.renderer.clearDepth();
        this.renderer.render(this.scene, this.camera);
        this.scene.overrideMaterial = null;
        this.sky.visible = prevSkyVisible;
        this.vfx.vfxGroup.visible = prevVfxVisible;
        this.trajectoryDots.visible = prevTrajVisible;
        this.renderer.setRenderTarget(prevTarget);
      }
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private emitHud(force: boolean): void {
    const now = performance.now();
    if (!force && now - this.lastHudEmitMs < 95) return;
    this.lastHudEmitMs = now;

    const lvl = LEVELS[this.levelIndex];
    const pigsRemaining = this.world.bodies.filter((b) => b.kind === 'pig' && b.alive).length;
    const pullMag = this.pullOffset.length();
    const pullPower = Math.round((pullMag / MAX_PULL_DIST) * 100);
    const pullAngleDeg = Math.round(
      THREE.MathUtils.radToDeg(
        Math.atan2(this.launchVelocity.y, Math.hypot(this.launchVelocity.x, this.launchVelocity.z)),
      ),
    );

    this.onHudChange({
      phase: this.phase,
      levelIndex: this.levelIndex,
      levelCount: LEVELS.length,
      levelName: lvl.name,
      levelSubtitle: lvl.subtitle,
      score: Math.round(this.score),
      bestScore: Math.round(this.bestScores[this.levelIndex]),
      stars: computeStars(this.score, lvl.starThresholds),
      starThresholds: lvl.starThresholds,
      pigsRemaining,
      pigsTotal: lvl.pigs.length,
      birdQueue: this.activeBirdBody?.launched ? [...this.birdQueue] : this.birdQueue.slice(1),
      activeBird: this.activeBirdBody?.birdType ?? null,
      abilityReady: Boolean(
        this.activeBirdBody && this.activeBirdBody.launched && !this.abilityUsed && this.activeBirdBody.alive,
      ),
      abilityUsed: this.abilityUsed,
      cameraMode: this.cameraMode,
      freeCamGesture: this.freeCamGesture,
      isPulling: this.isPulling,
      pullPower,
      pullAngleDeg,
      muted: this.audio.muted,
      unusedBirdBonus: this.unusedBirdBonus,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.unbindEvents();
    this.clearLevelVisuals();
    this.vfx.dispose();
    this.ambientAtmos.dispose();
    this.envCleanup.dispose();
    this.textures.dispose();
    this.trajectoryDotGeo.dispose();
    this.trajectoryDotMat.dispose();
    this.blockMaterials.dispose();
    this.orbitControls.dispose();
    this.depthTarget?.dispose();
    this.depthOverrideMat?.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

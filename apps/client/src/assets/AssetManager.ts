import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

export interface WeaponAsset {
  model: THREE.Group;
  animations: THREE.AnimationClip[];
  isPlaceholder: boolean;
}

export class AssetManager {
  private manager = new THREE.LoadingManager();
  private draco = new DRACOLoader(this.manager);
  private loader = new GLTFLoader(this.manager);
  private weaponCache = new Map<string, Promise<WeaponAsset>>();
  private ktx2: KTX2Loader | null = null;

  constructor(private progress: (value: number, label: string) => void) {
    this.draco.setDecoderPath('/draco/');
    this.loader.setDRACOLoader(this.draco);
    this.manager.onProgress = (_url, loaded, total) => {
      this.progress(Math.min(99, Math.round((loaded / Math.max(total, 1)) * 100)),
        `讀取資源 ${loaded}/${total}`);
    };
    this.manager.onError = url => console.warn(`[AssetManager] Cannot load: ${url}`);
  }

  /**
   * Optional Basis/KTX2 path for future compressed PBR art. Existing JPG maps
   * remain available until real .ktx2 assets are authored (renaming won't work).
   */
  enableCompressedTextures(renderer: THREE.WebGLRenderer): void {
    if (this.ktx2) return;
    this.ktx2 = new KTX2Loader(this.manager)
      .setTranscoderPath('/basis/')
      .setWorkerLimit(2)
      .detectSupport(renderer);
    this.loader.setKTX2Loader(this.ktx2);
  }

  async loadCompressedTexture(path: string, srgb = false): Promise<THREE.CompressedTexture> {
    if (!this.ktx2) throw new Error('Call enableCompressedTextures(renderer) first');
    const map = await this.ktx2.loadAsync(path);
    map.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return map;
  }

  loadWeapon(path = '/assets/weapons/viewmodel.glb'): Promise<WeaponAsset> {
    let job = this.weaponCache.get(path);
    if (!job) {
      job = this.loadWeaponUncached(path);
      this.weaponCache.set(path, job);
    } else {
      this.progress(100, '武器模型已從快取讀取');
    }
    return job;
  }

  private async loadWeaponUncached(path: string): Promise<WeaponAsset> {
    this.progress(0, '準備武器模型…');
    try {
      const gltf: GLTF = await this.loader.loadAsync(path);
      gltf.scene.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = false;
          obj.frustumCulled = false; // camera-attached viewmodel can overrun mesh bounds
        }
      });
      this.progress(100, '武器 GLB 載入完成');
      return { model: gltf.scene, animations: gltf.animations, isPlaceholder: false };
    } catch (error) {
      console.warn('Weapon GLB missing/invalid: using procedural fallback.', error);
      this.progress(100, '模型未提供，已切換為可操作的 Placeholder');
      return { model: this.makeFallbackWeapon(path), animations: [], isPlaceholder: true };
    }
  }

  private makeFallbackWeapon(modelPath: string): THREE.Group {
    const root = new THREE.Group();
    const pbr = (color: number, metalness = 0.4, roughness = 0.55) =>
      new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const gunMetal = pbr(0x272f35, 0.8, 0.38);
    const grip = pbr(0x423c35, 0.08, 0.75);
    const skin = pbr(0xb18a6c, 0, 0.9);

    const box = (name: string, size: [number, number, number],
      pos: [number, number, number], material: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.name = name;
      mesh.position.set(...pos);
      root.add(mesh);
      return mesh;
    };

    const isPistol = /p9|magnum/.test(modelPath);
    const isSMG = /uzi|mp5/.test(modelPath);
    const isLMG = /m249|pkm/.test(modelPath);
    const lengthScale = isPistol ? .55 : isSMG ? .78 : isLMG ? 1.35 : 1;

    // Model points toward camera forward (-Z)
    box('receiver', [isLMG ? .20 : .11, isLMG ? .18 : .12, .42 * lengthScale], [0, -.025, -.19 * lengthScale], gunMetal);
    box('barrel', [0.065, 0.064, 0.44 * lengthScale], [0, .007, -.57 * lengthScale], gunMetal);
    box('magazine', [isLMG ? .24 : .085, isLMG ? .32 : .21, isLMG ? .26 : .11], [0, -.19, -.27*lengthScale], grip);
    if (!isPistol) box('stock', [0.12, 0.11, 0.23], [0, -.01, .13], grip);
    box('sightRear', [0.035, 0.037, 0.04], [0, 0.06, -0.075], gunMetal);
    box('sightFront', [0.025, 0.045, 0.035], [0, .055, -.71*lengthScale], gunMetal);

    const handL = box('handLeft', [0.16, 0.13, 0.30], [-0.19, -0.155, -0.37], skin);
    handL.rotation.z = -0.14;
    const handR = box('handRight', [0.18, 0.16, 0.32], [0.1, -0.23, -0.03], skin);
    handR.rotation.z = 0.23;
    return root;
  }

  dispose(): void {
    this.ktx2?.dispose();
    this.ktx2 = null;
    this.draco.dispose();
  }
}

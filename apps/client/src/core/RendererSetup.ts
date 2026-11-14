import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export interface AtmosphereOptions {
  showHDRBackground?: boolean;
  fogDensity?: number;
  environmentIntensity?: number;
}

/**
 * V3.5 shared physically based pipeline. Keep the existing EffectComposer,
 * including a final OutputPass, to apply ACES and sRGB exactly once.
 *
 * The night HDR is used for reflections/IBL, never as the visible background.
 * That preserves the post-apocalyptic skyline and fog.
 */
export function configurePhotorealRenderer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  hdrPath = '/assets/hdri/overcast_night.hdr',
  options: AtmosphereOptions = {}
): { ready: Promise<boolean>; dispose: () => void } {
  const previous = {
    colorSpace: renderer.outputColorSpace,
    toneMapping: renderer.toneMapping,
    exposure: renderer.toneMappingExposure,
    shadowEnabled: renderer.shadowMap.enabled,
    shadowType: renderer.shadowMap.type,
    pixelRatio: renderer.getPixelRatio(),
    environment: scene.environment,
    environmentIntensity: scene.environmentIntensity,
    fog: scene.fog,
    background: scene.background
  };

  THREE.ColorManagement.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.20;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  // Reflective metals need HDRI, not a high metalness + white ambient light.
  // Keep the night environment controlled at the brighter exposure.
  scene.environmentIntensity = options.environmentIntensity ?? 0.48;
  scene.background = new THREE.Color(0x09111b);
  // Distance extinction only: FogExp2 is NOT shadowed volumetric scattering.
  scene.fog = new THREE.FogExp2(0x0c1520, Math.max(0, options.fogDensity ?? 0.0115));

  let disposed = false;
  let pmremTarget: THREE.WebGLRenderTarget | null = null;

  const ready = (async () => {
    let hdr: THREE.DataTexture | null = null;
    try {
      hdr = await new RGBELoader().loadAsync(hdrPath);
      if (disposed) return false;

      const pmrem = new THREE.PMREMGenerator(renderer);
      try {
        pmremTarget = pmrem.fromEquirectangular(hdr);
      } finally {
        pmrem.dispose();
      }
      if (disposed) {
        pmremTarget.dispose();
        pmremTarget = null;
        return false;
      }
      scene.environment = pmremTarget.texture;
      if (options.showHDRBackground) scene.background = pmremTarget.texture;
      return true;
    } catch (error) {
      console.warn('[Visuals] HDRI unavailable, direct lighting remains active:', error);
      return false;
    } finally {
      hdr?.dispose();
    }
  })();

  return {
    ready,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      scene.environment = previous.environment;
      scene.environmentIntensity = previous.environmentIntensity;
      scene.fog = previous.fog;
      scene.background = previous.background;
      renderer.outputColorSpace = previous.colorSpace;
      renderer.toneMapping = previous.toneMapping;
      renderer.toneMappingExposure = previous.exposure;
      renderer.shadowMap.enabled = previous.shadowEnabled;
      renderer.shadowMap.type = previous.shadowType;
      renderer.setPixelRatio(previous.pixelRatio);
      pmremTarget?.dispose();
      pmremTarget = null;
    }
  };
}

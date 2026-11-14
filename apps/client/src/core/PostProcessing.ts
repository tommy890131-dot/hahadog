import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

/** Linear HDR bloom -> display transform -> FXAA -> subtle display-space grain. */
export function createPostProcessing(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  const render = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .26, .4, 1.4);
  const output = new OutputPass();
  const fxaa = new ShaderPass(FXAAShader);
  const grain = new FilmPass(.035, false);
  for (const pass of [render, bloom, output, fxaa, grain]) composer.addPass(pass);
  return {
    composer, bloom, fxaa, grain,
    dispose() {
      for (const pass of composer.passes) pass.dispose();
      composer.dispose();
    }
  };
}

import * as THREE from 'three';
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import type { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import type { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { FrameBudget, QUALITY_SETTINGS, type QualityMode } from './FrameBudget';

/** Adaptive GPU workload; no gameplay/physics, combat accuracy or server tick changes. */
export class AdaptiveRenderer {
  readonly budget = new FrameBudget();
  private readonly pixelRatio: number;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly composer: EffectComposer,
    private readonly bloom: UnrealBloomPass,
    private readonly moon: THREE.DirectionalLight,
    private readonly flashlight: THREE.SpotLight,
    private readonly fxaa?: ShaderPass,
    private readonly grain?: FilmPass
  ) {
    this.pixelRatio = Math.max(0.65, window.devicePixelRatio || 1);
    this.apply();
  }

  sample(dtMs: number, active: boolean): void {
    if (this.budget.sample(dtMs, active)) this.apply();
  }

  setMode(mode: QualityMode): void {
    this.budget.setMode(mode);
    this.apply();
  }

  get modeLabel(): string {
    const names = { high: '高', balanced: '均衡', performance: '效能' };
    return `${this.budget.mode === 'auto' ? '自動/' : '手動/'}${names[this.budget.tier]}`;
  }

  apply(): void {
    const quality = QUALITY_SETTINGS[this.budget.tier];
    const dpr = Math.max(0.65, Math.min(this.pixelRatio, quality.dprLimit));
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    // EffectComposer has its own DPR; adjusting renderer alone won't scale postprocessing.
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.fxaa?.uniforms.resolution.value.set(
      1 / Math.max(1, Math.floor(window.innerWidth * dpr)),
      1 / Math.max(1, Math.floor(window.innerHeight * dpr))
    );
    if (this.grain) this.grain.enabled = this.budget.tier === 'high';
    this.bloom.enabled = quality.bloom;
    this.flashlight.castShadow = quality.flashlightShadow;
    this.moon.castShadow = quality.moonShadow > 0;
    if (quality.moonShadow && this.moon.shadow.mapSize.x !== quality.moonShadow) {
      this.moon.shadow.mapSize.set(quality.moonShadow, quality.moonShadow);
      this.moon.shadow.map?.dispose();
      this.moon.shadow.map = null;
    }
    this.renderer.shadowMap.needsUpdate = true;
  }

  resize(): void { this.apply(); }

  get visibleDistance(): number { return QUALITY_SETTINGS[this.budget.tier].zombieVisibleDistance; }
  get detailDistance(): number { return QUALITY_SETTINGS[this.budget.tier].zombieDetailDistance; }
}

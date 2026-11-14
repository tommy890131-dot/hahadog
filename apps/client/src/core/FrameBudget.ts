/** CPU-side frame pacing policy. Rendering is adapted elsewhere to keep this testable without WebGL. */
export type QualityTier = 'high' | 'balanced' | 'performance';
export type QualityMode = 'auto' | QualityTier;

const LEVELS: QualityTier[] = ['performance', 'balanced', 'high'];
export const QUALITY_SETTINGS = {
  high: { dprLimit: 1.5, bloom: true, moonShadow: 2048, flashlightShadow: true, zombieDetailDistance: 46, zombieVisibleDistance: 125 },
  balanced: { dprLimit: 1.05, bloom: false, moonShadow: 1024, flashlightShadow: false, zombieDetailDistance: 33, zombieVisibleDistance: 105 },
  performance: { dprLimit: 0.8, bloom: false, moonShadow: 0, flashlightShadow: false, zombieDetailDistance: 22, zombieVisibleDistance: 85 }
} as const;

/**
 * Windowed FPS measurement: two slow windows to downgrade, eight healthy
 * windows to upgrade. A cooldown prevents constant GPU buffer reallocation.
 * Sample real wall-clock frame times, never the physics-clamped delta.
 */
export class FrameBudget {
  mode: QualityMode = 'auto';
  tier: QualityTier = 'high';
  fps = 0;
  frameMs = 0;
  private durationMs = 0;
  private frames = 0;
  private slowWindows = 0;
  private fastWindows = 0;
  private elapsedMs = 0;
  private lastChangeMs = -10_000;

  setMode(mode: QualityMode): boolean {
    const before = this.tier;
    this.mode = mode;
    if (mode !== 'auto') this.tier = mode;
    this.slowWindows = this.fastWindows = 0;
    this.resetSamples();
    return before !== this.tier;
  }

  sample(realDeltaMs: number, enabled = true): boolean {
    if (!Number.isFinite(realDeltaMs) || realDeltaMs <= 0 || realDeltaMs > 220 || !enabled) {
      this.resetSamples();
      return false;
    }
    this.elapsedMs += realDeltaMs;
    this.durationMs += realDeltaMs;
    this.frames++;
    if (this.durationMs < 1000 || this.frames < 15) return false;
    this.frameMs = this.durationMs / this.frames;
    this.fps = Math.round(1000 / this.frameMs);
    this.resetSamples();
    if (this.mode !== 'auto' || this.elapsedMs < 4500 || this.elapsedMs - this.lastChangeMs < 5500) return false;
    if (this.fps < 51) { this.slowWindows++; this.fastWindows = 0; }
    else if (this.fps >= 59) { this.fastWindows++; this.slowWindows = 0; }
    else { this.slowWindows = 0; this.fastWindows = 0; }
    const index = LEVELS.indexOf(this.tier);
    if (this.slowWindows >= 2 && index > 0) {
      this.tier = LEVELS[index - 1];
    } else if (this.fastWindows >= 8 && index < LEVELS.length - 1) {
      this.tier = LEVELS[index + 1];
    } else return false;
    this.lastChangeMs = this.elapsedMs;
    this.slowWindows = this.fastWindows = 0;
    return true;
  }

  private resetSamples(): void {
    this.durationMs = 0;
    this.frames = 0;
  }
}

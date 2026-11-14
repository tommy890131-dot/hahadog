/**
 * Deterministic client-side physics clock. Rendering can run at any FPS;
 * movement, slopes and jumping always run in fixed 1/60-second increments.
 * Capped catch-up avoids a spiral of death on tab resumption or GPU stalls.
 */
export class FixedPhysicsClock {
  constructor(step = 1 / 60, maxSteps = 12) {
    this.step = step;
    this.maxSteps = maxSteps;
    this.accumulator = 0;
  }
  reset() { this.accumulator = 0; }
  advance(wallDelta, simulate) {
    if (!Number.isFinite(wallDelta) || wallDelta <= 0) return 0;
    if (wallDelta > 0.4) { this.reset(); return 0; } // suspend / tab-switch, not 5 FPS
    // Ignore the remainder of a long background pause, not routine 5-10 FPS frames.
    this.accumulator = Math.min(this.step * this.maxSteps,
      this.accumulator + Math.min(wallDelta, 0.25));
    let steps = 0;
    while (this.accumulator + 1e-9 >= this.step && steps < this.maxSteps) {
      simulate(this.step);
      this.accumulator -= this.step;
      steps++;
    }
    this.accumulator = Math.max(0, this.accumulator);
    return steps;
  }
}

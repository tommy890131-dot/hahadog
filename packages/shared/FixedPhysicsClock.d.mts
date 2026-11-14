export class FixedPhysicsClock {
  readonly step: number;
  readonly maxSteps: number;
  accumulator: number;
  constructor(step?: number, maxSteps?: number);
  reset(): void;
  advance(wallDelta: number, simulate: (step: number) => void): number;
}

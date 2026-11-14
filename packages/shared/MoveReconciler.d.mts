export class MoveReconciler {
  nextSeq: number;
  lastAck: number;
  history: {seq:number; x:number; z:number}[];
  pendingX: number;
  pendingZ: number;
  constructor();
  reset(): void;
  record(x: number, z: number): number;
  acknowledge(ack: number, x: number, z: number): { corrected:boolean; snap:boolean; dx?:number; dz?:number };
  advance(dt: number): {dx:number; dz:number};
}

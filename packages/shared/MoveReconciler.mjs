/** Snapshot reconciliation in the SAME movement-sequence timeline as the server.
 * Comparing a delayed server snapshot against the current camera creates
 * perpetual 100ms rubber-banding. Compare against its acknowledged pose.
 */
export class MoveReconciler {
  constructor() { this.reset(); }
  reset() {
    this.nextSeq = 1;
    this.lastAck = 0;
    this.history = [];
    this.pendingX = 0;
    this.pendingZ = 0;
  }
  record(x, z) {
    const seq = this.nextSeq++;
    this.history.push({ seq, x, z });
    if (this.history.length > 256) this.history.shift();
    return seq;
  }
  acknowledge(ack, serverX, serverZ) {
    if (!Number.isSafeInteger(ack) || ack <= this.lastAck ||
        !Number.isFinite(serverX) || !Number.isFinite(serverZ)) return { corrected: false, snap: false };
    this.lastAck = ack;
    const sent = this.history.find(item => item.seq === ack);
    this.history = this.history.filter(item => item.seq > ack);
    if (!sent) return { corrected: false, snap: false };
    const dx = serverX - sent.x;
    const dz = serverZ - sent.z;
    const error = Math.hypot(dx, dz);
    if (error < 0.08) return { corrected: false, snap: false };
    if (error > 2.5) {
      this.pendingX = this.pendingZ = 0;
      return { corrected: true, snap: true, dx, dz };
    }
    this.pendingX = Math.max(-2.5, Math.min(2.5, this.pendingX + dx));
    this.pendingZ = Math.max(-2.5, Math.min(2.5, this.pendingZ + dz));
    return { corrected: true, snap: false };
  }
  /** Run once per rendered frame to smoothly consume the authoritative offset. */
  advance(dt) {
    const alpha = 1 - Math.exp(-10 * Math.max(0, Math.min(dt, 0.2)));
    let dx = this.pendingX * alpha;
    let dz = this.pendingZ * alpha;
    const amount = Math.hypot(dx, dz);
    if (amount > 0.25) { dx *= 0.25 / amount; dz *= 0.25 / amount; }
    this.pendingX -= dx;
    this.pendingZ -= dz;
    if (Math.hypot(this.pendingX, this.pendingZ) < 0.002) {
      this.pendingX = this.pendingZ = 0;
    }
    return { dx, dz };
  }
}

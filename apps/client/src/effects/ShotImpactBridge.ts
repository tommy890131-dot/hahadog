import * as THREE from 'three';
import type { ServerEvent } from '../network/Multiplayer';
import type { World } from '../world/World';
import { ImpactSystem } from './ImpactSystem';

/**
 * Server-authoritative shot events drive shared multiplayer effects.
 * The client raycaster is VISUAL-ONLY; it does not decide damage or XP.
 * The authoritative ray uses the server-supplied from/to positions, including
 * server-computed spread. This avoids false local hit confirmation.
 */
export class ShotImpactBridge {
  private readonly raycaster = new THREE.Raycaster();
  private readonly from = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly normalMatrix = new THREE.Matrix3();
  constructor(
    private readonly world: World,
    private readonly effects: ImpactSystem,
    private readonly camera: THREE.Camera
  ) {}
  onServerShot(event: ServerEvent): void {
    if (event.type !== 'shot' || !event.from || !event.to) return;
    const coords = [...Object.values(event.from), ...Object.values(event.to)];
    if (!coords.every(v => typeof v === 'number' && Number.isFinite(v))) return;
    this.from.set(event.from.x, event.from.y, event.from.z);
    this.to.set(event.to.x, event.to.y, event.to.z);
    // No effects for events far outside the client's visible gameplay range.
    if (this.camera.position.distanceToSquared(this.to) > 75 * 75) return;
    this.dir.subVectors(this.to, this.from);
    const distance = this.dir.length();
    if (distance < .05 || distance > 120) return;
    this.dir.divideScalar(distance);

    if (event.hit === true) {
      // Current server sends the first confirmed zombie impact point on the ray.
      this.effects.onHit({
        kind: 'flesh',
        point: this.to.clone(),
        normal: this.dir.clone().negate()
      });
      if (event.killed === true) {
        // Ground stain: use the static world floor as a decal receiver.
        this.effects.addBloodStain(
          this.world.ground,
          new THREE.Vector3(this.to.x, .012, this.to.z)
        );
      }
      return;
    }

    // When no zombie was hit, test only authoritative, static world blockers.
    // City decoration InstancedMeshes are purposely omitted from decal projection.
    this.raycaster.set(this.from, this.dir);
    this.raycaster.near = 0;
    this.raycaster.far = distance + .12;
    const hit = this.raycaster.intersectObjects(this.world.blockers, false)[0];
    if (hit && hit.face && hit.object instanceof THREE.Mesh) {
      const mesh = hit.object;
      mesh.updateWorldMatrix(true, false);
      const outward = hit.face.normal.clone()
        .applyMatrix3(this.normalMatrix.getNormalMatrix(mesh.matrixWorld))
        .normalize();
      this.effects.onHit({ kind: 'wall', point: hit.point.clone(), normal: outward, surface: mesh });
    }
  }
}

import * as THREE from 'three';
import type { World } from './World';

interface Target {
  id: number;
  mesh: THREE.Group;
  health: number;
  knock: THREE.Vector3;
}

export class TrainingTargets {
  private targets = new Map<number, Target>();
  private nextId = 1;
  private cast = new THREE.Raycaster();
  readonly maxTargets = 10;

  constructor(private scene: THREE.Scene, private world: World) {
    for (const [x, z] of [[0, 3.8], [2.6, -1.8], [-3, 2], [4, -8],
      [-11, -7], [-8, 11], [11, 8], [15, -3]] as const) {
      this.spawn(x, z);
    }
  }

  private spawn(x: number, z: number): void {
    const id = this.nextId++;
    const mesh = new THREE.Group();
    mesh.position.set(x, 0, z);
    mesh.userData.targetId = id;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 1.25, 8),
      new THREE.MeshStandardMaterial({ color: 0x547d5b, roughness: 0.93 }));
    body.position.y = 0.75;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 9, 7),
      new THREE.MeshStandardMaterial({ color: 0x92a57d, roughness: 0.95 }));
    head.position.y = 1.58;
    mesh.add(body, head);
    this.scene.add(mesh);
    this.targets.set(id, { id, mesh, health: 100, knock: new THREE.Vector3() });
  }

  get count(): number { return this.targets.size; }

  private hit(target: Target, damage: number): string {
    target.health -= damage;
    if (target.health <= 0) {
      this.scene.remove(target.mesh);
      this.targets.delete(target.id);
      return `殭屍訓練假人 #${target.id} 擊倒！`;
    }
    return `命中 #${target.id}｜剩餘 HP ${target.health}`;
  }

  shoot(camera: THREE.PerspectiveCamera): string {
    this.cast.setFromCamera(new THREE.Vector2(0, 0), camera);
    this.cast.far = 100;
    const roots: THREE.Object3D[] = [
      ...this.world.blockers,
      ...[...this.targets.values()].map(t => t.mesh)
    ];
    const hits = this.cast.intersectObjects(roots, true);
    if (!hits.length) return '射擊落空';
    let node: THREE.Object3D | null = hits[0].object;
    while (node && node.userData.targetId === undefined) node = node.parent;
    const id = node?.userData.targetId as number | undefined;
    const target = id === undefined ? undefined : this.targets.get(id);
    return target ? this.hit(target, 25) : '擊中障礙物';
  }

  shove(camera: THREE.PerspectiveCamera): string {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();
    let affected = 0;
    for (const target of [...this.targets.values()]) {
      const delta = target.mesh.position.clone().sub(camera.position);
      delta.y = 0;
      const distance = delta.length();
      if (distance < 0.001 || distance > 2) continue;
      delta.normalize();
      if (direction.dot(delta) < Math.cos(Math.PI / 6)) continue;
      // Check if a wall blocks the shove
      const origin = camera.position.clone();
      origin.y = 1.2;
      this.cast.set(origin, delta);
      this.cast.far = distance;
      if (this.cast.intersectObjects(this.world.blockers.filter(o => o.type !== 'Mesh' ||
        !(o as THREE.Mesh).geometry || (o as THREE.Mesh).geometry.type !== 'PlaneGeometry'), false).length) continue;
      target.knock.addScaledVector(delta, 7);
      this.hit(target, 10);
      affected++;
    }
    return affected ? `近戰推擊命中 ${affected} 隻` : '近戰推擊未命中';
  }

  update(dt: number): void {
    for (const target of this.targets.values()) {
      const dx = target.knock.x * dt;
      const dz = target.knock.z * dt;
      const pos = target.mesh.position;
      if (this.world.canOccupy(pos.x + dx, pos.z + dz, 0.4)) {
        pos.x += dx;
        pos.z += dz;
      }
      target.knock.multiplyScalar(Math.exp(-7 * dt));
    }
  }
}

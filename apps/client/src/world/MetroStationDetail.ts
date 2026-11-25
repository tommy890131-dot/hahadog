/**
 * DEADLINE FOUR V3.12 — Metro Station Geometry Detail
 * Adds REAL 3D geometry (not texture-only): platform edges, tracks, sleepers,
 * columns, beams, stair treads, handrails, ventilation, ceiling pipes,
 * electrical conduits, signs, light housings, debris and structural damage.
 * Coordinates: X along the tracks, Y up, Z across the tracks. Units: meters.
 *
 * Integration: add returned group to the scene; feed solidBounds into the
 * existing server-authoritative collider/navigation pipeline.
 * The module does not mutate network state or own enemy navigation.
 */
import * as THREE from 'three';

export type MetroDetailOptions = {
  seed?: number;
  debris?: boolean;
  shadow?: boolean;
};
export type MetroSolidBounds = {
  center: [number, number, number];
  size: [number, number, number];
  tag: string;
};
export type MetroDetailResult = {
  group: THREE.Group;
  solidBounds: MetroSolidBounds[];
  dispose: () => void;
};

export function buildMetroStationDetail(options: MetroDetailOptions = {}): MetroDetailResult {
  const group = new THREE.Group();
  group.name = 'V3_12_Metro_Geometry_Detail';
  const solids: MetroSolidBounds[] = [];
  let s = (options.seed ?? 7129) >>> 0;
  const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const mat = (hex: number, roughness = 0.88, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color: hex, roughness, metalness });
  const concrete = mat(0x70787c);
  const darker = mat(0x4c5358);
  const bright = mat(0xa8a8a1);
  const tile = mat(0x888b87);
  const yellow = mat(0xc9a63a);
  const steel = mat(0x5a666d, 0.42, 0.76);
  const rust = mat(0x604638, 0.86, 0.34);
  const black = mat(0x23282a, 0.82);
  const glass = new THREE.MeshStandardMaterial({ color: 0x53686b, roughness: 0.2, metalness: 0.2, transparent: true, opacity: 0.65 });
  const emissive = new THREE.MeshStandardMaterial({ color: 0xd2e5da, emissive: 0xaecfba, emissiveIntensity: 1.5 });
  const materials = [concrete, darker, bright, tile, yellow, steel, rust, black, glass, emissive];

  const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number,
    material: THREE.Material, collide = false) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = options.shadow !== false;
    m.receiveShadow = true;
    m.name = name;
    group.add(m);
    if (collide) solids.push({ center: [x, y, z], size: [w, h, d], tag: name });
    return m;
  };
  const pipe = (name: string, a: THREE.Vector3, b: THREE.Vector3, r: number, material: THREE.Material) => {
    const dir = b.clone().sub(a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 8), material);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m.castShadow = options.shadow !== false;
    m.name = name;
    group.add(m);
    return m;
  };
  // Underlying foundations and two elevated passenger platforms.
  box('station_subgrade', 0, -0.8, 0, 50, 1.6, 25, darker, true);
  for (const side of [-1, 1]) {
    box('passenger_platform', 0, 0, side * 7.9, 48, 0.48, 8.8, tile, true);
    box('platform_nosing', 0, 0.27, side * 3.56, 48, 0.055, 0.38, yellow);
    box('platform_tactile_strip', 0, 0.29, side * 4.03, 48, 0.025, 0.32, bright);
    box('outer_retaining_wall', 0, 3.1, side * 12.3, 50, 6.2, 0.5, concrete, true);
    // Repetitive column grid with cap beams / plinths; the geometry is actual depth.
    for (let x = -20; x <= 20; x += 8) {
      box('column_plinth', x, 0.45, side * 10.55, 1.25, 0.9, 1.3, darker, true);
      box('reinforced_concrete_column', x, 3.2, side * 10.55, 0.86, 5.5, 0.92, concrete, true);
      box('column_capital', x, 6.08, side * 10.55, 1.45, 0.35, 1.55, bright);
      box('electrical_box', x + 0.48, 1.72, side * 10.55, 0.18, 0.73, 0.53, steel);
      box('electrical_box_cover', x + 0.59, 1.72, side * 10.55, 0.025, 0.63, 0.44, darker);
    }
    box('longitudinal_beam', 0, 6.26, side * 10.55, 48, 0.68, 0.88, concrete);
    // Suspended lighting and conduit: models cast their own shadows.
    for (let x = -21; x <= 21; x += 6) {
      box('suspended_light_housing', x, 5.91, side * 7.25, 2.8, 0.18, 0.48, black);
      box('suspended_light_diffuser', x, 5.79, side * 7.25, 2.55, 0.045, 0.34, emissive);
      pipe('light_hanger', new THREE.Vector3(x - 0.75, 6.67, side * 7.25),
        new THREE.Vector3(x - 0.75, 5.98, side * 7.25), 0.025, steel);
      pipe('light_hanger', new THREE.Vector3(x + 0.75, 6.67, side * 7.25),
        new THREE.Vector3(x + 0.75, 5.98, side * 7.25), 0.025, steel);
    }
    // Ventilation ductwork: actual cubic duct and couplers.
    box('ventilation_main_duct', 0, 6.07, side * 9.35, 45, 0.52, 0.65, steel);
    for (let x = -20; x <= 20; x += 4) {
      box('duct_flange', x, 6.07, side * 9.35, 0.09, 0.59, 0.73, black);
      box('ventilation_grille', x, 5.84, side * 9.35, 1.25, 0.06, 0.48, darker);
      for (let k = -2; k <= 2; k++) {
        box('grille_louver', x + k * 0.22, 5.79, side * 9.35, 0.055, 0.055, 0.4, steel);
      }
    }
    for (const zOffset of [8.5, 9.0, 11.4]) {
      pipe('ceiling_utility_pipe', new THREE.Vector3(-23, 6.51, side * zOffset),
        new THREE.Vector3(23, 6.51, side * zOffset), zOffset === 11.4 ? 0.115 : 0.07, rust);
    }
    // Handrail and stair treads: approach to upper concourse at far end.
    const stairZ = side * 10.95;
    for (let n = 0; n < 14; n++) {
      const x = -23 + n * 0.35;
      const y = 0.45 + n * 0.19;
      box('concourse_stair_tread', x, y, stairZ, 0.38, 0.18, 2.25, concrete, true);
      box('stair_nosing', x + 0.17, y + 0.095, stairZ, 0.04, 0.035, 2.25, yellow);
    }
    for (const offset of [-1.19, 1.19]) {
      const z = stairZ + offset;
      for (let n = 0; n <= 7; n++) {
        const x = -22.9 + n * 0.7;
        const y = 1.25 + n * 0.38;
        pipe('stair_baluster', new THREE.Vector3(x, y - 0.74, z),
          new THREE.Vector3(x, y, z), 0.032, steel);
      }
      pipe('stair_sloped_handrail', new THREE.Vector3(-22.9, 1.25, z),
        new THREE.Vector3(-18.0, 3.91, z), 0.055, steel);
    }
    // Billboard frame, layered glass, and panel, all separate geometry.
    box('wayfinding_backplate', 8, 3.55, side * 12.02, 5.2, 1.45, 0.14, black);
    box('wayfinding_insert', 8, 3.55, side * 11.9, 4.95, 1.22, 0.025, bright);
    box('wayfinding_glass', 8, 3.55, side * 11.86, 5.02, 1.27, 0.018, glass);
    // Trackside guard fixtures
    for (let x = -22; x <= 22; x += 2) {
      box('platform_service_channel', x, 0.06, side * 4.48, 1.8, 0.12, 0.24, darker);
    }
  }
  // Track sleepers and steel rail profiles.
  box('track_ballast', 0, -0.53, 0, 48, 0.26, 6.7, rust);
  for (let x = -23; x <= 23; x += 0.78) {
    box('railway_sleeper', x, -0.23, 0, 0.25, 0.2, 5.5, darker);
  }
  for (const z of [-2.12, -1.18, 1.18, 2.12]) {
    box('continuous_steel_rail', 0, -0.03, z, 48, 0.16, 0.11, steel);
    box('rail_foot', 0, -0.15, z, 48, 0.065, 0.26, steel);
  }
  // Station ceiling structural grid.
  box('ceiling_concrete_deck', 0, 6.88, 0, 50, 0.75, 25, concrete);
  for (let x = -20; x <= 20; x += 8) {
    box('cross_beam', x, 6.31, 0, 1.05, 0.62, 24.3, bright);
  }
  // Low-poly but true geometric rubble, deterministic layout.
  if (options.debris !== false) {
    const rockGeo = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < 105; i++) {
      const x = -23 + rand() * 46;
      const z = (rand() < 0.5 ? -1 : 1) * (5.4 + rand() * 6.2);
      const scale = 0.075 + rand() * 0.24;
      const rock = new THREE.Mesh(rockGeo, rand() < 0.3 ? rust : concrete);
      rock.name = 'rubble_fragment';
      rock.position.set(x, 0.31 + scale * 0.55, z);
      rock.scale.set(scale, scale * (0.35 + rand()), scale * (0.7 + rand()));
      rock.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
      rock.castShadow = options.shadow !== false;
      group.add(rock);
    }
  }
  // Instanced bolts to avoid hundreds of separate draw calls.
  const boltGeometry = new THREE.CylinderGeometry(0.038, 0.038, 0.018, 6);
  const boltCount = 4 * 60;
  const bolts = new THREE.InstancedMesh(boltGeometry, steel, boltCount);
  const temp = new THREE.Object3D();
  let bi = 0;
  for (let x = -23; x <= 23 && bi < boltCount - 3; x += 0.78) {
    for (const z of [-2.12, -1.18, 1.18, 2.12]) {
      temp.position.set(x, -0.035, z);
      temp.rotation.set(Math.PI / 2, 0, 0);
      temp.updateMatrix();
      bolts.setMatrixAt(bi++, temp.matrix);
    }
  }
  bolts.count = bi;
  bolts.instanceMatrix.needsUpdate = true;
  bolts.name = 'instanced_rail_fasteners';
  group.add(bolts);

  group.userData.detailVersion = '3.12';
  group.userData.walkablePlatforms = [{ x: 0, z: -7.9, w: 48, d: 8.8 }, { x: 0, z: 7.9, w: 48, d: 8.8 }];
  const dispose = () => {
    group.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
      }
    });
    boltGeometry.dispose();
    materials.forEach(material => material.dispose());
  };
  return { group, solidBounds: solids, dispose };
}

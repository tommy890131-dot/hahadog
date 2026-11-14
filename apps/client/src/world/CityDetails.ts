import * as THREE from 'three';
import { TACTICAL_IDS } from '../../../../packages/shared/VerticalCollision.mjs';

type Building = { id: string; x: number; z: number; w: number; d: number; h: number; role: string };
type Piece = { pos: [number, number, number]; size: [number, number, number]; yaw?: number; pitch?: number };

const mat = (color: number, roughness = .75, metalness = .1) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function batch(scene: THREE.Scene, parts: Piece[], material: THREE.Material, name: string): void {
  if (!parts.length) return;
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, parts.length);
  mesh.name = name;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < parts.length; i++) {
    const item = parts[i];
    dummy.position.set(...item.pos);
    dummy.rotation.set(item.pitch ?? 0, item.yaw ?? 0, 0);
    dummy.scale.set(...item.size);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

/** Billboard-sized readable emergency-store signage, with distressed original styling. */
function signTexture(label: string, hue: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1a2429'; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = hue; ctx.fillRect(0, 0, 11, 128);
  ctx.fillStyle = '#b6b2a0'; ctx.fillRect(23, 13, 465, 2); ctx.fillRect(23, 113, 465, 2);
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d0c9ac'; ctx.fillText(label, 256, 63, 450);
  let seed = 1702;
  for (let i = 0; i < 100; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed % 512, y = ((seed >>> 9) % 128);
    ctx.fillStyle = `rgba(11,17,20,${.07 + (seed % 4) * .06})`;
    ctx.fillRect(x, y, 3 + seed % 30, 1 + seed % 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Secondary art pass; no alterations to server collision map or navigability. */
export function addCityDetails(scene: THREE.Scene, buildings: Building[]): void {
  const frames: Piece[] = [], mullions: Piece[] = [], ledges: Piece[] = [];
  const balconies: Piece[] = [], railings: Piece[] = [], pipes: Piece[] = [];
  const signs: Array<{ label: string; position: [number, number, number]; width: number }> = [];
  const crates: Piece[] = [], street: Piece[] = [], awningSlats: Piece[] = [];
  const cables: number[] = [];
  const push = (array: Piece[], x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0, pitch = 0) =>
    array.push({ pos: [x, y, z], size: [w, h, d], yaw, pitch });

  const local = (b: Building, face: number, u: number, y: number, offset: number): [number, number, number, number] => {
    if (face === 0) return [b.x + u, y, b.z + b.d / 2 + offset, 0];
    if (face === 1) return [b.x - u, y, b.z - b.d / 2 - offset, Math.PI];
    if (face === 2) return [b.x + b.w / 2 + offset, y, b.z - u, Math.PI / 2];
    return [b.x - b.w / 2 - offset, y, b.z + u, -Math.PI / 2];
  };
  const framePiece = (array: Piece[], b: Building, face: number, u: number, y: number,
                      dx: number, dy: number, width: number, height: number, depth: number) => {
    const [fx, fy, fz, yaw] = local(b, face, u, y, .08);
    // Transform local coordinates into world frame (x positive is along facade)
    push(array, fx + dx * Math.cos(yaw), fy + dy, fz - dx * Math.sin(yaw), width, height, depth, yaw);
  };

  for (let k = 0; k < buildings.length; k++) {
    const b = buildings[k];
    if (b.role === 'CAR') continue;
    if (TACTICAL_IDS.has(b.id)) continue; // Old decorative panes/balconies don't match real floor openings.
    const floors = Math.max(2, Math.round(b.h / 3.1));
    for (let face = 0; face < 4; face++) {
      const width = face < 2 ? b.w : b.d;
      const columns = Math.max(2, Math.floor(width / 2.8));
      // Concrete slab / cornice registers, gives buildings convincing story scale.
      for (let floor = 1; floor <= floors; floor++) {
        const bandY = Math.min(b.h - .2, floor * (b.h / floors));
        const [x, y, z, yaw] = local(b, face, 0, bandY, .11);
        push(ledges, x, y, z, width + .12, .09, .22, yaw);
      }
      for (let floor = 0; floor < floors; floor++) {
        const y = 1.75 + floor * (b.h - 2.8) / Math.max(1, floors - 1);
        for (let col = 0; col < columns; col++) {
          if (face === 0 && floor === 0 && col === Math.floor(columns / 2)) continue;
          const u = -width / 2 + (col + .5) * width / columns;
          if (TACTICAL_IDS.has(b.id) && face===2 && floor===1 &&
              Math.abs(u - (-b.d/2+1.65))<1.25)continue;
          for (const dx of [-.475, .475]) framePiece(frames, b, face, u, y, dx, 0, .058, 1.48, .11);
          for (const dy of [-.74, .74]) framePiece(frames, b, face, u, y, 0, dy, 1.01, .055, .11);
          framePiece(mullions, b, face, u, y, 0, 0, .038, 1.40, .07);
          framePiece(mullions, b, face, u, y, 0, .42, .96, .023, .07);
          framePiece(ledges, b, face, u, y, 0, -.79, 1.14, .095, .24);
          // Existing facade remains the collider: balconies are visual-only.
          if (face === 0 && floor > 0 && (b.role === 'APARTMENTS' || b.role === 'HOTEL') &&
              (col + floor + k) % 3 === 0) {
            framePiece(balconies, b, face, u, y, 0, -.90, 1.55, .125, 1.14);
            framePiece(railings, b, face, u, y, 0, -.35, 1.53, .065, .085);
            for (const dx of [-.65, -.22, .22, .65]) framePiece(railings, b, face, u, y, dx, -.59, .038, .52, .045);
          }
        }
      }
    }
    // Vertical corner rainwater drains, visible from street level.
    for (const dx of [-b.w / 2 + .25, b.w / 2 - .25]) {
      push(pipes, b.x + dx, b.h / 2, b.z + b.d / 2 + .18, .09, b.h, .09);
      for (let y = 1; y < b.h; y += 2.5) push(pipes, b.x + dx, y, b.z + b.d / 2 + .21, .15, .075, .15);
    }
    // Hanging shop/clinic signs, painted warnings, aging awning edge.
    if (['SHOP', 'CLINIC', 'HOTEL', 'WAREHOUSE', 'FACTORY'].includes(b.role)) {
      const names: Record<string, string> = {
        SHOP: 'SUPPLIES', CLINIC: 'FIELD MEDICAL', HOTEL: 'NO VACANCY',
        WAREHOUSE: 'ZONE 04', FACTORY: 'INDUSTRIAL'
      };
      signs.push({label: names[b.role], position: [b.x, 4.7, b.z + b.d / 2 + .205], width: Math.min(7, b.w * .76)});
      for (let j = 0; j < 8; j++) {
        push(awningSlats, b.x - b.w * .32 + j * b.w * .09, 2.95,
          b.z + b.d / 2 + 1.11, b.w * .035, .025, 2.13);
      }
    }
    // Dumpsters, pallets and generator cabinets: deterministic placement in building margin.
    if (k % 2 === 0) {
      const cx = b.x - b.w * .31, cz = b.z + b.d / 2 + 1.8;
      push(crates, cx, .44, cz, 1.45, .88, .95, k % 4 === 0 ? .2 : 0);
      push(crates, cx - .2, .98, cz + .1, 1.28, .12, .82);
      for (const dx of [-.55, 0, .55]) push(awningSlats, cx + dx, .18, cz, .12, .16, 1.06);
    }
    // Safe aerial powerline cable silhouettes.
    if (k % 4 === 0) {
      const x = b.x + b.w * .25, z = b.z + b.d / 2 + .22;
      const y = Math.min(b.h - 1, 7);
      for (let i = 0; i < 6; i++) {
        const zz = z + i * 1.2;
        cables.push(x, y - Math.sin(i / 5 * Math.PI) * .55, zz,
          x, y - Math.sin((i + 1) / 5 * Math.PI) * .55, zz + 1.2);
      }
    }
  }

  // Zebra crossings and damaged street barricades at navigable intersections.
  for (const center of [-55, 0, 55]) {
    for (let j = 0; j < 7; j++) {
      push(street, center - 4.1 + j * 1.36, .033, 11, .75, .008, 3.7);
      push(street, center - 4.1 + j * 1.36, .033, -11, .75, .008, 3.7);
      push(street, 11, .034, center - 4.1 + j * 1.36, 3.7, .008, .75);
      push(street, -11, .034, center - 4.1 + j * 1.36, 3.7, .008, .75);
    }
  }
  batch(scene, frames, mat(0x28383f, .5, .55), 'Facade window frame instances');
  batch(scene, mullions, mat(0x54656c, .47, .47), 'Facade sash and bars');
  batch(scene, ledges, mat(0x8b918d, .85, .04), 'Concrete sills and cornices');
  batch(scene, balconies, mat(0x666d68, .91, .04), 'Reinforced balconies');
  batch(scene, railings, mat(0x455359, .60, .56), 'Balcony iron railing');
  batch(scene, pipes, mat(0x506268, .61, .57), 'Drainpipes and brackets');
  batch(scene, crates, mat(0x3c5254, .69, .33), 'City dumpsters and crates');
  batch(scene, awningSlats, mat(0x736b55, .80, .18), 'Awning seams and pallet wood');
  batch(scene, street, mat(0xd0c4a5, .95, .015), 'Crosswalk road paint');

  if (cables.length) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(cables, 3));
    const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color:0x293236}));
    line.name = 'Overhead sagging wire bundles'; scene.add(line);
  }

  const signCache = new Map<string, THREE.MeshBasicMaterial>();
  for (const sign of signs) {
    let material = signCache.get(sign.label);
    if (!material) {
      material = new THREE.MeshBasicMaterial({map:signTexture(sign.label, sign.label === 'FIELD MEDICAL' ? '#9c3530' : '#aa844f'), side:THREE.DoubleSide});
      signCache.set(sign.label, material);
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sign.width, 1.18), material);
    mesh.position.set(...sign.position);
    mesh.name = `Rusted signage: ${sign.label}`;
    scene.add(mesh);
  }
}

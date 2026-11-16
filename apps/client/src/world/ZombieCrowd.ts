import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {ZombieRecord} from '../network/Multiplayer';

type Track = ZombieRecord & {tx:number;ty:number;tz:number;tf:number};
type Family='walker'|'runner'|'brute'|'spitter'|'boss';
const FAMILIES:readonly Family[]=['walker','runner','brute','spitter','boss'] as const;
const HEIGHT:Record<Family,number>={walker:1.84,runner:1.94,brute:2.7,spitter:2.25,boss:3.41};
const TINT:Record<string,number>={
  walker:0xffffff,runner:0xffeeec,brute:0xf3e6d8,spitter:0xe4ffe4,
  screamer:0xffcfaf,climber:0xd7e4ff,juggernaut:0xd6c1a9,boss:0xffffff
};
const FAMILY_OF:Record<string,Family>={
  walker:'walker',runner:'runner',brute:'brute',spitter:'spitter',
  screamer:'spitter',climber:'runner',juggernaut:'brute',boss:'boss'
};
type FamilyBatch={mesh:THREE.InstancedMesh;geometry:THREE.BufferGeometry;material:THREE.MeshStandardMaterial};

/**
 * H-17 original art replacement:
 * Walker / Runner / Brute / Spitter use their original one-mesh CrowdStatic GLB,
 * Tyrant uses the original Boss blockout merged into one GPU instanced mesh.
 * This preserves the existing server-side movement/collision/hit validation and
 * restricts visible crowd rendering to five draw calls (one per asset family).
 *
 * GLBs are static/unrigged; gait is an intentionally restrained procedural full
 * body bob/lean. No claim of skeletal animation is made.
 */
export class ZombieCrowd {
  private readonly scene:THREE.Scene;
  private readonly batches=new Map<Family,FamilyBatch>();
  private readonly tracks=new Map<number,Track>();
  private readonly loader=new GLTFLoader();
  private readonly dummy=new THREE.Object3D();
  private readonly viewProj=new THREE.Matrix4();
  private readonly frustum=new THREE.Frustum();
  private readonly sphere=new THREE.Sphere(new THREE.Vector3(),2);
  private readonly tint=new THREE.Color();
  private readonly MAX=128;
  private readonly countPerFamily=new Map<Family,number>();
  private readonly baseFallback=new THREE.CapsuleGeometry(.29,1.18,3,6);
  private disposed=false;
  private elapsed=0;
  readonly assetsReady:Promise<void>;
  count=0;
  detailedCount=0;
  distantCount=0;

  constructor(scene:THREE.Scene){
    this.scene=scene;
    // Draw simple placeholders only until the validated custom assets finish loading.
    // Assets stay in use across all game waves and are not reloaded each snapshot.
    for(const family of FAMILIES)this.installBatch(family,
      this.baseFallback.clone(),
      new THREE.MeshStandardMaterial({color:family==='boss'?0x9a4248:0x67716c,roughness:.85}));
    this.assetsReady=this.loadAll();
  }

  private installBatch(family:Family,geometry:THREE.BufferGeometry,material:THREE.MeshStandardMaterial):void{
    const previous=this.batches.get(family);
    const mesh=new THREE.InstancedMesh(geometry,material,this.MAX);
    mesh.count=0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled=false;
    mesh.castShadow=false;
    mesh.receiveShadow=true;
    this.scene.add(mesh);
    this.batches.set(family,{mesh,geometry,material});
    if(previous){
      this.scene.remove(previous.mesh);
      previous.mesh.dispose();
      previous.geometry.dispose();
      previous.material.dispose();
    }
  }

  private static readVertexColor(mesh:THREE.Mesh,geometry:THREE.BufferGeometry):void{
    const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
    const source=material instanceof THREE.MeshStandardMaterial?material.color:new THREE.Color(0x8c8278);
    const count=geometry.getAttribute('position').count;
    const colors=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      colors[i*3]=source.r;colors[i*3+1]=source.g;colors[i*3+2]=source.b;
    }
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  }

  private geometryFromGlb(scene:THREE.Group, family:Family):THREE.BufferGeometry{
    scene.updateMatrixWorld(true);
    const meshes:THREE.Mesh[]=[];
    scene.traverse(n=>{if(n instanceof THREE.Mesh)meshes.push(n);});
    if(!meshes.length)throw new Error('Empty enemy GLB: '+family);
    const all:THREE.BufferGeometry[]=[];
    for(const mesh of meshes){
      const g=mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);
      if(!g.getAttribute('position')){g.dispose();continue;}
      // Merge into one stable vertex layout. We preserve original geometry
      // vertex colours when present and bake per-part PBR base colour otherwise.
      for(const name of Object.keys(g.attributes)){
        if(name!=='position'&&name!=='normal'&&name!=='color')g.deleteAttribute(name);
      }
      if(!g.getAttribute('normal'))g.computeVertexNormals();
      if(!g.getAttribute('color'))ZombieCrowd.readVertexColor(mesh,g);
      // Align texture-based GLB meshes and colour-only crowd GLBs in one batch.
      if(g.getAttribute('normal').itemSize!==3||g.getAttribute('color').itemSize!==3){
        g.dispose();continue;
      }
      all.push(g);
    }
    if(!all.length)throw new Error('No valid meshes in '+family);
    if(all.length===1)return all[0];
    // Boss originally contains 148 separate components; consolidate these
    // before render to keep Boss at ONE draw call rather than 148.
    const result=mergeGeometries(all,false);
    all.forEach(g=>g.dispose());
    if(!result)throw new Error('GLB geometry merge failed for '+family);
    return result;
  }

  private async loadAll():Promise<void>{
    await Promise.all(FAMILIES.map(async family=>{
      try{
        const gltf=await this.loader.loadAsync('/models/enemies/'+family+'.glb');
        const geometry=this.geometryFromGlb(gltf.scene,family);
        if(this.disposed){geometry.dispose();return;}
        const material=new THREE.MeshStandardMaterial({
          vertexColors:true,roughness:family==='boss'?.72:.91,metalness:.02,
          side:THREE.DoubleSide
        });
        this.installBatch(family,geometry,material);
      }catch(error){
        console.warn('[Enemies] original model unavailable, using fallback',family,error);
      }
    }));
  }

  receive(zombies:ZombieRecord[]):void{
    const active=new Set<number>();
    for(const zombie of zombies){
      active.add(zombie.id);
      const old=this.tracks.get(zombie.id);
      if(old)Object.assign(old,{tx:zombie.x,ty:zombie.y??0,tz:zombie.z,tf:zombie.facing,
        step:zombie.step,hp:zombie.hp,kind:zombie.kind});
      else this.tracks.set(zombie.id,{...zombie,y:zombie.y??0,tx:zombie.x,ty:zombie.y??0,
        tz:zombie.z,tf:zombie.facing});
    }
    for(const key of this.tracks.keys())if(!active.has(key))this.tracks.delete(key);
  }

  render(dt:number,camera:THREE.Camera,detailDistance=42,visibleDistance=115):void{
    if(this.disposed)return;
    const step=Math.max(0,Math.min(dt,.05));
    this.elapsed+=step;
    const alpha=1-Math.exp(-10*step);
    camera.updateMatrixWorld();
    this.viewProj.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.viewProj);
    for(const family of FAMILIES)this.countPerFamily.set(family,0);
    this.detailedCount=0;this.distantCount=0;
    const visibleSq=visibleDistance*visibleDistance;
    const detailSq=detailDistance*detailDistance;
    for(const zombie of this.tracks.values()){
      zombie.x=THREE.MathUtils.lerp(zombie.x,zombie.tx,alpha);
      zombie.y=THREE.MathUtils.lerp(zombie.y,zombie.ty,alpha);
      zombie.z=THREE.MathUtils.lerp(zombie.z,zombie.tz,alpha);
      zombie.facing+=Math.atan2(Math.sin(zombie.tf-zombie.facing),
        Math.cos(zombie.tf-zombie.facing))*alpha;

      const dx=zombie.x-camera.position.x,dy=zombie.y-camera.position.y,dz=zombie.z-camera.position.z;
      const distance=dx*dx+dy*dy+dz*dz;
      if(distance>visibleSq)continue;
      const family=FAMILY_OF[zombie.kind]??'walker';
      const height=HEIGHT[family];
      this.sphere.center.set(zombie.x,zombie.y+height*.5,zombie.z);
      this.sphere.radius=Math.max(1.3,height*.64);
      if(!this.frustum.intersectsSphere(this.sphere))continue;
      const index=this.countPerFamily.get(family)??0;
      if(index>=this.MAX)continue;
      const batch=this.batches.get(family)!;
      const phase=zombie.step*2+zombie.id*.23;
      const lean=Math.sin(phase)*(.018+(zombie.kind==='runner'?.035:0));
      const bob=Math.abs(Math.sin(phase))*(distance>detailSq?.008:.032);
      // Bounds of the authored GLBs already use Y=0 at the feet and -Z as front.
      this.dummy.position.set(zombie.x,zombie.y+bob,zombie.z);
      this.dummy.rotation.set(lean,zombie.facing,Math.sin(phase*.45)*.016);
      this.dummy.scale.setScalar(1);
      // Different infection phenotypes reuse the nearest existing original
      // anatomy until their own authored GLBs are available.
      if(zombie.kind==='juggernaut')this.dummy.scale.set(1.05,1.02,1.05);
      if(zombie.kind==='screamer')this.dummy.scale.set(.95,1.01,.95);
      this.dummy.updateMatrix();
      batch.mesh.setMatrixAt(index,this.dummy.matrix);
      this.tint.setHex(TINT[zombie.kind]??0xffffff);
      batch.mesh.setColorAt(index,this.tint);
      this.countPerFamily.set(family,index+1);
      if(distance<=detailSq)this.detailedCount++;
      else this.distantCount++;
    }
    this.count=this.detailedCount+this.distantCount;
    for(const family of FAMILIES){
      const mesh=this.batches.get(family)!.mesh;
      mesh.count=this.countPerFamily.get(family)??0;
      if(mesh.count){
        mesh.instanceMatrix.needsUpdate=true;
        if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      }
    }
  }

  dispose():void{
    this.disposed=true;
    this.tracks.clear();
    for(const batch of this.batches.values()){
      this.scene.remove(batch.mesh);
      batch.mesh.dispose();
      batch.geometry.dispose();
      batch.material.dispose();
    }
    this.batches.clear();
    this.baseFallback.dispose();
  }
}

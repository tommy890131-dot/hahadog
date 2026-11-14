import * as THREE from 'three';
import type { ZombieRecord } from '../network/Multiplayer';

type Track = ZombieRecord & {tx:number;ty:number;tz:number;tf:number};
type PartName = 'torso'|'jacket'|'head'|'hair'|'armL'|'armR'|'legL'|'legR'|'eyes';

/**
 * Visual LOD only: server-owned AI, damage, hitbox and navigation run for ALL zombies.
 * Within the near radius: nine articulated InstancedMesh batches.
 * Outside: two low-poly batches; beyond visibility/fog: no draw calls for the enemy.
 * Also tests the camera frustum to skip off-screen animation/matrix uploads.
 */
export class ZombieCrowd {
  private meshes: Record<PartName, THREE.InstancedMesh>;
  private distantBody: THREE.InstancedMesh;
  private distantHead: THREE.InstancedMesh;
  private readonly root = new THREE.Object3D();
  private readonly local = new THREE.Object3D();
  private readonly composed = new THREE.Matrix4();
  private readonly tracks = new Map<number, Track>();
  private readonly viewProj = new THREE.Matrix4();
  private readonly frustum = new THREE.Frustum();
  private readonly sphere = new THREE.Sphere(new THREE.Vector3(), 1.7);
  private readonly nearColors = [0x68756c, 0x7f746d, 0x657880, 0x6f7970].map(x=>new THREE.Color(x));
  private readonly jacketColors = [0x404f54, 0x504d44, 0x394948, 0x4b3e3e].map(x=>new THREE.Color(x));
  private readonly headColors = [0xb2bca9, 0x9f9d83, 0xb5a8a0, 0x9eac9c].map(x=>new THREE.Color(x));
  private readonly bruteColor = new THREE.Color(0x988878);
  private readonly runnerColor = new THREE.Color(0x808b80);
  private readonly specialColors:Record<string,THREE.Color> = {
    screamer:new THREE.Color(0xdfb05a),
    spitter:new THREE.Color(0x5bd183),
    climber:new THREE.Color(0x8f98d5),
    juggernaut:new THREE.Color(0xbb7f56),
    boss:new THREE.Color(0xde4b59),
  };
  private readonly MAX = 128;
  count = 0;
  detailedCount = 0;
  distantCount = 0;

  constructor(scene: THREE.Scene) {
    const standard=(hex:number)=>new THREE.MeshStandardMaterial({color:hex,roughness:.91,metalness:.02});
    const parts: {name:PartName;geometry:THREE.BufferGeometry;material:THREE.Material}[] = [
      {name:'torso',geometry:new THREE.CylinderGeometry(.29,.39,.98,9),material:standard(0x727c72)},
      {name:'jacket',geometry:new THREE.BoxGeometry(.72,.28,.38),material:standard(0x3b4d50)},
      {name:'head',geometry:new THREE.SphereGeometry(.24,10,8),material:standard(0x9ba68c)},
      {name:'hair',geometry:new THREE.SphereGeometry(.255,9,6,0,Math.PI*2,0,Math.PI*.36),material:standard(0x292c2a)},
      {name:'armL',geometry:new THREE.CylinderGeometry(.12,.105,.88,7),material:standard(0x636b67)},
      {name:'armR',geometry:new THREE.CylinderGeometry(.12,.105,.88,7),material:standard(0x636b67)},
      {name:'legL',geometry:new THREE.CylinderGeometry(.155,.12,.83,7),material:standard(0x3d484c)},
      {name:'legR',geometry:new THREE.CylinderGeometry(.155,.12,.83,7),material:standard(0x3d484c)},
      {name:'eyes',geometry:new THREE.BoxGeometry(.20,.04,.04),material:new THREE.MeshBasicMaterial({color:0x7a1e17})}
    ];
    this.meshes = {} as Record<PartName,THREE.InstancedMesh>;
    for(const p of parts) {
      const mesh = new THREE.InstancedMesh(p.geometry,p.material,this.MAX);
      mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled=false;scene.add(mesh);this.meshes[p.name]=mesh;
    }
    this.distantBody = new THREE.InstancedMesh(new THREE.CylinderGeometry(.29,.4,1.25,5),standard(0x5b6a66),this.MAX);
    this.distantHead = new THREE.InstancedMesh(new THREE.SphereGeometry(.23,6,4),standard(0x969b8b),this.MAX);
    for(const m of [this.distantBody,this.distantHead]) {
      m.count=0;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;scene.add(m);
    }
  }

  receive(zombies:ZombieRecord[]):void {
    const next = new Set<number>();
    for(const z of zombies){
      next.add(z.id);
      const old=this.tracks.get(z.id);
      if(old)Object.assign(old,{tx:z.x,ty:z.y??0,tz:z.z,tf:z.facing,step:z.step,hp:z.hp,kind:z.kind});
      else this.tracks.set(z.id,{...z,y:z.y??0,tx:z.x,ty:z.y??0,tz:z.z,tf:z.facing});
    }
    for(const id of this.tracks.keys())if(!next.has(id))this.tracks.delete(id);
  }

  render(dt:number,camera:THREE.Camera,detailDistance=42,visibleDistance=115):void {
    const alpha=1-Math.exp(-10*Math.min(dt,.05));
    camera.updateMatrixWorld();
    this.viewProj.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.viewProj);
    const detailSq=detailDistance*detailDistance;
    const visibleSq=visibleDistance*visibleDistance;
    let index=0,farIndex=0;

    const place=(name:PartName,x:number,y:number,z:number,rx=0,ry=0,rz=0)=>{
      this.local.position.set(x,y,z);
      this.local.rotation.set(rx,ry,rz);
      this.local.scale.set(1,1,1);
      this.local.updateMatrix();
      this.composed.multiplyMatrices(this.root.matrix,this.local.matrix);
      this.meshes[name].setMatrixAt(index,this.composed);
    };

    for(const z of this.tracks.values()){
      if(index+farIndex>=this.MAX)break;
      z.x=THREE.MathUtils.lerp(z.x,z.tx,alpha);
      z.y=THREE.MathUtils.lerp(z.y,z.ty,alpha);
      z.z=THREE.MathUtils.lerp(z.z,z.tz,alpha);
      z.facing+=Math.atan2(Math.sin(z.tf-z.facing),Math.cos(z.tf-z.facing))*alpha;
      const dx=z.x-camera.position.x,dy=z.y-camera.position.y,dz=z.z-camera.position.z;
      const distSq=dx*dx+dy*dy+dz*dz;
      if(distSq>visibleSq)continue;
      this.sphere.center.set(z.x,z.y+1.15,z.z);
      if(!this.frustum.intersectsSphere(this.sphere))continue;

      const brute=z.kind==='brute'||z.kind==='juggernaut'||z.kind==='boss';
      const scale=z.kind==='boss'?2.15:z.kind==='juggernaut'?1.5:brute?1.29:z.kind==='runner'||z.kind==='climber'?.9:1;
      if(distSq>detailSq){
        this.root.position.set(z.x,z.y,z.z);
        this.root.rotation.set(0,z.facing,0);
        this.root.scale.set(scale,brute?1.25:1,scale);
        this.root.updateMatrix();
        this.local.rotation.set(0,0,0);this.local.scale.set(1,1,1);
        this.local.position.set(0,.89,0);this.local.updateMatrix();
        this.composed.multiplyMatrices(this.root.matrix,this.local.matrix);
        this.distantBody.setMatrixAt(farIndex,this.composed);
        this.local.position.set(0,1.66,-.03);this.local.updateMatrix();
        this.composed.multiplyMatrices(this.root.matrix,this.local.matrix);
        this.distantHead.setMatrixAt(farIndex,this.composed);
        farIndex++;
        continue;
      }

      const swing=Math.sin(z.step*2+z.id*.29)*(z.kind==='runner'?.48:.33);
      const bob=Math.abs(Math.sin(z.step*2))*.038;
      this.root.position.set(z.x,z.y+bob,z.z);
      this.root.rotation.set(0,z.facing,brute?-.045:.04*Math.sin(z.step*.7));
      this.root.scale.set(scale,brute?1.25:1,brute?1.18:1);
      this.root.updateMatrix();
      place('torso',0,1.05,0,.06);
      place('jacket',0,1.39,-.02,0,0,.03);
      place('head',0,1.79,-.035,.09);
      place('hair',0,1.85,-.038,.09);
      place('eyes',0,1.77,-.265);
      place('armL',-.44,1.08,-.12,swing-.4,0,-.20);
      place('armR',.44,1.08,-.12,-swing-.4,0,.17);
      place('legL',-.175,.41,0,-swing,0,.02);
      place('legR',.175,.41,0,swing,0,-.02);
      this.meshes.torso.setColorAt(index,this.specialColors[z.kind]??(brute?this.bruteColor:z.kind==='runner'?this.runnerColor:this.nearColors[z.id%4]));
      this.meshes.jacket.setColorAt(index,this.jacketColors[z.id%4]);
      this.meshes.head.setColorAt(index,this.specialColors[z.kind]??this.headColors[z.id%4]);
      index++;
    }
    this.detailedCount=index;
    this.distantCount=farIndex;
    this.count=index+farIndex;
    for(const mesh of Object.values(this.meshes)){
      mesh.count=index;
      if(index){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
    }
    for(const mesh of [this.distantBody,this.distantHead]){
      mesh.count=farIndex;
      if(farIndex)mesh.instanceMatrix.needsUpdate=true;
    }
  }
}

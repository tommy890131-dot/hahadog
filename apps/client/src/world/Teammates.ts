import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {PlayerRecord} from '../network/Multiplayer';

export type SurvivorClass='assault'|'medic'|'engineer'|'recon';
const CLASSES:readonly SurvivorClass[]=['assault','medic','engineer','recon'];
export function playerClass(value:string|undefined):SurvivorClass{
  return CLASSES.includes(value as SurvivorClass)?value as SurvivorClass:'assault';
}
type Template={geometry:THREE.BufferGeometry;material:THREE.MeshStandardMaterial};
type Remote={
  body:THREE.Group;
  fallback:THREE.Mesh;
  model:THREE.Mesh|null;
  kind:SurvivorClass;
  target:PlayerRecord;
  walking:number;
};

/** Original static H17 survivors: one merged draw call per visible teammate,
 * rather than the 116–139 separate meshes present in each source GLB.
 * Model units are meters, forward local -Z, feet at world Y=0.
 */
export class Teammates {
  private readonly avatars=new Map<string,Remote>();
  private readonly loader=new GLTFLoader();
  private readonly templates=new Map<SurvivorClass,Template>();
  private readonly fallbackGeometry=new THREE.CapsuleGeometry(.31,1.15,5,8);
  private readonly fallbackMaterial=new THREE.MeshStandardMaterial({color:0x47718b,roughness:.85});
  private disposed=false;

  constructor(private readonly scene:THREE.Scene){
    void Promise.all(CLASSES.map(kind=>this.load(kind)));
  }
  private async load(kind:SurvivorClass):Promise<void>{
    try{
      const gltf=await this.loader.loadAsync('/models/players/'+kind+'.glb');
      const segments:THREE.BufferGeometry[]=[];
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(node=>{
        if(!(node instanceof THREE.Mesh))return;
        const g=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();
        g.applyMatrix4(node.matrixWorld);
        if(!g.getAttribute('position')){g.dispose();return;}
        for(const attr of Object.keys(g.attributes))
          if(!['position','normal','color'].includes(attr))g.deleteAttribute(attr);
        if(!g.getAttribute('normal'))g.computeVertexNormals();
        const colors=g.getAttribute('color'),verts=g.getAttribute('position').count;
        if(!colors || colors.itemSize!==3){
          const material=Array.isArray(node.material)?node.material[0]:node.material;
          const color=material instanceof THREE.MeshStandardMaterial?material.color:new THREE.Color(0x8a857c);
          const values=new Float32Array(verts*3);
          for(let i=0;i<verts;i++){
            values[i*3]=colors?colors.getX(i):color.r;
            values[i*3+1]=colors?colors.getY(i):color.g;
            values[i*3+2]=colors?colors.getZ(i):color.b;
          }
          g.setAttribute('color',new THREE.Float32BufferAttribute(values,3));
        }
        segments.push(g);
      });
      const geometry=mergeGeometries(segments,false);
      segments.forEach(g=>g.dispose());
      if(!geometry)throw Error('Unable to merge '+kind+' character mesh');
      if(this.disposed){geometry.dispose();return;}
      const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.87,metalness:.025});
      this.templates.set(kind,{geometry,material});
      for(const avatar of this.avatars.values())
        if(avatar.kind===kind)this.applyModel(avatar);
    }catch(err){console.warn('[Survivors] Model fallback',kind,err);}
  }
  private applyModel(remote:Remote):void{
    if(remote.model){remote.body.remove(remote.model);remote.model=null;}
    const template=this.templates.get(remote.kind);
    if(!template){remote.fallback.visible=true;return;}
    const mesh=new THREE.Mesh(template.geometry,template.material);
    mesh.receiveShadow=true;mesh.castShadow=false;
    remote.body.add(mesh);remote.model=mesh;remote.fallback.visible=false;
  }
  receive(players:PlayerRecord[],ownId:string):void{
    const active=new Set<string>();
    for(const p of players){
      if(p.id===ownId)continue;
      active.add(p.id);
      const kind=playerClass(p.classId);
      let remote=this.avatars.get(p.id);
      if(!remote){
        const root=new THREE.Group();
        const fallback=new THREE.Mesh(this.fallbackGeometry,this.fallbackMaterial);
        fallback.position.y=1;root.add(fallback);
        root.position.set(p.x,p.y??0,p.z);
        this.scene.add(root);
        remote={body:root,fallback,model:null,kind,target:p,walking:0};
        this.avatars.set(p.id,remote);this.applyModel(remote);
      }else{
        remote.target=p;
        if(remote.kind!==kind){remote.kind=kind;this.applyModel(remote);}
      }
    }
    for(const [id,remote] of this.avatars){
      if(active.has(id))continue;
      this.scene.remove(remote.body);this.avatars.delete(id);
    }
  }
  render(dt:number):void{
    const step=Math.min(Math.max(dt,0),.06),alpha=1-Math.exp(-11*step);
    for(const r of this.avatars.values()){
      const p=r.target;
      const nextX=THREE.MathUtils.lerp(r.body.position.x,p.x,alpha);
      const nextZ=THREE.MathUtils.lerp(r.body.position.z,p.z,alpha);
      const distance=Math.hypot(nextX-r.body.position.x,nextZ-r.body.position.z);
      const moving=distance>.003&&!p.downed;
      r.walking+=moving?step*8:0;
      r.body.position.x=nextX;r.body.position.z=nextZ;
      r.body.position.y=THREE.MathUtils.lerp(r.body.position.y,p.y??0,alpha);
      // Client's player yaw is encoded from camera direction by atan2(+X,-Z)
      // while original GLBs face -Z; negate yaw only for the character art.
      const visualYaw=-p.yaw;
      r.body.rotation.y+=Math.atan2(Math.sin(visualYaw-r.body.rotation.y),
        Math.cos(visualYaw-r.body.rotation.y))*alpha;
      r.body.scale.y=THREE.MathUtils.damp(r.body.scale.y,p.downed?.5:1,12,step);
      if(r.model){
        // Original four GLBs have no Skin or AnimationClips. Restrained
        // visual bob is a temporary fallback, not skeletal animation.
        r.model.position.y=moving?Math.abs(Math.sin(r.walking))*.023:0;
        r.model.rotation.z=moving?Math.sin(r.walking)*.012:0;
      }
    }
  }
  dispose():void{
    this.disposed=true;
    for(const remote of this.avatars.values())this.scene.remove(remote.body);
    this.avatars.clear();
    for(const t of this.templates.values()){t.geometry.dispose();t.material.dispose();}
    this.templates.clear();this.fallbackGeometry.dispose();this.fallbackMaterial.dispose();
  }
}

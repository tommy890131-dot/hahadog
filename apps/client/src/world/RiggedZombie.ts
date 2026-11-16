import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export type RigFamily='walker'|'runner'|'brute'|'spitter'|'boss';
const RIG_FILES:Record<RigFamily,string>={
  walker:'walker-rig',runner:'runner-rig',brute:'brute-rig',
  spitter:'spitter-rig',boss:'boss'
};
export type EnemyPose={id:number;x:number;y:number;z:number;facing:number;step:number;kind:string;moving?:boolean;attacking?:boolean};
type RigTemplate={geometry:THREE.BufferGeometry;material:THREE.MeshStandardMaterial;height:number};
type BoneName='hips'|'spine'|'head'|'armL'|'foreL'|'armR'|'foreR'|'legL'|'shinL'|'legR'|'shinR';
const BONES:BoneName[]=['hips','spine','head','armL','foreL','armR','foreR','legL','shinL','legR','shinR'];

function limbFromName(name:string):BoneName{
  const n=name.toLowerCase();
  const isBoss=!n.startsWith('walker_')&&!n.startsWith('runner_')&&!n.startsWith('brute_')&&!n.startsWith('spitter_');
  const left=isBoss?/left|_-1|^-1_/i.test(n):/_l\b|_-1\b/.test(n);
  const right=isBoss?/right|_1\b|^1_/.test(n):/_r\b|_1\b/.test(n);
  const lowerArm=/forearm|elbow|hand|palm|finger|thumb|glove|arm_guard|forearm_guard/.test(n);
  const upperArm=/upper_arm|deltoid|biceps|shoulder|pauldron|sleeve/.test(n);
  if((left||right)&&lowerArm)return left?'foreL':'foreR';
  if((left||right)&&upperArm)return left?'armL':'armR';
  const lowerLeg=/shin|knee|boot|sole|trouser_shin|lace/.test(n);
  const upperLeg=/thigh|trouser_thigh/.test(n);
  if((left||right)&&lowerLeg)return left?'shinL':'shinR';
  if((left||right)&&upperLeg)return left?'legL':'legR';
  if(/head|neck|jaw|chin|mouth|cheek|eye|brow|nose|tooth|visor|helmet|face|cranium|upper_throat|oral_duct|throat_bulb/.test(n))return 'head';
  if(/pelvis|waist|belt|hip/.test(n))return 'hips';
  return 'spine';
}
function asColour(mesh:THREE.Mesh):THREE.Color{
  const m=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
  return m instanceof THREE.MeshStandardMaterial?m.color:new THREE.Color(0x8b8478);
}
/**
 * Create actual GPU skeletal skinning from the original disconnected H17
 * body-piece GLBs. Each original part is rigidly weighted to its anatomical
 * bone, preserving authored mesh surface and silhouette.
 * Pose updates animate the 11 bones, not just whole-body bob/rotation.
 */
function buildTemplate(scene:THREE.Group, family:RigFamily):RigTemplate{
  scene.updateMatrixWorld(true);
  const height=family==='boss'?3.41:family==='brute'?2.7:family==='spitter'?2.25:family==='runner'?1.94:1.84;
  const fragments:THREE.BufferGeometry[]=[];
  let vertices=0;
  scene.traverse(node=>{
    if(!(node instanceof THREE.Mesh))return;
    const source=node.geometry as THREE.BufferGeometry;
    if(!source.getAttribute('position'))return;
    const g=source.index?source.toNonIndexed():source.clone();
    g.applyMatrix4(node.matrixWorld);
    if(!g.getAttribute('normal'))g.computeVertexNormals();
    for(const key of Object.keys(g.attributes))
      if(key!=='position'&&key!=='normal'&&key!=='color')g.deleteAttribute(key);
    const positions=g.getAttribute('position');
    const c=g.getAttribute('color');
    if(!c||c.itemSize!==3){
      const tint=asColour(node);
      const colors=new Float32Array(positions.count*3);
      for(let i=0;i<positions.count;i++){
        colors[i*3]=c?c.getX(i):tint.r;
        colors[i*3+1]=c?c.getY(i):tint.g;
        colors[i*3+2]=c?c.getZ(i):tint.b;
      }
      g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    }
    const boneIndex=BONES.indexOf(limbFromName(node.name));
    const indices=new Uint16Array(positions.count*4);
    const weights=new Float32Array(positions.count*4);
    for(let i=0;i<positions.count;i++){indices[i*4]=boneIndex;weights[i*4]=1;}
    g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
    g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
    fragments.push(g);vertices+=positions.count;
  });
  if(!fragments.length)throw Error('No riggable meshes in '+family);
  const geometry=mergeGeometries(fragments,false);
  fragments.forEach(g=>g.dispose());
  if(!geometry)throw Error('Failed to merge rig geometry '+family);
  geometry.computeBoundingSphere();
  const material=new THREE.MeshStandardMaterial({
    color:0xffffff,vertexColors:true,roughness:family==='boss'?.72:.91,
    metalness:.02,side:THREE.DoubleSide,skinning:true
  } as THREE.MeshStandardMaterialParameters);
  console.info('[EnemyRig]',family,'parts=',fragments.length,'vertices=',vertices);
  return {geometry,material,height};
}
function createBones(height:number):{root:THREE.Bone;bones:THREE.Bone[];lookup:Record<BoneName,THREE.Bone>}{
  const lookup={} as Record<BoneName,THREE.Bone>;
  for(const name of BONES){const bone=new THREE.Bone();bone.name=name;lookup[name]=bone;}
  const hip=height*.53;
  lookup.hips.position.set(0,hip,0);
  lookup.spine.position.set(0,height*.16,0);
  lookup.head.position.set(0,height*.24,0);
  lookup.hips.add(lookup.spine);lookup.spine.add(lookup.head);
  for(const [side,sign] of [['L',-1],['R',1]] as const){
    const upper=lookup[('arm'+side) as BoneName];
    const fore=lookup[('fore'+side) as BoneName];
    upper.position.set(sign*height*.18,height*.05,0);
    fore.position.set(sign*height*.07,-height*.15,0);
    lookup.spine.add(upper);upper.add(fore);
    const leg=lookup[('leg'+side) as BoneName];
    const shin=lookup[('shin'+side) as BoneName];
    leg.position.set(sign*height*.10,-height*.06,0);
    shin.position.set(0,-height*.23,0);
    lookup.hips.add(leg);leg.add(shin);
  }
  return {root:lookup.hips,bones:BONES.map(n=>lookup[n]),lookup};
}
export class AnimatedEnemy {
  readonly mesh:THREE.SkinnedMesh;
  private readonly bones:Record<BoneName,THREE.Bone>;
  private attackBlend=0;
  private motion=0;
  private readonly seed:number;
  constructor(readonly family:RigFamily, template:RigTemplate, seed=0){
    this.seed=seed;
    this.mesh=new THREE.SkinnedMesh(template.geometry,template.material);
    const {root,bones,lookup}=createBones(template.height);
    this.mesh.add(root);
    this.mesh.bind(new THREE.Skeleton(bones));
    this.mesh.frustumCulled=false;
    this.mesh.castShadow=false;
    this.mesh.receiveShadow=true;
    this.bones=lookup;
  }
  update(p:EnemyPose,dt:number):void{
    const t=Math.min(Math.max(dt,0),.06);
    this.mesh.position.set(p.x,p.y,p.z);
    this.mesh.rotation.y=p.facing;
    const running=p.kind==='runner'||p.kind==='climber';
    const goal=p.moving===false?0:1;
    this.motion=THREE.MathUtils.damp(this.motion,goal,9,t);
    this.attackBlend=THREE.MathUtils.damp(this.attackBlend,p.attacking?1:0,12,t);
    const phase=p.step*2+this.seed*.17;
    const stride=Math.sin(phase)*(running?.60:.34)*this.motion;
    const counter=Math.sin(phase+Math.PI);
    const b=this.bones;
    b.legL.rotation.x=stride;
    b.legR.rotation.x=-stride;
    b.shinL.rotation.x=Math.max(0,-stride)*.55;
    b.shinR.rotation.x=Math.max(0,stride)*.55;
    b.armL.rotation.x=-stride*.55-this.attackBlend*.95;
    b.armR.rotation.x=stride*.55-this.attackBlend*.95;
    b.foreL.rotation.x=-this.attackBlend*.42;
    b.foreR.rotation.x=-this.attackBlend*.42;
    b.spine.rotation.x=.04+Math.sin(phase)*.045*this.motion+.2*this.attackBlend;
    b.spine.rotation.z=Math.sin(phase*.5)*.045*this.motion;
    b.head.rotation.x=Math.sin(phase*.7)*.032-.16*this.attackBlend;
    b.hips.rotation.y=Math.sin(phase)*.04*this.motion;
    // Rotate legs around anatomical joint positions while preserving feet
    // height through small whole-body compensation on stride.
    b.hips.position.y=(this.family==='boss'?3.41:this.family==='brute'?2.7:this.family==='spitter'?2.25:this.family==='runner'?1.94:1.84)*.53+
      Math.abs(counter)*.015*this.motion;
    this.mesh.updateMatrixWorld();
  }
  dispose():void{
    this.mesh.skeleton.dispose();
  }
}
export class RiggedEnemyLibrary {
  private readonly loader=new GLTFLoader();
  private readonly templates=new Map<RigFamily,RigTemplate>();
  private readonly pending=new Map<RigFamily,Promise<void>>();
  constructor(private readonly scene:THREE.Scene){}
  ready():Promise<void>{
    return Promise.all((Object.keys(RIG_FILES) as RigFamily[]).map(f=>this.load(f))).then(()=>{});
  }
  private load(family:RigFamily):Promise<void>{
    const previous=this.pending.get(family);if(previous)return previous;
    const promise=this.loader.loadAsync('/models/enemies/'+RIG_FILES[family]+'.glb')
      .then(gltf=>{this.templates.set(family,buildTemplate(gltf.scene,family));})
      .catch(error=>console.warn('[EnemyRig] Loading failed for '+family,error));
    this.pending.set(family,promise);
    return promise;
  }
  create(family:RigFamily,id:number):AnimatedEnemy|null{
    const template=this.templates.get(family);if(!template)return null;
    const enemy=new AnimatedEnemy(family,template,id);
    this.scene.add(enemy.mesh);
    return enemy;
  }
  remove(enemy:AnimatedEnemy):void{
    this.scene.remove(enemy.mesh);enemy.dispose();
  }
  dispose():void{
    for(const v of this.templates.values()){v.geometry.dispose();v.material.dispose();}
    this.templates.clear();
  }
}

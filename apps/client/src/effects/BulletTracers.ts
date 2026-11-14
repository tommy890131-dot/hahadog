import * as THREE from 'three';

export type ShotPoint = Readonly<{x:number;y:number;z:number}>;
type Trail = { from:THREE.Vector3; direction:THREE.Vector3; distance:number; age:number; travel:number; color:THREE.Color };
/**
 * Shared instanced tracer renderer. One draw call for up to 36 shots,
 * with real movement along each server-confirmed hitscan trajectory.
 * Tracers are VISUAL ONLY and cannot apply damage.
 */
export class BulletTracers {
  private readonly max=36;
  private readonly trails:Trail[]=[];
  private readonly mesh:THREE.InstancedMesh;
  private readonly geometry=new THREE.BoxGeometry(.034,.034,1);
  private readonly material=new THREE.MeshBasicMaterial({color:0xffffff,vertexColors:false,transparent:true,opacity:.88,depthWrite:false,toneMapped:false});
  private readonly dummy=new THREE.Object3D();
  private readonly axis=new THREE.Vector3(0,0,1);
  private readonly start=new THREE.Vector3();
  private readonly end=new THREE.Vector3();
  private readonly amber=new THREE.Color(0xffdb82);
  private readonly turret=new THREE.Color(0xff9d44);

  constructor(private readonly scene:THREE.Scene){
    this.mesh=new THREE.InstancedMesh(this.geometry,this.material,this.max);
    this.mesh.count=0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled=false;
    this.mesh.renderOrder=5;
    this.scene.add(this.mesh);
  }
  spawn(from:ShotPoint,to:ShotPoint,kind:'gun'|'turret'='gun'):boolean{
    const coords=[from.x,from.y,from.z,to.x,to.y,to.z];
    if(!coords.every(Number.isFinite))return false;
    this.start.set(from.x,from.y,from.z);
    this.end.set(to.x,to.y,to.z);
    const distance=this.start.distanceTo(this.end);
    if(distance<.1||distance>125)return false;
    if(this.trails.length>=this.max)this.trails.shift();
    this.trails.push({
      from:this.start.clone(),
      direction:this.end.clone().sub(this.start).normalize(),
      distance,age:0,travel:Math.max(.035,distance/165),
      color:(kind==='turret'?this.turret:this.amber).clone()
    });
    return true;
  }
  update(dt:number):void{
    const step=THREE.MathUtils.clamp(Number.isFinite(dt)?dt:0,0,.06);
    for(let i=this.trails.length-1;i>=0;i--){
      this.trails[i].age+=step;
      if(this.trails[i].age>this.trails[i].travel+.09)this.trails.splice(i,1);
    }
    for(let i=0;i<this.trails.length;i++){
      const shot=this.trails[i];
      const tip=Math.min(shot.distance,shot.age/shot.travel*shot.distance);
      const tail=Math.max(0,tip-Math.min(6,shot.distance*.23));
      const length=Math.max(.02,tip-tail);
      this.dummy.position.copy(shot.from).addScaledVector(shot.direction,(tip+tail)*.5);
      this.dummy.quaternion.setFromUnitVectors(this.axis,shot.direction);
      this.dummy.scale.set(1,1,length);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i,this.dummy.matrix);
      this.mesh.setColorAt(i,shot.color);
    }
    this.mesh.count=this.trails.length;
    if(this.mesh.count){
      this.mesh.instanceMatrix.needsUpdate=true;
      if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;
    }
  }
  dispose():void{
    this.scene.remove(this.mesh);
    this.trails.length=0;
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}

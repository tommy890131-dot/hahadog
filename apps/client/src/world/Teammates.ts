import * as THREE from 'three';
import type { PlayerRecord } from '../network/Multiplayer';
interface Remote { body:THREE.Group; target:PlayerRecord; }
export class Teammates {
  private avatars = new Map<string,Remote>();
  constructor(private scene:THREE.Scene){}
  receive(players:PlayerRecord[],ownId:string){
    const alive=new Set<string>();
    for(const p of players){
      if(p.id===ownId)continue;
      alive.add(p.id);
      let remote=this.avatars.get(p.id);
      if(!remote){
        const root=new THREE.Group();
        const coat=new THREE.Mesh(new THREE.CapsuleGeometry(.31,1.15,5,8),new THREE.MeshStandardMaterial({color:0x47718b,roughness:.85}));
        coat.position.y=1;root.add(coat);
        const face=new THREE.Mesh(new THREE.SphereGeometry(.26,10,8),new THREE.MeshStandardMaterial({color:0xb39d80,roughness:.9}));
        face.position.y=1.73;root.add(face);
        root.position.set(p.x,p.y??0,p.z);this.scene.add(root);
        remote={body:root,target:p};this.avatars.set(p.id,remote);
      }else remote.target=p;
    }
    for(const [id,avatar] of this.avatars)if(!alive.has(id)){
      this.scene.remove(avatar.body);this.avatars.delete(id);
    }
  }
  render(dt:number){
    const blend=1-Math.exp(-11*dt);
    for(const {body,target} of this.avatars.values()){
      body.position.x=THREE.MathUtils.lerp(body.position.x,target.x,blend);
      body.position.z=THREE.MathUtils.lerp(body.position.z,target.z,blend);
      body.position.y=THREE.MathUtils.lerp(body.position.y,target.y??0,blend);
      const d=Math.atan2(Math.sin(target.yaw-body.rotation.y),Math.cos(target.yaw-body.rotation.y));
      body.rotation.y+=d*blend;
      body.scale.y=target.downed?.5:1;
    }
  }
}

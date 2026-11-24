import * as THREE from 'three';
import {METRO_BOXES} from '../../../../v313/MetroMap.mjs';

const steel=(color:number,emissive=0)=>new THREE.MeshStandardMaterial({
  color,emissive,emissiveIntensity:emissive?.35:0,roughness:.72,metalness:.2
});
/** Entire metro environment lives in a separate root for inexpensive chapter switching. */
export class MetroScene {
  readonly group=new THREE.Group();
  readonly blockers:THREE.Object3D[]=[];
  readonly keyLight:THREE.DirectionalLight;
  private readonly geometries:THREE.BufferGeometry[]=[];
  private readonly materials:THREE.Material[]=[];
  constructor(scene:THREE.Scene){
    this.group.name='DEADLINE FOUR - Underground Metro';
    const concrete=steel(0x434d51),paint=steel(0x57636c);
    const rails=steel(0x59616b),trainColor=steel(0x4d6972),glass=steel(0x10242c,1);
    const yellow=steel(0xbe9958,0.7),red=steel(0xc73e37,1.8);
    this.materials.push(concrete,paint,rails,trainColor,glass,yellow,red);
    const block=(x:number,y:number,z:number,w:number,h:number,d:number,
      mat:THREE.MeshStandardMaterial,collider=false)=>{
      const geometry=new THREE.BoxGeometry(w,h,d);
      this.geometries.push(geometry);
      const mesh=new THREE.Mesh(geometry,mat);
      mesh.position.set(x,y,z);mesh.receiveShadow=true;
      mesh.castShadow=collider&&h>1;
      this.group.add(mesh);if(collider)this.blockers.push(mesh);
      return mesh;
    };
    // Real playable platform / rail channel: the rails are recessed visually,
    // while shared collision stays on the flat station datum.
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(165,56),concrete);
    floor.rotation.x=-Math.PI/2;floor.position.y=-.025;floor.receiveShadow=true;
    this.group.add(floor);this.geometries.push(floor.geometry);
    block(0,-.015,-2,158,.025,7,steel(0x222d35)); // track gravel
    block(0,.05,7,158,.06,1.2,yellow);
    block(0,.05,-7,158,.06,1.2,yellow);
    for(const z of [-.7,4.7])block(0,.018,z,153,.09,.17,rails);
    for(let x=-77;x<78;x+=2.4)block(x,.023,2,1.25,.07,5.8,steel(0x4a4846));
    // Flat ceiling and corridor lights.
    block(0,5.85,0,164,.18,56,steel(0x202d33));
    for(const box of METRO_BOXES){
      let mat=box.role==='wall'?concrete:box.role==='column'?paint:
        box.role==='train'?trainColor:box.role==='gate'?rails:steel(0x676a68);
      block(box.x,box.y,box.z,box.w,box.h,box.d,mat,true);
    }
    // Train windows and sliding doors are surface detail only.
    for(const [x,width] of [[19,31],[39,8]] as const){
      const start=x-width/2+.8;
      for(let xx=start;xx<x+width/2-.7;xx+=2.2){
        for(const zz of [-1.075,5.075]){
          block(xx,2.14,zz,1.25,.75,.035,glass);
          block(xx,1.35,zz,1.25,.055,.045,yellow);
        }
      }
    }
    for(let x=-72;x<73;x+=9){
      for(const z of [-24,24]){
        block(x,5.55,z,5.5,.16,.34,yellow);
        block(x,5.48,z,4.5,.03,.23,steel(0xd8e8ef,1.2));
      }
    }
    // Station name signs, aid points, tunnel arrow.
    for(const [x,z] of [[-64,-25],[-22,-25],[23,-25],[64,25]] as const){
      block(x,3.7,z,7.4,1.15,.12,steel(0x123b50,1));
      block(x,3.7,z+.1,5,.18,.13,yellow);
    }
    // Visible service consoles at the exact authoritative trigger positions.
    for(const [x,z] of [[-32,-19],[-10,-22],[54,-16]] as const){
      block(x,.9,z,.9,1.8,.55,paint);
      block(x,1.62,z-.05,.68,.37,.12,red);
    }
    // Safehouse entrance and the train boarding end, far from central station.
    for(const x of [-69,67]){
      block(x,.06,-14,9,.1,9,steel(0x1e5d5a,.9));
      const light=new THREE.PointLight(x<0?0x45f5c5:0xffa65a,3.4,16,2);
      light.position.set(x,3,-14);this.group.add(light);
    }
    this.keyLight=new THREE.DirectionalLight(0x7995a6,.6);
    this.keyLight.position.set(20,28,-10);
    this.group.add(this.keyLight);
    const ambient=new THREE.HemisphereLight(0x9fc8d1,0x1d252a,.30);
    this.group.add(ambient);
    const fixtures=[[-65,-22],[-34,-22],[-3,-22],[29,-22],[56,-22],
      [-65,22],[-34,22],[-3,22],[29,22],[56,22]];
    for(const [x,z] of fixtures){
      const lamp=new THREE.PointLight(0xb2d9e8,1.8,21,2);
      lamp.position.set(x,5.1,z);this.group.add(lamp);
    }
    this.group.visible=false;
    scene.add(this.group);
  }
  setVisible(visible:boolean):void{this.group.visible=visible;}
  dispose():void{
    this.group.removeFromParent();
    for(const geometry of this.geometries)geometry.dispose();
    for(const mat of this.materials)mat.dispose();
  }
}

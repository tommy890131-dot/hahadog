import * as THREE from 'three';
import {FACILITY_MAPS} from '../../../../v314/FacilityMaps.mjs';
import {detailHospital,detailHarbor,type EnvironmentDetailKit} from './EnvironmentDetailKit';

type FacilityId='infected_hospital'|'doomed_harbor';

/** Original game-scale hospital and port geometry. Entire chapter is hidden
 * between levels; instanced walls, props and fixtures keep draw calls bounded. */
export class FacilityScene {
 readonly group=new THREE.Group();
 readonly blockers:THREE.Object3D[]=[];
 private readonly geometries:THREE.BufferGeometry[]=[];
 private detailKit!:EnvironmentDetailKit;
 private readonly materials:THREE.Material[]=[];
 private readonly lights:THREE.Light[]=[];
 constructor(scene:THREE.Scene,readonly mapId:FacilityId){
   const map=FACILITY_MAPS[mapId];
   this.group.name='DEADLINE FOUR / '+mapId;
   const mat=(color:number,emissive=0)=>{
     const material=new THREE.MeshStandardMaterial({color,emissive,
       emissiveIntensity:emissive?0.4:0,roughness:.82,metalness:.14});
     this.materials.push(material);return material;
   };
   const concrete=mat(map.theme==='hospital'?0x5c676c:0x4b5963),
     steel=mat(0x47525d),bedding=mat(0x8d9b9a),
     red=mat(0x994b42,0x36130c),pale=mat(0xb5c8c4,0x17221e),
     yellow=mat(0xad925c,0x241c0b),sea=mat(0x142b34);
   const groundGeo=new THREE.PlaneGeometry(map.ground.w,map.ground.d);
   this.geometries.push(groundGeo);
   const floor=new THREE.Mesh(groundGeo,map.theme==='hospital'?concrete:steel);
   floor.rotation.x=-Math.PI/2;floor.position.y=-.02;floor.receiveShadow=true;
   this.group.add(floor);
   const geo=new THREE.BoxGeometry(1,1,1);this.geometries.push(geo);
   const batches=new Map<THREE.Material,THREE.Matrix4[]>();
   const groupBy=(material:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{
     const m=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),
       new THREE.Quaternion(),new THREE.Vector3(w,h,d));
     const list=batches.get(material)??[];list.push(m);batches.set(material,list);
   };
   const mapMat=(role:string):THREE.Material=>{
     if(role==='wall')return concrete;
     if(role==='bed'||role==='surgery')return bedding;
     if(role==='container')return role=== 'container'?yellow:steel;
     if(role==='desk'||role==='cabinet'||role==='gate')return pale;
     if(role==='crane')return red;
     return steel;
   };
   for(const b of map.boxes){
     groupBy(mapMat(b.role),b.x,b.y,b.z,b.w,b.h,b.d);
   }
   for(const [material,transforms] of batches){
     const mesh=new THREE.InstancedMesh(geo,material,transforms.length);
     transforms.forEach((v,i)=>mesh.setMatrixAt(i,v));
     mesh.instanceMatrix.needsUpdate=true;
     mesh.castShadow=false;mesh.receiveShadow=true;mesh.computeBoundingSphere();
     this.group.add(mesh);this.blockers.push(mesh);
   }
   const details=(x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material)=>{
     const cube=new THREE.Mesh(geo,material);
     cube.position.set(x,y,z);cube.scale.set(w,h,d);
     cube.castShadow=false;cube.receiveShadow=true;this.group.add(cube);
   };
   if(map.theme==='hospital'){
     // Clinical ceiling rails, colored emergency routes and wall panels.
     for(let x=-68;x<=68;x+=8){
       details(x,4.35,0,5,.1,.45,pale);
       details(x,3.1,-77,4,.65,.08,red);
       details(x,3.1,77,4,.65,.08,red);
     }
     details(0,.04,0,146,.07,.24,yellow);
     details(0,.04,-36,146,.07,.12,red);
     details(0,.04,35,146,.07,.12,red);
     for(let z=-62;z<=62;z+=20){
       details(-76,2.4,z,.10,1.7,7,pale);
       details(76,2.4,z,.10,1.7,7,pale);
     }
   }else{
     // Parallel waterline, dock crane arms and horizontal container ribbing.
     details(74,-.09,0,8,.12,151,sea);
     for(const x of [-45,-15,15,45]){
       for(const z of [-25,22]){
         for(let y=.52;y<3.1;y+=.55)
           details(x,y,z+3.65,18.3,.075,.12,red);
       }
     }
     for(const x of [-53,48]){
       details(x,7,-57,.42,10,.42,steel);
       details(x+3,11,-57,8,.28,.42,yellow);
       details(x+7,6,-57,.1,10,.1,steel);
     }
     for(let z=-60;z<70;z+=14)
       details(-70,.04,z,1,.08,3,yellow);
   }
   for(const d of map.devices){
     details(d.x,.81,d.z,.75,1.4,.5,steel);
     details(d.x,1.48,d.z-.06,.57,.29,.12,red);
   }
   for(const exit of map.routes){
     const color=exit.requires==='relay'?pale:yellow;
     details(exit.x,.08,exit.z,8,.10,8,color);
     const light=new THREE.PointLight(0x55dfb9,2.8,14,2);
     light.position.set(exit.x,3,exit.z);this.group.add(light);this.lights.push(light);
   }
   const safe=new THREE.PointLight(0x4fdcba,3.7,17,2);
   safe.position.set(map.safehouse.x,3,map.safehouse.z);
   this.group.add(safe);this.lights.push(safe);
   const roofMat=map.theme==='hospital'?mat(0x252f34):mat(0x303a42);
   if(map.theme==='hospital')details(0,5.4,0,159,.12,159,roofMat);
   // 12 small lamps with no shadow maps rather than hundreds of point lights.
   for(const [i,z] of [-58,-25,5,35,62].entries()){
     for(const x of [-55,-9,43]){
       details(x,5.25,z,4.7,.16,.45,pale);
       if(i%2===0){
         const bulb=new THREE.PointLight(0xc7e1d9,1.65,22,2);
         bulb.position.set(x,5,z);this.group.add(bulb);this.lights.push(bulb);
       }
     }
   }
   this.detailKit=map.theme==='hospital'?detailHospital(this.group):detailHarbor(this.group);
   this.group.userData.detailStats=this.detailKit.finish();
   this.group.visible=false;
   scene.add(this.group);
 }
 setVisible(visible:boolean):void{this.group.visible=visible;}
 dispose():void{
   this.detailKit.dispose();
   this.group.removeFromParent();
   for(const g of this.geometries)g.dispose();
   for(const m of this.materials)m.dispose();
 }
}

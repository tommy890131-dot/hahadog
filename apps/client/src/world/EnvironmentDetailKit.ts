import * as THREE from 'three';
import {METRO_BOXES} from '../../../../v313/MetroMap.mjs';
import {FACILITY_MAPS} from '../../../../v314/FacilityMaps.mjs';

type FinishStats={parts:number;drawCalls:number;signs:number};
type Piece={position:THREE.Vector3;scale:THREE.Vector3;rotation:THREE.Quaternion};
type MaterialName='anodized'|'galvanized'|'enamel'|'paint'|'glass'|'rubber'|'porcelain'|
  'warning'|'oxide'|'concrete'|'dark'|'safety'|'emergency'|'medical'|'cloth'|
  'sea'|'gold'|'containerBlue'|'containerRed'|'containerGreen'|'blueGlow';
type Shape='box'|'rod'|'plane';
const PALETTE:Record<MaterialName,[number,number,number,number?]>={
 anodized:[0x34444b,.43,.73],
 galvanized:[0x718187,.51,.58],
 enamel:[0x99a4a6,.63,.18],
 paint:[0x52656b,.78,.12],
 glass:[0x0e2836,.19,.19],
 rubber:[0x161f24,.96,.02],
 porcelain:[0xb3c4bd,.77,.02],
 warning:[0xcbaa54,.77,.14,0x30240a],
 oxide:[0x7e4b3d,.91,.12],
 concrete:[0x58646a,.98,.02],
 dark:[0x222c33,.91,.1],
 safety:[0x4b9a8e,.56,.16,0x153d36],
 emergency:[0xb74e44,.52,.2,0x46160c],
 medical:[0xe2e5d6,.73,.03],
 cloth:[0x8a9892,.96,.02],
 sea:[0x183742,.48,.26],
 gold:[0xcfad69,.62,.23],
 containerBlue:[0x3b6877,.75,.28],
 containerRed:[0x9b4e43,.82,.25],
 containerGreen:[0x526d5b,.72,.23],
 blueGlow:[0x9edbe1,.47,.06,0x3b777e]
};
const UNIT=new THREE.Vector3(0,1,0);

/**
 * Model one decorative part per transform but render each material/primitive
 * combination as ONE InstancedMesh. Geometry is visual only: physical props
 * continue to use the immutable shared server collision descriptors.
 */
export class EnvironmentDetailKit {
 private readonly batches=new Map<string,Piece[]>();
 private readonly materials=new Map<MaterialName,THREE.MeshStandardMaterial>();
 private readonly geometries=new Map<Shape,THREE.BufferGeometry>();
 private readonly extras:THREE.Object3D[]=[];
 private readonly extraMaterials:THREE.Material[]=[];
 private readonly textures:THREE.Texture[]=[];
 private partCount=0;
 private signCount=0;
 constructor(private readonly root:THREE.Group){}
 private material(name:MaterialName):THREE.MeshStandardMaterial{
   const existing=this.materials.get(name);if(existing)return existing;
   const [color,roughness,metalness,emissive]=PALETTE[name];
   const mat=new THREE.MeshStandardMaterial({color,roughness,metalness,
     emissive:emissive??0,emissiveIntensity:emissive?.65:0,
     flatShading:false,side:THREE.FrontSide});
   this.materials.set(name,mat);return mat;
 }
 private shape(type:Shape):THREE.BufferGeometry{
   const existing=this.geometries.get(type);if(existing)return existing;
   const geo=type==='box'?new THREE.BoxGeometry(1,1,1):
     type==='rod'?new THREE.CylinderGeometry(.5,.5,1,8):
       new THREE.PlaneGeometry(1,1);
   this.geometries.set(type,geo);return geo;
 }
 private enqueue(name:MaterialName,shape:Shape,pos:THREE.Vector3,scale:THREE.Vector3,
   rotation=new THREE.Quaternion()):void{
   const key=name+':'+shape;
   const list=this.batches.get(key)??[];
   list.push({position:pos,scale,rotation});this.batches.set(key,list);
   this.partCount++;
 }
 box(mat:MaterialName,x:number,y:number,z:number,w:number,h:number,d:number,yaw=0):void{
   this.enqueue(mat,'box',new THREE.Vector3(x,y,z),new THREE.Vector3(w,h,d),
     new THREE.Quaternion().setFromAxisAngle(UNIT,yaw));
 }
 rod(mat:MaterialName,x1:number,y1:number,z1:number,x2:number,y2:number,z2:number,diameter=.07):void{
   const a=new THREE.Vector3(x1,y1,z1),b=new THREE.Vector3(x2,y2,z2),
     delta=b.clone().sub(a),length=delta.length();
   if(length<.0001)return;
   this.enqueue(mat,'rod',a.add(b).multiplyScalar(.5),
     new THREE.Vector3(diameter,length,diameter),
     new THREE.Quaternion().setFromUnitVectors(UNIT,delta.normalize()));
 }
 cross(mat:MaterialName,x:number,y:number,z:number,size=.8):void{
   this.box(mat,x,y,z,size,.14,.06);
   this.box(mat,x,y,z,.14,size,.06);
 }
 /** Signs are real Chinese-language texture labels on physically placed wall planes. */
 sign(text:string,x:number,y:number,z:number,w:number,h:number,yaw=0,tone:'#adbdc2'|'#c5aa6d'|'#9edaca'='#adbdc2'):void{
   if(typeof document==='undefined')return;
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
   const context=canvas.getContext('2d');if(!context)return;
   context.fillStyle='#18262d';context.fillRect(0,0,512,128);
   context.fillStyle=tone;context.fillRect(10,9,8,111);
   context.strokeStyle='#4a626c';context.lineWidth=3;context.strokeRect(3,3,506,122);
   context.fillStyle=tone;
   context.font='bold 44px "Microsoft JhengHei","Noto Sans TC",sans-serif';
   context.textBaseline='middle';context.textAlign='center';
   context.fillText(text,268,65,445);
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
   texture.anisotropy=4;this.textures.push(texture);
   const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,
     transparent:false,depthWrite:true});
   this.extraMaterials.push(material);
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);
   mesh.position.set(x,y,z);mesh.rotation.y=yaw;mesh.name='environment-sign-'+text;
   mesh.userData.detailOnly=true;this.root.add(mesh);this.extras.push(mesh);this.signCount++;
 }
 /**
  * One repeating procedural physical floor texture, not an external asset.
  * Deterministic tile joints + wear; no texture request or network dependency.
  */
 floor(style:'metro'|'hospital'|'harbor',x:number,z:number,w:number,d:number,repeats=20):void{
   if(typeof document==='undefined')return;
   const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
   const ctx=canvas.getContext('2d');if(!ctx)return;
   ctx.fillStyle=style==='hospital'?'#707f82':style==='metro'?'#48575d':'#434e57';
   ctx.fillRect(0,0,256,256);
   const seedBase=style==='hospital'?311:style==='metro'?733:1499;
   let rng=seedBase;const next=()=>{rng=(1664525*rng+1013904223)>>>0;return rng/4294967296;};
   ctx.lineWidth=style==='harbor'?1:3;
   ctx.strokeStyle=style==='hospital'?'rgba(34,53,57,.37)':
     style==='metro'?'rgba(22,33,37,.55)':'rgba(31,39,47,.33)';
   const tile=style==='hospital'?64:style==='metro'?85:48;
   for(let i=0;i<260;i+=tile){
     ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,256);ctx.stroke();
     ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(256,i);ctx.stroke();
   }
   for(let i=0;i<(style==='harbor'?2100:800);i++){
     const px=next()*255,py=next()*255;
     ctx.fillStyle=next()>.45?'rgba(193,202,190,.075)':'rgba(9,19,21,.11)';
     ctx.fillRect(px,py,1+next()*4,1+next()*3);
   }
   if(style==='harbor'){
     ctx.strokeStyle='rgba(13,27,34,.25)';ctx.lineWidth=2;
     for(let i=0;i<14;i++){
       const ax=next()*256,ay=next()*256;
       ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ax+next()*24,ay+next()*28);ctx.stroke();
     }
   }
   const texture=new THREE.CanvasTexture(canvas);
   texture.colorSpace=THREE.SRGBColorSpace;
   texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
   texture.repeat.set(repeats,repeats*Math.max(.1,d/w));
   texture.anisotropy=4;this.textures.push(texture);
   const material=new THREE.MeshStandardMaterial({map:texture,
     roughness:style==='harbor'?.93:style==='hospital'?.80:.88,metalness:.03,
     polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
   this.extraMaterials.push(material);
   const plane=new THREE.Mesh(new THREE.PlaneGeometry(w,d),material);
   plane.rotation.x=-Math.PI/2;plane.position.set(x,-.009,z);
   plane.receiveShadow=true;plane.name=style+' tiled-wear floor';
   this.root.add(plane);this.extras.push(plane);
 }
 finish():FinishStats{
   let drawCalls=0;
   for(const [key,parts] of this.batches){
     if(!parts.length)continue;
     const [name,type]=key.split(':') as [MaterialName,Shape];
     const mesh=new THREE.InstancedMesh(this.shape(type),this.material(name),parts.length);
     const transform=new THREE.Matrix4();
     parts.forEach((part,i)=>{
       transform.compose(part.position,part.rotation,part.scale);
       mesh.setMatrixAt(i,transform);
     });
     mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
     mesh.castShadow=false;mesh.receiveShadow=true;
     mesh.name='batched-detail-'+name+'-'+type;
     mesh.userData.detailOnly=true;this.root.add(mesh);this.extras.push(mesh);
     drawCalls++;
   }
   return {parts:this.partCount,drawCalls,signs:this.signCount};
 }
 dispose():void{
   for(const object of this.extras){
     object.removeFromParent();
     if(object instanceof THREE.Mesh && !(object instanceof THREE.InstancedMesh))
       object.geometry.dispose();
   }
   this.extras.length=0;
   for(const geo of this.geometries.values())geo.dispose();
   for(const mat of this.materials.values())mat.dispose();
   for(const mat of this.extraMaterials)mat.dispose();
   for(const t of this.textures)t.dispose();
   this.geometries.clear();this.materials.clear();this.extraMaterials.length=0;
   this.textures.length=0;this.batches.clear();
 }
}

/** Underground station: tactile paving, cab/door/window detail,
 * ticket readers, rails, service ducts, escalator fascia and wayfinding. */
export function detailMetro(root:THREE.Group):EnvironmentDetailKit{
 const kit=new EnvironmentDetailKit(root);
 kit.floor('metro',0,-17,157,18,22);
 kit.floor('metro',0,17,157,18,22);
 // Tactile strip, two rows of raised studs at train platform edge.
 for(const z of [-7.35,7.35]){
   kit.box('warning',0,.026,z,155,.026,.3);
   for(let x=-77;x<78;x+=.68){
     kit.box('gold',x,.047,z,.23,.018,.18);
   }
 }
 // Rail holders and riveted sleepers, level with underlying non-collidable rail gravel.
 for(let x=-76;x<76;x+=1.95){
   kit.box('rubber',x,.09,2.05,.21,.14,5.65);
   for(const z of [-.7,4.7])kit.box('galvanized',x,.17,z,.38,.11,.38);
 }
 for(const box of METRO_BOXES){
   if(box.role==='column'){
     kit.box('concrete',box.x,.18,box.z,2.15,.35,2.15);
     kit.box('galvanized',box.x,4.43,box.z,2.2,.12,2.2);
     for(const y of [1.15,3.45])kit.box('warning',box.x,y,box.z-0.84,1.57,.1,.045);
   }
   if(box.role==='gate'){
     kit.box('galvanized',box.x,box.y+box.h/2-.08,box.z,box.w+.13,.14,box.d+.12);
     kit.box('blueGlow',box.x,box.y+box.h/2+.017,box.z,.22,.045,.27);
   }
   if(box.role==='equipment'){
     // Material panel outline is integrated into a collision-backed base box.
     kit.box('anodized',box.x,box.y,box.z-box.d/2-.032,Math.max(.5,box.w-.18),
       Math.min(box.h-.22,1.35),.065);
     for(let j=0;j<4;j++)kit.box('galvanized',box.x-box.w*.35+j*.15,
       box.y+.17,box.z-box.d/2-.081,.075,.20,.015);
   }
 }
 // Two lit overhead safety pipes and wall cable trays.
 for(const z of [-25.5,25.5]){
   for(const y of [4.76,5.02]){
     kit.rod('galvanized',-79,y,z,79,y,z,.12);
     for(let x=-75;x<=75;x+=8)kit.rod('anodized',x,y,z,x,y+.28,z,.06);
   }
   for(let x=-75;x<=75;x+=13){
     kit.box('anodized',x,3.95,z,2.5,.37,.18);
     for(let j=-1;j<=1;j++)kit.box('galvanized',x+j*.75,3.95,z-.10,.035,.27,.13);
   }
 }
 // Structural soffits and decorative signal cable bends, overhead, no new obstacles.
 for(let x=-72;x<76;x+=12){
   kit.box('galvanized',x,5.49,0,.21,.15,53);
   kit.rod('emergency',x,5.23,-8,x,5.23,8,.065);
 }
 // Train sidewalls: door jamb, rubber seals, glazed windows, handrails and number plates.
 for(const z of [-1.06,5.06]){
   for(const x of [7.3,15.5,24.5,32.0,40.5]){
     kit.box('anodized',x,1.6,z,1.43,2.8,.09);
     kit.box('galvanized',x,3.01,z,1.51,.10,.095);
     for(const dx of [-.64,.64])
       kit.box('galvanized',x+dx,1.60,z,.072,2.66,.095);
     kit.box('glass',x,2.35,z+.01,1.07,.43,.115);
     kit.box('warning',x,.51,z+.015,1.3,.09,.11);
     kit.box('rubber',x,1.6,z+.023,.038,2.3,.12);
   }
   for(let x=5;x<=43;x+=2.15){
     kit.box('galvanized',x,2.78,z,1.40,.06,.10);
     kit.box('glass',x,2.34,z+.01,1.15,.62,.07);
   }
 }
 for(const x of [7,17,27,40]){
   kit.box('anodized',x,3.24,2,3.25,.18,5.8);
   kit.box('dark',x,.28,2,2.65,.24,6.4);
   for(const z of [-.75,4.75]){
     kit.rod('galvanized',x-.92,.24,z,x+.92,.24,z,.20);
   }
 }
 // Emergency/caution signs printed in-world, not overlaid on UI.
 for(const x of [-59,-11,29,65]){
   kit.sign('避難出口  EXIT',x,3.6,-26.88,6,.86,0,'#9edaca');
   kit.sign('月台邊緣注意安全',x,3.6,26.88,6,.86,Math.PI,'#c5aa6d');
 }
 kit.sign('列車月台  PLATFORM 02',-39,3.55,7.75,7,.95,Math.PI);
 kit.sign('電力控制室',-32,2.6,-26.85,3.7,.66);
 kit.sign('東側隧道 警戒區',62,2.7,7.8,5,.72,Math.PI,'#c5aa6d');
 // Ceiling fixtures with paired emissive diffuser strips.
 for(const x of [-70,-52,-34,-16,2,20,38,56,72]){
   for(const z of [-22,22]){
     kit.box('anodized',x,5.35,z,5.8,.18,.46);
     kit.box('blueGlow',x,5.23,z,5.2,.05,.20);
   }
 }
 return kit;
}

/** Infection hospital: clinical surfaces, frames, corridor handrails,
 * surgical equipment, ward beds, IV poles and quarantined doors. */
export function detailHospital(root:THREE.Group):EnvironmentDetailKit{
 const kit=new EnvironmentDetailKit(root),map=FACILITY_MAPS.infected_hospital;
 kit.floor('hospital',0,0,156,156,26);
 // Wall base kicks and waist-high stainless impact protection.
 for(const z of [-76.9,76.9]){
   kit.box('paint',0,.24,z,151,.42,.06);
   kit.box('galvanized',0,1.10,z,151,.15,.1);
   kit.box('medical',0,3.75,z,151,.13,.08);
 }
 for(const x of [-76.9,76.9]){
   kit.box('paint',x,.24,0,.06,.42,151);
   kit.box('galvanized',x,1.10,0,.1,.15,151);
 }
 for(const b of map.boxes){
   if(b.role!=='wall'||!b.id.includes('partition'))continue;
   for(const x of [b.x-b.w/2-.045,b.x+b.w/2+.045]){
     for(const z of [b.z-b.d/2+.75,b.z+b.d/2-.75]){
       kit.box('anodized',x,2.18,z,.065,4.20,.095);
     }
     kit.box('galvanized',x,3.9,b.z,.085,.14,b.d-1.25);
     kit.box('paint',x,1.02,b.z,.06,.24,b.d-1.25);
   }
 }
 // Corridor: red isolation stripe and floor-number markers, no raised obstacles.
 for(const z of [-38,38]){
   kit.box('emergency',0,.024,z,150,.013,.19);
   for(let x=-70;x<71;x+=10)
     kit.box('gold',x,.033,z,.68,.016,.34);
 }
 for(const x of [-58,-28,0,32]){
   const z=-63;
   kit.box('cloth',x,.88,z,3.14,.18,1.72); // mattress on collidable bed
   kit.box('medical',x-1.16,1.01,z,.62,.12,1.35);
   kit.box('galvanized',x-1.74,1.15,z,.06,.77,1.89);
   for(const dz of [-.93,.93]){
     kit.rod('galvanized',x-.9,1.15,z+dz,x+.94,1.15,z+dz,.055);
     for(const dx of [-.75,.75])
       kit.rod('galvanized',x+dx,.9,z+dz,x+dx,1.14,z+dz,.043);
   }
   // IV stand within the existing bed's footprint, light enough not to block.
   kit.rod('anodized',x+1.27,.82,z+.53,x+1.27,2.65,z+.53,.075);
   kit.rod('galvanized',x+.9,2.65,z+.53,x+1.62,2.65,z+.53,.05);
   kit.box('porcelain',x+1.60,2.26,z+.53,.16,.5,.13);
   kit.rod('galvanized',x+1.60,2.5,z+.53,x+1.60,2.0,z+.53,.029);
 }
 // Operating theatres: articulated overhead lamps and tools on the table.
 for(const x of [-60,-28,0,33]){
   const z=65;
   kit.box('galvanized',x,.93,z,3.19,.1,1.55);
   kit.box('enamel',x,.99,z,2.66,.12,1.15);
   kit.rod('anodized',x,5.2,z,x,3.85,z,.095);
   kit.rod('anodized',x,3.85,z,x+1.15,3.33,z,.09);
   kit.box('blueGlow',x+1.25,3.18,z,1.05,.14,.66);
   kit.box('rubber',x+.65,1.07,z,.35,.07,.35);
 }
 // Nurses' triage workstations with screen bezels and desk drawers.
 for(const x of [-30,2,35]){
   kit.box('porcelain',x,1.21,2.22,5.7,.09,.34);
   for(const dx of [-1.65,1.45]){
     kit.box('anodized',x+dx,1.71,2.19,.77,.86,.13);
     kit.box('blueGlow',x+dx,1.72,2.11,.64,.67,.027);
     kit.rod('galvanized',x+dx,1.26,2.20,x+dx,1.29,2.20,.07);
     kit.box('rubber',x+dx,1.30,1.85,.65,.045,.18);
   }
   for(let dx=-2.3;dx<=2.3;dx+=.94)
     kit.box('galvanized',x+dx,.7,3.86,.06,.32,.045);
 }
 // Isolation zone seals visible on the existing opaque partition.
 for(const x of [-45,-10,25,58]){
   for(const z of [-52,50]){
     const faceZ=z<0?-38.92:36.92;
     kit.box('anodized',x,2.25,faceZ,1.34,3.95,.08);
     kit.box('emergency',x,3.3,faceZ+.06,1.05,.18,.055);
     kit.box('glass',x,2.15,faceZ+.07,.74,.70,.06);
     kit.box('galvanized',x+.47,1.43,faceZ+.095,.09,.29,.09);
   }
 }
 for(const x of [-60,-25,15,61]){
   kit.sign('急診  EMERGENCY',x,3.6,-76.8,7.5,.88,0,'#c5aa6d');
   kit.sign('感染管制  ISOLATION',x,3.6,76.8,7.8,.88,Math.PI,'#9edaca');
 }
 kit.sign('手術區  SURGERY',-15,2.85,39.0,5.7,.84,Math.PI);
 kit.sign('藥品管理  PHARMACY',-4,2.85,30.1,5.7,.84);
 for(const [x,z] of [[-65,-27],[18,-26],[-10,24],[64,45]]){
   kit.box('anodized',x,1.15,z-.44,1.03,.93,.12);
   kit.box('blueGlow',x,1.3,z-.53,.64,.37,.043);
   for(const dx of [-.26,0,.26])
     kit.box('galvanized',x+dx,.85,z-.545,.09,.11,.03);
 }
 // Oxygen and utility piping stays overhead, outside the player collision.
 for(const z of [-35,35]){
   for(const y of [4.62,4.87]){
     kit.rod(y>4.7?'galvanized':'emergency',-73,y,z,73,y,z,.095);
     for(const x of [-68,-40,-12,16,44,69])
       kit.rod('anodized',x,y,z,x,5.18,z,.065);
   }
 }
 for(let z=-62;z<=65;z+=16){
   for(const x of [-65,-15,35,65]){
     kit.box('anodized',x,5.22,z,4.0,.15,.37);
     kit.box('blueGlow',x,5.09,z,3.5,.035,.20);
   }
 }
 return kit;
}

/** Docks: corrugated containers, corner castings, shipping stencils,
 * crane gantries, floodlights, steel bollards and harbor grime. */
export function detailHarbor(root:THREE.Group):EnvironmentDetailKit{
 const kit=new EnvironmentDetailKit(root),map=FACILITY_MAPS.doomed_harbor;
 kit.floor('harbor',0,0,156,156,24);
 for(let index=0;index<map.boxes.length;index++){
   const b=map.boxes[index];
   if(b.role!=='container')continue;
   const c:MaterialName=(index%3===0)?'containerBlue':index%3===1?'containerRed':'containerGreen';
   const left=b.x-b.w/2+.23,right=b.x+b.w/2-.23;
   for(let x=left;x<right;x+=.76){
     for(const z of [b.z-b.d/2-.048,b.z+b.d/2+.048])
       kit.box(c,x,b.y,z,.095,b.h-.12,.085);
   }
   for(let z=b.z-b.d/2+.5;z<b.z+b.d/2-.3;z+=.85)
     for(const x of [b.x-b.w/2-.05,b.x+b.w/2+.05])
       kit.box('anodized',x,b.y,z,.06,b.h-.2,.06);
   for(const dx of [-b.w/2+.22,b.w/2-.22]){
     for(const dz of [-b.d/2+.24,b.d/2-.24]){
       kit.box('warning',b.x+dx,b.h-.16,b.z+dz,.36,.26,.36);
       kit.box('warning',b.x+dx,.14,b.z+dz,.36,.26,.36);
     }
   }
   // Double doors and lock rods on the long container ends.
   for(const x of [b.x-b.w/2-.065,b.x+b.w/2+.065]){
     kit.box('anodized',x,1.66,b.z,.07,2.95,.10);
     for(const dz of [-1.7,1.7]){
       kit.rod('galvanized',x,0.27,b.z+dz,x,3.10,b.z+dz,.072);
       for(const y of [.45,2.85])
         kit.box('galvanized',x+.04,y,b.z+dz,.12,.12,.18);
     }
   }
   kit.sign('DF - CARGO / '+(100+index),b.x,2.06,b.z+b.d/2+.095,
     4.5,.65,0,'#c5aa6d');
 }
 // Dock safety lines and reflective traffic guides.
 for(const x of [-68,-35,0,35,68]){
   kit.box('warning',x,.042,0,.18,.028,148);
   for(let z=-69;z<70;z+=14)
     kit.box('porcelain',x,.055,z,.42,.032,2.8);
 }
 // Stenciled safe boarding zones, accessible as server-defined evacuation.
 for(const route of map.routes){
   for(const dz of [-4.15,4.15])
     kit.box('warning',route.x,.045,route.z+dz,7.3,.025,.24);
   for(const dx of [-4.15,4.15])
     kit.box('warning',route.x+dx,.046,route.z,.24,.025,8.1);
 }
 // Crane legs, cross bracing and functional overhead hoist assemblies.
 for(const [baseX,baseZ] of [[48,-57],[53,57]]){
   const x1=baseX-2.5,x2=baseX+2.5;
   for(const x of [x1,x2]){
     kit.rod('warning',x,2,baseZ-2,x,12.8,baseZ-2,.32);
     kit.rod('warning',x,2,baseZ+2,x,12.8,baseZ+2,.32);
   }
   for(let y=3;y<12;y+=2.2){
     kit.rod('galvanized',x1,y,baseZ-2,x2,y+1.1,baseZ-2,.14);
     kit.rod('galvanized',x2,y,baseZ+2,x1,y+1.1,baseZ+2,.14);
   }
   kit.box('warning',baseX,13.15,baseZ,13,.58,5.3);
   for(const x of [baseX-6,baseX,baseX+6]){
     kit.rod('anodized',x,13.2,baseZ,x,14.9,baseZ,.16);
     kit.rod('galvanized',x,14.9,baseZ,baseX+6,13.2,baseZ,.12);
   }
   kit.box('anodized',baseX+4,12.42,baseZ,2.5,1.0,2.9);
   for(const dz of [-.72,.72]){
     kit.rod('dark',baseX+4,11.95,baseZ+dz,baseX+4,5.0,baseZ+dz,.08);
   }
   kit.box('galvanized',baseX+4,4.85,baseZ,1.8,.34,1.35);
   kit.box('gold',baseX+4,4.35,baseZ,.58,.65,.6);
 }
 // Concrete quay joints, wheel stops, storm drains and bollards.
 for(let z=-70;z<70;z+=4){
   kit.box('anodized',69,.054,z,1.2,.05,.16);
   kit.box('concrete',70.45,.26,z,.28,.52,.40);
   if(z%12===-10||z%12===2){
     kit.rod('gold',70.8,0,z,70.8,1.15,z,.42);
     kit.box('rubber',70.8,1.14,z,.8,.16,.8);
   }
 }
 for(const z of [-60,-38,-16,6,28,50,70]){
   kit.box('anodized',0,4.85,z,.20,.11,151);
 }
 // Floodlight towers along the water-side wall.
 for(const z of [-61,-24,13,51]){
   kit.rod('anodized',74,0,z,74,9.3,z,.28);
   kit.rod('galvanized',73,9.1,z,75,9.1,z,.13);
   kit.box('blueGlow',73.05,9.05,z,1.05,.65,.35);
   kit.box('blueGlow',74.95,9.05,z,1.05,.65,.35);
 }
 for(const [x,z] of [[-64,-49],[-12,-48],[45,-45],[1,48],[-52,51]]){
   kit.box('anodized',x,1.7,z-.45,1.45,.95,.15);
   kit.box('blueGlow',x,1.75,z-.545,1.1,.53,.044);
 }
 kit.sign('貨櫃場  CONTAINER YARD',0,3.75,-76.82,11.6,1.10,0,'#c5aa6d');
 kit.sign('危險區  KEEP CLEAR',0,3.75,76.83,9.2,.92,Math.PI,'#c5aa6d');
 kit.sign('港口救援  RESCUE',64,3.4,43.5,6,.85,Math.PI,'#9edaca');
 return kit;
}

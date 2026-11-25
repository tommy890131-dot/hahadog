import * as THREE from 'three';
import {METRO_BOXES} from '../../../../v313/MetroMap.mjs';
import {FACILITY_MAPS} from '../../../../v314/FacilityMaps.mjs';

/**
 * V3.14 architectural realism pass. All work here is cosmetic: never append to
 * authoritative collision boxes, world.blockers, pathfinding or raycast hits.
 * Geometry is batched by finish and has no dynamic lights or cast shadows.
 */
type Finish='boardConcrete'|'stone'|'plaster'|'tile'|'steel'|'oxidized'|'paintMetal'|'glass'|'rubber'|'paintStripe';
type Part={x:number;y:number;z:number;w:number;h:number;d:number;yaw:number};
type MeterBox={id:string;x:number;y:number;z:number;w:number;h:number;d:number;role?:string};
const TINT:Record<Finish,{color:number;rough:number;metal:number;depth:number}>={
  boardConcrete:{color:0x899393,rough:.96,metal:0,depth:.47},
  stone:{color:0x626b70,rough:.92,metal:0,depth:.34},
  plaster:{color:0xb7c0b9,rough:.87,metal:0,depth:.24},
  tile:{color:0x9baaa7,rough:.73,metal:0,depth:.31},
  steel:{color:0x7c8b92,rough:.55,metal:.68,depth:.27},
  oxidized:{color:0x9a6552,rough:.89,metal:.31,depth:.41},
  paintMetal:{color:0x5c7b83,rough:.63,metal:.45,depth:.30},
  glass:{color:0x1d3d49,rough:.16,metal:.10,depth:.12},
  rubber:{color:0x202c31,rough:.95,metal:0,depth:.22},
  paintStripe:{color:0xbaa45d,rough:.90,metal:0,depth:.15}
};
const HASH=(x:number,y:number,seed:number)=>{
  let v=Math.imul(x+1973,73428767)^Math.imul(y+9277,456271)^Math.imul(seed+91,279470273);
  v=Math.imul(v^(v>>>13),1274126177);return ((v^(v>>>16))>>>0)/4294967295;
};
const clamp=(x:number)=>Math.max(0,Math.min(255,Math.round(x)));
function textureFor(finish:Finish){
  const size=128,def=TINT[finish],pixels=new Uint8ClampedArray(size*size*4),
    roughPixels=new Uint8ClampedArray(size*size*4),normalPixels=new Uint8ClampedArray(size*size*4);
  const heights=new Float32Array(size*size),seed=Object.keys(TINT).indexOf(finish)*911+117;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const noise=(HASH(x>>1,y>>1,seed)-.5)*.56+(HASH(x,y,seed+77)-.5)*.44;
    const large=(HASH(x>>4,y>>4,seed+88)-.5)*.23;
    let groove=0;
    if(finish==='tile')groove=(x%32<2||y%32<2)?-.58:0;
    else if(finish==='boardConcrete')groove=(y%43<2)?-.49:0;
    else if(finish==='paintMetal')groove=(x%9<2)?.10:0;
    else if(finish==='steel')groove=(x%22<1)?.20:0;
    const p=y*size+x;
    heights[p]=(noise+large+groove)*def.depth;
  }
  const base=new THREE.Color(def.color);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const p=y*size+x,o=p*4,h=heights[p];
    const pat=HASH(x>>3,y>>3,seed+502);
    const staining=(finish==='oxidized'&&pat>.63)?-.14:
      (finish==='boardConcrete'||finish==='stone')&&pat<.21?-.065:0;
    const shade=Math.max(.37,Math.min(1.38,1+h*.72+staining));
    pixels[o]=clamp(base.r*255*shade);
    pixels[o+1]=clamp(base.g*255*shade);
    pixels[o+2]=clamp(base.b*255*shade);
    pixels[o+3]=255;
    const rough=def.rough+Math.min(.12,Math.abs(h)*.35)+(pat-.5)*.10;
    const rc=clamp(255*Math.max(.03,Math.min(1,rough)));
    roughPixels[o]=roughPixels[o+1]=roughPixels[o+2]=rc;roughPixels[o+3]=255;
    const dx=heights[y*size+((x+1)%size)]-heights[y*size+((x+size-1)%size)];
    const dy=heights[((y+1)%size)*size+x]-heights[((y+size-1)%size)*size+x];
    const inv=1/Math.hypot(dx,dy,1.5);
    normalPixels[o]=clamp(128-dx*inv*128);
    normalPixels[o+1]=clamp(128-dy*inv*128);
    normalPixels[o+2]=clamp(128+1.5*inv*127);normalPixels[o+3]=255;
  }
  const make=(pixels:Uint8ClampedArray,srgb:boolean)=>{
    const tex=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
    tex.needsUpdate=true;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps=true;tex.anisotropy=4;
    if(srgb)tex.colorSpace=THREE.SRGBColorSpace;
    return tex;
  };
  const color=make(pixels,true),rough=make(roughPixels,false),normal=make(normalPixels,false);
  return {color,rough,normal};
}
export class ArchitecturalRealism {
  private readonly parts=new Map<Finish,Part[]>();
  private readonly assets:THREE.Object3D[]=[];
  private readonly geometries:THREE.BufferGeometry[]=[];
  private readonly materials:THREE.Material[]=[];
  private readonly textures:THREE.Texture[]=[];
  readonly name:string;
  constructor(private readonly root:THREE.Group,name:string){this.name=name;}
  box(f:Finish,x:number,y:number,z:number,w:number,h:number,d:number,yaw=0):void{
    if(![x,y,z,w,h,d,yaw].every(Number.isFinite)||w<=0||h<=0||d<=0)return;
    const p=this.parts.get(f)??[];p.push({x,y,z,w,h,d,yaw});this.parts.set(f,p);
  }
  rod(f:Finish,x1:number,y1:number,z1:number,x2:number,y2:number,z2:number,diameter=.08):void{
    const dx=x2-x1,dy=y2-y1,dz=z2-z1;
    const len=Math.hypot(dx,dy,dz);
    if(len<.001)return;
    const v=new THREE.Vector3(dx,dy,dz).normalize();
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v);
    const geo=new THREE.CylinderGeometry(diameter*.5,diameter*.5,len,8);
    const mat=this.getMaterial(f);
    const mesh=new THREE.Mesh(geo,mat);
    mesh.position.set((x1+x2)*.5,(y1+y2)*.5,(z1+z2)*.5);
    mesh.quaternion.copy(q);mesh.castShadow=false;mesh.receiveShadow=true;
    mesh.userData.visualOnly=true;this.root.add(mesh);this.assets.push(mesh);this.geometries.push(geo);
  }
  private readonly finishMaterials=new Map<Finish,THREE.MeshStandardMaterial>();
  private getMaterial(name:Finish):THREE.MeshStandardMaterial{
    const existing=this.finishMaterials.get(name);if(existing)return existing;
    const p=TINT[name],maps=textureFor(name);
    this.textures.push(maps.color,maps.rough,maps.normal);
    const m=new THREE.MeshStandardMaterial({
      map:maps.color,roughnessMap:maps.rough,normalMap:maps.normal,
      color:0xffffff,roughness:p.rough,metalness:p.metal,
      normalScale:new THREE.Vector2(.37,.37),side:THREE.FrontSide
    });
    m.name='Architectural PBR '+name;this.materials.push(m);this.finishMaterials.set(name,m);
    return m;
  }
  finish():{parts:number;batches:number;textures:number}{
    const geo=new THREE.BoxGeometry(1,1,1);this.geometries.push(geo);
    let count=0,batches=0;const transform=new THREE.Object3D();
    for(const [name,parts] of this.parts){
      if(parts.length===0)continue;
      const mesh=new THREE.InstancedMesh(geo,this.getMaterial(name),parts.length);
      mesh.name=this.name+' '+name;mesh.userData.visualOnly=true;
      for(let i=0;i<parts.length;i++){
        const p=parts[i];transform.position.set(p.x,p.y,p.z);
        transform.scale.set(p.w,p.h,p.d);transform.rotation.set(0,p.yaw,0);
        transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
      mesh.castShadow=false;mesh.receiveShadow=true;
      this.root.add(mesh);this.assets.push(mesh);count+=parts.length;batches++;
    }
    this.root.userData.architecturePBR={parts:count,batches,textures:this.textures.length};
    return {parts:count,batches,textures:this.textures.length};
  }
  dispose():void{
    for(const a of this.assets)a.removeFromParent();
    for(const g of this.geometries)g.dispose();
    for(const m of this.materials)m.dispose();
    for(const t of this.textures)t.dispose();
    this.assets.length=0;this.geometries.length=0;this.materials.length=0;this.textures.length=0;
    this.finishMaterials.clear();this.parts.clear();
  }
}
/** Real station cross-section: columns, wall panel courses, fireproof service
 * lines, perforated soffits, glazing reveals; stays outside the walkable core. */
export function metroArchitecture(root:THREE.Group):ArchitecturalRealism{
  const k=new ArchitecturalRealism(root,'metro architecture');
  for(const b of METRO_BOXES){
    if(b.role==='wall'){
      if(b.w>b.d){
        for(let x=b.x-b.w/2+2.5;x<b.x+b.w/2-1;x+=5){
          k.box('stone',x,2.12,b.z+(b.z>0?-.96:.96),.075,4.0,.08);
          k.box('steel',x,4.65,b.z+(b.z>0?-1.05:1.05),4.6,.11,.12);
          for(let y=.75;y<4;y+=1.15)k.box('boardConcrete',x,y,b.z+(b.z>0?-1.035:1.035),4.55,.018,.022);
        }
      }else{
        for(let z=-23;z<24;z+=4.6){
          k.box('stone',b.x+(b.x>0?-.97:.97),2.18,z,.085,3.8,.067);
        }
      }
    }
    if(b.role==='column'){
      for(const dx of [-.86,.86])for(const dz of [-.86,.86])
        k.box('steel',b.x+dx,2.2,b.z+dz,.07,4.2,.07);
      for(const y of [0.45,3.45])k.box('paintStripe',b.x,y,b.z-.82,1.63,.16,.035);
      k.box('boardConcrete',b.x,4.36,b.z,2.0,.14,2.0);
    }
  }
  for(const z of [-25.9,25.9]){
    for(const y of [3.92,4.33]){
      k.box('steel',0,y,z,156,.08,.10);
      for(let x=-76;x<=76;x+=7.6)k.box('steel',x,(y+4.88)/2,z,.05,4.88-y,.075);
    }
    for(let x=-72;x<73;x+=7.8){
      k.box('paintMetal',x,5.67,z,6.4,.11,.72);
      for(const dx of [-2.7,-1.7,-.7,.3,1.3,2.3])
        k.box('steel',x+dx,5.57,z,.055,.10,.62);
    }
  }
  for(const z of [-1.13,5.13]){
    for(let x=6;x<=43;x+=1.9){
      k.box('rubber',x,2.52,z,1.25,.025,.025);
      k.box('steel',x,3.15,z,.09,.12,.09);
      if(Math.round(x)%3===0)k.box('glass',x,2.22,z+.016,1.18,.50,.023);
    }
    for(const x of [8,18,28,39]){
      k.box('paintStripe',x,.44,z,1.55,.09,.085);
      for(const dx of [-.75,.75])k.box('steel',x+dx,1.60,z,.062,2.65,.12);
    }
  }
  // High mounted emergency sprinkler pipes and conduit.
  for(let x=-72;x<=72;x+=12){
    k.box('oxidized',x,5.20,-21,10,.06,.06);
    k.box('steel',x,5.16,21,10,.06,.06);
  }
  k.finish();return k;
}
/** Wards, doors, hygienic skirting, modular suspended ceiling grid and
 * infection isolation architectural frames. No new collision blockers. */
export function hospitalArchitecture(root:THREE.Group):ArchitecturalRealism{
  const k=new ArchitecturalRealism(root,'hospital architecture');
  const m=FACILITY_MAPS.infected_hospital;
  for(const b of m.boxes){
    if(b.role!=='wall')continue;
    const isOuter=b.id.startsWith('hospital-');
    if(b.w>b.d){
      const length=b.w;
      for(let x=b.x-length/2+2;x<b.x+length/2-1;x+=3.2){
        for(const sign of [-1,1]){
          const face=b.z+sign*(b.d/2+.025);
          k.box('plaster',x,2.35,face,3.0,4.1,.028);
          k.box('tile',x,.52,face+sign*.018,3.0,1.04,.021);
          k.box('steel',x,1.11,face+sign*.055,3.0,.08,.06);
          k.box('steel',x,4.35,face+sign*.03,3.0,.08,.065);
          k.box('stone',x+1.52,2.15,face+sign*.032,.025,4.0,.025);
        }
      }
    }else if(isOuter){
      for(let z=b.z-b.d/2+2;z<b.z+b.d/2-2;z+=4){
        const face=b.x+(b.x>0?-b.w/2-.03:b.w/2+.03);
        k.box('plaster',face,2.4,z,.028,3.5,3.8);
        k.box('tile',face,0.57,z,.035,1.14,3.8);
      }
    }
  }
  // At ward partitions, cosmetic door lights are mounted on solid walls:
  // do not cut doorways through server collision without updating physics.
  for(const b of m.boxes.filter(b=>b.id.includes('partition'))){
    for(const z of [b.z-b.d/2+.95,b.z+b.d/2-.95]){
      for(const dx of [-.52,.52])k.box('paintMetal',b.x+dx,2.07,z,.08,3.2,.10);
      k.box('steel',b.x,3.68,z,1.18,.11,.13);
      k.box('glass',b.x,2.35,z,0.72,.55,.07);
      k.box('oxidized',b.x,3.83,z,1.25,.12,.065);
    }
  }
  // Suspended ceiling grid + integrated luminaires. Kept above play space.
  for(let x=-74;x<=74;x+=3.6)k.box('steel',x,5.20,0,.028,.045,151);
  for(let z=-73;z<=73;z+=3.6)k.box('steel',0,5.20,z,151,.045,.028);
  for(let x=-68;x<=68;x+=13.2)for(const z of [-33,0,33]){
    k.box('plaster',x,5.18,z,2.7,.06,1.5);
    k.box('glass',x,5.125,z,2.32,.027,.38);
  }
  for(const [x,z] of [[-23,-27],[19,-26],[-8,25],[64,45]]){
    k.box('steel',x,2.25,z-.47,1.12,.13,.12);
    for(const dx of [-.53,.53])k.box('paintMetal',x+dx,1.42,z-.48,.064,1.47,.12);
  }
  for(const z of [-36,36]){
    k.box('oxidized',0,4.87,z,147,.12,.11);
    for(let x=-69;x<=69;x+=8){
      k.box('steel',x,5.02,z,.10,.20,.15);
      k.box('steel',x,4.86,z,.065,.18,.19);
    }
  }
  k.finish();return k;
}
/** Port construction: concrete expansion joints, heavy fender/berth details,
 * corrugated container reinforced frames, cranes and drainage covers. */
export function harborArchitecture(root:THREE.Group):ArchitecturalRealism{
  const k=new ArchitecturalRealism(root,'harbor architecture');
  const m=FACILITY_MAPS.doomed_harbor;
  for(const b of m.boxes){
    if(b.role==='container'){
      for(const z of [b.z-b.d/2-.07,b.z+b.d/2+.07]){
        k.box('paintMetal',b.x,b.h-.11,z,b.w,.22,.10);
        k.box('oxidized',b.x,.13,z,b.w,.15,.11);
        for(let x=b.x-b.w/2+.45;x<b.x+b.w/2-.3;x+=.96)
          k.box('steel',x,b.h*.5,z,.065,b.h-.20,.11);
      }
      for(const x of [b.x-b.w/2-.07,b.x+b.w/2+.07]){
        k.box('paintMetal',x,b.h-.12,b.z,.11,.25,b.d);
        for(const zz of [b.z-b.d/2+.43,b.z+b.d/2-.43])
          k.box('oxidized',x,1.5,zz,.13,2.6,.15);
      }
      // Corner casting and lock-point housings, no added playable wall volume.
      for(const x of [b.x-b.w/2+.25,b.x+b.w/2-.25]){
        for(const z of [b.z-b.d/2+.24,b.z+b.d/2-.24]){
          for(const y of [.18,b.h-.17])k.box('steel',x,y,z,.30,.34,.30);
        }
      }
    }
    if(b.role==='crane'){
      for(const x of [b.x-2,b.x+2]){
        for(const z of [b.z-1.8,b.z+1.8]){
          k.box('steel',x,b.h+.12,z,.50,.21,.50);
          k.box('oxidized',x,1.15,z,.07,2.0,.10);
        }
      }
    }
  }
  // Berthing cleats and quay coping aligned with existing seawall.
  for(let z=-67;z<=67;z+=5.8){
    k.box('stone',72,.24,z,1.7,.35,.18);
    if(Math.round(z)%2===0){
      k.box('oxidized',70.9,.60,z,.60,.25,.34);
      for(const dz of [-.22,.22])k.box('steel',70.9,.48,z+dz,.52,.07,.065);
    }
  }
  for(const z of [-59,-35,-11,13,37,61]){
    k.box('rubber',72.48,.72,z,.25,1.34,1.4);
    for(const dz of [-.52,.52])k.box('steel',72.28,1.2,z+dz,.12,.15,.14);
  }
  // Industrial rain drain gratings occupy decal-height and are non-blocking.
  for(let x=-68;x<=68;x+=15){
    for(const z of [-44,5,48]){
      k.box('stone',x,.020,z,3.8,.016,.42);
      for(let dx=-1.7;dx<1.8;dx+=.29)
        k.box('steel',x+dx,.033,z,.055,.019,.36);
    }
  }
  // Structural crane bracing, clear of ground walking path.
  for(const [x,z] of [[48,-57],[53,57]]){
    for(let y=5.0;y<=11;y+=2.8){
      k.box('paintStripe',x,y,z,7,.15,.19);
      for(const dx of [-2.8,2.8])k.box('oxidized',x+dx,y,z,.10,.22,.28);
    }
    k.box('steel',x+4,13.55,z,2.2,.17,3.0);
  }
  k.finish();return k;
}
/** Existing city buildings retain all server apertures / rooftop routes.
 * This pass adds only exterior finish, thresholds, drainage, shopfront reveals,
 * building service risers and shallow fascia instead of filling door holes. */
export function cityArchitecture(root:THREE.Group,buildings:readonly {
  id:string;x:number;z:number;w:number;d:number;h:number;role:string
}[],tacticalIds:ReadonlySet<string>):ArchitecturalRealism{
  const k=new ArchitecturalRealism(root,'city architecture');
  for(const b of buildings){
    if(b.role==='CAR')continue;
    const tactical=tacticalIds.has(b.id),levels=Math.max(2,Math.round(b.h/3.1));
    for(const sign of [-1,1]){
      const z=b.z+sign*(b.d/2+.15);
      // Existing open entrances / windows are not filled.
      for(let floor=1;floor<levels;floor++){
        const y=floor*b.h/levels;
        k.box('stone',b.x,y,z,b.w+.3,.09,.12);
      }
      for(const x of [b.x-b.w/2+.24,b.x+b.w/2-.24]){
        k.box('oxidized',x,b.h*.5,z,.10,b.h-.22,.10);
        for(let y=2.3;y<b.h;y+=2.8)k.box('steel',x,y,z,.20,.055,.18);
      }
      if(!tactical){
        for(let u=-b.w/2+2;u<b.w/2-1;u+=2.8){
          const x=b.x+u;
          for(let floor=1;floor<levels;floor++){
            const y=floor*b.h/levels+1.25;
            k.box('steel',x,y,z,.075,1.45,.13);
            k.box('stone',x,y-.85,z,.95,.10,.18);
          }
        }
      }
    }
    for(const x of [b.x-b.w/2+.25,b.x+b.w/2-.25]){
      for(const z of [b.z-b.d/2+.35,b.z+b.d/2-.35])
        k.box('steel',x,b.h+.10,z,.11,.27,.11);
    }
    // Air conditioning hardware is on the roof, never placed over exit paths.
    if(!tactical){
      k.box('paintMetal',b.x+b.w*.20,b.h+.18,b.z-b.d*.17,1.35,.24,1.25);
      for(let i=0;i<5;i++)k.box('steel',b.x+b.w*.2-.45+i*.22,
        b.h+.30,b.z-b.d*.17,.075,.08,1.0);
    }
  }
  k.finish();return k;
}

import './generate-vertical-layout.mjs';
import fs from 'node:fs';
import map from '../packages/shared/MapLayout.json' with {type:'json'};
const url=new URL('../packages/shared/VerticalLayout.json',import.meta.url);
const layout=JSON.parse(fs.readFileSync(url,'utf8'));
const legacy=new Set(layout.tacticalIds);
const levelsById={};
const add=(id,kind,x,y,z,w,h,d)=>layout.boxes.push({buildingId:id,kind,x,y,z,w,h,d,solid:true,display:true});
const flat=(id,kind,x,z,w,d,y)=>{add(id,kind,x,y-.13,z,w,.26,d);layout.surfaces.push({buildingId:id,kind,x,z,w,d,y});};
// Subtract a real aperture from solid walls; renderer and server share the result.
function cut(id,c){
 const result=[];
 for(const b of layout.boxes){
  if(b.buildingId!==id||!['wall','lintel','parapet'].includes(b.kind)){result.push(b);continue;}
  const lo=[b.x-b.w/2,b.y-b.h/2,b.z-b.d/2],hi=[b.x+b.w/2,b.y+b.h/2,b.z+b.d/2];
  const cl=[c.x-c.w/2,c.y-c.h/2,c.z-c.d/2],ch=[c.x+c.w/2,c.y+c.h/2,c.z+c.d/2];
  const a=lo.map((v,i)=>Math.max(v,cl[i])),e=hi.map((v,i)=>Math.min(v,ch[i]));
  if(a.some((v,i)=>v>=e[i]-.001)){result.push(b);continue;}
  const emit=(l,h)=>{if(h.some((v,i)=>v-l[i]<.01))return;result.push({...b,x:(l[0]+h[0])/2,y:(l[1]+h[1])/2,z:(l[2]+h[2])/2,w:h[0]-l[0],h:h[1]-l[1],d:h[2]-l[2]});};
  for(let axis=0;axis<3;axis++){const h=[...hi];h[axis]=a[axis];emit(lo,h);lo[axis]=a[axis];const l=[...lo];l[axis]=e[axis];emit(l,hi);hi[axis]=e[axis];}
 }
 layout.boxes=result;
}
for(const b of map.buildings.filter(b=>b.role!=='CAR')){
 const left=b.x-b.w/2,right=b.x+b.w/2,back=b.z-b.d/2,front=b.z+b.d/2;
 const roof=b.h+.25,levels=legacy.has(b.id)?[0,3.25,roof]:Array.from({length:Math.max(2,Math.round(roof/3.5))+1},(_,i)=>i*roof/Math.max(2,Math.round(roof/3.5)));
 levelsById[b.id]=levels;
 if(!legacy.has(b.id)){
  layout.boxes=layout.boxes.filter(p=>p.buildingId!==b.id);
  layout.tacticalIds.push(b.id);
  add(b.id,'wall',b.x,b.h/2,front,b.w,b.h,.28);add(b.id,'wall',b.x,b.h/2,back,b.w,b.h,.28);
  add(b.id,'wall',left,b.h/2,b.z,.28,b.h,b.d);add(b.id,'wall',right,b.h/2,b.z,.28,b.h,b.d);
  // Open stairwell on the left. A broad room slab stays clear of both flights.
  const stairLeft=left+.5,stairRight=left+4.5,z0=back+1.15,z1=front-1.15;
  for(let k=1;k<levels.length;k++){
   const y=levels[k],top=k===levels.length-1;
   flat(b.id,top?'roof':'floor',(stairRight+right)/2,b.z,right-stairRight,b.d,y);
   // Continuous end landings connect the indoor flights to each storey.
   for(const z of [z0,z1])flat(b.id,'bridge',(stairLeft+stairRight+.5)/2,z,stairRight+.5-stairLeft,.8,y);
   add(b.id,'cover',b.x+1.8,y+.4,b.z,1.2,.8,.65);
  }
  for(let k=0;k<levels.length-1;k++){
   const reverse=k%2===0,low=levels[k],high=levels[k+1];
   const yMin=reverse?high:low,yMax=reverse?low:high;
   const lane=k%2;
   layout.ramps.push({buildingId:b.id,kind:'indoor-ramp',xMin:stairLeft+lane*2,xMax:stairLeft+lane*2+1.85,zMin:z0,zMax:z1,yMin,yMax});
   const xMin=right+.35+lane*1.9;
   layout.ramps.push({buildingId:b.id,kind:'ramp',xMin,xMax:xMin+1.85,zMin:z0,zMax:z1,yMin,yMax});
   const landingZ=reverse?z0:z1;
   flat(b.id,'bridge',right+1.9,landingZ,4.5,.85,high);
   // Every exterior landing has a full-height entry, including the roof.
   cut(b.id,{x:right,y:high+1.25,z:landingZ,w:.8,h:2.5,d:2.2});
  }
  cut(b.id,{x:b.x,y:1.3,z:front,w:3.2,h:2.6,d:.8});
 }
 // Open ribbon windows: low sill, wide shooting aperture, structural piers.
 for(const y of levels.slice(0,-1)){
  for(const side of [0,1,2,3]){
   const width=side<2?b.w:b.d,n=Math.max(2,Math.floor(width/3.2)),bay=width/n;
   for(let i=0;i<n;i++){
    const u=-width/2+(i+.5)*bay;
    const c=side<2?{x:b.x+u,z:side===0?front:back,w:bay-.42,d:.8}:{x:side===2?right:left,z:b.z+u,w:.8,d:bay-.42};
    cut(b.id,{...c,y:y+1.75,h:2.1});
   }
  }
 }
}
layout.version=2;layout.levelsById=levelsById;
fs.writeFileSync(url,JSON.stringify(layout,null,2)+'\n');
console.log(`Open city: ${layout.tacticalIds.length} buildings, ${layout.ramps.length} ramps`);
// Refresh the server-side 3-D navigation cache whenever the city layout changes.
// The runtime verifies a fingerprint before loading it; a stale cache is never used.
await import('./generate-zombie-nav-cache.mjs');

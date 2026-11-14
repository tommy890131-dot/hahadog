import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const MAP=JSON.parse(fs.readFileSync(path.join(ROOT,'packages/shared/MapLayout.json'),'utf8'));
const TACTICAL=['b0_0','b0_2','b3_1','b3_3'];
const MIDDLE=3.25, THICK=.28;
const boxes=[],surfaces=[],ramps=[];
const addBox=(buildingId,kind,x,y,z,w,h,d,solid=true,display=true)=>{
  if(w<=0||h<=0||d<=0)throw new Error('Invalid geometry '+kind);
  const box={buildingId,kind,x,y,z,w,h,d,solid,display};
  boxes.push(box);
  return box;
};
const addFlat=(id,kind,x,z,w,d,y)=>surfaces.push({buildingId:id,kind,x,z,w,d,y});
for(const b of MAP.buildings){
 if(!TACTICAL.includes(b.id)){
   const h=b.role==='CAR'?1.46:b.h;
   addBox(b.id,b.role==='CAR'?'car':'full',b.x,h/2,b.z,b.w,h,b.d,true,false);
   continue;
 }
 const w=b.w,d=b.d,h=b.h,front=b.z+d/2,back=b.z-d/2,left=b.x-w/2,right=b.x+w/2;
 const slabRoof=h+.25, door=2.8;
 // Four exterior walls; the front has a real 2.8m clear opening 2.6m high.
 const sideW=(w-door)/2;
 addBox(b.id,'wall',b.x-w/2+sideW/2,h/2,front,sideW,h,THICK);
 addBox(b.id,'wall',b.x+w/2-sideW/2,h/2,front,sideW,h,THICK);
 addBox(b.id,'lintel',b.x,(h+2.65)/2,front,door,h-2.65,THICK);
 addBox(b.id,'wall',b.x,h/2,back,w,h,THICK);
 addBox(b.id,'wall',left,h/2,b.z,THICK,h,d);
 // The upper storey has an exterior landing and a door in the RIGHT wall.
 // Lower part and header continue across the opening; side piers are real.
 const zDoor=back+1.65,doorW=2.3;
 addBox(b.id,'wall',right,3.15/2,b.z,THICK,3.15,d);
 addBox(b.id,'wall',right,(h+5.65)/2,b.z,THICK,h-5.65,d);
 const backLen=zDoor-doorW/2-back,frontLen=front-(zDoor+doorW/2);
 addBox(b.id,'wall',right,(3.15+5.65)/2,back+backLen/2,THICK,2.5,backLen);
 addBox(b.id,'wall',right,(3.15+5.65)/2,zDoor+doorW/2+frontLen/2,THICK,2.5,frontLen);
 // 2F has a cut-open interior stairwell, NOT a full slab over the ramp.
 const stairMin=left+.48,stairMax=left+2.58;
 const smallStrip=stairMin-left,mainStrip=right-stairMax;
 addBox(b.id,'floor',left+smallStrip/2,MIDDLE-.13,b.z,smallStrip,.26,d);
 addFlat(b.id,'floor',left+smallStrip/2,b.z,smallStrip,d,MIDDLE);
 addBox(b.id,'floor',stairMax+mainStrip/2,MIDDLE-.13,b.z,mainStrip,.26,d);
 addFlat(b.id,'floor',stairMax+mainStrip/2,b.z,mainStrip,d,MIDDLE);
 // The roof remains a complete walkable slab.
 addBox(b.id,'roof',b.x,slabRoof-.15,b.z,w,.30,d);
 addFlat(b.id,'roof',b.x,b.z,w,d,slabRoof);
 const x1Min=right+.35, rampW=1.85, x1Max=x1Min+rampW;
 const x2Min=x1Max+.04, x2Max=x2Min+rampW;
 const zMin=back+1.15, zMax=front-1.15;
 // True indoor stair ramp: enter from the front door, turn left and climb to 2F.
 ramps.push({buildingId:b.id,kind:'indoor-ramp',xMin:stairMin+.10,xMax:stairMax-.10,zMin,zMax,yMin:MIDDLE,yMax:0});
 const interiorBridgeLeft=stairMin,interiorBridgeRight=stairMax+1.05;
 addBox(b.id,'bridge',(interiorBridgeLeft+interiorBridgeRight)/2,MIDDLE-.11,zMin,
   interiorBridgeRight-interiorBridgeLeft,.22,.70);
 addFlat(b.id,'bridge',(interiorBridgeLeft+interiorBridgeRight)/2,zMin,
   interiorBridgeRight-interiorBridgeLeft,.70,MIDDLE);
 // Exterior switchback provides an alternative evacuation route to the roof.
 ramps.push({buildingId:b.id,kind:'ramp',xMin:x1Min,xMax:x1Max,zMin,zMax,yMin:MIDDLE,yMax:0});
 ramps.push({buildingId:b.id,kind:'ramp',xMin:x2Min,xMax:x2Max,zMin,zMax,yMin:MIDDLE,yMax:slabRoof});
 // Wide landings connect the flights with second floor and rooftop doors.
 const bridgeLeft=right-.35,bridgeRight=x2Max+.10;
 addBox(b.id,'bridge', (bridgeLeft+bridgeRight)/2,MIDDLE-.11,zMin,bridgeRight-bridgeLeft,.22,.70);
 addFlat(b.id,'bridge',(bridgeLeft+bridgeRight)/2,zMin,bridgeRight-bridgeLeft,.70,MIDDLE);
 addBox(b.id,'bridge', (bridgeLeft+bridgeRight)/2,slabRoof-.11,zMax,bridgeRight-bridgeLeft,.22,.70);
 addFlat(b.id,'bridge',(bridgeLeft+bridgeRight)/2,zMax,bridgeRight-bridgeLeft,.70,slabRoof);
 // Roof parapets leave the north-east access landing open.
 const guard=.78;
 addBox(b.id,'parapet',b.x,slabRoof+guard/2,back,w,guard,.23);
 addBox(b.id,'parapet',b.x,slabRoof+guard/2,front,w,guard,.23);
 addBox(b.id,'parapet',left,slabRoof+guard/2,b.z,.23,guard,d);
 // side parapet split at zMax (bridge opening)
 const gapBegin=zMax-1.1,gapEnd=zMax+1.1;
 const lenA=gapBegin-back,lenB=front-gapEnd;
 if(lenA>.1)addBox(b.id,'parapet',right,slabRoof+guard/2,back+lenA/2,.23,guard,lenA);
 if(lenB>.1)addBox(b.id,'parapet',right,slabRoof+guard/2,gapEnd+lenB/2,.23,guard,lenB);
 // Ventilation housings provide believable, collidable rooftop cover.
 for(let i=0;i<2;i++){
   addBox(b.id,'vent',b.x+(i===0?-w*.23:w*.25),slabRoof+.475,
     b.z+(i===0?-.8:1.4),1.8,.95,1.3);
 }
 // Ground and first-floor cover: each is collidable and jumpable.
 const cover=[
   [b.x-w*.21,.57,b.z-d*.13,1.40,1.14,1.06],
   [b.x+w*.21,.45,b.z+d*.08,1.35,.90,1.0],
   [b.x-w*.21,MIDDLE+.55,b.z+d*.15,1.25,1.1,1.0]
 ];
 for(const [x,y,z,cw,ch,cd] of cover){
   addBox(b.id,'cover',x,y,z,cw,ch,cd);
   addFlat(b.id,'cover',x,z,cw,cd,y+ch/2);
 }
}
const output={version:1,halfSize:MAP.halfSize,tacticalIds:TACTICAL,boxes,surfaces,ramps};
fs.writeFileSync(path.join(ROOT,'packages/shared/VerticalLayout.json'),JSON.stringify(output,null,2)+'\n');
console.log(`Vertical layout generated: ${TACTICAL.length} enterable buildings, ${boxes.length} solids, ${surfaces.length} platforms, ${ramps.length} ramps`);

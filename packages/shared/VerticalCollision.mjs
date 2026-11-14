/** Shared 3-D movement, floor and ramp collision for browser and authoritative server. */
import layout from './VerticalLayout.json' with { type: 'json' };

export const PHYSICS = Object.freeze({
  eyeHeight:1.7, bodyHeight:1.7, playerRadius:.36,
  gravity:19.6, jumpVelocity:7.5, stepHeight:.38, walkStep:.125
});
export const VERTICAL_LAYOUT=layout;
export const TACTICAL_IDS=new Set(layout.tacticalIds);
const finite=Number.isFinite;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const within=(v,c,sz)=>v>=c-sz/2-1e-5&&v<=c+sz/2+1e-5;
const buckets=new Map();
for(const b of layout.boxes){
 for(let ix=Math.floor((b.x-b.w/2-1)/8);ix<=Math.floor((b.x+b.w/2+1)/8);ix++)
 for(let iz=Math.floor((b.z-b.d/2-1)/8);iz<=Math.floor((b.z+b.d/2+1)/8);iz++){
  const key=ix+':'+iz,list=buckets.get(key)??[];list.push(b);buckets.set(key,list);
 }
}
const nearby=(x,z)=>buckets.get(Math.floor(x/8)+':'+Math.floor(z/8))??[];

/** Highest reachable surface: ground, upstairs slab, rooftop, cover or sloped ramp. */
export function surfaceHeightAt(x,z,feet=0,reach=PHYSICS.stepHeight){
  if(![x,z,feet,reach].every(finite))return null;
  let highest=-Infinity;
  if(0<=feet+reach)highest=0;
  for(const s of layout.surfaces){
    if(!within(x,s.x,s.w+2*PHYSICS.playerRadius)||!within(z,s.z,s.d+2*PHYSICS.playerRadius))continue;
    if(s.y<=feet+reach && s.y>highest)highest=s.y;
  }
  for(const r of layout.ramps){
    if(x<r.xMin||x>r.xMax||z<r.zMin||z>r.zMax)continue;
    const t=clamp((z-r.zMin)/(r.zMax-r.zMin),0,1);
    const y=r.yMin+(r.yMax-r.yMin)*t;
    if(y<=feet+reach&&y>highest)highest=y;
  }
  return highest===-Infinity?null:highest;
}

/** The player is a standing capsule (XZ circle x vertical interval). */
export function canOccupyAt(x,z,feet,radius=PHYSICS.playerRadius,height=PHYSICS.bodyHeight){
  if(![x,z,feet,radius,height].every(finite))return false;
  if(radius<=0||height<=0||Math.abs(x)>layout.halfSize-radius||Math.abs(z)>layout.halfSize-radius||feet<-.1||feet>35)return false;
  for(const b of radius<=1?nearby(x,z):layout.boxes){
    if(!b.solid)continue;
    const minY=b.y-b.h/2,maxY=b.y+b.h/2;
    if(feet+height<=minY+.005||feet>=maxY-.005)continue;
    const px=clamp(x,b.x-b.w/2,b.x+b.w/2);
    const pz=clamp(z,b.z-b.d/2,b.z+b.d/2);
    if((x-px)**2+(z-pz)**2<radius**2)return false;
  }
  return true;
}

/** Wall-swept movement with axis sliding, never trusting client-supplied Y. */
export function moveHorizontal(x,z,feet,dx,dz,grounded,radius=PHYSICS.playerRadius){
  if(![x,z,feet,dx,dz].every(finite))return {x,z,feet};
  let cx=x,cz=z,cy=feet;
  const sweep=(sx,sz)=>{
    const steps=Math.max(1,Math.ceil(Math.hypot(sx,sz)/PHYSICS.walkStep));
    for(let i=0;i<steps;i++){
      const nx=cx+sx/steps,nz=cz+sz/steps;
      const support=grounded?surfaceHeightAt(nx,nz,cy,PHYSICS.stepHeight):null;
      // Ascend/descend short steps and ramps while standing on them.
      const candidate=grounded&&support!==null&&Math.abs(support-cy)<=PHYSICS.stepHeight ? support:cy;
      if(!canOccupyAt(nx,nz,candidate,radius))break;
      cx=nx;cz=nz;cy=candidate;
    }
  };
  sweep(dx,0);
  sweep(0,dz);
  return {x:cx,z:cz,feet:cy};
}

/** Fixed-step-compatible kinematic gravity, grounded detection and ceiling clamp. */
export function stepVertical(y,vy,grounded,x,z,dt){
  if(![y,vy,x,z,dt].every(finite))return {y:0,vy:0,grounded:true};
  const frame=clamp(dt,0,.05);
  const floor=surfaceHeightAt(x,z,y,PHYSICS.stepHeight);
  if(grounded && floor!==null && Math.abs(y-floor)<=PHYSICS.stepHeight){
    return {y:floor,vy:0,grounded:true};
  }
  let velocity=vy-PHYSICS.gravity*frame;
  let nextY=y+velocity*frame;
  const lower=surfaceHeightAt(x,z,y,.02);
  if(velocity<=0 && lower!==null && nextY<=lower && y>=lower-.04){
    return {y:lower,vy:0,grounded:true};
  }
  if(velocity>0 && !canOccupyAt(x,z,nextY)){
    // Clamp against the underside of a slab rather than passing through it.
    let ceiling=Infinity;
    for(const b of layout.boxes){
      if(!b.solid)continue;
      const nearX=clamp(x,b.x-b.w/2,b.x+b.w/2);
      const nearZ=clamp(z,b.z-b.d/2,b.z+b.d/2);
      if((x-nearX)**2+(z-nearZ)**2>=PHYSICS.playerRadius**2)continue;
      const underside=b.y-b.h/2;
      if(underside>=y+PHYSICS.bodyHeight-.02&&underside<ceiling)ceiling=underside;
    }
    if(ceiling!==Infinity){nextY=Math.min(nextY,ceiling-PHYSICS.bodyHeight-.01);velocity=0;}
  }
  if(nextY<0){nextY=0;velocity=0;return {y:0,vy:velocity,grounded:true};}
  return {y:nextY,vy:velocity,grounded:false};
}

/**
 * DEADLINE FOUR V3.13 - UNDERGROUND METRO.
 * Shared by the visual scene, client kinematics and authoritative server.
 * Designed as a single-level 160m x 56m accessible station with platform
 * rooms, concrete columns, a halted train, ticket gates and two escape exits.
 * Coordinates are independent of the city map: only one map is active per room.
 */
export const METRO_MAP_ID='underground_metro';
export const METRO_MAP=Object.freeze({
  id:METRO_MAP_ID,title:'地下捷運・斷線終點站',
  halfSize:90,
  safehouse:{x:-66,z:-15,radius:10},
  starts:[[-69,-14],[-65,-14],[-69,-10],[-65,-10]],
  spawns:[
    {x:-54,z:15},{x:-38,z:15},{x:-24,z:15},{x:-6,z:15},
    {x:9,z:16},{x:34,z:16},{x:54,z:16},{x:60,z:-14},
    {x:26,z:-14},{x:42,z:-14},{x:52,z:-14},{x:-12,z:15}
  ]
});
export const METRO_BOXES=Object.freeze([
  // Contiguous outer walls (station is 160m long and 56m wide).
  {id:'north',x:0,z:-28,w:164,d:2,h:6,y:3,solid:true,role:'wall'},
  {id:'south',x:0,z:28,w:164,d:2,h:6,y:3,solid:true,role:'wall'},
  {id:'west',x:-81,z:0,w:2,d:56,h:6,y:3,solid:true,role:'wall'},
  {id:'east',x:81,z:0,w:2,d:56,h:6,y:3,solid:true,role:'wall'},
  // Station columns along platforms, intentionally leaving 3m+ walking gaps.
  ...[-48,-18,12,42,60].flatMap((x,i)=>[
    {id:'columnN'+i,x,z:-20,w:1.6,d:1.6,y:2.2,h:4.4,solid:true,role:'column'},
    {id:'columnS'+i,x,z:20,w:1.6,d:1.6,y:2.2,h:4.4,solid:true,role:'column'}
  ]),
  // Stopped train on one track. The other side of the platform remains open.
  {id:'train-body',x:19,z:2,w:31,d:6,y:1.6,h:3.2,solid:true,role:'train'},
  {id:'train-engine',x:39,z:2,w:8,d:6,y:1.6,h:3.2,solid:true,role:'train'},
  // Ticket barriers and maintenance equipment.
  {id:'ticket-gate-n',x:-44,z:-13,w:2,d:3,y:.62,h:1.24,solid:true,role:'gate'},
  {id:'ticket-gate-s',x:-44,z:13,w:2,d:3,y:.62,h:1.24,solid:true,role:'gate'},
  {id:'supply-cabinet',x:1,z:-23,w:2.3,d:2,y:1,h:2,solid:true,role:'equipment'},
  {id:'equipment-bay',x:49,z:23,w:2.6,d:2.1,y:1.4,h:2.8,solid:true,role:'equipment'},
  // Expanded tactical subway: emergency machine rooms, platform benches,
  // sealed service alcove and electrical cabinets with traversable aisle gaps.
  {id:'subway-workshop',x:-61,z:22,w:7,d:4,h:2.5,y:1.25,solid:true,role:'equipment'},
  {id:'subway-breaker-bay',x:-63,z:-24,w:4,d:2.6,h:2.4,y:1.2,solid:true,role:'equipment'},
  {id:'metro-bench-n1',x:-24,z:-22,w:3.4,d:1.1,h:.95,y:.475,solid:true,role:'gate'},
  {id:'metro-bench-n2',x:17,z:-22,w:3.4,d:1.1,h:.95,y:.475,solid:true,role:'gate'},
  {id:'metro-bench-s1',x:-25,z:23,w:3.4,d:1.1,h:.95,y:.475,solid:true,role:'gate'},
  {id:'metro-bench-s2',x:23,z:23,w:3.4,d:1.1,h:.95,y:.475,solid:true,role:'gate'},
  {id:'metro-service-desk',x:-7,z:24,w:3.5,d:1.4,h:1.15,y:.575,solid:true,role:'gate'}
]);
const EPS=.00001;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function nearbyBox(x,z,r,b){
  const px=clamp(x,b.x-b.w/2,b.x+b.w/2),pz=clamp(z,b.z-b.d/2,b.z+b.d/2);
  return (x-px)**2+(z-pz)**2<r*r-EPS;
}
export function metroCanOccupy(x,z,feet=0,radius=.36,height=1.7){
  if(![x,z,feet,radius,height].every(Number.isFinite)||radius<=0||height<=0)return false;
  if(Math.abs(x)>METRO_MAP.halfSize-radius||Math.abs(z)>METRO_MAP.halfSize-radius||feet<-.01||feet>3.6)return false;
  for(const b of METRO_BOXES){
    if(feet+height<=b.y-b.h/2+.005||feet>=b.y+b.h/2-.005)continue;
    if(nearbyBox(x,z,radius,b))return false;
  }
  return true;
}
export function metroMoveHorizontal(x,z,feet,dx,dz,grounded,radius=.36){
  if(![x,z,feet,dx,dz].every(Number.isFinite))return {x,z,feet};
  let cx=x,cz=z;
  const sweep=(sx,sz)=>{
    const n=Math.max(1,Math.ceil(Math.hypot(sx,sz)/.125));
    for(let i=0;i<n;i++){
      const nx=cx+sx/n,nz=cz+sz/n;
      if(!metroCanOccupy(nx,nz,feet,radius))break;
      cx=nx;cz=nz;
    }
  };
  sweep(dx,0);sweep(0,dz);
  return {x:cx,z:cz,feet};
}
export function metroStepVertical(y,vy,grounded,x,z,dt){
  if(![y,vy,x,z,dt].every(Number.isFinite))return {y:0,vy:0,grounded:true};
  if(grounded&&Math.abs(y)<.01)return {y:0,vy:0,grounded:true};
  const fall=vy-19.6*clamp(dt,0,.05);
  const next=y+fall*clamp(dt,0,.05);
  if(next<=0)return {y:0,vy:0,grounded:true};
  return {y:next,vy:fall,grounded:false};
}
const CELL=2;
const LENGTH=81;
const CENTER=40;
const key=(i,j)=>j*LENGTH+i;
const passable=new Uint8Array(LENGTH*LENGTH);
for(let j=0;j<LENGTH;j++)for(let i=0;i<LENGTH;i++)
  passable[key(i,j)]=metroCanOccupy((i-CENTER)*CELL,(j-CENTER)*CELL,0,.68)?1:0;
const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
function closestCell(x,z){
  const i=clamp(Math.round(x/CELL+CENTER),0,LENGTH-1),
    j=clamp(Math.round(z/CELL+CENTER),0,LENGTH-1);
  for(let radius=0;radius<8;radius++){
    for(let dj=-radius;dj<=radius;dj++)for(let di=-radius;di<=radius;di++){
      const a=i+di,b=j+dj;if(a<0||b<0||a>=LENGTH||b>=LENGTH)continue;
      if(passable[key(a,b)])return key(a,b);
    }
  }
  return -1;
}
export function metroFlowField(target){
  const n=LENGTH*LENGTH,dist=new Int32Array(n).fill(-1),next=new Int32Array(n).fill(-1);
  const start=closestCell(target.x,target.z),queue=new Int32Array(n);
  if(start<0)return {dist,next};
  dist[start]=0;let head=0,tail=0;queue[tail++]=start;
  while(head<tail){
    const cell=queue[head++],i=cell%LENGTH,j=(cell/LENGTH)|0;
    for(const [dx,dz] of dirs){
      const ni=i+dx,nj=j+dz;
      if(ni<0||nj<0||ni>=LENGTH||nj>=LENGTH)continue;
      const cell2=key(ni,nj);
      if(!passable[cell2]||dist[cell2]>=0)continue;
      dist[cell2]=dist[cell]+1;next[cell2]=cell;queue[tail++]=cell2;
    }
  }
  return {dist,next,targetX:target.x,targetZ:target.z};
}
export function metroRouteDirection(zombie,player,field){
  const directX=player.x-zombie.x,directZ=player.z-zombie.z,
    directLength=Math.hypot(directX,directZ);
  if(directLength<2.5)return {dx:directX,dz:directZ};
  // Try direct line of sight first, subdivided to prevent corners being crossed.
  let clear=true;
  for(let i=1;i<=Math.ceil(directLength);i++){
    const t=Math.min(1,i/directLength);
    if(!metroCanOccupy(zombie.x+directX*t,zombie.z+directZ*t,0,.46)){clear=false;break;}
  }
  if(clear)return {dx:directX,dz:directZ};
  const cell=closestCell(zombie.x,zombie.z);
  const step=cell>=0?field?.next[cell]:-1;
  if(step>=0)return {dx:(step%LENGTH-CENTER)*CELL-zombie.x,
    dz:(((step/LENGTH)|0)-CENTER)*CELL-zombie.z};
  return {dx:0,dz:0};
}
export function metroPursue(zombie,player,field,dt){
  const v=metroRouteDirection(zombie,player,field),norm=Math.hypot(v.dx,v.dz);
  if(norm<.01){zombie.moving=false;return;}
  const max=Math.min(.12,Math.max(0,dt)*Math.max(.6,zombie.speed||2.8));
  const oldX=zombie.x,oldZ=zombie.z,oldY=zombie.y;
  const move=metroMoveHorizontal(oldX,oldZ,0,v.dx/norm*max,v.dz/norm*max,true,.38);
  zombie.x=move.x;zombie.z=move.z;zombie.y=0;zombie.vy=0;zombie.grounded=true;
  const dx=zombie.x-oldX,dz=zombie.z-oldZ;
  zombie.moving=Math.hypot(dx,dz)>.003;
  if(zombie.moving)zombie.facing=Math.atan2(-dx,-dz);
  zombie.step=(zombie.step??0)+(zombie.moving?Math.hypot(dx,dz)*4.5:0);
  zombie.vx=dx/Math.max(.01,dt);zombie.vz=dz/Math.max(.01,dt);
}
export function metroCollisionBoxes(){
  return METRO_BOXES.filter(x=>x.solid).map(b=>({
    minX:b.x-b.w/2,maxX:b.x+b.w/2,minZ:b.z-b.d/2,maxZ:b.z+b.d/2,
    minY:b.y-b.h/2,maxY:b.y+b.h/2
  }));
}

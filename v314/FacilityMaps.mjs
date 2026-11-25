/**
 * DEADLINE FOUR V3.14 — original hospital and harbor combat spaces.
 * Geometry, spawn lanes, player collision and enemy navigation share these
 * exact immutable coordinates in browser and authoritative Node.js.
 */
const wall=(id,x,z,w,d)=>({id,x,z,w,d,y:2.4,h:4.8,solid:true,role:'wall'});
const prop=(id,x,z,w,d,h,role)=>({id,x,z,w,d,y:h/2,h,solid:true,role});
const exits={
 hospital:[
   {id:'ambulance',label:'急診救護車',x:66,y:0,z:-4,radius:6,requires:'generator'},
   {id:'helipad',label:'院區直升機',x:61,y:0,z:62,radius:7,requires:'relay'}
 ],
 harbor:[
   {id:'rescue_boat',label:'海上救援艇',x:66,y:0,z:44,radius:7,requires:'generator'},
   {id:'dock_truck',label:'碼頭防彈卡車',x:-65,y:0,z:47,radius:6,requires:'relay'}
 ]
};
const hospitalBoxes=[
 wall('hospital-west',-79,0,2,156),wall('hospital-east',79,0,2,156),
 wall('hospital-north',0,-79,158,2),wall('hospital-south',0,79,158,2),
 // Northern wards: staggered partitions, doors into -Z service corridor.
 ...[-45,-10,25,58].map((x,i)=>wall('ward-partition-'+i,x,-52,1.2,26)),
 // Southern surgery wing and radiology labs with door gaps on central corridor.
 ...[-43,-9,25,58].map((x,i)=>wall('surgery-partition-'+i,x,50,1.2,25)),
 ...[-58,-28,0,32].map((x,i)=>prop('patient-bed-'+i,x,-63,3.4,1.9,.78,'bed')),
 ...[-58,-28,0,32].map((x,i)=>prop('bed-side-'+i,x,-58,1.1,1.1,1.15,'cabinet')),
 ...[-60,-28,0,33].map((x,i)=>prop('operation-table-'+i,x,65,3.5,1.8,.83,'surgery')),
 ...[-30,2,35].map((x,i)=>prop('nursing-desk-'+i,x,3,6,1.6,1.15,'desk')),
 prop('reception',-54,-26,8,2,1.35,'desk'),
 prop('ambulance-gate',58,-24,3.5,1.6,1.1,'equipment'),
 prop('hospital-generator-cabinet',-23,-32,2.2,1.35,1.35,'equipment'),
 prop('hospital-isolation-panel',19,-33,1.3,1.3,1.45,'equipment'),
 prop('hospital-medicine',-2,31,2.2,1.5,1.4,'equipment')
];
const harborBoxes=[
 wall('harbor-west',-79,0,2,152),wall('harbor-east',79,0,2,152),
 wall('harbor-north',0,-78,156,2),wall('harbor-south',0,78,156,2),
 // Long container aisles / crane pads: open west-east access along service road.
 ...[-45,-15,15,45].flatMap((x,i)=>[
   prop('container-n-'+i,x,-25,19,7,3.4,'container'),
   prop('container-s-'+i,x,22,19,7,3.4,'container')
 ]),
 prop('warehouse-loader-a',-59,12,6,5,2.2,'warehouse'),
 prop('warehouse-loader-b',-60,32,7,3,1.8,'warehouse'),
 prop('dock-forklift-a',-4,-55,3.3,2.5,2,'equipment'),
 prop('dock-forklift-b',25,57,3.3,2.5,2,'equipment'),
 prop('quay-crane-base',48,-57,6,7,2,'crane'),
 prop('ship-gantry',53,57,5.3,5.2,2.3,'crane')
];
const frozenBoxes=boxes=>Object.freeze(boxes.map(x=>Object.freeze(x)));
export const FACILITY_MAPS=Object.freeze({
 infected_hospital:Object.freeze({
  id:'infected_hospital',label:'感染醫院・封鎖病區',theme:'hospital',
  halfSize:80,ground:{w:158,d:158},
  safehouse:Object.freeze({x:-64,z:-7,radius:11}),
  starts:Object.freeze([[-66,-10],[-62,-10],[-66,-5],[-62,-5]]),
  boxes:frozenBoxes(hospitalBoxes),
  spawns:Object.freeze([
   {x:-65,z:57,gate:'isolation'},{x:-26,z:56,gate:'ward'},
   {x:8,z:55,gate:'ward'},{x:67,z:56,gate:'elevator'},
   {x:64,z:13,gate:'elevator'},{x:64,z:-43,gate:'ambulance'},
   {x:30,z:-65,gate:'isolation'},{x:-28,z:-65,gate:'ward'},
   {x:-65,z:-58,gate:'ambulance'}
  ]),
  devices:Object.freeze([
   {id:'hospitalGenerator',label:'備用電力系統',x:-23,y:0,z:-27,range:3.5,kind:'generator'},
   {id:'hospitalIsolation',label:'隔離病房解鎖',x:19,y:0,z:-26,range:3.5,kind:'seal'},
   {id:'hospitalSiren',label:'急診緊急廣播',x:-8,y:0,z:25,range:3.5,kind:'alarm'},
   {id:'hospitalRadio',label:'直升機通訊台',x:59,y:0,z:45,range:3.5,kind:'relay'}
  ]),
  routes:Object.freeze(exits.hospital.map(x=>Object.freeze(x))),
  directorEntrances:Object.freeze([
   {id:'ward',label:'病房走廊',x:-27,z:-65,types:['walker','spitter','screamer']},
   {id:'isolation',label:'隔離區',x:48,z:56,types:['runner','brute','spitter']},
   {id:'elevator',label:'維修電梯',x:65,z:15,types:['runner','climber','walker']},
   {id:'ambulance',label:'急診入口',x:-65,z:57,types:['walker','juggernaut','runner']}
  ])
 }),
 doomed_harbor:Object.freeze({
  id:'doomed_harbor',label:'末日港口・海霧封鎖線',theme:'harbor',
  halfSize:80,ground:{w:158,d:158},
  safehouse:Object.freeze({x:-64,z:-55,radius:11}),
  starts:Object.freeze([[-67,-54],[-63,-54],[-67,-49],[-63,-49]]),
  boxes:frozenBoxes(harborBoxes),
  spawns:Object.freeze([
   {x:-65,z:48,gate:'warehouse'},{x:-32,z:63,gate:'containers'},
   {x:0,z:63,gate:'containers'},{x:31,z:63,gate:'quay'},
   {x:65,z:41,gate:'quay'},{x:66,z:-1,gate:'pier'},
   {x:66,z:-45,gate:'pier'},{x:25,z:-64,gate:'containers'},
   {x:-25,z:-64,gate:'warehouse'},{x:-65,z:6,gate:'warehouse'}
  ]),
  devices:Object.freeze([
   {id:'harborGenerator',label:'貨櫃場配電站',x:-12,y:0,z:-48,range:3.5,kind:'generator'},
   {id:'harborCrane',label:'貨櫃起重機',x:45,y:0,z:-45,range:3.5,kind:'crane'},
   {id:'harborSiren',label:'港口警報控制器',x:1,y:0,z:48,range:3.5,kind:'alarm'},
   {id:'harborRadio',label:'海岸救援無線電',x:-52,y:0,z:51,range:3.5,kind:'relay'}
  ]),
  routes:Object.freeze(exits.harbor.map(x=>Object.freeze(x))),
  directorEntrances:Object.freeze([
   {id:'containers',label:'貨櫃縫隙',x:31,z:62,types:['runner','climber','walker']},
   {id:'warehouse',label:'倉庫入口',x:-65,z:48,types:['brute','walker','spitter']},
   {id:'pier',label:'港灣船側',x:65,z:-46,types:['runner','screamer','walker']},
   {id:'quay',label:'碼頭通道',x:66,z:43,types:['walker','juggernaut','brute']}
  ])
 })
});
const CELL=2,COUNT=79,CENTER=39,EPS=.00001;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const isFacility=id=>Object.hasOwn(FACILITY_MAPS,id);
export const getFacility=id=>isFacility(id)?FACILITY_MAPS[id]:null;
export function facilityCanOccupy(mapId,x,z,feet=0,radius=.36,height=1.7){
 const map=getFacility(mapId);
 if(!map||![x,z,feet,radius,height].every(Number.isFinite)||
    radius<=0||height<=0||Math.abs(x)>=map.halfSize-radius||
    Math.abs(z)>=map.halfSize-radius||feet<-.01||feet>3.5)return false;
 for(const b of map.boxes){
   if(feet+height<=b.y-b.h/2+.005||feet>=b.y+b.h/2-.005)continue;
   const nearX=clamp(x,b.x-b.w/2,b.x+b.w/2),
     nearZ=clamp(z,b.z-b.d/2,b.z+b.d/2);
   if((x-nearX)**2+(z-nearZ)**2<radius*radius-EPS)return false;
 }
 return true;
}
export function facilityMoveHorizontal(mapId,x,z,feet,dx,dz,grounded,radius=.36){
 if(![x,z,feet,dx,dz].every(Number.isFinite))return {x,z,feet};
 let cx=x,cz=z;
 const sweep=(sx,sz)=>{
  const n=Math.max(1,Math.ceil(Math.hypot(sx,sz)/.125));
  for(let i=0;i<n;i++){
   const px=cx+sx/n,pz=cz+sz/n;
   if(!facilityCanOccupy(mapId,px,pz,feet,radius))break;
   cx=px;cz=pz;
  }
 };
 sweep(dx,0);sweep(0,dz);
 return {x:cx,z:cz,feet};
}
export function facilityStepVertical(y,vy,grounded,x,z,dt){
 if(![y,vy,x,z,dt].every(Number.isFinite))return {y:0,vy:0,grounded:true};
 if(grounded&&Math.abs(y)<.01)return {y:0,vy:0,grounded:true};
 const t=clamp(dt,0,.05),fall=vy-19.6*t,next=y+fall*t;
 return next<=0?{y:0,vy:0,grounded:true}:{y:next,vy:fall,grounded:false};
}
export function facilityCollisionBoxes(mapId){
 return (getFacility(mapId)?.boxes??[]).map(b=>({
  minX:b.x-b.w/2,maxX:b.x+b.w/2,minZ:b.z-b.d/2,maxZ:b.z+b.d/2,
  minY:b.y-b.h/2,maxY:b.y+b.h/2
 }));
}
const flows=new Map();
function navData(mapId){
 if(flows.has(mapId))return flows.get(mapId);
 const data=new Uint8Array(COUNT*COUNT);
 for(let j=0;j<COUNT;j++)for(let i=0;i<COUNT;i++)
  data[j*COUNT+i]=facilityCanOccupy(mapId,(i-CENTER)*CELL,(j-CENTER)*CELL,0,.59)?1:0;
 const result={data};flows.set(mapId,result);return result;
}
function nearest(mapId,x,z){
 const {data}=navData(mapId),ix=clamp(Math.round(x/CELL+CENTER),0,COUNT-1),
   iz=clamp(Math.round(z/CELL+CENTER),0,COUNT-1);
 let best=-1,bestD=Infinity;
 for(let radius=0;radius<=6;radius++){
  for(let dj=-radius;dj<=radius;dj++)for(let di=-radius;di<=radius;di++){
   const a=ix+di,b=iz+dj;if(a<0||b<0||a>=COUNT||b>=COUNT)continue;
   const id=b*COUNT+a;
   if(!data[id])continue;
   const d=di*di+dj*dj;
   if(d<bestD){best=id;bestD=d;}
  }
  if(best>=0)break;
 }
 return best;
}
export function facilityFlowField(mapId,target){
 const {data}=navData(mapId),N=COUNT*COUNT,
   dist=new Int32Array(N).fill(-1),next=new Int32Array(N).fill(-1),
   queue=new Int32Array(N),start=nearest(mapId,target.x,target.z);
 if(start<0)return {dist,next};
 dist[start]=0;
 let front=0,back=0;queue[back++]=start;
 while(front<back){
  const id=queue[front++],x=id%COUNT,z=(id/COUNT)|0;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const xx=x+dx,zz=z+dz;if(xx<0||zz<0||xx>=COUNT||zz>=COUNT)continue;
   const v=zz*COUNT+xx;
   if(!data[v]||dist[v]>=0)continue;
   dist[v]=dist[id]+1;next[v]=id;queue[back++]=v;
  }
 }
 return {dist,next,targetX:target.x,targetZ:target.z};
}
export function facilityRouteDirection(mapId,zombie,target,field){
 const dx=target.x-zombie.x,dz=target.z-zombie.z,d=Math.hypot(dx,dz);
 if(d<=2.2)return {dx,dz};
 let clear=true;
 const n=Math.ceil(d/.8);
 for(let i=1;i<=n;i++){
  const t=i/n;
  if(!facilityCanOccupy(mapId,zombie.x+dx*t,zombie.z+dz*t,0,.45)){clear=false;break;}
 }
 if(clear)return {dx,dz};
 const cell=nearest(mapId,zombie.x,zombie.z),step=cell>=0?field?.next[cell]:-1;
 if(step>=0)return {dx:(step%COUNT-CENTER)*CELL-zombie.x,
   dz:(((step/COUNT)|0)-CENTER)*CELL-zombie.z};
 return {dx:0,dz:0};
}
export function facilityPursue(mapId,zombie,player,field,dt){
 const v=facilityRouteDirection(mapId,zombie,player,field),
   len=Math.hypot(v.dx,v.dz);
 if(len<.005){zombie.moving=false;return;}
 const max=Math.min(.15,Math.max(0,dt)*Math.max(.6,zombie.speed||2.8)),
   {x,y,z}=zombie;
 const result=facilityMoveHorizontal(mapId,x,z,0,v.dx/len*max,v.dz/len*max,true,.38);
 zombie.x=result.x;zombie.z=result.z;zombie.y=0;zombie.grounded=true;zombie.vy=0;
 const mdx=result.x-x,mdz=result.z-z;
 zombie.moving=Math.hypot(mdx,mdz)>.002;
 if(zombie.moving)zombie.facing=Math.atan2(-mdx,-mdz);
 zombie.step=(zombie.step??0)+(zombie.moving?Math.hypot(mdx,mdz)*4.5:0);
 zombie.vx=mdx/Math.max(.01,dt);zombie.vz=mdz/Math.max(.01,dt);
}

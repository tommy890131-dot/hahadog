/**
 * Server-authoritative layered navigation generated from the SAME collider
 * and ramp data used by the browser/player controller. No client-provided Y.
 *
 * Coarse 3m road grid, local 1.5m walkable ground / upper / roof grids,
 * plus sub-metre ramp samples. Edges are validated by the actual kinematic
 * sweep, so a route never crosses a solid wall or teleports between floors.
 */
import fs from 'node:fs';
import {brotliDecompressSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import map from './MapLayout.json' with {type:'json'};
import {
  VERTICAL_LAYOUT, canOccupyAt, moveHorizontal, surfaceHeightAt, stepVertical
} from './VerticalCollision.mjs';

const RADIUS = .36;
const HEIGHT = 1.7;
const HALF = map.halfSize;
const FLOOR = 3.25;
const ROOF = 7.25;
const CELL = 3;
const LOCAL_CELL = 2.4;
const ROAM = 4.4;
const GRID = Math.ceil((2 * HALF) / CELL);
const EPS = .25;
const distance = (a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
// Static nav graph cache: avoids expensive 17k-node collision sweeps on
// every process start. Automatically rejected if the city layout changes.
const CACHE_VERSION='open-interiors-nav-v1';
function navigationFingerprint(){
  const hash=createHash('sha256');
  hash.update(CACHE_VERSION);
  for(const name of ['./MapLayout.json','./VerticalLayout.json'])
    hash.update(fs.readFileSync(new URL(name,import.meta.url)));
  return hash.digest('hex');
}
export function getNavigationFingerprint(){return navigationFingerprint();}
function restoreCachedNavigation(target){
  if(process.env.DEADLINE_REBUILD_NAV_CACHE==='1')return false;
  try{
    const bytes=fs.readFileSync(new URL('./ZombieNavCache.br',import.meta.url));
    const cache=JSON.parse(brotliDecompressSync(bytes).toString('utf8'));
    if(cache.version!==CACHE_VERSION || cache.fingerprint!==navigationFingerprint() ||
       !Array.isArray(cache.nodes) || !Array.isArray(cache.edges) ||
       cache.nodes.length!==cache.edges.length || !Array.isArray(cache.ground))return false;
    target.nodes=cache.nodes;
    target.edges=cache.edges;
    target.ground=Int32Array.from(cache.ground);
    for(const node of target.nodes){
      const key=hash(node.x,node.z,node.y),ids=target.buckets.get(key)??[];
      ids.push(node.id);target.buckets.set(key,ids);
    }
    return true;
  }catch(e){
    if(e?.code!=='ENOENT')console.warn('[ZombieNavigation] Cache invalid; rebuilding',e.message);
    return false;
  }
}


class Heap {
  a=[];
  push(id,d){const arr=this.a; let i=arr.length; arr.push({id,d});while(i>0){const p=(i-1)>>1;if(arr[p].d<=d)break;arr[i]=arr[p];i=p;}arr[i]={id,d};}
  pop(){const arr=this.a; if(!arr.length)return null;const top=arr[0],last=arr.pop();if(!arr.length)return top;let i=0;while(true){let c=i*2+1;if(c>=arr.length)break;if(c+1<arr.length&&arr[c+1].d<arr[c].d)c++;if(arr[c].d>=last.d)break;arr[i]=arr[c];i=c;}arr[i]=last;return top;}
  get size(){return this.a.length;}
}

function hash(x,z,y){return `${Math.floor(x/3.1)}:${Math.floor(z/3.1)}:${Math.floor(y/1.45)}`;}

export class ZombieNavigation {
  nodes=[];
  edges=[];
  buckets=new Map();
  ground=new Int32Array(GRID*GRID).fill(-1);

  constructor(){
    if(restoreCachedNavigation(this))return;
    const add=(x,z,y,tag='walk')=>{
      if(!canOccupyAt(x,z,y,RADIUS,HEIGHT))return -1;
      const id=this.nodes.length;
      this.nodes.push({id,x,y,z,tag});this.edges.push([]);
      const key=hash(x,z,y),bucket=this.buckets.get(key)??[];
      bucket.push(id);this.buckets.set(key,bucket);
      return id;
    };

    // General road navigation, including reachable ground-floor interiors.
    for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++){
      const x=-HALF+(i+.5)*CELL,z=-HALF+(j+.5)*CELL;
      this.ground[j*GRID+i]=add(x,z,0,'road');
    }
    const buildings=map.buildings.filter(b=>VERTICAL_LAYOUT.tacticalIds.includes(b.id));
    for(const b of buildings){
      const minX=b.x-b.w/2-ROAM,maxX=b.x+b.w/2+ROAM+4.4;
      const minZ=b.z-b.d/2-ROAM,maxZ=b.z+b.d/2+ROAM;
      const xValues=[],zValues=[];
      for(let x=minX;x<=maxX+1e-6;x+=LOCAL_CELL)xValues.push(x);
      for(let z=minZ;z<=maxZ+1e-6;z+=LOCAL_CELL)zValues.push(z);
      // Include exact door center, rooftop center and landing center.
      xValues.push(b.x);
      zValues.push(b.z,b.z+b.d/2+1,b.z+b.d/2-1);
      for(const x of xValues)for(const z of zValues){
        if(Math.abs(x)>HALF-1||Math.abs(z)>HALF-1)continue;
        add(x,z,0,'local-ground');
        for(const level of VERTICAL_LAYOUT.levelsById?.[b.id]?.slice(1)??[FLOOR,ROOF]){
          const support=surfaceHeightAt(x,z,level,.04);
          if(support!==null&&Math.abs(support-level)<.04)add(x,z,level,'storey');
        }
      }
      for(const [rampIndex,r] of VERTICAL_LAYOUT.ramps.filter(r=>r.buildingId===b.id).entries()){
        const x=(r.xMin+r.xMax)/2;
        const steps=Math.ceil((r.zMax-r.zMin)/.65);
        for(let i=0;i<=steps;i++){
          const t=i/steps;
          const z=r.zMin+(r.zMax-r.zMin)*t;
          const y=r.yMin+(r.yMax-r.yMin)*t;
          add(x,z,y,`ramp:${b.id}:${rampIndex}`);
        }
      }
    }
    // Construct locally: spatial hashing avoids a quadratic N×N pass.
    for(const a of this.nodes){
      const bx=Math.floor(a.x/3.1),bz=Math.floor(a.z/3.1),by=Math.floor(a.y/1.45);
      const candidates=[];
      for(let ix=-2;ix<=2;ix++)for(let iz=-2;iz<=2;iz++)for(let iy=-1;iy<=1;iy++){
        const ids=this.buckets.get(`${bx+ix}:${bz+iz}:${by+iy}`);
        if(!ids)continue;
        for(const id of ids){
          if(id<=a.id)continue;
          const b=this.nodes[id],xz=Math.hypot(a.x-b.x,a.z-b.z),dy=Math.abs(a.y-b.y);
          if(xz<.12||xz>3.08||dy>1.30||dy>Math.max(.40,xz*.49))continue;
          candidates.push({id,xz,dy});
        }
      }
      candidates.sort((u,v)=>u.xz-v.xz+Math.abs(u.dy-v.dy)*.5);
      // Cap dense local graph degree without excluding long road connectors.
      let linked=0;
      for(const candidate of candidates){
        const b=this.nodes[candidate.id];
        if(this.canTraverse(a,b)&&this.canTraverse(b,a)){
          const cost=distance(a,b)+.015;
          this.edges[a.id].push({id:b.id,cost});
          this.edges[b.id].push({id:a.id,cost});
          if(++linked>=24)break;
        }
      }
    }
  }

  canTraverse(a,b){
    // Two separated ramp flights can only cross at their shared full-height
    // landing. A diagonal shortcut at y≈2.9 otherwise makes agents walk off
    // an unsupported 2.9m ledge and fall through to street level.
    const rA=a.tag.startsWith('ramp:'), rB=b.tag.startsWith('ramp:');
    if(rA && rB && a.tag!==b.tag && Math.abs(a.y-b.y)>.09)return false;
    if((rA||rB) && a.tag!==b.tag && Math.abs(a.y-b.y)>.27)return false;
    // Use the exact server/player collision routine, including slope stepping,
    // wall sliding and an upper-floor / rooftop floor-height check.
    const moved=moveHorizontal(a.x,a.z,a.y,b.x-a.x,b.z-a.z,true,RADIUS);
    return Math.hypot(moved.x-b.x,moved.z-b.z)<EPS && Math.abs(moved.feet-b.y)<.32;
  }

  closest(x,z,y){
    const bx=Math.floor(x/3.1),bz=Math.floor(z/3.1),by=Math.floor(y/1.45);
    let best=-1,score=Infinity;
    for(let radius=0;radius<=5;radius++){
      for(let ix=-radius;ix<=radius;ix++)for(let iz=-radius;iz<=radius;iz++)for(let iy=-1;iy<=1;iy++){
        const ids=this.buckets.get(`${bx+ix}:${bz+iz}:${by+iy}`);
        if(!ids)continue;
        for(const id of ids){const n=this.nodes[id];const dy=Math.abs(n.y-y);
          if(dy>1.15)continue;
          const d=(n.x-x)**2+(n.z-z)**2+dy*dy*9;
          if(d<score){best=id;score=d;}
        }
      }
      if(best>=0 && score<(radius*3.1-2)**2)break;
    }
    return best;
  }

  /** Dijkstra reverse flow: every node stores a shortest-path next waypoint. */
  routeTo(target){
    const goal=this.closest(target.x,target.z,target.y??0);
    const dist=new Float64Array(this.nodes.length).fill(Infinity);
    const next=new Int32Array(this.nodes.length).fill(-1);
    if(goal<0)return {goal,dist,next};
    dist[goal]=0;const heap=new Heap();heap.push(goal,0);
    while(heap.size){const cur=heap.pop();if(cur.d>dist[cur.id]+1e-6)continue;
      for(const e of this.edges[cur.id]){
        const cost=cur.d+e.cost;
        if(cost+1e-5<dist[e.id]){dist[e.id]=cost;next[e.id]=cur.id;heap.push(e.id,cost);}
      }
    }
    return {goal,dist,next};
  }

  /** Returns a walkable route as world-space waypoints; useful for debugging. */
  path(from,to,maxNodes=500){
    const a=this.closest(from.x,from.z,from.y??0),field=this.routeTo(to);
    if(a<0||!Number.isFinite(field.dist[a]))return [];
    const result=[{...this.nodes[a]}],seen=new Set([a]);let cur=a;
    for(let i=0;i<maxNodes&&cur!==field.goal;i++){
      cur=field.next[cur];if(cur<0||seen.has(cur))break;
      seen.add(cur);result.push({...this.nodes[cur]});
    }
    return result;
  }
}

export const navigation=new ZombieNavigation();

/** Spatial hashing: O(n) construction, O(k) queries in nearby buckets. */
export function buildZombieBuckets(zombies,cell=1.8){
  const buckets=new Map();
  const key=(x,z)=>`${Math.floor(x/cell)}:${Math.floor(z/cell)}`;
  for(const z of zombies){const k=key(z.x,z.z),list=buckets.get(k)??[];
    list.push(z);buckets.set(k,list);
  }
  return {near(z){const x=Math.floor(z.x/cell),zz=Math.floor(z.z/cell),items=[];
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
      const found=buckets.get(`${x+i}:${zz+j}`);if(found)items.push(...found);
    }
    return items;
  }};
}

/** Organic steering changes speed and lateral balance, never skips collisions. */
export function steerZombie(z,desired,neighbors,dt,now){
  const t=now*.001,id=z.id;
  const inRamp=desired.ramp;
  let gx=desired.x,gz=desired.z;
  const norm=Math.max(.001,Math.hypot(gx,gz));gx/=norm;gz/=norm;
  // Fixed-phase layered sine noise: reproducible wobble, not random teleport.
  const toTarget=Math.hypot(z.x-(z.targetX??z.x),z.z-(z.targetZ??z.z));
  // Suppress lateral noise near the player to stop orbiting.
  const closeTarget=toTarget<7;
  const wobble=(Math.sin(t*(1.25+(id%7)*.13)+id*2.17)*.65+
    Math.sin(t*.55+id*.71)*.35)*(inRamp?0:closeTarget?.018:.10);
  let sx=0,sz=0;
  for(const other of neighbors){if(other===z||Math.abs((other.y??0)-(z.y??0))>.85)continue;
    const dx=z.x-other.x,dz=z.z-other.z,d2=dx*dx+dz*dz;
    if(d2>=3.4)continue;
    const d=Math.sqrt(Math.max(.0005,d2)),force=Math.min(.45,(1.85-d)*.40);
    if(d<.015){sx+=(z.id<other.id?-.25:.25);continue;}
    sx+=(dx/d)*force;sz+=(dz/d)*force;
  }
  const sLen=Math.hypot(sx,sz);if(sLen>.5){sx=sx/sLen*.5;sz=sz/sLen*.5;}
  if(inRamp){sx*=.12;sz*=.12;} // Don't force zombies off narrow stairs.
  // Separation should never overpower the approach vector in close-range combat.
  if(closeTarget){sx*=.24;sz*=.24;}
  let dx=gx-gz*wobble+sx, dz=gz+gx*wobble+sz;
  const len=Math.max(.0001,Math.hypot(dx,dz));dx/=len;dz/=len;
  // Smooth heading. Suppress wandering on ramps/door bottlenecks.
  const turn=1-Math.exp(-dt*(inRamp?8:6));
  z.vx=(z.vx??0)*(1-turn)+dx*turn;
  z.vz=(z.vz??0)*(1-turn)+dz*turn;
  const v=Math.max(.001,Math.hypot(z.vx,z.vz));
  z.vx/=v;z.vz/=v;
  if(!Number.isFinite(z.nextStumble))z.nextStumble=now+700+id%9*180;
  if(now>=z.nextStumble){z.nextStumble=now+2300+(id%11)*280;
    if(!inRamp)z.stumbleUntil=now+130+(id%5)*55;
  }
  const slow=now<(z.stumbleUntil??0)? .58:1;
  const modulation=1+.08*Math.sin(t*(1.3+id%5*.18)+id*.52);
  return {x:z.vx,z:z.vz,speed:slow*modulation};
}

/** Convert graph edges into collision-valid X-then-Z waypoint corners. */
export function routeWaypoints(from,field){
  const start=navigation.closest(from.x,from.z,from.y??0);
  if(start<0||!field||!Number.isFinite(field.dist[start]))return [];
  const route=[];const seen=new Set();
  const point={x:from.x,z:from.z,y:from.y??0};
  let cur=start;
  for(let i=0;i<260;i++){
    if(seen.has(cur)||cur<0)break;seen.add(cur);
    const node=navigation.nodes[cur];
    if(Math.abs(node.x-point.x)>.65&&Math.abs(node.z-point.z)>.65){
      const midway=moveHorizontal(point.x,point.z,point.y,node.x-point.x,0,true,RADIUS);
      if(Math.abs(midway.x-node.x)<EPS){route.push({x:midway.x,z:point.z,y:midway.feet,tag:'corner'});
        point.x=midway.x;point.y=midway.feet;}
    }
    route.push(node);Object.assign(point,{x:node.x,z:node.z,y:node.y});
    if(cur===field.goal)break;
    const next=field.next[cur];if(next<0)break;
    cur=next;
  }
  return route;
}

/**
 * Direct pursuit is allowed only when the full physical sweep reaches the target
 * on the same floor; this prevents corner-hugging, stale grid waypoints and
 * looping around a nearby player. Graph routes still handle walls and roofs.
 */
export function directPursuitPossible(z,target,maxDistance=10){
  const dx=target.x-z.x,dz=target.z-z.z,range=Math.hypot(dx,dz);
  if(range>maxDistance||Math.abs((z.y??0)-(target.y??0))>.65)return false;
  // A ramp's lower edge may be <.65m below the destination floor.
  // Never shortcut between switchback ramp flights, even if a direct
  // horizontal sweep appears passable for a single frame.
  if(VERTICAL_LAYOUT.ramps.some(r=>
    z.x>=r.xMin-.35&&z.x<=r.xMax+.35&&
    z.z>=r.zMin-.35&&z.z<=r.zMax+.35&&
    z.y>.1&&z.y<7.2))return false;
  if(range<.001)return true;
  const probe=moveHorizontal(z.x,z.z,z.y,dx,dz,true,RADIUS);
  return Math.hypot(probe.x-target.x,probe.z-target.z)<.4 &&
    Math.abs(probe.feet-(target.y??0))<.55;
}

/** Pursues graph waypoints with a persistent route, preventing ramp switching. */
export function advanceZombie(z,target,field,neighbors,dt,now,knockX=0,knockZ=0){
  z.targetX=target.x;z.targetZ=target.z;
  // Same-floor enemies within sight MUST follow the player, not circle the
  // nearest grid node. Direct mode still uses collision-safe kinematics.
  const direct=directPursuitPossible(z,target);
  if(!direct&&!field)return false;
  const movedGoal=Math.hypot(target.x-(z.routeGoalX??target.x),target.z-(z.routeGoalZ??target.z));
  if(!direct&&(z.routeTarget!==target.id||z.routeGoal!==field.goal||
    Math.abs(target.y-(z.routeGoalY??target.y))>1.15||movedGoal>3.5||
    !Array.isArray(z.route)||z.route.length===0)){
    z.route=routeWaypoints(z,field);z.routeIndex=0;z.routeTarget=target.id;
    z.routeGoal=field.goal;z.routeGoalX=target.x;z.routeGoalZ=target.z;z.routeGoalY=target.y;
  }
  if(!direct&&!z.route?.length)return false;
  let waypoint=direct?{x:target.x,z:target.z,y:target.y??0,tag:'direct'}:z.route[z.routeIndex];
  for(let i=0;!direct&&i<4&&waypoint;i++){
    if(Math.hypot(waypoint.x-z.x,waypoint.z-z.z)>.28||Math.abs(waypoint.y-z.y)>.33)break;
    z.routeIndex++;
    waypoint=z.route[z.routeIndex];
  }
  if(!waypoint){
    // Ground/floor waypoint equals the player's current position only
    // when no blocking wall exists. Otherwise hold and re-route.
    const horizontal=Math.hypot(z.x-target.x,z.z-target.z);
    if(Math.abs(z.y-target.y)<.65&&horizontal>1.0){
      const direct=moveHorizontal(z.x,z.z,z.y,target.x-z.x,target.z-z.z,true,RADIUS);
      if(Math.hypot(direct.x-target.x,direct.z-target.z)<.35)waypoint=target;
    }
    if(!waypoint)return true;
  }
  const vx=waypoint.x-z.x,vz=waypoint.z-z.z,range=Math.hypot(vx,vz);
  const onRamp=!direct&&(waypoint.tag?.startsWith('ramp:')||waypoint.tag==='corner'||
    VERTICAL_LAYOUT.ramps.some(r=>z.x>=r.xMin-.2&&z.x<=r.xMax+.2&&z.z>=r.zMin-.2&&z.z<=r.zMax+.2&&z.y>.12));
  const organic=steerZombie(z,{x:vx,z:vz,ramp:onRamp},neighbors,dt,now);
  // Avoid flying past tight landing waypoints, particularly at the switchback.
  const speed=Math.min(z.speed*organic.speed*dt,Math.max(.015,range*.82));
  const initialX=z.x,initialZ=z.z;
  const moved=moveHorizontal(z.x,z.z,z.y,organic.x*speed+knockX*dt,
    organic.z*speed+knockZ*dt,true,RADIUS);
  z.x=moved.x;z.z=moved.z;z.y=moved.feet;
  const falling=stepVertical(z.y,z.vy??0,z.grounded??true,z.x,z.z,dt);
  z.y=falling.y;z.vy=falling.vy;z.grounded=falling.grounded;
  const progress=Math.hypot(z.x-initialX,z.z-initialZ);
  if(progress<.012&&range>.48)z.stuckFor=(z.stuckFor??0)+dt;
  else z.stuckFor=Math.max(0,(z.stuckFor??0)-dt*2);
  if(z.stuckFor>1.0){z.route=[];z.stuckFor=0;}
  // Facing follows actual displacement rather than lateral avoidance velocity.
  const actualX=z.x-initialX,actualZ=z.z-initialZ;
  if(Math.hypot(actualX,actualZ)>.004)z.facing=Math.atan2(actualX,-actualZ);
  z.moving=Math.hypot(actualX,actualZ)>.008;
  if(z.moving)z.step=(z.step??0)+dt*(z.kind==='runner'?8:5)*organic.speed;
  return true;
}

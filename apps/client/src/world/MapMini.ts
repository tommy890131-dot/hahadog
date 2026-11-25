import mapData from '../../../../packages/shared/MapLayout.json';
import { TACTICAL_IDS } from '../../../../packages/shared/VerticalCollision.mjs';
import {METRO_BOXES} from '../../../../v313/MetroMap.mjs';
import {getFacility,isFacility} from '../../../../v314/FacilityMaps.mjs';
import type {ZombieRecord,EnvironmentState} from '../network/Multiplayer';
export class MapMini {
  private ctx:CanvasRenderingContext2D;
  private size=194;
  constructor(private canvas:HTMLCanvasElement){
    this.canvas.width=this.size*devicePixelRatio;
    this.canvas.height=this.size*devicePixelRatio;
    const ctx=this.canvas.getContext('2d');if(!ctx)throw Error('Minimap canvas unavailable');
    this.ctx=ctx;this.ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  }
  draw(x:number,z:number,yaw:number,zombies:ZombieRecord[],environment?:EnvironmentState|null,
    mapId:'city'|'underground_metro'|'infected_hospital'|'doomed_harbor'='city'):void{
    const ctx=this.ctx,s=this.size,h=mapData.halfSize,scale=s/(2*h),pt=(v:number)=>(v+h)*scale;
    ctx.clearRect(0,0,s,s);ctx.fillStyle='#0e1f28ef';ctx.fillRect(0,0,s,s);
    ctx.fillStyle='#384450';
    for(const b of mapId==='underground_metro'?[]:mapData.buildings){
      if(b.role==='CAR')continue;
      ctx.fillStyle=TACTICAL_IDS.has(b.id)?'#236b65':'#384450';
      ctx.fillRect(pt(b.x-b.w/2),pt(b.z-b.d/2),b.w*scale,b.d*scale);
      if(TACTICAL_IDS.has(b.id)){
        // Cyan dot marks the usable front entrance (+Z facade).
        ctx.fillStyle='#65f4d0';
        ctx.fillRect(pt(b.x)-2,pt(b.z+b.d/2)-2,4,4);
      }
    }
    if(mapId==='underground_metro'){
      ctx.fillStyle='#24414c';ctx.fillRect(pt(-80),pt(-27),160*scale,54*scale);
      for(const b of METRO_BOXES){
        ctx.fillStyle=b.role==='train'?'#71858b':b.role==='column'?'#54656d':'#263239';
        ctx.fillRect(pt(b.x-b.w/2),pt(b.z-b.d/2),b.w*scale,b.d*scale);
      }
      ctx.fillStyle='#d7b570';ctx.fillRect(pt(-78),pt(-7),156*scale,.6*scale);
      ctx.fillRect(pt(-78),pt(7),156*scale,.6*scale);
    }
    if(isFacility(mapId)){
      const map=getFacility(mapId)!;
      ctx.fillStyle=mapId==='infected_hospital'?'#283d43':'#243846';
      ctx.fillRect(pt(-78),pt(-78),156*scale,156*scale);
      for(const b of map.boxes){
        ctx.fillStyle=b.role==='wall'?'#546873':
          b.role==='container'?'#8d7957':
          b.role==='bed'||b.role==='surgery'?'#718f8b':'#7b858b';
        ctx.fillRect(pt(b.x-b.w/2),pt(b.z-b.d/2),b.w*scale,b.d*scale);
      }
      for(const entry of map.directorEntrances){
        ctx.fillStyle='#cb5e53';
        ctx.beginPath();ctx.arc(pt(entry.x),pt(entry.z),2.3,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.strokeStyle='#3fbbac';ctx.lineWidth=1.2;
    ctx.beginPath();
    const safehouse=isFacility(mapId)?getFacility(mapId)!.safehouse:
      mapId==='underground_metro'?{x:-66,z:-15,radius:10}:mapData.safehouse;
    ctx.arc(pt(safehouse.x),pt(safehouse.z),safehouse.radius*scale,0,Math.PI*2);
    ctx.stroke();
    // Fixed-location powered consoles and randomized server-authorized exits.
    if(environment){
      ctx.lineWidth=1.7;
      for(const route of environment.routes){
        const chosen=environment.selectedRoute===route.id;
        ctx.strokeStyle=chosen?'#ffd273':route.ready?'#68e5c2':'#ab6c64';
        ctx.fillStyle=chosen?'#ffe5a5':route.ready?'#b2fff0':'#ab8b7a';
        ctx.beginPath();ctx.arc(pt(route.x),pt(route.z),chosen?5:3.8,0,Math.PI*2);ctx.stroke();
        ctx.font='bold 9px sans-serif';
        ctx.fillText(route.id==='ambulance'?'救':route.id==='helipad'?'直':
          route.id==='rescue_boat'?'船':route.id==='dock_truck'?'車':
          route.id==='train'?'列':route.id==='safehouse'?'安':
          route.id==='van'?'車':route.id==='convoy'?'醫':'洞',pt(route.x)+5,pt(route.z)-5);
      }
      for(const device of environment.devices){
        if(!device.active)continue;
        const x=pt(device.x),y=pt(device.z);
        ctx.fillStyle='#ffcd76';
        ctx.fillRect(x-2.5,y-2.5,5,5);
        ctx.font='bold 9px sans-serif';
        ctx.fillText(device.id.toLowerCase().includes('generator')||device.id==='metroPower'?'電':
          device.id.toLowerCase().includes('radio')?'訊':
          device.id.toLowerCase().includes('crane')?'吊':
          device.id.toLowerCase().includes('isolation')?'隔':
          device.id==='relay'||device.id==='metroTrain'?'列':'警',x+5,y-4);
      }
      const selected=environment.routes.find(route=>route.id===environment.selectedRoute);
      if(selected){
        ctx.save();ctx.setLineDash([3,5]);ctx.strokeStyle='#f5cf82';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(pt(x),pt(z));ctx.lineTo(pt(selected.x),pt(selected.z));ctx.stroke();
        ctx.restore();
      }
    }
    ctx.fillStyle='#bc6457';for(const p of zombies){
      ctx.fillRect(pt(p.x)-1.1,pt(p.z)-1.1,2.2,2.2);
    }
    ctx.save();ctx.translate(pt(x),pt(z));ctx.rotate(yaw); // world +X points right and world -Z points up on this map
    ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(-4,5);ctx.lineTo(0,2);ctx.lineTo(4,5);ctx.closePath();
    ctx.fillStyle='#87f5e3';ctx.fill();ctx.restore();
    ctx.strokeStyle='#7aa7a9';ctx.lineWidth=2;ctx.strokeRect(1,1,s-2,s-2);
  }
}

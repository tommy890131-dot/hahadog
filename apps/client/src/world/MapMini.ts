import mapData from '../../../../packages/shared/MapLayout.json';
import { TACTICAL_IDS } from '../../../../packages/shared/VerticalCollision.mjs';
import type {ZombieRecord} from '../network/Multiplayer';
export class MapMini {
  private ctx:CanvasRenderingContext2D;
  private size=194;
  constructor(private canvas:HTMLCanvasElement){
    this.canvas.width=this.size*devicePixelRatio;
    this.canvas.height=this.size*devicePixelRatio;
    const ctx=this.canvas.getContext('2d');if(!ctx)throw Error('Minimap canvas unavailable');
    this.ctx=ctx;this.ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  }
  draw(x:number,z:number,yaw:number,zombies:ZombieRecord[]):void{
    const ctx=this.ctx,s=this.size,h=mapData.halfSize,scale=s/(2*h),pt=(v:number)=>(v+h)*scale;
    ctx.clearRect(0,0,s,s);ctx.fillStyle='#0e1f28ef';ctx.fillRect(0,0,s,s);
    ctx.fillStyle='#384450';
    for(const b of mapData.buildings){
      if(b.role==='CAR')continue;
      ctx.fillStyle=TACTICAL_IDS.has(b.id)?'#236b65':'#384450';
      ctx.fillRect(pt(b.x-b.w/2),pt(b.z-b.d/2),b.w*scale,b.d*scale);
      if(TACTICAL_IDS.has(b.id)){
        // Cyan dot marks the usable front entrance (+Z facade).
        ctx.fillStyle='#65f4d0';
        ctx.fillRect(pt(b.x)-2,pt(b.z+b.d/2)-2,4,4);
      }
    }
    ctx.strokeStyle='#3fbbac';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.arc(pt(0),pt(0),mapData.safehouse.radius*scale,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#bc6457';for(const p of zombies){
      ctx.fillRect(pt(p.x)-1.1,pt(p.z)-1.1,2.2,2.2);
    }
    ctx.save();ctx.translate(pt(x),pt(z));ctx.rotate(yaw); // world +X points right and world -Z points up on this map
    ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(-4,5);ctx.lineTo(0,2);ctx.lineTo(4,5);ctx.closePath();
    ctx.fillStyle='#87f5e3';ctx.fill();ctx.restore();
    ctx.strokeStyle='#7aa7a9';ctx.lineWidth=2;ctx.strokeRect(1,1,s-2,s-2);
  }
}

import * as THREE from 'three';

/**
 * Offline-generated micro-surface texture triplet. No external downloads.
 * Color, normal and roughness share one original, seeded wear field.
 * The 128px tile size intentionally caps upload cost on low-spec browsers.
 */
export function architecturalPbr(name:string,color:number,roughness:number):
  {map:THREE.CanvasTexture;normalMap:THREE.CanvasTexture;roughnessMap:THREE.CanvasTexture}|null{
  if(typeof document==='undefined')return null;
  const size=128;
  const makeCanvas=()=>{
    const c=document.createElement('canvas');c.width=c.height=size;return c;
  };
  const albedo=makeCanvas(),normal=makeCanvas(),rough=makeCanvas();
  const ca=albedo.getContext('2d'),cn=normal.getContext('2d'),cr=rough.getContext('2d');
  if(!ca||!cn||!cr)return null;
  const ai=ca.createImageData(size,size),ni=cn.createImageData(size,size),
    ri=cr.createImageData(size,size);
  const seed=Array.from(name).reduce((h,ch)=>Math.imul(h^ch.charCodeAt(0),16777619),2166136261)>>>0;
  const noise=(x:number,y:number,salt=0)=>{
    let v=(Math.imul(x+seed+salt,374761393)+Math.imul(y^seed,668265263))|0;
    v=Math.imul(v^(v>>>13),1274126177);
    return ((v^(v>>>16))>>>0)/4294967295;
  };
  const steel=name==='anodized'||name==='galvanized'||name==='enamel'||
    name.startsWith('container');
  const stone=name==='concrete'||name==='porcelain'||name==='medical';
  const rust=name==='oxide'||name.startsWith('container');
  const base=[(color>>>16)&255,(color>>>8)&255,color&255];
  const height=new Float32Array(size*size);
  const clamp=(v:number)=>Math.max(0,Math.min(255,Math.round(v)));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const coarse=noise(x>>3,y>>3),fine=noise(x,y);
    const seam=steel&&(x%32<=1)?.13:0;
    const pore=stone&&fine>.98?-.26:0;
    const scuff=steel&&noise(x>>2,y>>4,17)>.987?-.19:0;
    const joint=stone&&(x%64===0||y%64===0)?-.14:0;
    height[y*size+x]=coarse*.20+fine*.19+seam+pore+scuff+joint;
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const idx=y*size+x,k=idx*4,value=height[idx];
    const oxidation=rust&&noise(x>>3,y>>3,29)>.83;
    const dirt=(noise(x>>4,y>>4,43)-.5)*(stone?36:30);
    const shade=(value-.17)*69+dirt-(oxidation?17:0);
    ai.data[k]=clamp(base[0]+shade+(oxidation?26:0));
    ai.data[k+1]=clamp(base[1]+shade-(oxidation?5:0));
    ai.data[k+2]=clamp(base[2]+shade-(oxidation?14:0));ai.data[k+3]=255;
    const nx=height[y*size+((x+1)%size)]-height[y*size+((x+size-1)%size)];
    const ny=height[((y+1)%size)*size+x]-height[((y+size-1)%size)*size+x];
    const bump=stone?1.20:steel?.68:.79;
    const length=Math.hypot(nx*bump,ny*bump,1);
    ni.data[k]=clamp(127.5-nx*bump/length*127.5);
    ni.data[k+1]=clamp(127.5-ny*bump/length*127.5);
    ni.data[k+2]=clamp(127.5+127.5/length);
    ni.data[k+3]=255;
    const roughValue=Math.max(.16,Math.min(1,roughness+
      (noise(x,y,73)-.5)*(steel?.20:.14)+(oxidation?.12:0)));
    const shadeR=clamp(roughValue*255);
    ri.data[k]=ri.data[k+1]=ri.data[k+2]=shadeR;ri.data[k+3]=255;
  }
  ca.putImageData(ai,0,0);cn.putImageData(ni,0,0);cr.putImageData(ri,0,0);
  const toTexture=(c:HTMLCanvasElement,srgb:boolean)=>{
    const t=new THREE.CanvasTexture(c);
    if(srgb)t.colorSpace=THREE.SRGBColorSpace;
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.anisotropy=4;t.generateMipmaps=true;
    t.minFilter=THREE.LinearMipmapLinearFilter;
    return t;
  };
  return {map:toTexture(albedo,true),normalMap:toTexture(normal,false),
    roughnessMap:toTexture(rough,false)};
}

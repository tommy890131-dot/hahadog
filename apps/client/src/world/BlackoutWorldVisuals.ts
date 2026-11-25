import * as THREE from 'three';
import type {EnvironmentState, EvacRoute} from '../network/Multiplayer';
import {METRO_DEVICES,METRO_EXITS} from '../../../../v313/MetroEvents.mjs';
import {FACILITY_MAPS} from '../../../../v314/FacilityMaps.mjs';

type Marker={group:THREE.Group;light:THREE.Mesh;ring:THREE.Mesh;label:string};
type Nearby={id:string;label:string;distance:number;ready:boolean};
const ALL_ROUTES:readonly EvacRoute[]=[
  {id:'van',label:'西側裝甲車',x:-70,y:0,z:0,radius:5,requires:'none',ready:true},
  {id:'convoy',label:'東側醫療車隊',x:70,y:0,z:0,radius:5,requires:'power',ready:false},
  {id:'tunnel',label:'南側地下通道',x:0,y:0,z:70,radius:5,requires:'relay',ready:false},
];

/**
 * V3.12 lightweight city lighting / interaction markers.
 * The authoritative server owns the power, objectives and route state;
 * these meshes are visual only and never change the world collision map.
 */
export class BlackoutWorldVisuals {
  private state:EnvironmentState|null=null;
  private readonly markers=new Map<string,Marker>();
  private readonly lights:{object:THREE.Light;intensity:number}[]=[];
  private readonly emissive:{material:THREE.MeshStandardMaterial;intensity:number}[]=[];
  private readonly hemisphere:{object:THREE.HemisphereLight;intensity:number}[]=[];
  private readonly ambient:{object:THREE.AmbientLight;intensity:number}[]=[];
  private readonly background:THREE.Color|null;
  private blackout=0;
  private elapsed=0;
  private readonly circleGeometry=new THREE.RingGeometry(1.08,1.22,32);
  private readonly beaconGeometry=new THREE.CylinderGeometry(.19,.29,1.1,10);
  private readonly colors={online:new THREE.Color(0x54d9aa),disabled:new THREE.Color(0xb65f44),active:new THREE.Color(0xf2b866)};
  constructor(private readonly scene:THREE.Scene){
    // Capture the existing city fixtures before the model-specific muzzle flash
    // or interactive marker objects can be mistaken for global street lighting.
    const seen=new Set<THREE.MeshStandardMaterial>();
    scene.traverse(obj=>{
      if(obj instanceof THREE.PointLight){
        if(obj.position.x===0&&obj.position.y===5&&obj.position.z===0)return; // safehouse
        this.lights.push({object:obj,intensity:obj.intensity});
      }else if(obj instanceof THREE.HemisphereLight)this.hemisphere.push({object:obj,intensity:obj.intensity});
      else if(obj instanceof THREE.AmbientLight)this.ambient.push({object:obj,intensity:obj.intensity});
      if(obj instanceof THREE.Mesh||obj instanceof THREE.InstancedMesh){
        const materials=Array.isArray(obj.material)?obj.material:[obj.material];
        for(const mat of materials)if(mat instanceof THREE.MeshStandardMaterial&&mat.emissiveIntensity>.24&&!seen.has(mat)){
          seen.add(mat);this.emissive.push({material:mat,intensity:mat.emissiveIntensity});
        }
      }
    });
    this.background=scene.background instanceof THREE.Color?scene.background.clone():null;
    this.addMarkers();
  }
  private addMarkers():void{
    const list=[
      {id:'generator',label:'備用發電機',x:0,y:0,z:-24},
      {id:'relay',label:'地下通訊繼電器',x:0,y:0,z:24},
      {id:'alarm',label:'誘餌警報器',x:-24,y:0,z:0},
      ...ALL_ROUTES,
      ...Object.values(METRO_DEVICES),...Object.values(METRO_EXITS),
      ...FACILITY_MAPS.infected_hospital.devices,...FACILITY_MAPS.infected_hospital.routes,
      ...FACILITY_MAPS.doomed_harbor.devices,...FACILITY_MAPS.doomed_harbor.routes,
    ];
    for(const p of list){
      const group=new THREE.Group();
      group.position.set(p.x,p.y,p.z);
      const material=new THREE.MeshStandardMaterial({color:0x2c837b,emissive:0x1a8e72,emissiveIntensity:.65,roughness:.56,metalness:.35});
      const light=new THREE.Mesh(this.beaconGeometry,material);
      light.position.y=.7;
      group.add(light);
      const ring=new THREE.Mesh(this.circleGeometry,new THREE.MeshBasicMaterial({
        color:0x43d6aa,transparent:true,opacity:.68,depthWrite:false,side:THREE.DoubleSide
      }));
      ring.rotation.x=-Math.PI/2;ring.position.y=.07;group.add(ring);
      // Raised geometry reads as a distinct interactable console.
      const pole=new THREE.Mesh(new THREE.BoxGeometry(.43,1.05,.43),
        new THREE.MeshStandardMaterial({color:0x34454a,roughness:.7,metalness:.4}));
      pole.position.y=.53;group.add(pole);
      group.visible=false;
      this.scene.add(group);this.markers.set(p.id,{group,light,ring,label:p.label});
    }
  }
  setState(environment:EnvironmentState|null):void{
    if(!environment){this.state=null;for(const marker of this.markers.values())marker.group.visible=false;return;}
    this.state=environment;
    const activeIds=new Set([...environment.routes.map(r=>r.id),...environment.devices.map(d=>d.id)]);
    for(const [id,marker] of this.markers){
      const route=environment.routes.find(x=>x.id===id);
      const device=environment.devices.find(x=>x.id===id);
      marker.group.visible=activeIds.has(id)&&(!route||!environment.selectedRoute||environment.selectedRoute===id);
      if(route||device)marker.group.position.set((route??device)!.x,(route??device)!.y,(route??device)!.z);
      const active=route?(environment.selectedRoute===id||route.ready):device?.active??false;
      const color=active?this.colors.online:this.colors.disabled;
      (marker.light.material as THREE.MeshStandardMaterial).color.copy(color);
      (marker.light.material as THREE.MeshStandardMaterial).emissive.copy(color).multiplyScalar(.4);
      (marker.ring.material as THREE.MeshBasicMaterial).color.copy(color);
    }
  }
  getNearest(x:number,y:number,z:number,phase:'objectives'|'extraction'='objectives'):Nearby|null{
    if(!this.state)return null;
    let best:Nearby|null=null;
    const entries:({id:string;label:string;x:number;y:number;z:number;range?:number;radius?:number;ready?:boolean})[]=[
      ...this.state.devices.filter(d=>d.active),
      ...(phase==='extraction'?this.state.routes:[]),
    ];
    for(const p of entries){
      if(Math.abs(y-p.y)>1.7)continue;
      const distance=Math.hypot(x-p.x,z-p.z);
      if(distance>(p.range??p.radius??3.2)+.45)continue;
      const candidate={id:p.id,label:p.label,distance,ready:p.ready??true};
      if(!best||distance<best.distance)best=candidate;
    }
    return best;
  }
  render(dt:number):void{
    this.elapsed+=Math.max(0,Math.min(dt,.05));
    const target=this.state&&!this.state.powerOnline?1:0;
    this.blackout=THREE.MathUtils.damp(this.blackout,target,2.8,Math.max(0,Math.min(dt,.05)));
    for(const {object,intensity} of this.lights)object.intensity=intensity*(1-this.blackout*.98);
    for(const {object,intensity} of this.hemisphere)object.intensity=intensity*(1-this.blackout*.38);
    for(const {object,intensity} of this.ambient)object.intensity=intensity*(1-this.blackout*.45);
    for(const {material,intensity} of this.emissive)
      material.emissiveIntensity=intensity*(1-this.blackout*.92);
    const metro=this.state?.devices.some(device=>device.id==='metroPower')??false;
    const hospital=this.state?.devices.some(device=>device.id==='hospitalGenerator')??false;
    const harbor=this.state?.devices.some(device=>device.id==='harborGenerator')??false;
    const baseline=new THREE.Color(metro?0x030709:hospital?0x111c20:harbor?0x07121c:0x0a121c);
    if(this.scene.background instanceof THREE.Color)
      this.scene.background.copy(baseline).lerp(new THREE.Color(0x010304),this.blackout*.74);
    if(this.scene.fog instanceof THREE.FogExp2)
      this.scene.fog.color.copy(baseline).lerp(new THREE.Color(0x010304),this.blackout*.65);
    for(const marker of this.markers.values()){
      if(!marker.group.visible)continue;
      marker.ring.rotation.z=this.elapsed*.28;
      marker.light.scale.y=1+Math.sin(this.elapsed*2.2)*.08;
    }
  }
  dispose():void{
    for(const {object,intensity} of this.lights)object.intensity=intensity;
    for(const {object,intensity} of this.hemisphere)object.intensity=intensity;
    for(const {object,intensity} of this.ambient)object.intensity=intensity;
    for(const {material,intensity} of this.emissive)material.emissiveIntensity=intensity;
    if(this.background&&this.scene.background instanceof THREE.Color)this.scene.background.copy(this.background);
    if(this.scene.fog instanceof THREE.FogExp2&&this.background)this.scene.fog.color.copy(this.background);
    for(const m of this.markers.values()){
      this.scene.remove(m.group);
      m.group.traverse(o=>{if(o instanceof THREE.Mesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(mat=>mat.dispose());});
    }
    this.circleGeometry.dispose();this.beaconGeometry.dispose();
    this.markers.clear();
  }
}

import * as THREE from 'three';

export type DefenseRecord={id:number;kind:'turret'|'barricade';x:number;y:number;z:number;hp:number;maxHp:number};
export type LootRecord={id:number;x:number;y:number;z:number;rarity:'common'|'uncommon'|'rare'|'legendary'};
const RARITY_COLOR:Record<LootRecord['rarity'],number>={common:0xa3b7bd,uncommon:0x65c178,rare:0x3d8aff,legendary:0xffc54d};
type TurretVisual={head:THREE.Group; barrel:THREE.Mesh; flash:THREE.Mesh; facing:number; target:number; recoil:number; flashUntil:number};

/**
 * Defense and loot are server owned. Visuals interpolate the latest trusted
 * snapshot; a turretShot message animates its yaw, recoil and muzzle flash.
 * No client-side turret fire or damage is simulated here.
 */
export class BattleExtras {
  private readonly objects=new Map<string,THREE.Group>();
  private readonly turrets=new Map<number,TurretVisual>();
  defenses:DefenseRecord[]=[];
  loot:LootRecord[]=[];
  private readonly wallMat=new THREE.MeshStandardMaterial({color:0x77735c,roughness:.88});
  private readonly turretMat=new THREE.MeshStandardMaterial({color:0x4c6870,metalness:.72,roughness:.35});
  private readonly glowMat=new THREE.MeshBasicMaterial({color:0xffb455,transparent:true,opacity:.92,depthWrite:false,toneMapped:false});
  private readonly lootMats=new Map<LootRecord['rarity'],THREE.MeshStandardMaterial>();
  constructor(private readonly scene:THREE.Scene){
    for(const [rarity,hex] of Object.entries(RARITY_COLOR))
      this.lootMats.set(rarity as LootRecord['rarity'],new THREE.MeshStandardMaterial({color:hex,metalness:.22,roughness:.34,emissive:hex,emissiveIntensity:.25}));
  }
  private makeDefense(d:DefenseRecord):THREE.Group{
    const group=new THREE.Group();
    if(d.kind==='turret'){
      const base=new THREE.Mesh(new THREE.CylinderGeometry(.56,.7,.44,8),this.turretMat);
      base.position.y=.24;group.add(base);
      const head=new THREE.Group();
      head.position.y=.68;
      const top=new THREE.Mesh(new THREE.BoxGeometry(.56,.42,.6),this.turretMat);
      head.add(top);
      const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.9,8),this.turretMat);
      barrel.rotation.x=Math.PI/2;barrel.position.set(0,.02,-.6);head.add(barrel);
      const flash=new THREE.Mesh(new THREE.SphereGeometry(.19,8,6),this.glowMat);
      flash.position.set(0,.02,-1.06);flash.visible=false;head.add(flash);
      group.add(head);
      this.turrets.set(d.id,{head,barrel,flash,facing:0,target:0,recoil:0,flashUntil:0});
    }else{
      for(let i=0;i<3;i++){
        const panel=new THREE.Mesh(new THREE.BoxGeometry(2.4,.29,.28),this.wallMat);
        panel.position.y=.36+i*.42;group.add(panel);
      }
    }
    return group;
  }
  private makeLoot(item:LootRecord):THREE.Group{
    const group=new THREE.Group();
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(.64,.55,.64),this.lootMats.get(item.rarity)!);
    mesh.position.y=.34;group.add(mesh);
    return group;
  }
  update(defenses:DefenseRecord[],loot:LootRecord[]):void{
    this.defenses=defenses.slice(0,8);
    this.loot=loot.slice(0,10);
    const seen=new Set<string>();
    for(const d of this.defenses){
      const key='d'+d.id;seen.add(key);
      let group=this.objects.get(key);
      if(!group){group=this.makeDefense(d);this.objects.set(key,group);this.scene.add(group);}
      group.position.set(d.x,d.y,d.z);
    }
    for(const item of this.loot){
      const key='l'+item.id;seen.add(key);
      let group=this.objects.get(key);
      if(!group){group=this.makeLoot(item);this.objects.set(key,group);this.scene.add(group);}
      group.position.set(item.x,item.y,item.z);
    }
    for(const [key,object] of this.objects)if(!seen.has(key)){
      this.scene.remove(object);
      this.objects.delete(key);
      if(key.startsWith('d'))this.turrets.delete(Number(key.slice(1)));
      // Geometries and materials are shared or owned by these groups; dispose at shutdown.
    }
  }
  onTurretShot(id:number,from:{x:number;y:number;z:number},to:{x:number;y:number;z:number}):void{
    const turret=this.turrets.get(id);
    if(!turret)return;
    const dx=to.x-from.x,dz=to.z-from.z;
    if(!Number.isFinite(dx)||!Number.isFinite(dz)||Math.hypot(dx,dz)<.01)return;
    turret.target=Math.atan2(dx,-dz);
    turret.recoil=1;
    turret.flashUntil=.08;
    turret.flash.visible=true;
  }
  animate(dt:number):void{
    const step=THREE.MathUtils.clamp(Number.isFinite(dt)?dt:0,0,.06);
    for(const turret of this.turrets.values()){
      const angle=Math.atan2(Math.sin(turret.target-turret.facing),Math.cos(turret.target-turret.facing));
      turret.facing+=angle*(1-Math.exp(-15*step));
      turret.head.rotation.y=turret.facing;
      turret.recoil*=Math.exp(-17*step);
      turret.barrel.position.z=-.6+turret.recoil*.16;
      turret.flashUntil=Math.max(0,turret.flashUntil-step);
      turret.flash.visible=turret.flashUntil>0;
      if(turret.flash.visible){
        const scale=1+turret.flashUntil*3;
        turret.flash.scale.setScalar(scale);
      }
    }
  }
  nearestLoot(x:number,y:number,z:number):LootRecord|undefined{
    return this.loot.find(item=>Math.hypot(item.x-x,item.y-y,item.z-z)<2.5);
  }
  nearestDamagedDefense(x:number,y:number,z:number):DefenseRecord|undefined{
    return this.defenses.find(d=>d.hp<d.maxHp&&Math.hypot(d.x-x,d.y-y,d.z-z)<3);
  }
  dispose():void{
    for(const object of this.objects.values()){
      this.scene.remove(object);
      object.traverse(child=>{
        if(child instanceof THREE.Mesh)child.geometry.dispose();
      });
    }
    this.objects.clear();this.turrets.clear();
    this.wallMat.dispose();this.turretMat.dispose();this.glowMat.dispose();
    for(const m of this.lootMats.values())m.dispose();
  }
}

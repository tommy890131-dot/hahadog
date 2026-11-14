import * as THREE from 'three';

export type DefenseRecord={id:number;kind:'turret'|'barricade';x:number;y:number;z:number;hp:number;maxHp:number};
export type LootRecord={id:number;x:number;y:number;z:number;rarity:'common'|'uncommon'|'rare'|'legendary'};
const RARITY_COLOR:Record<LootRecord['rarity'],number>={common:0xa3b7bd,uncommon:0x65c178,rare:0x3d8aff,legendary:0xffc54d};

/**
 * Lightweight client-only visuals for server-authoritative structures and loot.
 * Ground placement/damage/ownership are never accepted from client calculations.
 * Reuse meshes across snapshots to avoid per-frame geometries and GPU churn.
 */
export class BattleExtras {
  private readonly objects=new Map<string,THREE.Group>();
  defenses:DefenseRecord[]=[];
  loot:LootRecord[]=[];
  private readonly wallMat=new THREE.MeshStandardMaterial({color:0x77735c,roughness:.88});
  private readonly turretMat=new THREE.MeshStandardMaterial({color:0x4c6870,metalness:.72,roughness:.35});
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
      const top=new THREE.Mesh(new THREE.BoxGeometry(.56,.42,.6),this.turretMat);
      top.position.y=.68;group.add(top);
      const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.9,8),this.turretMat);
      barrel.rotation.x=Math.PI/2;barrel.position.set(0,.70,-.6);group.add(barrel);
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
      this.scene.remove(object);this.objects.delete(key);
    }
  }
  nearestLoot(x:number,y:number,z:number):LootRecord|undefined{
    return this.loot.find(item=>Math.hypot(item.x-x,item.y-y,item.z-z)<2.5);
  }
  nearestDamagedDefense(x:number,y:number,z:number):DefenseRecord|undefined{
    return this.defenses.find(d=>d.hp<d.maxHp&&Math.hypot(d.x-x,d.y-y,d.z-z)<3);
  }
  dispose():void{
    for(const object of this.objects.values())this.scene.remove(object);
    this.objects.clear();this.wallMat.dispose();this.turretMat.dispose();
    for(const m of this.lootMats.values())m.dispose();
  }
}

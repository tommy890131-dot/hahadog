import * as THREE from 'three';
import mapData from '../../../../packages/shared/MapLayout.json';
import { surfaceMaterial, facadeMaterial } from './SurfaceMaterials';
import { addCityDetails } from './CityDetails';
import {MetroScene} from './MetroScene';
import {metroCanOccupy,metroMoveHorizontal} from '../../../../v313/MetroMap.mjs';
import { TACTICAL_IDS, VERTICAL_LAYOUT, canOccupyAt, moveHorizontal, surfaceHeightAt } from '../../../../packages/shared/VerticalCollision.mjs';

type Building = {id:string;x:number;z:number;w:number;d:number;h:number;role:string};
const layout = mapData as {halfSize:number;safehouse:{x:number;z:number;radius:number};buildings:Building[]};
const wallPalette = [0x505a60,0x616363,0x58645f,0x515b64,0x6a605a,0x4c5c68];
const material = (color:number,roughness=.85,metalness=.05)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const asphalt=surfaceMaterial('asphalt',18);
const roofing=surfaceMaterial('metal',2);
const roadMark = new THREE.MeshStandardMaterial({color:0xb4a78d,roughness:.82,emissive:0x15120b});

export class World {
  readonly colliders: THREE.Box3[]=[];
  readonly blockers: THREE.Object3D[]=[];
  /** A static decal receiver; also represents the whole 180m city ground. */
  readonly ground: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  readonly halfSize=layout.halfSize;
  readonly safehouse=layout.safehouse;
  readonly moonLight: THREE.DirectionalLight;
  private lastShadowX = Number.NaN;
  private lastShadowZ = Number.NaN;
  private lastShadowY = Number.NaN;
  private readonly shadowOffset = new THREE.Vector3(-40,65,-28);
  private readonly shadowBack = this.shadowOffset.clone().normalize();
  private readonly shadowRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),this.shadowBack).normalize();
  private readonly shadowUp = new THREE.Vector3().crossVectors(this.shadowBack,this.shadowRight).normalize();
  private readonly shadowCenter = new THREE.Vector3();
  private metroScene!:MetroScene;
  private cityObjects:THREE.Object3D[]=[];
  private cityBlockers:THREE.Object3D[]=[];
  private currentChapter:'city'|'underground_metro'='city';

  constructor(scene:THREE.Scene){
    scene.background=new THREE.Color(0x0a121c);
    scene.fog=new THREE.FogExp2(0x0a121c,.012);
    scene.add(new THREE.HemisphereLight(0x58748d,0x191d20,.38));
    scene.add(new THREE.AmbientLight(0x8c9caf,.06));
    const moon=new THREE.DirectionalLight(0xa9bdcf,1.05);
    moon.castShadow=true;
    moon.shadow.mapSize.set(2048,2048);
    moon.shadow.camera.left=-44;
    moon.shadow.camera.right=44;
    moon.shadow.camera.top=44;
    moon.shadow.camera.bottom=-44;
    moon.shadow.camera.near=0.5;
    moon.shadow.camera.far=180;
    moon.shadow.camera.updateProjectionMatrix();
    moon.shadow.bias=-0.0005;
    moon.shadow.normalBias=0.028;
    moon.shadow.radius=2;
    this.moonLight=moon;
    scene.add(moon,moon.target);
    this.updateShadowFocus(new THREE.Vector3(0,0,0));

    const ground=new THREE.Mesh(new THREE.PlaneGeometry(183,183),asphalt);
    ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
    this.ground=ground;

    const road=surfaceMaterial('asphalt', 12);
    for(const [x,z,w,d] of [[0,0,15,182],[0,0,182,15],[-55,0,9,182],[55,0,9,182],[0,-55,182,9],[0,55,182,9]] as const){
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),road);
      mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.013,z);mesh.receiveShadow=true;scene.add(mesh);
    }

    const lines:THREE.Matrix4[]=[];
    const dummy=new THREE.Object3D();
    for(let d=-84;d<84;d+=8){
      for(const x of [0,-55,55]){
        if(Math.abs(d)<9 && x===0)continue;
        dummy.position.set(x,.027,d);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(.17,3.1,1);
        dummy.updateMatrix();lines.push(dummy.matrix.clone());
      }
      for(const z of [0,-55,55]){
        if(Math.abs(d)<9&&z===0)continue;
        dummy.position.set(d,.028,z);dummy.rotation.set(-Math.PI/2,0,Math.PI/2);dummy.scale.set(.17,3.1,1);
        dummy.updateMatrix();lines.push(dummy.matrix.clone());
      }
    }
    const mark=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),roadMark,lines.length);
    lines.forEach((m,i)=>mark.setMatrixAt(i,m));mark.instanceMatrix.needsUpdate=true;scene.add(mark);

    const winLit:THREE.Matrix4[]=[],winDark:THREE.Matrix4[]=[];
    const glass=new THREE.PlaneGeometry(.92,1.36);
    let idx=0;
    for(const building of layout.buildings){
      if(building.role==='CAR'){
        this.car(scene,building,idx++);continue;
      }
      const color=wallPalette[idx++%wallPalette.length];
      const wallMat=facadeMaterial(building.role);
      void color; // palette retained for deterministic building assignment
      const tactical=TACTICAL_IDS.has(building.id);
      if(tactical){this.createTacticalBuilding(scene,building);}
      else {
        const main=new THREE.Mesh(new THREE.BoxGeometry(building.w,building.h,building.d),wallMat);
        main.position.set(building.x,building.h/2,building.z);
        main.receiveShadow=true;main.castShadow=true;scene.add(main);
        this.registerCollider(main);
        const roof=new THREE.Mesh(new THREE.BoxGeometry(building.w+.35,.35,building.d+.35),roofing);
        roof.position.set(building.x,building.h+.12,building.z);roof.castShadow=true;scene.add(roof);
      }
      const floors=Math.max(2,Math.round(building.h/3.1));
      const faces=[
        {side:0,width:building.w,center:building.z+building.d/2+.015},
        {side:1,width:building.w,center:building.z-building.d/2-.015},
        {side:2,width:building.d,center:building.x+building.w/2+.015},
        {side:3,width:building.d,center:building.x-building.w/2-.015}
      ];
      for(const face of faces){
        if(tactical)continue; // Real open apertures must never receive opaque window planes.
        const columns=Math.max(2,Math.floor(face.width/2.8));
        for(let floor=0;floor<floors;floor++){
          const y=1.75+floor*(building.h-2.8)/Math.max(1,floors-1);
          for(let c=0;c<columns;c++){
            const u=-face.width/2+(c+.5)*face.width/columns;
            if(floor===0&&c===Math.floor(columns/2)&&face.side===0)continue;
            // Upper landing door in the right wall: no floating glass on the opening.
            if(tactical && face.side===2 && floor===1 &&
              Math.abs(u-(-building.d/2+1.65))<1.25)continue;
            const p=new THREE.Object3D();
            if(face.side<2){p.position.set(building.x+u,y,face.center);p.rotation.y=face.side===0?0:Math.PI;}
            else {p.position.set(face.center,y,building.z+u);p.rotation.y=face.side===2?Math.PI/2:-Math.PI/2;}
            p.updateMatrix();
            const lit=(idx*13+floor*7+c*5+face.side*11)%11<3;
            (lit?winLit:winDark).push(p.matrix.clone());
          }
        }
      }
      this.decorateBuilding(scene,building,idx,tactical);
    }
    const lightGlass=new THREE.MeshStandardMaterial({color:0xffc17c,emissive:0xffa956,emissiveIntensity:.65,metalness:.15,roughness:.24,side:THREE.DoubleSide});
    const darkGlass=new THREE.MeshStandardMaterial({color:0x1b2a33,emissive:0x0a1824,emissiveIntensity:.15,metalness:.45,roughness:.24,side:THREE.DoubleSide});
    for(const [list,mat] of [[winLit,lightGlass],[winDark,darkGlass]] as const){
      const mesh=new THREE.InstancedMesh(glass,mat,list.length);
      list.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;
      mesh.frustumCulled=false;scene.add(mesh);
    }

    addCityDetails(scene, layout.buildings);
    this.streetProps(scene);
    this.createSafehouse(scene);
    this.cityObjects=scene.children.slice();
    this.cityBlockers=this.blockers.slice();
    this.metroScene=new MetroScene(scene);
  }
  setChapter(id:'city'|'underground_metro'):void{
    if(this.currentChapter===id)return;
    this.currentChapter=id;
    const metro=id==='underground_metro';
    for(const obj of this.cityObjects)obj.visible=!metro;
    this.metroScene.setVisible(metro);
    this.blockers.splice(0,this.blockers.length,...(metro?this.metroScene.blockers:this.cityBlockers));
    this.ground.visible=!metro;
    this.lastShadowX=Number.NaN;
    this.sceneBackground(metro);
  }
  private sceneBackground(metro:boolean):void{
    const scene=this.metroScene.group.parent;
    if(!(scene instanceof THREE.Scene))return;
    scene.background=new THREE.Color(metro?0x030709:0x0a121c);
    scene.fog=new THREE.FogExp2(metro?0x030709:0x0a121c,metro?.018:.012);
  }
  get chapter():string{return this.currentChapter;}
  disposeChapter():void{this.metroScene.dispose();}
  }

  /** Procedural shell, walkable upstairs floor, external switchback ramps and rooftop. */
  private createTacticalBuilding(scene:THREE.Scene,b:Building):void{
    const geo=new THREE.BoxGeometry(1,1,1);
    const facade=facadeMaterial(b.role);
    const floorMat=surfaceMaterial('concrete',2);
    const guardMat=surfaceMaterial('metal',2);
    const batches=new Map<THREE.Material,THREE.Matrix4[]>();
    const transform=new THREE.Object3D();
    const queue=(mat:THREE.Material,position:THREE.Vector3,scale:THREE.Vector3,rx=0)=>{
      transform.position.copy(position);transform.scale.copy(scale);transform.rotation.set(rx,0,0);transform.updateMatrix();
      const items=batches.get(mat)??[];items.push(transform.matrix.clone());batches.set(mat,items);
    };
    for(const piece of VERTICAL_LAYOUT.boxes){
      if(piece.buildingId!==b.id||!piece.display)continue;
      const mat=piece.kind==='wall'||piece.kind==='lintel'?facade:
        piece.kind==='roof'||piece.kind==='parapet'?roofing:
        piece.kind==='cover'||piece.kind==='vent'?guardMat:floorMat;
      queue(mat,new THREE.Vector3(piece.x,piece.y,piece.z),new THREE.Vector3(piece.w,piece.h,piece.d));
    }
    // The ramps are actual inclined platforms, not stairs painted on facades.
    const railMat=material(0x576569,.74,.49);
    for(const ramp of VERTICAL_LAYOUT.ramps){
      if(ramp.buildingId!==b.id)continue;
      const dz=ramp.zMax-ramp.zMin,dy=ramp.yMax-ramp.yMin;
      const width=ramp.xMax-ramp.xMin,length=Math.hypot(dz,dy);
      const angle=-Math.atan2(dy,dz);
      const centerX=(ramp.xMin+ramp.xMax)/2,centerY=(ramp.yMin+ramp.yMax)/2;
      const centerZ=(ramp.zMin+ramp.zMax)/2;
      queue(floorMat,new THREE.Vector3(centerX,centerY-.085,centerZ),new THREE.Vector3(width,.17,length),angle);
      for(const edge of [ramp.xMin-.08,ramp.xMax+.08]){
        // Thin visual rails: the shared ramp's support height remains authoritative.
        queue(railMat,new THREE.Vector3(edge,centerY+.61,centerZ),new THREE.Vector3(.10,.12,length),angle);
        for(const z of [ramp.zMin+.45,ramp.zMax-.45]){
          const t=(z-ramp.zMin)/dz;
          queue(railMat,new THREE.Vector3(edge,ramp.yMin+dy*t+.6,z),new THREE.Vector3(.07,1.2,.07));
        }
      }
    }
    for(const [mat,items] of batches){
      const mesh=new THREE.InstancedMesh(geo,mat,items.length);
      items.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
      mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;
      mesh.computeBoundingSphere();scene.add(mesh);
      if(mat!==railMat)this.blockers.push(mesh);
    }
    // Low-budget interior illumination and visible entry illumination.
    const light=new THREE.PointLight(0xffc59a,2.6,12,2);
    light.position.set(b.x,2.7,b.z);
    light.castShadow=false;
    if(['b0_0','b0_2','b3_1','b3_3'].includes(b.id))scene.add(light);
    const fixture=new THREE.Mesh(new THREE.BoxGeometry(1.2,.06,.20),new THREE.MeshBasicMaterial({color:0xffcf94}));
    fixture.position.set(b.x,3.03,b.z);scene.add(fixture);
  }

  private registerCollider(mesh:THREE.Object3D):void{
    mesh.updateMatrixWorld(true);
    this.colliders.push(new THREE.Box3().setFromObject(mesh));
    this.blockers.push(mesh);
  }

  private car(scene:THREE.Scene,b:Building,i:number):void{
    const paint=material([0x4d5f6a,0x6c4944,0x65705d,0x464b50][i%4],.45,.35);
    const body=new THREE.Mesh(new THREE.BoxGeometry(b.w,.7,b.d),paint);
    body.position.set(b.x,.52,b.z);body.castShadow=true;body.receiveShadow=true;scene.add(body);
    this.registerCollider(body);
    const cabin=new THREE.Mesh(new THREE.BoxGeometry(b.w*.57,.55,b.d*.8),material(0x1d2a34,.18,.45));
    cabin.position.set(b.x,1.14,b.z);scene.add(cabin);
    const lamp=new THREE.Mesh(new THREE.BoxGeometry(.14,.12,.12),new THREE.MeshBasicMaterial({color:0xffab5a}));
    lamp.position.set(b.x+b.w*.43,.55,b.z+b.d*.5);scene.add(lamp);
  }

  private decorateBuilding(scene:THREE.Scene,b:Building,seed:number,tactical=false):void{
    const dark=material(0x2d363a,.7,.35);
    // Rooftop vents and air-conditioning units break up monolithic silhouettes.
    if(!tactical){
      for(let i=0;i<2;i++){
        const vent=new THREE.Mesh(new THREE.BoxGeometry(1.8,.95,1.3),dark);
        vent.position.set(b.x+(i===0?-b.w*.23:b.w*.25),b.h+.8,b.z+(i===0?-.8:1.4));
        vent.castShadow=true;scene.add(vent);
      }
    }
    if(!tactical){
      const door=new THREE.Mesh(new THREE.BoxGeometry(1.7,2.1,.1),material(0x22282d,.6,.35));
      door.position.set(b.x,.99,b.z+b.d/2+.11);scene.add(door);
    }
    const doorGlow=new THREE.Mesh(new THREE.BoxGeometry(tactical?2.75:1.8,.1,.19),
      new THREE.MeshBasicMaterial({color:tactical?0x55eacb:0xc38d57}));
    doorGlow.position.set(b.x,tactical?2.76:2.09,b.z+b.d/2+.17);scene.add(doorGlow);
    if(tactical){
      const entrance=new THREE.Mesh(new THREE.BoxGeometry(2.75,.38,.12),
        new THREE.MeshStandardMaterial({color:0x123b3b,emissive:0x1e8975,emissiveIntensity:.75}));
      entrance.position.set(b.x,2.95,b.z+b.d/2+.22);scene.add(entrance);
    }
    if(['SHOP','CLINIC','HOTEL'].includes(b.role)){
      const awning=new THREE.Mesh(new THREE.BoxGeometry(b.w*.75,.18,2.2),material(seed%2?0x8a493d:0x39636c,.75,.1));
      awning.position.set(b.x,3,b.z+b.d/2+1.05);scene.add(awning);
      const sign=new THREE.Mesh(new THREE.BoxGeometry(Math.min(b.w*.8,8),.78,.15),
        new THREE.MeshStandardMaterial({color:0x29363b,emissive:seed%2?0x602e16:0x103b4d,emissiveIntensity:1.2}));
      sign.position.set(b.x,3.9,b.z+b.d/2+.18);scene.add(sign);
    }
    // Exposed pipes and safety ladders for industrial districts.
    if(['FACTORY','WAREHOUSE'].includes(b.role)){
      const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,b.h*.82,6),material(0x8b7669,.7,.55));
      pipe.position.set(b.x+b.w/2+.15,b.h*.47,b.z+b.d*.15);scene.add(pipe);
      for(let y=2;y<b.h-1;y+=.85){
        const rung=new THREE.Mesh(new THREE.BoxGeometry(.55,.055,.08),dark);
        rung.position.set(b.x+b.w/2+.17,y,b.z+b.d*.15);scene.add(rung);
      }
    }
  }

  private streetProps(scene:THREE.Scene):void{
    const steel=material(0x57636b,.72,.45);
    const postGeometry=new THREE.CylinderGeometry(.09,.13,4.8,7);
    const luminous=new THREE.MeshStandardMaterial({color:0x000000,emissive:0xffcd8a,emissiveIntensity:4,roughness:1});
    const locations: [number,number][]=[];
    for(let d=-76;d<=76;d+=20){
      for(const [x,z] of [[-9,d],[9,d],[d,-9],[d,9]] as const){
        if(Math.abs(x)<13&&Math.abs(z)<13)continue;
        locations.push([x,z]);
      }
    }
    const posts=new THREE.InstancedMesh(postGeometry,steel,locations.length);
    const bulbs=new THREE.InstancedMesh(new THREE.SphereGeometry(.25,8,6),luminous,locations.length);
    const pos=new THREE.Object3D();
    locations.forEach(([x,z],i)=>{
      pos.position.set(x,2.4,z);pos.scale.setScalar(1);pos.updateMatrix();posts.setMatrixAt(i,pos.matrix);
      pos.position.set(x,4.75,z);pos.updateMatrix();bulbs.setMatrixAt(i,pos.matrix);
    });posts.instanceMatrix.needsUpdate=true;bulbs.instanceMatrix.needsUpdate=true;scene.add(posts,bulbs);
    // A handful of actual light sources; the other glowing fixtures are emissive only.
    for(let i=0;i<locations.length;i+=9){
      const [x,z]=locations[i];const light=new THREE.PointLight(0xffb87a,4,16,2);
      light.position.set(x,4.6,z);scene.add(light);
    }
    const wet=new THREE.MeshStandardMaterial({color:0x233e4a,roughness:.19,metalness:.46,transparent:true,opacity:.55});
    const puddleGeom=new THREE.CircleGeometry(1,16);
    const puddles=new THREE.InstancedMesh(puddleGeom,wet,85);let j=0;
    for(let i=0;i<85;i++){
      const angle=i*2.39996,rad=6+(i*17%75),x=Math.cos(angle)*rad,z=Math.sin(angle)*rad;
      if(!this.canOccupy(x,z,1))continue;
      pos.position.set(x,.035,z);pos.rotation.set(-Math.PI/2,0,0);pos.scale.set(.9+(i%5)*.44,.45+(i%3)*.32,1);
      pos.updateMatrix();puddles.setMatrixAt(j++,pos.matrix);
    }puddles.count=j;puddles.instanceMatrix.needsUpdate=true;scene.add(puddles);
    const debris=new THREE.InstancedMesh(new THREE.BoxGeometry(.3,.17,.45),material(0x4d5151,.97),140);
    j=0;for(let i=0;i<140;i++){
      const x=Math.sin(i*13.7)*83,z=Math.sin(i*6.31+2)*83;
      if(!this.canOccupy(x,z,.5))continue;
      pos.position.set(x,.12,z);pos.rotation.set(0,(i*2.13)%Math.PI,-.08);pos.scale.setScalar(.6+(i%4)*.18);
      pos.updateMatrix();debris.setMatrixAt(j++,pos.matrix);
    }debris.count=j;debris.instanceMatrix.needsUpdate=true;scene.add(debris);
  }

  private createSafehouse(scene:THREE.Scene):void{
    const ring=new THREE.Mesh(new THREE.RingGeometry(10.8,11.05,96),
      new THREE.MeshBasicMaterial({color:0x3db9ba,transparent:true,opacity:.34,side:THREE.DoubleSide}));
    ring.rotation.x=-Math.PI/2;ring.position.y=.06;scene.add(ring);
    const beacon=new THREE.PointLight(0x3fc7b3,7,24,2);
    beacon.position.set(0,5,0);scene.add(beacon);
    const glow=new THREE.Mesh(new THREE.CylinderGeometry(.28,.55,5,8),
      new THREE.MeshStandardMaterial({color:0x3b787e,emissive:0x116367,emissiveIntensity:.6}));
    glow.position.set(0,2.5,0);scene.add(glow);
  }

  /**
   * A 2048 shadow map over the entire 180m city would waste resolution.
   * Snap in LIGHT SPACE at the current shadow texel size. Keep dynamic
   * shadow rendering enabled so moving zombies continue to cast shadows.
   */
  updateShadowFocus(player: THREE.Vector3): void {
    if(this.currentChapter==='underground_metro')return;
    const camera = this.moonLight.shadow.camera;
    const texel = (camera.right-camera.left)/this.moonLight.shadow.mapSize.x;
    const u = Math.round(player.dot(this.shadowRight)/texel)*texel;
    const v = Math.round(player.dot(this.shadowUp)/texel)*texel;
    this.shadowCenter.copy(this.shadowRight).multiplyScalar(u)
      .addScaledVector(this.shadowUp,v)
      .addScaledVector(this.shadowBack,player.dot(this.shadowBack));
    const {x,y,z} = this.shadowCenter;
    if (x === this.lastShadowX && y === this.lastShadowY && z === this.lastShadowZ) return;
    this.lastShadowX = x;
    this.lastShadowY = y;
    this.lastShadowZ = z;
    this.moonLight.position.copy(this.shadowCenter).add(this.shadowOffset);
    this.moonLight.target.position.copy(this.shadowCenter);
    this.moonLight.target.updateMatrixWorld();
  }

  canOccupy(x:number,z:number,r=.36):boolean{
    return this.currentChapter==='underground_metro'?metroCanOccupy(x,z,0,r):canOccupyAt(x,z,0,r);
  }
  canOccupy3D(x:number,z:number,feet:number,r=.36):boolean{
    return this.currentChapter==='underground_metro'?metroCanOccupy(x,z,feet,r):canOccupyAt(x,z,feet,r);
  }
  supportHeight(x:number,z:number,feet:number):number|null{
    return this.currentChapter==='underground_metro'?0:surfaceHeightAt(x,z,feet);
  }
  movePlayer(x:number,z:number,feet:number,dx:number,dz:number,grounded:boolean){
    return this.currentChapter==='underground_metro'?metroMoveHorizontal(x,z,feet,dx,dz,grounded):moveHorizontal(x,z,feet,dx,dz,grounded);
  }
}

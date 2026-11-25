import type {EnvironmentDetailKit} from './EnvironmentDetailKit';
import {METRO_BOXES} from '../../../../v313/MetroMap.mjs';
import {FACILITY_MAPS} from '../../../../v314/FacilityMaps.mjs';
import {TACTICAL_IDS} from '../../../../packages/shared/VerticalCollision.mjs';

type Building={id:string;x:number;z:number;w:number;d:number;h:number;role:string};
const cap=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));

/**
 * Non-colliding architectural art pass. Coordinates deliberately remain on the
 * solid building envelope, ceilings and top of existing props. Server physics,
 * real doors, safety exits and navigable stairs keep their original geometry.
 * All repeated parts join material+shape InstancedMesh batches.
 */
export function refineMetroArchitecture(k:EnvironmentDetailKit):void{
  // Continuous porcelain-clad concourse walls with regular service joints.
  for(const wallZ of [-26.94,26.94]){
    const interiorZ=wallZ<0?wallZ+.08:wallZ-.08;
    for(let x=-77;x<=77;x+=2.4){
      k.box('porcelain',x,2.55,interiorZ,2.26,3.85,.035);
      k.box('galvanized',x+1.17,2.48,interiorZ+.012,.035,3.86,.045);
      k.box('paint',x,4.55,interiorZ+.018,2.37,.25,.05);
      k.box('dark',x,.31,interiorZ+.025,2.35,.62,.054);
      if(Math.round(x)%4===0){
        k.box('oxide',x,.65,interiorZ+.044,.85,.024,.02);
      }
    }
    for(let x=-75;x<75;x+=15){
      k.box('anodized',x,3.68,interiorZ+.05,6.5,.13,.08);
      k.box('galvanized',x,3.42,interiorZ+.044,6.5,.042,.035);
      k.box('warning',x,1.21,interiorZ+.052,1.0,.08,.04);
    }
  }
  // Reinforced steel cross-members, service cable trays and conductor clamps.
  for(let x=-72;x<74;x+=8){
    k.box('anodized',x,5.53,0,.23,.43,52.6);
    for(const z of [-23.5,23.5]){
      k.rod('galvanized',x,4.86,z,x,5.52,z,.09);
      k.box('oxide',x,4.81,z,.44,.08,.43);
    }
    for(const z of [-21,21]){
      k.box('enamel',x,5.13,z,3.4,.10,.35);
      for(const dz of [-.12,.12])k.box('galvanized',x,5.17,z+dz,3.4,.06,.025);
    }
  }
  // Precast columns, expansion joints and impact-resistant protective corners.
  for(const b of METRO_BOXES){
    if(b.role!=='column')continue;
    const corners=[[-1,-1],[-1,1],[1,-1],[1,1]];
    for(const [sx,sz] of corners){
      k.box('anodized',b.x+sx*.81,1.86,b.z+sz*.81,.07,3.6,.07);
      k.box('oxide',b.x+sx*.79,.34,b.z+sz*.79,.1,.63,.1);
    }
    k.box('paint',b.x,3.97,b.z,b.w+.13,.24,b.d+.13);
    for(let y=.4;y<4;y+=1.18)
      k.box('warning',b.x,y,b.z-b.d/2-.036,.64,.045,.031);
  }
  // The train nose & side panels have door mechanisms, crash rails and gauges.
  for(const z of [-1.08,5.08]){
    const front=z<2?-1:1;
    for(let x=6;x<43;x+=2.65){
      k.box('galvanized',x,.54,z+front*.048,2.25,.075,.045);
      k.box('anodized',x,2.90,z+front*.05,2.25,.08,.07);
      k.box('oxide',x,3.10,z+front*.052,1.9,.022,.03);
      for(const dx of [-.8,.8])
        k.box('rubber',x+dx,1.80,z+front*.084,.035,1.85,.04);
    }
    for(const x of [6,16.5,28,39.5]){
      // External door motors tucked above the player eyeline.
      k.box('galvanized',x,3.05,z+front*.12,1.0,.25,.20);
      for(let dx=-.3;dx<=.3;dx+=.3)
        k.box('dark',x+dx,3.05,z+front*.238,.10,.12,.025);
    }
  }
  // Raised emergency signage housings and junction-box conduit.
  for(const x of [-62,-32,-10,36,60]){
    k.box('dark',x,3.7,-26.85,2.35,.67,.11);
    k.box('galvanized',x,3.70,-26.77,2.22,.54,.038);
    k.rod('anodized',x+1.2,3.7,-26.74,x+1.2,5.23,-26.74,.047);
    k.box('warning',x+1.18,5.20,-26.73,.26,.14,.17);
  }
  for(const x of [-72,-42,-16,13,46,69]){
    // Benches, bins and electrical cabinets are seated on existing floor.
    k.box('anodized',x,.40,24.45,1.45,.08,.39);
    for(const dx of [-.55,.55])
      k.rod('galvanized',x+dx,.15,24.45,x+dx,.55,24.45,.06);
    k.box('paint',x,.74,24.68,1.45,.56,.07);
  }
  k.sign('B2  CONCOURSE / 車站大廳',-9,3.83,-26.70,7.2,.72,0,'#9edaca');
  k.sign('緊急疏散  EMERGENCY EXIT',57,3.83,26.69,8.1,.72,Math.PI,'#c5aa6d');
}

export function refineHospitalArchitecture(k:EnvironmentDetailKit):void{
  const map=FACILITY_MAPS.infected_hospital;
  // Hygienic coved skirting, lightbox wall bands and glazed upper transoms.
  for(const x of [-77.84,77.84]){
    for(let z=-73;z<75;z+=3.1){
      k.box('medical',x,2.55,z,.035,3.5,2.95);
      k.box('galvanized',x,1.11,z,.041,.13,2.95);
      k.box('dark',x,.22,z,.055,.40,2.95);
      if((Math.round(z)+80)%3===0)
        k.box('blueGlow',x,4.39,z,.055,.12,2.1);
    }
  }
  for(const z of [-77.84,77.84]){
    for(let x=-73;x<75;x+=3.1){
      k.box('medical',x,2.55,z,2.95,3.5,.035);
      k.box('galvanized',x,1.11,z,2.95,.13,.041);
      k.box('dark',x,.22,z,2.95,.40,.055);
    }
  }
  // Door frame and transom on the actual partition, without inventing access
  // through a collision-solid surface.
  for(const b of map.boxes.filter(p=>p.role==='wall'&&p.id.includes('partition'))){
    const leading=b.z-b.d/2+.2,trailing=b.z+b.d/2-.2;
    for(const z of [leading,trailing]){
      for(const side of [-1,1]){
        const x=b.x+side*.645;
        k.box('anodized',x,2.21,z,.085,3.85,.13);
      }
      k.box('galvanized',b.x,4.05,z,1.3,.10,.14);
      k.box('glass',b.x,3.55,z,1.04,.60,.025);
      k.box('emergency',b.x,3.18,z,1.12,.12,.040);
      k.box('anodized',b.x-.24,2.04,z,0.07,.20,.08);
    }
    k.box('medical',b.x,4.45,b.z,1.35,.16,b.d);
    // Keep the visual wall thickness legible at the slab soffit.
    k.box('paint',b.x,1.26,b.z,1.29,.1,b.d);
  }
  // Bed-side medical supply heads above existing patient beds.
  for(const x of [-58,-28,0,32]){
    const z=-63;
    k.box('porcelain',x,2.65,z-1.02,2.6,.38,.12);
    for(const dx of [-.76,-.3,.3,.76]){
      k.box('anodized',x+dx,2.65,z-.94,.17,.18,.045);
      k.box('blueGlow',x+dx,2.72,z-.91,.035,.035,.021);
    }
    k.rod('medical',x-1.05,2.63,z-.9,x-1.05,1.8,z-.9,.035);
    k.box('dark',x,1.08,z,2.22,.037,1.39); // bed frame steel edge
    for(const dx of [-1.4,1.4])for(const dz of [-.6,.6])
      k.rod('galvanized',x+dx,.55,z+dz,x+dx,.78,z+dz,.11);
  }
  // Surgical suites: adjustable camera booms, pendant gas outlets and
  // clean-room upper glazing over the sealed theatre wings.
  for(const x of [-60,-28,0,33]){
    const z=65;
    for(const sx of [-.95,.95]){
      k.rod('galvanized',x+sx,5.2,z,x+sx,3.85,z,.09);
      k.box('anodized',x+sx,3.77,z,.44,.14,.23);
    }
    k.box('blueGlow',x,3.53,z,2.9,.07,1.10);
    for(const dx of [-1.0,-.5,.0,.5,1.0])
      k.box('enamel',x+dx,3.49,z+.48,.14,.025,.17);
    for(const delta of [-.55,.55])
      k.box('medical',x+delta,.82,z,1.02,.06,1.65);
  }
  // Ceiling service ducts, hanging evacuation signs, sprinkler heads.
  for(const z of [-55,-25,5,35,60]){
    k.box('anodized',0,5.14,z,143,.24,.42);
    for(let x=-67;x<=67;x+=8){
      k.rod('galvanized',x,4.92,z,x,5.25,z,.055);
      k.box('enamel',x,4.78,z,.32,.06,.32);
      k.box('blueGlow',x,4.765,z,.16,.027,.16);
    }
  }
  for(let x=-62;x<=64;x+=18){
    k.sign('病房區  WARD / EXIT',x,3.85,-77.71,7.2,.75,0,'#9edaca');
  }
}

export function refineHarborArchitecture(k:EnvironmentDetailKit):void{
  const map=FACILITY_MAPS.doomed_harbor;
  // Container castings, floor-guide reflectors, ISO lashing points and
  // sheet-metal seam details. Keep every piece on already-solid containers.
  for(const b of map.boxes.filter(p=>p.role==='container')){
    for(const face of [-1,1]){
      const z=b.z+face*(b.d/2+.065);
      k.box('oxide',b.x,.19,z,b.w-.12,.14,.045);
      k.box('anodized',b.x,b.h-.16,z,b.w-.08,.13,.064);
      for(let x=b.x-b.w/2+.5;x<b.x+b.w/2-.2;x+=2.0){
        k.box('galvanized',x,2.1,z,.055,2.7,.065);
        k.box('oxide',x,2.84,z,.20,.04,.071);
        k.box('warning',x,0.49,z,.12,.13,.07);
      }
    }
    for(const x of [b.x-b.w/2-.07,b.x+b.w/2+.07]){
      k.box('oxide',x,.12,b.z,.13,.22,b.d-.1);
      k.box('galvanized',x,b.h-.18,b.z,.12,.24,b.d);
      for(const z of [b.z-b.d/2+.3,b.z+b.d/2-.3]){
        for(let y=.4;y<b.h;y+=.70)
          k.box('anodized',x,y,z,.065,.23,.09);
      }
    }
  }
  // Actual cargo handling visual silhouettes: pulley boxes, lattice
  // bracing and multiple hoist ropes, all outside normal player height.
  for(const [cx,cz] of [[48,-57],[53,57]] as const){
    for(const sx of [-4,4]){
      for(let y=3.5;y<13;y+=2.6){
        k.rod('galvanized',cx+sx,y,cz-2,cx-sx,y+1.1,cz+2,.10);
        k.rod('galvanized',cx+sx,y+1.1,cz+2,cx-sx,y,cz-2,.10);
      }
    }
    k.box('warning',cx+4,12.3,cz,2.7,.7,2.1);
    for(const z of [cz-.76,cz+.76]){
      k.rod('rubber',cx+4,11.96,z,cx+4,5.15,z,.060);
      k.box('oxide',cx+4,5.0,z,.34,.31,.35);
    }
    for(const dx of [-5.4,-2.7,0,2.7,5.4])
      k.rod('galvanized',cx+dx,13.54,cz-2,cx+dx,13.54,cz+2,.085);
  }
  // True quay edge detail: welded rails and coarse rope bollards.
  for(let z=-68;z<70;z+=7){
    k.box('concrete',69.8,.37,z,1.2,.42,2.0);
    k.box('oxide',70.2,.61,z,1.04,.11,1.55);
    if(Math.abs(z)%3<2){
      k.rod('galvanized',71.2,.62,z,71.2,1.42,z,.16);
      k.rod('galvanized',70.67,1.43,z,71.78,1.43,z,.14);
    }
  }
  // Elevated pier lamps and industrial bracing are never walk-collision.
  for(let z=-60;z<65;z+=12){
    for(const x of [-73,73]){
      k.rod('anodized',x,4.3,z,x,8.7,z,.09);
      k.box('galvanized',x,8.72,z,1.8,.26,.5);
      k.box('blueGlow',x,8.54,z,1.5,.05,.31);
      k.box('oxide',x,4.35,z,.21,.20,.19);
    }
  }
  k.sign('貨櫃裝卸禁區  LOADING HAZARD',-18,3.68,-76.7,10.5,.83,0,'#c5aa6d');
  k.sign('救援船  RESCUE VESSEL',48,3.68,76.7,9.3,.83,Math.PI,'#9edaca');
}

export function refineCityArchitecture(k:EnvironmentDetailKit,buildings:Building[]):void{
  // Focus on the building envelope; do not fill actual tactical apertures,
  // external ramps, staircases, balcony landings or traversable interiors.
  let index=0;
  for(const b of buildings){
    if(b.role==='CAR')continue;
    const tactical=TACTICAL_IDS.has(b.id),floors=cap(Math.round(b.h/3.1),2,9);
    const zFront=b.z+b.d/2+.115,zBack=b.z-b.d/2-.115;
    const xLeft=b.x-b.w/2-.115,xRight=b.x+b.w/2+.115;
    // Column pilasters and exposed corner concrete reinforcement strips.
    for(const x of [xLeft,xRight])for(const z of [zBack,zFront]){
      k.box('paint',x,b.h/2,z,.18,b.h-.12,.18);
      for(let y=3.1;y<b.h-.35;y+=3.1)
        k.box('galvanized',x,y,z,.25,.10,.25);
    }
    // Thin slab drip edges are high enough to not affect first floor travel.
    for(let floor=1;floor<=floors;floor++){
      const y=Math.min(b.h-.25,(floor*b.h/floors));
      k.box('concrete',b.x,y,zFront,b.w+.15,.09,.19);
      k.box('concrete',b.x,y,zBack,b.w+.15,.09,.19);
      k.box('concrete',xLeft,y,b.z,.19,.09,b.d+.15);
      k.box('concrete',xRight,y,b.z,.19,.09,b.d+.15);
    }
    // Water drainage tied to the same facade instead of random floating pipes.
    for(const x of [b.x-b.w*.40,b.x+b.w*.40]){
      k.rod('galvanized',x,1.0,zFront+.05,x,Math.max(1.1,b.h-.45),zFront+.05,.08);
      for(let y=1.1;y<b.h;y+=2.7)
        k.box('anodized',x,y,zFront+.08,.17,.12,.15);
    }
    if(!tactical){
      // Per-storey window heads, weather seals and brick/mortar pier lines.
      for(let floor=0;floor<floors;floor++){
        const y=1.76+floor*(b.h-2.8)/Math.max(1,floors-1);
        const cols=Math.max(2,Math.floor(b.w/2.8));
        for(let i=0;i<cols;i++){
          if(floor===0&&i===Math.floor(cols/2))continue;
          const xx=b.x-b.w/2+(i+.5)*b.w/cols;
          k.box('galvanized',xx,y+.79,zFront+.044,1.11,.09,.10);
          k.box('oxide',xx,y-.78,zFront+.10,1.17,.055,.14);
          k.box('glass',xx,y+.06,zFront+.066,.83,1.25,.022);
          k.box('rubber',xx,y-.68,zFront+.081,1.02,.035,.028);
        }
      }
      // Ground-floor canopies with drainage and real metal soffit slats.
      if(['SHOP','HOTEL','CLINIC','FACTORY'].includes(b.role)){
        const width=Math.min(7.1,b.w*.65);
        k.box('anodized',b.x,3.14,zFront+.64,width,.18,1.0);
        for(let i=0;i<8;i++){
          const xx=b.x-width/2+(i+.5)*width/8;
          k.box('galvanized',xx,3.035,zFront+.61,.035,.024,.92);
        }
        k.rod('oxide',b.x-width*.42,2.9,zFront+.15,b.x-width*.42,3.14,zFront+.9,.06);
        k.rod('oxide',b.x+width*.42,2.9,zFront+.15,b.x+width*.42,3.14,zFront+.9,.06);
      }
    }else{
      // Tactical buildings keep their original transparent/open windows,
      // ramps and rooftop access. Never add opaque facade glazing here.
      for(const x of [xLeft+.29,xRight-.29]){
        k.rod('galvanized',x,b.h-.18,zBack,x,b.h-.18,zFront,.08);
      }
    }
    // Building rooftop: cap flashing, exhaust ducts and utility frames;
    // the 2m rim is never touched by ground-level server navigation.
    if(!tactical){
      for(const x of [xLeft+.22,xRight-.22]){
        k.box('concrete',x,b.h+.22,b.z,.17,.46,b.d+.12);
      }
      for(const z of [zBack+.16,zFront-.16])
        k.box('concrete',b.x,b.h+.22,z,b.w+.13,.46,.16);
      for(const dx of [-.26,.26]){
        const px=b.x+b.w*.22+dx;
        k.box('anodized',px,b.h+.56,b.z-b.d*.13,.46,.37,.53);
        for(let i=-1;i<=1;i++)
          k.box('dark',px+i*.11,b.h+.58,b.z-b.d*.13+.27,.025,.21,.020);
        k.rod('galvanized',px,b.h+.75,b.z-b.d*.13,px,b.h+1.15,b.z-b.d*.13,.065);
      }
    }
    if(index++%5===0&&b.h>9){
      // Restrained rooftop mechanical handrail.
      const z=b.z-b.d*.24;
      for(const x of [b.x-b.w*.26,b.x+b.w*.26]){
        k.rod('galvanized',x,b.h+.25,z,x,b.h+1.0,z,.055);
      }
      k.rod('galvanized',b.x-b.w*.26,b.h+1.0,z,b.x+b.w*.26,b.h+1.0,z,.055);
    }
  }
}

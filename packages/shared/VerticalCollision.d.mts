export interface MoveResult { x:number; z:number; feet:number }
export interface VerticalStep { y:number; vy:number; grounded:boolean }
export interface BoxPiece {buildingId:string;kind:string;x:number;y:number;z:number;w:number;h:number;d:number;solid:boolean;display:boolean}
export interface FlatSurface {buildingId:string;kind:string;x:number;z:number;w:number;d:number;y:number}
export interface RampSurface {buildingId:string;kind:string;xMin:number;xMax:number;zMin:number;zMax:number;yMin:number;yMax:number}
export interface VerticalLayout {version:number;halfSize:number;tacticalIds:string[];boxes:BoxPiece[];surfaces:FlatSurface[];ramps:RampSurface[];levelsById?:Record<string,number[]>}
export const PHYSICS:Readonly<{eyeHeight:number;bodyHeight:number;playerRadius:number;gravity:number;jumpVelocity:number;stepHeight:number;walkStep:number}>;
export const VERTICAL_LAYOUT: VerticalLayout;
export const TACTICAL_IDS: Set<string>;
export function surfaceHeightAt(x:number,z:number,feet?:number,reach?:number):number|null;
export function canOccupyAt(x:number,z:number,feet:number,radius?:number,height?:number):boolean;
export function moveHorizontal(x:number,z:number,feet:number,dx:number,dz:number,grounded:boolean,radius?:number):MoveResult;
export function stepVertical(y:number,vy:number,grounded:boolean,x:number,z:number,dt:number):VerticalStep;

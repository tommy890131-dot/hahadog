export interface NavNode {
  id: number;
  x: number;
  y: number;
  z: number;
  tag: string;
}
export interface NavField {
  goal: number;
  dist: Float64Array;
  next: Int32Array;
}
export interface WorldPosition { x:number; z:number; y:number }
export interface ZombieAgent extends WorldPosition {
  id:number;
  vx:number;
  vz:number;
  vy:number;
  speed:number;
  grounded:boolean;
  kind:'walker'|'runner'|'brute';
  step:number;
  facing?:number;
  route?:Array<NavNode | (WorldPosition & {tag:string})>;
  routeIndex?:number;
  routeGoal?:number;
  routeTarget?:string;
  routeGoalX?:number;
  routeGoalZ?:number;
  routeGoalY?:number;
  stuckFor?:number;
  nextStumble?:number;
  stumbleUntil?:number;
}
export class ZombieNavigation {
  readonly nodes: NavNode[];
  readonly edges: Array<Array<{id:number;cost:number}>>;
  readonly ground: Int32Array;
  canTraverse(a:NavNode,b:NavNode):boolean;
  closest(x:number,z:number,y:number):number;
  routeTo(target:WorldPosition):NavField;
  path(from:WorldPosition,to:WorldPosition,maxNodes?:number):NavNode[];
}
export const navigation: ZombieNavigation;
export function buildZombieBuckets<T extends WorldPosition>(zombies:T[],cell?:number):{
  near(z:T):T[];
};
export function steerZombie(z:ZombieAgent,desired:{x:number;z:number;ramp:boolean},neighbors:ZombieAgent[],dt:number,now:number):{
  x:number;z:number;speed:number;
};
export function routeWaypoints(from:WorldPosition,field:NavField):NavNode[];
export function advanceZombie(z:ZombieAgent,target:WorldPosition & {id:string},field:NavField,
  neighbors:ZombieAgent[],dt:number,now:number,knockX?:number,knockZ?:number):boolean;

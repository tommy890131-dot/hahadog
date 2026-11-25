export type MapEntrance={id:string;label:string;x:number;z:number;types:readonly string[]};
export function entrancesFor(mapId:string):readonly MapEntrance[];
export function createMapDirector(mapId:string,seed?:number,now?:number):Record<string,unknown>;
export function queueMapHorde(state:unknown,options?:{count?:number;gate?:string|null;now?:number;cause?:string;pressure?:number}):{id:number;cause:string;gate:string;label:string;remaining:number}|null;
export function nextMapSpawn(state:unknown,options:{now:number;activeCount:number;maxActive?:number;pressure?:number}):{kind:string;gate:string;x:number;z:number;cause:string}|null;
export function advanceMapDirector(state:unknown,options?:{now?:number;pressure?:number;activeCount?:number;phase?:string}):{id:number;cause:string;gate:string;label:string;remaining:number}|null;
export function publicMapDirector(state:unknown):{mapId:string;activeGroups:number;nextGate:string|undefined;pressure:number};

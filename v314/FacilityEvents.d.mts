export type FacilityInteractive={id:string;label:string;x:number;y:number;z:number;range?:number;radius?:number;ready?:boolean;requires?:string;active?:boolean};
export function createFacilityEvents(mapId:string,seed?:number,now?:number):Record<string,unknown>;
export function facilityPublicEnvironment(s:unknown,now?:number):{powerOnline:boolean;blackoutRemainingMs:number;relayReady:boolean;selectedRoute:string|null;routes:FacilityInteractive[];devices:FacilityInteractive[]};
export function facilityRouteReady(s:unknown,id:string):boolean;

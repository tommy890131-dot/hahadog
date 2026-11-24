export type MetroDevice={id:string;label:string;x:number;z:number;y:number;range:number};
export type MetroExit={id:string;label:string;x:number;z:number;y:number;radius:number;requires:string};
export const METRO_DEVICES:Readonly<Record<string,MetroDevice>>;
export const METRO_EXITS:Readonly<Record<string,MetroExit>>;
export function createMetroEvents(seed?:number):Record<string,unknown>;
export function metroPublicEnvironment(state:unknown,now:number):unknown;

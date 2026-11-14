export type PlayerRecord = {
  id:string; name:string; x:number; y:number; vy:number; z:number; grounded:boolean; yaw:number; pitch:number; ackMoveSeq:number;
  hp:number;maxHp:number;armor:number;level:number;xp:number;nextXp:number;money:number;
  weaponId:string;primary:string|null;secondary:string;owned:string[];inSafehouse:boolean;
  ammo:number;reserve:number;kills:number;downed:boolean;reloading:boolean;
};
export type ZombieRecord = { id:number; x:number; y:number; z:number; hp:number; maxHp?:number; kind:'runner'|'walker'|'brute'|'screamer'|'spitter'|'climber'|'juggernaut'|'boss'; step:number; facing:number; };
export type DefenseRecord = {id:number;kind:'turret'|'barricade';x:number;y:number;z:number;hp:number;maxHp:number};
export type LootRecord = {id:number;x:number;y:number;z:number;rarity:'common'|'uncommon'|'rare'|'legendary'};
export type ServerEvent = {
  type:string; id?:string; selfId?:string; code?:string; hostId?:string;
  phase?:string; players?:PlayerRecord[]; zombies?:ZombieRecord[];
  remaining?:number; wave?:number; remainingMs?:number; shopRemainingMs?:number; nextWave?:number; by?:string; target?:string;
  from?:{x:number;y:number;z:number}; to?:{x:number;y:number;z:number};
  enemyId?:number; hit?:boolean; killed?:boolean; message?:string;
  pressure?:number; directorPhase?:string; amount?:number;armorDamage?:number;
  money?:number;xp?:number;level?:number;levelUps?:number;headshot?:boolean;
  ok?:boolean;sku?:string;reason?:string;action?:string;weaponId?:string;
  mission?:string;levelId?:string;missionPhase?:string;goal?:number;progress?:number;success?:boolean;classId?:string;
  defenses?:DefenseRecord[];loot?:LootRecord[];rarity?:string;credits?:number;event?:string;bossPhase?:number;kind?:string;defenseId?:number;levelLabel?:string;objective?:string;hasNextLevel?:boolean;result?:'won'|'lost'|null;levelIndex?:number;
};
export class Multiplayer {
  ws:WebSocket|null=null;
  readonly session:{selfId:string;code:string;hostId:string;phase:string;players:PlayerRecord[];zombies:ZombieRecord[];wave:number;remaining:number;shopRemainingMs:number;levelIndex:number;levelLabel:string;result:'won'|'lost'|null} = {
    selfId:'',code:'',hostId:'',phase:'menu',players:[],zombies:[],wave:0,remaining:0,shopRemainingMs:0,levelIndex:0,levelLabel:'失聯街區',result:null
  };
  onEvent:(event:ServerEvent)=>void=()=>{};
  onStatus:(status:string)=>void=()=>{};
  private retry?:number;
  constructor(){ this.connect(); }
  connect(){
    if(this.ws && (this.ws.readyState===0 || this.ws.readyState===1)) return;
    const ws = new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);
    this.ws=ws;
    this.onStatus('伺服器連線中…');
    ws.onopen=()=>this.onStatus('已連線 · 4 人合作房間');
    ws.onmessage=event=>{
      try {
        const msg=JSON.parse(event.data) as ServerEvent;
        if(msg.type==='hello' && msg.id) this.session.selfId=msg.id;
        if(msg.type==='joined') {
          this.session.selfId=msg.selfId||this.session.selfId;
          this.session.code=msg.code||'';
          this.session.hostId=msg.hostId||'';
          this.session.players=msg.players||[];
          this.session.phase='lobby';
        }
        if(msg.type==='room') {
          this.session.hostId=msg.hostId||'';
          this.session.players=msg.players||[];
          if(msg.phase) this.session.phase=msg.phase;
          if(typeof msg.levelIndex==='number')this.session.levelIndex=msg.levelIndex;
          if(msg.result!==undefined)this.session.result=msg.result;
        }
        if(msg.type==='intermission'){
          this.session.phase='intermission';
          this.session.shopRemainingMs=msg.remainingMs??30000;
        }
        if(msg.type==='campaignStart'){
          this.session.levelIndex=msg.levelIndex??0;
          this.session.levelLabel=msg.levelLabel||'失聯街區';
          this.session.result=null;
          this.session.zombies=[];
        }
        if(msg.type==='missionEnd'){
          this.session.phase='ended';
          this.session.result=msg.success?'won':'lost';
          if(typeof msg.levelIndex==='number')this.session.levelIndex=msg.levelIndex;
          if(msg.levelLabel)this.session.levelLabel=msg.levelLabel;
        }
        if(msg.type==='wave') {
          this.session.wave=msg.wave||1;
          this.session.phase='playing';
          this.session.shopRemainingMs=0;
        }
        if(msg.type==='snapshot') {
          this.session.wave=msg.wave||this.session.wave;
          this.session.phase=msg.phase||this.session.phase;
          this.session.remaining=msg.remaining??0;
          this.session.shopRemainingMs=msg.shopRemainingMs??0;
          this.session.players=msg.players||[];
          this.session.zombies=msg.zombies||[];
        }
        if(msg.type==='gameOver') {this.session.phase='ended';this.session.result='lost';}
        this.onEvent(msg);
      } catch(error){console.warn('Invalid game message',error);}
    };
    ws.onclose=()=>{
      this.session.phase='menu';
      this.onStatus('連線中斷，重新連線中…');
      this.onEvent({type:'disconnected'});
      this.retry=window.setTimeout(()=>this.connect(),2000);
    };
  }
  send(data:Record<string, unknown>){if(this.ws?.readyState===WebSocket.OPEN) this.ws.send(JSON.stringify(data));}
  create(name:string){this.send({type:'create',name});}
  join(code:string,name:string){this.send({type:'join',code,name});}
  start(){this.send({type:'start'});}
  retryLevel(){this.send({type:'retryLevel'});}
  nextLevel(){this.send({type:'nextLevel'});}
  restartCampaign(){this.send({type:'restartCampaign'});}
  move(x:number,z:number,yaw:number,pitch:number,seq:number){this.send({type:'move',x,z,yaw,pitch,seq});}
  dispose(){clearTimeout(this.retry); this.ws?.close();}
}

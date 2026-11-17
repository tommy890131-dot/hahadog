import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ROOM_IDLE_MS,SOCKET_PING_INTERVAL_MS,SOCKET_PONG_TIMEOUT_MS,
  MAX_PLAYERS_PER_ROOM,shouldExpireRoom,pruneRoomRegistry,handshakeCapacity} from '../v312/RoomCapacity.mjs';
const source=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('active four-player rooms remain four-player capped, not globally joined into a mega room',()=>{
  assert.equal(MAX_PLAYERS_PER_ROOM,4);
  const server=source('server.mjs');
  assert.match(server,/room\.players\.size>=4/);
  assert.match(server,/if\(rooms\.size>=MAX_ROOMS\)/);
});
test('empty room expires at once and idle rooms have phase-specific safe grace period',()=>{
  const now=30*60*1000;
  assert.equal(shouldExpireRoom({players:new Map(),phase:'playing',lastActivityAt:now},now),true);
  for(const [phase,timeout] of Object.entries(ROOM_IDLE_MS)){
    const room={players:new Map([['x',{}]]),phase,lastActivityAt:1000};
    assert.equal(shouldExpireRoom(room,1000+timeout-1),false,phase);
    assert.equal(shouldExpireRoom(room,1000+timeout),true,phase);
  }
  assert.equal(shouldExpireRoom({players:new Map([['p',{}]]),phase:'lobby'},now),false);
  assert.equal(shouldExpireRoom(null,now),false);
});
test('room expiration cleanup frees only abandoned sessions and never removes active rooms',()=>{
  const now=1_000_000, expired={phase:'lobby',lastActivityAt:now-ROOM_IDLE_MS.lobby-1,players:new Map([['p',{}]])};
  const playing={phase:'playing',lastActivityAt:now,players:new Map([['p',{}]])};
  const empty={phase:'lobby',lastActivityAt:now,players:new Map()};
  const rooms=new Map([['A',expired],['B',playing],['C',empty]]);
  const closed=[];
  const removed=pruneRoomRegistry(rooms,now,r=>closed.push(r));
  assert.equal(removed,2);assert.equal(rooms.size,1);
  assert.equal(rooms.get('B'),playing);
  assert.deepEqual(closed,[expired]);
});
test('WebSocket heartbeat has bounded disconnection timeout and quota has distinct server/address reasons',()=>{
  assert.ok(SOCKET_PING_INTERVAL_MS>=10_000);
  assert.ok(SOCKET_PONG_TIMEOUT_MS>SOCKET_PING_INTERVAL_MS*2);
  assert.equal(handshakeCapacity(256,0,'a',256,64),'server');
  assert.equal(handshakeCapacity(100,64,'a',256,64),'address');
  assert.equal(handshakeCapacity(100,3,'a',256,64),null);
  const server=source('server.mjs');
  assert.match(server,/pruneRoomRegistry\(rooms,now,expireRoom\)/);
  assert.match(server,/if\(now-this\.lastPongAt>SOCKET_PONG_TIMEOUT_MS\)/);
  assert.match(server,/this\.frame\(9,Buffer\.from\('df-alive'\)\)/);
  assert.match(server,/if\(opcode===10\)\{this\.lastPongAt=Date\.now\(\)/);
  assert.match(server,/HTTP\/1\.1 503 Service Unavailable/);
});
test('browser disposes WebSockets on unload, suppresses reconnect on disposed instance',()=>{
  const client=source('apps/client/src/network/Multiplayer.ts');
  const main=source('apps/client/src/main.ts');
  assert.match(main,/network\.dispose\(\)/);
  assert.match(client,/if\(this\.disposed\|\|\(this\.ws/);
  assert.match(client,/if\(this\.disposed\|\|ws!==this\.ws\)return/);
  assert.match(client,/socket\.onclose=null;socket\.onmessage=null;socket\.onopen=null/);
  assert.match(client,/clearTimeout\(this\.retry\)/);
  assert.match(client,/this\.reconnectAttempts\+\+/);
});

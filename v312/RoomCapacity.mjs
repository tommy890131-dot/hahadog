/**
 * Capacity safety for DEADLINE FOUR multiplayer on a single Render instance.
 * Empty rooms are always reclaimable; idle rooms holding alive-but-unused
 * browsers expire so room creation cannot be blocked indefinitely.
 * Room activity is authoritative gameplay input (not websocket keepalive).
 */
export const ROOM_IDLE_MS=Object.freeze({
  lobby:30*60*1000,
  intermission:45*60*1000,
  playing:90*60*1000,
  ended:20*60*1000
});
export const SOCKET_PING_INTERVAL_MS=25_000;
export const SOCKET_PONG_TIMEOUT_MS=60_000;
export const MAX_PLAYERS_PER_ROOM=4;
export function shouldExpireRoom(room,now){
  if(!room||!Number.isFinite(now))return false;
  if(room.players?.size===0)return true;
  if(!Number.isFinite(room.lastActivityAt))return false;
  const ttl=ROOM_IDLE_MS[room.phase]??ROOM_IDLE_MS.lobby;
  return now-room.lastActivityAt>=ttl;
}
/**
 * Only expired rooms are evicted. Active rooms are never sacrificed to
 * accommodate a new room even if the global admission limit was reached.
 * onExpire must close each WebSocket, which invokes server onClose cleanup.
 */
export function pruneRoomRegistry(rooms,now,onExpire){
  let removed=0;
  for(const [code,room] of rooms){
    if(room.players?.size===0){
      rooms.delete(code);removed++;continue;
    }
    if(shouldExpireRoom(room,now)){
      onExpire(room);
      rooms.delete(code);
      removed++;
    }
  }
  return removed;
}
export function handshakeCapacity(peers,ipConnections,ip,maxConnections,maxPerIp){
  if(peers>=maxConnections)return 'server';
  if(ipConnections>=maxPerIp)return 'address';
  return null;
}

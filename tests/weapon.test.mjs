import test from 'node:test';
import assert from 'node:assert/strict';
import { WeaponState, V2_RIFLE } from '../apps/client/src/game/WeaponState.ts';

test('animation finish is the only local event that grants reload ammo', () => {
  const gun = new WeaponState();
  assert.equal(gun.startFire(1000), true);
  assert.equal(gun.startReload(1001), true, 'Reload can cancel Fire for responsive input');
  assert.equal(gun.ammo, 29);
  assert.equal(gun.startFire(1300), false);
  assert.equal(gun.ammo, 29, 'Must not refill early');
  assert.equal(gun.finish('Fire'), false, 'Wrong clip ignored');
  assert.equal(gun.finish('Reload'), true);
  assert.equal(gun.mode, 'Idle');
  assert.equal(gun.ammo, 30);
  assert.equal(gun.reserve, 179);
});

test('automatic fire cadence does not wait for Fire clip to finish', () => {
  const gun = new WeaponState();
  assert.equal(gun.startFire(1000), true);
  assert.equal(gun.startFire(1050), false);
  assert.equal(gun.startFire(1135), true);
  assert.equal(gun.ammo, 28);
});

test('no more ammo than reserve permits', () => {
  const gun = new WeaponState();
  gun.ammo = 3;
  gun.reserve = 4;
  assert.equal(gun.startReload(1000), true);
  gun.finish('Reload');
  assert.equal(gun.ammo, 7);
  assert.equal(gun.reserve, 0);
});

test('multiplayer reload needs both animation AND server confirmation', () => {
  const gun = new WeaponState(V2_RIFLE, true);
  gun.resetFromServer(12, 100);
  assert.equal(gun.startReload(1000), true);
  assert.equal(gun.finish('Reload'), false);
  assert.equal(gun.ammo, 12);
  gun.syncServerAmmo({ ammo: 12, reserve: 100, reloading: true }, 1200);
  assert.equal(gun.syncServerAmmo({ ammo: 30, reserve: 82, reloading: false }, 2600), true);
  assert.equal(gun.ammo, 30);
  assert.equal(gun.reserve, 82);
  assert.equal(gun.mode, 'Idle');
});

test('server-first update waits for local animation', () => {
  const gun = new WeaponState(V2_RIFLE, true);
  gun.resetFromServer(20, 80);
  gun.startReload(1000);
  gun.syncServerAmmo({ ammo: 20, reserve: 80, reloading: true }, 1200);
  assert.equal(gun.syncServerAmmo({ ammo: 30, reserve: 70, reloading: false }, 2550), false);
  assert.equal(gun.ammo, 20);
  assert.equal(gun.finish('Reload'), true);
  assert.equal(gun.ammo, 30);
});

test('stale server reload unlocks safely without granting ammo', () => {
  const gun = new WeaponState(V2_RIFLE, true);
  gun.resetFromServer(5, 50);
  gun.startReload(1000);
  gun.finish('Reload');
  assert.equal(gun.updateTimeout(6100), true);
  assert.equal(gun.mode, 'Idle');
  assert.equal(gun.ammo, 5);
});

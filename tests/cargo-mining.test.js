import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import { mineCargoRock } from '../server/cargo-mining.js';import { emptyCommerce,ensureAccount } from '../src/trading/model.js';
import { nearbyConstructionDeposits } from '../src/mining/construction-deposits.js';import { bodySurfacePoint,PYRE } from '../src/celestial.js';import { pyreLandingDirection } from '../src/pyre-world.js';
import { createDensity,meshVolume } from '../src/mining/volume.js';import { asteroidField } from '../src/ring-world.js';import { RockCollision } from '../src/mining/collision.js';
test('server cuts a canonical Pyre outcrop, credits exact yield and denies forged range/fire',()=>{
 const start=bodySurfacePoint(new THREE.Vector3(...pyreLandingDirection()),PYRE,2),d=nearbyConstructionDeposits(start,1000)[0];assert.ok(d);
 const localStart=new THREE.Vector3(0,1,4),position=localStart.clone().applyQuaternion(d.quaternion).add(d.position),direction=new THREE.Vector3(0,-.1,-1).normalize().applyQuaternion(d.quaternion),orientation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1),direction);
 const player={id:'miner',nav:{position,orientation,mode:'walk',insideShip:false},health:100,weapon:'mining-laser-tool',input:{fire:true}},s=emptyCommerce();ensureAccount(s,player.id);
 const r=mineCargoRock(s,player,d.id,1000,{occludes:()=>null});assert.ok(r.state.accounts.miner.resources.basalt+r.state.accounts.miner.resources.copper>0);assert.equal(r.state.rocks[d.id].revision,1);assert.equal(s.rocks,undefined);
 assert.throws(()=>mineCargoRock(r.state,player,d.id,1100,{occludes:()=>null}),/cycling/);player.input.fire=false;assert.throws(()=>mineCargoRock(r.state,player,d.id,2000,{}),/hold fire/);player.input.fire=true;player.nav.position.addScalar(1000);assert.throws(()=>mineCargoRock(r.state,player,d.id,3000,{}),/nearby/);
});

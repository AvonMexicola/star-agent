import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {step} from '../src/flight-model.js';
import {shipHandling} from '../src/ship-handling.js';
import {combatSpeed,shipWeaponStatus} from '../src/combat/flight-policy.js';
import {CombatSimulation} from '../src/combat/simulation.js';
const vacuum={density:0,gravity:new Vector3()},state=()=>({velocity:new Vector3(0,0,-100),orientation:new Quaternion(),angularVelocity:new Vector3()});
test('every hull carries momentum through a turn and brakes over seconds, Atlas longest',()=>{
 const distances=[];
 for(const shipId of ['kestrel','nomad','atlas']){
  let s=state();s.orientation.setFromAxisAngle(new Vector3(0,1,0),Math.PI/2);
  const turned=step(s,{shipId,assist:true,targetVelocity:new Vector3(-100,0,0)},vacuum,1);
  assert.ok(turned.velocity.z < -60,'nose turns before flight path');
  let distance=0;s=state();
  const first=step(s,{shipId,assist:true,brake:true},vacuum,1/60);
  assert.ok(first.velocity.length()>98,'brake cannot stop in a frame');
  for(let i=0;i<60*40&&s.velocity.length()>.01;i++){s=step(s,{shipId,assist:true,brake:true},vacuum,1/60);distance+=s.velocity.length()/60;}
  assert.ok(s.velocity.length()<.01);distances.push(distance);
 }
 assert.ok(distances[1]>distances[0]*1.5);assert.ok(distances[2]>distances[1]*2);
});
test('unlocked 180-degree reversal preserves flight path; re-enabling assist cannot erase it',()=>{
 const s=state();s.orientation.setFromAxisAngle(new Vector3(0,1,0),Math.PI);
 const coast=step(s,{},vacuum,2);assert.deepEqual(coast.velocity,s.velocity);
 const recover=step(coast,{shipId:'atlas',assist:true,targetVelocity:new Vector3(0,0,100)},vacuum,1);
 assert.ok(recover.velocity.z < -85);
});
test('fly-by-wire correction and stopping converge across30/60/120Hz',()=>{
 const run=hz=>{let s=state();for(let i=0;i<6*hz;i++)s=step(s,{shipId:'atlas',assist:true,targetVelocity:new Vector3(30,20,0)},vacuum,1/hz);return s.velocity;};
 assert.ok(run(30).distanceTo(run(120))<1e-8);assert.ok(run(60).distanceTo(run(120))<1e-8);
});
test('combat/cruise, boost, automation and overspeed lock firing in both assist modes',()=>{
 for(const shipId of ['kestrel','nomad','atlas'])for(const flightAssist of [true,false]){
  const nav={shipId,flightAssist,mode:'flight',powered:true,combatMode:true,speed:combatSpeed(shipId)};
  assert.equal(shipWeaponStatus(nav),'WEAPONS READY');
  for(const change of [{combatMode:false},{speed:nav.speed+1},{boost:true},{travel:{}},{autoland:true},{stationLift:true},{powered:false}])assert.notEqual(shipWeaponStatus({...nav,...change}),'WEAPONS READY');
  const s=state();s.velocity.set(0,0,-1000);
  const slower=step(s,{shipId,maxSpeed:combatSpeed(shipId)},vacuum,1/60);
  assert.ok(slower.velocity.length()>=1000-shipHandling(shipId).rcs/60-1e-8);
 }
});
test('combat projectiles inherit forward, lateral and retreating shooter velocity',()=>{
 for(const velocity of [new Vector3(0,0,-180),new Vector3(180,0,0),new Vector3(0,0,180)]){
  const sim=new CombatSimulation();sim.fire(new Vector3(25e9,0,0),new Vector3(0,0,-1),'pulse',null,null,velocity);
  assert.deepEqual(sim.projectiles[0].velocity,new Vector3(0,0,-450).add(velocity));
 }
});

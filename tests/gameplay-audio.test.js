import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { footstepSurface, FootstepTracker } from '../src/audio/footsteps.js';
import { SOUND_KINDS, synthesize } from '../src/audio/synthesis.js';
import { GameplayAudio, weaponSound } from '../src/audio/gameplay.js';
import { walkingAudioState } from '../src/audio/ground-state.js';
import { EnergyEffects } from '../src/effects/energy-effects.js';

test('surface selection respects metal support, airless rock, polar snow, slope and wet shoreline',()=>{
  assert.equal(footstepSurface({metal:true,body:'selene'}),'metal');
  assert.equal(footstepSurface({body:'selene'}),'rock');
  assert.equal(footstepSurface({height:100,latitude:.9}),'snow');
  assert.equal(footstepSurface({height:3600,slope:.3}),'snow');
  assert.equal(footstepSurface({height:3600,slope:1}),'rock');
  assert.equal(footstepSurface({height:.2,latitude:.1}),'water');
  assert.equal(footstepSurface({height:2}),'sand');
  assert.equal(footstepSurface({height:200,slope:.7}),'rock');
  assert.equal(footstepSurface({height:200,biome:'TEMPERATE FOREST'}),'grass');
});
test('gait follows distance at different frame rates, alternates feet, and rejects air, pause, warp and walls',()=>{
  const count=hz=>{const gait=new FootstepTracker(),steps=[];for(let i=0;i<=hz*3;i++){const step=gait.update({position:[i/hz*4,0,0]},1/hz);if(step)steps.push(step);}return steps;};
  assert.equal(count(5).length,count(120).length);assert.equal(count(30).length,count(120).length);assert.equal(count(60).length,8);
  assert.notEqual(count(60)[0].side,count(60)[1].side);
  const gait=new FootstepTracker();gait.update({position:[0,0,0]},.1);
  assert.equal(gait.update({position:[0,0,0]},.1),null);
  assert.equal(gait.update({position:[100,0,0]},.1),null);
  assert.equal(gait.update({position:[101,1,0],grounded:false},.1),null);
  assert.equal(gait.update({position:[102,1,0],active:false},.1),null);
  assert.equal(gait.update({position:[103,1,0]},2),null);
  assert.equal(gait.update({position:[103,1,0],frame:'cabin'},.1),null);
});
test('cabin movement uses local position, and elevated ground under a ship is not its deck',()=>{
  const nav={toShipLocal:()=>new THREE.Vector3(0,2.42,0),position:new THREE.Vector3(1e6,1e6,1e6),normal:new THREE.Vector3(0,1,0),body:{id:'aeon'},layout:{eyeHeight:1.7},jumpHeight:0,mode:'walk',enabled:true,focused:true};
  const state=walkingAudioState(nav);assert.match(state.frame,/ship/);assert.equal(state.metal,true);
  nav.position.x+=10000;assert.deepEqual(walkingAudioState(nav).position,state.position);
  nav.toShipLocal=()=>new THREE.Vector3(0,100,0);assert.equal(walkingAudioState(nav).metal,false);
  nav.mode='eva';assert.equal(walkingAudioState(nav).active,false);
});
test('every original sound has finite, non-clipping PCM and variants differ',()=>{
  const fingerprints=new Set();
  for(const kind of SOUND_KINDS){const a=synthesize(kind,0,24000),b=synthesize(kind,1,24000);assert.ok(a.every(Number.isFinite));const peak=a.reduce((p,n)=>Math.max(p,Math.abs(n)),0);assert.ok(peak>.1&&peak<.73);assert.equal(Math.abs(a[0]),0);assert.notDeepEqual(a,b);fingerprints.add(a.slice(20,40).join(','));}
  assert.equal(fingerprints.size,SOUND_KINDS.length);
});
test('energy events follow accepted shots and actual delayed impact, with an explicit personal weapon sound',()=>{
  const events=[],fx=new EnergyEffects(new THREE.Scene(),{onSound:e=>events.push(e)}),start=new THREE.Vector3(),direction=new THREE.Vector3(0,0,-1);
  fx.fire(start,direction,{sound:'sidearm',weapon:'pulse',speed:100,hit:{point:new THREE.Vector3(0,0,-10)}});
  assert.deepEqual(events.map(e=>e.type),['shot']);assert.equal(events[0].sound,'sidearm');
  fx.update(.1,{origin:start});assert.deepEqual(events.map(e=>e.type),['shot','impact']);
  fx.bolts=Array(32).fill({});fx.fire(start,direction);assert.equal(events.length,2);
  assert.equal(weaponSound('rifle-laser'),'carbine');assert.equal(weaponSound('sidearm-pistol'),'sidearm');fx.bolts=[];fx.dispose();
});
function mockContext(){
  const param=()=>({value:0,setTargetAtTime(v){this.value=v;}}),node=()=>({gain:param(),pan:param(),frequency:param(),Q:param(),connect(){},disconnect(){},start(){},stop(){}});
  return {currentTime:0,state:'running',sampleRate:8000,createGain:node,createStereoPanner:node,createBufferSource:node,createOscillator:node,createBiquadFilter:node,createBuffer:()=>({copyToChannel(){}})};
}
test('mixer gates pre-gesture voices, caps polyphony, attenuates distant shots and stops cutter on mute',()=>{
  const audio=new GameplayAudio(mockContext(),{});
  assert.equal(audio.play('rock'),false);assert.equal(audio.state.buffers,0);
  audio.setEnabled(true);for(let i=0;i<30;i++)audio.play('rock');assert.equal(audio.state.voices,24);assert.equal(audio.state.buffers,4);
  audio.setMining(true,true,.5);assert.equal(audio.mining,true);assert.ok(audio.cutter.scratchGain.gain.value>0);
  audio.setEnabled(false);assert.equal(audio.state.voices,0);assert.equal(audio.cutter.gain.gain.value,0);assert.equal(audio.cutter.scratchGain.gain.value,0);
  audio.setEnabled(true);audio.event({type:'shot',weapon:'pulse',point:new THREE.Vector3(1000,0,0)},{focused:true,position:new THREE.Vector3()});assert.equal(audio.state.shots,0);
  audio.dispose();assert.equal(audio.play('pulse'),false);assert.equal(audio.state.buffers,0);
});

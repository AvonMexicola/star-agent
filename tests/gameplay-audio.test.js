import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { footstepSurface, FootstepTracker } from '../src/audio/footsteps.js';
import { SOUND_KINDS, synthesize } from '../src/audio/synthesis.js';
import { GameplayAudio, weaponSound } from '../src/audio/gameplay.js';
import { walkingAudioState } from '../src/audio/ground-state.js';
import { EnergyEffects } from '../src/effects/energy-effects.js';
import { FlightAudio } from '../src/audio.js';
import { EngineAudio, engineMix } from '../src/audio/engine.js';

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

test('sized ship shots lower pitch and increase the bounded gain without altering default personal shots',()=>{
  const context=mockContext(),sources=[];const original=context.createBufferSource;
  context.createBufferSource=()=>{const node=original();node.playbackRate={value:1};sources.push(node);return node;};
  const audio=new GameplayAudio(context,context.createGain());audio.setEnabled(true);
  const calls=[],play=audio.play.bind(audio);audio.play=(kind,options)=>{calls.push(options);return play(kind,options);};
  const nav={focused:true,position:new THREE.Vector3()};
  audio.event({type:'shot',weapon:'pulse'},nav);
  audio.event({type:'shot',weapon:'pulse',size:3,pitch:.72},nav);
  assert.equal(sources[0].playbackRate.value,1);assert.equal(sources[1].playbackRate.value,.72);
  assert.ok(calls[1].gain>calls[0].gain);assert.ok(calls[1].gain<.2);audio.dispose();
});


test('creature attacks map species, spatialize once per event, and stop on interruption',()=>{
 const audio=new GameplayAudio(mockContext(),{}),nav={focused:true,enabled:true,mode:'walk',position:new THREE.Vector3(),orientation:new THREE.Quaternion()};
 const bear={type:'creature-attack',species:'pyrebear',point:new THREE.Vector3(3,0,-3)};
 audio.event(bear,nav);assert.equal(audio.state.attacks,0);
 audio.setEnabled(true);audio.event(bear,nav);assert.equal(audio.state.last,'pyrebear-attack');assert.equal(audio.state.attacks,1);
 audio.event({...bear,species:'suloher'},nav);assert.equal(audio.state.last,'sulphurhound-attack');assert.equal(audio.state.attacks,2);
 audio.event({...bear,species:'unknown'},nav);assert.equal(audio.state.attacks,2);
 audio.event({...bear,point:new THREE.Vector3(301,0,0)},nav);assert.equal(audio.state.attacks,2);
 audio.event(bear,{...nav,enabled:false});audio.event(bear,{...nav,focused:false});assert.equal(audio.state.attacks,2);
 audio.suspend();assert.equal(audio.state.voices,0,'long growls stop on menu/focus interruption');
 audio.event({type:'building-placement',point:new THREE.Vector3(2,0,0)},nav);assert.equal(audio.state.placements,1);assert.equal(audio.last,'building-placement');
 audio.setEnabled(false);assert.equal(audio.state.voices,0);audio.dispose();
});
test('bear growl is longer and has more low-frequency weight than the hound snarl',()=>{
 const bear=synthesize('pyrebear-attack',0,24000),hound=synthesize('sulphurhound-attack',0,24000);
 const lowShare=samples=>{let low=0,energy=0,total=0;const a=1-Math.exp(-2*Math.PI*180/24000);for(const n of samples){low+=a*(n-low);energy+=low*low;total+=n*n;}return energy/total;};
 assert.ok(bear.length>hound.length);assert.ok(lowShare(bear)>lowShare(hound)*1.15);
 for(const kind of ['building-placement','pyrebear-attack','sulphurhound-attack']){const pcm=synthesize(kind,0,24000);assert.ok(Math.abs(pcm.at(-1))<.001,'no sharp ending');}
});

test('engine spools with actual thrust and boost, idles seated, and stops when power is lost',async()=>{
  const {engineMix,EngineAudio}=await import('../src/audio/engine.js');
  const idle=engineMix({mode:'landed'}),thrust=engineMix({throttle:1}),boost=engineMix({throttle:1,boost:true});
  assert.ok(idle.tone>0&&thrust.tone>idle.tone&&boost.exhaust>thrust.exhaust);
  assert.equal(engineMix({throttle:0,boost:true}).boost,false,'holding boost while coasting does not fire engines');
  for(const mode of ['walk','eva','crashed','destroyed'])assert.equal(engineMix({mode,throttle:1}).exhaust,0);
  assert.equal(engineMix({powered:false,throttle:1,boost:true}).tone,0);
  assert.equal(engineMix({throttle:NaN}).load,0);
  const context=mockContext(),noise=context.createBufferSource(),engine=new EngineAudio(context,{},noise);
  assert.equal(engine.toneGain.gain.value,0,'constructed engine is silent until updated after gesture');
  engine.update({throttle:1});assert.ok(engine.exhaustGain.gain.value>idle.exhaust);
  engine.update({powered:false});assert.equal(engine.exhaustGain.gain.value,0);
  engine.dispose();engine.update({throttle:1});assert.equal(engine.exhaustGain.gain.value,0);
});

test('Atlas, Kestrel and Nomad have distinct bounded voices and no speed-driven thrust',()=>{
  const voices = ['atlas','nomad','kestrel'].map(shipId=>engineMix({shipId,throttle:1}));
  assert.ok(voices[0].pitch<voices[1].pitch&&voices[1].pitch<voices[2].pitch);
  assert.ok(voices[0].spool>voices[1].spool&&voices[1].spool>voices[2].spool);
  for(const shipId of ['atlas','kestrel','nomad']){
    const idle=engineMix({shipId}),drift=engineMix({shipId,speed:40000,throttle:0,boost:true});
    assert.deepEqual(drift,idle,'velocity and a held boost button do not produce thrust');
    const boost=engineMix({shipId,throttle:1,boost:true});
    assert.ok(boost.tone+boost.turbine+boost.exhaust<.55,'bounded sum of peak input gains');
    assert.equal(engineMix({shipId,throttle:1,forwardThrottle:0,boost:true}).boost,false,'braking cannot light an afterburner');
    assert.equal(engineMix({shipId,throttle:1,active:false}).exhaust,0);
  }
  assert.equal(engineMix({shipId:'unknown'}).shipId,'nomad');
});

test('powered cabin sound is filtered and quiet; outside and lost ships are silent',()=>{
  for(const shipId of ['atlas','kestrel','nomad']){
    const seated=engineMix({shipId}),cabin=engineMix({shipId,mode:'walk',insideShip:true});
    assert.ok(cabin.active&&cabin.cabin&&cabin.tone>0&&cabin.tone<seated.tone);
    assert.ok(cabin.cutoff<seated.cutoff);
    const drifting=engineMix({shipId,mode:'walk',insideShip:true,cabinFlight:true,throttle:0,boost:true});
    assert.equal(drifting.boost,false);assert.equal(drifting.load,0);
    const maneuvering=engineMix({shipId,mode:'walk',insideShip:true,cabinFlight:true,throttle:.5});
    assert.equal(maneuvering.load,.5);
    for(const state of [{powered:false},{insideShip:false},{mode:'eva'},{mode:'crashed'},{mode:'destroyed'}]){
      assert.equal(engineMix({shipId,mode:'walk',insideShip:true,cabinFlight:true,throttle:1,...state}).tone,0);
    }
  }
});

test('switching hulls retunes one graph and suspend clears its previous thrust',()=>{
  const c=mockContext(),engine=new EngineAudio(c,{},c.createBufferSource()),tone=engine.tone;
  for(const shipId of ['atlas','kestrel','nomad','atlas']){
    engine.update({shipId,throttle:1,boost:true});
    assert.equal(engine.tone,tone);assert.equal(engine.state.shipId,shipId);
    assert.equal(engine.tone.frequency.value,engine.state.pitch);
    assert.equal(engine.turbine.frequency.value,engine.state.turbinePitch);
  }
  engine.suspend();assert.equal(engine.state.active,false);assert.equal(engine.state.load,0);
  assert.equal(engine.exhaustGain.gain.value,0);engine.dispose();
});

function flightFixture({resume}={}){
  let created=0;
  const media=[],listeners=new Set(),context=mockContext();
  const gain=context.createGain;
  context.createGain=()=>{const node=gain();node.gain.cancelScheduledValues=()=>{};return node;};
  context.createBuffer=(_channels,size)=>({copyToChannel(){},getChannelData:()=>new Float32Array(size)});
  context.createMediaElementSource=()=>({connect(){},disconnect(){}});
  context.addEventListener=(_name,callback)=>listeners.add(callback);
  context.removeEventListener=(_name,callback)=>listeners.delete(callback);
  context.changeState=state=>{context.state=state;for(const callback of listeners)callback();};
  context.resume=resume?()=>resume(context):async()=>{context.changeState('running');};
  context.close=async()=>context.changeState('closed');
  const audio=new FlightAudio({contextFactory:()=>{created++;return context;},musicOptions:{mediaFactory:()=>{
    const item={src:'',currentTime:0,duration:210,paused:true,plays:0,
      play(){this.plays++;this.paused=false;return Promise.resolve();},pause(){this.paused=true;},
      removeAttribute(){this.src='';},load(){this.currentTime=0;}};
    media.push(item);return item;
  }}});
  return {audio,context,media,get created(){return created;}};
}

test('flight activation starts cached score in the gesture and preserves explicit mute',async()=>{
  const f=flightFixture(),{audio,context,media}=f;
  audio.update({shipId:'atlas',altitude:5000000,throttle:1});
  audio.setSuspended(false);assert.equal(f.created,0);assert.equal(media.length,0);
  const unlocked=audio.unlock();
  assert.equal(media.reduce((n,item)=>n+item.plays,0),1,'play is called synchronously before awaiting context resume');
  assert.equal(media[0].src.endsWith('between-worlds-1.mp3'),true,'the first gesture uses the latest navigation scene');
  assert.equal(await unlocked,true);assert.equal(audio.state.unlocked,true);assert.equal(audio.state.audible,true);
  assert.equal(audio.engineAudio.state.shipId,'atlas');assert.equal(audio.engineAudio.state.load,1);
  await audio.unlock();assert.equal(f.created,1);assert.equal(media.reduce((n,item)=>n+item.plays,0),1);
  assert.equal(await audio.toggle(),false);assert.equal(audio.state.userMuted,true);
  await audio.unlock();audio.setSuspended(true);audio.setSuspended(false);
  context.changeState('interrupted');context.changeState('running');
  audio.update({shipId:'kestrel',throttle:1});
  assert.equal(audio.enabled,false);assert.equal(audio.master.gain.value,0);assert.ok(media.every(item=>item.paused));
  assert.equal(audio.engineAudio.state.active,false);
  assert.equal(await audio.toggle(),true);assert.equal(audio.engineAudio.state.shipId,'kestrel');
  audio.dispose();
});

test('pause and browser interruption silence every bus and retain the selected soundtrack',async()=>{
  const {audio,context,media}=flightFixture();
  await audio.unlock({shipId:'nomad',mode:'flight',throttle:1,airless:true});
  audio.gameplay.play('rock');audio.gameplay.setMining(true,true,.5);
  audio.music.active.media.currentTime=35;
  const file=audio.music.state.file;
  audio.setSuspended(true);
  assert.equal(audio.master.gain.value,0);assert.equal(audio.engineAudio.state.active,false);
  assert.equal(audio.gameplay.state.voices,0);assert.equal(audio.gameplay.state.mining,false);
  assert.equal(audio.flyby.enabled,false);assert.ok(media.every(item=>item.paused));
  audio.update({shipId:'atlas',mode:'walk',insideShip:true,throttle:0,airless:true});
  context.currentTime=30;audio.setSuspended(false);await Promise.resolve();
  assert.equal(audio.music.state.file,file);assert.equal(audio.music.state.time,35);
  audio.update(audio.lastState);assert.equal(audio.engineAudio.state.shipId,'atlas');assert.equal(audio.engineAudio.state.cabin,true);
  context.changeState('interrupted');
  assert.equal(audio.state.audible,false);assert.equal(audio.music.state.enabled,false);
  assert.equal(audio.master.gain.value,0);assert.equal(audio.engineAudio.state.active,false);
  await audio.unlock();assert.equal(audio.state.contextState,'running');assert.equal(audio.state.audible,true);
  assert.equal(audio.music.state.file,file);audio.dispose();
});

test('a delayed context resume cannot restore a mute or disposed mixer',async()=>{
  let finish;
  const {audio,context,media}=flightFixture({resume:c=>new Promise(done=>{finish=()=>{c.changeState('running');done();};})});
  context.state='suspended';
  const unlocking=audio.unlock({shipId:'atlas',throttle:1});
  assert.equal(audio.state.audible,false);await audio.toggle();
  finish();assert.equal(await unlocking,false);assert.equal(audio.enabled,false);
  assert.equal(audio.master.gain.value,0);assert.ok(media.every(item=>item.paused));
  audio.dispose();assert.equal(await audio.unlock(),false);assert.equal(audio.state.audible,false);
});

test('a fresh gesture retries a browser-blocked resume without reviving a later mute or disposal',async t=>{
  for(const ending of ['mute','dispose']){
    let finishFirst,resumes=0;
    const f=flightFixture({resume:c=>{
      resumes++;
      if(resumes===1)return new Promise(done=>{finishFirst=done;});
      c.changeState('running');return Promise.resolve();
    }}),{audio,context,media}=f;
    t.after(()=>audio.dispose());context.state='suspended';
    const first=audio.unlock({shipId:'nomad',throttle:1});
    assert.equal(resumes,1);assert.equal(audio.enabled,true);assert.equal(audio.state.audible,false);
    for(let i=0;i<10;i++){audio.setSuspended(false);audio.update(audio.lastState);}
    assert.equal(resumes,1,'render/focus checks never retry a pending gesture request');
    const accepted=audio.unlock({shipId:'nomad',throttle:.5});
    assert.equal(resumes,2,'a later trusted input must invoke resume again before awaiting');
    assert.equal(await accepted,true);assert.equal(f.created,1);assert.equal(audio.state.audible,true);
    assert.equal(audio.engineAudio.state.load,.5);
    if(ending==='mute')await audio.toggle();else audio.dispose();
    finishFirst();assert.equal(await first,false);
    assert.equal(audio.enabled,false);assert.equal(audio.state.audible,false);
    assert.equal(audio.master.gain.value,0);assert.ok(media.every(item=>item.paused));
    audio.dispose();
  }
});

test('legacy station hum remains silent during powered cruise drift and power loss',async()=>{
  const {audio}=flightFixture();
  await audio.unlock({shipId:'kestrel',speed:40000,throttle:0,boost:true,airless:true});
  assert.equal(audio.hum.gain.value,0);assert.equal(audio.overtoneGain.gain.value,0);
  assert.equal(audio.engineAudio.state.load,0);assert.equal(audio.engineAudio.state.boost,false);
  audio.update({speed:40000,powered:false,throttle:1,boost:true,airless:true});
  assert.equal(audio.engineAudio.state.tone,0);assert.equal(audio.wind.gain.value,0);
  audio.update({mode:'walk',inHangar:true,doorMotion:1});
  assert.ok(audio.hum.gain.value>0,'station machinery retains its separate sound');audio.dispose();
});


test('flyby approaches high, recedes low, pans with the camera and fades with distance',async()=>{
  const {flybyMix}=await import('../src/audio/flyby.js');
  const velocity=new THREE.Vector3(180,0,0),mix=(x,z=-25,q)=>flybyMix(new THREE.Vector3(x,0,z),velocity,q);
  assert.ok(mix(-100).doppler>1&&mix(100).doppler<1);
  assert.ok(mix(-100).pan<0&&mix(100).pan>0);
  assert.ok(mix(0).gain>mix(0,-160).gain);
  assert.ok(mix(-100,-25,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI)).pan>0);
  assert.equal(mix(500),null);
  assert.equal(flybyMix(new THREE.Vector3(20,0,0),new THREE.Vector3()),null);
});
test('flyby rejects first samples, co-moving ships, warps and gaps; limits and clears audio voices',async()=>{
  const {FlybyTracker,FlybyAudio}=await import('../src/audio/flyby.js');
  const tracker=new FlybyTracker(),q=new THREE.Quaternion(),listener=new THREE.Vector3();
  const ships=x=>Array.from({length:9},(_,id)=>({id,position:new THREE.Vector3(x,0,-25-id)}));
  assert.equal(tracker.update(ships(-100),listener,q,.1).length,0);
  assert.equal(tracker.update(ships(-82),listener,q,.1).length,4);
  assert.equal(tracker.update(ships(-64),new THREE.Vector3(18,0,0),q,.1).length,0,'co-moving listener');
  assert.equal(tracker.update(ships(10000),listener,q,.1).length,0);
  assert.equal(tracker.update(ships(-100),listener,q,2).length,0);
  assert.equal(tracker.update(ships(-82),listener,q,.1).length,0);
  const c=mockContext(),audio=new FlybyAudio(c,{},c.createBufferSource());
  audio.update(ships(-100),listener,q,.1);assert.equal(audio.voices.length,0);
  audio.setEnabled(true);audio.update(ships(-100),listener,q,.1);audio.update(ships(-82),listener,q,.1);
  assert.equal(audio.state.voices,4);assert.equal(audio.voices.length,4);
  assert.ok(audio.voices.every(v=>v.noiseGain.gain.value>0));
  audio.update([],listener,q,.1);assert.equal(audio.state.voices,0);assert.ok(audio.voices.every(v=>v.noiseGain.gain.value===0));
  audio.update(ships(-100),listener,q,.1);audio.update(ships(-82),listener,q,.1);
  audio.setEnabled(false);assert.equal(audio.tracker.previous.size,0);assert.ok(audio.voices.every(v=>v.toneGain.gain.value===0));
  audio.setEnabled(true);audio.update(ships(-64),listener,q,.1);assert.equal(audio.state.voices,0);
  audio.update(ships(-46),listener,q,.1,{active:false});assert.equal(audio.tracker.previous.size,0);
  audio.dispose();assert.equal(audio.voices.length,0);
});

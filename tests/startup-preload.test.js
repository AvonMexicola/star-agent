import test from 'node:test';
import assert from 'node:assert/strict';
import { StartupPreload } from '../src/startup-preload.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const frame={terrainReady:true,settled:true,dt:1/30};

test('startup waits for assets, settled geometry, GPU compilation and real warm frames',async()=>{
  let assetReady,compiled,compiles=0;
  const startup=new StartupPreload([{label:'Ship',promise:new Promise(resolve=>assetReady=resolve)}],()=>{
    compiles++;return new Promise(resolve=>compiled=resolve);
  });
  startup.update(frame);assert.equal(startup.phase,'assets');assert.equal(compiles,0);
  assetReady();await tick();
  startup.update({...frame,settled:false});assert.equal(startup.phase,'terrain');
  for(let i=0;i<3;i++)startup.update(frame);
  await tick();assert.equal(compiles,1);assert.equal(startup.phase,'shaders');
  for(let i=0;i<100;i++)startup.update(frame);
  assert.equal(startup.ready,false,'rendering while shader compilation is pending cannot unlock controls');
  compiled();await tick();
  for(let i=0;i<65;i++)startup.update({...frame,resizing:true});
  assert.equal(startup.ready,false,'a new render resolution must render before handover');
  startup.update(frame);assert.equal(startup.ready,true);
  assert.equal(startup.state.completed,startup.state.total);assert.equal(compiles,1);
});

test('optional asset fallback completes but graphics failure cannot report ready',async()=>{
  const startup=new StartupPreload([{label:'Optional finish',promise:Promise.reject(new Error('offline'))}],()=>Promise.reject(new Error('GPU unavailable')));
  await tick();assert.deepEqual(startup.state.fallbackTasks,['Optional finish']);
  for(let i=0;i<3;i++)startup.update(frame);
  await tick();assert.match(startup.error,/GPU unavailable/);assert.equal(startup.ready,false);
});

test('a frame stall and terrain churn cannot masquerade as a completed warmup',async()=>{
  const startup=new StartupPreload([],()=>Promise.resolve());
  startup.update(frame);startup.update({...frame,settled:false});startup.update(frame);startup.update(frame);
  assert.equal(startup.phase,'terrain');startup.update(frame);await tick();
  startup.update({...frame,dt:60});assert.equal(startup.ready,false);
  for(let i=0;i<20;i++)startup.update({...frame,dt:.25,settled:false});
  assert.equal(startup.ready,false);startup.update(frame);assert.equal(startup.ready,true);
});

test('orbital generation failure releases startup with the available procedural fallback',async t=>{
  const {OrbitalSurface}=await import('../src/orbital-surface.js');
  const previous=globalThis.Worker,originalWarn=console.warn;
  globalThis.Worker=class {postMessage(){} terminate(){this.terminated=true;}};
  console.warn=()=>{};
  t.after(()=>{if(previous===undefined)delete globalThis.Worker;else globalThis.Worker=previous;console.warn=originalWarn;});
  for(const failure of ['message','event']){
    const surface=new OrbitalSurface('aeon');surface.start();
    let released=false;surface.readyPromise.then(()=>released=true);
    if(failure==='message')surface.worker.onmessage({data:{error:'generation failed'}});
    else surface.worker.onerror({message:'worker failed'});
    await tick();assert.equal(released,true);assert.equal(surface.complete,true);
    assert.equal(surface.worker.terminated,true);assert.equal(surface.resolution,0);
    assert.ok(surface.error);surface.dispose();
  }
});

test('disposing a pending orbital preload releases waiters without starting new work',async()=>{
  const {OrbitalSurface}=await import('../src/orbital-surface.js');
  const surface=new OrbitalSurface('aeon');let released=false;
  surface.readyPromise.then(()=>released=true);surface.dispose();await tick();surface.start();
  assert.equal(released,true);assert.equal(surface.started,false);
});

test('keys held through loading cannot leak repeats into play and release removes the gate',async()=>{
  const {blockStartupInput}=await import('../src/startup-preload.js');
  const target=new EventTarget();let ready=false,inputs=0;
  const release=blockStartupInput(target,()=>ready);
  target.addEventListener('keydown',()=>inputs++);
  const key=(type,code)=>{const event=new Event(type,{cancelable:true});event.code=code;target.dispatchEvent(event);};
  key('keydown','KeyW');assert.equal(inputs,0);
  ready=true;release();key('keydown','KeyW');assert.equal(inputs,0,'held repeat remains suppressed');
  key('keydown','KeyP');assert.equal(inputs,1,'a fresh key works once ready');
  key('keyup','KeyW');key('keydown','KeyW');assert.equal(inputs,2);
});

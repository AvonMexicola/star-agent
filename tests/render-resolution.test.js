import test from 'node:test';
import assert from 'node:assert/strict';
import { RenderResolution, fullscreenViewport } from '../src/render-resolution.js';
const viewport={width:1280,height:720,dpr:2,fullscreen:false};
const samples=(r,fps,n)=>{for(let i=0;i<n;i++)r.sample(fps);};

test('fullscreen recognizes API and borderless F11 but not maximized browser chrome',()=>{
  assert.equal(fullscreenViewport({element:{}}),true);
  const full={width:1920,height:1080,outerWidth:1920,outerHeight:1080,screenWidth:1920,screenHeight:1080};
  assert.equal(fullscreenViewport(full),true);
  assert.equal(fullscreenViewport({...full,height:967}),false);
  assert.equal(fullscreenViewport({...full,width:1280,outerWidth:1280}),false);
  assert.equal(fullscreenViewport({}),false);
});

test('automatic fullscreen discards a stale low scale and raises drawing-buffer density',()=>{
  const r=new RenderResolution();r.viewport(viewport);samples(r,15,30);
  assert.equal(r.scale,.55);assert.equal(r.pixelRatio,1.25);
  r.viewport({...viewport,fullscreen:true});assert.equal(r.scale,1);assert.equal(r.pixelRatio,2);
  assert.deepEqual([r.state.width,r.state.height],[2560,1440]);
  samples(r,15,30);assert.equal(r.scale,.8,'fullscreen preserves a sharper minimum');
  r.viewport(viewport);assert.equal(r.pixelRatio,1.25);assert.equal(r.scale,1);
});

test('explicit percentages survive fullscreen, viewport changes and poor frame rate',()=>{
  for(const preference of [.6,.8,1]){
    const r=new RenderResolution();r.configure(preference);r.viewport(viewport);
    samples(r,10,20);r.viewport({...viewport,width:1920,height:1080,fullscreen:true});samples(r,60,20);
    assert.equal(r.scale,preference);assert.equal(r.automatic,false);
    r.viewport(viewport);assert.equal(r.scale,preference);
  }
});

test('automatic quality recovers slowly and does not count paused menus as spare performance',()=>{
  const r=new RenderResolution();r.viewport(viewport);samples(r,15,30);const low=r.scale;
  for(let i=0;i<20;i++)r.sample(120,false);
  assert.equal(r.scale,low);
  samples(r,55,2);assert.equal(r.scale,low,'two good samples cannot jump quality');
  samples(r,55,30);assert.equal(r.scale,1);
  samples(r,35,20);assert.equal(r.scale,1,'ordinary frame rate does not oscillate quality');
});

test('viewport growth restores automatic quality but ordinary jitter does not',()=>{
  const r=new RenderResolution();r.viewport(viewport);samples(r,15,30);
  r.viewport({...viewport,width:1281});assert.equal(r.scale,.55);
  r.viewport({...viewport,width:1600,height:900});assert.equal(r.scale,1);
  r.viewport({...viewport,dpr:3,fullscreen:true});assert.equal(r.pixelRatio,2);
  r.configure(.6);r.configure('auto');assert.equal(r.scale,1);
});


test('gradual window enlargement accumulates toward the quality reset threshold',()=>{
  const r=new RenderResolution();r.viewport({width:1000,height:700,dpr:1});samples(r,15,30);
  assert.equal(r.scale,.55);
  for(let width=1010;width<=1600;width+=10)r.viewport({width,height:700,dpr:1});
  assert.equal(r.scale,1);
});

test('menu frames cannot become a recovery sample on the first resumed frame',()=>{
  const r=new RenderResolution();r.viewport(viewport);samples(r,15,30);const low=r.scale;
  for(let interval=0;interval<10;interval++){
    for(let i=0;i<120;i++)r.frame(1/60,false);
    r.frame(1/60,true);
  }
  assert.equal(r.scale,low);
  for(let i=0;i<400;i++)r.frame(1/60,true);
  assert.ok(r.scale>low,'only uninterrupted gameplay can establish recovery');
});

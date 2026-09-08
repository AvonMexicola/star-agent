import test from 'node:test';
import assert from 'node:assert/strict';
import {roverReadout} from '../src/rover-display.js';
import {createRoverPower} from '../src/rover-power.js';
import {MiningStore} from '../src/mining/store.js';
import {MATERIAL_IDS,emptyItems} from '../src/inventory/containers.js';

const state=extra=>({speed:0,charge:1,cutSeconds:0,beaming:0,mass:0,occupied:true,busy:false,aboard:false,blocked:false,...extra});

test('the cutting reserve follows remaining energy, not cumulative cutter use',()=>{
  const power=createRoverPower();
  assert.equal(roverReadout(state(power.state)).seconds,120);
  for(let i=0;i<40;i++)power.step(.25,{trigger:true});
  assert.equal(power.state.cutSeconds,10);
  assert.equal(roverReadout(state(power.state)).seconds,110);
  for(let i=0;i<440;i++)power.step(.25,{trigger:true});
  assert.equal(roverReadout(state(power.state)).seconds,0);
  for(let i=0;i<120;i++)power.step(.25);
  assert.equal(roverReadout(state(power.state)).seconds,120);
});

test('the ore panel reads actual mineral stock and its canonical two-box capacity',()=>{
  const data=new Map(),store=new MiningStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)});
  const id='meridian-rover-bin';
  assert.equal(store.registerContainer({id,name:'Rover mineral bin',kind:'ship',boxes:2}),true);
  const read=()=>roverReadout(state({mass:MATERIAL_IDS.reduce((total,key)=>total+(store.container(id).items[key]??0),0)}));
  assert.equal(read().capacity,store.freeFor(id));
  assert.equal(store.write(store.withItems(store.state,id,{...emptyItems(),basalt:6.25,ice:2.5})),true);
  assert.equal(read().mass,'8.75');assert.equal(read().capacity,96);assert.equal(read().binFull,false);
  assert.equal(store.write(store.withItems(store.state,id,{...emptyItems(),basalt:96})),true);
  assert.equal(read().binFull,true);assert.equal(read().fill,1);
});

test('reverse motion and cabin/boarding state remain explicit while control pads go neutral',()=>{
  const controls={throttle:-1,steer:1,brake:0};
  const reverse=roverReadout(state({speed:-3.2,controls}));
  assert.equal(reverse.direction,'Reverse');assert.equal(reverse.speed,'3.2');assert.deepEqual(reverse.controls,controls);
  const moving=roverReadout(state({busy:true,controls}));
  assert.equal(moving.mode,'Cabin moving');assert.deepEqual(moving.controls,{});
  assert.equal(roverReadout(state({aboard:true})).mode,'Carrier deck');
  assert.deepEqual(roverReadout(state({occupied:false,controls})).controls,{});
});

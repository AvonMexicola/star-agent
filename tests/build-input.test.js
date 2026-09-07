import test from 'node:test';
import assert from 'node:assert/strict';
import { GamepadInput } from '../src/gamepad.js';
import { routeBuildInput } from '../src/build/input.js';

function fixture() {
  const pad={id:'Builder',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
  const input=new GamepadInput(()=>pad.connected?[pad]:[]),calls=[];
  const actions=Object.fromEntries(['place','cancel','palette','rotate','cycleSnap','adjustHeight'].map(id=>[id,(...args)=>calls.push([id,...args])]));
  const press=(id,value)=>pad.buttons[id]={pressed:Boolean(value),value:Number(value)};
  const poll=options=>{const frame=input.poll(options);if(!options?.ui)routeBuildInput(frame,actions);return frame;};
  poll();return {pad,input,calls,press,poll};
}
test('build consumes weapon/interact shortcuts while keeping walking, aim and jump',()=>{
  const f=fixture();f.pad.axes=[.6,-.7,.8,-.9];for(const id of [0,2,3,7,12,14,15])f.press(id,true);
  const frame=f.poll();assert.ok(frame.strafe&&frame.forward&&frame.yaw&&frame.pitch);assert.equal(frame.jump,true);
  assert.equal(frame.mine,0);assert.deepEqual([...frame.pressed],[0]);assert.deepEqual(f.calls,[['palette']]);
});
test('placement is one edge and never replays across modal, focus or disconnect',()=>{
  const f=fixture();f.press(7,true);f.poll();f.poll();assert.deepEqual(f.calls,[['place']]);
  f.poll({ui:true});f.poll({ui:false});f.poll();assert.equal(f.calls.length,1);
  f.press(7,false);f.poll();f.press(7,true);f.poll();assert.equal(f.calls.length,2);
  f.poll({focused:false});f.poll();assert.equal(f.calls.length,2);
  f.pad.connected=false;f.poll();f.pad.connected=true;f.poll();assert.equal(f.calls.length,2);
  f.press(7,false);f.poll();f.press(7,true);f.poll();assert.equal(f.calls.length,3);
});
test('cancel wins over simultaneous placement and height/rotation/snap use discrete steps',()=>{
  const f=fixture();for(const id of [4,6,12])f.press(id,true);f.poll();f.poll();assert.deepEqual(f.calls,[['rotate',-1],['cycleSnap'],['adjustHeight',.25]]);
  f.press(1,true);f.press(7,true);f.poll();assert.deepEqual(f.calls.at(-1),['cancel']);assert.equal(f.calls.length,4);
});

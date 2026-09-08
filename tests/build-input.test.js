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
test('A places once without jumping or firing; stick movement and look survive',()=>{
  const f=fixture();f.pad.axes=[.6,-.7,.8,-.9];f.press(0,true);const frame=f.poll();f.poll();
  assert.deepEqual(f.calls,[['place']]);assert.equal(frame.jump,false);assert.equal(frame.mine,0);assert.equal(frame.pressed.has(0),false);assert.ok(frame.strafe&&frame.forward&&frame.yaw&&frame.pitch);
});
test('placement never replays across modal, focus or disconnect while A is held',()=>{
  const f=fixture();f.press(0,true);f.poll();f.poll({ui:true});f.poll({ui:false});f.poll();assert.equal(f.calls.length,1);
  f.press(0,false);f.poll();f.press(0,true);f.poll();assert.equal(f.calls.length,2);
  f.poll({focused:false});f.poll();assert.equal(f.calls.length,2);
  f.pad.connected=false;f.poll();f.pad.connected=true;f.poll();assert.equal(f.calls.length,2);
  f.press(0,false);f.poll();f.press(0,true);f.poll();assert.equal(f.calls.length,3);
});
test('B opens wheel, X exits with precedence over placement, and neither leaks into navigation',()=>{
  const f=fixture();f.press(1,true);f.press(0,true);let frame=f.poll();assert.deepEqual(f.calls,[['palette']]);assert.equal(frame.brake,false);assert.equal(frame.jump,false);
  f.press(2,true);frame=f.poll();assert.deepEqual(f.calls.at(-1),['cancel']);assert.equal(frame.pressed.has(2),false);
});
test('triggers rotate on edges, LB snaps, RB jumps and D-pad adjusts height',()=>{
  const f=fixture();f.press(6,true);let frame=f.poll();f.poll();assert.deepEqual(f.calls,[['rotate',-1]]);assert.equal(frame.evaBrake,false);
  f.press(6,false);f.poll();f.press(7,true);frame=f.poll();f.poll();assert.deepEqual(f.calls.at(-1),['rotate',1]);assert.equal(frame.mine,0);assert.equal(frame.vertical,0);
  f.press(7,false);f.press(4,true);f.press(12,true);frame=f.poll();assert.deepEqual(f.calls.slice(-2),[['cycleSnap'],['adjustHeight',.25]]);assert.equal(frame.fire,0);
  f.press(4,false);f.press(12,false);f.poll();f.press(5,true);frame=f.poll();assert.equal(frame.jump,true);assert.equal(frame.roll,0);assert.equal(f.poll().jump,false);
  const opposing=fixture();opposing.press(6,true);opposing.press(7,true);opposing.poll();assert.deepEqual(opposing.calls,[]);
});

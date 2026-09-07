import test from 'node:test';
import assert from 'node:assert/strict';
import {BUILD_WHEEL_ORDER,radialSelection} from '../src/build/radial-selection.js';
import {GamepadInput} from '../src/gamepad.js';
test('eight stick directions map clockwise to the visible pieces',()=>{
 assert.equal(new Set(BUILD_WHEEL_ORDER).size,8);
 for(let i=0;i<8;i++){const a=i*Math.PI/4;assert.equal(radialSelection(Math.sin(a),-Math.cos(a)),i);}
 for(const [x,y]of [[0,0],[.2,.2],[NaN,1],[1,Infinity]])assert.equal(radialSelection(x,y,4),null);
});
test('boundary hysteresis prevents jitter but deliberate movement changes slices',()=>{
 const at=a=>[Math.sin(a),-Math.cos(a)];
 assert.equal(radialSelection(...at(Math.PI/8+.04),0),0);
 assert.equal(radialSelection(...at(Math.PI/8+.12),0),1);
 assert.equal(radialSelection(...at(-Math.PI/8-.04),0),0);
 assert.equal(radialSelection(...at(-Math.PI/8-.12),0),7);
});
test('modal analog vector is separate from D-pad and gated on focus and device recovery',()=>{
 const pad={id:'Radial pad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
 const input=new GamepadInput(()=>[pad]),poll=()=>input.poll({ui:true,enabled:false});poll();
 pad.buttons[13]={pressed:true,value:1};let p=poll();assert.equal(p.ui.y,1);assert.equal(p.ui.stickY,0);assert.equal(p.forward,0);
 pad.buttons[13]={pressed:false,value:0};pad.axes=[.7,-.7,0,0];p=poll();assert.equal(radialSelection(p.ui.stickX,p.ui.stickY),1);
 input.poll({ui:true,focused:false});assert.equal(poll().ui,null);pad.axes.fill(0);poll();pad.axes[0]=1;assert.equal(poll().ui.stickX,1);
 pad.connected=false;poll();pad.connected=true;assert.equal(poll().ui,null);pad.axes.fill(0);poll();pad.id='Replacement';pad.buttons[0]={pressed:true,value:1};assert.equal(poll().ui,null);
 pad.buttons[0]={pressed:false,value:0};assert.ok(poll().ui);pad.mapping='';assert.equal(poll().ui,null);
});

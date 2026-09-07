import test from 'node:test';
import assert from 'node:assert/strict';
import { GamepadInput, stick } from '../src/gamepad.js';

export function controller(index = 0) {
  return { id: `Test controller ${index}`, index, connected: true, mapping: 'standard',
    axes: [0, 0, 0, 0], buttons: Array.from({length: 17}, () => ({pressed: false, value: 0})) };
}
const button = (pad, index, down) => { pad.buttons[index] = {pressed: down, value: Number(down)}; };

test('radial deadzone removes drift, rescales analog travel and bounds diagonals', () => {
  assert.deepEqual(stick(.1, -.1), [0, 0]);
  assert.deepEqual(stick(NaN, undefined), [0, 0]);
  assert.ok(Math.abs(stick(.58, 0)[0] - .5) < 1e-9);
  assert.ok(Math.abs(Math.hypot(...stick(1, 1)) - 1) < 1e-9);
  assert.deepEqual(stick(0, -1), [0, -1]);
});

test('standard axes, analog triggers and action edges remain independent', () => {
  const pad = controller(), input = new GamepadInput(() => [null, pad]);
  input.poll();
  pad.axes = [.58, -1, 1, -1];
  pad.buttons[7].value = .525;
  button(pad, 2, true); button(pad, 4, true); button(pad, 10, true);
  const state = input.poll();
  assert.ok(state.forward > 0 && state.strafe > 0 && state.pitch > 0 && state.yaw < 0);
  assert.ok(Math.abs(state.fire - .5) < 1e-9);
  assert.equal(state.vertical, 0, 'RT firing cannot create vertical thrust');
  assert.equal(state.roll, -1); assert.equal(state.boost, true);
  assert.equal(state.pressed.has(2), true);
  assert.equal(input.poll().pressed.size, 0, 'held actions do not repeat');
  button(pad, 2, false); input.poll(); button(pad, 2, true);
  assert.equal(input.poll().pressed.has(2), true);
});

test('connect, disconnect, device replacement and focus require neutral controls', () => {
  let pads = [controller(2)]; const input = new GamepadInput(() => pads);
  pads[0].axes[1] = -1;
  assert.equal(input.poll().forward, 0);
  pads[0].axes[1] = 0; input.poll(); pads[0].axes[1] = -1;
  assert.equal(input.poll().forward, 1);
  assert.equal(input.poll({focused: false}).forward, 0);
  assert.equal(input.poll().forward, 0);
  pads[0].axes[1] = 0; input.poll(); pads[0].axes[1] = -1;
  assert.equal(input.poll().forward, 1);
  pads = []; assert.equal(input.poll().forward, 0); assert.equal(input.connected, false);
  pads = [controller(2)]; button(pads[0], 3, true);
  assert.equal(input.poll().pressed.has(3), false);
  button(pads[0], 3, false); input.poll();
  pads[0].id = 'replacement'; button(pads[0], 3, true);
  assert.equal(input.poll().pressed.has(3), false);
});

test('modal blocks gameplay and stale edges but allows help toggle and scrolling', () => {
  const pad = controller(), input = new GamepadInput(() => [pad]); input.poll();
  pad.axes[1] = -1; pad.axes[3] = 1; button(pad, 3, true); button(pad, 9, true);
  const paused = input.poll({enabled: false});
  assert.equal(paused.forward, 0); assert.equal(paused.scroll, 1);
  assert.deepEqual([...paused.pressed], [9]);
  assert.equal(input.poll().pressed.size, 0);
  assert.equal(input.poll().forward, 0);
  pad.axes.fill(0); button(pad, 3, false); button(pad, 9, false); input.poll();
  button(pad, 3, true); assert.equal(input.poll().pressed.has(3), true);
});

test('unsupported mappings and unavailable or denied APIs leave keyboard play available', () => {
  const pad = controller(); pad.mapping = '';
  const input = new GamepadInput(() => [pad]);
  assert.equal(input.poll().used, false); assert.match(input.status, /unsupported/);
  assert.equal(new GamepadInput(() => {throw new Error('SecurityError');}).poll().used, false);
  assert.equal(new GamepadInput(() => undefined).poll().used, false);
});

test('additional controllers do not steal an active device; disconnect selects a neutral replacement', () => {
  const first = controller(1), second = controller(0); let pads = [null, first];
  const input = new GamepadInput(() => pads); input.poll();
  first.axes[1] = -1; pads = [second, first];
  assert.equal(input.poll().forward, 1); assert.equal(input.index, 1);
  first.connected = false; button(second, 3, true);
  assert.equal(input.poll().pressed.has(3), false); assert.equal(input.index, 0);
});

test('paused menu has separate confirm, back and focus edges without leaking flight actions', () => {
  const pad = controller(), input = new GamepadInput(() => [pad]); input.poll();
  button(pad, 0, true); button(pad, 13, true); pad.axes[1] = -1;
  const menu = input.poll({enabled: false});
  assert.deepEqual([...menu.menuPressed], [0, 13]);
  assert.equal(menu.pressed.size, 0); assert.equal(menu.jump, false);
  assert.equal(menu.forward, 0); assert.equal(menu.scroll, 0);
  assert.equal(input.poll({enabled: false}).menuPressed.size, 0);
  assert.equal(input.poll({enabled: true}).forward, 0, 'held menu input cannot resume flight');
  pad.axes.fill(0); button(pad, 0, false); button(pad, 13, false); input.poll();
  pad.axes[1] = -1; assert.equal(input.poll().forward, 1);
});

test('dialogs receive controller UI actions while flight, mining and EVA remain neutral', () => {
  const pad = controller(), input = new GamepadInput(() => [pad]); input.poll();
  button(pad, 9, true); input.poll();
  assert.equal(input.poll({enabled: false, ui: true}).ui, null, 'opening hold must release first');
  button(pad, 9, false); input.poll({enabled: false, ui: true});
  button(pad, 0, true); button(pad, 7, true); pad.axes[1] = 1;
  const state = input.poll({enabled: false, ui: true});
  assert.equal(state.ui.pressed.has(0), true); assert.equal(state.ui.y, 1);
  assert.equal(state.mine, 0); assert.equal(state.forward, 0); assert.equal(state.evaVertical, 0);
  assert.equal(input.poll().mine, 0, 'closing a dialog with RT held cannot fire');
  pad.axes.fill(0); button(pad, 0, false); button(pad, 7, false); input.poll();
  button(pad, 7, true); assert.equal(input.poll().mine, 1);
});

test('EVA vertical thrust and brake leave RT available for mining', () => {
  const pad = controller(), input = new GamepadInput(() => [pad]); input.poll();
  button(pad, 0, true); button(pad, 6, true); button(pad, 7, true);
  const state = input.poll(); assert.equal(state.evaVertical, 1); assert.equal(state.evaBrake, true); assert.equal(state.mine, 1);
  button(pad, 0, false); button(pad, 1, true); assert.equal(input.poll().evaVertical, -1);
});

test('map input requires neutral, stays separate from flight, and disarms after close', () => {
  const pad = controller(), input = new GamepadInput(() => [pad]); input.poll();
  button(pad, 0, true); input.suspend();
  assert.equal(input.poll({enabled: false, ui: true}).ui, null, 'held confirm cannot select on entry');
  button(pad, 0, false); input.poll({enabled: false, ui: true});
  button(pad, 0, true); pad.axes[1] = -1;
  const menu = input.poll({enabled: false, ui: true});
  assert.deepEqual([...menu.ui.pressed], [0]); assert.equal(menu.ui.y, -1);
  assert.equal(menu.forward, 0); assert.equal(menu.jump, false); assert.equal(menu.pressed.size, 0);
  assert.equal(input.poll({enabled: false, ui: true}).ui.pressed.size, 0);
  assert.equal(input.poll().forward, 0, 'held menu navigation cannot thrust after close');
  button(pad, 0, false); pad.axes.fill(0); input.poll();
  pad.axes[1] = -1; assert.equal(input.poll().forward, 1);
  assert.equal(input.poll({enabled: false, ui: true, focused: false}).ui, null);
  assert.equal(input.poll({enabled: false, ui: true}).ui, null, 'focus regain requires neutral');
});


test('utility chords are one-shot and do not leak D-pad, menu or shoulder actions', () => {
  for(const [index,action] of [[12,'free-drive'],[13,'gear'],[14,'lights'],[15,'camera-view'],[9,'graphics']]){
    const pad=controller(),input=new GamepadInput(()=>[pad]);input.poll();
    button(pad,4,true);button(pad,5,true);input.poll();button(pad,index,true);
    const result=input.poll();assert.deepEqual([...result.shortcuts],[action]);
    assert.equal(result.pressed.has(index),false);assert.equal(result.roll,0);assert.equal(result.speed,0);
    assert.equal(input.poll().shortcuts.size,0,'holding a toggle must not repeat');
    button(pad,4,false);assert.equal(input.poll().roll,0,'first shoulder release must not roll');
    button(pad,5,false);const held=input.poll();assert.equal(held.speed,0);assert.equal(held.pressed.has(index),false);
    button(pad,index,false);input.poll();button(pad,index,true);
    assert.equal(input.poll().pressed.has(index),true,'plain action returns after button release');
  }
});

test('utility shortcuts cannot replay across modal, focus, suspend or device changes', () => {
  for(const interruption of ['modal','focus','suspend','disconnect','replacement']){
    let pads=[controller()];const pad=pads[0],input=new GamepadInput(()=>pads);input.poll();
    button(pad,4,true);button(pad,5,true);button(pad,14,true);
    assert.deepEqual([...input.poll().shortcuts],['lights']);
    if(interruption==='modal')input.poll({ui:true,enabled:false});
    if(interruption==='focus')input.poll({focused:false});
    if(interruption==='suspend')input.suspend();
    if(interruption==='disconnect'){pads=[];input.poll();pads=[pad];}
    if(interruption==='replacement')pad.id='Replacement device';
    assert.equal(input.poll().shortcuts.size,0,interruption);
    button(pad,14,false);input.poll();button(pad,14,true);
    assert.equal(input.poll().shortcuts.size,0,'releasing only the action does not rearm a held modifier');
    pad.buttons.forEach((_,i)=>button(pad,i,false));input.poll();
    button(pad,4,true);button(pad,5,true);button(pad,14,true);
    assert.deepEqual([...input.poll().shortcuts],['lights']);
  }
});

test('plain roll, map/equipment and throttle remain independent of utility shortcuts', () => {
  const pad=controller(),input=new GamepadInput(()=>[pad]);input.poll();
  button(pad,4,true);assert.equal(input.poll().roll,-1);button(pad,4,false);input.poll();
  button(pad,5,true);assert.equal(input.poll().roll,1);button(pad,5,false);input.poll();
  button(pad,12,true);assert.equal(input.poll().speed,1);button(pad,12,false);input.poll();
  button(pad,14,true);assert.equal(input.poll().pressed.has(14),true);
  button(pad,4,true);button(pad,5,true);
  assert.equal(input.poll().shortcuts.size,0,'a D-pad action held before the chord is not a new command');
});


test('unarmed Graphics chord cannot open the ordinary menu instead', () => {
  const pad=controller(),input=new GamepadInput(()=>[pad]);
  for(const i of [4,5,9])button(pad,i,true);
  const result=input.poll();assert.equal(result.shortcuts.size,0);assert.equal(result.pressed.has(9),false);
  for(const i of [4,5,9])button(pad,i,false);input.poll();
  button(pad,9,true);assert.equal(input.poll({enabled:false}).pressed.has(9),true,'plain Menu still works in paused help');
});


test('ship fire, vertical thrust and braking are independent with safe neutral arming', () => {
  for(const interruption of ['modal','focus','disconnect','replacement']){
    const pad=controller();let pads=[pad];const input=new GamepadInput(()=>pads);input.poll();
    button(pad,7,true);assert.equal(input.poll().fire,1);
    if(interruption==='modal')input.poll({ui:true,enabled:false});
    if(interruption==='focus')input.poll({focused:false});
    if(interruption==='disconnect'){pads=[];input.poll();pads=[pad];}
    if(interruption==='replacement')pad.id='replacement';
    assert.equal(input.poll().fire,0,interruption);
    button(pad,7,false);input.poll();button(pad,0,true);
    let state=input.poll();assert.equal(state.vertical,1);assert.equal(state.fire,0);
    button(pad,0,false);button(pad,1,true);state=input.poll();
    assert.equal(state.vertical,-1);assert.equal(state.brake,false);
    button(pad,1,false);button(pad,6,true);button(pad,7,true);state=input.poll();
    assert.equal(state.brake,true);assert.equal(state.fire,1);assert.equal(state.vertical,0);
  }
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Loadout,defaultLoadout} from '../src/inventory/loadout.js';
import {GamepadInput} from '../src/gamepad.js';
import {createPyrebearMedical} from '../src/fauna/pyrebear-medical.js';

function setup({health=100,navEnabled=true,enabled=()=>true,onRecover}={}){
  const store={state:{loadout:{...defaultLoadout(),health},pack:{ore:7},ship:{supplies:3},revision:7},writes:0,fail:false,
    warning:'Save failed. Storage unavailable.',validContainers:()=>true,
    write(next){this.writes++;if(this.fail)return false;this.state=structuredClone(next);this.disk=structuredClone(next);return true;}};
  const nav={enabled:navEnabled,keys:new Set(['KeyW']),toolTrigger:1,boost:true,position:'pyre',
    velocity:{set(...v){this.value=v;}},gamepad:{count:0,suspend(){this.count++;}},
    orbitCalls:0,orbit(){this.orbitCalls++;this.position='aeon-orbit';},takeControl:0,onTakeControl(){this.takeControl++;}};
  const loadout=new Loadout(store),medical=createPyrebearMedical({nav,loadout,enabled,onRecover});
  return {store,nav,loadout,medical};
}
function fakeDOM(t){
  const old=globalThis.document,nodes=[];
  class Element extends EventTarget{
    constructor(){super();this.open=false;this.textContent='';this.attrs={};}
    setAttribute(k,v){this.attrs[k]=v;}
    set innerHTML(v){this.html=v;this.button=new Element();this.status=new Element();}
    querySelector(s){return s==='[role="status"]'?this.status:this.button;}
    showModal(){this.open=true;}
    close(){if(!this.open)return;this.open=false;queueMicrotask(()=>this.dispatchEvent(new Event('close')));}
    focus(){doc.activeElement=this;}
    remove(){this.open=false;nodes.splice(nodes.indexOf(this),1);}
  }
  const doc={createElement:()=>new Element(),body:{append:n=>nodes.push(n)},querySelector:()=>nodes.find(n=>n.open)??null,
    pointerLockElement:{},exitPointerLock(){this.pointerLockElement=null;}};
  globalThis.document=doc;t.after(()=>{if(old===undefined)delete globalThis.document;else globalThis.document=old;});
  return {doc,nodes};
}

test('bites use the real Loadout transaction, persist bleeding and retain inventory',()=>{
  const {medical,store,loadout,nav}=setup();const original=structuredClone(store.state);
  assert.equal(medical.applyBite(27).ok,true);assert.equal(loadout.state.health,73);assert.equal(loadout.state.bleeding,true);
  assert.deepEqual(store.state,{...original,loadout:{...original.loadout,health:73,bleeding:true}});
  assert.equal(store.writes,1);assert.equal(nav.enabled,true);assert.equal(nav.orbitCalls,0);
  assert.equal(new Loadout({state:store.disk}).state.health,73);
});

test('invalid, online, disposed and already downed bites do not write',()=>{
  const {medical,store}=setup();for(const amount of [0,-1,NaN,Infinity,'12',null])assert.equal(medical.applyBite(amount).ok,false);
  assert.equal(store.writes,0);medical.dispose();assert.equal(medical.applyBite(10).ok,false);assert.equal(store.writes,0);
  const online=setup({health:0,enabled:()=>false});online.medical.update();
  assert.equal(online.medical.applyBite(10).ok,false);assert.equal(online.medical.recover().ok,false);
  assert.equal(online.store.writes,0);assert.equal(online.nav.enabled,true);
  const dead=setup({health:0});assert.equal(dead.medical.applyBite(10).ok,false);assert.equal(dead.store.writes,0);
});

test('failed bite persistence cannot change health, cargo or navigation',()=>{
  const {medical,store,nav}=setup();const before=structuredClone(store.state);store.fail=true;
  assert.deepEqual(medical.applyBite(200),{ok:false,message:store.warning});assert.deepEqual(store.state,before);
  assert.equal(nav.enabled,true);assert.equal(nav.position,'pyre');assert.equal(medical.state.locked,false);
});

test('loaded zero health opens accessible recovery and blocks cancel/direct controller close',async t=>{
  const {doc,nodes}=fakeDOM(t),{medical,nav,store}=setup({health:0});medical.update();
  const dialog=nodes[0];assert.equal(dialog.id,'pyrebear-medical-dialog');assert.equal(dialog.open,true);
  assert.match(dialog.html,/data-controller-focus data-controller-key="pyrebear-evacuate"/);
  assert.match(dialog.html,/Emergency evacuation to Aeon orbit · inventory retained/);
  assert.equal(doc.activeElement,dialog.button);assert.equal(nav.enabled,false);assert.equal(nav.keys.size,0);
  assert.equal(nav.toolTrigger,0);assert.deepEqual(nav.velocity.value,[0,0,0]);assert.equal(doc.pointerLockElement,null);
  const cancel=new Event('cancel',{cancelable:true});dialog.dispatchEvent(cancel);assert.equal(cancel.defaultPrevented,true);
  dialog.close();await Promise.resolve();assert.equal(dialog.open,true);assert.equal(nav.enabled,false);
  nav.enabled=true;medical.update();assert.equal(nav.enabled,false);assert.equal(nav.gamepad.count,1,'regular updates must not continuously disarm the modal controller');
  assert.equal(store.writes,0);medical.dispose();assert.equal(nav.enabled,false);assert.equal(nodes.length,0);
});

test('lethal bite freezes immediately; failed evacuation remains downed and retry saves before relocation',async t=>{
  const {nodes}=fakeDOM(t),{medical,store,nav,loadout}=setup();medical.applyBite(150);
  assert.equal(loadout.state.health,0);assert.equal(nav.enabled,false);assert.equal(nav.orbitCalls,0);
  const before=structuredClone(store.state);store.fail=true;
  assert.equal(medical.recover().ok,false);assert.deepEqual(store.state,before);assert.equal(nav.position,'pyre');
  assert.equal(nodes[0].open,true);assert.equal(nodes[0].status.textContent,store.warning);
  store.fail=false;nav.orbit=function(){assert.equal(store.disk.loadout.health,100);this.orbitCalls++;this.position='aeon-orbit';};
  nodes[0].button.dispatchEvent(new Event('click'));await Promise.resolve();
  assert.equal(loadout.state.health,100);assert.equal(loadout.state.bleeding,false);assert.equal(nav.position,'aeon-orbit');
  assert.equal(nav.enabled,true);assert.equal(nav.takeControl,1);assert.equal(nodes[0].open,false);
  assert.deepEqual(store.state,{...before,loadout:{...before.loadout,health:100,bleeding:false}});
  const writes=store.writes;assert.equal(medical.recover().ok,false);assert.equal(store.writes,writes);medical.dispose();
});

test('recovery respects pre-existing pause and optional relocation callback',()=>{
  let called=0;const {medical,nav}=setup({health:0,navEnabled:false,onRecover:()=>called++});
  assert.equal(medical.recover().ok,true);assert.equal(called,1);assert.equal(nav.orbitCalls,0);
  assert.equal(nav.enabled,false);assert.equal(nav.takeControl,0);
});

test('another modal prevents control restoration and online transition cannot mutate local health',async t=>{
  const {doc,nodes}=fakeDOM(t);let offline=true;
  const {medical,nav,store}=setup({health:0,enabled:()=>offline});medical.update();
  const other=doc.createElement('dialog');doc.body.append(other);other.showModal();
  assert.equal(medical.recover().ok,true);assert.equal(nav.enabled,false);assert.equal(other.open,true);medical.dispose();
  other.remove();const again=setup({health:0,enabled:()=>offline});again.medical.update();offline=false;again.medical.update();
  await Promise.resolve();assert.equal(again.nav.enabled,true);assert.equal(again.store.state.loadout.health,0);
  assert.equal(again.store.writes,0);assert.equal(nodes.some(n=>n.open),false);again.medical.dispose();
});

test('evacuation suspends real shared gamepad input until held RT releases',()=>{
  const {medical,nav}=setup({health:0});
  const pad={id:'medical controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
  nav.gamepad=new GamepadInput(()=>[pad]);nav.gamepad.poll();medical.update();
  nav.gamepad.poll({enabled:false,ui:true});pad.buttons[7]={pressed:true,value:1};
  medical.recover();assert.equal(nav.enabled,true);assert.equal(nav.gamepad.armed,false);
  assert.equal(nav.gamepad.poll().fire,0);assert.equal(nav.gamepad.poll().mine,0);
  pad.buttons[7]={pressed:false,value:0};nav.gamepad.poll();pad.buttons[7]={pressed:true,value:1};
  assert.equal(nav.gamepad.poll().fire,1);
});


test('different wildlife share suit health and attacker copy remains plain text',t=>{
  const {nodes}=fakeDOM(t),{medical,store,loadout}=setup();
  medical.applyBite(20);assert.equal(medical.state.creatureName,'Pyrebear');
  assert.equal(medical.applyBite(80,{creatureName:'Suloher dog'}).ok,true);
  assert.equal(loadout.state.health,0);assert.equal(medical.state.creatureName,'Suloher dog');
  assert.match(nodes[0].html,/>Suit emergency<\/h2>/);
  assert.match(nodes[0].status.textContent,/Suloher dog attack/);
  assert.equal(store.state.loadout.creatureName,undefined);
  medical.recover();medical.applyBite(100,{creatureName:'<b>unknown</b>'});
  assert.match(nodes[0].status.textContent,/<b>unknown<\/b>/);
  assert.doesNotMatch(nodes[0].html,/<b>unknown/);medical.dispose();
});

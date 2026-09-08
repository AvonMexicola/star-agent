import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { BODIES } from '../src/celestial.js';
import { SUN_DIRECTION } from '../src/world.js';
import { ROTATION_EPOCH_MS } from '../src/planet-rotation.js';
const out=new URL(`../test-results/planet-rotation/evidence-${process.env.ROTATION_QA_RUN??'local'}/`,import.meta.url).pathname;
const state=page=>page.evaluate(()=>window.starAgent.state);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const frames=(page,n=4)=>page.evaluate(n=>new Promise(resolve=>{const tick=()=>--n<=0?resolve():requestAnimationFrame(tick);requestAnimationFrame(tick);}),n);
async function boot(page,start='coast'){
  page.setDefaultTimeout(30_000);
  await page.addInitScript(epoch=>{
    const begin=performance.now();window.rotationQA={offset:0};
    Date.now=()=>epoch+performance.now()-begin+window.rotationQA.offset*1000;
    window.rotationPad={id:'Planet rotation standard controller',index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    navigator.getGamepads=()=>[window.rotationPad];
  },ROTATION_EPOCH_MS);
  await page.goto(`/?dev=1&ship=nomad&start=${start}&intro=0&seed=7291&debug`);
  await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.shipAsset==='ready'&&window.starAgent.state.controller.armed,null,{timeout:120_000});
}
const axes=(page,axes)=>page.evaluate(axes=>window.rotationPad.axes=axes,axes);
const down=(page,index,value)=>page.evaluate(({index,value})=>window.rotationPad.buttons[index]={pressed:value>0,value},{index,value});
async function tap(page,index){await down(page,index,1);await page.waitForFunction(index=>window.starAgent.navigation.gamepad.previous[index],index);await down(page,index,0);await page.waitForFunction(index=>!window.starAgent.navigation.gamepad.previous[index],index);}
async function neutral(page){await axes(page,[0,0,0,0]);for(let i=0;i<17;i++)await down(page,i,0);await page.waitForFunction(()=>document.querySelector('dialog[open]')?window.starAgent.navigation.gamepad.uiArmed:window.starAgent.state.controller.armed);}
async function aimLocal(page,local){
  for(let i=0;i<150;i++){
    const e=await page.evaluate(local=>{const n=window.starAgent.navigation,p=n.fromShipLocal(n.position.clone().fromArray(local)).sub(n.position).applyQuaternion(n.orientation.clone().invert());return [Math.atan2(p.x,-p.z),Math.atan2(p.y,Math.hypot(p.x,p.z))];},local);
    if(e.every(v=>Math.abs(v)<.025)){await axes(page,[0,0,0,0]);return;}
    await axes(page,[0,0,...[e[0],-e[1]].map(v=>Math.sign(v)*Math.min(.8,.19+Math.abs(v)*1.2))]);await frames(page,3);
  }
  await axes(page,[0,0,0,0]);throw new Error('Controller aim did not converge');
}
async function walkUntil(page,predicate){await axes(page,[0,-.65,0,0]);try{await page.waitForFunction(predicate,null,{timeout:30_000});}finally{await axes(page,[0,0,0,0]);}}
async function receipt(page,browser,name,errors,extra={}){
  const renderer=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown';});
  await writeFile(`${out}/${name}.json`,JSON.stringify({browser:browser.version(),renderer,viewport:{width:1440,height:900},errors,...extra,state:await state(page)},null,2));
}
test.beforeEach(async()=>mkdir(out,{recursive:true}));

test('inertial orbital views render rotating geography on all four worlds',async({page,browser})=>{
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await boot(page,'orbit');
  const samples=[];
  for(const body of BODIES.filter(b=>!b.star)){
    // Explicit render inspection fixture. Full gameplay acceptance is separate.
    await page.evaluate(({body,direction})=>{const n=window.starAgent.navigation;n.orbit();n.position.set(...body.center).addScaledVector(n.position.clone().fromArray(direction),body.radius*4);n.orientToward(n.position.clone().fromArray(body.center),n.position.clone().set(0,1,0));window.rotationQA.offset=0;},{body:{id:body.id,center:body.center,radius:body.radius},direction:SUN_DIRECTION});
    await frames(page,90);
    const before=await state(page);expect(before.planetRotation.frame).toBe('inertial');
    await page.screenshot({path:`${out}/${body.id}-phase-a.png`});
    await page.evaluate(()=>window.rotationQA.offset=900);await frames(page,45);
    const after=await state(page);expect(distance(before.position,after.position)).toBeLessThan(.001);
    await page.screenshot({path:`${out}/${body.id}-phase-b.png`});
    samples.push({body:body.id,before,after});
    expect(errors).toEqual([]);
  }
  await receipt(page,browser,'orbital-views',errors,{scope:'Debug poses for shader/rotation inspection only; no controller journey claim',samples});
});

test('controller lands, walks through the rotating day, boards and launches',async({page,browser})=>{
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await boot(page);await tap(page,3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed');
  await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk'&&window.starAgent.state.insideShip);
  await walkUntil(page,()=>window.starAgent.state.shipLocal[2]>2.4);await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.doorProgress>.98);
  await walkUntil(page,()=>window.starAgent.state.shipLocal[2]>8.2);await frames(page);
  const before=await state(page);expect(before.insideShip).toBe(false);expect(before.mode).toBe('walk');
  const sunBefore=await page.evaluate(()=>window.starAgent.navigation.normal.dot(window.starAgent.navigation.sunDirection));
  await page.screenshot({path:`${out}/surface-day.png`});
  await page.evaluate(()=>window.rotationQA.offset+=1800);await frames(page,30);
  const after=await state(page),sunAfter=await page.evaluate(()=>window.starAgent.navigation.normal.dot(window.starAgent.navigation.sunDirection));
  expect(distance(before.position,after.position)).toBeLessThan(.1);expect(distance(before.shipPosition,after.shipPosition)).toBeLessThan(.00001);
  expect(Math.abs(sunBefore-sunAfter)).toBeGreaterThan(.4);await page.screenshot({path:`${out}/surface-night.png`});
  await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();await neutral(page);
  await axes(page,[0,-.65,0,0]);await tap(page,1);await expect(page.locator('#cargo-dialog')).not.toBeVisible();
  expect((await state(page)).controller.armed).toBe(false);const heldPosition=(await state(page)).position;await frames(page,8);
  expect(distance(heldPosition,(await state(page)).position)).toBeLessThan(.00001);await neutral(page);
  await page.evaluate(()=>{window.rotationPad.connected=false;window.rotationPad.buttons[3]={pressed:true,value:1};});await frames(page);
  await page.evaluate(()=>window.rotationPad.connected=true);await frames(page,8);
  expect((await state(page)).controller.armed).toBe(false);expect((await state(page)).mode).toBe('walk');await neutral(page);
  await aimLocal(page,[0,2.75,0]);await walkUntil(page,()=>{const n=window.starAgent.navigation;return n.shipInteraction(n.toShipLocal())==='seat';});await frames(page);
  await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.mode==='landed');
  await tap(page,3);await page.waitForFunction(()=>window.starAgent.state.mode==='flight');
  await neutral(page);expect(errors).toEqual([]);
  await receipt(page,browser,'controller-journey',errors,{input:'Injected standard Gamepad through actual landing, hatch, walking, inventory, boarding and launch; only time is accelerated. No runtime pose writes.',sunBefore,sunAfter,before,after,physicalController:'not tested'});
});


test('two real clients share the planetary clock and keep controller contact with the rotating station',async({page,browser})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const observer=await context.newPage(),errors=[];
  try{
    for(const [i,p] of [page,observer].entries()){
      p.setDefaultTimeout(30_000);
      p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      await p.addInitScript(skew=>{
        const actual=Date.now;Date.now=()=>actual()+skew;
        window.rotationPad={id:'Rotation shared controller',index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
        navigator.getGamepads=()=>[window.rotationPad];
      },i*420_000);
      await p.goto('/?debug');
      await p.waitForFunction(()=>window.starAgent?.state.ready,null,{timeout:120_000});
      await expect(p.locator('#multiplayer-account-dialog')).toBeVisible();
      await p.locator('[data-auth-view=register]').click();
      await p.locator('#mp-register-email').fill(`rotation-${i}-${Date.now()}@example.test`);
      await p.locator('#mp-register-callsign').fill(`Rotation_${i}`);
      await p.locator('#mp-register-password').fill('rotation-test-only-2026');
      await p.locator('[data-auth-form=register] button[type=submit]').click();
      await expect(p.locator('[data-account-callsign]')).toHaveText(`Rotation_${i}`);
      await p.locator('[data-join]').click();
      await p.waitForFunction(()=>window.starAgent.state.multiplayer.connected);
      await p.locator('#multiplayer-account-dialog [data-mp-close]').click();await neutral(p);
    }
    await page.waitForFunction(()=>window.starAgent.state.multiplayer.players.length===2&&window.starAgent.state.multiplayer.remote[0]?.characterReady);
    await observer.waitForFunction(()=>window.starAgent.state.multiplayer.players.length===2&&window.starAgent.state.multiplayer.remote[0]?.characterReady);
    const a=await state(page),b=await state(observer);
    expect(a.planetRotation.frame).toBe('aeon');expect(b.planetRotation.frame).toBe('aeon');
    expect(Math.abs(a.planetRotation.seconds-b.planetRotation.seconds)).toBeLessThan(.5);
    const initial=await state(page);await axes(page,[.45,0,0,0]);
    await page.waitForFunction(start=>Math.hypot(...window.starAgent.state.position.map((v,i)=>v-start[i]))>2,initial.position);
    await neutral(page);await frames(page,20);
    const moved=await state(page);expect(moved.mode).toBe('walk');
    expect(Math.abs(moved.station.deckClearance-initial.station.deckClearance)).toBeLessThan(.03);
    const own=moved.multiplayer.ownId;
    await observer.waitForFunction(({own,position})=>{const p=window.starAgent.state.multiplayer.remote.find(p=>p.id===own);return p&&Math.hypot(...p.position.map((v,i)=>v-position[i]))<.15;},{own,position:moved.position});
    const stable=(await state(page)).position;await frames(page,90);const later=await state(page);
    expect(distance(stable,later.position)).toBeLessThan(.03);
    expect(distance(moved.planetRotation.inertialPosition,later.planetRotation.inertialPosition)).toBeGreaterThan(10);
    await page.screenshot({path:`${out}/shared-station.png`});expect(errors).toEqual([]);
    await receipt(page,browser,'shared-clock',errors,{scope:'Two real authenticated clients, second OS clock skewed seven minutes; controller station walk and rendered peer convergence. Account entry uses typed credentials.',initial,moved,later,observer:await state(observer)});
  }finally{await context.close();}
});

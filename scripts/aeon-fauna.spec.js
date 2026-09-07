import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {frames,pad,tap,state,walkLocal,aim,approach} from './fauna-controller-helpers.js';

const out=process.env.AEON_FAUNA_OUT || 'test-results/aeon-fauna-evidence/flee-fix-63f37b';
test.afterEach(async({page},info)=>{
  if(info.status!==info.expectedStatus){
    await mkdir(out,{recursive:true});
    await writeFile(`${out}/${info.title.split(':')[0]}-failure.json`,JSON.stringify((await page.evaluate(()=>window.starAgent?.state).catch(e=>({error:e.message})))??{error:'Application state unavailable'},null,2));
  }
});
for(const [species,start,hp] of [['aeon-amphibian','amphibian-habitat',120],['aeon-grazer','grazer-habitat',360]]){
  test(`${species}: physical controller encounter preserves peaceful behavior and real combat`,async({page,browser})=>{
    const errors=[];await mkdir(out,{recursive:true});
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(`${m.text()} ${m.location().url}`);});
    await page.addInitScript(()=>{
      window.faunaPad={id:'Aeon wildlife standard controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
      Object.defineProperty(navigator,'getGamepads',{value:()=>[window.faunaPad]});
    });
    await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
    await page.goto(`/?dev=1&ship=nomad&start=${start}&intro=0&debug&epoch=1788000000000`);
    await page.waitForFunction(()=>window.starAgent?.state.ready&&!window.starAgent.state.transiting&&window.starAgent.state.controller.armed,null,{timeout:120000});
    await page.waitForFunction(species=>window.starAgent.state.fauna.entities.some(e=>e.species===species),species,{timeout:90000});
    console.log(species,'assets and beach/grassland population ready');
    await tap(page,3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed',null,{timeout:90000});
    await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');
    await walkLocal(page,0,2.7);await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
    await walkLocal(page,0,13,.4);expect((await state(page)).insideShip).toBe(false);
    const outside=await state(page),entity=outside.fauna.entities.filter(e=>e.species===species&&e.health>0)
      .sort((a,b)=>Math.hypot(...a.position.map((x,i)=>x-outside.position[i]))-Math.hypot(...b.position.map((x,i)=>x-outside.position[i])))[0];
    expect(entity).toBeTruthy();expect(entity.health).toBe(hp);
    // A seeded animal may be beyond the nose. The direct rear-ramp approach
    // intersects the parked hull; use real controller waypoints around its side.
    const detour=await page.evaluate(id=>{
      const n=window.starAgent.navigation,e=window.starAgent.state.fauna.entities.find(e=>e.id===id),b=n.layout.flightBounds;
      const target=n.position.clone().fromArray(e.position).sub(n.shipPosition).applyQuaternion(n.shipOrientation.clone().invert());
      return {needed:target.z<b.max[2]+3,x:(target.x<0?-1:1)*(Math.max(Math.abs(b.min[0]),Math.abs(b.max[0]))+2),rear:Math.max(13,b.max[2]+3),front:b.min[2]-3};
    },entity.id);
    if(detour.needed){await walkLocal(page,detour.x,detour.rear,.4);await walkLocal(page,detour.x,detour.front,.4);}
    console.log(species,'walking to',entity.id);await approach(page,entity.id,species==='aeon-grazer'?10:6);
    await aim(page,entity.id);
    const peaceful=await state(page);
    await page.waitForFunction(steps=>window.starAgent.state.fauna.steps>=steps+40,peaceful.fauna.steps);
    expect((await state(page)).loadout.health).toBe(100);
    expect((await state(page)).fauna.totalBites).toBe(0);
    expect((await state(page)).fauna.entities.find(e=>e.id===entity.id).provoked).toBe(false);
    await page.screenshot({path:`${out}/${species}-peaceful.png`});
    for(let i=0;i<4&&(await state(page)).mining.tool.item!=='rifle-laser';i++)await tap(page,14);
    await aim(page,entity.id);const before=await state(page);
    await pad(page,undefined,{7:1});await pad(page,undefined,{7:0});
    await page.waitForFunction(({id,hp})=>window.starAgent.state.fauna.entities.find(e=>e.id===id)?.health<hp,{id:entity.id,hp});
    const injured=await state(page),animal=injured.fauna.entities.find(e=>e.id===entity.id);
    expect(injured.loadout.slots.ammo1.quantity).toBeLessThan(before.loadout.slots.ammo1.quantity);
    expect(animal.health).toBeGreaterThan(0);
    if(species==='aeon-amphibian'){
      expect(animal.provoked).toBe(true);
      await page.waitForFunction(()=>window.starAgent.state.fauna.totalBites>0,null,{timeout:20000});
      await aim(page,entity.id);await pad(page,undefined,{7:1});
      await page.waitForFunction(id=>window.starAgent.state.fauna.entities.find(e=>e.id===id)?.health===0,entity.id,{timeout:20000});
      await pad(page,undefined,{7:0});
      await page.waitForFunction(id=>window.starAgent.state.fauna.entities.find(e=>e.id===id)?.deathTime>2,entity.id);
      expect((await state(page)).fauna.kills).toBe(1);
      await page.screenshot({path:`${out}/${species}-defeated.png`});
    }else{
      expect(animal.provoked).toBe(false);
      const steps=injured.fauna.steps;
      await page.waitForFunction(steps=>window.starAgent.state.fauna.steps>=steps+60,steps);
      const after=await state(page),grazer=after.fauna.entities.find(e=>e.id===entity.id);
      expect(after.fauna.totalBites).toBe(0);expect(after.loadout.health).toBe(100);
      expect(['flee','return','patrol']).toContain(grazer.state);
      expect(Math.hypot(...grazer.position.map((x,i)=>x-animal.position[i]))).toBeGreaterThan(.5);
      await aim(page,entity.id);await page.screenshot({path:`${out}/${species}-retreat.png`});
    }
    await tap(page,9);const paused=await state(page);await pad(page,undefined,{7:1});await tap(page,1);await frames(page,12);
    expect((await state(page)).fauna.shots).toBe(paused.fauna.shots);
    expect((await state(page)).loadout.slots.ammo1.quantity).toBe(paused.loadout.slots.ammo1.quantity);
    expect((await state(page)).controller.armed).toBe(false);await pad(page,undefined,{7:0});
    const final=await state(page);expect(final.mode).toBe('walk');expect(final.fauna.count).toBeLessThanOrEqual(8);
    const backend=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL);});
    await writeFile(`${out}/${species}.json`,JSON.stringify({browser:browser.version(),backend,resolution:[1280,800],input:'Injected standard Gamepad, physical landing and traversal; no physical device',before,final,errors},null,2));
    expect(errors).toEqual([]);
  });
}

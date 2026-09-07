import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const out=process.env.FLEET_DEVELOPMENT_OUT||'test-results/fleet-development-captures';
const state=page=>page.evaluate(()=>window.starAgent.state);
const frames=(page,n=4)=>page.evaluate(async n=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame);},n);
async function held(page,index,down){await page.evaluate(({index,down})=>window.reviewPad.buttons[index]={pressed:down,value:Number(down)},{index,down});await frames(page);}
async function tap(page,index){await held(page,index,true);await held(page,index,false);}
async function neutral(page){await page.evaluate(()=>{window.reviewPad.axes.fill(0);for(const b of window.reviewPad.buttons){b.pressed=false;b.value=0;}});await page.waitForFunction(()=>window.starAgent.state.controller.armed);}
async function focus(page,key){
  for(let i=0;i<85;i++){
    if(await page.evaluate(()=>document.activeElement?.dataset.controllerKey)===key)return;
    await tap(page,13);
  }
  throw Error(`Controller focus did not reach ${key}`);
}
async function choose(page,key){await focus(page,key);await tap(page,0);}
async function capture(page,name){await page.screenshot({path:`${out}/${name}.png`});}
async function walkTo(page,x,z){
  const start=Date.now();
  while(Date.now()-start<35000){
    const distance=await page.evaluate(({x,z})=>{
      const n=window.starAgent.navigation,p=n.toShipLocal(),d=n.position.clone().set(x-p.x,0,z-p.z);
      const distance=d.length();
      d.applyQuaternion(n.shipOrientation).applyQuaternion(n.orientation.clone().invert());
      const speed=distance>.7?.7:.3;
      window.reviewPad.axes[0]=distance>.14?d.x/distance*speed:0;
      window.reviewPad.axes[1]=distance>.14?d.z/distance*speed:0;
      return distance;
    },{x,z});
    if(distance<.14){await held(page,6,true);await held(page,6,false);return;}
    await frames(page,8);
  }
  throw Error(`Physical walk to ${x},${z} stopped at ${(await state(page)).shipLocal}`);
}
async function liftReady(page,y){await page.waitForFunction(y=>{const l=window.starAgent.state.lifts?.elevator;return l&&Math.abs(l.y-y)<.01&&!l.moving&&l.gates.every(g=>!g.moving);},y,{timeout:15000});}
async function rampReady(page,open){await page.waitForFunction(open=>{const r=window.starAgent.state.lifts?.ramps.find(r=>r.id==='front');return r&&!r.moving&&(open?r.progress>.999:r.progress<.001);},open,{timeout:8000});}

test.beforeEach(async({page})=>{
  await mkdir(out,{recursive:true});
  await page.addInitScript(()=>{
    window.reviewPad={id:'Fleet development standard Gamepad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    Object.defineProperty(navigator,'getGamepads',{value:()=>[window.reviewPad]});
  });
  await page.route('**/api/auth/session',route=>route.fulfill({json:{account:null}}));
});
test.afterEach(async({page},info)=>{
  if(info.status===info.expectedStatus)return;
  await writeFile(`${out}/${info.title.split(':')[0]}-failure.json`,JSON.stringify(await page.evaluate(()=>window.starAgent?.state).catch(e=>({error:e.message})),null,2));
});

test('burrow: choose the surface start, mine, drive, inspect ore and physically exit/reboard',async({page,browser})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/?dev=1&ship=nomad&start=hangar&intro=0&seed=7291&debug');
  await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed,null,{timeout:120000});
  await tap(page,9);await choose(page,'tab-dev');await choose(page,'dev-location-rover-surface');
  await focus(page,'dev-launch');
  await held(page,0,true);await page.waitForURL(/start=rover-surface/);
  await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.rover?.occupied&&window.starAgent.state.controller.armed,null,{timeout:120000});
  const start=await state(page);expect(start.body).toBe('selene');expect(start.rover.aboard).toBe(false);
  expect(start.rover.wheels.every(w=>w.source==='terrain')).toBe(true);
  expect(start.audio.engine?.active??false).toBe(false);
  expect(await page.locator('#controller-hints').textContent()).not.toMatch(/ATLAS/);
  await capture(page,'burrow-surface-cockpit');
  await held(page,7,true);await page.waitForFunction(()=>window.starAgent.state.rover.mass>0,null,{timeout:15000});
  await capture(page,'burrow-twin-cutters');await held(page,7,false);
  await tap(page,8);await expect(page.locator('dialog[open]')).toHaveCount(1);
  await capture(page,'burrow-ore-bins');await tap(page,1);await neutral(page);
  // Back away from the real outcrop; no debug relocation or camera pose writes.
  await page.evaluate(()=>window.reviewPad.axes[1]=.5);
  await page.waitForFunction(distance=>window.starAgent.state.rover.distance>distance+2,start.rover.distance);
  await neutral(page);await held(page,6,true);await page.waitForFunction(()=>Math.abs(window.starAgent.state.rover.speed)<.1);await held(page,6,false);
  await tap(page,2);await page.waitForFunction(()=>!window.starAgent.state.rover.occupied&&!window.starAgent.state.rover.busy,null,{timeout:20000});
  await capture(page,'burrow-ground-exit');await neutral(page);await tap(page,2);
  await page.waitForFunction(()=>window.starAgent.state.rover.occupied&&!window.starAgent.state.rover.busy,null,{timeout:20000});
  await neutral(page);await tap(page,9);
  await held(page,7,true);await tap(page,1);await frames(page,12);
  expect((await state(page)).controller.armed).toBe(false);expect((await state(page)).rover.beaming).toBe(0);
  await held(page,7,false);await neutral(page);
  await writeFile(`${out}/burrow.json`,JSON.stringify({browser:browser.version(),start,final:await state(page),errors,input:'Injected controller, actual launcher and physical steps; optional anonymous session only'},null,2));
  expect(errors).toEqual([]);
});

test('atlas: walk both decks, operate the real ramp, return to the pilot and launch from the refitted bay',async({page,browser})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/?dev=1&ship=atlas&start=hangar&intro=0&seed=7291&debug');
  await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.shipAsset==='ready'&&window.starAgent.state.controller.armed,null,{timeout:120000});
  const start=await state(page);expect(start.utilities.gearAssemblies).toBe(6);expect(start.mfds).toHaveLength(4);
  await capture(page,'atlas-pilot-mfds');await tap(page,2);
  await walkTo(page,0,-20.5);await walkTo(page,0,-6.3);await walkTo(page,3.4,-6.3);
  await tap(page,2);await liftReady(page,9.5);
  await walkTo(page,3.4,-4);await walkTo(page,5.5,-4);await tap(page,2);await liftReady(page,2.6);
  await walkTo(page,0,-4);await capture(page,'atlas-cargo-deck');
  await walkTo(page,0,-21.5);await walkTo(page,-4.3,-21.5);await tap(page,2);await rampReady(page,true);
  await walkTo(page,0,-21.5);await walkTo(page,0,-33);expect((await state(page)).insideShip).toBe(false);
  await capture(page,'atlas-open-ramp-hangar');
  await walkTo(page,6.65,-33);await walkTo(page,6.65,-25.3);await tap(page,2);await rampReady(page,false);
  await capture(page,'atlas-ground-call');await tap(page,2);await rampReady(page,true);
  await walkTo(page,6.65,-33);await walkTo(page,0,-33);await walkTo(page,0,-21.5);
  await walkTo(page,-4.3,-21.5);await tap(page,2);await rampReady(page,false);
  await walkTo(page,0,-21.5);await walkTo(page,0,-4);await walkTo(page,5.5,-4);await tap(page,2);await liftReady(page,9.5);
  await walkTo(page,0,-4);await walkTo(page,0,-19);await walkTo(page,-2.1,-19);await walkTo(page,-2.1,-20.5);
  await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.mode==='landed');
  await tap(page,3);await page.waitForFunction(()=>window.starAgent.state.mode==='flight'&&!window.starAgent.state.station.lifting);
  await page.evaluate(()=>window.reviewPad.axes[1]=-.9);
  await page.waitForFunction(()=>window.starAgent.state.station.local[2]<-145,null,{timeout:35000});
  await neutral(page);expect((await state(page)).crash).toBeNull();await capture(page,'atlas-station-departure');
  await writeFile(`${out}/atlas.json`,JSON.stringify({browser:browser.version(),start,final:await state(page),errors,input:'Injected controller only; physical ship ramps/crew lift and ordinary launch'},null,2));
  expect(errors).toEqual([]);
});

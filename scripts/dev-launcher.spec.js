import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='/tmp/star-agent-dev-qa';
test.setTimeout(600000);
const state=page=>page.evaluate(()=>window.starAgent.state);
const frames=page=>page.evaluate(()=>new Promise(resolve=>{let n=0;function next(){if(++n>=5)resolve();else requestAnimationFrame(next);}requestAnimationFrame(next);}));
async function ready(page){await page.waitForFunction(()=>window.starAgent?.state.ready&&!window.starAgent.state.transiting,null,{timeout:100000});}
function errorsFor(page){const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});return errors;}
async function choose(page,ship,location){
  if(!await page.locator('#dev-launcher').isVisible()){await page.keyboard.press('F2');}
  await page.locator('[data-controller-key="dev-ship-'+ship+'"]').click();
  await page.locator('[data-controller-key="dev-location-'+location+'"]').click();
  await page.locator('[data-controller-key="dev-launch"]').click();await ready(page);await expect(page.locator('#loading')).toHaveCSS('opacity','0');
  expect((await state(page)).shipId).toBe(ship);expect((await state(page)).dev.open).toBe(false);
}
test.afterEach(async({page},info)=>{if(info.status===info.expectedStatus)return;await mkdir(out,{recursive:true});if(!page.isClosed()){await page.screenshot({path:out+'/failed.png'}).catch(()=>{});await writeFile(out+'/failed.json',JSON.stringify(await page.evaluate(()=>window.starAgent?.state??document.querySelector('#loading')?.innerText).catch(()=>null),null,2));}});

test('launcher starts every flyable hull and surface technology while keeping normal saves intact',async({page,browser})=>{
 await mkdir(out,{recursive:true});const errors=errorsFor(page);
 await page.addInitScript(()=>{if(!localStorage.getItem('dev-qa-sentinel')){localStorage.setItem('star-agent.fleet.v1',JSON.stringify({version:1,surfaceVisited:false,unlocked:false,active:'nomad'}));localStorage.setItem('star-agent.selene-mining.v1','normal-save-sentinel');localStorage.setItem('dev-qa-sentinel','1');}});
 await page.goto('/?seed=7291');await ready(page);await expect(page.locator('#dev-launcher')).toBeVisible();
 await page.screenshot({path:out+'/launcher-desktop.png'});
 await choose(page,'nomad','hangar');expect((await state(page)).mode).toBe('landed');
 await page.keyboard.press('F');await page.waitForFunction(()=>window.starAgent.state.mode==='walk');
 await page.keyboard.press('F2');await expect(page.locator('#dev-launcher')).toBeVisible();await page.getByRole('button',{name:'Close test launcher',exact:true}).click();
 expect((await state(page)).enabled).toBe(true);
 await page.keyboard.press('F');await page.waitForFunction(()=>window.starAgent.state.mode==='landed');
 await page.screenshot({path:out+'/nomad-cockpit.png'});
 await choose(page,'atlas','hangar');expect((await state(page)).mode).toBe('landed');await page.keyboard.press('F');await page.waitForFunction(()=>window.starAgent.state.mode==='walk');await page.screenshot({path:out+'/atlas-bridge.png'});
 await choose(page,'kestrel','coast');await page.keyboard.press('4');await frames(page);await page.screenshot({path:out+'/kestrel-coast.png'});
 expect((await state(page)).body).toBe('aeon');expect((await state(page)).kestrelAccess).toBeTruthy();
 await page.keyboard.press('G');await page.waitForFunction(()=>window.starAgent.state.utilities.gearProgress===0);expect((await state(page)).utilities.gearAssemblies).toBe(3);
 await page.keyboard.press('M');await expect(page.locator('#system-map')).toBeVisible();await page.screenshot({path:out+'/system-map.png'});await page.keyboard.press('M');
 for(const [location,body] of [['forest','aeon'],['moon','selene'],['pyre-surface','pyre'],['miasma-surface','miasma'],['star','star']]){
   await choose(page,'nomad',location);expect((await state(page)).body).toBe(body);await page.keyboard.press('4');await frames(page);await page.screenshot({path:out+'/'+location+'.png'});
 }
 expect(await page.evaluate(()=>localStorage.getItem('star-agent.selene-mining.v1'))).toBe('normal-save-sentinel');
 expect(JSON.parse(await page.evaluate(()=>localStorage.getItem('star-agent.fleet.v1'))).unlocked).toBe(false);
 const backend=await page.evaluate(()=>{const gl=document.querySelector('#viewport').getContext('webgl2');return gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL);});
 await writeFile(out+'/rendered-scenes.json',JSON.stringify({browser:browser.version(),backend,viewport:[1440,900],errors,final:await state(page)},null,2));expect(errors).toEqual([]);
});

test('controller selects ship and destination, launches, reopens and suppresses held movement on close',async({page})=>{
 const errors=errorsFor(page);await page.addInitScript(()=>{window.devPad={id:'Dev launcher Gamepad fixture',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.devPad]});});
 const button=async(index,down)=>{await page.evaluate(({index,down})=>{window.devPad.buttons[index]={pressed:down,value:Number(down)};},{index,down});await frames(page);};
 const press=async index=>{await button(index,true);await button(index,false);};
 const focus=async key=>{for(let i=0;i<80;i++){if(await page.evaluate(()=>document.activeElement?.dataset.controllerKey)===key)return;await press(13);}throw Error('Controller did not reach '+key);};
 await page.goto('/?seed=7291');await ready(page);await frames(page);
 await focus('dev-ship-kestrel');await press(0);await focus('dev-location-orbit');await press(0);await focus('dev-launch');
 await Promise.all([page.waitForURL(/dev=1/,{waitUntil:'domcontentloaded'}),page.evaluate(()=>window.devPad.buttons[0]={pressed:true,value:1})]);await ready(page);await frames(page);
 expect((await state(page)).shipId).toBe('kestrel');expect((await state(page)).body).toBe('aeon');
 await page.waitForFunction(()=>window.starAgent.state.controller.armed);await press(9);await expect(page.locator('#controller-menu')).toBeVisible();
 await focus('dev-launcher');await press(0);await expect(page.locator('#dev-launcher')).toBeVisible();await page.screenshot({path:out+'/launcher-controller.png'});
 const before=(await state(page)).position;await page.evaluate(()=>window.devPad.axes[1]=-1);await press(1);await frames(page);
 expect((await state(page)).controller.armed).toBe(false);expect((await state(page)).position).toEqual(before);
 await page.evaluate(()=>window.devPad.axes[1]=0);await frames(page);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await page.evaluate(()=>window.devPad.axes[1]=-1);await page.waitForFunction(()=>window.starAgent.state.speed>1);await page.evaluate(()=>window.devPad.axes[1]=0);expect(errors).toEqual([]);
});

test.describe('phone',()=>{
test.use({hasTouch:true,viewport:{width:390,height:844}});
test('launcher remains readable and launches by touch',async({page})=>{
 const errors=errorsFor(page);await page.goto('/?seed=7291');await ready(page);
 await page.screenshot({path:out+'/launcher-phone.png'});
 expect(await page.locator('#dev-launcher').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.locator('[data-controller-key="dev-ship-nomad"]').tap();await page.locator('[data-controller-key="dev-location-hangar"]').tap();
 await page.locator('[data-controller-key="dev-launch"]').tap();await ready(page);await expect(page.locator('#loading')).toHaveCSS('opacity','0');
 expect((await state(page)).shipId).toBe('nomad');expect((await state(page)).dev.open).toBe(false);
 await expect(page.locator('#dev-launch-button')).toBeVisible();await page.locator('#dev-launch-button').tap();await expect(page.locator('#dev-launcher')).toBeVisible();expect(errors).toEqual([]);
});
});

test('Kestrel has no hidden construction cargo; map labels, soundtrack and refreshed Atlas studio are usable',async({page})=>{
 const errors=errorsFor(page);await mkdir(out,{recursive:true});
 await page.goto('/?dev=1&ship=kestrel&start=hangar&intro=0&seed=7291');await ready(page);await expect(page.locator('#loading')).toHaveCSS('opacity','0');
 const s=await state(page);expect(s.shipId).toBe('kestrel');
 expect(Object.values(s.containers.containers.find(c=>c.id==='ship').items).every(q=>q===0)).toBe(true);
 expect(s.containers.shipAccess.available).toBe(false);expect(s.audio.created).toBe(false);
 await page.keyboard.press('M');await expect(page.locator('#system-map')).toHaveCSS('opacity','1');await frames(page);
 await expect(page.locator('[data-travel-target="star"] small')).toHaveText('STAR');await expect(page.locator('[data-travel-target="miasma"] small')).toHaveText('MOON');
 for(const [id,name] of [['aeon','Aeon'],['selene','Selene'],['pyre','Pyre'],['star','Our star'],['miasma','Miasma']]){
   await page.locator('[data-travel-target="'+id+'"]').click();await expect(page.locator('#map-target-name')).toContainText(name);
 }
 expect(errors).toEqual([]);
 await page.screenshot({path:out+'/system-map-final.png'});await page.keyboard.press('M');await page.keyboard.press('H');
 await page.locator('#sound-button').click();await page.waitForFunction(()=>window.starAgent.state.audio.music?.time>0,null,{timeout:20000});
 expect((await state(page)).audio.music.failed).toEqual([]);await page.locator('#sound-button').click();expect((await state(page)).audio.enabled).toBe(false);await page.locator('#close-help').click();
 await page.keyboard.press('F2');await page.getByRole('link',{name:'Atlas Mark II studio'}).click();await expect(page.locator('#asset-state')).toHaveText('READY',{timeout:30000});await expect(page.locator('#loading')).toHaveCSS('opacity','0');
 await frames(page);await page.screenshot({path:out+'/atlas-refresh-studio.png'});
 expect(await page.evaluate(()=>window.atlasMarkIIStudio.model.getObjectByName('AtlasLandingGear')!==undefined||window.atlasMarkIIStudio.stats.triangles>0)).toBe(true);
 await writeFile(out+'/integration-followup.json',JSON.stringify({errors,atlas:await page.evaluate(()=>window.atlasMarkIIStudio.stats)},null,2));expect(errors).toEqual([]);
});

test('combined audio follows physical cabin exit, weapon fire and cutter suspension',async({page})=>{
 const errors=errorsFor(page);await mkdir(out,{recursive:true});
 await page.goto('/?dev=1&ship=nomad&start=hangar&intro=0&seed=7291');await ready(page);await expect(page.locator('#loading')).toHaveCSS('opacity','0');
 expect((await state(page)).audio.created).toBe(false);
 await page.keyboard.press('H');await page.locator('#sound-button').click();await page.locator('#close-help').click();
 await page.keyboard.press('F');await page.waitForFunction(()=>window.starAgent.state.mode==='walk');
 await page.keyboard.down('W');await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.5);await page.keyboard.up('W');
 expect((await state(page)).audio.effects.steps).toBeGreaterThan(0);expect((await state(page)).audio.effects.last).toBe('metal');
 await page.keyboard.press('F');await page.waitForFunction(()=>window.starAgent.state.doorProgress>.98);
 await page.keyboard.down('W');await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>8.5);await page.keyboard.up('W');
 expect((await state(page)).insideShip).toBe(false);
 await page.keyboard.press('1');await page.waitForFunction(()=>window.starAgent.state.mining.tool.item==='rifle-laser');
 await page.keyboard.down('T');await page.waitForFunction(()=>window.starAgent.state.audio.effects.shots>0);await page.keyboard.up('T');
 expect((await state(page)).loadout.slots.ammo1.quantity).toBeLessThan(60);
 await page.keyboard.press('3');await page.waitForFunction(()=>window.starAgent.state.mining.tool.item==='mining-laser-tool');
 await page.keyboard.down('T');await page.waitForFunction(()=>window.starAgent.state.audio.effects.mining);
 await page.keyboard.press('M');await page.waitForFunction(()=>window.starAgent.state.audio.effects.mining===false);await page.keyboard.up('T');await page.keyboard.press('M');
 await page.keyboard.press('H');await page.locator('#sound-button').click();expect((await state(page)).audio.enabled).toBe(false);expect((await state(page)).audio.effects.voices).toBe(0);
 await writeFile(out+'/gameplay-audio.json',JSON.stringify({errors,audio:(await state(page)).audio},null,2));expect(errors).toEqual([]);
});

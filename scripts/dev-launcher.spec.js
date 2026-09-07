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
 await button(0,true);await page.waitForURL(/dev=1/);await ready(page);await frames(page);
 expect((await state(page)).shipId).toBe('kestrel');expect((await state(page)).body).toBe('aeon');
 await page.waitForFunction(()=>window.starAgent.state.controller.armed);await press(9);await expect(page.locator('#controller-menu')).toBeVisible();
 await focus('dev-launcher');await press(0);await expect(page.locator('#dev-launcher')).toBeVisible();await page.screenshot({path:out+'/launcher-controller.png'});
 const before=(await state(page)).position;await page.evaluate(()=>window.devPad.axes[1]=-1);await press(1);await frames(page);
 expect((await state(page)).controller.armed).toBe(false);expect((await state(page)).position).toEqual(before);
 await page.evaluate(()=>window.devPad.axes[1]=0);await frames(page);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await page.evaluate(()=>window.devPad.axes[1]=-1);await page.waitForFunction(()=>window.starAgent.state.speed>1);await page.evaluate(()=>window.devPad.axes[1]=0);expect(errors).toEqual([]);
});

test('phone launcher remains readable and launches by touch',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/?seed=7291');await ready(page);
 await page.screenshot({path:out+'/launcher-phone.png'});
 expect(await page.locator('#dev-launcher').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await choose(page,'nomad','hangar');await expect(page.locator('#dev-launch-button')).toBeVisible();await page.locator('#dev-launch-button').click();await expect(page.locator('#dev-launcher')).toBeVisible();
});

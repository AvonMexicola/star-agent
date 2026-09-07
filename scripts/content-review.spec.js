import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
const output=join(process.env.CONTENT_REVIEW_CACHE||join(homedir(),'.cache','star-agent-content-review'),'combined');
const state=page=>page.evaluate(()=>window.starAgent.state);
const frames=(page,n=4)=>page.evaluate(async n=>{for(let i=0;i<n;i++)await new Promise(r=>requestAnimationFrame(r));},n);
const ready=page=>page.waitForFunction(()=>window.starAgent?.state.ready&&!window.starAgent.state.transiting,null,{timeout:100000});
function diagnostics(page){const errors=[],warnings=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});page.on('console',m=>{if(m.type()==='error')errors.push(m.text()+' '+m.location().url);if(m.type()==='warning')warnings.push(m.text());});return {errors,warnings};}
async function controller(page){
 await page.addInitScript(()=>{window.reviewPad={id:'Content review standard Gamepad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.reviewPad]});});
 const button=async(i,down)=>{await page.evaluate(({i,down})=>window.reviewPad.buttons[i]={pressed:down,value:Number(down)},{i,down});await frames(page);};
 const tap=async i=>{await button(i,true);await button(i,false);};
 const choose=async(key,navigation)=>{for(let i=0;i<100;i++){if(await page.evaluate(()=>document.activeElement?.dataset.controllerKey)===key){
  if(navigation){const loaded=page.waitForURL(navigation);await page.evaluate(()=>window.reviewPad.buttons[0]={pressed:true,value:1});await loaded;await page.waitForLoadState('domcontentloaded');}
  else await tap(0);
  return;
 }await tap(13);}throw Error('Controller cannot reach '+key);};
 const axes=values=>page.evaluate(values=>window.reviewPad.axes=values,values);
 const camera=async()=>{await button(4,true);await button(5,true);await tap(15);await button(4,false);await button(5,false);};
 return {button,tap,choose,axes,camera};
}
test.beforeEach(async()=>mkdir(output,{recursive:true}));
test.afterEach(async({page},info)=>{if(info.status===info.expectedStatus)return;await page.screenshot({path:join(output,`failure-${info.testId.replace(/\W/g,'-')}.png`)}).catch(()=>{});await writeFile(join(output,'failure-state.json'),JSON.stringify(await page.evaluate(()=>window.starAgent?.state??null).catch(()=>null),null,2));});

test('new character physically leaves the Nomad, jumps, holds its weapons and returns using a controller',async({page,browser})=>{
 const log=diagnostics(page),pad=await controller(page);
 await page.goto('/?dev=1&ship=nomad&start=hangar&intro=0&seed=7291&debug');await ready(page);
 await page.waitForFunction(()=>window.starAgent.state.character.ready&&window.starAgent.state.controller.armed);
 expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>r.name.includes('/player-expedition.glb')))).toBe(true);
 await pad.tap(2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');
 await pad.axes([0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.5);await pad.axes([0,0,0,0]);
 await pad.tap(2);await page.waitForFunction(()=>window.starAgent.state.doorProgress>.98);
 await pad.axes([0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>10);await pad.axes([0,0,0,0]);
 expect((await state(page)).insideShip).toBe(false);await pad.camera();
 await page.waitForFunction(()=>window.starAgent.state.character.visible&&window.starAgent.state.mining.tool.attachment==='character-hand');
 await pad.tap(14);await page.waitForFunction(()=>window.starAgent.state.mining.tool.item==='rifle-laser');
 await frames(page,30);await page.screenshot({path:join(output,'game-expedition-rifle.png')});
 await pad.button(0,true);await page.waitForFunction(()=>window.starAgent.navigation.jumpHeight>.25);await page.screenshot({path:join(output,'game-expedition-jump.png')});await pad.button(0,false);
 await page.waitForFunction(()=>window.starAgent.navigation.jumpHeight===0);
 const ammo=(await state(page)).mining.tool.ammo;await pad.button(7,true);await page.waitForFunction(ammo=>window.starAgent.state.mining.tool.ammo<ammo,ammo);await pad.button(7,false);
 await pad.tap(9);await expect(page.locator('dialog[open]')).toBeVisible();
 await pad.button(7,true);const paused=(await state(page)).mining.tool.ammo;await pad.tap(1);await frames(page,20);expect((await state(page)).mining.tool.ammo).toBe(paused);
 await pad.button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await pad.tap(14);await page.waitForFunction(()=>window.starAgent.state.mining.tool.item==='sidearm-pistol');await frames(page,25);await page.screenshot({path:join(output,'game-expedition-pistol.png')});
 await pad.tap(15);await page.waitForFunction(()=>window.starAgent.state.mining.tool.item==='mining-laser-tool');await frames(page,25);await page.screenshot({path:join(output,'game-expedition-cutter.png')});
 await pad.camera();await pad.axes([0,1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]<-1.4);await pad.axes([0,0,0,0]);await pad.tap(2);await page.waitForFunction(()=>window.starAgent.state.mode==='landed');
 await writeFile(join(output,'character-game.json'),JSON.stringify({browser:browser.version(),input:'Injected standard Gamepad; physical boarding route, no pose/inventory mutation.',...log,final:await state(page)},null,2));expect(log.errors).toEqual([]);
});

test('content review links, construction categories and isolated sandbox saves survive the combined menu',async({page})=>{
 const log=diagnostics(page),pad=await controller(page);
 await page.goto('/?seed=7291&debug');await ready(page);await expect(page.locator('#dev-launcher')).toBeVisible();await frames(page,10);
 await pad.choose('dev-page-review');await expect(page.locator('.dev-review-list')).toBeVisible();await expect(page.locator('[data-dev-page=review]')).toHaveAttribute('aria-pressed','true');
 await frames(page,15);await page.screenshot({path:join(output,'content-review-desktop.png')});
 const routes=await page.locator('.dev-review-list>a').evaluateAll(links=>links.map(a=>({key:a.dataset.controllerKey,href:a.href})));
 expect(routes).toHaveLength(7);
 for(const route of routes){const response=await page.request.get(route.href);expect(response.status(),route.href).toBe(200);}
 await pad.choose('dev-review-construction',/sandbox=build/);await ready(page);
 await page.waitForFunction(()=>window.starAgent.state.build.assetsReady&&window.starAgent.state.controller.armed);
 expect((await state(page)).mode).toBe('walk');expect((await state(page)).sandbox).toBe(true);
 expect((await state(page)).build.controllerAvailable).toBe(true);await pad.tap(1);await expect(page.locator('#build-dialog')).toBeVisible();
 await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);await pad.tap(5);
 await expect(page.locator('#build-dialog')).toBeVisible();await expect(page.locator('[data-controller-key="build-tab-shapes"]')).toHaveAttribute('aria-pressed','true');
 await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);await pad.tap(5);
 await expect(page.locator('[data-controller-key="build-tab-facilities"]')).toHaveAttribute('aria-pressed','true');await page.screenshot({path:join(output,'construction-facilities.png')});
 await pad.tap(1);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 const before=(await state(page)).build.pieceCount;await page.reload();await ready(page);expect((await state(page)).build.pieceCount).toBe(before);expect((await state(page)).sandbox).toBe(true);
 await writeFile(join(output,'review-routes.json'),JSON.stringify({routes,...log,build:(await state(page)).build},null,2));expect(log.errors).toEqual([]);
});

test.describe('phone review',()=>{test.use({hasTouch:true,viewport:{width:390,height:844}});
 test('content review has reachable touch pages at 390 px',async({page})=>{
  const log=diagnostics(page);await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
  await page.goto('/?seed=7291');await ready(page);await page.locator('[data-dev-page="review"]').tap();await expect(page.locator('[data-dev-page=review]')).toHaveAttribute('aria-pressed','true');
  expect(await page.locator('#dev-launcher').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  const visible=page.locator('.dev-review-list>a:visible');expect(await visible.count()).toBe(3);await frames(page,15);await page.screenshot({path:join(output,'content-review-phone.png')});
  await page.getByRole('button',{name:'Next content reviews page',exact:true}).tap();expect(await visible.count()).toBe(3);
  await page.getByRole('button',{name:'Next content reviews page',exact:true}).tap();expect(await visible.count()).toBe(1);
  expect(log.errors).toEqual([]);
 });
});

test('bundled prop and sound studios load their real content',async({page})=>{
 const log=diagnostics(page);await page.goto('/dev/props.html?only=kestrel-maintenance-roll&t=0');await page.waitForFunction(()=>window.__propsReady);expect(await page.evaluate(()=>window.__propsError??null)).toBe(null);expect(await page.evaluate(()=>window.__propsFailed)).toEqual([]);expect(await page.evaluate(()=>window.__propsStats.map(p=>p.name))).toEqual(['kestrel-maintenance-roll']);
 await page.screenshot({path:join(output,'kestrel-prop.png')});
 await page.goto('/tests/gameplay-audio.html');await page.getByRole('button',{name:'Enable sound',exact:true}).click();await page.getByRole('button',{name:'Full thrust',exact:true}).click();await frames(page,20);
 await page.getByRole('button',{name:'Engine off',exact:true}).click();await page.getByRole('button',{name:'Pyrebear · deep growl',exact:true}).click();await frames(page,15);
 await page.screenshot({path:join(output,'sound-studio.png')});expect(log.errors).toEqual([]);
});

test('remote expedition suits compile with distinct server colors and shared hand calibration',async({page,browser})=>{
 const log=diagnostics(page);await page.goto((process.env.CONTENT_REVIEW_DEV_URL||'http://127.0.0.1:5522')+'/scripts/fixtures/remote-expedition.html');
 await page.waitForFunction(()=>window.remoteReview?.ready);await frames(page,45);await page.screenshot({path:join(output,'remote-expedition-suits.png')});
 const evidence=await page.evaluate(()=>window.remoteReview.snapshot());expect(evidence.peers).toHaveLength(3);expect(evidence.peers.every(p=>p.characterReady&&p.weaponAttached)).toBe(true);
 await writeFile(join(output,'remote-expedition.json'),JSON.stringify({browser:browser.version(),...log,...evidence},null,2));expect(log.errors).toEqual([]);expect(log.warnings).toEqual([]);
});

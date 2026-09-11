import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {MINING_KEY} from '../src/mining/store.js';
import {SANDBOX_PREFIX} from '../src/build/sandbox.js';
const out=process.env.BUILDER_EVIDENCE;
const frames=page=>page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
const ready=page=>page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed,null,{timeout:90000});
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SANDBOX_PREFIX+MINING_KEY);
async function capture(page,name){await page.screenshot({path:`${out}/${name}.png`});await writeFile(`${out}/${name}.json`,JSON.stringify(await page.evaluate(()=>window.starAgent?.state??window.toolQA?.meta()??window.avatarStudio?.state??null),null,2));}
async function button(page,i,pressed){await page.evaluate(({i,pressed})=>window.testPad.buttons[i]={pressed,value:+pressed},{i,pressed});await frames(page);}
async function tap(page,i){await button(page,i,true);await button(page,i,false);}
async function choose(page,key){
  for(let i=0;i<95;i++){
    if(await page.evaluate(key=>document.activeElement?.dataset.controllerKey===key,key)){await tap(page,0);return;}
    await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);
    await tap(page,13);
  }
  throw Error(`Controller target not reached: ${key}`);
}
async function setup(page,url){
  await mkdir(out,{recursive:true});const errors=[],warnings=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  page.on('requestfailed',r=>requests.push({url:r.url(),error:r.failure(),expectedNavigationAbort:Boolean(page.builderReloading&&r.failure()?.errorText==='net::ERR_ABORTED'&&new URL(r.url()).pathname.startsWith('/audio/music/'))}));
  await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
  await page.addInitScript(()=>{
    window.testPad={id:'Builder standard Gamepad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    navigator.getGamepads=()=>window.padDisconnected?[]:[window.testPad];
  });
  await page.goto(url);await ready(page);return {errors,warnings,requests};
}
const baseURL='/?sandbox=build&intro=0&debug&seed=7291';
async function selectLamp(page){
  await tap(page,1);await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);
  for(let i=0;i<9&&await page.locator('[data-controller-key="build-tab-power"]').getAttribute('aria-pressed')!=='true';i++)await tap(page,5);
  await choose(page,'build-piece-floodlight');await ready(page);
  await page.waitForFunction(()=>window.starAgent.state.build.preview?.valid);
}
async function graphics(page){return page.evaluate(()=>{const s=window.starAgent.state,gl=document.querySelector('#viewport').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),viewport:[innerWidth,innerHeight],drawCalls:s.drawCalls,triangles:s.triangles,resolution:s.renderResolution};});}
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus)try{await capture(page,`failure-${info.title.slice(0,18).replaceAll(' ','-')}`);}catch{}});

test('native builder model and controller construction with finite materials and restored equipment',async({page,browser})=>{
  const diagnostics=await setup(page,`http://127.0.0.1:5178${baseURL}`);
  await selectLamp(page);await capture(page,'01-before-game');
  // A fresh context save on the private production origin starts from the same authored sandbox pose.
  await page.goto(baseURL);await ready(page);const initialItem=await page.evaluate(()=>window.starAgent.state.mining.tool.item);
  const before=await saved(page);await selectLamp(page);
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.builder?.loaded&&window.starAgent.state.mining.tool.builder.visible);
  expect(await page.evaluate(()=>window.starAgent.state.mining.tool.builder.readout)).toMatchObject({status:'READY',label:'Outdoor floodlight · 600 W',mode:'ASSEMBLE'});
  await capture(page,'02-after-game');
  // A real placed piece, not a debug callback, produces the lens projection.
  const count=await page.evaluate(()=>window.starAgent.state.build.pieceCount);
  await button(page,0,true);
  await page.waitForFunction(n=>window.starAgent.state.build.pieceCount===n+1,count);
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.builder.projection);
  await capture(page,'03-confirmation');await button(page,0,false);
  const placed=await saved(page),total=(save,item)=>Object.values(save.remote).reduce((n,c)=>n+(c.items[item]||0),0);
  for(const [item,cost] of Object.entries({'metal-stock':8,conductor:3,glass:2}))expect(total(before,item)-total(placed,item)).toBe(cost);
  expect(placed.loadout).toEqual(before.loadout);
  // Occupied space is rejected and cannot replay the previous acknowledgement.
  await page.waitForFunction(()=>!window.starAgent.state.mining.tool.builder.projection);
  await tap(page,0);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.build.pieceCount)).toBe(count+1);
  expect(await page.evaluate(()=>window.starAgent.state.mining.tool.builder.projection)).toBe(false);
  await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();await capture(page,'04-inventory');
  // Resume is the dialog's initial controller focus. Holding A closes the
  // inventory and must not carry that same press into construction.
  await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);
  expect(await page.evaluate(()=>document.activeElement?.dataset.controllerKey)).toBe('gameplay-resume');
  await button(page,0,true);await expect(page.locator('#cargo-dialog')).not.toBeVisible();
  expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);
  await button(page,0,false);await ready(page);expect(await page.evaluate(()=>window.starAgent.state.build.pieceCount)).toBe(count+1);
  // The native focus transition, disconnection/replacement and mapping gates own held A.
  const blank=await page.context().newPage(),game=await page.context().newCDPSession(page),other=await page.context().newCDPSession(blank);
  await blank.goto('about:blank');await game.send('Emulation.setFocusEmulationEnabled',{enabled:false});await other.send('Emulation.setFocusEmulationEnabled',{enabled:false});
  await page.bringToFront();await page.waitForFunction(()=>document.hasFocus());await button(page,0,true);
  await blank.bringToFront();await page.waitForFunction(()=>!window.starAgent.state.focused);
  await page.bringToFront();await page.waitForFunction(()=>window.starAgent.state.focused);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);
  await button(page,0,false);await ready(page);await game.send('Emulation.setFocusEmulationEnabled',{enabled:true});await other.send('Emulation.setFocusEmulationEnabled',{enabled:true});await game.detach();await other.detach();await blank.close();
  for(const change of ['disconnect','replacement','mapping']){
    await button(page,0,true);
    await page.evaluate(change=>{if(change==='disconnect')window.padDisconnected=true;else if(change==='replacement')window.testPad.id='Replacement builder pad';else window.testPad.mapping='';},change);await frames(page);
    await page.evaluate(()=>{window.padDisconnected=false;window.testPad.mapping='standard';});await frames(page);
    expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);
    await button(page,0,false);await ready(page);
  }
  expect(await page.evaluate(()=>window.starAgent.state.build.pieceCount)).toBe(count+1);
  // Existing bumper chord switches to third person without leaving construction.
  await button(page,4,true);await button(page,5,true);await tap(page,15);await button(page,5,false);await button(page,4,false);await ready(page);
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.attachment==='character-hand');
  await page.waitForFunction(()=>window.starAgent.navigation.jumpHeight<.001&&window.starAgent.state.character.state!=='jump');
  await capture(page,'05-third-person');
  await tap(page,2);await page.waitForFunction(item=>!window.starAgent.state.build.active&&window.starAgent.state.mining.tool.item===item,initialItem);
  expect(await page.evaluate(()=>window.starAgent.state.mining.tool.builder.visible)).toBe(false);
  await writeFile(`${out}/controller.json`,JSON.stringify({browser:browser.version(),...diagnostics,graphics:await graphics(page),input:'Injected standard Gamepad from authored supplied sandbox, menu entry, real placement/materials, result inventory, focus/device gates and exit. No pose or action injection; physical device untested.'},null,2));
  expect(diagnostics.errors).toEqual([]);expect(diagnostics.warnings).toEqual([]);expect(diagnostics.requests.filter(r=>!r.expectedNavigationAbort)).toEqual([]);

  await page.goto('/tests/handheld-tools/fixture.html?item=builder-tool');await page.waitForFunction(()=>window.toolReady);
  await page.evaluate(()=>{const q=window.toolQA,b=new q.camera.position.constructor();q.model.updateMatrixWorld(true);b.set(-.06,.045,0);q.camera.position.copy(b).add(q.camera.position.clone().set(-.38,.32,1).normalize().multiplyScalar(.62));q.camera.lookAt(b);q.render();});
  await capture(page,'06-native-side');
  await page.evaluate(()=>{const q=window.toolQA,c=q.camera.position.clone().set(-.06,.045,0);q.camera.position.copy(c).add(c.clone().set(.95,.65,1).normalize().multiplyScalar(.62));q.camera.lookAt(c);q.render();});
  await capture(page,'07-native-back');
  await page.goto('/dev/avatar-studio.html');await page.waitForFunction(()=>window.avatarStudio?.state.ready);
  await page.getByLabel('Equipment',{exact:true}).selectOption('builder-tool');
  await page.waitForFunction(()=>window.avatarStudio.equipment.itemObject('builder-tool'));
  await page.getByRole('button',{name:'Hands',exact:true}).click();await frames(page);await capture(page,'08-grip');
  expect(diagnostics.errors).toEqual([]);expect(diagnostics.warnings).toEqual([]);
});

test('keyboard and native phone controls draw the builder and return to their prior equipment',async({page,browser})=>{
  const diagnostics=await setup(page,baseURL);
  await page.keyboard.press('b');await page.locator('[data-controller-key="build-tab-power"]').click();await page.locator('[data-controller-key="build-piece-floodlight"]').click();
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.builder?.visible&&window.starAgent.state.build.preview?.valid);
  const before=await page.evaluate(()=>window.starAgent.state.build.pieceCount);await page.keyboard.press('Enter');
  await page.waitForFunction(n=>window.starAgent.state.build.pieceCount===n+1,before);await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!window.starAgent.state.build.active);await capture(page,'09-keyboard-return');
  // Native CDP touch, in a fresh storage namespace context at phone resolution.
  await page.evaluate(()=>localStorage.clear());await page.setViewportSize({width:390,height:844});page.builderReloading=true;await page.reload();await ready(page);page.builderReloading=false;
  const touch=await page.context().newCDPSession(page);
  async function touchButton(selector){
    const target=page.locator(selector);await target.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/touch-presented.png`});
    const b=await target.boundingBox(),point={x:b.x+b.width/2,y:b.y+b.height/2,id:1,radiusX:2,radiusY:2,force:1};
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await frames(page);await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await frames(page);
  }
  await page.evaluate(()=>{window.builderTouches=[];document.addEventListener('pointerdown',e=>window.builderTouches.push({trusted:e.isTrusted,type:e.pointerType,key:e.target.closest('[data-controller-key]')?.dataset.controllerKey}),true);});
  await touchButton('#build-shortcut');await touchButton('[data-controller-key="build-tab-power"]');await touchButton('[data-controller-key="build-piece-floodlight"]');
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.builder?.visible&&window.starAgent.state.build.preview?.valid);
  await capture(page,'10-phone-builder');const phoneCount=await page.evaluate(()=>window.starAgent.state.build.pieceCount);
  await touchButton('[data-controller-key="build-hud-place"]');await page.waitForFunction(n=>window.starAgent.state.build.pieceCount===n+1,phoneCount);
  await touchButton('[data-controller-key="build-hud-exit"]');await page.waitForFunction(()=>!window.starAgent.state.build.active);
  const touches=await page.evaluate(()=>window.builderTouches);expect(touches.some(e=>e.trusted&&e.type==='touch'&&e.key==='build-hud-place')).toBe(true);
  await capture(page,'11-phone-return');await touch.detach();
  await writeFile(`${out}/keyboard-touch.json`,JSON.stringify({browser:browser.version(),...diagnostics,touches,graphics:await graphics(page)},null,2));
  expect(diagnostics.errors).toEqual([]);expect(diagnostics.warnings).toEqual([]);expect(diagnostics.requests.filter(r=>!r.expectedNavigationAbort)).toEqual([]);
});

import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const out=process.env.CUTTER_EVIDENCE;
const frames=page=>page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
const ready=page=>page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed,null,{timeout:90000});
async function capture(page,name){await page.screenshot({path:`${out}/${name}.png`});await writeFile(`${out}/${name}.json`,JSON.stringify(await page.evaluate(()=>window.starAgent?.state??window.toolQA?.meta()??window.avatarStudio?.state??null),null,2));}
async function button(page,i,pressed){await page.evaluate(({i,pressed})=>window.testPad.buttons[i]={pressed,value:+pressed},{i,pressed});await frames(page);}
async function tap(page,i){await button(page,i,true);await button(page,i,false);}
const axes=(page,values)=>page.evaluate(values=>window.testPad.axes=values,values);
function diagnostics(page){const errors=[],warnings=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});page.on('requestfailed',r=>requests.push({url:r.url(),error:r.failure()}));return {errors,warnings,requests};}
test.beforeEach(async()=>mkdir(out,{recursive:true}));
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus)try{await capture(page,`failure-${info.title.slice(0,18).replaceAll(' ','-')}`);}catch{}});

test('actual Mk1 model, rotating cartridge and supplied medical props render in native Three.js',async({page,browser})=>{
  const issues=diagnostics(page),views=[];
  await page.route('**/models/props/mining-laser-tool.glb',r=>r.fulfill({contentType:'model/gltf-binary',body:execFileSync('git',['show','67dc33b:public/models/props/mining-laser-tool.glb'],{maxBuffer:2e6})}));
  await page.goto('/tests/handheld-tools/fixture.html?item=mining-laser-tool&baseline');await page.waitForFunction(()=>window.toolReady);await capture(page,'01-before');
  await page.unroute('**/models/props/mining-laser-tool.glb');
  await page.goto('/tests/handheld-tools/fixture.html?item=mining-laser-tool');await page.waitForFunction(()=>window.toolReady);await capture(page,'02-mk1');
  const meta=await page.evaluate(()=>window.toolQA.meta());expect(meta.calls).toBeLessThanOrEqual(6);expect(meta.textures).toBe(3);expect(meta.triangles).toBe(9444);views.push(meta);
  await page.evaluate(()=>{const q=window.toolQA;q.model.getObjectByName('CutterRotor').rotation.x+=Math.PI/3;q.render();});await capture(page,'03-head-phase');
  await page.goto('/dev/avatar-studio.html');await page.waitForFunction(()=>window.avatarStudio?.state.ready);
  await page.getByLabel('Equipment',{exact:true}).selectOption('mining-laser-tool');await page.waitForFunction(()=>window.avatarStudio.equipment.itemObject('mining-laser-tool'));
  await page.getByRole('button',{name:'Hands',exact:true}).click();await frames(page);await capture(page,'04-grips');
  await page.getByRole('button',{name:'Side',exact:true}).click();await page.getByLabel('Movement',{exact:true}).selectOption('walk');await frames(page);await capture(page,'05-walking-rig');
  for(const item of ['bandage-medical','med-stim']){
    await page.goto(`/tests/handheld-tools/fixture.html?item=${item}`);await page.waitForFunction(()=>window.toolReady);
    await page.evaluate(()=>{const q=window.toolQA,box=q.meta().bounds,c=q.camera.position.clone().fromArray(box.min).add(q.camera.position.clone().fromArray(box.max)).multiplyScalar(.5);q.camera.position.copy(c).add(c.clone().set(-.7,.5,1).normalize().multiplyScalar(.34));q.camera.lookAt(c);q.render();});
    await capture(page,`prop-${item}`);views.push({item,...await page.evaluate(()=>window.toolQA.meta())});
  }
  expect(issues.errors).toEqual([]);expect(issues.warnings).toEqual([]);expect(issues.requests).toEqual([]);
  await writeFile(`${out}/native.json`,JSON.stringify({browser:browser.version(),...issues,views,note:'Isolated native renderer/rig views; the next test establishes gameplay.'},null,2));
});

test('controller lands, walks, mines with the rotating head, inspects collected ore and returns; keyboard and touch share the tool',async({page,browser})=>{
  const issues=diagnostics(page);
  await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
  await page.addInitScript(()=>{window.testPad={id:'Field cutter standard Gamepad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>window.padDisconnected?[]:[window.testPad];});
  await page.goto('/?dev=1&ship=nomad&start=moon&intro=0&debug&seed=7291');await ready(page);
  await page.waitForFunction(()=>window.starAgent.state.enabled&&!window.starAgent.state.transiting);
  await tap(page,3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed',null,{timeout:60000});
  await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');
  await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.3);await axes(page,[0,0,0,0]);
  await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
  await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>12);await axes(page,[0,0,0,0]);
  expect(await page.evaluate(()=>window.starAgent.state.insideShip)).toBe(false);
  // Observe the target to guide genuine right-stick input; no pose/action writes.
  await page.evaluate(()=>{window.aimDone=false;window.aimInterval=setInterval(()=>{const n=window.starAgent.navigation,v=n.position.clone().fromArray(window.starAgent.state.mining.activePosition).sub(n.position).applyQuaternion(n.orientation.clone().invert()),yaw=Math.atan2(v.x,-v.z),pitch=Math.atan2(v.y,Math.hypot(v.x,v.z));if(Math.abs(yaw)<.02&&Math.abs(pitch)<.02){window.testPad.axes=[0,0,0,0];window.aimDone=true;clearInterval(window.aimInterval);return;}const a=x=>Math.sign(x)*Math.min(1,.2+Math.abs(x)*1.5);window.testPad.axes=[0,0,a(yaw),a(-pitch)];},30);});
  await page.waitForFunction(()=>window.aimDone,null,{timeout:20000});
  await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>{const s=window.starAgent.state;return Math.hypot(...s.position.map((v,i)=>v-s.mining.activePosition[i]))<5;},null,{timeout:25000});await axes(page,[0,0,0,0]);
  await tap(page,15);await page.waitForFunction(()=>!window.starAgent.state.mining.tool.selected);await tap(page,15);
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.hit&&window.starAgent.state.mining.tool.cutterHead);
  await capture(page,'06-game-idle');const before=await page.evaluate(()=>({revision:window.starAgent.state.mining.activeRevision,mass:window.starAgent.state.mining.pack.reduce((a,b)=>a+b,0)}));
  await button(page,7,true);await page.waitForFunction(r=>window.starAgent.state.mining.activeRevision>r,before.revision);
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.cutterHead.speed>4&&window.starAgent.state.mining.tool.beaming);
  await capture(page,'07-game-mining');const phase=await page.evaluate(()=>window.starAgent.state.mining.tool.cutterHead.angle);await frames(page);
  expect(await page.evaluate(()=>window.starAgent.state.mining.tool.cutterHead.angle)).not.toBe(phase);
  await button(page,7,false);await page.waitForFunction(()=>!window.starAgent.state.mining.pending&&window.starAgent.state.mining.tool.cutterHead.speed===0);
  expect(await page.evaluate(()=>window.starAgent.state.mining.pack.reduce((a,b)=>a+b,0))).toBeGreaterThan(before.mass);
  await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);await capture(page,'08-result-inventory');
  await button(page,7,true);await tap(page,1);await expect(page.locator('#cargo-dialog')).not.toBeVisible();
  expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);expect(await page.evaluate(()=>window.starAgent.state.mining.tool.beaming)).toBe(false);
  await button(page,7,false);await ready(page);
  // Native focus and device changes suppress a surviving mining trigger.
  const blank=await page.context().newPage(),game=await page.context().newCDPSession(page),other=await page.context().newCDPSession(blank);
  await blank.goto('about:blank');await game.send('Emulation.setFocusEmulationEnabled',{enabled:false});await other.send('Emulation.setFocusEmulationEnabled',{enabled:false});
  await page.bringToFront();await page.waitForFunction(()=>document.hasFocus());await button(page,7,true);await blank.bringToFront();await page.waitForFunction(()=>!window.starAgent.state.focused);
  await page.bringToFront();await page.waitForFunction(()=>window.starAgent.state.focused);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);expect(await page.evaluate(()=>window.starAgent.state.mining.tool.beaming)).toBe(false);
  await button(page,7,false);await ready(page);await game.send('Emulation.setFocusEmulationEnabled',{enabled:true});await other.send('Emulation.setFocusEmulationEnabled',{enabled:true});await game.detach();await other.detach();await blank.close();
  await button(page,7,true);await page.evaluate(()=>window.padDisconnected=true);await frames(page);await page.evaluate(()=>window.padDisconnected=false);await frames(page);
  expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);expect(await page.evaluate(()=>window.starAgent.state.mining.tool.beaming)).toBe(false);await button(page,7,false);await ready(page);
  await tap(page,15);await page.waitForFunction(()=>!window.starAgent.state.mining.tool.selected);expect(await page.evaluate(()=>window.starAgent.state.mining.tool.cutterHead.speed)).toBe(0);
  await tap(page,15);await ready(page);
  await page.keyboard.down('t');await page.waitForFunction(()=>window.starAgent.state.mining.tool.beaming&&window.starAgent.state.mining.tool.cutterHead.speed>2);await capture(page,'09-keyboard');await page.keyboard.up('t');
  await page.waitForFunction(()=>!window.starAgent.state.mining.tool.beaming);
  await page.setViewportSize({width:390,height:844});const touch=await page.context().newCDPSession(page);await page.locator('.mining-trigger').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/touch-presented.png`});
  const b=await page.locator('.mining-trigger').boundingBox();
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1,radiusX:2,radiusY:2,force:1}]});
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.beaming&&window.starAgent.state.mining.tool.cutterHead.speed>2);await capture(page,'10-phone-mining');
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForFunction(()=>window.starAgent.state.mining.tool.cutterHead.speed===0);await touch.detach();
  expect(issues.errors).toEqual([]);expect(issues.warnings).toEqual([]);expect(issues.requests).toEqual([]);
  await writeFile(`${out}/gameplay.json`,JSON.stringify({browser:browser.version(),...issues,before,final:await page.evaluate(()=>window.starAgent.state),input:'Injected standard Gamepad from normal development Selene arrival: land, physical boarding exit, walk/aim, mine, collected inventory, focus/modal/device gate and return. Additional keyboard/native CDP touch. No pose or action injection. Physical controller untested.'},null,2));
});

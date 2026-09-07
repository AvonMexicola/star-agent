import {test,expect} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out=process.env.STATION_EXTERIOR_OUTPUT??'/tmp/star-agent-station-exterior-capture';
const variant=process.env.STATION_EXTERIOR_VARIANT??'authored';
const frames=page=>page.evaluate(()=>new Promise(resolve=>{let n=0;function next(){if(++n>=6)resolve();else requestAnimationFrame(next);}requestAnimationFrame(next);}));
const errorsFor=page=>{
  const errors=[],warnings=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  return {errors,warnings};
};
async function ready(page){
  await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.station.ready&&!window.starAgent.state.transiting&&window.starAgent.state.dev?.open===false,null,{timeout:120000});
  await expect(page.locator('#loading')).toHaveCSS('opacity','0');
}

test('actual game exterior views, independent ring motion and phone overview',async({page,browser})=>{
  await mkdir(out,{recursive:true});const messages=errorsFor(page),captures=[];
  const suffix=variant==='authored'?'&stationExterior=1':'';
  await page.goto('/?intro=0&seed=7291&debug=1&dev=1&ship=nomad&start=orbit'+suffix);
  await ready(page);
  expect(await page.evaluate(()=>starAgent.state.station.exterior)).toBe(variant==='authored'?'geometry-review':'legacy');
  await page.evaluate(()=>{
    starAgent.setRenderScale(1);
    document.body.classList.remove('player-active');
    document.querySelectorAll('body > :not(canvas):not(script)').forEach(e=>e.style.visibility='hidden');
    document.body.classList.add('photo-mode');
  });
  const backend=await page.evaluate(()=>{
    const gl=document.querySelector('#viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  });
  async function view(name,eye,target,viewport=[1440,900]){
    await page.setViewportSize({width:viewport[0],height:viewport[1]});
    await page.evaluate(({eye,target})=>{
      const n=starAgent.navigation,s=n.station;n.orbit();n.enabled=false;
      n.position.copy(s.centre).add(n.position.clone().fromArray(eye).applyQuaternion(s.baseQuaternion));
      n.orientToward(s.centre.clone().add(n.position.clone().fromArray(target).applyQuaternion(s.baseQuaternion)),s.up);
      s.beginOpening();s.setOpeningProgress(1);
      s.exterior.rings.forEach(r=>r.rotation.x=0);
    },{eye,target});
    await frames(page);
    const framing=await page.evaluate(eye=>{
      const n=starAgent.navigation,s=n.station;
      const expected=s.centre.clone().add(n.position.clone().fromArray(eye).applyQuaternion(s.baseQuaternion));
      return {error:expected.distanceTo(n.position.clone().fromArray(starAgent.state.camera.position)),ship:starAgent.state.camera.shipVisible};
    },eye);
    expect(framing.error).toBeLessThan(.0001);expect(framing.ship).toBe(false);
    await page.screenshot({path:`${out}/${name}.png`});
    const state=await page.evaluate(()=>starAgent.state);
    captures.push({name,eye,target,viewport,drawCalls:state.drawCalls,triangles:state.triangles,camera:state.camera,station:state.station,renderScale:state.renderScale});
  }
  await view('quarter',[-3800,2100,-4200],[0,-35,0]);
  await view('broadside',[0,900,-6000],[0,-35,0]);
  await view('ring-face',[-5600,1100,-1800],[0,-35,0]);
  await view('bearing',[-1420,250,-380],[-1110,0,0]);
  await view('spine',[-445,140,-300],[-200,-50,0]);
  await view('berth05',[-5,35,-630],[-95,-4,-520]);
  const before=await page.evaluate(()=>starAgent.state.station.rings);
  await frames(page);const after=await page.evaluate(()=>starAgent.state.station.rings);
  expect(after[0]).toBeGreaterThan(before[0]);expect(after[1]).toBeLessThan(before[1]);
  await view('phone-overview',[-10300,5700,-11400],[0,-35,0],[390,844]);
  let identity=null;
  if(variant==='authored'){
    const local=await readFile('public/models/station-exterior.glb');
    const response=await page.request.get('/models/station-exterior.glb');
    expect(response.ok()).toBe(true);
    const served=await response.body();
    identity=createHash('sha256').update(served).digest('hex');
    expect(identity).toBe(createHash('sha256').update(local).digest('hex'));
  }
  await writeFile(`${out}/evidence.json`,JSON.stringify({variant,identity,browser:browser.version(),backend,viewport:[1440,900],seed:7291,countsIncludeShadowPasses:true,timing:'Not measured; other GPU workloads may be active',...messages,captures},null,2));
  expect(messages.errors).toEqual([]);expect(messages.warnings).toEqual([]);
});

test('local launcher exterior link supports controller entry, held-input suppression and touch',async({page,browser})=>{
  test.setTimeout(300000);
  test.skip(variant!=='authored');
  await mkdir(out,{recursive:true});const messages=errorsFor(page);
  await page.addInitScript(()=>{
    window.exteriorPad={id:'Station review Gamepad fixture',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    Object.defineProperty(navigator,'getGamepads',{value:()=>[window.exteriorPad]});
  });
  const press=async index=>{await page.evaluate(i=>window.exteriorPad.buttons[i]={pressed:true,value:1},index);await frames(page);await page.evaluate(i=>window.exteriorPad.buttons[i]={pressed:false,value:0},index);await frames(page);};
  await page.goto('/?seed=7291');
  await page.waitForFunction(()=>window.starAgent?.state.ready);
  await expect(page.locator('#dev-launcher')).toBeVisible();
  for(let i=0;i<80;i++){
    if(await page.evaluate(()=>document.activeElement?.dataset.controllerKey)==='dev-station-exterior')break;
    await press(13);
  }
  expect(await page.evaluate(()=>document.activeElement?.dataset.controllerKey)).toBe('dev-station-exterior');
  await Promise.all([page.waitForURL(/exteriorView=overview/),page.evaluate(()=>window.exteriorPad.buttons[0]={pressed:true,value:1})]);
  await ready(page);await frames(page);
  expect(await page.evaluate(()=>starAgent.state.station.exterior)).toBe('geometry-review');
  expect(await page.evaluate(()=>starAgent.state.station.distance)).toBeGreaterThan(3000);
  await page.waitForFunction(()=>starAgent.state.controller.armed);
  await press(9);await expect(page.locator('#controller-menu')).toBeVisible();
  await page.evaluate(()=>window.exteriorPad.axes[1]=-1);await press(1);await frames(page);
  expect(await page.evaluate(()=>starAgent.state.controller.armed)).toBe(false);
  await page.evaluate(()=>window.exteriorPad.axes[1]=0);await frames(page);
  await page.screenshot({path:`${out}/controller-preview.png`});
  const phoneURL=new URL('/?seed=7291',page.url()).href;
  await page.close();
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:1});
  const phone=await context.newPage();const phoneMessages=errorsFor(phone);
  await phone.goto(phoneURL);
  await phone.waitForFunction(()=>window.starAgent?.state.ready);
  const link=phone.locator('[data-controller-key="dev-station-exterior"]');
  await link.scrollIntoViewIfNeeded();await link.tap();await ready(phone);await frames(phone);
  expect(await phone.evaluate(()=>starAgent.state.station.exterior)).toBe('geometry-review');
  await phone.screenshot({path:`${out}/phone-playable-preview.png`});
  await context.close();
  expect([...messages.errors,...phoneMessages.errors]).toEqual([]);
  expect([...messages.warnings,...phoneMessages.warnings]).toEqual([]);
  await writeFile(`${out}/input-evidence.json`,JSON.stringify({controller:'Injected standard Gamepad: launcher entry, flight preview, menu back and held-direction suppression',touch:'390x844 actual tap on launcher link',physicalController:false,errors:[...messages.errors,...phoneMessages.errors],warnings:[...messages.warnings,...phoneMessages.warnings]},null,2));
});

test('Kestrel physically exits, reboards and departs a bay with the rebuilt exterior',async({page})=>{
  test.skip(variant!=='authored');
  await mkdir(out,{recursive:true});const messages=errorsFor(page);
  await page.goto('/?intro=0&seed=7291&debug=1&dev=1&ship=kestrel&start=hangar&stationExterior=1');
  await ready(page);
  expect(await page.evaluate(()=>starAgent.state.mode)).toBe('landed');
  expect(await page.evaluate(()=>starAgent.state.station.exterior)).toBe('geometry-review');
  await page.keyboard.press('KeyF');
  await page.waitForFunction(()=>starAgent.state.mode==='walk'&&starAgent.state.kestrelAccess.phase==='idle',null,{timeout:35000});
  expect(await page.evaluate(()=>starAgent.state.insideShip)).toBe(false);
  expect(await page.evaluate(()=>starAgent.state.shipLocal[0])).toBeLessThan(-2.4);
  await page.screenshot({path:`${out}/physical-port-ladder.png`});
  await page.keyboard.press('KeyF');
  await page.waitForFunction(()=>starAgent.state.mode==='landed'&&starAgent.state.kestrelAccess.secured,null,{timeout:40000});
  await page.keyboard.press('KeyB');
  await page.waitForFunction(()=>starAgent.state.mode==='flight'&&!starAgent.state.station.lifting);
  await page.keyboard.press('KeyG');
  await page.waitForFunction(()=>starAgent.state.kestrel.progress.gear===0);
  await page.keyboard.press('Digit4');
  await page.keyboard.down('KeyW');
  await page.waitForFunction(()=>starAgent.state.station.distance>130,null,{timeout:30000});
  await page.keyboard.up('KeyW');await page.keyboard.press('KeyX');await frames(page);
  expect(await page.evaluate(()=>starAgent.state.crash)).toBeNull();
  await page.screenshot({path:`${out}/physical-departure.png`});
  await writeFile(`${out}/departure-evidence.json`,JSON.stringify({start:'Explicit developer hangar start; every subsequent ladder/seat/launch/flight step uses keyboard input',state:await page.evaluate(()=>starAgent.state),...messages},null,2));
  expect(messages.errors).toEqual([]);expect(messages.warnings).toEqual([]);
});

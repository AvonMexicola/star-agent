import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const output=process.env.SENTRY_OUTPUT??'test-results/sentry-manual';
const state=page=>page.evaluate(()=>starAgent.state);
const wait=(page,fn,arg=null,timeout=30000)=>page.waitForFunction(fn,arg,{timeout,polling:80});
const frames=page=>page.evaluate(async()=>{for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);});
async function pad(page){
  await page.addInitScript(()=>{
    window.sentryPad={id:'Sentry injected standard controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    Object.defineProperty(navigator,'getGamepads',{value:()=>[sentryPad]});
  });
}
const axes=(page,value)=>page.evaluate(value=>sentryPad.axes=value,value);
async function button(page,index,pressed){await page.evaluate(({index,pressed})=>sentryPad.buttons[index]={pressed,value:+pressed},{index,pressed});await frames(page);}
async function tap(page,index){await button(page,index,true);await button(page,index,false);}
async function neutral(page){await axes(page,[0,0,0,0]);await page.evaluate(()=>{for(let i=0;i<17;i++)sentryPad.buttons[i]={pressed:false,value:0};});await wait(page,()=>document.querySelector('dialog[open]')?starAgent.navigation.gamepad.uiArmed:starAgent.state.controller.armed);await frames(page);}
async function choose(page,key){
  for(let i=0;i<100;i++){
    if(await page.evaluate(key=>document.activeElement?.dataset.controllerKey===key,key)){await tap(page,0);return;}
    await tap(page,13);
  }throw Error('Controller focus did not reach '+key);
}
async function chase(page){await page.evaluate(()=>{for(const i of [4,5])sentryPad.buttons[i]={pressed:true,value:1};});await frames(page);await tap(page,15);await page.evaluate(()=>{for(const i of [4,5])sentryPad.buttons[i]={pressed:false,value:0};});await frames(page);}
async function stop(page){await axes(page,[0,0,0,0]);await button(page,6,true);await wait(page,()=>Math.abs(starAgent.state.sentry.current?.speed??starAgent.state.speed)<.07);await button(page,6,false);await neutral(page);}
async function boot(page,url,errors){
  errors.warnings??=[];errors.requests??=[];
  page.on('pageerror',e=>errors.push('page: '+e.message));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
  page.on('console',m=>{if(m.type()==='warning')errors.warnings.push(m.text());});page.on('requestfailed',r=>errors.requests.push({url:r.url(),error:r.failure()?.errorText}));
  await page.goto(url);await wait(page,()=>window.starAgent?.state.ready,null,120000);
}
const rendererInfo=page=>page.evaluate(()=>{const gl=document.getElementById('viewport').getContext('webgl2'),debug=gl.getExtension('WEBGL_debug_renderer_info');return {vendor:gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL??gl.VENDOR),renderer:gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER),version:gl.getParameter(gl.VERSION),resolution:[gl.drawingBufferWidth,gl.drawingBufferHeight],viewport:[innerWidth,innerHeight]};});
async function nativeFocusGate(page){
  const blank=await page.context().newPage(),game=await page.context().newCDPSession(page),other=await page.context().newCDPSession(blank),report={};
  try{
    await blank.goto('about:blank');await game.send('Emulation.setFocusEmulationEnabled',{enabled:false});await other.send('Emulation.setFocusEmulationEnabled',{enabled:false});await page.bringToFront();
    await wait(page,()=>document.hasFocus()&&starAgent.state.focused);await neutral(page);
    await page.evaluate(()=>{window.sentryFocusEvents=[];for(const type of ['focus','blur'])window.addEventListener(type,e=>sentryFocusEvents.push({type,trusted:e.isTrusted,time:performance.now()}));});
    const n=(await state(page)).sentry.current.shots;await button(page,7,true);await wait(page,n=>starAgent.state.sentry.current.shots>n,n);
    await blank.bringToFront();await wait(page,()=>!document.hasFocus()&&!starAgent.state.focused);await wait(page,()=>!starAgent.state.sentry.current.armed);
    const stopped=(await state(page)).sentry.current.shots;await page.bringToFront();await wait(page,()=>document.hasFocus()&&starAgent.state.focused);await page.waitForTimeout(550);
    expect((await state(page)).sentry.current.shots).toBe(stopped);report.events=await page.evaluate(()=>sentryFocusEvents);expect(report.events.some(e=>e.type==='blur'&&e.trusted)).toBe(true);expect(report.events.some(e=>e.type==='focus'&&e.trusted)).toBe(true);
    await neutral(page);report.result='PASS';return report;
  }finally{await game.send('Emulation.setFocusEmulationEnabled',{enabled:true});await other.send('Emulation.setFocusEmulationEnabled',{enabled:true});await page.bringToFront();await blank.close();await game.detach();await other.detach();}
}
async function offline(page){
  if(await page.locator('#multiplayer-account-dialog').isVisible()){await choose(page,'account-continue');}
  await neutral(page);
}
const roverPoint=(page,local,id=null)=>page.evaluate(({local,id})=>{
  const s=starAgent.state.sentry,r=s.vehicles.find(r=>r.id===id)??s.current??s.vehicles[0],n=starAgent.navigation;
  return n.position.clone().fromArray(local).applyQuaternion(n.orientation.clone().fromArray(r.quaternion)).add(n.position.clone().fromArray(r.position)).toArray();
},{local,id});
/** Feedback reads poses, then changes only standard Gamepad axes/buttons.
 * No navigation, interaction, vehicle or authority method is called here. */
async function walk(page,target,{reach=.32,eva=false,timeout=45000}={}){
  await neutral(page);
  await page.evaluate(({target,reach,eva})=>{
    window.sentryWalk={target,reach,eva,done:false,samples:[],active:true};
    function update(){
      const task=sentryWalk;if(!task.active)return;
      const n=starAgent.navigation,d=n.position.clone().fromArray(task.target).sub(n.position).applyQuaternion(n.orientation.clone().invert()),distance=task.eva?d.length():Math.hypot(d.x,d.z);
      task.samples.push({position:n.position.toArray(),mode:n.mode,distance});if(task.samples.length>3000)task.samples.shift();
      if(distance<task.reach){sentryPad.axes=[0,0,0,0];sentryPad.buttons[0]=sentryPad.buttons[1]={pressed:false,value:0};task.done=true;task.active=false;return;}
      const rate=Math.min(.65,Math.max(.20,distance*.18)),planar=Math.hypot(d.x,d.z),scale=planar?rate/planar:0;
      sentryPad.axes=[d.x*scale,d.z*scale,0,0];
      if(task.eva){const brake=distance<Math.max(.8,n.speed*.7)&&n.speed>.45;sentryPad.buttons[0]={pressed:!brake&&d.y>.22,value:+(!brake&&d.y>.22)};sentryPad.buttons[1]={pressed:!brake&&d.y<-.22,value:+(!brake&&d.y<-.22)};sentryPad.buttons[6]={pressed:brake,value:+brake};if(brake)sentryPad.axes=[0,0,0,0];}
      requestAnimationFrame(update);
    }requestAnimationFrame(update);
  },{target,reach,eva});
  try{await wait(page,()=>sentryWalk.done,null,timeout);}finally{await page.evaluate(()=>{if(window.sentryWalk)sentryWalk.active=false;sentryPad.axes=[0,0,0,0];for(const i of [0,1,6])sentryPad.buttons[i]={pressed:false,value:0};});}
  if(eva)await stop(page);else await neutral(page);
}
async function board(page,role){
  await neutral(page);expect((await state(page)).sentry.near?.role).toBe(role);
  await page.evaluate(()=>{window.sentryAccess=[];window.sentryRecord=true;const frame=()=>{if(!sentryRecord)return;sentryAccess.push(starAgent.state.position);requestAnimationFrame(frame);};frame();});
  await tap(page,2);await wait(page,role=>{const s=starAgent.state.sentry;return s.role===role&&s.current?.seats[role].phase==='seated';},role,40000);
  const positions=await page.evaluate(()=>{sentryRecord=false;return sentryAccess;});
  const maxStep=Math.max(...positions.slice(1).map((p,i)=>Math.hypot(...p.map((n,j)=>n-positions[i][j]))));expect(maxStep).toBeLessThan(.6);
  await neutral(page);return {maxStep,samples:positions.length};
}

test('controller physically boards both Sentry seats, drives/reverses, fires, inspects backpack and suppresses held inputs',async({page,browser})=>{
  await mkdir(output,{recursive:true});const errors=[],report={browser:browser.version(),input:'Injected standard Gamepad only after the explicit development start. No physical controller.'};await pad(page);
  try{
    await boot(page,'/?dev=1&intro=0&ship=nomad&start=sentry-surface&debug=1',errors);await offline(page);
    await wait(page,()=>starAgent.state.sentry.vehicles.length===1&&!starAgent.state.transiting,null,120000);
    report.pilotAccess=await board(page,'pilot');await chase(page);await page.screenshot({path:output+'/01-sentry-exterior.png'});
    const start=(await state(page)).sentry.current;
    await axes(page,[0,-.5,0,0]);await wait(page,start=>starAgent.state.sentry.current.distance>start+2,start.distance);await stop(page);
    const afterForward=(await state(page)).sentry.current.position;
    await axes(page,[0,.5,0,0]);await wait(page,()=>starAgent.state.sentry.current.speed<-.3);await page.waitForTimeout(500);await stop(page);
    report.drive={start:start.position,forward:afterForward,reverse:(await state(page)).sentry.current.position};
    await axes(page,[0,0,.45,-.2]);await page.waitForTimeout(650);await neutral(page);await button(page,7,true);
    await wait(page,()=>starAgent.state.sentry.current.shots>2&&starAgent.state.sentry.beams.some(b=>b.visible));report.beams=(await state(page)).sentry.beams;expect(report.beams.some(b=>Math.hypot(...b.end.map((x,i)=>x-b.start[i]))>2)).toBe(true);await page.screenshot({path:output+'/02-sentry-firing.png'});
    const shots=(await state(page)).sentry.current.shots;await tap(page,8);await expect(page.locator('dialog[open]')).toBeVisible();await page.screenshot({path:output+'/03-sentry-backpack.png'});
    await tap(page,1);await expect(page.locator('dialog[open]')).toBeVisible();expect((await state(page)).sentry.current.shots).toBe(shots);
    await neutral(page);await button(page,7,true);await tap(page,1);await expect(page.locator('dialog[open]')).toHaveCount(0);await page.waitForTimeout(650);expect((await state(page)).sentry.current.shots).toBe(shots);
    await button(page,7,false);await neutral(page);await button(page,7,true);await wait(page,shots=>starAgent.state.sentry.current.shots>shots,shots);
    await page.evaluate(()=>{sentryPad.connected=false;});await page.waitForTimeout(400);const stopped=(await state(page)).sentry.current.shots;
    await page.evaluate(()=>{sentryPad.connected=true;});await page.waitForTimeout(650);expect((await state(page)).sentry.current.shots).toBe(stopped);
    await neutral(page);await button(page,7,true);await wait(page,n=>starAgent.state.sentry.current.shots>n,stopped);await button(page,7,false);await stop(page);
    report.nativeFocus=await nativeFocusGate(page);
    const replace=(await state(page)).sentry.current.shots;await button(page,7,true);await page.evaluate(()=>sentryPad.id='Replacement standard controller');await page.waitForTimeout(600);const replaced=(await state(page)).sentry.current.shots;await page.waitForTimeout(350);expect((await state(page)).sentry.current.shots).toBe(replaced);
    await page.evaluate(()=>sentryPad.mapping='unsupported');await page.waitForTimeout(350);await page.evaluate(()=>sentryPad.mapping='standard');await page.waitForTimeout(350);expect((await state(page)).sentry.current.shots).toBe(replaced);report.device={before:replace,replaced};await neutral(page);
    await chase(page);await tap(page,2);await wait(page,()=>!starAgent.state.sentry.occupied,null,40000);
    await walk(page,await roverPoint(page,[-2.5,1.75,3.45]));await walk(page,await roverPoint(page,[0,1.75,3.45]));
    report.gunnerAccess=await board(page,'gunner');await page.screenshot({path:output+'/04-sentry-gunner-sight.png'});
    await axes(page,[0,0,-.45,.1]);await page.waitForTimeout(600);await neutral(page);const g=(await state(page)).sentry.current.shots;
    await button(page,7,true);await wait(page,n=>starAgent.state.sentry.current.shots>n,g);await button(page,7,false);await neutral(page);
    await tap(page,2);await wait(page,()=>!starAgent.state.sentry.occupied,null,40000);report.final=await state(page);expect([...errors]).toEqual([]);
  }finally{report.errors=[...errors];report.warnings=errors.warnings;report.requests=errors.requests;report.renderer=await rendererInfo(page).catch(()=>null);report.last=await state(page).catch(()=>null);await writeFile(output+'/controller-report.json',JSON.stringify(report,null,2));}
});

async function register(page,index,errors){
  await page.bringToFront();await pad(page);await boot(page,'/?dev=1&intro=0&start=hangar&debug=1',errors);
  await neutral(page);await tap(page,9);await choose(page,'tab-comms');await choose(page,'comms-account');
  await expect(page.locator('#multiplayer-account-dialog')).toBeVisible();
  await page.locator('[data-auth-view=register]').click();await page.locator('#mp-register-email').fill(`sentry-${Date.now()}-${index}@example.test`);
  await page.locator('#mp-register-callsign').fill('Sentry'+index);await page.locator('#mp-register-password').fill('Sentry-test-only-2026');
  await page.locator('[data-auth-form=register] button[type=submit]').click();await expect(page.locator('[data-account-callsign]')).toHaveText('Sentry'+index);
  await choose(page,'join-multiplayer');await wait(page,()=>starAgent.state.multiplayer.connected);await tap(page,1);await neutral(page);
}
const podPoint=(page,id,{x=10,y=1.75,z=-40}={})=>page.evaluate(({id,x,y,z})=>{
  const n=starAgent.navigation,pod=n.station.pods.find(p=>p.id===id),p=n.position.clone().set(x,pod.interiorBox.min.y+y,pod.openingZ+z);return pod.toWorld(p,p).toArray();
},{id,x,y,z});

test('two real connected players reach one rover physically and hand gunner authority back to its driving pilot',async({browser})=>{
  const a=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:output+'/video',size:{width:1280,height:800}}}),b=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:output+'/video',size:{width:1280,height:800}}}),pilot=await a.newPage(),gunner=await b.newPage(),errors=[],report={input:'Desktop account text; then injected standard Gamepad for deploy, physical station/EVA approach, both seats, drive/aim/fire/backpack/exit. No physical pad or debug pose writes.'};
  try{
    await register(pilot,1,errors);console.log('Sentry MP: pilot account connected');await register(gunner,2,errors);console.log('Sentry MP: both accounts connected');
    report.focus=await Promise.all([pilot,gunner].map(page=>page.evaluate(()=>({focused:document.hasFocus(),hidden:document.hidden}))));
    if(report.focus.some(p=>!p.focused||p.hidden)){report.focusEmulation=true;for(const page of [pilot,gunner]){const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true});await cdp.detach();}}
    await pilot.bringToFront();await neutral(pilot);await tap(pilot,9);await choose(pilot,'tab-ship');await choose(pilot,'sentry-deploy');await wait(pilot,()=>starAgent.state.sentry.vehicles.length===1);
    if(await pilot.locator('dialog[open]').count())await tap(pilot,1);
    const initial=await state(pilot),id=initial.sentry.vehicles[0].id,hangar=initial.multiplayer.hangar.id;
    console.log('Sentry MP: rover deployed; walking around aft-port corner');
    await walk(pilot,await roverPoint(pilot,[0,1.75,3.5],id));await walk(pilot,await roverPoint(pilot,[-2.5,1.75,3.5],id));await walk(pilot,await roverPoint(pilot,[-2.5,1.75,-.1],id));report.pilotAccess=await board(pilot,'pilot');console.log('Sentry MP: pilot physically seated');
    await gunner.bringToFront();await neutral(gunner);const own=(await state(gunner)).multiplayer.hangar.id;
    // Both berths open onto free space. Fly outside their actual doors, above
    // the station facade, then return through the pilot's physical hangar mouth.
    console.log('Sentry MP: walking out of gunner berth');await walk(gunner,await podPoint(gunner,own,{x:10,z:-12}),{timeout:60000});await wait(gunner,()=>starAgent.state.mode==='eva');
    await walk(gunner,await podPoint(gunner,own,{x:10,y:9,z:-45}),{eva:true,timeout:90000});
    console.log('Sentry MP: outside own berth, EVA to pilot berth');await walk(gunner,await podPoint(gunner,hangar,{x:10,y:9,z:-45}),{eva:true,timeout:90000});
    await walk(gunner,await podPoint(gunner,hangar,{x:10,z:5}),{eva:true,timeout:90000});await wait(gunner,()=>starAgent.state.mode==='walk');
    await walk(gunner,await roverPoint(gunner,[2.1,1.75,3.45],id));await walk(gunner,await roverPoint(gunner,[0,1.75,3.45],id));report.gunnerAccess=await board(gunner,'gunner');console.log('Sentry MP: gunner physically seated');
    await wait(pilot,()=>starAgent.state.sentry.current?.seats.gunner.phase==='seated');await neutral(pilot);await neutral(gunner);
    const before=(await state(pilot)).sentry.current;await button(pilot,7,true);await pageDelay(pilot,350);expect((await state(pilot)).sentry.current.shots).toBe(before.shots);
    await axes(gunner,[0,0,.65,-.12]);await axes(pilot,[0,-.22,0,0]);await button(gunner,7,true);
    await wait(gunner,n=>starAgent.state.sentry.current.shots>n,before.shots);await wait(pilot,n=>starAgent.state.sentry.current.distance>n+.4,before.distance);
    report.crewed={pilot:(await state(pilot)).sentry.current,gunner:(await state(gunner)).sentry.current};
    expect(report.crewed.pilot.controllerId).toBe((await state(gunner)).multiplayer.ownId);
    await chase(pilot);await pilot.screenshot({path:output+'/05-two-crew-driving.png'});await gunner.screenshot({path:output+'/06-two-crew-gunner.png'});
    await button(gunner,7,false);await neutral(gunner);await stop(pilot);await button(pilot,7,true);
    await tap(gunner,2);await wait(gunner,()=>!starAgent.state.sentry.occupied,null,45000);
    await wait(pilot,()=>!starAgent.state.sentry.current?.busy);const held=(await state(pilot)).sentry.current.shots;await pageDelay(pilot,600);expect((await state(pilot)).sentry.current.shots).toBe(held);
    await neutral(pilot);await button(pilot,7,true);await wait(pilot,n=>starAgent.state.sentry.current.shots>n,held);await button(pilot,7,false);
    console.log('Sentry MP: gunner exited; neutral pilot fallback fires');report.fallback=(await state(pilot)).sentry.current;await neutral(pilot);await tap(pilot,8);await expect(pilot.locator('#multiplayer-inventory-dialog')).toBeVisible();await tap(pilot,1);await neutral(pilot);
    await tap(pilot,2);await wait(pilot,()=>!starAgent.state.sentry.occupied,null,45000);expect([...errors]).toEqual([]);
  }finally{report.errors=[...errors];report.warnings=errors.warnings;report.requests=errors.requests;report.renderer=await rendererInfo(pilot).catch(()=>null);report.pilot=await state(pilot).catch(()=>null);report.gunner=await state(gunner).catch(()=>null);report.walks=await Promise.all([pilot,gunner].map(p=>p.evaluate(()=>window.sentryWalk).catch(()=>null)));await pilot.screenshot({path:output+'/last-pilot.png'}).catch(()=>{});await gunner.screenshot({path:output+'/last-gunner.png'}).catch(()=>{});await writeFile(output+'/multiplayer-report.json',JSON.stringify(report,null,2));await a.close();await b.close();}
});
const pageDelay=(page,ms)=>page.waitForTimeout(ms);

test('keyboard and native phone controls board, aim, fire and leave the Sentry',async({browser})=>{
  const report={input:'Keyboard events and native Chromium touchscreen contacts. No Gamepad injected.'},errors=[];
  for(const mobile of [false,true]){
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,recordVideo:{dir:output+'/video',size:mobile?{width:390,height:844}:{width:1440,height:900}}}),page=await context.newPage();
    try{
      await boot(page,'/?dev=1&intro=0&ship=nomad&start=sentry-surface&debug=1',errors);
      if(await page.locator('#multiplayer-account-dialog').isVisible()){const b=page.locator('[data-controller-key="account-continue"]');if(mobile)await b.tap();else await b.click();}
      await wait(page,()=>starAgent.state.sentry.near?.role==='pilot'&&!starAgent.state.transiting,null,120000);
      if(mobile)await page.locator('#sentry-panel [data-action="entry"]').tap();else await page.keyboard.press('KeyF');
      await wait(page,()=>starAgent.state.sentry.current?.seats.pilot.phase==='seated',null,40000);await page.waitForTimeout(350);
      let touch;
      if(mobile){
        const cdp=await context.newCDPSession(page),button=page.locator('#sentry-panel [data-hold="fire"]'),box=await button.boundingBox();expect(box).not.toBeNull();expect(box.x+box.width).toBeLessThanOrEqual(391);expect(box.y+box.height).toBeLessThanOrEqual(845);
        const aim=await page.locator('#sentry-panel [data-hold="aimLeft"]').boundingBox(),before=(await state(page)).sentry.current.yaw;
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:aim.x+aim.width/2,y:aim.y+aim.height/2,id:1}]});await wait(page,n=>Math.abs(starAgent.state.sentry.current.yaw-n)>.12,before);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        const point={x:box.x+box.width/2,y:box.y+box.height/2,id:1};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});touch={cdp};
      }else{await page.keyboard.down('ArrowLeft');await page.waitForTimeout(300);await page.keyboard.up('ArrowLeft');await page.keyboard.down('KeyT');}
      await wait(page,()=>starAgent.state.sentry.current.shots>0);await page.screenshot({path:output+(mobile?'/08-sentry-native-phone.png':'/07-sentry-keyboard.png')});
      if(mobile){await touch.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.cdp.detach();await page.locator('#sentry-panel [data-action="entry"]').tap();}else{await page.keyboard.up('KeyT');await page.keyboard.press('KeyF');}
      await wait(page,()=>!starAgent.state.sentry.occupied,null,40000);report[mobile?'phone':'keyboard']={state:await state(page),renderer:await rendererInfo(page)};
    }finally{report[mobile?'phoneLast':'keyboardLast']=await state(page).catch(()=>null);report.errors=[...errors];report.warnings=errors.warnings;report.requests=errors.requests;await writeFile(output+'/native-input-report.json',JSON.stringify(report,null,2));await context.close();}
  }
  report.errors=[...errors];report.warnings=errors.warnings;report.requests=errors.requests;await writeFile(output+'/native-input-report.json',JSON.stringify(report,null,2));expect([...errors]).toEqual([]);
});

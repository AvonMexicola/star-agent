import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.SHIP_WEAPONS_OUTPUT??'/tmp/star-agent-ship-weapons';
const frames=page=>page.evaluate(async()=>{for(let i=0;i<6;i++)await new Promise(r=>requestAnimationFrame(r));});
for(const [ship,size,count] of [['nomad',1,2],['kestrel',2,4],['atlas',3,3]])test(ship+' fitted weapons, keyboard and touch firing and actual hull views',async({page,browser})=>{
  await mkdir(out,{recursive:true});const errors=[],warnings=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
  await page.goto('/?dev=1&ship='+ship+'&start=orbit&intro=0&debug&seed=7291');
  await page.waitForFunction(()=>window.starAgent?.state.ready&&starAgent.state.enabled&&!starAgent.state.transiting&&starAgent.state.effects.armament?.status==='ready',null,{timeout:90000});
  let state=await page.evaluate(()=>starAgent.state);
  expect(state.effects.armament.size).toBe(size);expect(state.hardpoints.length).toBe(count);
  if(state.landingGear.target)await page.keyboard.press('g');
  await page.waitForFunction(()=>starAgent.state.landingGear.progress<.001);
  await page.keyboard.press('4');
  for(const [key,type] of [['1','pulse'],['2','laser'],['3','void']]){
    await page.keyboard.press(key);await frames(page);
    const before=await page.evaluate(()=>starAgent.state.effects.armament.shots);
    await page.keyboard.down('t');
    await page.waitForFunction(before=>starAgent.state.effects.armament.shots>before,before);
    await page.screenshot({path:out+'/'+ship+'-'+type+'-flight.png'});await page.keyboard.up('t');
    state=await page.evaluate(()=>starAgent.state);
    expect(state.effects.armament.lastShot.type).toBe(type);expect(state.effects.armament.lastShot.size).toBe(size);
    expect(state.hardpoints.every(m=>m.installedWeapon===type+'-s'+size)).toBe(true);
  }
  // Gear transition interlock: held inputs cannot replay when the gear becomes safe.
  await page.keyboard.press('g');await frames(page);
  const held=await page.evaluate(()=>starAgent.state.effects.armament.shots);
  await page.keyboard.down('t');await frames(page);expect(await page.evaluate(()=>starAgent.state.effects.armament.shots)).toBe(held);
  await page.keyboard.up('t');await page.waitForFunction(()=>starAgent.state.landingGear.progress>.999);await page.keyboard.press('g');await page.waitForFunction(()=>starAgent.state.landingGear.progress<.001);
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-ship-weapon="pulse"]').click();await page.locator('.ship-trigger').hover();await page.mouse.down();
  await page.waitForFunction(held=>starAgent.state.effects.armament.shots>held,held);await page.mouse.up();
  await page.screenshot({path:out+'/'+ship+'-phone.png'});
  expect(await page.locator('#ship-weapons').evaluate(e=>e.getBoundingClientRect().right<=innerWidth+1)).toBe(true);
  await page.setViewportSize({width:1440,height:900});
  // Controlled external inspection, separate from the input journey above.
  await page.keyboard.press('4');
  await page.evaluate(()=>{
    const n=starAgent.navigation;
    n.shipPosition=n.position.clone().sub(n.position.clone().fromArray(n.layout.seatEye).applyQuaternion(n.orientation));n.shipOrientation.copy(n.orientation);
    n.mode='walk';n.enabled=false;n.velocity.set(0,0,0);starAgent.setRenderScale(1);
    const scale=n.shipId==='atlas'?2.2:1;
    n.position.copy(n.shipPosition).add(n.position.clone().set(-12*scale,7*scale,-17*scale).applyQuaternion(n.shipOrientation));
    n.orientToward(n.shipPosition.clone().add(n.position.clone().set(0,2*scale,-1).applyQuaternion(n.shipOrientation)),n.normal.clone().set(0,1,0).applyQuaternion(n.shipOrientation));
    document.querySelectorAll('body > :not(canvas):not(script)').forEach(e=>e.style.visibility='hidden');
  });
  await frames(page);await page.screenshot({path:out+'/'+ship+'-quarter.png'});
  const backend=await page.evaluate(()=>{const gl=document.querySelector('#viewport').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
  await writeFile(out+'/'+ship+'.json',JSON.stringify({browser:browser.version(),backend,errors,warnings,state:await page.evaluate(()=>starAgent.state),physicalController:false},null,2));
  expect(errors).toEqual([]);expect(warnings).toEqual([]);
});

test('touch gestures select and hold fire on the fitted Atlas battery',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),page=await context.newPage();
 try{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
  await page.goto('http://127.0.0.1:5410/?dev=1&ship=atlas&start=orbit&intro=0&debug');
  await page.waitForFunction(()=>window.starAgent?.state.ready&&starAgent.state.enabled&&!starAgent.state.transiting&&starAgent.state.effects.armament?.status==='ready',null,{timeout:90000});
  await page.locator('[data-ship-weapon="void"]').tap();await page.waitForTimeout(160);
  const trigger=await page.locator('.ship-trigger').boundingBox(),cdp=await context.newCDPSession(page);
  const before=await page.evaluate(()=>starAgent.state.effects.armament.shots);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:trigger.x+trigger.width/2,y:trigger.y+trigger.height/2,id:1}]});
  await page.waitForFunction(before=>starAgent.state.effects.armament.shots>before,before);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.screenshot({path:out+'/atlas-touch.png'});
  const shots=await page.evaluate(()=>starAgent.state.effects.armament.shots);
  await page.waitForTimeout(1400);expect(await page.evaluate(()=>starAgent.state.effects.armament.shots)).toBe(shots);
  expect(await page.evaluate(()=>starAgent.state.effects.armament.lastShot)).toMatchObject({type:'void',size:3});expect(errors).toEqual([]);
 }finally{await context.close();}
});

test('Atlas Mark II studio carries three S3 guns with its aft bore preserved',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});
 await page.goto('/dev/atlas-mark-ii.html');await page.waitForFunction(()=>window.atlasMarkIIStudio?.model?.armament?.status==='ready');
 const state=await page.evaluate(()=>{const arm=atlasMarkIIStudio.model.armament;return {state:arm.state,bores:arm.state.mounts.map((m,i)=>({name:m.node,direction:arm.muzzle(i,{local:true}).direction.toArray()}))};});
 expect(state.state.size).toBe(3);expect(state.state.mounts.length).toBe(3);
 expect(state.bores.find(b=>b.name==='Mount_S3_Aft').direction[2]).toBeCloseTo(1,5);
 await page.evaluate(()=>atlasMarkIIStudio.view('mounts',true));await frames(page);await page.screenshot({path:out+'/atlas-mark-ii-mounts.png'});expect(errors).toEqual([]);
});

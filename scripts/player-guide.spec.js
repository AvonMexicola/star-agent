import {test,expect} from '@playwright/test';
import {TouchInput,installNativeReceipts} from './stratum-primary-inputs.js';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.GUIDE_OUT;
const frames=page=>page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus)await writeFile(`${out}/failure-state.json`,JSON.stringify(await page.evaluate(()=>starAgent.state).catch(e=>({error:e.message})),null,2));});
for(const controller of [false,true])test(`${controller?'controller':'keyboard'} follows the opening guide through boarding, departure and choosing a journey`,async({page,browser})=>{
  const folder=`${out}/${controller?'controller':'keyboard'}`;await mkdir(folder,{recursive:true});
  const errors=[],steps=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  if(controller)await page.addInitScript(()=>{
    window.guidePad={id:'Flight guide standard Gamepad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    Object.defineProperty(navigator,'getGamepads',{value:()=>[window.guidePad]});
  });
  await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
  const button=async(i,down)=>{await page.evaluate(({i,down})=>guidePad.buttons[i]={pressed:down,value:+down},{i,down});await frames(page);};
  const tap=async i=>{await button(i,true);await button(i,false);};
  const held=async(key,down)=>{
    if(!controller)return page.keyboard[down?'down':'up'](key);
    await page.evaluate(({key,down})=>{const axis=['a','d'].includes(key)?0:1;guidePad.axes[axis]=down?(['w','a'].includes(key)?-1:1):0;},{key,down});
  };
  const move=async(key,predicate)=>{await held(key,true);try{await page.waitForFunction(predicate,null,{timeout:60000});}finally{await held(key,false);}await frames(page);};
  const interact=async()=>{if(controller)await tap(2);else await page.keyboard.press('f');await frames(page);};
  const check=async id=>{await expect(page.locator('#player-guide')).toHaveAttribute('data-step',id);await expect(page.locator('#player-guide')).toBeVisible();steps.push({id,text:await page.locator('#player-guide').innerText()});};
  const choose=async key=>{
    await expect(page.locator(`dialog[open] [data-controller-key="${key}"]`)).toBeVisible();
    for(let i=0;i<100;i++){
      if(await page.evaluate(k=>document.activeElement?.dataset.controllerKey===k,key)){if(controller)await tap(0);else await page.keyboard.press('Enter');await frames(page);return;}
      if(controller)await tap(13);else await page.keyboard.press('Tab');
    }
    throw Error('Could not reach '+key);
  };
  await page.goto('/?seed=7291&intro=1&debug');
  await page.waitForFunction(()=>starAgent?.state.ready&&starAgent.state.opening.phase==='cinematic',null,{timeout:120000});
  await expect(page.locator('#loading')).toHaveClass(/hidden/);await expect(page.locator('#loading')).toHaveCSS('opacity','0');
  await held('w',true);await page.waitForFunction(()=>starAgent.state.opening.phase==='playing');await held('w',false);await frames(page);
  await check('find-hatch');await page.screenshot({path:`${folder}/01-find-hatch.png`});
  // Walk around the starboard wing and aft engines, with actual movement only.
  await move('d',()=>starAgent.state.shipLocal[0]>6.7);
  await move('s',()=>starAgent.state.shipLocal[2]>7.8);
  await move('a',()=>starAgent.state.shipLocal[0]<.6);
  await move('w',()=>starAgent.state.shipLocal[2]<5.5);
  await check('open-hatch');await interact();await page.waitForFunction(()=>starAgent.state.doorProgress===1);
  await check('board-ramp');await move('w',()=>starAgent.state.shipLocal[2]<3.1);
  await check('close-hatch');await expect(page.locator('#state-text')).toContainText('CLOSE HATCH');await page.screenshot({path:`${folder}/02-close-hatch.png`});await interact();await page.waitForFunction(()=>starAgent.state.doorProgress===0);
  await check('find-seat');await move('w',()=>starAgent.state.shipLocal[2]<-1.5);await check('sit');await interact();
  await check('launch');await page.screenshot({path:`${folder}/03-launch.png`});
  if(controller)await tap(3);else await page.keyboard.press('b');
  await page.waitForFunction(()=>starAgent.state.mode==='flight'&&!starAgent.state.station.lifting);
  await check('retract-gear');await expect(page.locator('#state-text')).toContainText('DEPARTURE');
  await expect(page.locator('#state-text')).not.toContainText('DOCK ON DECK');
  if(controller){await button(4,true);await button(5,true);await tap(13);await button(5,false);await button(4,false);}else await page.keyboard.press('g');
  await page.waitForFunction(()=>starAgent.state.landingGear.progress===0);await check('leave-bay');
  await move('w',()=>starAgent.state.station.distance>550);
  if(controller)await button(6,true);else await page.keyboard.down('x');
  await page.waitForFunction(()=>starAgent.state.speed<.2);
  if(controller)await button(6,false);else await page.keyboard.up('x');
  await check('choose');await expect(page.locator('#navigation-lock span')).toBeHidden();await page.screenshot({path:`${folder}/04-choose.png`});
  if(!controller){
    await page.setViewportSize({width:390,height:844});await frames(page);await page.screenshot({path:`${folder}/05-phone.png`});
    const box=await page.locator('#player-guide').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390);
    await page.setViewportSize({width:1440,height:900});
    await page.keyboard.press('Shift+Tab');await expect(page.locator('body')).toHaveAttribute('data-hud-mode','markers');await expect(page.locator('#player-guide')).toBeHidden();
    await page.keyboard.press('Shift+Tab');await page.keyboard.press('Shift+Tab');await check('choose');
  }
  if(controller)await tap(9);else await page.keyboard.press('Tab');
  await expect(page.locator('#patrol-console')).toBeVisible();await expect(page.locator('#player-guide')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-hud-mode','full');
  await choose('patrol-accept');
  await page.waitForFunction(()=>starAgent.state.combat.phase==='transit');
  // Held movement on closing the menu is suppressed for controller until neutral.
  if(controller){await held('w',true);await tap(1);expect(await page.evaluate(()=>starAgent.state.controller.armed)).toBe(false);await held('w',false);await page.waitForFunction(()=>starAgent.state.controller.armed);}else await page.keyboard.press('Escape');
  await check('manual-approach');await page.screenshot({path:`${folder}/06-contract.png`});
  if(controller)await tap(9);else await page.keyboard.press('Tab');await choose('patrol-abort');
  if(controller)await tap(1);else await page.keyboard.press('Escape');await frames(page);
  if(controller)await tap(14);else await page.keyboard.press('m');
  await expect(page.locator('#system-map')).toBeVisible();
  await choose('map-body-aeon');await choose('map-view-locations');await choose('map-signal-site-coast');
  if(controller)await tap(1);else await page.keyboard.press('Escape');await frames(page);
  const destinationStep=await page.locator('#player-guide').getAttribute('data-step');expect(['aim','clear-route','charge','engage']).toContain(destinationStep);await check(destinationStep);expect(await page.locator('#player-guide').innerText()).toContain('Coastal landing');
  await page.screenshot({path:`${folder}/07-destination.png`});
  if(controller)await tap(9);else await page.keyboard.press('Escape');await choose('tab-settings');await choose('player-guide');
  if(controller)await tap(1);else await page.keyboard.press('Escape');await expect(page.locator('#player-guide')).toBeHidden();
  await page.waitForFunction(()=>starAgent.state.enabled&&!document.querySelector('dialog[open]'));await frames(page);
  if(controller)await tap(9);else await page.keyboard.press('Escape');await choose('player-guide');
  if(controller)await tap(1);else await page.keyboard.press('Escape');await expect(page.locator('#player-guide')).toBeVisible();
  // Already facing the coastal signal after leaving the default hangar. Clear
  // the real station exclusion zone, charge and engage with normal input.
  await move('w',()=>starAgent.state.station.distance>3500);
  for(let i=0;i<400;i++){
    const bearing=await page.evaluate(()=>{const n=starAgent.navigation,t=starAgent.state.navigationTargets.targets.find(t=>t.id==='site-coast'),p=n.viewPoint(n.position.clone().fromArray(t.center)).sub(n.position).applyQuaternion(n.orientation.clone().invert());return {x:Math.atan2(p.x,-p.z),y:-Math.atan2(p.y,Math.hypot(p.x,p.z)),ready:starAgent.state.navigationTargets.ready};});
    if(controller)await page.evaluate(b=>{const v=x=>Math.abs(x)<.008?0:Math.sign(x)*Math.max(.24,Math.min(.6,Math.abs(x)*1.8));guidePad.axes[2]=v(b.x);guidePad.axes[3]=v(b.y);},bearing);
    else for(const [key,down] of [['ArrowRight',bearing.x>.018],['ArrowLeft',bearing.x<-.018],['ArrowDown',bearing.y>.018],['ArrowUp',bearing.y<-.018]])await page.keyboard[down?'down':'up'](key);
    if(bearing.ready&&Math.hypot(bearing.x,bearing.y)<.025)break;await page.waitForTimeout(50);
  }
  if(controller)await page.evaluate(()=>{guidePad.axes[2]=0;guidePad.axes[3]=0;});else for(const key of ['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'])await page.keyboard.up(key);
  await page.waitForFunction(()=>starAgent.state.navigationTargets.ready,null,{timeout:15000});await check('engage');
  if(controller){await button(4,true);await button(5,true);await tap(12);await button(5,false);await button(4,false);}else await page.keyboard.press('n');
  await check('travel');await page.waitForFunction(()=>!starAgent.state.travel,null,{timeout:90000});
  await check('landing-gear');
  if(controller){await button(4,true);await button(5,true);await tap(13);await button(5,false);await button(4,false);}else await page.keyboard.press('g');
  await check('descend');await expect(page.locator('#navigation-lock span')).toBeHidden();await expect(page.locator('#navigation-lock strong')).toContainText('Coastal landing');await page.screenshot({path:`${folder}/08-arrival.png`});
  if(controller){
    // The guide shares the existing focus/device neutral gates; holding a stick
    // cannot resume movement merely by reconnecting or returning to the view.
    await held('w',true);await page.waitForFunction(()=>starAgent.state.speed>1);
    await page.evaluate(()=>{guidePad.connected=false;});await page.waitForFunction(()=>!starAgent.state.controller.connected);
    await page.evaluate(()=>{guidePad.connected=true;});await frames(page);expect(await page.evaluate(()=>starAgent.state.controller.armed)).toBe(false);
    await held('w',false);await page.waitForFunction(()=>starAgent.state.controller.armed);
    const blank=await page.context().newPage(),gameSession=await page.context().newCDPSession(page),otherSession=await page.context().newCDPSession(blank);
    try{
      await blank.goto('about:blank');await gameSession.send('Emulation.setFocusEmulationEnabled',{enabled:false});await otherSession.send('Emulation.setFocusEmulationEnabled',{enabled:false});
      await page.bringToFront();await page.waitForFunction(()=>document.hasFocus()&&starAgent.state.focused&&starAgent.state.controller.armed);
      await held('w',true);await frames(page);await blank.bringToFront();await page.waitForFunction(()=>!document.hasFocus()&&!starAgent.state.focused);await expect(page.locator('#player-guide')).toBeHidden();
      await page.bringToFront();await page.waitForFunction(()=>document.hasFocus()&&starAgent.state.focused);expect(await page.evaluate(()=>starAgent.state.controller.armed)).toBe(false);
      await held('w',false);await page.waitForFunction(()=>starAgent.state.controller.armed);await check('descend');
    }finally{await blank.close();}
  }
  const renderer=await page.evaluate(()=>{const gl=document.querySelector('#viewport').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'unknown';});
  await writeFile(`${folder}/receipt.json`,JSON.stringify({browser:browser.version(),renderer,steps,errors,input:controller?'Injected standard Gamepad; no physical-device test':'Native keyboard; no gameplay state mutation'},null,2));expect(errors).toEqual([]);
});

test.describe('touch guidance',()=>{
  test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  test('touch follows the physical Nomad opening and can launch, retract gear and choose contracts',async({page,browser})=>{
    const folder=`${out}/touch`;await mkdir(folder,{recursive:true});const steps=[],errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await installNativeReceipts(page);await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
    const input=new TouchInput(page,await page.context().newCDPSession(page));
    const check=async id=>{await expect(page.locator('#player-guide')).toHaveAttribute('data-step',id);await expect(page.locator('#player-guide')).toBeVisible();steps.push({id,text:await page.locator('#player-guide').innerText()});};
    const move=async(action,predicate)=>{await input.hold([action]);try{await page.waitForFunction(predicate,null,{timeout:60000});}finally{await input.reset();}};
    await page.goto('/?seed=7291&intro=1&debug');
    await page.waitForFunction(()=>starAgent?.state.ready&&starAgent.state.opening.phase==='cinematic',null,{timeout:120000});
    await expect(page.locator('#loading')).toHaveCSS('opacity','0');await page.touchscreen.tap(195,430);
    await page.waitForFunction(()=>starAgent.state.opening.phase==='playing');await check('find-hatch');
    await expect(page.locator('#player-guide')).toContainText('walking arrows');
    await page.screenshot({path:`${folder}/01-walking.png`});
    await move('right',()=>starAgent.state.shipLocal[0]>6.7);await move('backward',()=>starAgent.state.shipLocal[2]>7.8);
    await move('left',()=>starAgent.state.shipLocal[0]<.6);await move('forward',()=>starAgent.state.shipLocal[2]<5.5);
    await check('open-hatch');await input.tap('interact');await page.waitForFunction(()=>starAgent.state.doorProgress===1);
    await move('forward',()=>starAgent.state.shipLocal[2]<3.1);await check('close-hatch');await input.tap('interact');await page.waitForFunction(()=>starAgent.state.doorProgress===0);
    await move('forward',()=>starAgent.state.shipLocal[2]<-1.5);await check('sit');await input.tap('interact');
    await check('launch');await expect(page.locator('#player-guide')).toContainText('Tap Launch');await page.screenshot({path:`${folder}/02-launch.png`});
    await input.tap('land');await page.waitForFunction(()=>starAgent.state.mode==='flight'&&!starAgent.state.station.lifting);
    await check('retract-gear');await input.tap('commands');await input.choose('tab-ship');await input.choose('gear');await page.waitForFunction(()=>starAgent.state.enabled&&!document.querySelector('dialog[open]'));
    await page.waitForFunction(()=>starAgent.state.landingGear.progress===0);await check('leave-bay');
    await move('forward',()=>starAgent.state.station.distance>550);await move('brake',()=>starAgent.state.speed<.2);
    await check('choose');await expect(page.locator('#player-guide')).toContainText('Commands → Map');await page.screenshot({path:`${folder}/03-choose.png`});
    await input.tap('commands');await input.choose('tab-contracts');await input.choose('patrol-accept');await page.waitForFunction(()=>starAgent.state.combat.phase==='transit');await input.choose('gameplay-resume');
    await check('manual-approach');await page.screenshot({path:`${folder}/04-contract.png`});
    const events=await page.evaluate(()=>({events:__stratumPrimary.events,keys:__stratumPrimary.keys,position:starAgent.state.position}));
    expect(events.keys).toEqual([]);expect(events.events.every(e=>e.trusted)).toBe(true);expect(errors).toEqual([]);
    await writeFile(`${folder}/receipt.json`,JSON.stringify({browser:browser.version(),steps,errors,input:'Native CDP touch contacts; no keyboard or gameplay state mutation',...events},null,2));
  });
});

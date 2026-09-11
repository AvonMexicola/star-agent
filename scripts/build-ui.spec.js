import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test('paused-door interaction text wraps inside a phone viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/scripts/fixtures/build-ui.html');await page.waitForFunction(()=>window.fixture);
  // Shared HUD markup with the actual longest door-state copy; this isolates
  // text layout from the separately exercised moving-door collision route.
  await page.evaluate(()=>{document.body.classList.add('exploring');const chip=document.createElement('div');chip.id='flight-state';chip.className='base-target';chip.innerHTML='<span id="state-icon">◇</span><span id="state-text">F / X · Closing paused · step clear · Open base door</span>';document.body.append(chip);});
  const bounds=await page.locator('#state-text').evaluate(el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,height:b.height};});
  expect(bounds.left).toBeGreaterThanOrEqual(16);expect(bounds.right).toBeLessThanOrEqual(374);expect(bounds.height).toBeGreaterThan(16);
  await mkdir('/tmp/star-agent-build-ui',{recursive:true});await page.screenshot({path:'/tmp/star-agent-build-ui/paused-door-phone.png'});
});
const tap=async(page,id)=>{await page.evaluate(id=>window.pad.buttons[id]={pressed:true,value:1},id);await page.waitForFunction(id=>window.fixture.nav.gamepad.previous[id],id);await page.evaluate(id=>window.pad.buttons[id]={pressed:false,value:0},id);await page.waitForFunction(id=>!window.fixture.nav.gamepad.previous[id],id);};
async function focus(page,key){for(let i=0;i<35;i++){if(await page.locator(`[data-controller-key="${key}"]`).evaluate(el=>el===document.activeElement))return;await tap(page,13);}throw Error(`Cannot focus ${key}`);}
test('construction dialogs share controller focus, recipe transactions and held-trigger suppression',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/scripts/fixtures/build-ui.html');await page.waitForFunction(()=>window.fixture?.nav.gamepad.armed);
  await tap(page,9);await focus(page,'build');await tap(page,0);await expect(page.locator('#build-dialog')).toBeVisible();
  await focus(page,'build-tab-recipes');await tap(page,0);await focus(page,'recipe-aggregate');await tap(page,0);
  expect(await page.evaluate(()=>window.fixture.store.container('pack').items.aggregate)).toBe(1);
  await expect(page.locator('[data-controller-key="recipe-aggregate"]')).toBeFocused();
  await expect(page.locator('.build-feedback')).toContainText('completed');
  await mkdir('/tmp/star-agent-build-ui',{recursive:true});await page.screenshot({path:'/tmp/star-agent-build-ui/recipes-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/star-agent-build-ui/recipes-phone.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const beforeScroll=await page.locator('.build-content').evaluate(el=>el.scrollTop);
  await page.evaluate(()=>window.pad.axes=[0,0,0,1]);
  await page.waitForFunction(before=>document.querySelector('.build-content').scrollTop>before+80,beforeScroll);
  await page.evaluate(()=>window.pad.axes=[0,0,0,0]);
  await expect(page.locator('[data-controller-key="recipe-aggregate"]')).toBeFocused();
  await expect(page.locator('[data-controller-key="build-close"]')).toBeInViewport();
  await focus(page,'build-tab-pieces');await tap(page,0);await focus(page,'build-piece-mainframe');await tap(page,0);await expect(page.locator('#build-dialog')).not.toBeVisible();
  await page.screenshot({path:'/tmp/star-agent-build-ui/placement-phone.png'});
  expect(await page.locator('#build-hud').evaluate(el=>el.getBoundingClientRect().top>innerHeight/2)).toBe(true);
  await expect(page.locator('#fleet-button')).not.toBeVisible();await expect(page.locator('#keyboard-hints')).not.toBeVisible();
  await page.waitForFunction(()=>window.fixture.nav.gamepad.armed);await tap(page,0);expect(await page.evaluate(()=>window.fixture.build.state.pieceCount)).toBe(1);
  await tap(page,1);await expect(page.locator('#build-dialog')).toBeVisible();await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);
  // Cancel wins when A+B arrive together; held A cannot place after the close.
  await page.evaluate(()=>{window.pad.buttons[0]={pressed:true,value:1};window.pad.buttons[1]={pressed:true,value:1};});await expect(page.locator('#build-dialog')).not.toBeVisible();
  await page.evaluate(()=>window.pad.buttons[1]={pressed:false,value:0});await page.waitForTimeout(160);expect(await page.evaluate(()=>window.fixture.build.state.pieceCount)).toBe(1);
  await page.evaluate(()=>window.pad.buttons[0]={pressed:false,value:0});await page.waitForFunction(()=>window.fixture.nav.gamepad.armed);await tap(page,2);expect(await page.evaluate(()=>window.fixture.build.active)).toBe(false);expect(errors).toEqual([]);

});

test('keyboard entry and touch placement use the same build actions',async({page})=>{
  await page.goto('/scripts/fixtures/build-ui.html');await page.waitForFunction(()=>window.fixture?.nav.gamepad.armed);
  await page.evaluate(()=>window.fixture.nav.openingActive=true);await page.keyboard.press('b');await expect(page.locator('#build-dialog')).not.toBeVisible();await expect(page.locator('#build-shortcut')).not.toBeVisible();
  await page.evaluate(()=>window.fixture.nav.openingActive=false);await page.keyboard.press('b');await expect(page.locator('#build-dialog')).toBeVisible();
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});
  const piece=await page.locator('[data-controller-key="build-piece-crate"]').boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:piece.x+piece.width/2,y:piece.y+piece.height/2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(page.locator('#build-hud')).toBeVisible();await page.waitForFunction(()=>window.fixture.nav.enabled);
  await page.keyboard.press('Enter');expect(await page.evaluate(()=>window.fixture.build.state.pieceCount)).toBe(1);

  const target=await page.locator('[data-controller-key="build-hud-place"]').boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:target.x+target.width/2,y:target.y+target.height/2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect(await page.evaluate(()=>window.fixture.build.state.pieceCount)).toBe(2);
  await page.keyboard.press('Escape');expect(await page.evaluate(()=>window.fixture.build.active)).toBe(false);
  await page.locator('#build-shortcut').click();await expect(page.locator('#build-dialog')).toBeVisible();
});

test('mainframe storage handoff keeps gameplay paused until storage closes',async({page})=>{
  await page.goto('/scripts/fixtures/build-ui.html');await page.waitForFunction(()=>window.fixture?.nav.gamepad.armed);
  await page.evaluate(()=>window.fixture.ui.openMainframe({id:'fixture-core',name:'Test outpost',body:'aeon',radius:64,pieces:[],bufferId:'ship'}));
  await expect(page.locator('.build-overview')).toContainText('Aeon');
  await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);await focus(page,'build-supplies');await tap(page,0);
  await expect(page.locator('#fixture-storage')).toBeVisible();expect(await page.evaluate(()=>window.fixture.nav.enabled)).toBe(false);
  await tap(page,1);await expect(page.locator('#fixture-storage')).not.toBeVisible();await page.waitForFunction(()=>window.fixture.nav.enabled);
});

test('recipe output-slot failures are visible and cannot spend ingredients',async({page})=>{
  await page.goto('/scripts/fixtures/build-ui.html');await page.waitForFunction(()=>window.fixture?.nav.gamepad.armed);
  // A full, valid eight-slot pack: converting part of the basalt stack would
  // require a ninth slot for aggregate even though the batch conserves mass.
  const before=await page.evaluate(()=>{const s=window.fixture.store,items={...Object.fromEntries(Object.keys(s.container('pack').items).map(id=>[id,0])),basalt:4,copper:1,ice:1,'mineral-binder':1,'metal-stock':1,conductor:1,glass:1,ration:2};if(!s.write(s.withItems(s.state,'pack',items)))throw Error(s.warning);return items;});
  await tap(page,9);await focus(page,'recipes');await tap(page,0);
  const action=page.locator('[data-controller-key="recipe-aggregate"]');await expect(action).toBeDisabled();await expect(action.locator('..')).toContainText('Output container lacks mass capacity or stack slots.');
  expect(await page.evaluate(()=>window.fixture.store.container('pack').items)).toEqual(before);
  await focus(page,'recipe-batch-max');await tap(page,0);await expect(action).toHaveText('Process 4 × Crush aggregate');await expect(action).toBeEnabled();
  await focus(page,'recipe-aggregate');await tap(page,0);expect(await page.evaluate(()=>window.fixture.store.container('pack').items.aggregate)).toBe(4);
});

test('radial stick selection covers eight pieces and preserves highlight at rest',async({page})=>{
  await page.goto('/scripts/fixtures/build-ui.html');await page.waitForFunction(()=>window.fixture?.nav.gamepad.armed);
  await tap(page,9);await focus(page,'build');await tap(page,0);await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);
  const ids=['foundation','wall','doorway','window','floor','stairs','crate','mainframe'];
  for(let i=0;i<ids.length;i++){
    const a=i*Math.PI/4;await page.evaluate(a=>window.pad.axes=[Math.sin(a),-Math.cos(a),0,0],a);
    await expect(page.locator('.build-wheel')).toHaveAttribute('data-selected',ids[i]);await expect(page.locator(`[data-controller-key="build-piece-${ids[i]}"]`)).toBeFocused();
  }
  await page.evaluate(()=>window.pad.axes=[0,0,0,0]);await page.waitForTimeout(100);await expect(page.locator('.build-wheel')).toHaveAttribute('data-selected','mainframe');
  await mkdir('/tmp/star-agent-build-radial',{recursive:true});await page.screenshot({path:'/tmp/star-agent-build-radial/wheel-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/star-agent-build-radial/wheel-phone.png'});
  for(const id of ids){const b=page.locator(`[data-controller-key="build-piece-${id}"]`);await expect(b).toBeInViewport();const bounds=await b.boundingBox();expect(bounds.width).toBeGreaterThanOrEqual(44);expect(bounds.height).toBeGreaterThanOrEqual(44);}
  await tap(page,0);await expect(page.locator('#build-dialog')).not.toBeVisible();expect(await page.evaluate(()=>window.fixture.build.state.pieceId)).toBe('mainframe');
  expect(await page.evaluate(()=>window.fixture.build.state.pieceCount)).toBe(0);
  await page.waitForFunction(()=>window.fixture.nav.gamepad.armed);await tap(page,1);await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);
  await expect(page.locator('.build-wheel')).toHaveAttribute('data-selected','mainframe');await tap(page,1);await expect(page.locator('#build-dialog')).not.toBeVisible();expect(await page.evaluate(()=>window.fixture.build.state.pieceCount)).toBe(0);
});

test('radial ignores held selection through focus loss, disconnect and replacement',async({page})=>{
  await page.goto('/scripts/fixtures/build-ui.html');await page.waitForFunction(()=>window.fixture?.nav.gamepad.armed);await page.keyboard.press('b');await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);
  await page.evaluate(()=>{window.fixture.nav.focused=false;window.pad.axes=[1,0,0,0];window.pad.buttons[0]={pressed:true,value:1};});await page.waitForTimeout(80);
  await page.evaluate(()=>window.fixture.nav.focused=true);await page.waitForTimeout(80);await expect(page.locator('#build-dialog')).toBeVisible();await expect(page.locator('.build-wheel')).toHaveAttribute('data-selected','mainframe');
  await page.evaluate(()=>{window.pad.axes.fill(0);window.pad.buttons[0]={pressed:false,value:0};});await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);
  await page.evaluate(()=>window.pad.connected=false);await page.waitForFunction(()=>!window.fixture.nav.gamepad.connected);
  await page.evaluate(()=>{window.pad.connected=true;window.pad.axes=[1,0,0,0];window.pad.buttons[0]={pressed:true,value:1};});await page.waitForTimeout(80);await expect(page.locator('#build-dialog')).toBeVisible();
  await page.evaluate(()=>window.pad.id='Replacement radial controller');await page.waitForTimeout(80);await expect(page.locator('#build-dialog')).toBeVisible();
  await page.evaluate(()=>{window.pad.axes.fill(0);window.pad.buttons[0]={pressed:false,value:0};});await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);
  await page.evaluate(()=>window.pad.axes=[1,0,0,0]);await expect(page.locator('.build-wheel')).toHaveAttribute('data-selected','doorway');await tap(page,0);await expect(page.locator('#build-dialog')).not.toBeVisible();expect(await page.evaluate(()=>window.fixture.build.state.pieceId)).toBe('doorway');expect(await page.evaluate(()=>window.fixture.build.state.pieceCount)).toBe(0);
});

test('B enters near a mainframe and build hotkeys stay separate from ship and EVA controls',async({page})=>{
  test.setTimeout(30000);
  await page.goto('/scripts/fixtures/build-ui.html');await page.waitForFunction(()=>window.fixture?.nav.gamepad.armed);
  await tap(page,1);await expect(page.locator('#build-dialog')).toBeVisible();await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);
  await page.evaluate(()=>window.pad.axes=[1,0,0,0]);await expect(page.locator('.build-wheel')).toHaveAttribute('data-selected','doorway');await tap(page,0);await page.evaluate(()=>window.pad.axes.fill(0));await page.waitForFunction(()=>window.fixture.nav.gamepad.armed);
  await tap(page,6);expect(await page.evaluate(()=>window.fixture.build.state.rotations)).toBe(-1);
  await tap(page,7);expect(await page.evaluate(()=>window.fixture.build.state.rotations)).toBe(0);
  await tap(page,4);expect(await page.evaluate(()=>window.fixture.build.state.snaps)).toBe(1);
  await page.evaluate(()=>window.pad.buttons[0]={pressed:true,value:1});await page.waitForFunction(()=>window.fixture.build.state.pieceCount===1);await page.waitForTimeout(100);expect(await page.evaluate(()=>window.fixture.lastPad.jump)).toBe(false);expect(await page.evaluate(()=>window.fixture.build.state.pieceCount)).toBe(1);
  await page.evaluate(()=>window.pad.buttons[0]={pressed:false,value:0});await page.waitForFunction(()=>window.fixture.nav.gamepad.armed);await tap(page,1);await expect(page.locator('#build-dialog')).toBeVisible();await tap(page,1);await page.waitForFunction(()=>window.fixture.nav.gamepad.armed);await tap(page,2);expect(await page.evaluate(()=>window.fixture.build.active)).toBe(false);
  await page.evaluate(()=>window.fixture.build.state.controllerAvailable=false);await tap(page,1);await expect(page.locator('#build-dialog')).not.toBeVisible();expect(await page.evaluate(()=>window.message)).toContain('64 m');
  for(const mode of ['flight','eva','walk']){
    await page.evaluate(mode=>{window.fixture.nav.mode=mode;window.fixture.nav.insideShip=mode==='walk';window.fixture.build.state.controllerAvailable=true;},mode);
    await page.evaluate(()=>window.pad.buttons[1]={pressed:true,value:1});await page.waitForFunction(()=>window.fixture.lastPad.vertical===-1);expect(await page.evaluate(()=>window.fixture.lastPad.brake)).toBe(false);await expect(page.locator('#build-dialog')).not.toBeVisible();
    if(mode==='eva')expect(await page.evaluate(()=>window.fixture.lastPad.evaVertical)).toBe(-1);
    await page.evaluate(()=>window.pad.buttons[1]={pressed:false,value:0});await page.waitForFunction(()=>!window.fixture.nav.gamepad.previous[1]);
  }
  await page.evaluate(()=>{window.fixture.nav.mode='flight';window.pad.buttons[7]={pressed:true,value:1};});await page.waitForFunction(()=>window.fixture.lastPad.fire===1);expect(await page.evaluate(()=>window.fixture.lastPad.vertical)).toBe(0);expect(await page.evaluate(()=>window.fixture.build.state.rotations)).toBe(0);
  await page.evaluate(()=>{window.pad.buttons[7]={pressed:false,value:0};window.pad.buttons[6]={pressed:true,value:1};});await page.waitForFunction(()=>window.fixture.lastPad.brake);expect(await page.evaluate(()=>window.fixture.build.state.rotations)).toBe(0);
});

test('bumpers switch blocks, shapes, facilities, power, roofs, finishes and resources without confirming held A',async({page})=>{
 await page.goto('/scripts/fixtures/build-ui.html');await page.waitForFunction(()=>window.fixture?.nav.gamepad.armed);await tap(page,1);await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);
 await page.evaluate(()=>{window.pad.buttons[5]={pressed:true,value:1};window.pad.buttons[0]={pressed:true,value:1};});
 await expect(page.locator('[data-controller-key="build-tab-shapes"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#build-dialog')).toBeVisible();
 await page.evaluate(()=>{window.pad.buttons[5]={pressed:false,value:0};window.pad.buttons[0]={pressed:false,value:0};});await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);
 await tap(page,5);await expect(page.locator('[data-controller-key="build-tab-facilities"]')).toHaveAttribute('aria-pressed','true');await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);
 await tap(page,5);await expect(page.locator('[data-controller-key="build-tab-power"]')).toHaveAttribute('aria-pressed','true');await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);
 await tap(page,5);await expect(page.locator('[data-controller-key="build-tab-roofs"]')).toHaveAttribute('aria-pressed','true');await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);
 await mkdir('/home/cees/.cache/star-agent-roofs-lights-evidence',{recursive:true});await page.screenshot({path:'/home/cees/.cache/star-agent-roofs-lights-evidence/roofs-desktop.png'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/home/cees/.cache/star-agent-roofs-lights-evidence/roofs-phone.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('[data-controller-key="build-piece-roof-edge"]')).toBeInViewport();await page.setViewportSize({width:1440,height:900});
 await tap(page,5);await expect(page.locator('[data-controller-key="build-tab-finishes"]')).toHaveAttribute('aria-pressed','true');await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);
 await tap(page,5);await expect(page.locator('[data-controller-key="build-tab-recipes"]')).toHaveAttribute('aria-pressed','true');await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);
 await tap(page,4);await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);await expect(page.locator('[data-controller-key="build-tab-finishes"]')).toHaveAttribute('aria-pressed','true');
 await tap(page,4);await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);await expect(page.locator('[data-controller-key="build-tab-roofs"]')).toHaveAttribute('aria-pressed','true');
 await tap(page,4);await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);await expect(page.locator('[data-controller-key="build-tab-power"]')).toHaveAttribute('aria-pressed','true');await tap(page,4);await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/star-agent-build-ui/facilities-phone.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await tap(page,4);await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);await page.evaluate(()=>window.pad.axes=[0,-1,0,0]);await expect(page.locator('.build-wheel')).toHaveAttribute('data-selected','foundation-triangle');await tap(page,0);await expect(page.locator('#build-dialog')).not.toBeVisible();expect(await page.evaluate(()=>window.fixture.build.state.pieceId)).toBe('foundation-triangle');
});

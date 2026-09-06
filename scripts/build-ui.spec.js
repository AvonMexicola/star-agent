import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
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
  await focus(page,'build-tab-pieces');await tap(page,0);await focus(page,'build-piece-mainframe');await tap(page,0);await expect(page.locator('#build-dialog')).not.toBeVisible();
  await page.screenshot({path:'/tmp/star-agent-build-ui/placement-phone.png'});
  expect(await page.locator('#build-hud').evaluate(el=>el.getBoundingClientRect().top>innerHeight/2)).toBe(true);
  await page.evaluate(()=>window.pad.buttons[7]={pressed:true,value:1});await page.waitForTimeout(160);expect(await page.evaluate(()=>window.fixture.build.state.pieceCount)).toBe(1);
  await tap(page,2);await expect(page.locator('#build-dialog')).toBeVisible();await tap(page,1);await expect(page.locator('#build-dialog')).toBeVisible();
  await page.evaluate(()=>window.pad.buttons[7]={pressed:false,value:0});await page.waitForFunction(()=>window.fixture.nav.gamepad.uiArmed);
  await page.evaluate(()=>window.pad.buttons[7]={pressed:true,value:1});await tap(page,1);await expect(page.locator('#build-dialog')).not.toBeVisible();await page.waitForTimeout(160);expect(await page.evaluate(()=>window.fixture.build.state.pieceCount)).toBe(1);
  await page.evaluate(()=>window.pad.buttons[7]={pressed:false,value:0});await page.waitForTimeout(100);await tap(page,1);expect(await page.evaluate(()=>window.fixture.build.active)).toBe(false);expect(errors).toEqual([]);
});

test('keyboard entry and touch placement use the same build actions',async({page})=>{
  await page.goto('/scripts/fixtures/build-ui.html');await page.waitForFunction(()=>window.fixture?.nav.gamepad.armed);
  await page.keyboard.press('b');await expect(page.locator('#build-dialog')).toBeVisible();
  await page.locator('[data-controller-key="build-piece-crate"]').click();await expect(page.locator('#build-hud')).toBeVisible();await page.waitForFunction(()=>window.fixture.nav.enabled);
  await page.keyboard.press('Enter');expect(await page.evaluate(()=>window.fixture.build.state.pieceCount)).toBe(1);
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});
  const target=await page.locator('[data-controller-key="build-hud-place"]').boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:target.x+target.width/2,y:target.y+target.height/2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect(await page.evaluate(()=>window.fixture.build.state.pieceCount)).toBe(2);
  await page.keyboard.press('Escape');expect(await page.evaluate(()=>window.fixture.build.active)).toBe(false);
  await page.locator('#build-shortcut').click();await expect(page.locator('#build-dialog')).toBeVisible();
});

test('mainframe storage handoff keeps gameplay paused until storage closes',async({page})=>{
  await page.goto('/scripts/fixtures/build-ui.html');await page.waitForFunction(()=>window.fixture?.nav.gamepad.armed);
  await page.evaluate(()=>window.fixture.ui.openMainframe({id:'fixture-core',name:'Test outpost',body:'aeon',radius:64,pieces:[],bufferId:'ship'}));
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
});

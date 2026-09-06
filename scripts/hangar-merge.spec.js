import {test,expect} from '@playwright/test';

test('saved Atlas opens in its finished berth and opening guards fleet input until control handoff',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.addInitScript(()=>localStorage.setItem('star-agent.fleet.v1',JSON.stringify({version:1,surfaceVisited:true,unlocked:true,active:'atlas'})));
  await page.goto('/?intro=1&seed=7291&debug=1');
  await page.waitForFunction(()=>window.starAgent?.state.ready);
  const state=await page.evaluate(()=>starAgent.state);
  expect(state.shipId).toBe('atlas');expect(state.station.finish).toBe('ready');expect(state.station.pods).toBe(20);
  expect(state.opening.phase).toBe('cinematic');expect(state.mode).toBe('walk');expect(state.insideShip).toBe(false);
  expect(state.station.deckClearance).toBeCloseTo(1.75,5);
  const cameraClearsShip=await page.evaluate(()=>{const n=starAgent.navigation,p=n.position.clone().set(...starAgent.state.camera.position);return n.toShipLocal(p).x>n.layout.flightBounds.max[0];});
  expect(cameraClearsShip).toBe(true);
  await page.keyboard.press('g');await expect(page.locator('#fleet-dialog')).not.toBeVisible();
  await page.keyboard.press('w');await page.waitForFunction(()=>starAgent.state.opening.phase==='playing');await page.keyboard.press('x');
  await page.keyboard.press('g');await expect(page.locator('#fleet-dialog')).toBeVisible();
  await expect(page.locator('.fleet-ships')).toContainText('Atlas');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>starAgent.navigation.enabled);
  await page.keyboard.press('m');await page.waitForFunction(()=>starAgent.state.mapOpen);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!starAgent.state.mapOpen&&starAgent.navigation.enabled);
  expect(errors).toEqual([]);
});

test('elevator fade rejects Help and orbit shortcuts, then normal Help quick transit remains available',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/?intro=0&debug=1');
  await page.waitForFunction(()=>window.starAgent?.state.ready&&starAgent.state.station.ready);
  // The full hangar suite covers walking into the cabin. This focused fixture
  // starts there to exercise the two competing asynchronous transition owners.
  const parked=await page.evaluate(()=>{
    const n=starAgent.navigation,s=n.station;starAgent.setRenderScale(.4);n.startStation();
    s.lift.open=true;s.lift.progress=1;
    s.toWorld(n.position.clone().set(0,s.interiorBox.min.y+n.layout.eyeHeight,s.lift.z+1.65),n.position);
    return n.shipPosition.toArray();
  });
  await page.keyboard.press('f');
  await expect(page.locator('#station-elevator-dialog')).toBeVisible();
  // Dispatch within the same event turn as the destination click, guaranteeing
  // the assertions run in the closed-dialog fade even on a slow software GPU.
  const during=await page.evaluate(()=>{
    document.querySelector('#station-elevator-dialog [data-destination="hub"]').click();
    for(const code of ['KeyH','KeyO']){
      document.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));
      document.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));
    }
    return {help:document.getElementById('help-dialog').open,quickTransit:starAgent.state.transiting,
      elevatorDialog:document.getElementById('station-elevator-dialog').open,
      fading:document.querySelector('.station-transfer').classList.contains('active'),enabled:starAgent.navigation.enabled};
  });
  expect(during).toEqual({help:false,quickTransit:false,elevatorDialog:false,fading:true,enabled:false});
  await page.waitForFunction(()=>starAgent.state.station.location==='hub'&&starAgent.navigation.enabled);
  const arrived=await page.evaluate(()=>({mode:starAgent.state.mode,docked:starAgent.state.station.docked,ship:starAgent.navigation.shipPosition.toArray()}));
  expect(arrived).toEqual({mode:'walk',docked:true,ship:parked});
  await page.keyboard.press('h');await expect(page.locator('#help-dialog')).toBeVisible();
  await page.locator('#quick-transit-menu summary').click();
  await page.locator('#help-dialog [data-destination="orbit"]').click();
  await page.waitForFunction(()=>starAgent.state.transiting);
  await page.waitForFunction(()=>!starAgent.state.transiting&&starAgent.navigation.enabled&&starAgent.state.mode==='flight');
  expect(await page.evaluate(()=>starAgent.state.station.docked)).toBe(false);
  await expect(page.locator('#help-dialog')).not.toBeVisible();
  expect(errors).toEqual([]);
});

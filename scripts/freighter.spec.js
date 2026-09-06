import { test, expect } from '@playwright/test';

async function walk(page,key,predicate){
  await page.keyboard.down(key);try{await page.waitForFunction(predicate,null,{timeout:45000});}catch(error){console.log('WALK FAILED',key,await page.evaluate(()=>({local:window.starAgent.state.shipLocal,enabled:window.starAgent.navigation.enabled,keys:[...window.starAgent.navigation.keys],interaction:window.starAgent.state.interaction})));throw error;}finally{await page.keyboard.up(key);}await page.keyboard.press('KeyX');
}
test('earn Atlas, select it at the station, ride the belly elevator and both cargo lifts, store supplies and launch',async({page})=>{
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log(e.message);});page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
  await page.goto('/?intro=0&debug=1');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.station.ready);
  await page.evaluate(()=>window.starAgent.setRenderScale(.4));
  await page.keyboard.press('KeyG');await expect(page.getByRole('button',{name:'LOCKED',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');
  // Fixture only sets the approach. Production landing, docking and unlock callbacks run normally.
  await page.evaluate(()=>{const a=window.starAgent;a.navigation.transit(a.destinations.forest,7);a.land();});
  await page.waitForFunction(()=>window.starAgent.state.mode==='landed');
  expect(await page.evaluate(()=>window.starAgent.state.fleet)).toMatchObject({surfaceVisited:true,unlocked:false});
  await page.evaluate(()=>{
    const n=window.starAgent.navigation,s=n.station,b=s.interiorBox,p=b.getCenter(n.position.clone());p.y=b.min.y+4;
    n.orbit();s.toWorld(p,n.position);n.orientation.copy(s.quaternion);n.landOrLaunch();
  });
  await page.waitForFunction(()=>window.starAgent.state.station.docked);
  expect(await page.evaluate(()=>window.starAgent.state.fleet.unlocked)).toBe(true);
  await page.keyboard.press('KeyG');await page.getByRole('button',{name:'BOARD ATLAS',exact:true}).click();
  await page.waitForFunction(()=>window.starAgent.state.shipId==='atlas'&&window.starAgent.state.shipAsset==='ready');
  await page.screenshot({path:'/tmp/atlas-game-fleet.png'});
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');await page.evaluate(()=>window.starAgent.setRenderScale(1));await page.waitForTimeout(600);
  await page.screenshot({path:'/tmp/atlas-game-cockpit.png'});
  await page.evaluate(()=>window.starAgent.setRenderScale(.4));await page.keyboard.press('Tab');
  await page.keyboard.press('KeyF');
  await walk(page,'KeyW',()=>window.starAgent.state.shipLocal[2]>.7);
  expect(await page.evaluate(()=>window.starAgent.state.interaction)).toContain('BELLY');
  await page.keyboard.press('KeyF');
  await page.waitForFunction(()=>window.starAgent.state.lifts[0].y===0);
  expect(await page.evaluate(()=>window.starAgent.state.shipLocal[1])).toBeCloseTo(1.75,3);
  await walk(page,'KeyW',()=>window.starAgent.state.shipLocal[2]>11.3);
  expect(await page.evaluate(()=>window.starAgent.state.insideShip)).toBe(false);
  await page.evaluate(()=>window.starAgent.navigation.look(Math.PI,0));
  await page.evaluate(()=>window.starAgent.setRenderScale(1));await page.waitForTimeout(700);
  await page.screenshot({path:'/tmp/atlas-game-elevator.png'});
  await page.evaluate(()=>window.starAgent.setRenderScale(.4));
  await walk(page,'KeyW',()=>window.starAgent.state.shipLocal[2]<1.2);
  await page.keyboard.press('KeyF');await page.waitForFunction(()=>window.starAgent.state.lifts[0].y===4);
  expect(await page.evaluate(()=>window.starAgent.state.shipLocal[1])).toBeCloseTo(5.75,3);
  await walk(page,'KeyW',()=>window.starAgent.state.shipLocal[2]<-3.7);
  await walk(page,'KeyA',()=>window.starAgent.state.shipLocal[0]<-4.7);
  expect(await page.evaluate(()=>window.starAgent.state.interaction)).toContain('PORT CARGO');
  await page.keyboard.press('KeyF');await page.waitForFunction(()=>window.starAgent.state.lifts[1].y===7);
  expect(await page.evaluate(()=>window.starAgent.state.shipLocal[1])).toBeCloseTo(8.75,3);
  await page.keyboard.press('KeyF');await page.waitForFunction(()=>window.starAgent.state.lifts[1].y===4);
  await walk(page,'KeyD',()=>window.starAgent.state.shipLocal[0]>4.7);
  await page.keyboard.press('KeyF');await page.waitForFunction(()=>window.starAgent.state.lifts[2].y===7);
  await page.keyboard.press('KeyF');await page.waitForFunction(()=>window.starAgent.state.lifts[2].y===4);
  await walk(page,'KeyA',()=>window.starAgent.state.shipLocal[0]<1.7);
  await walk(page,'KeyW',()=>window.starAgent.state.shipLocal[2]<-7.1);
  expect(await page.evaluate(()=>window.starAgent.state.interaction)).toContain('CARGO STORAGE');
  await page.keyboard.press('KeyF');await expect(page.getByRole('dialog',{name:'Ship inventory'})).toBeVisible();
  await expect(page.locator('.cargo-capacities')).toContainText('2400 kg');
  await page.getByRole('button',{name:'Take Repair kit',exact:true}).click();
  const manifest=await page.evaluate(()=>window.starAgent.state.inventory);
  await page.keyboard.press('Escape');await expect(page.locator('#cargo-dialog')).not.toBeVisible();await page.waitForFunction(()=>window.starAgent.navigation.enabled);
  await walk(page,'KeyA',()=>window.starAgent.state.shipLocal[0]<.15);
  await walk(page,'KeyW',()=>window.starAgent.state.shipLocal[2]<-9.2);
  await page.keyboard.press('KeyF');expect(await page.evaluate(()=>window.starAgent.state.mode)).toBe('landed');
  await page.keyboard.press('KeyL');expect(await page.evaluate(()=>window.starAgent.state.mode)).toBe('flight');
  await page.reload();await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.shipAsset==='ready');
  expect(await page.evaluate(()=>window.starAgent.state.shipId)).toBe('atlas');
  expect(await page.evaluate(()=>window.starAgent.state.inventory)).toEqual(manifest);
  expect(errors).toEqual([]);
});

test('unavailable Atlas asset keeps its elevator and inventory usable',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('star-agent.fleet.v1',JSON.stringify({version:1,surfaceVisited:true,unlocked:true,active:'atlas'})));
  await page.route('**/models/atlas.glb',route=>route.abort());
  await page.goto('/?intro=0&debug=1');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.shipAsset==='fallback');
  await page.evaluate(()=>{const a=window.starAgent;a.setRenderScale(.4);a.navigation.transit(a.destinations.forest,7);a.land();});
  await page.waitForFunction(()=>window.starAgent.state.mode==='landed');await page.keyboard.press('KeyF');
  await walk(page,'KeyW',()=>window.starAgent.state.shipLocal[2]>.7);await page.keyboard.press('KeyF');
  await page.waitForFunction(()=>window.starAgent.state.lifts[0].y===0);
  expect(await page.evaluate(()=>window.starAgent.state.shipLocal[1])).toBeCloseTo(1.75,3);
  await page.keyboard.press('KeyF');await page.waitForFunction(()=>window.starAgent.state.lifts[0].y===4);
  await walk(page,'KeyS',()=>window.starAgent.state.shipLocal[2]<-7.1);
  // Facing aft, A moves toward the starboard container.
  await walk(page,'KeyA',()=>window.starAgent.state.shipLocal[0]>1.4);
  await page.keyboard.press('KeyF');await expect(page.getByRole('dialog',{name:'Ship inventory'})).toBeVisible();
  expect(errors).toEqual([]);
});

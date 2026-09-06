import {test,expect} from '@playwright/test';
async function walk(page,key,predicate){
  await page.keyboard.down(key);
  try{await page.waitForFunction(predicate,null,{timeout:45000});}
  catch(error){console.log('WALK',await page.evaluate(()=>({station:starAgent.state.station,interaction:starAgent.state.interaction,keys:[...starAgent.navigation.keys],enabled:starAgent.navigation.enabled})));throw error;}
  finally{await page.keyboard.up(key);}await page.keyboard.press('KeyX');
}
async function screenshot(page,name){
  await page.evaluate(()=>starAgent.setRenderScale(1));await page.waitForTimeout(500);
  await page.screenshot({path:`/tmp/aeon-${name}.png`});await page.evaluate(()=>starAgent.setRenderScale(.4));
}
test('cargo bulk transfer, physical elevator entry, hub exploration and return to the parked ship',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
  await page.goto('/?debug=1');await page.waitForFunction(()=>window.starAgent?.state.ready&&starAgent.state.station.ready);
  await page.evaluate(()=>{
    const a=starAgent,n=a.navigation,s=n.station;a.setRenderScale(.4);
    const p=n.position.clone().set(0,s.interiorBox.min.y+4,2);n.orbit();s.toWorld(p,n.position);n.orientation.copy(s.quaternion);n.landOrLaunch();
  });
  await page.waitForFunction(()=>starAgent.state.station.docked);
  expect(await page.evaluate(()=>starAgent.state.station.pods)).toBe(20);
  const parked=await page.evaluate(()=>starAgent.navigation.shipPosition.toArray());
  // Start the services test in the clear side aisle. Existing ship/freighter suites cover ramp traversal.
  await page.evaluate(()=>{
    const n=starAgent.navigation,s=n.station;n.mode='walk';n.insideShip=false;n.velocity.set(0,0,0);
    const p=n.position.clone().set(-12,s.interiorBox.min.y+1.75,0);s.toWorld(p,n.position);
    n.orientToward(s.toWorld(p.clone().set(-12,p.y,22),p.clone()),s.up);
  });
  await screenshot(page,'hangar');
  await walk(page,'KeyW',()=>starAgent.state.station.local[2]>19.7);
  expect(await page.evaluate(()=>starAgent.state.interaction)).toContain('CARGO TRANSFER');
  await screenshot(page,'terminal');await page.keyboard.press('KeyF');
  await expect(page.getByRole('dialog',{name:'Cargo transfer terminal'})).toBeVisible();
  await page.getByRole('button',{name:'Take all',exact:true}).click();
  expect(await page.evaluate(()=>starAgent.state.inventory.shipMass)).toBe(120);
  await screenshot(page,'cargo-ui');
  const manifest=await page.evaluate(()=>starAgent.state.inventory);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>starAgent.navigation.enabled);
  // Facing aft, A moves toward the centre of the bay.
  await walk(page,'KeyA',()=>starAgent.state.station.local[0]>-.15);
  await page.keyboard.press('KeyF');await page.waitForFunction(()=>starAgent.state.station.elevator>.99);
  await walk(page,'KeyW',()=>starAgent.state.station.local[2]>23.8);
  expect(await page.evaluate(()=>starAgent.state.interaction)).toContain('DESTINATIONS');
  await page.keyboard.press('KeyF');await page.getByRole('button',{name:'Central hub',exact:true}).click();
  await page.waitForFunction(()=>starAgent.state.station.location==='hub'&&starAgent.navigation.enabled&&starAgent.state.station.elevator>.99);
  expect(await page.evaluate(()=>starAgent.navigation.shipPosition.toArray())).toEqual(parked);
  await walk(page,'KeyW',()=>starAgent.state.station.local[2]<3);
  await screenshot(page,'hub');
  // Turn to the ring windows, then physically return to the same cabin.
  await page.evaluate(()=>starAgent.navigation.look(Math.PI/2,.65));await screenshot(page,'hub-window');
  await page.evaluate(()=>starAgent.navigation.look(0,-.65));
  await page.evaluate(()=>starAgent.navigation.look(Math.PI/2,0));
  await walk(page,'KeyW',()=>starAgent.state.station.local[2]>15.9);
  await page.keyboard.press('KeyF');await page.getByRole('button',{name:'Berth 20',exact:true}).click();
  await page.waitForFunction(()=>starAgent.state.station.activePod===20&&starAgent.state.station.location==='hangar'&&starAgent.navigation.enabled);
  expect(await page.evaluate(()=>starAgent.navigation.shipPosition.toArray())).toEqual(parked);
  await page.keyboard.press('KeyF');await page.getByRole('button',{name:'Berth 01 · Your ship',exact:true}).click();
  await page.waitForFunction(()=>starAgent.state.station.activePod===1&&starAgent.navigation.enabled);
  await walk(page,'KeyW',()=>starAgent.state.station.local[2]<19.5);
  expect(await page.evaluate(()=>starAgent.state.inventory)).toEqual(manifest);
  expect(errors).toEqual([]);
  await page.reload();await page.waitForFunction(()=>window.starAgent?.state.ready);
  expect(await page.evaluate(()=>starAgent.state.inventory)).toEqual(manifest);
});

test('the complete orbital port renders and its enormous rings rotate',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
  await page.goto('/?debug=1');await page.waitForFunction(()=>window.starAgent?.state.ready&&starAgent.state.station.ready);
  await page.evaluate(()=>{
    const n=starAgent.navigation,s=n.station;n.enabled=false;n.velocity.set(0,0,0);
    n.position.copy(s.centre).add(n.position.clone().set(3500,2000,-3900).applyQuaternion(s.baseQuaternion));n.orientToward(s.centre,s.up);
  });
  await page.keyboard.press('Tab');await screenshot(page,'exterior');
  const before=await page.evaluate(()=>starAgent.state.station.rings);
  await page.waitForTimeout(1000);const after=await page.evaluate(()=>starAgent.state.station.rings);
  expect(after[0]).toBeGreaterThan(before[0]);expect(after[1]).toBeLessThan(before[1]);expect(errors).toEqual([]);
});

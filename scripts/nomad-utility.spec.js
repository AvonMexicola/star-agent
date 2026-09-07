import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const out = '/tmp/star-agent-nomad-gameplay';
const state = page => page.evaluate(() => window.starAgent.state);
function diagnostics(page) {
  const errors = [], warnings = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text());if (message.type() === 'warning') warnings.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  return { errors, warnings };
}
async function boot(page) {
  await page.goto('/?intro=0&seed=7291&debug');
  await page.waitForFunction(() => window.starAgent?.state.ready && ['ready', 'fallback'].includes(window.starAgent.state.shipAsset));
  await page.evaluate(() => window.starAgent.setRenderScale(.55));
}
async function walk(page, key, predicate) {
  await page.keyboard.down(key);
  try { await page.waitForFunction(predicate, null, { timeout: 15000 }); }
  finally { await page.keyboard.up(key); }
  await page.keyboard.press('KeyX');
}
async function shot(page, name) {
  await page.evaluate(() => window.starAgent.setRenderScale(1));
  await page.waitForFunction(() => window.starAgent.state.renderScale === 1 && document.getElementById('viewport').width >= innerWidth);
  await page.waitForTimeout(350);await page.screenshot({ path: `${out}/${name}.png` });
  await page.evaluate(() => window.starAgent.setRenderScale(.55));
}
async function record(page, browser, name, diagnostic, extra = {}) {
  const environment = await page.evaluate(() => {
    const gl = document.getElementById('viewport').getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { renderer: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER), viewport: [innerWidth, innerHeight], dpr: devicePixelRatio };
  });
  await writeFile(`${out}/${name}.json`, JSON.stringify({ browser: browser.version(), ...environment, ...diagnostic, ...extra, final: await state(page) }, null, 2));
}
test.beforeAll(() => mkdir(out, { recursive: true }));

test('keyboard walks the utility cabin, rests, transfers cargo, boards physically and launches', async ({ page, browser }) => {
  const d = diagnostics(page);await boot(page);
  // Explicit quick transit selects the test landscape; all local travel uses keys.
  await page.evaluate(() => window.starAgent.transit('coast'));
  await page.waitForFunction(() => !window.starAgent.state.transiting);
  await page.keyboard.press('KeyL');await page.waitForFunction(() => window.starAgent.state.mode === 'landed');
  expect((await state(page)).landingGear.progress).toBe(1);
  await shot(page, 'parked-cockpit');
  await page.keyboard.press('KeyF');
  await walk(page, 'KeyW', () => window.starAgent.state.shipLocal[2] > .48);
  await walk(page, 'KeyD', () => window.starAgent.state.shipLocal[0] < -.28);
  await expect.poll(async () => (await state(page)).interaction).toContain('REST IN BERTH');
  await page.keyboard.press('KeyF');await page.waitForFunction(() => window.starAgent.state.berthRest && !window.starAgent.state.berthTransition);
  const rest = await state(page);
  await page.keyboard.down('KeyW');await page.keyboard.down('Space');await page.waitForTimeout(400);
  expect((await state(page)).shipLocal).toEqual(rest.shipLocal);
  await page.keyboard.up('KeyW');await page.keyboard.up('Space');await shot(page, 'parked-berth');
  await page.keyboard.press('KeyF');await page.waitForFunction(() => !window.starAgent.state.berthRest && !window.starAgent.state.berthTransition);
  await walk(page, 'KeyA', () => window.starAgent.state.shipLocal[0] >= 0);
  await walk(page, 'KeyW', () => window.starAgent.state.shipLocal[2] > 2.62);
  await walk(page, 'KeyD', () => window.starAgent.state.shipLocal[0] < -.27);
  await page.keyboard.press('KeyF');await expect(page.locator('#cargo-dialog')).toBeVisible();
  await page.locator('[data-from="ship"][data-item="repair"]').first().click();
  await page.locator('[data-transfer="one"]').click();
  await page.locator('[data-add-box="ship"]').click();
  expect((await state(page)).inventory.shipMass).toBe(29);
  const beforeModalMove = (await state(page)).shipLocal;
  await page.keyboard.down('KeyW');await page.waitForTimeout(250);expect((await state(page)).shipLocal).toEqual(beforeModalMove);await page.keyboard.up('KeyW');
  await page.locator('.inventory-close').click();
  await page.waitForFunction(() => window.starAgent.state.nomadCargo.boxes === 5);
  expect((await state(page)).nomadCargo).toMatchObject({ boxes: 5, slots: 40, supplies: 29, supplyLimit: 120, mineralLimit: 60 });
  await shot(page, 'live-cargo-after-transfer');
  await walk(page, 'KeyA', () => window.starAgent.state.shipLocal[0] >= 0);
  await page.keyboard.press('KeyF');await page.waitForFunction(() => window.starAgent.state.doorProgress === 1);
  await walk(page, 'KeyW', () => window.starAgent.state.shipLocal[2] > 4.8);
  await page.keyboard.press('KeyF');
  expect((await state(page)).doorOpen).toBe(true,'a rider cannot close the ramp under their feet');
  await walk(page, 'KeyW', () => window.starAgent.state.shipLocal[2] > 8.3);
  expect((await state(page)).insideShip).toBe(false);
  const outside = (await state(page)).position;
  await page.keyboard.press('KeyF');expect(Math.hypot(...(await state(page)).position.map((value,axis)=>value-outside[axis]))).toBeLessThan(1e-5);
  await walk(page, 'KeyS', () => window.starAgent.state.shipLocal[2] < 2.75);
  expect((await state(page)).insideShip).toBe(true);
  await page.keyboard.press('KeyF');await page.waitForFunction(() => window.starAgent.state.doorProgress === 0);
  await walk(page, 'KeyS', () => window.starAgent.state.shipLocal[2] < -1.45);
  await page.keyboard.press('KeyF');expect((await state(page)).mode).toBe('landed');
  await page.keyboard.press('Digit4');await page.keyboard.press('KeyL');await page.keyboard.press('KeyG');
  await page.waitForFunction(() => window.starAgent.state.mode === 'flight' && window.starAgent.state.landingGear.progress < .75);
  await shot(page, 'gear-retracting-on-launch');
  await record(page, browser, 'keyboard', d, { input: 'Keyboard movement/interactions; pointer cargo buttons; explicit quick transit fixture' });
  await page.reload();await page.waitForFunction(() => window.starAgent?.state.ready);
  expect((await state(page)).inventory.shipMass).toBe(29);
  expect((await state(page)).containers.containers.find(c => c.id === 'ship').boxes).toBe(5);
  expect(d.errors).toEqual([]);expect(d.warnings).toEqual([]);
});

test('a resting passenger remains attached to an assisted moving ship and can return to controls', async ({ page, browser }) => {
  const d = diagnostics(page);await boot(page);
  await page.keyboard.down('KeyW');await page.waitForFunction(() => window.starAgent.state.shipSpeed > 30);
  await page.keyboard.press('KeyF');await page.keyboard.up('KeyW');
  await walk(page, 'KeyW', () => window.starAgent.state.shipLocal[2] > .48);
  await walk(page, 'KeyD', () => window.starAgent.state.shipLocal[0] < -.28);
  await page.keyboard.press('KeyF');await page.waitForFunction(() => window.starAgent.state.berthRest && !window.starAgent.state.berthTransition);
  const resting = await state(page);await page.waitForTimeout(1500);const carried = await state(page);
  expect(carried.shipPosition).not.toEqual(resting.shipPosition);expect(carried.shipSpeed).toBeGreaterThan(20);
  carried.shipLocal.forEach((value, axis) => expect(value).toBeCloseTo(resting.shipLocal[axis], 5));
  await shot(page, 'moving-berth');
  await page.keyboard.press('KeyF');await page.waitForFunction(() => !window.starAgent.state.berthRest && !window.starAgent.state.berthTransition);
  await walk(page, 'KeyA', () => window.starAgent.state.shipLocal[0] >= 0);
  await walk(page, 'KeyS', () => window.starAgent.state.shipLocal[2] < -1.45);
  const beforeSeat = await state(page);await page.keyboard.press('KeyF');
  const seated = await state(page);expect(seated.mode).toBe('flight');expect(seated.shipSpeed).toBeGreaterThan(20);
  expect(Math.hypot(...seated.velocity.map((value, axis) => value - beforeSeat.shipVelocity[axis]))).toBeLessThan(2);
  await record(page, browser, 'moving-berth', d, { input: 'Keyboard; debug state read for assertions' });
  expect(d.errors).toEqual([]);expect(d.warnings).toEqual([]);
});

for(const partial of [false,true])test(`a ${partial?'partial':'malformed'} model retains usable rest, cargo and physical ramp boarding`,async({page,browser})=>{
  const d=diagnostics(page);
  // Exercise both parser failure and a valid GLB with an incomplete cabin rig.
  // Successful responses avoid conflating fixtures with unexpected HTTP errors.
  await page.route('**/models/nomad.glb',async route=>{
    let body='unavailable test asset';
    if(partial){
      const response=await route.fetch(),original=await response.body();
      const length=original.readUInt32LE(12),doc=JSON.parse(original.subarray(20,20+length).toString());
      doc.nodes.find(node=>node.name==='CargoBox_8').name='Missing cargo box fixture';
      const json=Buffer.from(JSON.stringify(doc));const padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
      const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);
      header.writeUInt32LE(20+padded.length+original.length-20-length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
      body=Buffer.concat([header,padded,original.subarray(20+length)]);
    }
    await route.fulfill({status:200,contentType:'model/gltf-binary',body});
  });
  await boot(page);expect((await state(page)).shipAsset).toBe('fallback');
  await page.evaluate(()=>window.starAgent.transit('coast'));
  await page.waitForFunction(()=>!window.starAgent.state.transiting);
  await page.keyboard.press('KeyL');await page.waitForFunction(()=>window.starAgent.state.mode==='landed');
  await page.keyboard.press('KeyF');
  await walk(page,'KeyW',()=>window.starAgent.state.shipLocal[2]>.48);
  await walk(page,'KeyD',()=>window.starAgent.state.shipLocal[0]<-.28);
  await page.keyboard.press('KeyF');await page.waitForFunction(()=>window.starAgent.state.berthRest&&!window.starAgent.state.berthTransition);
  await shot(page,`${partial?'partial':'malformed'}-fallback-rest`);await page.keyboard.press('KeyF');
  await page.waitForFunction(()=>!window.starAgent.state.berthRest&&!window.starAgent.state.berthTransition);
  await walk(page,'KeyA',()=>window.starAgent.state.shipLocal[0]>=0);
  await walk(page,'KeyW',()=>window.starAgent.state.shipLocal[2]>2.62);
  await walk(page,'KeyD',()=>window.starAgent.state.shipLocal[0]<-.27);
  await page.keyboard.press('KeyF');await expect(page.locator('#cargo-dialog')).toBeVisible();
  await page.locator('[data-add-box="ship"]').click();await page.locator('.inventory-close').click();
  await page.waitForFunction(()=>window.starAgent.state.nomadCargo.boxes===5);
  await walk(page,'KeyA',()=>window.starAgent.state.shipLocal[0]>=0);
  await page.keyboard.press('KeyF');await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
  await walk(page,'KeyW',()=>window.starAgent.state.shipLocal[2]>8.3);expect((await state(page)).insideShip).toBe(false);
  await walk(page,'KeyS',()=>window.starAgent.state.shipLocal[2]<2.75);expect((await state(page)).insideShip).toBe(true);
  await record(page,browser,`${partial?'partial':'malformed'}-fallback`,d,{fixture:partial?'Parseable local GLB missing CargoBox_8; expected single fallback warning':'Deliberately malformed local GLB; expected single fallback warning',input:'Keyboard physical rest/rack/ramp route; pointer box attachment'});
  expect(d.errors).toEqual([]);expect(d.warnings).toHaveLength(1);expect(d.warnings[0]).toContain('Nomad model unavailable; using the boardable fallback.');
  if(partial)expect(d.warnings[0]).toContain('Nomad asset is missing CargoBox_8');
});

test('authored hull PBR renders with the existing atmospheric heating shader',async({page,browser})=>{
  const d=diagnostics(page);await boot(page);
  await page.evaluate(()=>{
    const nav=window.starAgent.navigation;
    nav.transit(window.starAgent.destinations.coast,18000);
    nav.flightAssist=false;nav.velocity.set(0,0,-1).applyQuaternion(nav.orientation).multiplyScalar(6000);
  });
  await page.keyboard.press('Digit4');
  await page.waitForFunction(()=>window.starAgent.state.reentryHeat>.65,null,{timeout:20000});
  await shot(page,'authored-pbr-reentry');
  await record(page,browser,'authored-pbr-reentry',d,{fixture:'Controlled18000m/6000mps inertial atmospheric rendering state; no continuous-flight journey claim'});
  expect(d.errors).toEqual([]);expect(d.warnings).toEqual([]);
});

test.describe('phone cabin controls', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('touch leaves the chair, walks to the berth, rests, opens cargo and returns', async ({ page, browser }) => {
    const d = diagnostics(page);await boot(page);const session = await page.context().newCDPSession(page);
    const action = page.locator('[data-cabin-interact]');
    async function hold(key, predicate) {
      const box = await page.locator(`[data-cabin-key="${key}"]`).boundingBox();expect(box).not.toBeNull();
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 0 }] });
      try { await page.waitForFunction(predicate, null, { timeout: 15000 }); }
      finally { await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    }
    await expect(action).toHaveText('Leave pilot seat');await action.tap();
    await hold('KeyW', () => window.starAgent.state.shipLocal[2] > .48);
    await hold('KeyD', () => window.starAgent.state.shipLocal[0] < -.28);
    await expect(action).toHaveText('Rest in berth');await action.tap();
    await page.waitForFunction(() => window.starAgent.state.berthRest && !window.starAgent.state.berthTransition);
    await shot(page, 'phone-rest');await expect(action).toHaveText('Leave berth');await action.tap();
    await page.waitForFunction(() => !window.starAgent.state.berthRest && !window.starAgent.state.berthTransition);
    await hold('KeyA', () => window.starAgent.state.shipLocal[0] >= 0);
    await hold('KeyW', () => window.starAgent.state.shipLocal[2] > 2.62);
    await hold('KeyD', () => window.starAgent.state.shipLocal[0] < -.27);
    await expect(action).toHaveText('Open cargo');await action.tap();
    await expect(page.locator('#cargo-dialog')).toBeVisible();
    await page.locator('[data-from="ship"][data-item="repair"]').first().tap();await page.locator('[data-transfer="one"]').tap();
    await page.locator('[data-add-box="ship"]').tap();await page.locator('.inventory-close').tap();
    await page.waitForFunction(() => window.starAgent.state.nomadCargo.boxes === 5);
    expect((await state(page)).nomadCargo.supplies).toBe(29);
    await hold('KeyA', () => window.starAgent.state.shipLocal[0] >= 0);
    await hold('KeyS', () => window.starAgent.state.shipLocal[2] < -1.45);
    await expect(action).toHaveText('Sit at controls');await action.tap();expect((await state(page)).mode).toBe('flight');
    await shot(page, 'phone-return-to-pilot');
    await record(page, browser, 'touch', d, { input: 'Injected Chromium touchscreen and real on-screen controls; no physical phone tested' });
    expect(d.errors).toEqual([]);expect(d.warnings).toEqual([]);
  });
});

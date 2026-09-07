import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const out=process.env.KESTREL_FLIGHT_OUTPUT??'/tmp/star-agent-kestrel-flight-browser';
test.afterEach(async({page},info)=>{
  if(info.status===info.expectedStatus)return;
  await fs.mkdir(out,{recursive:true});
  await page.screenshot({path:out+'/failed-frame.png'});
  await fs.writeFile(out+'/failed-state.json',JSON.stringify(await page.evaluate(()=>window.starAgent?.state??{loading:document.querySelector('#loading')?.textContent}),null,2));
});
test('Kestrel boards, secures, launches, flies and lands in the production game',async({page})=>{
  await fs.mkdir(out,{recursive:true});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});
  await page.addInitScript(()=>{localStorage.setItem('kestrel-save-sentinel','leave this intact');});
  await page.goto('/?dev=1&ship=kestrel&start=hangar&intro=0&debug=1');
  await page.waitForFunction(()=>window.starAgent?.state.ready,null,{timeout:90000});
  const state=()=>page.evaluate(()=>window.starAgent.state);
  expect((await state()).shipId).toBe('kestrel');expect((await state()).mode).toBe('landed');expect((await state()).inventory.shipMass).toBe(0);
  await expect(page.locator('#loading')).toHaveCSS('opacity','0');
  await page.screenshot({path:out+'/00-flight-card.png'});
  if(await page.locator('#kestrel-begin').isVisible())await page.locator('#kestrel-begin').click();
  await page.waitForFunction(()=>window.starAgent.state.enabled&&!window.starAgent.state.dev?.open&&!window.starAgent.state.transiting);
  await page.keyboard.press('Escape');
  await page.screenshot({path:out+'/01-cockpit.png'});
  await page.keyboard.press('KeyU');await expect(page.locator('#fleet-dialog')).toBeVisible();
  await page.screenshot({path:out+'/02-meridian-fleet.png'});await page.locator('.fleet-close').click();
  await page.waitForFunction(()=>window.starAgent.navigation.enabled&&!document.querySelector('dialog[open]'));
  await page.keyboard.press('KeyF');
  await page.waitForFunction(()=>window.starAgent.state.kestrelAccess.phase==='traversing',null,{timeout:18000});
  await page.keyboard.press('KeyB');expect((await state()).mode).toBe('walk');
  // B now opens construction on foot. Resume its intentional modal pause
  // before checking that the physical ladder route reaches the ground.
  if(await page.locator('#build-dialog[open]').isVisible())await page.keyboard.press('Escape');
  await page.waitForFunction(()=>window.starAgent.state.mode==='walk'&&window.starAgent.state.kestrelAccess.phase==='idle',null,{timeout:25000});
  expect((await state()).insideShip).toBe(false);expect((await state()).shipLocal[0]).toBeLessThan(-2.4);
  await expect(page.locator('#state-text')).not.toContainText('TRAVERSING');
  await page.screenshot({path:out+'/03-port-ladder.png'});
  console.log('Physical station exit passed; returning through the port ladder.');
  await page.keyboard.press('KeyF');
  await page.waitForFunction(()=>window.starAgent.state.kestrelAccess.phase==='closing',null,{timeout:30000});
  await page.keyboard.press('KeyB');expect((await state()).mode).toBe('landed');
  await page.waitForFunction(()=>window.starAgent.state.kestrelAccess.secured,null,{timeout:15000});
  await page.keyboard.press('KeyB');await page.waitForFunction(()=>window.starAgent.state.mode==='flight'&&!window.starAgent.state.station.lifting);
  console.log('Secured cockpit and station lift passed.');
  await page.keyboard.press('KeyG');await page.waitForFunction(()=>window.starAgent.state.kestrel.progress.gear===0);
  await page.keyboard.press('Digit4');
  await page.keyboard.down('KeyW');await page.waitForFunction(()=>window.starAgent.state.station.distance>130,null,{timeout:20000});await page.keyboard.up('KeyW');await page.keyboard.press('KeyX');
  await page.screenshot({path:out+'/04-exterior-flight.png'});
  console.log('Forward flight cleared the hangar.');
  await page.keyboard.press('KeyF');expect((await state()).mode).toBe('flight');expect((await state()).cabinFlight).toBe(false);
  await page.keyboard.press('KeyV');await page.keyboard.down('KeyW');await page.waitForTimeout(900);await page.keyboard.up('KeyW');
  const speed=(await state()).speed;await page.waitForTimeout(350);expect((await state()).speed).toBeGreaterThan(speed*.75);await page.keyboard.press('KeyX');await page.keyboard.press('KeyV');
  // Explicit quick-transit fixture only sets the surface approach; B performs
  // the actual descent/contact, then the same physical ladder route runs there.
  await page.evaluate(()=>window.starAgent.transit('moon'));await page.waitForFunction(()=>!window.starAgent.state.transiting);
  await page.keyboard.press('KeyB');await page.waitForFunction(()=>window.starAgent.state.mode==='landed',null,{timeout:45000});
  console.log('Selene landing passed.');
  expect((await state()).kestrel.progress.gear).toBe(1);
  await expect(page.locator('#mode-label')).toContainText('LANDED');
  await page.screenshot({path:out+'/05-selene-landed.png'});
  await page.keyboard.press('KeyF');await page.waitForFunction(()=>window.starAgent.state.mode==='walk'&&window.starAgent.state.kestrelAccess.phase==='idle',null,{timeout:35000});
  const final=await state();expect(final.insideShip).toBe(false);expect(final.shipMarker.shipName).toBe('Kestrel');
  await expect(page.locator('#state-text')).not.toContainText('TRAVERSING');
  await page.screenshot({path:out+'/06-surface-ladder.png'});
  expect(await page.evaluate(()=>localStorage.getItem('kestrel-save-sentinel'))).toBe('leave this intact');
  expect(await page.evaluate(()=>localStorage.getItem('star-agent.fleet.v1'))).toBeNull();
  const gpu=await page.evaluate(()=>{const gl=document.querySelector('#viewport').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
  await fs.writeFile(out+'/evidence.json',JSON.stringify({gpu,viewport:page.viewportSize(),errors,state:final},null,2));
  expect(errors).toEqual([]);
});

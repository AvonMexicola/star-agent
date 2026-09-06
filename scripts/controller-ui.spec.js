import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const tap = async(page,index) => {
  await page.evaluate(i=>window.pad.buttons[i]={pressed:true,value:1},index);await page.waitForTimeout(80);
  await page.evaluate(i=>window.pad.buttons[i]={pressed:false,value:0},index);await page.waitForTimeout(80);
};
test('standard controller selects destination, tool, backpack contents and transfer without pointer or keyboard',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/scripts/fixtures/controller.html');await page.waitForFunction(()=>window.fixtureReady&&window.fixtureState.armed);
  await tap(page,9);await expect(page.locator('#controller-menu')).toBeVisible();
  await tap(page,13);await tap(page,13);await tap(page,13);
  await expect(page.locator('[data-controller-key="destination-moon"]')).toBeFocused();
  await tap(page,0);expect(await page.evaluate(()=>window.fixtureState.destination)).toBe('moon');
  await tap(page,15);expect(await page.evaluate(()=>window.fixtureState.selected)).toBe(false);
  await tap(page,15);expect(await page.evaluate(()=>window.fixtureState.selected)).toBe(true);
  await page.evaluate(()=>window.pad.buttons[7]={pressed:true,value:1});await page.waitForFunction(()=>window.fixtureState.cuts>2);
  await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();
  const cuts=await page.evaluate(()=>window.fixtureState.cuts);await page.waitForTimeout(200);expect(await page.evaluate(()=>window.fixtureState.cuts)).toBe(cuts);
  await page.evaluate(()=>window.pad.buttons[7]={pressed:false,value:0});await page.waitForFunction(()=>window.fixtureState.uiArmed);
  await tap(page,13);await expect(page.locator('[data-controller-key="copper"]')).toBeFocused();
  await tap(page,13);await expect(page.locator('[data-controller-key="stow"]')).toBeFocused();
  await tap(page,0);await expect(page.locator('#cargo-result')).toHaveText('Copper transferred');
  await mkdir('/tmp/star-agent-controller-evidence',{recursive:true});await page.screenshot({path:'/tmp/star-agent-controller-evidence/backpack-focus.png'});
  // A held trigger at dialog close cannot resume mining until physically neutral.
  await page.evaluate(()=>window.pad.buttons[7]={pressed:true,value:1});await tap(page,1);
  await expect(page.locator('#cargo-dialog')).not.toBeVisible();await page.waitForTimeout(200);expect(await page.evaluate(()=>window.fixtureState.cuts)).toBe(cuts);
  await page.evaluate(()=>window.pad.buttons[7]={pressed:false,value:0});await page.waitForFunction(()=>window.fixtureState.armed);
  await page.evaluate(()=>window.pad.buttons[7]={pressed:true,value:1});await page.waitForFunction(previous=>window.fixtureState.cuts>previous,cuts);
  expect(errors).toEqual([]);
});

import {test, expect} from '@playwright/test';

const ready = async page => {
  await page.goto('/?intro=0&debug&seed=7291');
  await page.waitForFunction(() => window.starAgent?.state.ready);
  await page.evaluate(() => {
    window.starAgent.setRenderScale(.55);
    const nav = window.starAgent.navigation;
    nav.position.set(-.1, 0, -1).normalize().multiplyScalar(3592750);
    nav.velocity.set(0, 0, 0);
  });
};
const errorsFor = page => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
};
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test('chart follows real position; modal holds rendering, travel metrics and route', async ({page}) => {
  const errors = errorsFor(page);
  await page.setViewportSize({width:1440,height:900}); await ready(page);
  await page.keyboard.press('m');
  await page.locator('[data-travel-target="selene"]').click();
  const before = await page.evaluate(() => ({...window.starAgent.state, marker: document.querySelector('#map-ship').getAttribute('transform')}));
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.starAgent.state.renderedFrames)).toBe(before.renderedFrames);
  expect(await page.evaluate(() => window.starAgent.state.position)).toEqual(before.position);
  await expect(page.locator('#map-route')).toHaveAttribute('d', /^M.+ L.+/);
  const range = await page.locator('#map-distance').textContent();
  await page.locator('#map-zoom-in').click(); await page.waitForTimeout(220);
  await expect(page.locator('#map-distance')).toHaveText(range);
  await page.locator('#map-fit').click();
  await expect(page.locator('#map-ship')).toHaveAttribute('transform', before.marker);
  await page.screenshot({path:'/tmp/star-agent-map-desktop.png'});
  await page.keyboard.press('m');
  await page.waitForFunction(count => window.starAgent.state.renderedFrames > count, before.renderedFrames);
  await page.evaluate(() => { window.starAgent.navigation.position.y += 1_000_000; });
  await page.keyboard.press('m');
  expect(await page.locator('#map-ship').getAttribute('transform')).not.toBe(before.marker);
  await page.locator('#map-engage').click();
  await page.waitForFunction(() => window.starAgent.state.travel?.phase === 'spooling');
  await expect(page.locator('#state-text')).toContainText('SPOOLING');
  // Hold a reproducible point in the actual active plan, using its analytic sampler.
  await page.evaluate(() => {
    const nav = window.starAgent.navigation;
    nav.travel.elapsed = nav.travel.plan.spoolSeconds + nav.travel.plan.motionSeconds * .45;
    nav.updateTravel(0);
    document.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyM', bubbles:true}));
  });
  const held = await page.evaluate(() => window.starAgent.state);
  await expect(page.locator('#map-hold-status')).toContainText('DRIVE HELD');
  await expect(page.locator('#map-eta')).toHaveText(`${held.travel.eta.toFixed(1)} s`);
  expect(await page.locator('#map-progress').evaluate(e => e.value)).toBeCloseTo(held.travel.progress, 8);
  await expect(page.locator('[data-travel-target="aeon"]')).toBeDisabled();
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.starAgent.state.travel)).toEqual(held.travel);
  expect(await page.evaluate(() => window.starAgent.state.renderedFrames)).toBe(held.renderedFrames);
  await page.screenshot({path:'/tmp/star-agent-map-drive-held.png'});
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.starAgent.state.travel);
  expect(errors).toEqual([]);
});

test('controller opens, selects and engages; held sticks cannot leak into flight', async ({page}) => {
  const errors = errorsFor(page);
  await page.addInitScript(() => {
    window.mapPad = {id:'Map controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    Object.defineProperty(navigator,'getGamepads',{value:()=>[window.mapPad]});
  });
  await ready(page); await frames(page);
  const button = async (index, down) => { await page.evaluate(({index,down}) => { window.mapPad.buttons[index]={pressed:down,value:Number(down)}; },{index,down}); await frames(page); };
  const press = async index => { await button(index,true); await button(index,false); };
  await press(14); await expect(page.locator('#system-map')).toBeVisible();
  await press(13); await expect(page.locator('[data-travel-target="aeon"]')).toBeFocused();
  await press(13); await expect(page.locator('[data-travel-target="selene"]')).toBeFocused();
  await press(0); await expect(page.locator('#map-target-name')).toHaveText('Selene');
  const position = await page.evaluate(() => window.starAgent.state.position);
  await page.evaluate(() => { window.mapPad.axes[1] = 1; }); await frames(page);
  await expect(page.locator('#map-zoom-out')).toBeFocused();
  await press(1); await expect(page.locator('#system-map')).toBeHidden();
  await frames(page); expect(await page.evaluate(() => window.starAgent.state.position)).toEqual(position);
  await page.evaluate(() => { window.mapPad.axes.fill(0); }); await frames(page);
  await press(14); await expect(page.locator('#system-map')).toBeVisible();
  // Last control in the map is Engage; backward from Close reaches it directly.
  await press(12); await expect(page.locator('#map-engage')).toBeFocused();
  await press(0); await page.waitForFunction(() => Boolean(window.starAgent.state.travel));
  await press(14); await expect(page.locator('#system-map')).toBeVisible();
  await press(9); await expect(page.locator('#system-map')).toBeHidden();
  expect(errors).toEqual([]);
});

test.describe('touch map', () => {
  test.use({hasTouch:true});
test('phone retains close control while scrolled; touch, backdrop and exclusion explanation work', async ({page}) => {
  const errors = errorsFor(page);
  await page.setViewportSize({width:390,height:844}); await ready(page);
  await page.evaluate(() => window.starAgent.navigation.transitMoon(180));
  await page.keyboard.press('h'); await page.locator('#map-button').tap();
  await page.locator('[data-travel-target="aeon"]').click();
  await expect(page.locator('#map-route-status')).toContainText('Climb above 20 km');
  await expect(page.locator('#map-engage')).toBeDisabled();
  await page.screenshot({path:'/tmp/star-agent-map-phone-chart.png'});
  await page.locator('#map-route-status').scrollIntoViewIfNeeded();
  const close = await page.locator('#close-system-map').boundingBox();
  expect(close.y).toBeGreaterThan(0); expect(close.y + close.height).toBeLessThan(844);
  expect(await page.locator('#system-map').evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  await page.screenshot({path:'/tmp/star-agent-map-phone-details.png'});
  await page.locator('#close-system-map').tap();
  await expect(page.locator('#system-map')).toBeHidden();
  await page.keyboard.press('m'); await page.locator('#map-return').tap();
  await expect(page.locator('#system-map')).toBeHidden();
  await page.keyboard.press('m'); await page.touchscreen.tap(2,2);
  await expect(page.locator('#system-map')).toBeHidden();
  expect(await page.evaluate(() => window.starAgent.navigation.enabled)).toBe(true);
  expect(errors).toEqual([]);
});

});

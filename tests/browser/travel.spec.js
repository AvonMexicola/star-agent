import { test, expect } from '@playwright/test';

test('M selects a real target; drive renders, pauses and travels continuously both ways', async ({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('/?intro=0&debug');
  await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.evaluate(()=>window.starAgent.setRenderScale(.55));
  // A reproducible clear vantage above Aeon's moon-facing hemisphere.
  await page.evaluate(()=>{
    const nav=window.starAgent.navigation;
    nav.position.set(-.1,0,-1).normalize().multiplyScalar(3592750);
    nav.velocity.set(0,0,0);
  });
  const start=await page.evaluate(()=>window.starAgent.state.position);
  await page.keyboard.press('m');
  await expect(page.locator('#system-map')).toBeVisible();
  await page.locator('[data-travel-target="selene"]').click();
  expect(await page.evaluate(()=>window.starAgent.state.position)).toEqual(start);
  await expect(page.locator('#map-engage')).toBeEnabled();
  await page.screenshot({path:'/tmp/star-agent-system-map.png'});
  await page.locator('#map-engage').click();
  await page.waitForFunction(()=>window.starAgent.state.travel?.phase==='spooling');
  await page.waitForFunction(()=>window.starAgent.state.tunnel.intensity>.3);
  await page.screenshot({path:'/tmp/star-agent-travel-tunnel.png'});
  await page.keyboard.press('m');
  const paused=await page.evaluate(()=>window.starAgent.state.position);
  await page.waitForTimeout(400);
  expect(await page.evaluate(()=>window.starAgent.state.position)).toEqual(paused);
  await page.keyboard.press('m');
  await page.evaluate(()=>{
    window.travelSamples=[];
    const collect=()=>{
      const s=window.starAgent.state;
      window.travelSamples.push({position:s.position,speed:s.speed,phase:s.travel?.phase});
      if(s.travel)requestAnimationFrame(collect);
    };
    requestAnimationFrame(collect);
  });
  await page.waitForFunction(()=>!window.starAgent.state.travel && window.starAgent.state.body==='selene');
  const arrival=await page.evaluate(()=>({state:window.starAgent.state,samples:window.travelSamples}));
  expect(arrival.state.moon.distance).toBeCloseTo(arrival.state.moon.radius+50000,1);
  expect(arrival.state.speed).toBe(0);
  expect(arrival.samples.some(s=>s.speed>1e6)).toBe(true);
  expect(arrival.samples.filter(s=>s.speed>0).length).toBeGreaterThan(1);
  await page.waitForFunction(()=>!window.starAgent.state.tunnel.visible);
  await page.screenshot({path:'/tmp/star-agent-travel-arrival.png'});
  await page.keyboard.press('m');
  await page.locator('[data-travel-target="aeon"]').click();
  await expect(page.locator('#map-engage')).toBeEnabled();
  await page.locator('#map-engage').click();
  await page.waitForFunction(()=>!window.starAgent.state.travel && window.starAgent.state.body==='aeon');
  expect(await page.evaluate(()=>Math.hypot(...window.starAgent.state.position))).toBeCloseTo(1742750,1);
  await page.keyboard.down('w');
  await page.waitForFunction(()=>window.starAgent.state.speed>100);
  await page.keyboard.up('w');await page.keyboard.press('x');
  expect(errors).toEqual([]);
});

test('surface exclusion explains blocked drive; map remains usable on a narrow screen',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?intro=0&debug');
  await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.evaluate(()=>{window.starAgent.setRenderScale(.55);window.starAgent.navigation.transitMoon(180);});
  await page.setViewportSize({width:390,height:844});
  await page.keyboard.press('m');
  await page.locator('[data-travel-target="aeon"]').click();
  await expect(page.locator('#map-route-status')).toContainText('exclusion zone');
  await expect(page.locator('#map-engage')).toBeDisabled();
  const bounds=await page.locator('#system-map').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth}));
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.width+1);
  await page.screenshot({path:'/tmp/star-agent-system-map-mobile.png'});
  await page.keyboard.press('Escape');
  await expect(page.locator('#system-map')).not.toBeVisible();
  expect(await page.evaluate(()=>window.starAgent.navigation.enabled)).toBe(true);
  expect(errors).toEqual([]);
});

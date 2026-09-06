// Production preview evidence; node scripts/map-review.mjs [base URL] [output directory].
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] ?? 'http://127.0.0.1:5181';
const out = process.argv[3] ?? '/tmp/star-agent-map-review';
await mkdir(out, {recursive:true});
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page = await browser.newPage({viewport:{width:1440,height:900},hasTouch:true});
const errors = [], warnings = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
try {
  await page.goto(`${base}/?intro=0&debug&seed=7291`);
  await page.waitForFunction(() => window.starAgent?.state.ready);
  await page.evaluate(() => {
    window.starAgent.setRenderScale(.55);
    const n = window.starAgent.navigation;
    n.position.set(-.1,0,-1).normalize().multiplyScalar(3592750); n.velocity.set(0,0,0);
  });
  await page.keyboard.press('m'); await page.locator('[data-travel-target="selene"]').tap();
  await page.screenshot({path:`${out}/desktop.png`});
  const before = await page.evaluate(() => window.starAgent.state);
  const cadence = await page.evaluate(() => new Promise(resolve => {
    const intervals = []; let last = performance.now();
    function sample(now) { intervals.push(now - last); last = now; if (intervals.length < 30) requestAnimationFrame(sample); else resolve(intervals.slice(1).reduce((a,b)=>a+b,0)/(intervals.length-1)); }
    requestAnimationFrame(sample);
  }));
  const after = await page.evaluate(() => window.starAgent.state);
  const backend = await page.evaluate(() => {
    const gl = document.querySelector('#viewport').getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(300);
  await page.screenshot({path:`${out}/phone-chart.png`});
  await page.locator('#map-engage').scrollIntoViewIfNeeded(); await page.screenshot({path:`${out}/phone-details.png`});
  await page.locator('#close-system-map').tap(); await page.setViewportSize({width:1440,height:900});
  await page.keyboard.press('m'); await page.locator('#map-engage').click();
  await page.waitForFunction(() => Boolean(window.starAgent.state.travel));
  await page.evaluate(() => {
    const n = window.starAgent.navigation;
    n.travel.elapsed = n.travel.plan.spoolSeconds + n.travel.plan.motionSeconds * .45; n.updateTravel(0);
    document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyM',bubbles:true}));
  });
  await page.screenshot({path:`${out}/drive-held.png`});
  await writeFile(`${out}/evidence.json`, JSON.stringify({browser:browser.version(),backend,viewport:[1440,900],renderScale:before.renderScale,previousScene:{drawCalls:before.drawCalls,triangles:before.triangles},heldSceneRenderCount:after.renderedFrames-before.renderedFrames,mapRafCadenceMs:cadence,positionHeld:JSON.stringify(before.position)===JSON.stringify(after.position),errors,warnings},null,2));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Map evidence saved to ${out}`);
} finally { await browser.close(); }

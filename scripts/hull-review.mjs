// Production renderer evidence: node scripts/hull-review.mjs [URL] [output] [model override directory] [--tour].
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:5185';
const out = process.argv[3] ?? '/tmp/star-agent-hull-review';
const models = process.argv[4]?.startsWith('--') ? undefined : process.argv[4];
const tour = process.argv.includes('--tour');
await mkdir(out, {recursive:true});
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page = await browser.newPage({viewport:{width:1440,height:900}});
page.setDefaultTimeout(120000);
const errors = [], warnings = [], captures = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if(m.type()==='error') errors.push(m.text()); if(m.type()==='warning') warnings.push(m.text()); });
if(models) await page.route(/\/models\/station(?:_lod1)?\.glb$/, route => route.fulfill({
  path:resolve(models, new URL(route.request().url()).pathname.split('/').at(-1)), contentType:'model/gltf-binary'}));
const settle = () => page.evaluate(() => new Promise(resolve => {
  let remaining=4; const tick=()=>--remaining ? requestAnimationFrame(tick) : resolve(); requestAnimationFrame(tick);
}));
async function capture(name) {
  await settle();
  await page.screenshot({path:`${out}/${name}.png`});
  const state = await page.evaluate(() => window.starAgent.state);
  const cadence = await page.evaluate(() => new Promise(resolve => {
    const times=[]; const tick=t=>{times.push(t); if(times.length<7)requestAnimationFrame(tick);
      else resolve((times.at(-1)-times[0])/(times.length-1));}; requestAnimationFrame(tick);
  }));
  captures.push({name,state,softwareRafMs:cadence});
  console.log(name, state.drawCalls, state.triangles);
}
async function boot(intro) {
  await page.goto(`${base}/?intro=${intro}&debug&seed=7291`);
  await page.waitForFunction(() => window.starAgent?.state.ready && window.starAgent.state.station.ready);
  await page.evaluate(() => {
    window.starAgent.setRenderScale(1);
    document.querySelectorAll('body > :not(canvas):not(script)').forEach(e=>e.style.visibility='hidden');
  });
}
try {
  await boot(0);
  await page.evaluate(() => {window.starAgent.navigation.enabled=false;});
  const backend = await page.evaluate(() => {
    const gl=document.querySelector('#viewport').getContext('webgl2'), ext=gl.getExtension('WEBGL_debug_renderer_info');
    return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  });
  if(tour) {
    await capture('orbit');
    for(const [name,destination,altitude] of [['coast','coast',95],['forest','forest',95],['highlands','mountain',700]]) {
      await page.evaluate(({destination,altitude}) => {
        const app=window.starAgent; app.setRenderScale(.55);
        app.navigation.transit(app.destinations[destination],altitude); app.navigation.enabled=false;
      }, {destination,altitude});
      await settle();
      await page.waitForFunction(() => window.starAgent.state.lod>=13 && window.starAgent.state.pending===0);
      await page.evaluate(() => window.starAgent.setRenderScale(1));
      await capture(name);
    }
  }
  const views = tour ? [] : [
    ['exterior',[-110,70,-160],[0,8,0]],
    ['roof',[-36,38,-38],[0,9,0]],
    ['approach',[0,3,-72],[0,-2,4]],
    ['deck',[-6,-6.25,0],[2,-8,-3]],
  ];
  for(const [name,eye,target] of views) {
    await page.evaluate(({eye,target}) => {
      const n=window.starAgent.navigation,s=n.station;
      n.orbit(); n.enabled=false; s.beginOpening(); s.setOpeningProgress(1);
      s.toWorld(n.position.clone().fromArray(eye),n.position);
      n.orientToward(s.toWorld(n.position.clone().fromArray(target),n.position.clone()),s.up);
    }, {eye,target});
    await capture(name);
  }
  await boot(1);
  await page.waitForFunction(() => window.starAgent.state.opening.elapsed>=10);
  await capture('hangar-opening');
  if(tour) {
    // Reproducible seated camera fixture. The separate browser suite exercises
    // physical boarding; this fixture is solely for comparing rendered images.
    await page.evaluate(() => {
      const app=window.starAgent,n=app.navigation; app.openingSequence.leave();
      n.enabled=false; n.keys.clear(); n.velocity.set(0,0,0); n.mode='landed'; n.insideShip=true;
      n.position.copy(n.fromShipLocal(n.position.clone().set(0,2.55,-2.8)));
      n.orientation.copy(n.shipOrientation);
    });
    await capture('cockpit');
  }
  await writeFile(`${out}/evidence.json`,JSON.stringify({browser:browser.version(),backend,viewport:[1440,900],
    modelOverride:models??null,errors,warnings,captures},null,2));
  if(errors.length || warnings.length) throw new Error([...errors,...warnings].join('\n'));
} finally { await browser.close(); }

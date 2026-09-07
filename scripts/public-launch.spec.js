import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const root='http://127.0.0.1:5569';
const out='test-results/public-captures';
async function ready(page){await page.waitForFunction(()=>window.starAgent?.state.ready||document.body.textContent.includes('The graphics context was lost'),null,{timeout:60000});expect(await page.evaluate(()=>document.body.textContent.includes('The graphics context was lost')),'WebGL context must remain alive').toBe(false);}
async function frames(page,n=5){await page.evaluate(async n=>{for(let i=0;i<n;i++)await new Promise(r=>requestAnimationFrame(r));},n);}
async function tap(page,button){await page.evaluate(i=>window.publicPad.buttons[i]={pressed:true,value:1},button);await frames(page);await page.evaluate(i=>window.publicPad.buttons[i]={pressed:false,value:0},button);await frames(page);}
async function record(page,name,seconds=8){
  const recording=page.evaluate(async seconds=>{
    const stream=document.querySelector('#viewport').captureStream(30),chunks=[];
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:5500000});
    const result=new Promise(resolve=>{recorder.onstop=()=>{for(const t of stream.getTracks())t.stop();const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(chunks,{type:recorder.mimeType}));};});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start();setTimeout(()=>recorder.stop(),seconds*1000);return result;
  },seconds);
  await writeFile(`${out}/${name}.webm`,Buffer.from(await recording,'base64'));
  await exec('ffmpeg',['-v','error','-y','-i',`${out}/${name}.webm`,'-vf','scale=1280:800','-an','-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',`site/media/${name}.mp4`]);
  await exec('ffmpeg',['-v','error','-y','-i',`site/media/${name}.mp4`,'-frames:v','1','-c:v','libwebp','-quality','88',`site/media/${name}.webp`]);
}
async function poster(page,name){await page.screenshot({path:`${out}/${name}.png`});await exec('ffmpeg',['-v','error','-y','-i',`${out}/${name}.png`,'-c:v','libwebp','-quality','88',`site/media/${name}.webp`]);}

test('solo static release: real controller launcher, no API connection, captures and packaged studios',async({page,browser})=>{
  await mkdir(out,{recursive:true});const errors=[],bad=[],api=[];
  page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('CONSOLE ERROR',m.text(),JSON.stringify(m.location()));}});
  page.on('response',r=>{if(r.status()>=400)bad.push(`${r.status()} ${r.url()}`);});
  page.on('websocket',ws=>api.push(ws.url()));
  page.on('request',r=>{if(/\/(api|ws)(\/|$)/.test(new URL(r.url()).pathname))api.push(r.url());});
  await page.addInitScript(()=>{
    const pad={id:'Public release test controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0})),timestamp:0};window.publicPad=pad;
    navigator.getGamepads=()=>[pad];setInterval(()=>pad.timestamp=performance.now(),16);
  });
  await page.goto(`${root}/?debug&seed=7291`);
  await ready(page);console.log('Initial solo boot passed');await expect(page.locator('#dev-launcher')).toBeVisible();
  await expect(page.locator('#multiplayer-access')).toHaveCount(0);await expect(page.locator('#multiplayer-account-dialog')).toHaveCount(0);
  console.log('GPU',await page.evaluate(()=>{const g=document.querySelector('#viewport').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return g.getParameter(e?e.UNMASKED_RENDERER_WEBGL:g.RENDERER);}));
  await frames(page,20);await tap(page,1);await expect(page.locator('#dev-launcher')).not.toBeVisible();
  await tap(page,9);await expect(page.locator('dialog[open]')).toBeVisible();await tap(page,1);await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.keyboard.press('F2');await expect(page.locator('#dev-launcher')).toBeVisible();
  await page.locator('[data-dev-page="consoles"]').click();await expect(page.locator('[data-controller-key="dev-console-comms"]')).toHaveCount(0);
  await page.locator('[data-dev-page="launch"]').click();await page.locator('[data-ship="kestrel"]').click();
  // The location list is paginated: choose the coast on its first page.
  await page.locator('[data-location="coast"]').click();await page.locator('.dev-launch').click();
  await page.waitForURL(/start=coast/);await ready(page);await page.waitForFunction(()=>!window.starAgent.state.transiting&&window.starAgent.state.mode==='flight',null,{timeout:30000});console.log('Coast launch passed');
  await page.keyboard.press('Digit4');await page.keyboard.press('Tab');await page.keyboard.down('KeyW');await page.waitForTimeout(1800);
  await frames(page,30);await poster(page,'flight');await record(page,'flight');await page.keyboard.up('KeyW');
  const gl=await page.evaluate(()=>{const gl=document.querySelector('#viewport').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:gl.getParameter(e?e.UNMASKED_RENDERER_WEBGL:gl.RENDERER),state:window.starAgent.state};});
  await page.goto(`${root}/?debug&seed=7291&dev=1&intro=0&ship=nomad&start=hangar`);
  await ready(page);await page.waitForFunction(()=>!window.starAgent.state.transiting,null,{timeout:30000});console.log('Hangar launch passed');
  await page.keyboard.press('Digit4');await page.keyboard.press('Tab');await frames(page,30);await poster(page,'hangar');
  await page.keyboard.down('ArrowRight');await record(page,'hangar');await page.keyboard.up('ArrowRight');
  await exec('ffmpeg',['-v','error','-y','-i','site/media/flight.mp4','-i','site/media/hangar.mp4','-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0[v]','-map','[v]','-an','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart','site/media/field-notes.mp4']);
  await page.goto(`${root}/dev/equipment.html?rig=player-expedition&item=rifle-laser&view=hand`);
  await page.waitForFunction(()=>window.equipmentDev?.ready);expect(await page.evaluate(()=>window.equipmentDev.state.error)).toBeFalsy();await frames(page,10);await page.screenshot({path:`${out}/equipment-viewer.png`});
  expect(api).toEqual([]);expect(bad).toEqual([]);expect(errors).toEqual([]);
  await writeFile(`${out}/environment.json`,JSON.stringify({browser:browser.version(),backend:gl.renderer,viewport:[1440,900],timestamp:new Date().toISOString(),errors,bad,api,flight:gl.state,limitations:'Injected controller, no physical device or FPS claim. Captures use explicit test starts, not a continuous whole-system journey.'},null,2));
});

test('homepage links, media, keyboard, reduced motion and phone layout',async({page})=>{
  const errors=[],bad=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push(r.url());});
  await page.goto('http://127.0.0.1:5568/');await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode();}));});
  await expect(page.getByRole('link',{name:/Fly solo/})).toHaveAttribute('href','https://play.staragent.site/');
  await expect(page.getByRole('link',{name:/Meet your rivals/})).toHaveAttribute('href','https://multiplayer.staragent.site/');
  await page.screenshot({path:`${out}/homepage-desktop.png`,fullPage:true});
  await page.locator('#choose').scrollIntoViewIfNeeded();await page.waitForFunction(()=>[...document.querySelectorAll('video[data-loop]')].every(v=>v.readyState>=2&&!v.paused));
  await page.getByRole('button',{name:'Pause motion'}).click();await expect.poll(()=>page.evaluate(()=>[...document.querySelectorAll('video[data-loop]')].every(v=>v.paused))).toBe(true);
  for(const reel of await page.locator('.reel video').all()){await reel.scrollIntoViewIfNeeded();await reel.evaluate(v=>v.play());await expect.poll(()=>reel.evaluate(v=>v.currentTime)).toBeGreaterThan(.1);await reel.evaluate(v=>v.pause());}
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5568/');await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode();}));});await page.screenshot({path:`${out}/homepage-phone.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.locator('#choose').scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'Play motion'})).toBeVisible();expect(await page.locator('video[data-loop]').evaluateAll(vs=>vs.every(v=>!v.getAttribute('src')))).toBe(true);
  await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement!==document.body)).toBe(true);
  expect(bad).toEqual([]);expect(errors).toEqual([]);
});

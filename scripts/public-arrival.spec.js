import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out='test-results/arrival-capture';
const root='http://127.0.0.1:5569';

test('capture one continuous Nomad drive arrival, atmospheric descent and landing',async({page,browser})=>{
  await mkdir(out,{recursive:true});
  const errors=[],bad=[],api=[];
  page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});
  page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('CONSOLE ERROR',m.text(),m.location());}});
  page.on('response',r=>{if(r.status()>=400)bad.push(`${r.status()} ${r.url()}`);});
  page.on('request',r=>{if(/^\/(api|ws)(\/|$)/.test(new URL(r.url()).pathname))api.push(r.url());});
  page.on('websocket',ws=>api.push(ws.url()));
  await page.goto(`${root}/?debug&seed=7291&dev=1&intro=0&ship=nomad&start=orbit`);
  await page.waitForFunction(()=>window.starAgent?.state.ready&&!window.starAgent.state.transiting,null,{timeout:90000});
  // Place only the initial off-camera test start. Everything recorded after this
  // uses the actual targeting drive, keyboard thrust/braking and landing assist.
  const setup=await page.evaluate(()=>{
    const s=window.starAgent,n=s.navigation;
    const up=n.position.clone().set(0,1,0),radial=n.position.clone().fromArray(s.destinations.coast).applyAxisAngle(up,-.01);
    const east=up.clone().cross(radial).normalize(),north=radial.clone().cross(east).normalize();
    // Canonical surface samples put this 80 m footprint clear of the nearby outcrop.
    const direction=radial.multiplyScalar(1592750).addScaledVector(east,-60).addScaledVector(north,-180).normalize().toArray();
    n.transit(direction,60000000);
    n.orientToward(n.position.clone().set(0,0,0),n.position.clone().set(0,1,0));
    s.setRenderScale(1);
    return {position:n.position.toArray(),direction,ship:n.shipId};
  });
  if(await page.evaluate(()=>window.starAgent.navigation.gearDeployed))await page.keyboard.press('KeyG');
  await page.keyboard.press('KeyM');
  await page.locator('[data-travel-target="aeon"]').click();
  await page.locator('#map-engage').click();
  await page.keyboard.press('Digit4');await page.keyboard.press('Shift+Tab');
  await page.waitForTimeout(5000);
  console.log('LOCK DIAGNOSTIC',await page.evaluate(()=>{const s=starAgent,n=s.navigation;return {enabled:n.enabled,focused:n.focused,hidden:document.hidden,modal:document.querySelector('dialog[open]')?.id,mode:n.mode,powered:n.powered,gear:[n.gearDeployed,n.gearProgress],position:n.position.toArray(),orientation:n.orientation.toArray(),targets:(({targets,...state})=>state)(s.state.navigationTargets)};}));
  await page.waitForFunction(()=>window.starAgent.state.navigationTargets.ready&&window.starAgent.state.navigationTargets.aimedId==='aeon',null,{timeout:30000});
  await page.waitForTimeout(1200);
  await page.evaluate(()=>{
    const canvas=document.querySelector('#viewport'),stream=canvas.captureStream(30),chunks=[];
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:7000000});
    const started=performance.now();
    const capture=window.arrivalCapture={recorder,stream,chunks,started,samples:[],markers:[],finished:false};
    capture.result=new Promise(resolve=>recorder.onstop=()=>{for(const t of stream.getTracks())t.stop();const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(chunks,{type:recorder.mimeType}));});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    capture.timer=setInterval(()=>{
      const n=window.starAgent.navigation,s=window.starAgent.state;
      capture.samples.push({seconds:(performance.now()-started)/1000,position:n.position.toArray(),altitude:n.altitude,speed:n.speed,mode:n.mode,body:n.body.id,autoland:n.autoland,gear:n.gearProgress,travel:n.travelState?.phase??null,transiting:s.transiting,graphicsLost:document.body.textContent.includes('The graphics context was lost')});
    },100);
    recorder.start(1000);
  });
  const mark=async name=>{const seconds=await page.evaluate(name=>{const c=window.arrivalCapture,seconds=(performance.now()-c.started)/1000;c.markers.push({name,seconds});return seconds;},name);console.log(name,seconds.toFixed(2),await page.evaluate(()=>{const n=window.starAgent.navigation;return {altitude:n.altitude,speed:n.speed,mode:n.mode};}));};
  try {
    await mark('recording-start');await page.waitForTimeout(1500);
    await page.keyboard.press('KeyN');await page.waitForFunction(()=>Boolean(window.starAgent.navigation.travel));await mark('drive-engaged');
    await page.waitForFunction(()=>!window.starAgent.navigation.travel,null,{timeout:60000});
    expect(await page.evaluate(()=>window.starAgent.navigation.body.id)).toBe('aeon');
    expect(await page.evaluate(()=>window.starAgent.navigation.altitude)).toBeCloseTo(20000,0);
    await mark('drive-arrival');await page.waitForTimeout(1600);await mark('descent-start');
    await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');
    await page.waitForFunction(()=>window.starAgent.navigation.altitude<2200||window.starAgent.navigation.mode==='crashed',null,{timeout:150000});
    expect(await page.evaluate(()=>window.starAgent.navigation.mode)).toBe('flight');
    await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');await page.keyboard.down('KeyX');
    await page.waitForFunction(()=>window.starAgent.navigation.speed<2,null,{timeout:30000});await page.keyboard.up('KeyX');
    await mark('braked');
    // Pitch up using the ordinary keyboard binding; no pose writes in the take.
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(()=>{const n=window.starAgent.navigation;return n.position.clone().set(0,0,-1).applyQuaternion(n.orientation).dot(n.normal)>-.12;},null,{timeout:12000});
    await page.keyboard.up('ArrowUp');await mark('levelled');
    await page.keyboard.down('KeyC');
    await page.waitForFunction(()=>window.starAgent.navigation.altitude<900,null,{timeout:30000});
    await page.keyboard.up('KeyC');await page.keyboard.up('ShiftLeft');await page.keyboard.down('KeyX');
    await page.waitForFunction(()=>window.starAgent.navigation.speed<2,null,{timeout:20000});await page.keyboard.up('KeyX');
    expect(await page.evaluate(()=>window.starAgent.navigation.altitude)).toBeGreaterThan(80);
    await page.keyboard.press('KeyL');await page.keyboard.press('KeyB');
    expect(await page.evaluate(()=>window.starAgent.navigation.autoland)).toBe(true);await mark('landing-assist');
    await page.waitForFunction(()=>window.starAgent.navigation.mode==='landed'||window.starAgent.navigation.mode==='crashed',null,{timeout:60000});
    expect(await page.evaluate(()=>window.starAgent.navigation.mode)).toBe('landed');await mark('touchdown');
    await page.waitForTimeout(5000);await page.screenshot({path:`${out}/touchdown.png`});
    await mark('recording-end');
  } finally {
    const base64=await page.evaluate(async()=>{const c=window.arrivalCapture;clearInterval(c.timer);if(c.recorder.state!=='inactive')c.recorder.stop();return c.result;});
    await writeFile(`${out}/nomad-aeon-raw.webm`,Buffer.from(base64,'base64'));
    const data=await page.evaluate(()=>{const c=window.arrivalCapture,g=document.querySelector('#viewport').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return {markers:c.markers,samples:c.samples,backend:g.getParameter(e?e.UNMASKED_RENDERER_WEBGL:g.RENDERER),finalMode:window.starAgent.navigation.mode};});
    await writeFile(`${out}/journey.json`,JSON.stringify({...data,setup,browser:browser.version(),viewport:[1440,900],errors,bad,api,limits:'Initial off-camera development placement; one continuous take with real controls and normal game time. No physical-controller or FPS claim.'},null,2));
  }
  const samples=await page.evaluate(()=>window.arrivalCapture.samples);
  expect(samples.some(s=>s.travel==='accelerating')).toBe(true);expect(samples.some(s=>s.travel==='decelerating')).toBe(true);
  expect(samples.every(s=>!s.transiting&&!s.graphicsLost&&s.mode!=='crashed')).toBe(true);
  expect(errors).toEqual([]);expect(bad).toEqual([]);expect(api).toEqual([]);
});

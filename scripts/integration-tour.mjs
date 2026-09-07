import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const url=process.env.INTEGRATION_URL||'http://127.0.0.1:5280';
const out=process.env.INTEGRATION_EVIDENCE||'/tmp/star-agent-main-tour';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--disable-dev-shm-usage','--use-gl=angle','--use-angle=gl']});
const page=await browser.newPage({viewport:{width:1600,height:900},hasTouch:true});
page.setDefaultTimeout(90000);const errors=[],captures=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});
async function shot(name){
  await page.evaluate(()=>starAgent.setRenderScale(1));await page.waitForTimeout(500);
  const stats=await page.evaluate(async()=>{
    const samples=[];let last=performance.now();
    for(let i=0;i<45;i++)await new Promise(resolve=>requestAnimationFrame(t=>{samples.push(t-last);last=t;resolve();}));
    const s=starAgent.state,gl=document.getElementById('viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {viewport:[innerWidth,innerHeight],position:s.position,mode:s.mode,renderScale:s.renderScale,drawCalls:s.drawCalls,triangles:s.triangles,lod:s.terrainLod,vegetation:s.vegetation,rafMedianMs:samples.sort((a,b)=>a-b)[22],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
  });
  await page.screenshot({path:`${out}/${name}.png`});captures.push({name,...stats});console.log(name,JSON.stringify(stats));
}
try{
  await page.goto(`${url}/?intro=0&seed=7291&debug`);await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.keyboard.press('Tab');await page.waitForTimeout(4000);await shot('orbit');
  for(const [name,key,altitude] of [['coast','coast',95],['forest','forest',95],['highlands','mountain',700]]){
    await page.evaluate(({key,altitude})=>{const n=starAgent.navigation;n.transit(starAgent.destinations[key],altitude);const up=n.normal,east=up.clone().set(0,1,0).cross(up).normalize(),north=up.clone().cross(east);n.orientToward(n.position.clone().addScaledVector(north,100).addScaledVector(east,80).addScaledVector(up,-30),up);},{key,altitude});
    await page.waitForTimeout(1200);await page.waitForFunction(()=>starAgent.state.terrainLod.settled);await shot(name);
  }
  await page.goto(`${url}/?seed=7291&debug`);await page.waitForFunction(()=>window.starAgent?.state.ready&&starAgent.state.opening.elapsed>=10);await shot('hangar');
  await page.keyboard.press('w');await page.waitForFunction(()=>starAgent.state.opening.phase==='playing');
  const walk=async(key,predicate)=>{await page.keyboard.down(key);try{await page.waitForFunction(predicate);}finally{await page.keyboard.up(key);}await page.keyboard.press('x');};
  await walk('s',()=>starAgent.state.shipLocal[2]>7.5);await walk('a',()=>Math.abs(starAgent.state.shipLocal[0])<.25);await walk('w',()=>starAgent.state.shipLocal[2]<6);
  await page.keyboard.press('f');await page.waitForFunction(()=>starAgent.state.doorProgress===1);await walk('w',()=>starAgent.state.shipLocal[2]<-1.6);await page.keyboard.press('f');await page.waitForFunction(()=>starAgent.state.mode==='landed');await shot('cockpit');
  await page.goto(`${url}/?intro=0&seed=7291&debug`);await page.waitForFunction(()=>window.starAgent?.state.ready);await page.setViewportSize({width:1440,height:900});await page.keyboard.press('m');await page.locator('[data-travel-target="selene"]').click();await shot('map-desktop');
  await page.setViewportSize({width:390,height:844});await shot('map-phone');
}finally{
  await writeFile(`${out}/record.json`,JSON.stringify({browser:browser.version(),url,captures,errors,notes:'RAF median includes display refresh and is not GPU render time. Tour uses debug poses for terrain viewpoints; boarding to cockpit is physical. Coast bearing is fixed, not guaranteed sea-facing for arbitrary seeds.'},null,2));await browser.close();
}
if(errors.length)throw Error(errors.join('\n'));

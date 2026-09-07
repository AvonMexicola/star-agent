import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const output='/tmp/star-agent-handling-evidence';

for(const shipId of ['nomad','atlas'])test(`${shipId}: saved ship starts, steers, accelerates, settles and resumes with controller alone`,async({page,browser})=>{
  await mkdir(output,{recursive:true});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});
  await page.addInitScript(id=>{
    // Existing saved Fleet selection; no debug ship swap or position change.
    localStorage.setItem('star-agent.fleet.v1',JSON.stringify({version:1,surfaceVisited:true,unlocked:true,active:id}));
    window.handlingPad={id:'Standard handling controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    Object.defineProperty(navigator,'getGamepads',{value:()=>[window.handlingPad]});
  },shipId);
  await page.goto('/?intro=0&debug&seed=7291');
  await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed);
  expect(await page.evaluate(()=>window.starAgent.state.shipId)).toBe(shipId);
  const frames=()=>page.evaluate(async()=>{for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));});
  const button=async(i,down)=>{await page.evaluate(({i,down})=>{window.handlingPad.buttons[i]={pressed:down,value:Number(down)};},{i,down});await frames();};
  const tap=async i=>{await button(i,true);await button(i,false);};
  // Read-only timing instrumentation counts actual simulation steps; wall-clock
  // waits would miscompare hulls when this laptop's renderer stalls.
  await page.evaluate(()=>{const n=window.starAgent.navigation,update=n.update.bind(n);window.handlingSeconds=0;n.update=dt=>{update(dt);window.handlingSeconds+=dt;};});
  const hold=async(axes,seconds)=>{
    const start=await page.evaluate(axes=>{window.handlingPad.axes=axes;return window.handlingSeconds;},axes);
    await page.waitForFunction(({start,seconds})=>window.handlingSeconds-start>=seconds,{start,seconds});
    return page.evaluate(()=>({seconds:window.handlingSeconds,orientation:window.starAgent.navigation.orientation.toArray(),speed:window.starAgent.state.speed}));
  };
  const before=await page.evaluate(()=>window.starAgent.navigation.orientation.toArray());
  const yaw=await hold([0,0,1,0],.6);
  await hold([0,0,0,0],1.5);
  const turnAngle=2*Math.acos(Math.min(1,Math.abs(before.reduce((s,v,i)=>s+v*yaw.orientation[i],0))));
  expect(turnAngle).toBeGreaterThan(shipId==='atlas'?.12:.4);
  expect(turnAngle).toBeLessThan(shipId==='atlas'?.27:.7);
  const thrust=await hold([0,-1,0,0],.5);
  const settled=await hold([0,0,0,0],1);
  expect(thrust.speed).toBeGreaterThan(500);
  const speedRatio=settled.speed/thrust.speed;
  if(shipId==='atlas'){expect(speedRatio).toBeGreaterThan(.25);expect(speedRatio).toBeLessThan(.55);}
  else expect(speedRatio).toBeLessThan(.06);
  // Open/close controls with Menu, then regain steering after neutral release.
  await tap(9);await expect(page.getByRole('dialog',{name:'Command menu'})).toBeVisible();
  await hold([0,0,1,0],.3);await tap(9);await expect(page.getByRole('dialog',{name:'Command menu'})).toBeHidden();
  const closed=await page.evaluate(()=>window.starAgent.navigation.orientation.toArray());
  await hold([0,0,1,0],.3);
  expect(await page.evaluate(()=>window.starAgent.navigation.orientation.toArray())).toEqual(closed);
  await hold([0,0,0,0],.2);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
  const resumed=await hold([0,0,1,0],.3);expect(resumed.orientation).not.toEqual(closed);await hold([0,0,0,0],.5);
  await button(4,true);await button(5,true);await tap(15);await button(4,false);await button(5,false);
  await page.waitForFunction(()=>window.starAgent.state.camera.mode==='external');
  await page.screenshot({path:`${output}/${shipId}-controller-flight.png`});
  const backend=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);});
  await writeFile(`${output}/${shipId}.json`,JSON.stringify({shipId,browser:browser.version(),backend,viewport:page.viewportSize(),turnAngle,thrust,settled,speedRatio,errors,input:'Injected standard Gamepad; saved Fleet selection; no debug positioning'},null,2));
  expect(errors).toEqual([]);
});

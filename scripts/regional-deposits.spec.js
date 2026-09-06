import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const evidence='/tmp/star-agent-regional-deposit-evidence';
const destination='resource-copper-ejecta-province';
const saveKey='star-agent.selene-mining.v1';
async function button(page,index,down){
  await page.evaluate(({index,down})=>window.regionPad.buttons[index]={pressed:down,value:Number(down)},{index,down});
  await page.waitForFunction(({index,down})=>Boolean(window.starAgent.navigation.gamepad.previous[index])===down,{index,down},{timeout:10000});
}
async function tap(page,index){
  await page.waitForFunction(()=>document.querySelector('dialog[open]')?window.starAgent.navigation.gamepad.uiArmed:window.starAgent.state.controller.armed);
  await button(page,index,true);await button(page,index,false);
}
const axes=(page,values)=>page.evaluate(values=>window.regionPad.axes=values,values);
async function stop(page){await axes(page,[0,0,0,0]);await button(page,10,false);await page.waitForFunction(()=>window.starAgent.state.speed<.06);}
async function walkTo(page,point){
  const started=Date.now(),positions=[];
  for(let i=0;i<700;i++){
    const feedback=await page.evaluate(point=>{
      const n=window.starAgent.navigation,delta=n.position.clone().fromArray(point).sub(n.position),local=delta.clone().applyQuaternion(n.orientation.clone().invert());
      return {distance:delta.length(),yaw:Math.atan2(local.x,-local.z),pitch:Math.atan2(local.y,Math.hypot(local.x,local.z)),position:n.position.toArray()};
    },point);
    if(i%20===0)positions.push(feedback);
    if(feedback.distance<5.5){await stop(page);return {durationMs:Date.now()-started,positions};}
    const stick=v=>Math.abs(v)<.018?0:Math.sign(v)*Math.min(.8,.18+Math.abs(v)*1.5);
    await axes(page,[0,Math.abs(feedback.yaw)<.22?-1:0,stick(feedback.yaw),stick(-feedback.pitch)]);
    await page.evaluate(boost=>window.regionPad.buttons[10]={pressed:boost,value:Number(boost)},feedback.distance>25&&Math.abs(feedback.yaw)<.22);
    await page.waitForTimeout(120);
  }
  await stop(page);throw Error('Regional deposit was not reached by controller walking within the bounded route');
}
async function aim(page,point){
  for(let i=0;i<200;i++){
    const [yaw,pitch]=await page.evaluate(point=>{const n=window.starAgent.navigation,v=n.position.clone().fromArray(point).sub(n.position).applyQuaternion(n.orientation.clone().invert());return [Math.atan2(v.x,-v.z),Math.atan2(v.y,Math.hypot(v.x,v.z))];},point);
    if(Math.abs(yaw)<.022&&Math.abs(pitch)<.022){await axes(page,[0,0,0,0]);return;}
    const stick=v=>Math.abs(v)<.015?0:Math.sign(v)*Math.min(.75,.18+Math.abs(v)*1.5);
    await axes(page,[0,0,stick(yaw),stick(-pitch)]);await page.waitForTimeout(100);
  }
  throw Error('Controller aiming did not converge on the regional deposit');
}

test('controller walks beyond the named Copper Ejecta site, mines a regional copper outcrop and keeps its cargo and cuts after reload',async({page,browser})=>{
  test.setTimeout(360000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await mkdir(evidence,{recursive:true});
  await page.addInitScript(()=>{window.regionPad={id:'Standard Xbox regional copper journey',index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.regionPad];});
  await page.goto('/?debug');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed);
  // Only injected standard Gamepad input changes gameplay. Debug state and the
  // saved transaction are read for steering/assertions; no navigation, mining,
  // interaction, placement or inventory methods are called by this journey.
  await tap(page,9);const route=page.locator(`[data-controller-key="destination-${destination}"]`);
  for(let i=0;i<36;i++){if(await route.evaluate(el=>el===document.activeElement))break;await tap(page,13);}
  await expect(route).toBeFocused();await tap(page,0);await page.waitForFunction(()=>!window.starAgent.state.transiting&&window.starAgent.state.body==='selene'&&window.starAgent.state.controller.armed);
  await tap(page,3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed');
  await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');
  await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.3);await stop(page);
  await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
  await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>12);await stop(page);expect(await page.evaluate(()=>window.starAgent.state.insideShip)).toBe(false);
  await page.waitForFunction(()=>window.starAgent.state.mining.regionalDeposits?.some(r=>r.ready&&r.dominant==='copper'));
  const chosen=await page.evaluate(()=>{
    const n=window.starAgent.navigation,field=n.surfaceObstacles,origin=n.position.clone(),named=[field.ground.position,...field.provinces.map(p=>p.position)];
    const candidates=window.starAgent.state.mining.regionalDeposits.filter(r=>r.dominant==='copper'&&r.resourceWeights[1]>.5).map(r=>{
      const p=origin.clone().fromArray(r.position),d=p.clone().sub(origin),length2=d.lengthSq();
      const clearance=Math.min(...named.filter(c=>c.distanceTo(origin)<1000).map(c=>{const t=Math.max(0,Math.min(1,c.clone().sub(origin).dot(d)/length2));return c.distanceTo(origin.clone().addScaledVector(d,t));}));
      const a=n.toShipLocal(origin),b=n.toShipLocal(p);let crossesShip=false;
      for(let i=1;i<20;i++){const q=a.clone().lerp(b,i/20);if(Math.abs(q.x)<9&&q.z> -8&&q.z<10)crossesShip=true;}
      return {...r,namedSiteDistance:Math.min(...named.map(c=>c.distanceTo(p))),routeClearance:clearance,crossesShip};
    });
    return candidates.filter(r=>!r.crossesShip&&r.routeClearance>6&&r.namedSiteDistance>80).sort((a,b)=>a.distance-b.distance)[0]??null;
  });
  expect(chosen,'reachable copper-rich regional deposit outside the named-site exclusion').not.toBeNull();expect(chosen.id).toMatch(/^selene-deposit-v\d+-/);expect(chosen.namedSiteDistance).toBeGreaterThan(80);
  const beforeWalk=await page.evaluate(()=>window.starAgent.state.position);await page.screenshot({path:`${evidence}/copper-region-route-start.png`});
  const walk=await walkTo(page,chosen.position);await aim(page,chosen.position);
  await page.waitForFunction(id=>window.starAgent.state.mining.inspection?.rockId===id&&window.starAgent.state.mining.tool.hit!==null,chosen.id);
  await page.screenshot({path:`${evidence}/regional-copper-outcrop-before.png`});
  const before=await page.evaluate(()=>({revision:window.starAgent.state.mining.activeRevision,pack:window.starAgent.state.mining.pack,position:window.starAgent.state.position}));
  expect(Math.hypot(...before.position.map((v,i)=>v-beforeWalk[i]))).toBeGreaterThan(50);
  if(!await page.evaluate(()=>window.starAgent.state.mining.tool.selected))await tap(page,15);
  await button(page,7,true);await page.waitForFunction(({id,revision})=>window.starAgent.state.mining.activeRock===id&&window.starAgent.state.mining.activeRevision>=revision+4,{id:chosen.id,revision:before.revision});
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.beaming);await page.screenshot({path:`${evidence}/regional-copper-controller-beam.png`});await button(page,7,false);
  await page.waitForFunction(()=>!window.starAgent.state.mining.pending);
  const mined=await page.evaluate(()=>window.starAgent.state.mining),gain=mined.pack.map((v,i)=>v-before.pack[i]);
  expect(gain[1]).toBeGreaterThan(.1);expect(gain[1]).toBeGreaterThan(gain[0]);expect(gain[1]).toBeGreaterThan(gain[2]);expect(mined.saved).toBe(true);
  await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();await expect(page.locator('#cargo-dialog [data-item="copper"][data-from="pack"]').first()).toBeVisible();
  await page.screenshot({path:`${evidence}/regional-copper-backpack.png`});await tap(page,13);expect(await page.locator('#cargo-dialog [data-controller-selected]').count()).toBe(1);await tap(page,1);await expect(page.locator('#cargo-dialog')).not.toBeVisible();await page.waitForFunction(()=>window.starAgent.state.controller.armed&&window.starAgent.state.mode==='walk');
  const saved=await page.evaluate(({key,id})=>{const data=JSON.parse(localStorage.getItem(key));return {rock:data.rocks[id],pack:data.pack};},{key:saveKey,id:chosen.id});
  expect(saved.rock.revision).toBe(mined.activeRevision);expect(typeof saved.rock.field).toBe('string');
  await page.reload();await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed);
  const restored=await page.evaluate(({key,id})=>{const data=JSON.parse(localStorage.getItem(key));return {rock:data.rocks[id],pack:window.starAgent.state.mining.pack};},{key:saveKey,id:chosen.id});expect(restored).toEqual(saved);
  await tap(page,8);await expect(page.locator('#cargo-dialog [data-item="copper"][data-from="pack"]').first()).toBeVisible();await page.screenshot({path:`${evidence}/regional-copper-backpack-after-reload.png`});await tap(page,1);await expect(page.locator('#cargo-dialog')).not.toBeVisible();
  const environment=await page.evaluate(()=>{const gl=document.getElementById('viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),renderScale:window.starAgent.state.renderScale};});
  await writeFile(`${evidence}/evidence.json`,JSON.stringify({browser:browser.version(),viewport:page.viewportSize(),environment,input:'Injected standard Gamepad; no keyboard/mouse or debug gameplay mutation. Reload checks saved field and cargo, not a second physical return.',chosen,beforeWalk,walk,before,mined,gain,savedRevision:saved.rock.revision,saveRestored:true,errors},null,2));expect(errors).toEqual([]);
});

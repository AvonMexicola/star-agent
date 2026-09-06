import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {MiningStore,MINING_KEY} from '../src/mining/store.js';
import {itemById} from '../src/inventory/containers.js';
const evidence='/tmp/star-agent-build-gameplay';
const fullKit=process.env.BUILD_FULL_KIT==='1';
test.afterEach(async({page},info)=>{
  if(info.status===info.expectedStatus)return;
  const state=await page.evaluate(()=>{const s=window.starAgent?.state,n=window.starAgent?.navigation,gl=document.getElementById('viewport')?.getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return {storage:Object.fromEntries(Object.entries(localStorage)),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,build:s?.build,mode:s?.mode,position:s?.position,shipLocal:s?.shipLocal,insideShip:s?.insideShip,controller:s?.controller,enabled:n?.enabled,axes:window.testPad?.axes,interaction:s?.interaction};}).catch(error=>({error:error.message}));
  await mkdir(evidence,{recursive:true});await writeFile(`${evidence}/failure-state.json`,JSON.stringify(state,null,2));
});
const axes=(page,values)=>page.evaluate(values=>window.testPad.axes=values,values);
const setButton=(page,index,down)=>page.evaluate(({index,down})=>window.testPad.buttons[index]={pressed:down,value:Number(down)},{index,down});
const tap=async(page,index)=>{await setButton(page,index,true);await page.waitForFunction(i=>window.starAgent.navigation.gamepad.previous[i],index,{timeout:10000});await setButton(page,index,false);await page.waitForFunction(i=>!window.starAgent.navigation.gamepad.previous[i],index,{timeout:10000});};
async function choose(page,key){const selector=`[data-controller-key="${key}"]`;for(let i=0;i<90;i++){if(await page.locator(selector).evaluate(el=>el===document.activeElement))break;await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);await tap(page,13);}await expect(page.locator(selector)).toBeFocused();await tap(page,0);}
async function aim(page,point){for(let i=0;i<150;i++){const error=await page.evaluate(point=>{const n=window.starAgent.navigation,local=n.position.clone().fromArray(point).sub(n.position).applyQuaternion(n.orientation.clone().invert());return [Math.atan2(local.x,-local.z),Math.atan2(local.y,Math.hypot(local.x,local.z))];},point);if(Math.abs(error[0])<.035&&Math.abs(error[1])<.035){await axes(page,[0,0,0,0]);return;}const axis=v=>Math.sign(v)*Math.min(.7,.2+Math.abs(v));await axes(page,[0,0,axis(error[0]),axis(-error[1])]);await page.waitForTimeout(100);}throw Error('Controller aim did not converge');}
async function walk(page,point,distance=1){await aim(page,point);await axes(page,[0,-1,0,0]);await page.waitForFunction(({point,distance})=>window.starAgent.navigation.position.distanceTo(window.starAgent.navigation.position.clone().fromArray(point))<distance,{point,distance},{timeout:60000});await axes(page,[0,0,0,0]);}
async function strafe(page,distance){const start=await page.evaluate(()=>window.starAgent.state.position);await axes(page,[1,0,0,0]);await page.waitForFunction(({start,distance})=>window.starAgent.navigation.position.distanceTo(window.starAgent.navigation.position.clone().fromArray(start))>=distance,{start,distance},{timeout:30000});await axes(page,[0,0,0,0]);await page.waitForFunction(()=>window.starAgent.navigation.gamepad.armed);console.log('strafe completed',distance,await page.evaluate(()=>({position:window.starAgent.state.position,preview:window.starAgent.state.build.preview})));}
async function walkOnClaim(page,x,z){
  if(fullKit)z=-z;
  const target=await page.evaluate(({x,z})=>{const c=window.starAgent.state.build.claims[0],n=window.starAgent.navigation,q=n.orientation.clone().fromArray(c.quaternion),local=n.position.clone().sub(n.position.clone().fromArray(c.origin)).applyQuaternion(q.clone().invert());return local.set(x,local.y,z).applyQuaternion(q).add(n.position.clone().fromArray(c.origin)).toArray();},{x,z});
  await aim(page,target);
  for(let i=0;i<240;i++){
    const step=await page.evaluate(({x,z})=>{const c=window.starAgent.state.build.claims[0],n=window.starAgent.navigation,q=n.orientation.clone().fromArray(c.quaternion),local=n.position.clone().sub(n.position.clone().fromArray(c.origin)).applyQuaternion(q.clone().invert()),delta=local.clone().set(x-local.x,0,z-local.z),distance=delta.length();delta.applyQuaternion(q).applyQuaternion(n.orientation.clone().invert());return {distance,local:local.toArray(),axes:[delta.x,delta.z]};},{x,z});
    if(step.distance<.12){await axes(page,[0,0,0,0]);console.log('precise walking waypoint',step.local);return step.local;}
    const length=Math.hypot(...step.axes),speed=step.distance<.6?.25:.55;await axes(page,step.axes.map(v=>v/length*speed).concat([0,0]));await page.waitForTimeout(100);
  }
  await axes(page,[0,0,0,0]);throw Error(`Controller failed to reach claim-local ${x},${z}`);
}
const claimPoint=(page,point)=>page.evaluate(point=>{const c=window.starAgent.state.build.claims[0],n=window.starAgent.navigation;return n.position.clone().fromArray(point).applyQuaternion(n.orientation.clone().fromArray(c.quaternion)).add(n.position.clone().fromArray(c.origin)).toArray();},fullKit?[point[0],point[1],-point[2]]:point);
async function selectPiece(page,id){if(!(await page.locator('#build-dialog').isVisible()))await tap(page,2);await choose(page,`build-piece-${id}`);await page.waitForFunction(()=>window.starAgent.state.controller.armed);}
async function place(page,id){console.log(`place ${id}`,await page.evaluate(()=>window.starAgent.state.build.preview));await page.waitForFunction(()=>window.starAgent.state.build.preview?.valid,null,{timeout:10000});const before=await page.evaluate(()=>window.starAgent.state.build.pieceCount);await tap(page,7);await page.waitForFunction(before=>window.starAgent.state.build.pieceCount===before+1,before);}

async function placeAt(page,id,point){
  await aim(page,await claimPoint(page,[point[0],id==='crate'?point[1]+.01:0,point[2]]));
  await tap(page,9);await choose(page,'build');await choose(page,`build-piece-${id}`);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
  let found=false;
  for(let i=0;i<24;i++){
    const candidate=await page.evaluate(()=>{const b=window.starAgent.state.build,c=b.claims[0],n=window.starAgent.navigation;return n.position.clone().fromArray(b.preview.position).sub(n.position.clone().fromArray(c.origin)).applyQuaternion(n.orientation.clone().fromArray(c.quaternion).invert()).toArray();});
    if(Math.hypot(...candidate.map((value,i)=>value-(fullKit&&i===2?-point[i]:point[i])))<.03){found=true;break;}
    await tap(page,6);
  }
  expect(found,`Controller snap for ${id} at ${point}`).toBe(true);
  await page.screenshot({path:`${evidence}/${id}-preview.png`});await place(page,id);await tap(page,1);
}

async function takeFromShip(page,id,total){
  for(;;){
    const current=await page.evaluate(id=>window.starAgent.state.build.materials[id]??0,id);if(current>=total)return;
    const source=await page.evaluate(id=>window.starAgent.state.containers.containers.find(c=>c.id==='ship').items[id],id),stack=Math.min(source,itemById(id).stack);
    const key=await page.locator(`[data-from="ship"][data-item="${id}"]`).first().getAttribute('data-controller-key');await choose(page,key);
    await choose(page,stack>total-current?'transfer-one':'transfer-stack');
  }
}

async function extendFullKit(page,{approach,rampPoint,cabinPoint}){
  const haul=async quantities=>{
    console.log('additional cargo trip',quantities);
    await walkOnClaim(page,4,3);await walkOnClaim(page,-2,3);await walkOnClaim(page,-2,-3);await walk(page,approach,1);await walk(page,rampPoint,1);await walk(page,cabinPoint,1);await page.waitForFunction(()=>window.starAgent.state.insideShip);
    await tap(page,8);await choose(page,'location-ship');
    for(const [id,total] of Object.entries(quantities))await takeFromShip(page,id,total);
    await tap(page,1);await walk(page,rampPoint,1);await walk(page,approach,1);await walkOnClaim(page,-2,-3);await walkOnClaim(page,-2,3);await walkOnClaim(page,7.5,3);
  };
  await test.step('Controller hauls and constructs the remaining kit',async()=>{
    await haul({concrete:12,glass:2,'metal-stock':5});
    await walkOnClaim(page,7.5,3);await walkOnClaim(page,7.5,-4);
    await placeAt(page,'foundation',[4,.3,-4]);
    await walkOnClaim(page,7.5,3);
    await haul({concrete:16});
    await walkOnClaim(page,7.5,3);await walkOnClaim(page,7.5,-4);
    await placeAt(page,'wall',[2,.3,-4]);await placeAt(page,'window',[6,.3,-4]);await placeAt(page,'doorway',[4,.3,-6]);
    await walkOnClaim(page,7.5,3);await haul({concrete:8,'metal-stock':5});
    await walkOnClaim(page,7.5,3);await walkOnClaim(page,7.5,-4);
    // Fit the ground-floor crate before capping the room; utility placement
    // otherwise selects the highest supporting panel at its target.
    await walkOnClaim(page,7.5,-8);await walkOnClaim(page,4,-8);await aim(page,await claimPoint(page,[4,1.2,-6]));
    await page.waitForFunction(()=>window.starAgent.state.interaction.includes('base door'));await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.build.claims[0].pieces.find(p=>p.type==='doorway').doorOpen);
    await walkOnClaim(page,4,-4.7);await placeAt(page,'crate',[5,.3,-4.5]);
    await walkOnClaim(page,4,-8);await aim(page,await claimPoint(page,[4,1.2,-6]));await tap(page,2);await page.waitForFunction(()=>!window.starAgent.state.build.claims[0].pieces.find(p=>p.type==='doorway').doorOpen);
    await placeAt(page,'floor',[4,3.3,-4]);
    const types=await page.evaluate(()=>window.starAgent.state.build.claims[0].pieces.map(p=>p.type));
    expect(types.filter(id=>id==='foundation')).toHaveLength(2);expect([...new Set(types)].sort()).toEqual(['crate','doorway','floor','foundation','mainframe','stairs','wall','window']);
  });
  await test.step('Controller operates the physical door and crate',async()=>{
    await walkOnClaim(page,7.5,-8);await walkOnClaim(page,4,-8);await aim(page,await claimPoint(page,[4,1.2,-6]));
    await page.waitForFunction(()=>window.starAgent.state.interaction.includes('base door'));await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.build.claims[0].pieces.find(p=>p.type==='doorway').doorOpen);
    await walkOnClaim(page,4,-4.7);await aim(page,await claimPoint(page,[5,1,-4.5]));
    await page.waitForFunction(()=>window.starAgent.state.interaction.includes('Base storage'));await tap(page,2);await expect(page.locator('#cargo-dialog')).toBeVisible();
    const crateId=await page.evaluate(()=>window.starAgent.state.containers.target);
    let key=await page.locator('[data-from="pack"][data-item="metal-stock"]').first().getAttribute('data-controller-key');await choose(page,key);await choose(page,'transfer-stack');
    expect(await page.evaluate(id=>window.starAgent.state.containers.containers.find(c=>c.id===id).items['metal-stock'],crateId)).toBe(1);
    await page.screenshot({path:`${evidence}/crate-controller-transfer.png`});
    key=await page.locator(`[data-from="${crateId}"][data-item="metal-stock"]`).first().getAttribute('data-controller-key');await choose(page,key);await choose(page,'transfer-stack');
    expect(await page.evaluate(()=>window.starAgent.state.build.materials['metal-stock'])).toBe(1);await tap(page,1);
    await walkOnClaim(page,4,-8);await aim(page,await claimPoint(page,[4,1.2,-6]));await tap(page,2);await page.waitForFunction(()=>!window.starAgent.state.build.claims[0].pieces.find(p=>p.type==='doorway').doorOpen);
    await page.screenshot({path:`${evidence}/door-controller-closed.png`});
  });
  await test.step('Controller enables and fills the physical mainframe buffer',async()=>{
    await tap(page,9);await choose(page,'equipment');await expect(page.locator('#cargo-dialog')).toBeVisible();await tap(page,1);
    await walkOnClaim(page,7.5,-8);await walkOnClaim(page,7.5,3);await walkOnClaim(page,0,3);await aim(page,await claimPoint(page,[0,.8,0]));
    await page.waitForFunction(()=>window.starAgent.state.interaction.includes('Base mainframe'));await tap(page,2);await expect(page.locator('#build-dialog')).toBeVisible();
    await choose(page,'build-buffer-toggle');expect(await page.evaluate(()=>window.starAgent.state.build.claims[0].useBuffer)).toBe(true);
    await choose(page,'build-supplies');await expect(page.locator('#cargo-dialog')).toBeVisible();
    const bufferId=await page.evaluate(()=>window.starAgent.state.containers.target),key=await page.locator('[data-from="pack"][data-item="metal-stock"]').first().getAttribute('data-controller-key');
    await choose(page,key);await choose(page,'transfer-stack');expect(await page.evaluate(id=>window.starAgent.state.containers.containers.find(c=>c.id===id).items['metal-stock'],bufferId)).toBe(1);
    await page.screenshot({path:`${evidence}/mainframe-controller-buffer.png`});await tap(page,1);
  });
  await test.step('Controller walks from the stairs onto the supported upper floor',async()=>{
    await walkOnClaim(page,4,3);await walkOnClaim(page,4,-1.7);const local=await walkOnClaim(page,4,-4);expect(local[1]).toBeGreaterThan(4.9);
    await aim(page,await claimPoint(page,[4,.8,1]));await page.screenshot({path:`${evidence}/upper-floor-controller.png`});
  });
}

test(fullKit?'controller constructs and uses all eight base pieces with physical cargo trips':'controller lands, carries finite construction supplies, claims ground and builds a walkable staircase',async({page,browser})=>{
  test.setTimeout(900000);page.setDefaultTimeout(90000);const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER ERROR',e.message);});await mkdir(evidence,{recursive:true});
  // Explicit phase-1 imported-material fixture. No construction, movement or pose
  // is injected. Supplies obey actual container mass and stack limits.
  const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},store=new MiningStore(storage);
  let initial={...store.state,boxes:{...store.state.boxes,pack:2,ship:8}};
  initial=store.withItems(initial,'pack',{...store.container('pack',initial).items,concrete:12,'metal-stock':5,conductor:3,glass:2});
  initial=store.withItems(initial,'ship',{...store.container('ship',initial).items,concrete:fullKit?48:40,'metal-stock':12,glass:2});
  expect(store.validContainers(initial)).toBe(true);expect(store.write(initial)).toBe(true);
  await page.addInitScript(({key,save})=>{if(!sessionStorage.getItem('build-fixture-loaded')){localStorage.setItem(key,save);sessionStorage.setItem('build-fixture-loaded','1');}window.testPad={id:'Injected standard construction controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.testPad];},{key:MINING_KEY,save:memory.get(MINING_KEY)});
  await page.goto('/?intro=0&debug');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed&&window.starAgent.state.mining.ready);
  console.log('renderer',await page.evaluate(()=>{const gl=document.getElementById('viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);}));
  let cabinPoint,rampPoint;
  await test.step('Menu transit, real landing and physical hatch exit',async()=>{
    console.log('landing');await tap(page,9);await choose(page,'destination-moon');await page.waitForFunction(()=>window.starAgent.state.body==='selene'&&!window.starAgent.state.transiting&&window.starAgent.state.controller.armed);
    console.log('at Selene');await tap(page,3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed');console.log('landed');await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');console.log('standing in cabin');
    await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.3);await axes(page,[0,0,0,0]);cabinPoint=await page.evaluate(()=>window.starAgent.state.position);await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
    console.log('hatch open');await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>14);await axes(page,[0,0,0,0]);rampPoint=await page.evaluate(()=>window.starAgent.state.position);
    await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>26);await axes(page,[0,0,0,0]);expect(await page.evaluate(()=>window.starAgent.state.insideShip)).toBe(false);
  });
  const approach=await page.evaluate(()=>window.starAgent.state.position);
  await test.step('Claim a real surface site and place a foundation',async()=>{
    console.log('claim');if(fullKit){const start=await page.evaluate(()=>window.starAgent.state.position);await axes(page,[0,1,0,0]);await page.waitForFunction(start=>window.starAgent.navigation.position.distanceTo(window.starAgent.navigation.position.clone().fromArray(start))>=3,start);await axes(page,[0,0,0,0]);}
    await tap(page,9);await choose(page,'build');await choose(page,'build-piece-mainframe');await page.waitForFunction(()=>window.starAgent.state.controller.armed);await place(page,'mainframe');
    await strafe(page,4);await selectPiece(page,'foundation');
    for(let i=0;i<4&&!await page.evaluate(()=>window.starAgent.state.build.preview?.valid);i++){console.log('foundation rejection',await page.evaluate(()=>window.starAgent.state.build.preview?.reason));await strafe(page,1);}
    await place(page,'foundation');await tap(page,1);
  });
  const foundation=await page.evaluate(()=>{const c=window.starAgent.state.build.claims[0],p=c.pieces.find(p=>p.type==='foundation'),n=window.starAgent.navigation;return n.position.clone().fromArray(p.position).applyQuaternion(n.orientation.clone().fromArray(c.quaternion)).add(n.position.clone().fromArray(c.origin)).toArray();});
  await test.step('Walk back aboard for the staircase materials',async()=>{
    console.log('cargo trip');await walk(page,approach,1.5);
    await walk(page,rampPoint,1.2);await walk(page,cabinPoint,1.2);await page.waitForFunction(()=>window.starAgent.state.insideShip);
    await tap(page,8);await choose(page,'location-ship');
    for(const [id,total] of [['concrete',12],['metal-stock',4]])await takeFromShip(page,id,total);
    await tap(page,1);await walk(page,rampPoint,1.2);await walk(page,approach,1.5);
  });
  await test.step('Place and physically climb the staircase',async()=>{
    console.log('stairs');await aim(page,foundation);await tap(page,9);await choose(page,'build');await choose(page,'build-piece-stairs');await page.waitForFunction(()=>window.starAgent.state.controller.armed);if(fullKit){await tap(page,5);await tap(page,5);}await place(page,'stairs');await tap(page,1);
    await page.waitForFunction(()=>window.starAgent.state.build.assetsReady);await page.screenshot({path:`${evidence}/stairs-placement.png`});
    const stairs=await page.evaluate(()=>window.starAgent.state.build.claims[0].pieces.find(p=>p.type==='stairs'));
    if(fullKit){await walkOnClaim(page,7.5,-3);await walkOnClaim(page,7.5,3);}
    await walkOnClaim(page,stairs.position[0],stairs.position[2]+3);
    const climbed=await walkOnClaim(page,stairs.position[0],stairs.position[2]-1.7);expect(climbed[1]).toBeGreaterThan(4.2);
    await aim(page,await claimPoint(page,[stairs.position[0],stairs.position[1]+.8,stairs.position[2]+1]));
    await page.screenshot({path:`${evidence}/stairs-climbed.png`});
  });
  if(fullKit)await extendFullKit(page,{approach,rampPoint,cabinPoint});
  await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();await tap(page,13);await page.screenshot({path:`${evidence}/backpack-return.png`});await tap(page,1);
  const result=await page.evaluate(()=>window.starAgent.state.build),contents=await page.evaluate(()=>Object.fromEntries(window.starAgent.state.containers.containers.map(c=>[c.id,c.items])));
  await page.reload();await page.waitForFunction(()=>window.starAgent?.state.ready);expect(await page.evaluate(()=>window.starAgent.state.build.claims)).toEqual(JSON.parse(JSON.stringify(result.claims)));
  if(fullKit)expect(await page.evaluate(()=>Object.fromEntries(window.starAgent.state.containers.containers.map(c=>[c.id,c.items])))).toEqual(contents);
  const renderer=await page.evaluate(()=>{const gl=document.getElementById('viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
  await writeFile(`${evidence}/${fullKit?'full-kit-':''}journey.json`,JSON.stringify({browser:browser.version(),renderer,viewport:page.viewportSize(),fullKit,input:'Injected standard Gamepad; physical device untested; debug read-only steering',fixture:`22 kg pack stock and ${fullKit?62:54} kg ship materials supplied before game load; no local-economy completion claim`,result,errors},null,2));expect(errors).toEqual([]);
});

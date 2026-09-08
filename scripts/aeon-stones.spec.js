import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {AEON,bodySurfacePoint} from '../src/celestial.js';
import {findDestinations} from '../src/world.js';
import {nearbyAeonStones} from '../src/mining/aeon-stones.js';

const baseline=process.env.STONE_QA_BASELINE==='1';
const frames=page=>page.evaluate(()=>new Promise(resolve=>{let count=0;const frame=()=>{if(++count===5)resolve();else requestAnimationFrame(frame);};requestAnimationFrame(frame);}));
function errorsFor(page){const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});return errors;}
async function ready(page){await page.waitForFunction(()=>window.starAgent?.state.ready&&!window.starAgent.state.transiting);await expect(page.locator('#loading')).toHaveCSS('opacity','0');}
async function environment(page,browser){return {browser:browser.version(),viewport:page.viewportSize(),...await page.evaluate(()=>{const s=window.starAgent.state,gl=document.querySelector('#viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {backend:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),scale:s.renderScale,drawCalls:s.drawCalls,triangles:s.triangles,mining:s.mining,position:s.position};})};}
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus&&!page.isClosed())await writeFile(info.outputPath('failure-state.json'),JSON.stringify(await page.evaluate(()=>window.starAgent?.state).catch(()=>null),null,2));});

test('actual Aeon stones render at walking and approach distances',async({page,browser},info)=>{
  const errors=errorsFor(page),origin=bodySurfacePoint(new Vector3(...findDestinations().forest),AEON,2);
  const d=nearbyAeonStones(origin).find(d=>d.variant===3);
  await page.goto('/?intro=0&debug=1&seed=7291');await ready(page);
  await page.evaluate(()=>{window.starAgent.openingSequence?.leave();for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();});await frames(page);
  await page.setViewportSize({width:1600,height:900});
  for(const distance of [6,55,100]){
    const eye=new Vector3(-distance*.35,1.5+distance*.08,distance).applyQuaternion(d.quaternion).add(d.position);
    const target=new Vector3(0,.4,0).applyQuaternion(d.quaternion).add(d.position);
    await page.evaluate(({eye,target,up})=>{
      const a=window.starAgent,n=a.navigation;a.setRenderScale(1);
      n.position.fromArray(eye);n.mode='walk';n.insideShip=false;n.dockedAtStation=false;n.enabled=false;n.velocity.set(0,0,0);n.angularVelocity.set(0,0,0);n.orientToward(n.position.clone().fromArray(target),n.position.clone().fromArray(up));
      document.querySelectorAll('body > :not(canvas):not(script)').forEach(e=>e.style.visibility='hidden');
    },{eye:eye.toArray(),target:target.toArray(),up:d.direction});
    await page.waitForFunction(()=>window.starAgent.state.terrainLod.settled&&window.starAgent.state.vegetation.pendingTiles===0,null,{timeout:90000});await frames(page);
    expect(await page.evaluate(()=>window.starAgent.state.drawCalls)).toBeGreaterThan(0);
    expect(new Vector3(...await page.evaluate(()=>window.starAgent.state.position)).distanceTo(eye)).toBeLessThan(.001);
    if(!baseline){await page.waitForFunction(()=>window.starAgent.state.rockMaterial.ready);expect((await page.evaluate(()=>window.starAgent.state.mining.looseStones)).stones).toBeGreaterThan(0);}
    await page.screenshot({path:info.outputPath(`${baseline?'before':'after'}-${distance}m.png`)});
  }
  await writeFile(info.outputPath('render.json'),JSON.stringify({baseline,fixture:d.id,environment:await environment(page,browser),errors},null,2));expect(errors).toEqual([]);
});

const axes=(page,values)=>page.evaluate(values=>window.stonePad.axes=values,values);
const button=(page,index,down)=>page.evaluate(({index,down})=>window.stonePad.buttons[index]={pressed:down,value:Number(down)},{index,down});
async function tap(page,index){await button(page,index,true);await frames(page);await button(page,index,false);await frames(page);}
async function choose(page,key){
  for(let i=0;i<90;i++){if(await page.evaluate(()=>document.activeElement?.dataset.controllerKey)===key){await tap(page,0);return;}await tap(page,13);}
  throw Error(`Controller could not reach ${key}`);
}
async function aim(page,point){
  for(let i=0;i<180;i++){
    const error=await page.evaluate(point=>{const n=window.starAgent.navigation,local=n.position.clone().fromArray(point).sub(n.position).applyQuaternion(n.orientation.clone().invert());return [Math.atan2(local.x,-local.z),Math.atan2(local.y,Math.hypot(local.x,local.z))];},point);
    if(Math.abs(error[0])<.025&&Math.abs(error[1])<.025){await axes(page,[0,0,0,0]);return;}
    const axis=v=>Math.sign(v)*Math.min(.65,.18+Math.abs(v));await axes(page,[0,0,axis(error[0]),axis(-error[1])]);await frames(page);
  }
  throw Error('Controller aim did not converge');
}

test('controller travels, lands, walks to Aeon stone, mines and processes its feedstock',async({page,browser},info)=>{
  test.skip(baseline,'new stone gameplay belongs to the candidate');
  const errors=errorsFor(page);
  await page.addInitScript(()=>{window.stonePad={id:'Aeon stone standard Gamepad fixture',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.stonePad];});
  await page.goto('/?intro=0&debug=1&seed=7291&dev=1&ship=nomad&start=orbit');await ready(page);await frames(page);console.log('Controller world ready');
  await tap(page,9);await choose(page,'destination-forest');console.log('Controller transit selected');await ready(page);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
  console.log('Controller forest arrival');await tap(page,3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed');console.log('Controller landed');
  await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');
  await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.5);await axes(page,[0,0,0,0]);
  await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.doorProgress>.98);
  await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>12);await axes(page,[0,0,0,0]);
  expect((await page.evaluate(()=>window.starAgent.state)).insideShip).toBe(false);
  console.log('Controller reached Aeon ground');
  if(await page.evaluate(()=>window.starAgent.state.mining.tool.item!=='mining-laser-tool'))await tap(page,15);
  const position=new Vector3(...await page.evaluate(()=>window.starAgent.state.position));
  const descriptor=nearbyAeonStones(position).find(d=>d.variant===3||d.variant===5);
  const d={id:descriptor.id,position:descriptor.position.toArray(),quaternion:descriptor.quaternion.toArray()};
  expect(d).toBeTruthy();
  await aim(page,d.position);await axes(page,[0,-1,0,0]);await page.waitForFunction(p=>window.starAgent.navigation.position.distanceTo(window.starAgent.navigation.position.clone().fromArray(p))<5.5,d.position);await axes(page,[0,0,0,0]);
  console.log('Controller reached stone',d.id);
  // Sweep real cutter aim across the exposed face as its surface is excavated.
  // Use the player's view plane: a rock's seeded yaw can otherwise send every
  // local-X sample down the same already-empty borehole.
  const view=await page.evaluate(d=>{
    const n=window.starAgent.navigation,center=n.position.clone().fromArray(d.position),forward=center.clone().sub(n.position).normalize(),up=center.clone().normalize();
    const right=forward.clone().cross(up).normalize(),vertical=right.clone().cross(forward).normalize();
    return {right:right.toArray(),up:vertical.toArray()};
  },d);
  const startMass=await page.evaluate(()=>window.starAgent.state.mining.pack[0]);
  for(let attempt=0;attempt<40;attempt++){
    const target=new Vector3(...d.position).addScaledVector(new Vector3(...view.right),(attempt%5-2)*.45).addScaledVector(new Vector3(...view.up),-.15+(Math.floor(attempt/5)%5)*.25).toArray();
    await aim(page,target);await button(page,7,true);await page.waitForTimeout(1800);await button(page,7,false);await frames(page);
    const mass=await page.evaluate(()=>window.starAgent.state.mining.pack[0]);console.log('Cutter recovered basalt',mass);
    if(mass-startMass>=2)break;
  }
  const mined=await page.evaluate(()=>window.starAgent.state.mining.pack[0]);expect(mined-startMass).toBeGreaterThanOrEqual(2);
  await page.screenshot({path:info.outputPath('controller-mined.png')});
  // Modal, focus and disconnect all suppress a held trigger until neutral.
  await button(page,7,true);await tap(page,9);await expect(page.locator('#controller-menu')).toBeVisible();await page.waitForFunction(()=>!window.starAgent.state.mining.pending);
  const paused=await page.evaluate(()=>window.starAgent.state.mining.pack[0]);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.mining.pack[0])).toBe(paused);
  await button(page,7,false);await frames(page);await choose(page,'recipes');await expect(page.locator('#build-dialog')).toBeVisible();await choose(page,'recipe-aggregate');await choose(page,'recipe-mineral-binder');
  const materials=await page.evaluate(()=>window.starAgent.state.build.materials);expect(materials.aggregate).toBe(1);expect(materials['mineral-binder']).toBe(1);expect(materials.basalt).toBeCloseTo(paused-2,6);
  await page.screenshot({path:info.outputPath('controller-recipes.png')});
  await page.setViewportSize({width:390,height:844});await frames(page);expect(await page.locator('#build-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await page.screenshot({path:info.outputPath('controller-recipes-phone.png')});await page.setViewportSize({width:1440,height:900});await frames(page);
  await button(page,7,true);await tap(page,1);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(page,7,false);await frames(page);
  await button(page,7,true);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await frames(page);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);
  await button(page,7,false);await frames(page);await page.evaluate(()=>window.stonePad.connected=false);await frames(page);await button(page,7,true);await page.evaluate(()=>window.stonePad.connected=true);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(page,7,false);await frames(page);
  await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();await page.screenshot({path:info.outputPath('controller-backpack.png')});await tap(page,1);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
  await writeFile(info.outputPath('controller.json'),JSON.stringify({input:'Injected Gamepad only; read-only debug steering; physical device untested',mined,materials,environment:await environment(page,browser),errors},null,2));expect(errors).toEqual([]);
});

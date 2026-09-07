import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {findDestinations} from '../src/world.js';
import {AEON,bodySurfacePoint} from '../src/celestial.js';
import {nearbyLandmarks} from '../src/landmark-distribution.js';

const site=bodySurfacePoint(new Vector3(...findDestinations().forest),AEON,2),formations=nearbyLandmarks(site,4200);
const ledge=formations.find(d=>d.variant%6===0),bridge=formations.filter(d=>d.variant===2||d.variant===8).sort((a,b)=>a.position.distanceTo(site)-b.position.distanceTo(site))[0];
const frames=page=>page.evaluate(()=>new Promise(resolve=>{let n=0;function frame(){if(++n===5)resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame);}));
const world=(d,p)=>new Vector3(...p).multiplyScalar(d.scale).applyQuaternion(d.quaternion).add(d.position);
function errorsFor(page){const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});return errors;}
async function ready(page){await page.waitForFunction(()=>window.starAgent?.state.ready&&!window.starAgent.state.transiting,null,{timeout:90000});await expect(page.locator('#loading')).toHaveCSS('opacity','0');}
async function environment(page,browser){return {timestamp:new Date().toISOString(),browser:browser.version(),viewport:page.viewportSize(),...await page.evaluate(()=>{const s=window.starAgent.state,gl=document.querySelector('#viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {backend:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),scale:s.renderScale,drawCalls:s.drawCalls,triangles:s.triangles,position:s.position,landmarks:s.landmarks,terrain:s.terrainLod};})};}
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus&&!page.isClosed())await writeFile(info.outputPath('failure-state.json'),JSON.stringify(await page.evaluate(()=>window.starAgent?.state).catch(()=>null),null,2));});

test('seeded landmarks render in the game from ground, shelter and descent views',async({page,browser},info)=>{
  const errors=errorsFor(page),captures=[];
  const views=[
    {name:'escarpment',d:ledge,eye:[165,65,95],target:[-2,38,0]},
    {name:'shelter',d:ledge,eye:[34,3,40],target:[-5,39,0],ground:true},
    {name:'bridge',d:bridge,eye:[5,3,105],target:[0,36,0],ground:true},
    {name:'descent-1400m',d:ledge,eye:[700,1400,600],target:[0,0,0]},
    {name:'descent-5000m',d:ledge,eye:[1300,5000,1000],target:[0,0,0]},
  ];
  for(const baseline of [true,false]){
    if(baseline&&process.env.LANDMARK_SKIP_BASELINE==='1')continue;
    await page.goto(`${baseline?'http://127.0.0.1:5178':''}/?intro=0&debug=1&seed=7291`);await ready(page);
    await page.evaluate(()=>{window.starAgent.openingSequence?.leave();for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();});await frames(page);
    for(const view of views){
      if(baseline&&view.name!=='escarpment'&&view.name!=='descent-1400m')continue;
      const {d}=view;let eye=world(d,view.eye);eye=bodySurfacePoint(eye.clone().normalize(),AEON,view.ground?1.8:view.eye[1]);
      const target=world(d,view.target);
      await page.evaluate(({eye,target,up})=>{
        const a=window.starAgent,n=a.navigation;a.setRenderScale(1);n.mode='walk';n.insideShip=false;n.dockedAtStation=false;n.enabled=false;
        n.position.fromArray(eye);n.velocity.set(0,0,0);n.angularVelocity.set(0,0,0);n.orientToward(n.position.clone().fromArray(target),n.position.clone().fromArray(up));
        document.querySelectorAll('body > :not(canvas):not(script)').forEach(e=>e.style.visibility='hidden');
      },{eye:eye.toArray(),target:target.toArray(),up:d.direction.toArray()});
      await page.waitForFunction(()=>window.starAgent.state.terrainLod.settled&&(window.starAgent.state.altitude>3500||window.starAgent.state.vegetation.pendingTiles===0),null,{timeout:90000});
      if(!baseline)await page.waitForFunction(()=>window.starAgent.state.landmarks.pending===0&&window.starAgent.state.rockMaterial.ready);
      await frames(page);expect(await page.evaluate(()=>window.starAgent.state.drawCalls)).toBeGreaterThan(0);
      expect(new Vector3(...await page.evaluate(()=>window.starAgent.state.position)).distanceTo(eye)).toBeLessThan(.001);
      const name=`${baseline?'before':'after'}-${view.name}`;
      await page.screenshot({path:info.outputPath(`${name}.png`)});captures.push({name,fixture:d.id,eye:eye.toArray(),target:target.toArray(),environment:await environment(page,browser)});
    }
  }
  // Continuous camera motion crosses both geometry transitions, with no reload.
  const motion=[];
  for(const distance of [350,430,500,575,650,1450,1575,1750,1925,2100]){
    const eye=world(ledge,[distance*.45,130,distance]);
    await page.evaluate(({eye,target})=>{const n=window.starAgent.navigation;n.position.fromArray(eye);n.orientToward(n.position.clone().fromArray(target),n.normal);},{eye:eye.toArray(),target:world(ledge,[0,40,0]).toArray()});
    await frames(page);const state=await page.evaluate(()=>window.starAgent.state.landmarks);expect(state.visible).toBeGreaterThan(0);motion.push({distance,...state});
    if([500,1750].includes(distance))await page.screenshot({path:info.outputPath(`transition-${distance}m.png`)});
  }
  await writeFile(info.outputPath('render.json'),JSON.stringify({captures,motion,errors},null,2));expect(errors).toEqual([]);
});

const axes=(page,value)=>page.evaluate(value=>window.landmarkPad.axes=value,value);
const button=(page,index,down)=>page.evaluate(({index,down})=>window.landmarkPad.buttons[index]={pressed:down,value:Number(down)},{index,down});
async function tap(page,index){
  await button(page,index,true);
  try{await frames(page);await button(page,index,false);await frames(page);}
  catch(error){if(!String(error).includes('Execution context was destroyed'))throw error;await page.waitForLoadState('domcontentloaded');}
}
async function choose(page,key){for(let i=0;i<100;i++){
  if(await page.evaluate(()=>document.activeElement?.dataset.controllerKey)===key){await tap(page,0);return;}
  await tap(page,13);
}throw Error(`Controller could not reach ${key}`);}
async function tab(page,id){for(let i=0;i<8;i++){
  if(await page.locator('dialog[open]').getAttribute('data-gameplay-tab')===id)return;await tap(page,5);
}throw Error(`Controller could not reach tab ${id}`);}
async function aim(page,point){
  for(let i=0;i<180;i++){
    const e=await page.evaluate(point=>{const n=window.starAgent.navigation,p=n.position.clone().fromArray(point).sub(n.position).applyQuaternion(n.orientation.clone().invert());return [Math.atan2(p.x,-p.z),Math.atan2(p.y,Math.hypot(p.x,p.z))];},point);
    if(Math.abs(e[0])<.035&&Math.abs(e[1])<.035){await axes(page,[0,0,0,0]);return;}
    const axis=n=>Math.sign(n)*Math.min(.7,.17+Math.abs(n));await axes(page,[0,0,axis(e[0]),axis(-e[1])]);await frames(page);
  }throw Error('Controller aim did not converge');
}
async function walkTo(page,point,tolerance=4){
  let previous=Infinity,stalled=0;
  for(let i=0;i<1600;i++){
    const s=await page.evaluate(point=>{const n=window.starAgent.navigation,t=n.position.clone().fromArray(point),p=t.clone().sub(n.position).applyQuaternion(n.orientation.clone().invert());return {distance:n.position.distanceTo(t),angle:Math.atan2(p.x,-p.z),mode:n.mode};},point);
    expect(s.mode).toBe('walk');if(s.distance<tolerance){await axes(page,[0,0,0,0]);return;}
    stalled=s.distance>previous-.07?stalled+1:0;previous=s.distance;
    const turn=Math.abs(s.angle)<.025?0:Math.sign(s.angle)*Math.min(.6,.18+Math.abs(s.angle));
    // Use the same sticks a player uses; steer around a small loose stone if
    // contact stalls the direct approach. Debug state is read-only feedback.
    await axes(page,[stalled>14?.8:0,Math.abs(s.angle)<.6?-1:0,turn,0]);
    await page.waitForTimeout(160);
  }throw Error('Controller walking route did not reach its waypoint');
}

test('controller selects Aeon flight, lands, exits and walks beneath a seeded ledge',async({page,browser},info)=>{
  const errors=errorsFor(page);
  await page.addInitScript(()=>{window.landmarkPad={id:'Landmark traversal standard Gamepad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.landmarkPad];});
  await page.goto('/?dev=1&ship=nomad&start=orbit&intro=0&debug=1&seed=7291');await ready(page);await page.waitForFunction(()=>window.starAgent.state.controller.armed,null,{timeout:15000});
  await tap(page,9);
  if(await page.locator('dialog[open]').getAttribute('data-gameplay-tab')){
    await tab(page,'dev');await choose(page,'dev-page-launch');await choose(page,'dev-location-forest');
    await choose(page,'dev-launch');await page.waitForURL('**start=forest**');
  }else await choose(page,'destination-forest'); // Bounded PR also runs before the newer menu stack.
  await ready(page);await page.waitForFunction(()=>window.starAgent.state.controller.armed,null,{timeout:15000});
  console.log('Controller selected actual forest flight');
  await tap(page,3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed',null,{timeout:90000});
  await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');
  await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.5);await axes(page,[0,0,0,0]);
  await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.doorProgress>.98);
  await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>12);await axes(page,[0,0,0,0]);
  expect(await page.evaluate(()=>window.starAgent.state.insideShip)).toBe(false);console.log('Controller physically exited cabin onto Aeon');
  const position=new Vector3(...await page.evaluate(()=>window.starAgent.state.position)),d=nearbyLandmarks(position,1800).filter(d=>d.variant%6===0).sort((a,b)=>a.position.distanceTo(position)-b.position.distanceTo(position))[0];
  const local=position.clone().sub(d.position).applyQuaternion(d.quaternion.clone().invert()),sign=local.z>=0?1:-1;
  await button(page,10,true);
  for(const z of [sign*115,sign*42,0,-sign*42,-sign*115]){
    const target=bodySurfacePoint(world(d,[38,0,z]).normalize(),AEON,1.65);
    await aim(page,target.toArray());await walkTo(page,target.toArray());console.log('Controller shelter waypoint',z);
    if(z===0){
      await button(page,10,false);await aim(page,world(d,[22,47,-sign*12]).toArray());
      await page.screenshot({path:info.outputPath('controller-under-ledge.png')});await button(page,10,true);
    }
  }
  await button(page,10,false);
  // Input interruption must not replay a held movement after opening Inventory.
  await axes(page,[0,-1,0,0]);await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();
  await axes(page,[0,0,0,0]);await frames(page); // Arm the dialog before testing its exit gate.
  await axes(page,[0,-1,0,0]);await tap(page,1);await expect(page.locator('#cargo-dialog')).not.toBeVisible();await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);
  const paused=await page.evaluate(()=>window.starAgent.state.position);await frames(page);
  expect(new Vector3(...await page.evaluate(()=>window.starAgent.state.position)).distanceTo(new Vector3(...paused))).toBeLessThan(.001);
  for(const transition of ['focus','disconnect']){
    await page.evaluate(kind=>{if(kind==='focus')window.dispatchEvent(new Event('blur'));else window.landmarkPad.connected=false;},transition);await frames(page);
    await page.evaluate(()=>{window.landmarkPad.connected=true;window.dispatchEvent(new Event('focus'));});await frames(page);
    expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);
  }
  await axes(page,[0,0,0,0]);await page.waitForFunction(()=>window.starAgent.state.controller.armed,null,{timeout:15000});
  await page.screenshot({path:info.outputPath('controller-return-to-play.png')});
  await writeFile(info.outputPath('controller.json'),JSON.stringify({fixture:d.id,input:'Injected standard Gamepad from menu entry through flight, physical landing/cabin exit, shelter traversal and return; no direct pose writes; physical device untested',environment:await environment(page,browser),errors},null,2));expect(errors).toEqual([]);
});

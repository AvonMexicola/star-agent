import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {findDestinations} from '../src/world.js';
import {AEON,bodySurfacePoint} from '../src/celestial.js';
import {nearbyLandmarks} from '../src/landmark-distribution.js';

const site=bodySurfacePoint(new Vector3(...findDestinations().forest),AEON,2);
const formations=nearbyLandmarks(site,4200),ledge=formations.find(d=>d.variant%6===0);
const bridge=formations.filter(d=>d.variant%6===2).sort((a,b)=>a.position.distanceTo(site)-b.position.distanceTo(site))[0];
const world=(d,p)=>new Vector3(...p).multiplyScalar(d.scale).applyQuaternion(d.quaternion).add(d.position);
const frames=page=>page.evaluate(()=>new Promise(resolve=>{let count=0;function frame(){if(++count===8)resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame);}));

async function pose(page,d,eye,target){
  await page.evaluate(({eye,target,up})=>{
    const a=window.starAgent,n=a.navigation;a.setRenderScale(1);
    n.mode='walk';n.insideShip=false;n.dockedAtStation=false;n.enabled=false;
    n.position.fromArray(eye);n.velocity.set(0,0,0);n.angularVelocity.set(0,0,0);
    n.orientToward(n.position.clone().fromArray(target),n.position.clone().fromArray(up));
    document.querySelectorAll('body > :not(canvas):not(script)').forEach(e=>e.style.visibility='hidden');
  },{eye:eye.toArray(),target:target.toArray(),up:d.direction.toArray()});
  await page.waitForFunction(()=>{
    const s=window.starAgent.state;
    return s.terrainLod.settled&&(s.altitude>3500||s.vegetation.pendingTiles===0)
      &&s.landmarks.pending===0&&s.rockMaterial.ready;
  },null,{timeout:90000});
  await frames(page);
  expect(new Vector3(...await page.evaluate(()=>window.starAgent.state.position)).distanceTo(eye)).toBeLessThan(.001);
}
async function state(page){return page.evaluate(()=>{
  const s=window.starAgent.state,gl=document.querySelector('#viewport').getContext('webgl2');
  const debug=gl.getExtension('WEBGL_debug_renderer_info');
  return {backend:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
    scale:s.renderScale,draws:s.drawCalls,triangles:s.triangles,landmarks:s.landmarks,
    position:s.position,terrain:s.terrainLod,rockMaterial:s.rockMaterial};
});}

test('landmark material reads in actual low-flight, close, shelter and LOD views',async({page,browser},info)=>{
  const errors=[],captures=[],motion=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const views=[
    {name:'low-flight',d:ledge,eye:[165,65,95],target:[-2,38,0]},
    {name:'close-face',d:ledge,eye:[85,12,35],target:[-2,31,0]},
    {name:'shelter',d:ledge,eye:[34,1.8,40],target:[-5,39,0]},
    {name:'bridge',d:bridge,eye:[5,1.8,105],target:[0,36,0]},
    {name:'descent-1400m',d:ledge,eye:[700,1400,600],target:[0,0,0]},
  ];
  for(const baseline of [true,false]){
    if(baseline&&process.env.WEATHERING_SKIP_BASELINE==='1')continue;
    await page.goto(`${baseline?(process.env.WEATHERING_BASELINE??'http://127.0.0.1:5178'):''}/?intro=0&debug=1&seed=7291`);
    await page.waitForFunction(()=>window.starAgent?.state.ready&&!window.starAgent.state.transiting,null,{timeout:90000});
    await expect(page.locator('#loading')).toHaveCSS('opacity','0');
    await page.evaluate(()=>{window.starAgent.openingSequence?.leave();for(const d of document.querySelectorAll('dialog[open]'))d.close();});
    for(const v of views){
      const eye=bodySurfacePoint(world(v.d,v.eye).normalize(),AEON,v.eye[1]),target=world(v.d,v.target);
      await pose(page,v.d,eye,target);const s=await state(page);
      expect(s.landmarks.visible).toBeGreaterThan(0);expect(s.rockMaterial.error).toBeNull();
      const name=`${baseline?'before':'after'}-${v.name}`;
      await page.screenshot({path:info.outputPath(`${name}.png`)});
      captures.push({name,fixture:v.d.id,eye:eye.toArray(),target:target.toArray(),...s});
      console.log('Captured',name);
    }
  }
  for(const distance of [350,450,500,570,650,1500,1750,1950,2100]){
    const eye=world(ledge,[distance*.45,130,distance]);
    await pose(page,ledge,eye,world(ledge,[0,40,0]));
    const s=await state(page);expect(s.landmarks.visible).toBeGreaterThan(0);motion.push({distance,...s});
    if([500,1750].includes(distance))await page.screenshot({path:info.outputPath(`transition-${distance}m.png`)});
  }
  await writeFile(info.outputPath('material.json'),JSON.stringify({timestamp:new Date().toISOString(),browser:browser.version(),viewport:page.viewportSize(),captures,motion,errors},null,2));
  expect(errors).toEqual([]);
});

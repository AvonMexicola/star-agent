import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {rockFormationHeight} from '../src/rock-formations.js';
import {MIASMA,SELENE,PYRE,AEON} from '../src/celestial.js';
import {MIASMA_SITES} from '../src/miasma-world.js';
import {MOON_LANDING_DIRECTION} from '../src/moon-world.js';
import {fromPyreBody,toPyreBody} from '../src/pyre-world.js';
import {findDestinations} from '../src/world.js';
import {SUN_POSITION} from '../src/stellar-world.js';

// Find representative outcrops near real destinations, using the seeded field.
// No authored rock or special terrain is inserted for these screenshots.
function view(body,center,seed){
 const up=new Vector3(...center).normalize(),east=new Vector3(0,1,0).cross(up).normalize(),north=up.clone().cross(east);
 const viewAxis=new Vector3(...SUN_POSITION).sub(new Vector3(...body.center)).normalize();
 viewAxis.addScaledVector(up,-viewAxis.dot(up)).normalize().applyAxisAngle(up,.55);
 let best={score:-Infinity};
 for(let u=-220;u<=220;u+=6)for(let v=-220;v<=220;v+=6){
  const d=up.clone().addScaledVector(east,u/body.radius).addScaledVector(north,v/body.radius).normalize();
  const local=body.id==='pyre'?toPyreBody(...d.toArray()):d.toArray(),h=rockFormationHeight(...local,body.radius,seed);
  if(h<14)continue;
  const eye=d.clone().addScaledVector(viewAxis,80/body.radius).normalize();
  const base=body.height(...d.toArray())-h,ground=body.height(...eye.toArray());
  const score=h-Math.abs(ground-base)*2;
  if(score>best.score)best={score,eye:eye.toArray(),target:d.clone().multiplyScalar(body.radius+base+h*.4).add(new Vector3(...body.center)).toArray(),relief:h};
 }
 if(!best.eye)throw new Error(`No outcrop near ${body.id}`);return {...best,body:body.id};
}
const cases=[view(MIASMA,MIASMA_SITES[2].direction,0x4d494153),view(SELENE,MOON_LANDING_DIRECTION,0x53454c45),view(PYRE,fromPyreBody(.9,.15,.4),0x50595245),view(AEON,findDestinations().forest,7291)];
test('seeded formations render during descent and on all four surfaces',async({page,browser})=>{
 const dir='/tmp/star-agent-rocks',errors=[],states=[],assets=[];await mkdir(dir,{recursive:true});
 page.on('response',response=>{if(response.url().includes('/materials/outcrops/'))assets.push({url:response.url(),status:response.status()});});
 page.on('pageerror',e=>{errors.push(e.message);console.log(e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log(m.text());}});
 await page.goto('/?intro=0&debug');await page.waitForFunction(()=>window.starAgent?.state.ready);
 await page.waitForFunction(()=>window.starAgent.state.rockMaterial.ready);
 expect(await page.evaluate(()=>window.starAgent.state.rockMaterial.error)).toBeNull();
 expect(assets.length).toBe(3);expect(assets.every(a=>a.status===200)).toBe(true);
 await page.keyboard.press('Shift+Tab');
 for(const c of cases){
  for(const altitude of (c.body==='miasma'?[350,4]:[4])){
   await page.evaluate(({c,altitude})=>{
    const s=window.starAgent,n=s.navigation;
    if(c.body==='miasma')n.transitMiasma(altitude,c.eye);else if(c.body==='selene')n.transitMoon(altitude,c.eye);else if(c.body==='pyre')n.transitPyre(altitude,c.eye);else n.transit(c.eye,altitude);
    n.enabled=false;s.setRenderScale(.4);n.orientToward(n.position.clone().set(...c.target),n.normal);
   },{c,altitude});
   await page.waitForFunction(body=>{
    const s=window.starAgent.state;if(s.body!==body)return false;
    if(body==='miasma'||body==='pyre')return s[body].ready&&s[body].lod>= (s.altitude<10?16:11);
    return body==='selene'?s.moon.lod>=16:s.lod>=16&&s.pending===0;
   },c.body,{timeout:300000});
   if(c.body==='selene')await page.evaluate(async()=>{for(let i=0;i<90;i++)await new Promise(r=>requestAnimationFrame(r));});
   await page.evaluate(async()=>{window.starAgent.setRenderScale(1);for(let i=0;i<8;i++)await new Promise(r=>requestAnimationFrame(r));});
   const name=`${c.body}-${altitude}m`;await page.screenshot({path:`${dir}/${name}.png`});console.log(`Captured ${name}`);
   states.push({name,view:c,state:await page.evaluate(()=>window.starAgent.state)});expect(errors).toEqual([]);
  }
 }
 const backend=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL);});
 await writeFile(`${dir}/environment.json`,JSON.stringify({browser:browser.version(),backend,viewport:[1280,800],assets,errors,states},null,2));
});

// A corrupted local map must keep the old terrain usable, without shader errors.
test('invalid rock maps fall back without breaking the renderer',async({page})=>{
 const errors=[],warnings=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 await page.route('**/materials/outcrops/roughness.jpg',route=>route.fulfill({path:'docs/images/rock-formations/miasma-4m.png',contentType:'image/png'}));
 await page.goto('/?intro=0&debug');await page.waitForFunction(()=>window.starAgent?.state.ready);
 await page.waitForFunction(()=>window.starAgent.state.rockMaterial.error);
 const state=await page.evaluate(()=>window.starAgent.state.rockMaterial);expect(state.ready).toBe(false);expect(state.error).toContain('dimensions');
 expect(warnings.some(w=>w.includes('Rock maps unavailable'))).toBe(true);expect(errors).toEqual([]);
 await page.screenshot({path:'/tmp/star-agent-rocks/material-fallback.png'});
});

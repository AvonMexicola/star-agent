import {test,expect} from '@playwright/test';
import {steer,mapBody} from '../tests/browser/navigation-helpers.js';
import {mkdir,writeFile} from 'node:fs/promises';
const path='/tmp/star-agent-miasma';
async function setup(page){
 await mkdir(path,{recursive:true});const errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.log(e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log(m.text().slice(0,2500));}});
 await page.goto('/?intro=0&debug&epoch=1788000000000');await page.waitForFunction(()=>window.starAgent?.state.ready);return errors;
}
async function capture(page,name){
 await page.evaluate(async()=>{window.starAgent.setRenderScale(1);for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));});
 await page.screenshot({path:`${path}/${name}.png`});console.log(`Captured ${name}`);
 return page.evaluate(()=>window.starAgent.state);
}
test('Pyre twilight and Miasma orbit, clouds, descent and ground render',async({page,browser})=>{
 const errors=await setup(page),states=[];
 await page.keyboard.press('h');await page.locator('#quick-transit-menu summary').click();await page.locator('[data-destination="pyre"]').click();
 await page.waitForFunction(()=>window.starAgent.state.body==='pyre'&&!window.starAgent.state.transiting);await page.keyboard.press('Shift+Tab');
 await page.evaluate(()=>{window.starAgent.navigation.enabled=false;window.starAgent.setRenderScale(.5);});
 await page.waitForFunction(()=>{const p=window.starAgent.state.pyre;return p.error||p.ready&&p.mapsReady;},null,{timeout:240000});
 states.push(await capture(page,'pyre-twilight'));expect(errors).toEqual([]);
 const lighting=await page.evaluate(()=>{const n=window.starAgent.navigation;return n.sunDirection.applyQuaternion(n.orientation.clone().invert()).toArray();});expect(lighting[0]).toBeLessThan(-.99);
 await page.evaluate(()=>window.starAgent.navigation.enabled=true);await page.keyboard.press('h');await page.locator('#quick-transit-menu summary').click();await page.locator('[data-destination="miasma"]').click();
 await page.waitForFunction(()=>window.starAgent.state.body==='miasma'&&!window.starAgent.state.transiting);
 await page.evaluate(()=>{window.starAgent.navigation.enabled=false;window.starAgent.setRenderScale(.5);});
 await page.waitForFunction(()=>window.starAgent.state.miasma.error||window.starAgent.state.miasma.ready,null,{timeout:240000});
 states.push(await capture(page,'miasma-orbit'));expect(errors).toEqual([]);
 await page.waitForTimeout(5000);states.push(await capture(page,'miasma-weather'));
 for(const altitude of [5000,100,8]){
  await page.evaluate(altitude=>{
   const s=window.starAgent,n=s.navigation;
   const sun=n.sunDirection,site=s.miasmaSites.reduce((best,site)=>site.direction.reduce((v,x,i)=>v+x*sun.toArray()[i],0)>best.score?{direction:site.direction,score:site.direction.reduce((v,x,i)=>v+x*sun.toArray()[i],0)}:best,{score:-2});
   n.transitMiasma(altitude,site.direction);n.enabled=false;s.setRenderScale(.5);
   const up=n.normal,east=up.clone().set(0,1,0).cross(up).normalize();
   n.orientToward(n.position.clone().addScaledVector(up,-altitude).addScaledVector(east,altitude<10?14:altitude*.7),up);
  },altitude);
  await page.waitForFunction(altitude=>{const m=window.starAgent.state.miasma;return m.error||m.ready&&Math.abs(m.surfaceAltitude-altitude)<.1&&m.lod>=(altitude<100?16:altitude<200?14:7);},altitude,{timeout:240000});
  states.push(await capture(page,`miasma-${altitude}m`));expect(errors).toEqual([]);expect(states.at(-1).body).toBe('miasma');expect(states.at(-1).miasma.error).toBeNull();expect(states.at(-1).miasma.ready).toBe(true);
 }
 await page.keyboard.press('Shift+Tab');await expect(page.locator('#toxic-warning')).toBeVisible();await expect(page.locator('#pyre-composition')).toContainText('SULPHUR');await capture(page,'miasma-survey');
 await page.evaluate(()=>{const n=window.starAgent.navigation;n.enabled=true;n.transitPyre();});await page.keyboard.press('m');await mapBody(page,'miasma');
 await expect(page.locator('#map-target-name')).toHaveText('Miasma');await expect(page.locator('#map-engage')).toBeEnabled();await capture(page,'map');
 const backend=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL);});
 await writeFile(`${path}/environment.json`,JSON.stringify({browser:browser.version(),backend,viewport:[1280,800],errors,states},null,2));expect(errors).toEqual([]);
});

test('charged interplanetary approaches preserve continuous flight and 20 km clearance',async({page})=>{
 const errors=await setup(page);
 await page.evaluate(()=>window.starAgent.setRenderScale(.4));await page.keyboard.press('m');await page.locator('[data-travel-target="pyre"]').click();
 await expect(page.locator('#map-approach')).toHaveText('20 km');await expect(page.locator('#map-engage')).toBeEnabled();await page.locator('#map-engage').click();await steer(page,'pyre','keyboard');await page.keyboard.press('n');
 await page.waitForFunction(()=>window.starAgent.state.travel?.phase==='cruising',null,{timeout:60000});
 await page.waitForFunction(()=>!window.starAgent.state.travel&&window.starAgent.state.body==='pyre',null,{timeout:300000});
 const arrival=await page.evaluate(()=>{const s=window.starAgent,n=s.navigation;return {state:s.state,sun:n.sunDirection.applyQuaternion(n.orientation.clone().invert()).toArray()};});
 expect(arrival.state.altitude).toBeCloseTo(20000,0);expect(arrival.state.speed).toBe(0);
 await page.keyboard.press('Shift+Tab');await capture(page,'drive-arrival');await page.keyboard.press('Shift+Tab');
 await page.evaluate(()=>window.starAgent.navigation.transitPyre());await page.keyboard.press('m');await mapBody(page,'miasma');await expect(page.locator('#map-engage')).toBeEnabled();await page.locator('#map-engage').click();await steer(page,'miasma','keyboard');await page.keyboard.press('n');
 await page.waitForFunction(()=>!window.starAgent.state.travel&&window.starAgent.state.body==='miasma',null,{timeout:90000});
 expect(await page.evaluate(()=>window.starAgent.state.altitude)).toBeCloseTo(20000,0);expect(errors).toEqual([]);
 await writeFile(`${path}/drive.json`,JSON.stringify({arrival,moon:await page.evaluate(()=>window.starAgent.state),errors},null,2));
});

test('Miasma supports physical landing, hatch exit, reboarding and launch',async({page})=>{
 const errors=await setup(page);
 await page.evaluate(()=>{const s=window.starAgent;s.setRenderScale(.4);s.navigation.transitMiasma(20,s.miasmaSites[0].direction);});
 await page.keyboard.press('l');await page.waitForFunction(()=>window.starAgent.state.mode==='landed',null,{timeout:90000});
 await page.waitForFunction(()=>{const s=window.starAgent.state;return s.miasma.ready&&s.miasma.lod>=16;},null,{timeout:240000});
 const landed=await page.evaluate(()=>window.starAgent.state);expect(landed.body).toBe('miasma');expect(landed.miasma.fragments).toBeGreaterThan(100);
 await page.keyboard.press('f');await page.keyboard.down('w');await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.3);await page.keyboard.up('w');await page.keyboard.press('x');
 await page.keyboard.press('f');await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
 await page.keyboard.down('w');await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>12);await page.keyboard.up('w');await page.keyboard.press('x');
 const outside=await page.evaluate(()=>window.starAgent.state);expect(outside.insideShip).toBe(false);expect(outside.body).toBe('miasma');expect(outside.altitude).toBeCloseTo(1.75,4);
 await capture(page,'walking');await page.evaluate(()=>window.starAgent.setRenderScale(.4));
 await page.keyboard.down('s');await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]<-1.4);await page.keyboard.up('s');await page.keyboard.press('x');await page.keyboard.press('f');
 await page.waitForFunction(()=>window.starAgent.state.mode==='landed');await page.keyboard.press('l');await page.waitForFunction(()=>window.starAgent.state.mode==='flight');
 expect(await page.evaluate(()=>window.starAgent.state.altitude)).toBeGreaterThan(10);expect(errors).toEqual([]);
 await writeFile(`${path}/boarding.json`,JSON.stringify({landed,outside,errors},null,2));
 // Existing worlds still render after the third atmosphere has been active.
 for(const body of ['aeon','selene','pyre','star']){
  await page.evaluate(body=>{const s=window.starAgent,n=s.navigation;if(body==='aeon')n.orbit();else if(body==='selene')n.transitMoon(1000000);else if(body==='pyre')n.transitPyre();else n.transitStar();n.enabled=false;s.setRenderScale(.5);if(body==='selene')n.orientToward(n.position.clone().sub(n.normal.clone().multiplyScalar(2000000)),n.normal.clone().set(0,1,0));},body);
  await page.waitForTimeout(2500);await capture(page,`${body}-regression`);expect(errors).toEqual([]);
 }
});

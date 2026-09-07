import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
test('thin toxic atmosphere and Claude flora render with stable placement and wind',async({page,browser})=>{
 const dir='/tmp/star-agent-miasma-flora',errors=[],states=[];await mkdir(dir,{recursive:true});
 page.on('pageerror',e=>{errors.push(e.message);console.log(e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log(m.text().slice(0,2000));}});
 await page.goto('/?intro=0&debug');await page.waitForFunction(()=>window.starAgent?.state.ready);await page.keyboard.press('Tab');
 await page.evaluate(()=>{const s=window.starAgent;s.navigation.transitMiasma();s.navigation.enabled=false;s.setRenderScale(.5);});
 await page.waitForFunction(()=>window.starAgent.state.miasma.ready);
 async function shot(name){await page.evaluate(async()=>{window.starAgent.setRenderScale(1);for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));});await page.screenshot({path:`${dir}/${name}.png`});states.push({name,state:await page.evaluate(()=>window.starAgent.state)});console.log(`Captured ${name}`);expect(errors).toEqual([]);}
 await shot('thin-orbit');
 for(const altitude of [5000,5]){
  await page.evaluate(alt=>{
   const s=window.starAgent,n=s.navigation,sun=n.sunDirection;
   const site=s.miasmaSites.map(site=>({...site,score:site.direction.reduce((v,x,i)=>v+x*sun.toArray()[i],0)})).sort((a,b)=>b.score-a.score)[0];
   n.transitMiasma(alt,site.direction);n.enabled=false;s.setRenderScale(.5);
   const up=n.normal,east=up.clone().set(0,1,0).cross(up).normalize();
   n.orientToward(n.position.clone().addScaledVector(east,alt<10?50:alt*.7).addScaledVector(up,alt<10?-2:-alt),up);
  },altitude);
  await page.waitForFunction(alt=>{const m=window.starAgent.state.miasma;return m.ready&&Math.abs(m.surfaceAltitude-alt)<.1&&(alt>100||m.flora.loaded);},altitude,{timeout:240000});
  await shot(altitude===5?'alien-grove':'thin-descent');
 }
 const flora=states.at(-1).state.miasma.flora;expect(flora.errors).toEqual([]);expect(flora.counts.filter(c=>c>0).length).toBe(4);expect(flora.counts.reduce((a,b)=>a+b,0)).toBeGreaterThan(15);
 await page.waitForTimeout(3000);await shot('grove-wind');
 await page.keyboard.press('Tab');await expect(page.locator('#toxic-warning')).toBeVisible();await shot('grove-hud');
 // Landing must clear authored trees away from the physical ramp/cabin.
 await page.evaluate(()=>{const s=window.starAgent;s.navigation.enabled=true;s.setRenderScale(.4);});await page.keyboard.press('l');
 await page.waitForFunction(()=>window.starAgent.state.mode==='landed',null,{timeout:90000});expect(await page.evaluate(()=>window.starAgent.state.body)).toBe('miasma');
 await page.waitForFunction(()=>window.starAgent.state.miasma.ready);await shot('landed-grove');
 await page.evaluate(()=>{const s=window.starAgent;s.navigation.transitPyre();s.navigation.enabled=false;s.setRenderScale(.5);});
 await page.waitForFunction(()=>window.starAgent.state.pyre.ready);await page.keyboard.press('Tab');await shot('pyre-companion');
 const backend=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL);});
 await writeFile(`${dir}/environment.json`,JSON.stringify({browser:browser.version(),backend,viewport:[1280,800],errors,states},null,2));expect(errors).toEqual([]);
});

import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {MOON_LANDING_DIRECTION,MOON_RADIUS,LANDING_FRAME} from '../src/moon-world.js';
const district=(x,z)=>{const d=MOON_LANDING_DIRECTION.map((v,i)=>v+(LANDING_FRAME.east[i]*x+LANDING_FRAME.north[i]*z)/MOON_RADIUS),l=Math.hypot(...d);return d.map(v=>v/l);};

test('Selene pebbles and fractured rocks render on the landing shelf and copper ejecta',async({page,browser})=>{
 const path='/tmp/star-agent-moon-stones',errors=[],states=[];await mkdir(path,{recursive:true});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/?debug&seed=7291');await page.waitForFunction(()=>window.starAgent?.state.ready);await page.keyboard.press('Shift+Tab');
 for(const shot of [{name:'landing-shelf',direction:MOON_LANDING_DIRECTION},{name:'copper-ejecta',direction:district(2600,-3400)}]){
  await page.evaluate(({direction})=>{
   const s=window.starAgent,n=s.navigation;n.transitMoon(1.75,direction);n.enabled=false;s.setRenderScale(.5);
   const up=n.normal,east=up.clone().set(0,1,0).cross(up).normalize();n.orientToward(n.position.clone().addScaledVector(east,5).addScaledVector(up,-1.3),up);
  },shot);
  await page.waitForFunction(()=>window.starAgent.state.moon.lod>=16&&window.starAgent.state.moon.effects.settled);
  await page.evaluate(async()=>{window.starAgent.setRenderScale(1);for(let i=0;i<6;i++)await new Promise(r=>requestAnimationFrame(r));});
  let state=await page.evaluate(()=>window.starAgent.state);expect(errors).toEqual([]);expect(state.moon.effects.stones.pebbles).toBeGreaterThan(1500);expect(state.moon.effects.stones.rocks).toBeGreaterThan(500);states.push(state);
  await page.screenshot({path:`${path}/${shot.name}.png`});
  if(shot.name==='landing-shelf'){
   await page.evaluate(()=>{const n=window.starAgent.navigation;n.position.addScaledVector(n.normal.clone().set(0,1,0).cross(n.normal).normalize(),3);});
   await page.evaluate(async()=>{for(let i=0;i<5;i++)await new Promise(r=>requestAnimationFrame(r));});
   state=await page.evaluate(()=>window.starAgent.state);expect(state.moon.effects.stones.rebuilds).toBeGreaterThan(states[0].moon.effects.stones.rebuilds);await page.screenshot({path:`${path}/walking.png`});
  }
 }
 await page.evaluate(()=>{const n=window.starAgent.navigation;n.position.addScaledVector(n.normal,120);});
 await page.waitForFunction(()=>!window.starAgent.state.moon.effects.stones.visible);expect(errors).toEqual([]);
 const backend=await page.evaluate(()=>{const g=document.querySelector('canvas').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return g.getParameter(e.UNMASKED_RENDERER_WEBGL);});
 await writeFile(`${path}/environment.json`,JSON.stringify({browser:browser.version(),backend,viewport:[960,600],errors,states},null,2));
});

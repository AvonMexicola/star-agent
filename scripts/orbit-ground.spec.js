import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {findDestinations,RADIUS,terrainHeight} from '../src/world.js';
import {LOCAL_CRATERS,MOON_RADIUS,MOON_POSITION,moonSurface} from '../src/moon-world.js';

const selectedAltitudes=process.env.ORBIT_ALTITUDES?.split(',').map(Number);
const captureSuffix=selectedAltitudes?'-subset':'';

const peak=(()=>{
  const start=new Vector3(...findDestinations().mountain),east=new Vector3().crossVectors(new Vector3(0,1,0),start).normalize(),north=new Vector3().crossVectors(start,east);
  let best=start,height=-Infinity;
  for(let x=-12000;x<=12000;x+=800)for(let y=-12000;y<=12000;y+=800){
    const d=start.clone().addScaledVector(east,x/RADIUS).addScaledVector(north,y/RADIUS).normalize(),h=terrainHeight(...d.toArray());
    if(h>height){best=d;height=h;}
  }
  return best.toArray();
})();

for(const body of ['aeon','selene'])test(`${body}: recognizable terrain from orbit to ground`,async({page,browser},info)=>{
  const stage=info.project.name,path=`/tmp/star-agent-orbit-ground/${stage}`,errors=[],shots=[];
  await mkdir(path,{recursive:true});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{
    window.terrainPrograms=[];const link=WebGL2RenderingContext.prototype.linkProgram;
    WebGL2RenderingContext.prototype.linkProgram=function(program){
      link.call(this,program);
      if(this.getAttachedShaders(program).some(s=>this.getShaderSource(s).includes('orbitalNormal')))window.terrainPrograms.push({gl:this,program});
    };
  });
  await page.goto('/?debug=1&seed=7291');await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.keyboard.press('Tab');
  for(const altitude of (body==='aeon'?[2000000,80000,20000,5000,500,5]:[900000,80000,5000,500,5])){
    if(selectedAltitudes&&!selectedAltitudes.includes(altitude))continue;
    const moon=body==='selene',radius=moon?MOON_RADIUS:RADIUS,direction=moon?LOCAL_CRATERS[0].direction:peak;
    const n=new Vector3(...direction),east=new Vector3().crossVectors(new Vector3(0,1,0),n).normalize();
    const eye=n.clone().addScaledVector(east,altitude*.8/radius).normalize().toArray();
    const height=moon?moonSurface(...direction).height:terrainHeight(...direction);
    const target=altitude>200000?new Vector3():n.clone().multiplyScalar(radius+height);if(moon)target.add(new Vector3(...MOON_POSITION));
    await page.evaluate(({moon,eye,altitude,target})=>{
      const nav=window.starAgent.navigation;
      if(moon)nav.transitMoon(altitude,eye);else nav.transit(eye,altitude);
      nav.enabled=false;nav.orientToward(nav.position.clone().fromArray(target),nav.normal);
      window.starAgent.setRenderScale(.5);
    },{moon,eye,altitude,target:target.toArray()});
    await page.waitForTimeout(1000);
    await page.waitForFunction(({moon,altitude})=>{
      const s=window.starAgent.state,min=altitude>200000?3:altitude>50000?6:altitude>10000?8:altitude>1000?10:altitude>20?13:16;
      return moon?s.moon.lod>=min-2:s.lod>=min&&s.pending<4;
    },{moon,altitude});
    if(stage==='after')await page.waitForFunction(moon=>{
      const s=window.starAgent.state;return moon?s.moon.effects.orbitalResolution>=2048&&s.moon.effects.settled:s.terrainDetail?.orbitalResolution>=4096&&s.terrainDetail.settled;
    },moon,{timeout:180000});
    await page.evaluate(async()=>{for(let i=0;i<12;i++)await new Promise(r=>requestAnimationFrame(r));window.starAgent.setRenderScale(1);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
    const name=`${body}-${altitude}m`;await page.screenshot({path:`${path}/${name}.png`});
    const state=await page.evaluate(()=>window.starAgent.state);shots.push({name,target:target.toArray(),eyeDirection:eye,state});
    console.log(`${stage}: ${name} captured, LOD ${moon?state.moon.lod:state.lod}`);expect(errors).toEqual([]);
    await writeFile(`${path}/${body}${captureSuffix}-shots.json`,JSON.stringify(shots,null,2));
  }
  const backend=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
  const programs=await page.evaluate(()=>window.terrainPrograms.map(({gl,program})=>({linked:gl.getProgramParameter(program,gl.LINK_STATUS),log:gl.getProgramInfoLog(program)})));
  if(stage==='after'){expect(programs.length).toBeGreaterThan(1);expect(programs.every(p=>p.linked)).toBe(true);}
  await writeFile(`${path}/${body}${captureSuffix}-environment.json`,JSON.stringify({browser:browser.version(),backend,viewport:[1280,800],scale:1,errors,programs,shots},null,2));
});

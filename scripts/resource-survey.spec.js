import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const evidence='/tmp/star-agent-resource-survey-evidence';
const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5;

test('orbital resource colors and non-overlapping desktop/mobile action controls',async({page,browser})=>{
  test.setTimeout(240000);const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await mkdir(evidence,{recursive:true});await page.setViewportSize({width:1440,height:900});await page.goto('/?debug');
  await page.waitForFunction(()=>window.starAgent?.state.ready);
  // Explicit rendering fixture: move the debug camera into a stable, sunlit
  // orbital view. This does not claim a physical flight/controller journey.
  await page.evaluate(()=>{
    const n=window.starAgent.navigation,center=n.position.clone().fromArray(window.starAgent.state.moon.position);
    n.orbit();n.enabled=false;n.velocity.set(0,0,0);
    const direction=n.position.clone().set(.45,.22,.87).normalize().lerp(n.sunDirection,.15).normalize();
    n.position.copy(center).addScaledVector(direction,window.starAgent.state.moon.radius*2.6);
    n.orientToward(center,n.position.clone().set(0,1,0));window.starAgent.setRenderScale(1);
  });
  await page.waitForFunction(()=>window.starAgent.state.moon.lod>=3&&window.starAgent.state.moon.effects.terrainBuilds===0);
  await page.waitForTimeout(1500);await expect(page.locator('#resource-survey')).toBeVisible();
  await page.screenshot({path:`${evidence}/orbit-resource-legend.png`});
  await page.keyboard.press('Tab');await page.waitForTimeout(250);
  const image=await page.screenshot({path:`${evidence}/orbit-resource-colors.png`});
  // Decode the rendered screenshot in the browser: no external PNG package or
  // density/palette data stands in for the pixels actually visible to players.
  const pixels=await page.evaluate(async data=>{
    const image=new Image();image.src=`data:image/png;base64,${data}`;await image.decode();
    const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
    const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data;
    let copper=0,ice=0,sampled=0;
    for(let y=110;y<790;y++)for(let x=380;x<1060;x++){
      if(Math.hypot(x-720,y-450)>335)continue;
      const i=(y*c.width+x)*4,r=d[i],g=d[i+1],b=d[i+2];sampled++;
      if(r>40&&r>g*1.22&&r>b*1.4)copper++;
      if(b>60&&b>r*1.12&&g>r*1.08)ice++;
    }
    return {sampled,copper,ice,classification:'Rendered orange/rust and blue/white pixel masks; these are visual color classes, not mineral quantities.'};
  },image.toString('base64'));
  await page.keyboard.press('Tab');await page.waitForTimeout(150);
  const layouts=[];
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    await page.setViewportSize(viewport);await page.waitForTimeout(400);
    const layout=await page.evaluate(()=>{
      const box=el=>{const r=el.getBoundingClientRect();return {name:el.getAttribute('aria-label')||el.id||el.textContent.trim(),left:r.left,top:r.top,right:r.right,bottom:r.bottom};};
      const visible=el=>el.getClientRects().length&&getComputedStyle(el).display!=='none';
      return {width:innerWidth,height:innerHeight,backpack:box(document.getElementById('backpack-button')),legend:box(document.getElementById('resource-survey')),telemetry:box(document.querySelector('.telemetry')),actions:[...document.querySelectorAll('.top-actions button')].filter(visible).map(box),destinations:[...document.querySelectorAll('[data-destination]')].filter(visible).map(box)};
    });
    layouts.push(layout);
    expect(overlaps(layout.legend,layout.telemetry),'resource legend / flight telemetry').toBe(false);
    for(const action of layout.actions){expect(action.left,action.name).toBeGreaterThanOrEqual(0);expect(action.right,action.name).toBeLessThanOrEqual(viewport.width);expect(action.bottom,action.name).toBeLessThanOrEqual(viewport.height);}
    for(let i=0;i<layout.actions.length;i++)for(let j=i+1;j<layout.actions.length;j++)expect(overlaps(layout.actions[i],layout.actions[j]),`${layout.actions[i].name} / ${layout.actions[j].name}`).toBe(false);
    for(const destination of layout.destinations)expect(overlaps(layout.backpack,destination),destination.name).toBe(false);
    await page.screenshot({path:`${evidence}/header-${viewport.width}.png`});
  }
  const meta=await page.evaluate(()=>{const gl=document.getElementById('viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),resourceProvinces:window.starAgent.state.moon.resourceProvinces,renderScale:window.starAgent.state.renderScale,moon:window.starAgent.state.moon};});
  await writeFile(`${evidence}/evidence.json`,JSON.stringify({browser:browser.version(),orbitalViewport:[1440,900],cameraFixture:'Debug placement at2.6 moon radii; landing hemisphere biased15% toward sun',meta,pixels,layouts,errors},null,2));
  expect(pixels.copper,'visible rust/copper colored orbital pixels').toBeGreaterThan(100);
  expect(pixels.ice,'visible blue/white ice colored orbital pixels').toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

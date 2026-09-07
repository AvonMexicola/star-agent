import {test,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {findDestinations} from '../src/world.js';
import {AEON,bodySurfacePoint} from '../src/celestial.js';
import {nearbyLandmarks} from '../src/landmark-distribution.js';

const site=bodySurfacePoint(new Vector3(...findDestinations().forest),AEON,2);
const ledge=nearbyLandmarks(site,4200).find(d=>d.variant%6===0);
const world=p=>new Vector3(...p).multiplyScalar(ledge.scale).applyQuaternion(ledge.quaternion).add(ledge.position);
const frames=(page,count=35)=>page.evaluate(count=>new Promise(resolve=>{
  let n=0;const frame=()=>++n===count?resolve():requestAnimationFrame(frame);requestAnimationFrame(frame);
}),count);
const summarize=values=>{
  const s=[...values].sort((a,b)=>a-b),n=s.length;
  return n?{samples:n,median:(s[Math.floor((n-1)/2)]+s[Math.floor(n/2)])/2,p95:s[Math.ceil(n*.95)-1]}:null;
};

// Adapted from the existing character/station GPU probes. Instruments only
// this test page; elapsed GPU queries are asynchronous, never gl.finish timing.
function installTiming(){
  const nativeContext=HTMLCanvasElement.prototype.getContext,nativeRAF=requestAnimationFrame.bind(window);
  const renderLoops=new WeakSet();let gl,ext,run,pending=[],draws=0;
  HTMLCanvasElement.prototype.getContext=function(kind,...args){
    const result=nativeContext.call(this,kind,...args);
    if(kind==='webgl2'&&this.id==='viewport'&&result&&!gl){
      gl=result;ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
      for(const key of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
        const original=gl[key];gl[key]=function(...args){draws++;return original.apply(this,args);};
      }
    }
    return result;
  };
  window.requestAnimationFrame=callback=>nativeRAF(time=>{
    if(pending.length){
      const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);
      pending=pending.filter(item=>{
        if(disjoint||performance.now()-item.started>10000){gl.deleteQuery(item.query);run.discarded++;return false;}
        if(!gl.getQueryParameter(item.query,gl.QUERY_RESULT_AVAILABLE))return true;
        const ns=gl.getQueryParameter(item.query,gl.QUERY_RESULT);gl.deleteQuery(item.query);
        if(Number.isFinite(ns)&&ns>=0)run.samples.push({...item.sample,gpuMs:ns/1e6});else run.discarded++;
        return false;
      });
      if(run.samples.length>=90)run.active=false;
    }
    const measuring=run?.active&&renderLoops.has(callback);
    let query=null;
    if(measuring&&pending.length<8&&!gl.getParameter(ext.GPU_DISJOINT_EXT)&&!gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)){
      query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
    }
    draws=0;const started=performance.now();
    try{callback(time);}finally{
      const cpuMs=performance.now()-started;
      if(draws)renderLoops.add(callback);
      if(query){
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        if(draws)pending.push({query,started,sample:{cpuMs,rafTime:time,draws}});else gl.deleteQuery(query);
      }
    }
  });
  window.landmarkTiming={
    start(){
      if(!ext)return false;
      if(pending.length)throw Error('Previous timer queries have not drained');
      run={active:true,samples:[],discarded:0};return true;
    },
    get done(){return run&&!run.active&&!pending.length;},get data(){return run;},
  };
}

async function pose(page,eye,target){
  await page.evaluate(({eye,target,up})=>{
    const a=window.starAgent,n=a.navigation;a.setRenderScale(1);
    n.mode='walk';n.insideShip=false;n.dockedAtStation=false;n.enabled=false;
    n.position.fromArray(eye);n.velocity.set(0,0,0);n.angularVelocity.set(0,0,0);
    n.orientToward(n.position.clone().fromArray(target),n.position.clone().fromArray(up));
    document.querySelectorAll('body > :not(canvas):not(script)').forEach(e=>e.style.visibility='hidden');
  },{eye:eye.toArray(),target:target.toArray(),up:ledge.direction.toArray()});
  await page.waitForFunction(()=>{
    const s=window.starAgent.state;
    return s.terrainLod.settled&&s.vegetation.pendingTiles===0&&s.landmarks.pending===0&&s.rockMaterial.ready;
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
async function measure(page){
  if(!await page.evaluate(()=>window.landmarkTiming.start()))return {supported:false};
  await page.waitForFunction(()=>window.landmarkTiming.done,null,{timeout:30000});
  const raw=await page.evaluate(()=>window.landmarkTiming.data);
  return {supported:true,discarded:raw.discarded,gpuMs:summarize(raw.samples.map(s=>s.gpuMs)),
    cpuMs:summarize(raw.samples.map(s=>s.cpuMs)),
    frameIntervalMs:summarize(raw.samples.slice(1).map((s,i)=>s.rafTime-raw.samples[i].rafTime)),samples:raw.samples};
}

test('rarer landmarks and restrained stone render across the same approach and close views',async({browser},info)=>{
  const errors=[],captures=[],motion=[],boot=[];let context,page;
  const baselineRecord=process.env.RESTRAINT_BASELINE_RECORD
    ?JSON.parse(await readFile(process.env.RESTRAINT_BASELINE_RECORD,'utf8')):null;
  if(baselineRecord){
    expect(baselineRecord.baseline).toBe('219a584');
    expect(baselineRecord.errors).toEqual([]);
    // The completed close/low-flight captures remain valid even when a later
    // candidate boot timed out. Do not reuse the superseded steep 1 km view.
    captures.push(...baselineRecord.captures.filter(c=>['before-low-flight','before-close-face'].includes(c.name)));
  }
  const views=[
    {name:'approach-1000m',eye:[700,1000,600],target:[-1800,100,-2800]},
    {name:'low-flight',eye:[165,65,95],target:[-2,38,0]},
    {name:'close-face',eye:[85,12,35],target:[-2,31,0]},
  ];
  try{
    for(const phase of baselineRecord?['after']:['before','after']){
      // Close the previous complete renderer/workers before creating the next
      // one. The comparison never keeps two game pages resident together.
      await context?.close();
      context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
      await context.addInitScript(installTiming);page=await context.newPage();
      page.on('pageerror',e=>{errors.push(e.message);console.log('Page error:',e.message);});
      page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('Console error:',m.text());}});
      await page.goto(`http://127.0.0.1:${phase==='before'?5384:5383}/?intro=0&debug=1&seed=7291`);
      const started=Date.now();
      const report=setInterval(async()=>{
        const s=await page.evaluate(()=>window.starAgent?.state.preload).catch(()=>null);
        boot.push({phase,elapsedMs:Date.now()-started,state:s});console.log('Boot',phase,JSON.stringify(s));
      },15000);
      try{await page.waitForFunction(()=>window.starAgent?.state.ready&&!window.starAgent.state.transiting,null,{timeout:180000});}
      finally{clearInterval(report);}
      console.log('Ready',phase,Date.now()-started,'ms');
      await expect(page.locator('#loading')).toHaveCSS('opacity','0');
      await page.evaluate(()=>{window.starAgent.openingSequence?.leave();for(const d of document.querySelectorAll('dialog[open]'))d.close();});
      for(const v of views){
        const eye=bodySurfacePoint(world(v.eye).normalize(),AEON,v.eye[1]),target=world(v.target);
        await pose(page,eye,target);const s=await state(page),timing=await measure(page);
        expect(s.landmarks.visible).toBeGreaterThan(0);expect(s.rockMaterial.error).toBeNull();
        const name=`${phase}-${v.name}`;await page.screenshot({path:info.outputPath(`${name}.png`)});
        captures.push({name,fixture:ledge.id,eye:eye.toArray(),target:target.toArray(),...s,timing});
        console.log(JSON.stringify({name,visible:s.landmarks.visible,landmarkDraws:s.landmarks.draws,landmarkTriangles:s.landmarks.triangles,gpuMs:timing.gpuMs,cpuMs:timing.cpuMs}));
      }
    }
    const before=captures.find(c=>c.name==='before-low-flight'),after=captures.find(c=>c.name==='after-low-flight');
    expect(after.eye).toEqual(before.eye);expect(after.target).toEqual(before.target);
    expect(after.landmarks.visible).toBeLessThan(before.landmarks.visible*.6);
    expect(after.landmarks.triangles).toBeLessThan(before.landmarks.triangles);
    for(const distance of [130,300,500,650,1750,2100]){
      await pose(page,world([distance*.45,65,distance]),world([0,40,0]));
      const s=await state(page);expect(s.landmarks.visible).toBeGreaterThan(0);motion.push({distance,...s});
      if([500,1750].includes(distance))await page.screenshot({path:info.outputPath(`transition-${distance}m.png`)});
    }
    expect(errors).toEqual([]);
  }finally{
    const finalState=await page?.evaluate(()=>({preload:window.starAgent?.state.preload,terrain:window.starAgent?.state.terrainLod,hidden:document.hidden})).catch(()=>null);
    await writeFile(info.outputPath('restraint.json'),JSON.stringify({timestamp:new Date().toISOString(),browser:browser.version(),viewport:{width:1440,height:900},
      baseline:'219a584',baselineReused:baselineRecord?.timestamp??null,
      methodology:'Same production source except population/material and fixtures. One page at a time, 35 warm frames and 90+ asynchronous elapsed GPU queries per view. Other desktop activity remains possible; a bounded observation, not exclusive-GPU FPS acceptance.',captures,motion,boot,finalState,errors},null,2));
    await context?.close();
  }
});

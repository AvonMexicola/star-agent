import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

test('measure the actual studio render on the requested GPU backend',async({page})=>{
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(`${m.type()}: ${m.text()}`);});
 await page.goto('/dev/kestrel.html');
 await page.evaluate(()=>window.kestrelStudio.ready);
 const views=[];
 for(const view of ['exterior','cockpit']){
  await page.evaluate(name=>window.kestrelStudio.view(name),view);
  await page.waitForTimeout(1500);
  const timing=await page.evaluate(()=>new Promise((resolve,reject)=>{
   const rig=window.kestrelStudio,renderer=rig.renderer,gl=renderer.getContext();
   const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
   if(!ext){reject(new Error('GPU timer queries unavailable; no GPU timing claim can be made.'));return;}
   const original=renderer.render,pending=[],cpu=[],gpu=[],interval=[];
   let last=0,submitted=0,disjoint=0,done=false;
   const summarize=values=>{const sorted=[...values].sort((a,b)=>a-b);return{samples:values.length,median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)};};
   const cleanup=()=>{renderer.render=original;for(const q of pending)gl.deleteQuery(q);clearTimeout(timeout);};
   const timeout=setTimeout(()=>{if(done)return;done=true;cleanup();reject(new Error('GPU profile did not collect 120 valid samples in 60 seconds.'));},60000);
   renderer.render=function(scene,camera){
    if(gl.getParameter(ext.GPU_DISJOINT_EXT)){
     disjoint++;for(const q of pending)gl.deleteQuery(q);pending.length=0;submitted=gpu.length;
    }
    while(pending.length&&gl.getQueryParameter(pending[0],gl.QUERY_RESULT_AVAILABLE)){
     const q=pending.shift();gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);
    }
    const now=performance.now();if(last)interval.push(now-last);last=now;
    const query=submitted<120&&pending.length<8?gl.createQuery():null;
    if(query){gl.beginQuery(ext.TIME_ELAPSED_EXT,query);submitted++;}
    const start=performance.now();original.call(this,scene,camera);const elapsed=performance.now()-start;
    if(query){cpu.push(elapsed);gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(query);}
    if(gpu.length>=120&&!done){done=true;cleanup();resolve({renderCpuMs:summarize(cpu),renderGpuMs:summarize(gpu),rafIntervalMs:summarize(interval),disjointEvents:disjoint,stats:rig.snapshot()});}
   };
  }));
  views.push({view,...timing});
  expect(timing.stats.calls).toBeLessThanOrEqual(600);
  expect(timing.stats.triangles).toBeLessThanOrEqual(900000);
 }
 const result={browser:page.context().browser().version(),cssViewport:page.viewportSize(),method:'120 asynchronous WebGL2 elapsed-time queries; CPU covers renderer.render only; RAF intervals include refresh pacing and are not GPU time.',views,errors};
 const out=process.env.KESTREL_PERF_OUT||'/tmp/kestrel-performance.json';
 await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');
 expect(errors).toEqual([]);
});

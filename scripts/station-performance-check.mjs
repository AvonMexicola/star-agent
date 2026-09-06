// Station performance: baseline GPU queries, then separate instrumented CPU/draw attribution.
// Based on hangar-hardware-check's existing asynchronous timer-query instrumentation.
// No runtime source changes, lower resolution, gl.finish or readPixels.
// node scripts/station-performance-check.mjs --url http://127.0.0.1:5249 --out /tmp/star-agent-station-performance
// Timer semantics: https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const options = { url: 'http://127.0.0.1:5249', out: '/tmp/star-agent-station-performance', frames: 60 };
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--url' || arg === '--out' || arg === '--frames') {
    const value = process.argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
    options[arg.slice(2)] = arg === '--frames' ? Number(value) : value;
  } else if (arg === '--help') {
    console.log('Usage: node scripts/station-performance-check.mjs [--url URL] [--out DIRECTORY] [--frames N>=60]');
    process.exit(0);
  } else throw new Error(`Unknown option: ${arg}`);
}
if (!Number.isSafeInteger(options.frames) || options.frames < 60) throw new Error('--frames must be an integer >=60');
const base = new URL(options.url), out = resolve(options.out);
if (!['http:', 'https:'].includes(base.protocol)) throw new Error('--url must use HTTP(S)');
await mkdir(out, { recursive: true });
const args = ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=gl'];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
// Install before the app requests a WebGL context or schedules its frame loop.
await context.addInitScript(() => {
  const nativeRAF = window.requestAnimationFrame.bind(window);
  const nativeGetContext = HTMLCanvasElement.prototype.getContext;
  const renderCallbacks = new WeakSet();
  let gl = null, ext = null, current = null, pending = [], run = null;
  let sequence = 0;
  const timerErrors = [];
  const environment = { initialized: false };
  const fail = error => {
    timerErrors.push(String(error?.message ?? error));
    if (run) run.status = 'failed';
  };
  const discardPending = reason => {
    for (const item of pending) gl.deleteQuery(item.query);
    if (run) run.discarded[reason] += pending.length;
    pending = [];
  };
  function poll() {
    if (!gl || !ext || !pending.length) return;
    try {
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) { discardPending('disjoint'); return; }
      const retained = [];
      for (const item of pending) {
        if (!gl.getQueryParameter(item.query, gl.QUERY_RESULT_AVAILABLE)) {
          if (performance.now() - item.startedAt > 10_000) { gl.deleteQuery(item.query); run.discarded.unavailable++; }
          else retained.push(item);
          continue;
        }
        const ns = gl.getQueryParameter(item.query, gl.QUERY_RESULT);
        gl.deleteQuery(item.query);
        if (Number.isFinite(ns) && ns >= 0) run.samples.push({ ...item.sample, gpuMs: ns / 1e6 });
        else run.discarded.invalid++;
      }
      pending = retained;
      if (run?.status === 'measuring' && run.samples.length >= run.target) run.status = 'draining';
      if (run?.status === 'draining' && !pending.length) run.status = 'done';
    } catch (error) { fail(error); }
  }
  HTMLCanvasElement.prototype.getContext = function(type, ...rest) {
    const result = nativeGetContext.call(this, type, ...rest);
    if (type !== 'webgl2' || this.id !== 'viewport' || !result || gl) return result;
    gl = result;
    ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    Object.assign(environment, { initialized: true,
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      version: gl.getParameter(gl.VERSION), timerExtension: Boolean(ext),
      elapsedCounterBits: ext ? gl.getQuery(ext.TIME_ELAPSED_EXT, ext.QUERY_COUNTER_BITS_EXT) : 0,
    });
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const original = gl[name];
      gl[name] = function(...parameters) {
        if (current) { current.drawCalls++; current.drawMethods[name] = (current.drawMethods[name] ?? 0) + 1; }
        return original.apply(this, parameters);
      };
    }
    return result;
  };
  window.requestAnimationFrame = callback => nativeRAF(time => {
    poll();
    const knownRenderLoop = renderCallbacks.has(callback);
    const frame = { drawCalls: 0, drawMethods: {} }, previous = current;
    current = frame;
    let query = null;
    if (run?.status === 'measuring' && knownRenderLoop && ext) {
      try {
        if (gl.getParameter(ext.GPU_DISJOINT_EXT)) run.discarded.disjoint++;
        else if (pending.length >= 16 || gl.getQuery(ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) run.discarded.busy++;
        else {
          query = gl.createQuery();
          if (!query) throw new Error('createQuery returned null');
          gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
        }
      } catch (error) { fail(error); }
    }
    const cpuStart = performance.now();
    try { callback.call(window, time); }
    finally {
      const cpuMs = performance.now() - cpuStart;
      current = previous;
      if (frame.drawCalls > 0) renderCallbacks.add(callback);
      if (run?.status === 'warming' && knownRenderLoop) {
        run.warmFrames++;
        if (run.warmFrames >= run.warmTarget) run.status = 'warm';
      }
      const measured = run?.status === 'measuring' && knownRenderLoop;
      if (measured) {
        run.renderLoopCallbacks++;
        run.rafTimes.push(time);
        if (!frame.drawCalls) run.zeroDrawCallbacks++;
      }
      if (query) {
        try {
          gl.endQuery(ext.TIME_ELAPSED_EXT);
          if (!frame.drawCalls || !measured) gl.deleteQuery(query);
          else if (gl.getParameter(ext.GPU_DISJOINT_EXT)) { gl.deleteQuery(query); run.discarded.disjoint++; }
          else pending.push({ query, startedAt: performance.now(), sample: {
            cpuMs, rafTime: time, drawCalls: frame.drawCalls, drawMethods: frame.drawMethods,
            rendererDrawCalls: window.starAgent?.state.drawCalls ?? null,
            triangles: window.starAgent?.state.triangles ?? null,
          } });
        } catch (error) { fail(error); }
      }
      // A future modal may skip rendering entirely. Record that separately with
      // no invented zero GPU timings; all four affected views still need >=60
      // actual rendered frames with valid elapsed queries.
      if (measured && run.allowNoDraw && run.zeroDrawCallbacks === run.renderLoopCallbacks && run.zeroDrawCallbacks >= run.target) run.status = 'done';
    }
  });
  window.__hardwareReview = {
    environment,
    get snapshot() { return run ? { ...run, pending: pending.length, timerErrors, drawingBuffer: gl ? [gl.drawingBufferWidth, gl.drawingBufferHeight] : null } : { timerErrors }; },
    warmup(count = 30) {
      if (pending.length) throw new Error('Previous timer queries have not drained');
      run = { id: ++sequence, status: 'warming', warmFrames: 0, warmTarget: count, target: 0,
        samples: [], rafTimes: [], renderLoopCallbacks: 0, zeroDrawCallbacks: 0,
        discarded: { disjoint: 0, unavailable: 0, invalid: 0, busy: 0 } };
    },
    measure(target, allowNoDraw = false) {
      if (!gl || !ext || !environment.elapsedCounterBits) throw new Error('Hardware elapsed queries unavailable');
      if (run?.status !== 'warm') throw new Error('Measurement requires completed warmup');
      gl.getParameter(ext.GPU_DISJOINT_EXT); // Clear prior disjoint state before this measurement.
      run.target = target; run.allowNoDraw = allowNoDraw; run.status = 'measuring';
    },
    cleanup() { if (gl) { for (const item of pending) gl.deleteQuery(item.query); pending = []; } },
  };
});
const page = await context.newPage();
page.setDefaultTimeout(240_000);
const errors = [], warnings = [], captures = [], diagnostics = [];
let environment = null, failure = null, plannedClose = false;
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); if (message.type() === 'warning') warnings.push(message.text()); });
page.on('crash', () => diagnostics.push({ event: 'page-crash', cause: 'unknown' }));
browser.on('disconnected', () => { if (!plannedClose) diagnostics.push({ event: 'browser-disconnected', cause: 'unknown' }); });

function summary(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), n = sorted.length;
  return { samples: n, median: n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
    p95: sorted[Math.max(0, Math.ceil(n * .95) - 1)], min: sorted[0], max: sorted.at(-1), mean: values.reduce((a, b) => a + b, 0) / n };
}
async function settle() {
  await page.evaluate(() => { window.__hwSettle = { key: '', since: 0 }; });
  await page.waitForFunction(() => {
    const s = window.starAgent?.state, stable = window.__hwSettle;
    if (!s?.ready || !s.station.ready || s.pending !== 0 || s.patches < 1 || s.renderScale !== 1) { stable.since = 0; return false; }
    const key = `${s.lod}:${s.patches}`;
    if (key !== stable.key || !stable.since) { stable.key = key; stable.since = performance.now(); }
    return performance.now() - stable.since >= 1000;
  }, null, { polling: 'raf' });
}
async function boot(intro) {
  const url = new URL('/', base); url.search = new URLSearchParams({ intro: String(intro), seed: '7291', debug: '1' }).toString();
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.starAgent?.state.ready && window.starAgent.state.station.ready);
  environment = await page.evaluate(() => window.__hardwareReview.environment);
  if (!environment.initialized || !environment.timerExtension || environment.elapsedCounterBits <= 0 || /swiftshader|llvmpipe|lavapipe|softpipe|software/i.test(environment.renderer) || !/AMD|Radeon|NVIDIA|Intel|Apple|Adreno|Mali|Iris|GeForce|Arc\b/i.test(environment.renderer)) {
    throw new Error(`Hardware timing claim refused: ${JSON.stringify(environment)}`);
  }
  await page.evaluate(() => {
    const app = window.starAgent; app.setRenderScale(1); app.navigation.enabled = false;
    app.navigation.keys.clear(); app.navigation.velocity.set(0, 0, 0);
    document.querySelectorAll('body > :not(canvas):not(script)').forEach(element => { element.style.visibility = 'hidden'; });
  });
  if (await page.evaluate(() => window.starAgent.state.station.finish !== 'ready')) throw new Error('Finished station assets did not load');
}
async function measure(name, fixture, allowNoDraw = false) {
  console.log(`Preparing ${name}: 30 warm frames, then >=${options.frames} valid rendered GPU queries`);
  await settle();
  await page.evaluate(() => window.__hardwareReview.warmup(30));
  await page.waitForFunction(() => ['warm', 'failed'].includes(window.__hardwareReview.snapshot.status));
  await page.evaluate(({ count, allowNoDraw }) => window.__hardwareReview.measure(count, allowNoDraw), { count: options.frames, allowNoDraw });
  await page.waitForFunction(() => ['done', 'failed'].includes(window.__hardwareReview.snapshot.status), null, { polling: 'raf' });
  const raw = await page.evaluate(() => window.__hardwareReview.snapshot);
  if (raw.status === 'failed' || raw.timerErrors.length) throw new Error(`Timer instrumentation failed: ${JSON.stringify(raw.timerErrors)}`);
  const noRendering = allowNoDraw && raw.samples.length === 0 && raw.zeroDrawCallbacks >= options.frames;
  if (!noRendering && raw.samples.length < options.frames) throw new Error(`${name} collected too few valid GPU samples`);
  if (raw.drawingBuffer?.[0] !== 1440 || raw.drawingBuffer?.[1] !== 900) throw new Error(`${name} did not render at 1440x900`);
  const state = await page.evaluate(() => window.starAgent.state);
  const intervals = raw.rafTimes.slice(1).map((time, index) => time - raw.rafTimes[index]);
  const record = { name, fixture, environment, viewport: page.viewportSize(), state, raw,
    gpuMs: summary(raw.samples.map(sample => sample.gpuMs)),
    cpuCallbackMs: summary(raw.samples.map(sample => sample.cpuMs)),
    observedRafIntervalMs: summary(intervals), drawCalls: summary(raw.samples.map(sample => sample.drawCalls)),
    triangles: summary(raw.samples.map(sample => sample.triangles)), noRendering,
    screenshot: resolve(out, `${name}.png`) };
  await page.screenshot({ path: record.screenshot });
  captures.push(record);
  console.log(`${name}: GPU median ${record.gpuMs?.median.toFixed(3) ?? 'not rendered'} ms; CPU median ${record.cpuCallbackMs?.median.toFixed(3) ?? 'not rendered'} ms`);
}


async function diagnose(name) {
  const cdp=await context.newCDPSession(page);
  await page.evaluate(() => {
    const station=window.starAgent.navigation.station, scene=station.scene;
    if(window.__stationCost){window.__stationCost.active=true;window.__stationCost.reset();return;}
    const cost={active:false,frames:0,methods:{},draws:{},renderer:null,matrixWrites:0,lodDirtyFrames:0};
    cost.reset=()=>{cost.frames=0;cost.methods={};cost.draws={};cost.matrixWrites=0;cost.lodDirtyFrames=0;};
    const wrap=(object,method,label)=>{
      const original=object[method];object[method]=function(...args){
        if(!cost.active)return original.apply(this,args);
        const before=performance.now();try{return original.apply(this,args);}finally{
          const item=cost.methods[label]??={calls:0,ms:0};item.calls++;item.ms+=performance.now()-before;
        }
      };
    };
    wrap(station,'update','StationComplex.update (inclusive)');
    for(const pod of station.pods)wrap(pod,'update',`Pod ${pod.id} update`);
    wrap(station,'rebase','StationComplex.rebase');
    wrap(station.finishRig,'update','finishRig.update');
    for(const batch of station.lodBatches){const original=batch.instances.setMatrixAt;batch.instances.setMatrixAt=function(...args){if(cost.active)cost.matrixWrites++;return original.apply(this,args);};}
    const path=object=>{const parts=[];for(let p=object;p;p=p.parent)parts.push(p.name||p.type);return parts.reverse().join('/');};
    const labels=new WeakMap();scene.traverse(o=>labels.set(o,path(o)));
    const install=renderer=>{
      if(cost.renderer)return;cost.renderer=renderer;
      const direct=renderer.renderBufferDirect;
      renderer.renderBufferDirect=function(camera,drawScene,geometry,material,object,group){
        if(!cost.active)return direct.apply(this,arguments);
        const before=renderer.info.render.calls,start=performance.now();
        try{return direct.apply(this,arguments);}finally{
          const calls=renderer.info.render.calls-before;
          const objectPath=labels.get(object)??path(object),pass=drawScene===null?'shadow':'scene';
          const key=pass+'/'+object.uuid+'/'+material.uuid;
          const entry=cost.draws[key]??={pass,object:objectPath,name:object.name||object.type,material:material.name||material.type,materialId:material.uuid,cameraId:camera.uuid,calls:0,cpuMs:0};
          entry.calls+=calls;entry.cpuMs+=performance.now()-start;
        }
      };
    };
    scene.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const original=mesh.onBeforeRender;mesh.onBeforeRender=function(renderer,...rest){install(renderer);return original.call(this,renderer,...rest);};
    });
    cost.capture=()=>{
      const lights=[];scene.traverse(o=>{if(!o.isLight)return;let visible=true;for(let p=o;p;p=p.parent)visible&&=p.visible;
        lights.push({name:o.name||o.type,type:o.type,visible,intensity:o.intensity,distance:o.distance,castShadow:o.castShadow,shadowMap:o.shadow?.mapSize.toArray(),shadowCamera:o.shadow?.camera.uuid,path:path(o)});
      });
      return {frames:cost.frames,methods:cost.methods,draws:Object.values(cost.draws).sort((a,b)=>b.calls-a.calls),lights,
        matrixWrites:cost.matrixWrites,lodBatches:station.lodBatches.length,hiddenHeroPods:station.pods.filter(p=>!p.model.visible).length,
        rendererPrograms:cost.renderer?.info.programs.length,renderInfo:cost.renderer?.info.render,
        sceneObjects:(()=>{let n=0;scene.traverse(()=>n++);return n;})()};
    };
    window.__stationCost=cost;
    // Frame counting is nested in the existing station update, without another
    // competing animation loop or a change to the game's scheduler.
    const update=station.update;station.update=function(...args){if(cost.active)cost.frames++;return update.apply(this,args);};
    cost.active=true;
  });
  await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
  await page.waitForTimeout(3000);
  const {profile}=await cdp.send('Profiler.stop');await cdp.detach();
  const attribution=await page.evaluate(()=>{window.__stationCost.active=false;return window.__stationCost.capture();});
  const profileFile=resolve(out,`${name}.cpuprofile`);await writeFile(profileFile,JSON.stringify(profile));
  const weights=new Map();for(let i=0;i<(profile.samples?.length??0);i++)weights.set(profile.samples[i],(weights.get(profile.samples[i])??0)+(profile.timeDeltas[i]??0));
  const cpuSamples=profile.nodes.map(node=>({name:node.callFrame.functionName||'(anonymous)',url:node.callFrame.url,line:node.callFrame.lineNumber+1,selfMs:(weights.get(node.id)??0)/1000,hitCount:node.hitCount})).sort((a,b)=>b.selfMs-a.selfMs);
  const records=captures.find(c=>c.name===name);Object.assign(records,{attribution,cpuProfile:{file:profileFile,sampleIntervalUs:1000,durationMs:(profile.endTime-profile.startTime)/1000,topSelf:cpuSamples.slice(0,40)}});
  console.log(`${name}: ${attribution.frames} diagnostic frames, ${attribution.matrixWrites} LOD matrix writes; top draws: ${JSON.stringify(attribution.draws.slice(0,4).map(d=>({name:d.name,pass:d.pass,perFrame:d.calls/attribution.frames})))}`);
}

try {
  await boot(1);
  await page.evaluate(() => {
    const app=window.starAgent,opening=app.openingSequence;
    opening.elapsed=0;opening.start();opening.update(10);app.navigation.enabled=false;
    app.navigation.keys.clear();app.navigation.velocity.set(0,0,0);
  });
  await measure('01-hangar', {intro:1,camera:'authored opening cinematic frozen at t=10'});
  await diagnose('01-hangar');
  await page.evaluate(()=>{
    const app=window.starAgent,nav=app.navigation,station=nav.station;app.openingSequence.leave();
    nav.enabled=false;nav.keys.clear();nav.velocity.set(0,0,0);nav.mode='walk';nav.insideShip=false;nav.dockedAtStation=true;
    station.location='hub';
    station.toWorld(nav.position.clone().set(0,-6.25,12),nav.position);
    nav.orientToward(station.toWorld(nav.position.clone().set(0,-3,-16),nav.position.clone()),station.up);
  });
  await measure('02-hub', {camera:'central hub local fixture',eye:[0,-6.25,12],target:[0,-3,-16],physicalElevatorJourney:false});
  await diagnose('02-hub');
  if(errors.length||warnings.length||diagnostics.length)throw new Error('Browser diagnostics were not clean; inspect evidence.json');
} catch (error) {
  failure = error.stack ?? error.message;
  try { await page.screenshot({ path: resolve(out, 'failure.png') }); } catch { /* retain original failure */ }
  throw error;
} finally {
  let lastInstrumentation = null;
  try { lastInstrumentation = await page.evaluate(() => window.__hardwareReview?.snapshot ?? null); await page.evaluate(() => window.__hardwareReview?.cleanup()); } catch { /* context may be gone */ }
  plannedClose = true;
  await browser.close();
  await writeFile(resolve(out, 'evidence.json'), JSON.stringify({ generatedAt: new Date().toISOString(), browser: browser.version(),
    args, options, environment, viewport: { width: 1440, height: 900 }, renderScale: 1, captures, errors, warnings, diagnostics, failure, lastInstrumentation,
    methodology: { gpu: 'EXT_disjoint_timer_query_webgl2 TIME_ELAPSED_EXT around synchronous commands in the actual rendered rAF callback. Results read only after QUERY_RESULT_AVAILABLE; disjoint/invalid/stale queries discarded. No gl.finish or busy waiting.',
      cpu: 'performance.now duration of the main rendered rAF callback, excluding query begin/end/poll instrumentation; includes scene update and command submission. CPU and GPU costs can overlap, so they are not summed.',
      cadence: 'rAF timestamp intervals are presented separately. They include presentation pacing and are never used as evidence of the 10 ms render budget.',
      profiling: 'CPU profile and per-object/light/shadow draw attribution run separately after the baseline GPU timing. Method times are instrumented and nested/inclusive, not additive. renderBufferDirect wall time is CPU command submission, not per-object GPU time.',
      limitations: 'This measures WebGL commands within the main callback, including its passes, not browser composition or input-to-display latency. Query and draw-counter instrumentation adds overhead. A software renderer or unavailable extension aborts hardware claims. Camera fixtures do not test physical boarding.',
    } }, null, 2));
}

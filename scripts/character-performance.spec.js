import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

test('character GPU cost and first/third-person draw budget', async ({ page }) => {
  test.setTimeout(180000);
  const out = join(process.env.CHARACTER_EVIDENCE || '/tmp', 'performance'); await mkdir(out, { recursive: true });
  const errors = [], warnings = [], captures = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if(m.type()==='error')errors.push(m.text()); if(m.type()==='warning')warnings.push(m.text()); });
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext, raf = requestAnimationFrame.bind(window);
    let gl, ext, run = null, pending = [], draws = 0;
    HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
      const result = getContext.call(this, kind, ...args);
      if (kind === 'webgl2' && ['viewport', 'avatar-canvas'].includes(this.id) && result && !gl) {
        gl = result; ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        for (const key of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
          const original = gl[key]; gl[key] = function(...args) { draws++; return original.apply(this, args); };
        }
      }
      return result;
    };
    window.requestAnimationFrame = callback => raf(time => {
      if (gl && pending.length) {
        const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
        pending = pending.filter(item => {
          if (disjoint) { gl.deleteQuery(item.query); run.discarded++; return false; }
          if (!gl.getQueryParameter(item.query, gl.QUERY_RESULT_AVAILABLE)) return true;
          run.samples.push({ ...item.sample, gpuMs: gl.getQueryParameter(item.query, gl.QUERY_RESULT) / 1e6 });
          gl.deleteQuery(item.query); return false;
        });
        if (run.samples.length >= 90) run.active = false;
      }
      const query = run?.active && pending.length < 8 && !gl.getParameter(ext.GPU_DISJOINT_EXT) ? gl.createQuery() : null;
      if (query) gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
      draws = 0; const before = performance.now();
      try { callback(time); }
      finally {
        const cpuMs = performance.now() - before;
        if (query) {
          gl.endQuery(ext.TIME_ELAPSED_EXT);
          if (draws) pending.push({ query, sample: { cpuMs, drawCalls: draws,
            triangles: window.starAgent?.state.triangles ?? window.avatarStudio?.state.triangles } });
          else gl.deleteQuery(query);
        }
      }
    });
    window.characterTiming = {
      start() {
        if (!gl || !ext) throw Error('Hardware GPU timers unavailable');
        if (pending.length) throw Error('Previous GPU queries have not drained');
        const debug = gl.getExtension('WEBGL_debug_renderer_info');
        run = { active: true, samples: [], discarded: 0,
          renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
          drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight] };
      },
      get done() { return run && !run.active && pending.length === 0; },
      get data() { return run; },
    };
  });
  const measure = async name => {
    await page.evaluate(() => {
      window.characterShadowLights = {};
      const character = window.starAgent?.openingSequence?.character;
      if (!character) return;
      const lights = new Map();
      character.scene.traverse(node => { if (node.isLight && node.shadow) lights.set(node.shadow.camera.uuid, node.name || node.type); });
      character.model.traverse(mesh => { if (mesh.isSkinnedMesh && !mesh.userData.shadowTimingInstalled) {
        mesh.userData.shadowTimingInstalled = true;
        const before = mesh.onBeforeShadow;
        mesh.onBeforeShadow = function(renderer, object, camera, shadowCamera, ...rest) {
          before.call(this, renderer, object, camera, shadowCamera, ...rest);
          window.characterShadowLights[shadowCamera.uuid] = lights.get(shadowCamera.uuid) || shadowCamera.type;
        };
      } });
    });
    await page.evaluate(async()=>{for(let i=0;i<35;i++)await new Promise(r=>requestAnimationFrame(r));});
    await page.evaluate(()=>window.characterTiming.start());
    await page.waitForFunction(()=>window.characterTiming.done, null, {timeout:20000});
    const data = await page.evaluate(()=>window.characterTiming.data);
    expect(data.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
    const median = key => [...data.samples].sort((a,b)=>a[key]-b[key])[Math.floor(data.samples.length/2)][key];
    const result = { name, ...data, gpuMedianMs: median('gpuMs'), cpuMedianMs: median('cpuMs'),
      drawCalls: median('drawCalls'), triangles: median('triangles'), characterShadowLights: await page.evaluate(() => Object.values(window.characterShadowLights)) };
    await page.screenshot({path:`${out}/${name}.png`}); captures.push(result);
    console.log(JSON.stringify({name,renderer:data.renderer,gpuMs:result.gpuMedianMs,cpuMs:result.cpuMedianMs,draws:result.drawCalls,triangles:result.triangles,characterShadowLights:result.characterShadowLights}));
  };
  try {
    await page.goto('/?intro=1&seed=7291&debug');
    await page.waitForFunction(()=>window.starAgent?.state.ready);
    await page.keyboard.press('w'); await page.waitForFunction(()=>window.starAgent.state.opening.phase==='playing');
    await page.evaluate(()=>window.starAgent.setRenderScale(1));
    await page.keyboard.press('1'); await page.waitForFunction(()=>window.starAgent.state.mining.tool.item==='rifle-laser');
    await measure('game-first-person');
    await page.keyboard.press('4'); await page.waitForFunction(()=>window.starAgent.state.mining.tool.attachment==='character-hand');
    await measure('game-third-person-rifle');
    await page.keyboard.press('2'); await page.waitForFunction(()=>window.starAgent.state.mining.tool.item==='sidearm-pistol');
    await measure('game-third-person-pistol');
    await page.keyboard.press('3'); await page.waitForFunction(()=>window.starAgent.state.mining.tool.item==='mining-laser-tool');
    await measure('game-third-person-cutter');
    await page.goto('/dev/avatar-studio.html'); await page.waitForFunction(()=>window.avatarStudio?.state.ready);
    await measure('studio-expedition');
    await page.getByLabel('Character',{exact:true}).selectOption('player-male'); await page.waitForFunction(()=>window.avatarStudio?.state.ready);
    await measure('studio-previous');
    expect(errors).toEqual([]); expect(warnings).toEqual([]);
  } finally {
    await writeFile(`${out}/evidence.json`,JSON.stringify({captures,errors,warnings,
      methodology:'90+ valid EXT_disjoint_timer_query_webgl2 queries around rendered RAF callbacks, after 35 warm frames; available results only, disjoint queries discarded. CPU callback time excludes query readback. Display cadence is not GPU render time. Other desktop GPU tasks were active; this is not an isolated laptop benchmark.'},null,2));
  }
});

import { chromium } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const out = process.argv[2] ?? '/tmp/star-agent-kestrel-game-review';
const quick = process.argv.includes('--quick');
await mkdir(out, { recursive: true });
const instrumentation = await readFile(new URL('./station-performance-check.mjs', import.meta.url), 'utf8');
const start = instrumentation.indexOf('await context.addInitScript(') + 'await context.addInitScript('.length;
const end = instrumentation.indexOf('\nconst page = await context.newPage();', start);
if (start < 30 || end < start) throw new Error('Existing timer instrumentation boundary changed');
const init = instrumentation.slice(start, end).trim().replace(/\);$/, '');
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=gl'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await context.addInitScript({ content: `(${init})();` });
const evidence = { browser: browser.version(), generatedAt: new Date().toISOString(), captures: [], pairs: [], errors: [], warnings: [] };
const page = await context.newPage();
const listen = p => {
  p.on('pageerror', error => evidence.errors.push(error.message));
  p.on('console', m => { if (m.type() === 'error') evidence.errors.push(m.text()); if (m.type() === 'warning') evidence.warnings.push(m.text()); });
};
listen(page);
const summary = values => {
  const v = [...values].sort((a, b) => a - b), n = v.length;
  return { samples: n, median: n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2, p95: v[Math.ceil(n * .95) - 1] };
};
async function camera(position, target) {
  await page.evaluate(({ position, target }) => {
    const n = starAgent.navigation, s = n.station;
    s.toWorld(n.position.clone().fromArray(position), n.position);
    n.orientToward(s.toWorld(n.position.clone().fromArray(target), n.position.clone()), s.up);
    s.rebase(n.position);
  }, { position, target });
  await page.waitForTimeout(350);
}
async function capture(name) {
  await page.screenshot({ path: `${out}/${name}.png` });
  evidence.captures.push({ name, state: await page.evaluate(() => ({ draws: starAgent.state.drawCalls, triangles: starAgent.state.triangles,
    renderScale: starAgent.state.renderScale, location: starAgent.state.station.location, position: starAgent.state.station.local })) });
}
try {
  const response = await page.goto('http://127.0.0.1:5263/?intro=0&debug=1&seed=7291');
  const html = await response.text(), bundle = html.match(/\/assets\/index-[^" ]+\.js/)[0];
  const bundleResponse = await context.request.get(`http://127.0.0.1:5263${bundle}`);
  evidence.bundle = { path: bundle, sha256: createHash('sha256').update(await bundleResponse.body()).digest('hex') };
  await page.waitForFunction(() => window.starAgent?.state.ready && starAgent.state.station.finish === 'ready' && starAgent.navigation.station.hub.shopProps?.children.length === 1);
  await page.evaluate(() => {
    const n = starAgent.navigation, s = n.station; starAgent.setRenderScale(1);
    const p = n.position.clone().set(0, s.interiorBox.min.y + 4, 2); n.orbit(); s.toWorld(p, n.position); n.orientation.copy(s.quaternion); n.landOrLaunch();
    s.location = 'hub'; n.mode = 'walk'; n.insideShip = false; n.enabled = false; n.velocity.set(0, 0, 0);
    document.body.classList.add('photo-mode');
  });
  await camera([10.9, -6.25, -.25], [12.04, -6.843, -.25]);
  evidence.environment = await page.evaluate(() => window.__hardwareReview.environment);
  if (/swiftshader|llvmpipe|software/i.test(evidence.environment.renderer) || !evidence.environment.timerExtension) throw new Error('Hardware required');
  evidence.geometry = await page.evaluate(() => {
    const s = starAgent.navigation.station, g = s.hub.shopProps, meshes = [], lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    s.hub.group.updateMatrixWorld(true);
    g.traverse(m => {
      if (!m.isMesh) return;
      const a = m.geometry.attributes.position, p = starAgent.navigation.position.clone();
      for (let i = 0; i < a.count; i++) {
        p.fromBufferAttribute(a, i); m.localToWorld(p); s.hub.group.worldToLocal(p);
        p.toArray().forEach((v, j) => { lo[j] = Math.min(lo[j], v); hi[j] = Math.max(hi[j], v); });
      }
      const mat = m.material;
      meshes.push({ name: m.name, triangles: (m.geometry.index?.count ?? a.count) / 3, castShadow: m.castShadow, receiveShadow: m.receiveShadow,
        material: { name: mat.name, type: mat.type, roughness: mat.roughness, metalness: mat.metalness,
          maps: ['map', 'normalMap', 'roughnessMap', 'metalnessMap'].map(k => ({ key: k, uuid: mat[k]?.uuid, width: mat[k]?.image?.width, height: mat[k]?.image?.height, colorSpace: mat[k]?.colorSpace })) } });
    });
    let allPlacements = 0, podPlacements = 0;
    s.hub.group.traverse(n => { if (n.isGroup && n.name === 'kestrel-maintenance-roll') allPlacements++; });
    for (const pod of s.pods) pod.group.traverse(n => { if (n.isGroup && n.name === 'kestrel-maintenance-roll') podPlacements++; });
    return { meshes, hubLocalBounds: { min: lo, max: hi }, children: g.children.map(n => ({ name: n.name, position: n.position.toArray() })), allPlacements, podPlacements, status: g.userData.shopProps };
  });
  for (const [name, eye, target] of [
    ['roll-walk-eye', [10.9, -6.25, -.25], [12.04, -6.843, -.25]],
    ['roll-close', [11.58, -6.51, .08], [12.04, -6.843, -.25]],
    ['roll-reverse', [12.5, -6.52, -.60], [12.04, -6.843, -.25]],
    ['whole-shop', [6, -6.25, 0], [16, -5.6, 0]],
  ]) { await camera(eye, target); await capture(name); }
  for (let i = 0; i < 5; i++) { await camera([10.7 + .06 * i, -6.25, .5 - .2 * i], [12.04, -6.843, -.25]); await capture(`approach-${i}`); }
  await camera([10.9, -6.25, -.25], [12.04, -6.843, -.25]);
  for (let block = 0; block < (quick ? 2 : 8); block++) {
    const visible = block % 2 === 0;
    await page.evaluate(v => { starAgent.navigation.station.hub.shopProps.visible = v; window.__hardwareReview.warmup(30); }, visible);
    await page.waitForFunction(() => window.__hardwareReview.snapshot.status === 'warm');
    await page.evaluate(() => window.__hardwareReview.measure(60));
    await page.waitForFunction(() => window.__hardwareReview.snapshot.status === 'done');
    const raw = await page.evaluate(() => window.__hardwareReview.snapshot);
    evidence.pairs.push({ block, visible, gpu: summary(raw.samples.map(s => s.gpuMs)), cpu: summary(raw.samples.map(s => s.cpuMs)),
      draws: summary(raw.samples.map(s => s.drawCalls)), triangles: summary(raw.samples.map(s => s.triangles)),
      raf: summary(raw.rafTimes.slice(1).map((v, i) => v - raw.rafTimes[i])), raw });
    if (block < 2) await capture(visible ? 'comparison-on' : 'comparison-off');
  }
  evidence.gameDiagnostics = { errors: [...evidence.errors], warnings: [...evidence.warnings] };
  await page.close();
  const props = await context.newPage(); listen(props);
  await props.goto('http://127.0.0.1:5262/dev/props.html?only=kestrel-maintenance-roll&t=0&clean');
  await props.waitForFunction(() => window.__propsReady);
  evidence.props = await props.evaluate(() => ({ stats: window.__propsStats, failed: window.__propsFailed, error: window.__propsError }));
  await props.screenshot({ path: `${out}/props-human-scale.png` });
  if (evidence.errors.length || evidence.warnings.length || evidence.props.failed?.length || evidence.props.error || !evidence.props.stats?.length) throw new Error('Browser diagnostics present or no props rendered');
} catch (error) { evidence.failure = error.stack; throw error; }
finally { await writeFile(`${out}/evidence.json`, JSON.stringify(evidence, null, 2)); await browser.close(); }
console.log(JSON.stringify({ out, environment: evidence.environment, geometry: evidence.geometry, pairs: evidence.pairs.map(({ raw, ...p }) => p), errors: evidence.errors, warnings: evidence.warnings }));

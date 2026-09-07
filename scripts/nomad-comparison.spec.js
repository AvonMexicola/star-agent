import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const out = process.env.NOMAD_COMPARISON_OUT ?? '/tmp/star-agent-nomad-comparison';
const sources = [
  ['before', process.env.NOMAD_BEFORE_URL ?? 'http://127.0.0.1:5393/dev/ship.html'],
  ['after', process.env.NOMAD_AFTER_URL ?? 'http://127.0.0.1:5293/nomad/'],
];

test('same-camera original and Nomad 02 studio comparison', async ({ browser }) => {
  await mkdir(out, { recursive: true });
  const record = { browser: browser.version(), scope: 'Producer comparison; no performance or independent art acceptance claim', sources: {} };
  for (const [label, url] of sources) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const diagnostics = [];
    page.on('pageerror', error => diagnostics.push(error.message));
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics.push(message.text()); });
    page.on('requestfailed', request => diagnostics.push(`${request.url()} ${request.failure()?.errorText}`));
    // Read-only camera/renderer exposure in the baseline fixture. This changes
    // no checked-out source, material, mesh, lighting or rendering parameter.
    await page.route('**/src/ship-studio.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: `${await response.text()}\nwindow.shipStudio.comparison={renderer,camera,scene,controls};\n` });
    });
    const assetResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/models/nomad.glb');
    await page.goto(url);
    const asset = await (await assetResponse).body();
    await page.waitForFunction(() => window.shipStudio?.ready);
    await page.evaluate(() => window.shipStudio.ready);
    await page.waitForTimeout(1250);
    // Remove each version's studio HTML only; preserve the rendered canvas.
    await page.addStyleTag({ content: 'body > :not(canvas):not(script):not(style) { visibility: hidden !important; } body::before, body::after { display: none !important; }' });
    const result = { url, assetBytes: asset.length, assetSha256: createHash('sha256').update(asset).digest('hex'), views: {}, diagnostics };
    for (const name of ['exterior', 'rear']) {
      await page.evaluate(name => {
        const studio = window.shipStudio;
        studio.comparison.controls.enableDamping = false;
        studio.view(name);
      }, name);
      await page.waitForTimeout(250);
      result.views[name] = await page.evaluate(() => {
        const { renderer, camera, scene, controls } = window.shipStudio.comparison;
        const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          camera: camera.position.toArray(), target: controls.target.toArray(), fov: camera.fov,
          exposure: renderer.toneMappingExposure, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio,
          canvas: [gl.drawingBufferWidth, gl.drawingBufferHeight],
          gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
          lights: scene.children.filter(object => object.isLight).map(light => ({
            type: light.type, color: light.color.getHex(), intensity: light.intensity, position: light.position.toArray(),
            shadow: light.castShadow ? { bias: light.shadow.bias, normalBias: light.shadow.normalBias } : null,
          })),
        };
      });
      await page.screenshot({ path: `${out}/${label}-${name}.png` });
    }
    record.sources[label] = result;
    await page.close();
  }
  await writeFile(`${out}/comparison.json`, JSON.stringify(record, null, 2));
  for (const name of ['exterior', 'rear']) {
    const before = record.sources.before.views[name], after = record.sources.after.views[name];
    for (const key of ['camera', 'target', 'fov', 'exposure', 'viewport', 'dpr', 'canvas']) expect(after[key], key).toEqual(before[key]);
  }
  for (const result of Object.values(record.sources)) expect(result.diagnostics).toEqual([]);
  expect(record.sources.before.assetSha256).not.toBe(record.sources.after.assetSha256);
});

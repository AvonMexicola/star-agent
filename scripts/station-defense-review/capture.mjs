// Root executes one browser launch, with no startup retry or software fallback.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.BASTION_REVIEW_ROOT || path.join(HERE, '../..'));
const OUT = path.resolve(process.env.BASTION_REVIEW_OUT || path.join(os.tmpdir(), 'bastion-native-05'));
const PORT = Number(process.env.BASTION_REVIEW_PORT || 5565);
const BROWSER_TMP = process.env.BASTION_BROWSER_TMP || path.join(os.tmpdir(), 'bs-' + process.pid);
const EXPECTED_SHA = 'ccc8f276dc07891aff056fded88367607a28d5f5aa2897e39b9ae973fca3472f';
const ASSET = path.join(ROOT, 'public/models/station-defense.glb');
const LAYOUT = path.join(ROOT, 'assets/station-defense/layout.json');
const hash = value => createHash('sha256').update(value).digest('hex');
const bytes = await fs.readFile(ASSET);
if (hash(bytes) !== EXPECTED_SHA) throw new Error('Frozen Bastion asset changed before browser launch');
const layoutBytes = await fs.readFile(LAYOUT);
const layout = JSON.parse(layoutBytes);
const nativeSource = await fs.readFile(path.join(HERE, 'scene.mjs'), 'utf8');
const captureSource = await fs.readFile(fileURLToPath(import.meta.url));
const fixture = nativeSource.replace('__BASTION_CONFIG__', JSON.stringify({ assetSHA: EXPECTED_SHA, layout }));
await fs.mkdir(OUT, { recursive: true });
if (await fs.stat(path.join(OUT, 'capture.json')).catch(() => null)) {
  throw new Error('Evidence directory already contains capture.json; choose a fresh BASTION_REVIEW_OUT');
}
await fs.mkdir(BROWSER_TMP, { recursive: true });
const { createServer } = await import(pathToFileURL(path.join(ROOT, 'node_modules/vite/dist/node/index.js')));
const { chromium } = await import(pathToFileURL(path.join(ROOT, 'node_modules/@playwright/test/index.mjs')));
const report = {
  author: '/root/kestrel_reviewer, Bastion builder role', executor: 'Root hardware runner',
  independentArtReviewer: 'Separate reviewer; this capture does not score itself',
  assetSHA: EXPECTED_SHA, assetBytes: bytes.length, layoutSHA: hash(layoutBytes),
  sceneScriptSHA: hash(nativeSource), captureScriptSHA: hash(captureSource),
  sourceCommit: execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceDirty: Boolean(execFileSync('git', ['-C', ROOT, 'status', '--porcelain'], { encoding: 'utf8' }).trim()),
  startedAt: new Date().toISOString(), complete: false, messages: [], images: [],
  lighting: { toneMapping: 'ACESFilmic', exposure: 0.95, outputColorSpace: 'sRGB',
    environment: 'native RoomEnvironment PMREM', environmentIntensity: 0.75,
    key: { color: '#ffeedb', intensity: 2.6, position: [-80, 100, -60] },
    fill: { color: '#c2e6f7', intensity: 1, position: [80, 40, 70] },
    hemisphereIntensity: 0.35, gridMetres: 1, materialOverrides: false },
  performanceClaim: false,
};
const server = await createServer({ root: ROOT, configFile: false,
  server: { host: '127.0.0.1', port: PORT, strictPort: true },
  plugins: [{ name: 'bastion-native-review',
    resolveId(id) { if (id === '/__bastion_review_module') return id; },
    load(id) { if (id === '/__bastion_review_module') return fixture; },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true, env: { ...process.env, TMPDIR: BROWSER_TMP }, timeout: 45000,
    args: ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle',
      '--use-angle=gl', '--disable-dev-shm-usage'] });
  report.browser = browser.version();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.messages.push({ type: 'pageerror', text: error.message }));
  page.on('console', message => {
    if (['warning', 'error'].includes(message.type())) report.messages.push({ type: message.type(), text: message.text() });
  });
  page.on('requestfailed', request => report.messages.push({ type: 'requestfailed',
    url: request.url(), text: request.failure()?.errorText }));
  await page.route('**/__bastion_review', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><style>' +
    'html,body{margin:0;background:#18242b;color:#dce8e2;font:14px monospace}' +
    'canvas{display:block}#caption{position:absolute;top:18px;left:24px;right:24px;pointer-events:none;line-height:1.45}' +
    '</style></head><body><div id="caption"></div><script type="module" src="/__bastion_review_module"></script></body></html>' }));
  await page.goto('http://127.0.0.1:' + PORT + '/__bastion_review');
  await page.waitForFunction(() => window.bastionReview?.ready, null, { timeout: 90000 });
  report.native = await page.evaluate(() => ({ backend: bastionReview.backend,
    servedSHA: bastionReview.servedSHA, assetTriangles: bastionReview.assetTriangles,
    assetMeshes: bastionReview.assetMeshes, materials: bastionReview.nativeMaterials }));
  const views = [
    { name: '01-wide', label: 'MERIDIAN BASTION / NATIVE PBR / FULL EXTERIOR / 1 m GRID',
      direction: [-1, 0.60, -1.4] },
    { name: '02-side', label: 'SIDE PROFILE / REST POSE / FULL ASSET IN FRAME',
      direction: [-1, 0, 0] },
    { name: '03-open-bores', label: 'OPEN BORES / NATIVE POWERED ANNULI / MOUTH DETAIL',
      detail: 'bores', direction: [0, 0.12, -1] },
    { name: '04-base-cradle', label: 'BASE AND AFT CRADLE / DETAIL / ORIGINAL MATERIALS',
      detail: 'base', direction: [1, 0.52, 1] },
    { name: '05-posed-recoil', label: 'POSE / YAW 0.45 rad / ELEVATION 0.68 rad / PORT RECOIL 0.60 m',
      yaw: 0.45, pitch: 0.68, portRecoil: 0.6, direction: [-1, 0.60, -1.25] },
  ];
  for (const view of views) {
    const record = await page.evaluate(spec => bastionReview.draw(spec), view);
    await page.screenshot({ path: path.join(OUT, view.name + '.png') });
    report.images.push(record);
  }
  if (report.messages.length) throw new Error('Browser diagnostics: ' + JSON.stringify(report.messages));
  if (hash(await fs.readFile(ASSET)) !== EXPECTED_SHA || hash(await fs.readFile(LAYOUT)) !== report.layoutSHA) {
    throw new Error('Asset/layout changed during capture');
  }
  report.assetAndLayoutStable = true;
  report.complete = true;
} catch (error) {
  report.failure = String(error.stack || error);
  throw error;
} finally {
  report.finishedAt = new Date().toISOString();
  try {
    await fs.writeFile(path.join(OUT, 'capture.json'), JSON.stringify(report, null, 2) + '\n');
  } finally {
    try { await browser?.close(); } finally { await server.close(); }
  }
}
console.log(JSON.stringify({ out: OUT, complete: report.complete, assetSHA: EXPECTED_SHA,
  backend: report.native.backend, images: report.images.length, messages: report.messages }));

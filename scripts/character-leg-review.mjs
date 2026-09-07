// Deterministic pose comparisons in the real studio renderer. This is an asset
// inspection, not a claim of controller or full-game journey coverage.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const root = process.env.LEG_REVIEW_CACHE || join(homedir(), '.cache/star-agent-leg-rig');
const out = join(root, process.env.LEG_REVIEW_LABEL || 'candidate');
process.env.TMPDIR = join(root, 'tmp');
await mkdir(out, { recursive: true }); await mkdir(process.env.TMPDIR, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=gl'] });
const errors = [], warnings = [], captures = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  const frames = count => page.evaluate(async count => { for (let i = 0; i < count; i++) await new Promise(r => requestAnimationFrame(r)); }, count);
  for (const [motion, clip, time] of [['rest', 'rest-pose', 0], ['crouch', 'crouch-walk', .75],
    ['jump', 'jump', .333333], ['jump', 'jump', .666667], ['jump', 'jump', 1.1], ['sit', 'sit-idle', .5]]) {
    await page.goto(`${process.env.LEG_REVIEW_URL || 'http://127.0.0.1:5322'}/dev/avatar-studio.html`);
    await page.waitForFunction(() => window.avatarStudio?.state.ready);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByLabel('Movement', { exact: true }).selectOption(motion === 'jump' ? 'idle' : motion);
    if (motion === 'jump') await page.getByRole('button', { name: 'Jump', exact: true }).click();
    await frames(2);
    await page.evaluate(({ motion, clip, time }) => {
      const { character: c, input } = avatarStudio;
      for (let i = 0; i < 500; i++) c.update(.02, { ...input, jumping: motion === 'jump' });
      c.actions[clip].time = time; c.mixer.update(0);
    }, { motion, clip, time });
    for (const view of ['Front', 'Side']) {
      await page.getByRole('button', { name: view, exact: true }).click(); await frames(35);
      const name = `${motion}-${time}-${view.toLowerCase()}`;
      await page.screenshot({ path: join(out, `${name}.png`) });
      captures.push({ name, state: await page.evaluate(() => avatarStudio.state) });
    }
  }
  const environment = await page.evaluate(() => {
    const gl = avatarStudio.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { viewport: [innerWidth, innerHeight], renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
  });
  await writeFile(join(out, 'evidence.json'), JSON.stringify({ browser: await browser.version(), environment, errors, warnings, captures }, null, 2));
  console.log(JSON.stringify({ out, captures: captures.length, errors, warnings }));
  if (errors.length || warnings.length) process.exitCode = 1;
} finally { await browser.close(); }

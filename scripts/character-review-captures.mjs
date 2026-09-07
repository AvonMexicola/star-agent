import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const cache = process.env.CHARACTER_REVIEW_CACHE || join(homedir(), '.cache', 'star-agent-character', 'opus-review');
process.env.TMPDIR = join(cache, 'tmp'); await mkdir(process.env.TMPDIR, { recursive: true });
process.env.INTEGRATION_URL ||= 'http://127.0.0.1:5318';
process.env.INTEGRATION_EVIDENCE = join(cache, 'tour');
// Capture the affected asset first; a later terrain-tour failure must not erase
// the independently produced character evidence.
const out = join(cache, 'character'); await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=gl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(60000);
const errors = [], captures = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
const frames = count => page.evaluate(async count => { for (let i = 0; i < count; i++) await new Promise(r => requestAnimationFrame(r)); }, count);
const shot = async name => { await frames(20); await page.screenshot({ path: join(out, `${name}.png`), fullPage: true }); captures.push(name); };
try {
  for (const rig of ['player-male', 'player-expedition']) {
    await page.goto(`${process.env.INTEGRATION_URL}/dev/avatar-studio.html?rig=${rig}`);
    await page.waitForFunction(() => window.avatarStudio?.state.ready);
    await shot(`${rig}-desktop`);
    await page.setViewportSize({ width: 390, height: 844 }); await shot(`${rig}-phone`);
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  for (const item of ['rifle-laser', 'sidearm-pistol', 'mining-laser-tool']) {
    await page.getByLabel('Equipment', { exact: true }).selectOption(item);
    await page.locator('#avatar-fire').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.getElementById('avatar-fire').disabled);
    for (const name of ['Hands', 'Side', 'Back']) {
      await page.getByRole('button', { name, exact: true }).click(); await shot(`${item}-${name.toLowerCase()}`);
    }
    await page.getByLabel('Movement', { exact: true }).selectOption('run'); await shot(`${item}-run`);
    await page.getByLabel('Movement', { exact: true }).selectOption('idle');
  }
  await page.getByLabel('Equipment', { exact: true }).selectOption('none');
  await page.getByRole('button', { name: 'Front', exact: true }).click();
  for (const motion of ['walk', 'run', 'sit', 'climb', 'rest']) {
    await page.getByLabel('Movement', { exact: true }).selectOption(motion);
    await page.waitForFunction(motion => window.avatarStudio.state.transition === null && window.avatarStudio.state.characterState === motion, motion);
    await shot(`motion-${motion}`);
  }
  await page.getByLabel('Movement', { exact: true }).selectOption('idle');
  await page.getByRole('button', { name: 'Wave', exact: true }).click(); await frames(90); await shot('wave');
  await page.goto(`${process.env.INTEGRATION_URL}/dev/props.html?only=player-expedition&t=0`);
  await page.waitForFunction(() => window.__propsReady); await shot('props-scale-intake');
  if ((await page.locator('.warn').allTextContents()).length) throw Error('Props intake flags need review');
  await page.goto(`${process.env.INTEGRATION_URL}/?intro=1&seed=7291&debug`);
  await page.waitForFunction(() => window.starAgent?.state.ready);
  await page.keyboard.press('w'); await page.waitForFunction(() => window.starAgent.state.opening.phase === 'playing');
  await page.evaluate(() => window.starAgent.setRenderScale(1));
  await page.keyboard.press('1'); await shot('game-first-person');
  await page.keyboard.press('4'); await page.waitForFunction(() => window.starAgent.state.character.visible);
  await shot('game-third-person');
  await page.keyboard.down('w'); await frames(24); await shot('game-third-person-walk'); await page.keyboard.up('w');
} finally {
  await writeFile(join(out, 'record.json'), JSON.stringify({ browser: browser.version(), url: process.env.INTEGRATION_URL, captures, errors,
    note: 'Fresh captures produced by the invoking reviewer. Studio controls exercise animation assets. Terrain tour uses fixtures; cockpit boarding uses physical controls.' }, null, 2));
  await browser.close();
}
if (errors.length) throw Error(errors.join('\n'));
await import('./integration-tour.mjs');

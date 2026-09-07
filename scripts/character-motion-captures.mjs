// Targeted follow-up for the independent art review: wait for the requested
// state, then record actual playing frames rather than the preceding transition.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const cache = process.env.CHARACTER_REVIEW_CACHE || join(homedir(), '.cache', 'star-agent-character', 'opus-review');
process.env.TMPDIR = join(cache, 'tmp');
const out = join(cache, process.argv.includes('--equipment-only') ? 'grip-final' : 'motion');
await mkdir(process.env.TMPDIR, { recursive: true }); await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=gl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(60000);
const errors = [], captures = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
const frames = count => page.evaluate(async count => { for (let i = 0; i < count; i++) await new Promise(r => requestAnimationFrame(r)); }, count);
const shot = async name => {
  await page.screenshot({ path: join(out, `${name}.png`) });
  captures.push({ name, state: await page.evaluate(() => ({ ...window.avatarStudio.state,
    clip: window.avatarStudio.character.clipName,
    mixerTime: window.avatarStudio.character.mixer.time })) });
};
try {
  await page.goto(`${process.env.INTEGRATION_URL || 'http://127.0.0.1:5318'}/dev/avatar-studio.html?rig=player-expedition`);
  await page.waitForFunction(() => window.avatarStudio?.state.ready);
  for (const motion of (process.argv.includes('--equipment-only') ? [] : ['sit', 'climb', 'walk', 'run'])) {
    await page.getByLabel('Movement', { exact: true }).selectOption(motion);
    await page.waitForFunction(motion => window.avatarStudio.state.transition === null && window.avatarStudio.state.characterState === motion, motion);
    await frames(30);
    for (let i = 0; i < (motion === 'sit' ? 1 : 3); i++) {
      await shot(`${motion}-${i}`); await frames(10);
    }
    await page.getByRole('button', { name: 'Side', exact: true }).click(); await frames(20); await shot(`${motion}-side`);
    await page.getByRole('button', { name: 'Front', exact: true }).click(); await frames(20);
  }
  await page.getByLabel('Movement', { exact: true }).selectOption('idle');
  await page.waitForFunction(() => window.avatarStudio.state.transition === null && window.avatarStudio.state.characterState === 'idle');
  for (const item of ['rifle-laser', 'sidearm-pistol', 'mining-laser-tool']) {
    await page.getByLabel('Equipment', { exact: true }).selectOption(item);
    await page.waitForFunction(() => !document.getElementById('avatar-fire').disabled);
    for (const view of ['Hands', 'Side']) {
      await page.getByRole('button', { name: view, exact: true }).click(); await frames(40); await shot(`${item}-${view.toLowerCase()}`);
    }
    await page.getByRole('button', { name: 'Hands', exact: true }).click(); await frames(20);
    // An opposing close camera exposes the inside of the supporting glove.
    // Only the review camera changes; the playing rig/equipment are untouched.
    await page.evaluate(() => window.avatarStudio.camera.position.set(-1.05, 1.45, -1.25));
    await frames(20); await shot(`${item}-palms`);
  }
} finally {
  await writeFile(join(out, 'record.json'), JSON.stringify({ browser: browser.version(), captures, errors,
    note: 'Continuous live playback sampled at frame intervals. No animation time or bone transforms were set by the harness.' }, null, 2));
  await browser.close();
}
if (errors.length) throw Error(errors.join('\n'));
console.log(`Captured ${captures.length} motion frames with no browser errors/warnings in ${out}`);

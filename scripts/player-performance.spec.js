import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('nine remote pilots and ships preserve exact pixels, poses and draw counts', async ({ page }) => {
  const out = process.env.PLAYER_PERFORMANCE_EVIDENCE || '/tmp/star-agent-player-performance';
  await mkdir(out, { recursive: true });
  const errors = [], warnings = [], samples = {};
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); if (message.type() === 'warning') warnings.push(message.text()); });
  try {
    for (const implementation of ['baseline', 'candidate']) {
      await page.goto(`/scripts/fixtures/player-performance.html${implementation === 'baseline' ? '?baseline' : ''}`);
      await page.waitForFunction(() => window.playerPerformance?.ready);
      samples[implementation] = {};
      for (const stage of ['pilots', 'ships']) {
        samples[implementation][stage] = await page.evaluate(stage => window.playerPerformance.run(stage), stage);
        await page.screenshot({ path: `${out}/${implementation}-${stage}.png` });
      }
      await page.evaluate(() => window.playerPerformance.dispose());
    }
    for (const stage of ['pilots', 'ships']) {
      expect(samples.candidate[stage].matrices).toEqual(samples.baseline[stage].matrices);
      expect(samples.candidate[stage].pixels).toBe(samples.baseline[stage].pixels);
      expect(samples.candidate[stage].draws).toBe(samples.baseline[stage].draws);
      expect(samples.candidate[stage].triangles).toBe(samples.baseline[stage].triangles);
    }
    expect(errors).toEqual([]);
  } finally {
    await writeFile(`${out}/browser.json`, JSON.stringify({ at: new Date().toISOString(), samples, errors, warnings }, null, 2));
  }
});

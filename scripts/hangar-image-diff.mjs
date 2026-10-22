// Compare independently captured, HUD-hidden hangar tours. Diagnostic output
// only: this never updates a baseline and a visual difference is a review item.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const usage = 'node scripts/hangar-image-diff.mjs --before DIR --after DIR --out /tmp/DIR';
const options = {};
for (let i = 2; i < process.argv.length; i++) {
  const flag = process.argv[i];
  if (flag === '--help') { console.log(usage); process.exit(0); }
  if (!['--before', '--after', '--out'].includes(flag)) throw new Error(`Unknown argument: ${flag}\n${usage}`);
  const value = process.argv[++i];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a directory`);
  if (options[flag.slice(2)]) throw new Error(`Duplicate argument: ${flag}`);
  options[flag.slice(2)] = resolve(value);
}
if (!options.before || !options.after || !options.out) throw new Error(usage);
if (!options.out.startsWith(`/tmp${sep}`)) throw new Error('--out must be beneath /tmp');

// Reuse the actual pixelmatch implementation bundled with the installed
// Playwright. Fail explicitly if its internal adapter changes; do not silently
// replace pixelmatch with another metric or install another dependency.
const require = createRequire(import.meta.url);
let PNG, compare, version;
try {
  ({ PNG } = require('playwright-core/lib/utilsBundle'));
  compare = require('playwright-core/lib/coreBundle').utils.getComparator('image/png');
  version = require('playwright-core/package.json').version;
  if (!PNG?.sync || typeof compare !== 'function') throw new Error('Missing PNG or comparator export');
} catch (error) {
  throw new Error(`Installed Playwright PNG/pixelmatch adapter unavailable: ${error.message}`);
}

const before = await realpath(options.before), after = await realpath(options.after);
const list = async directory => (await readdir(directory)).filter(name => /^0[1-8]-.+\.png$/.test(name)).sort();
const [beforeFiles, afterFiles] = await Promise.all([list(before), list(after)]);
for (const [directory, files] of [[before, beforeFiles], [after, afterFiles]]) {
  if (files.length !== 8 || new Set(files.map(name => name.slice(0, 2))).size !== 8)
    throw new Error(`${directory} must contain exactly one PNG for each fixed view 01 through 08`);
}
if (beforeFiles.join('\n') !== afterFiles.join('\n')) throw new Error('Before/after fixed-view filenames do not match');

const pairs = [];
for (const name of beforeFiles) {
  const [oldBytes, newBytes] = await Promise.all([readFile(resolve(before, name)), readFile(resolve(after, name))]);
  const oldImage = PNG.sync.read(oldBytes), newImage = PNG.sync.read(newBytes);
  if (oldImage.width !== newImage.width || oldImage.height !== newImage.height)
    throw new Error(`${name}: dimensions differ (${oldImage.width}×${oldImage.height} vs ${newImage.width}×${newImage.height})`);
  if (oldImage.width !== 1600 || oldImage.height !== 900)
    throw new Error(`${name}: fixed-view comparison requires 1600×900, received ${oldImage.width}×${oldImage.height}`);
  pairs.push({ name, oldBytes, newBytes, width: oldImage.width, height: oldImage.height });
}

await mkdir(options.out, { recursive: true });
const out = await realpath(options.out);
if (!out.startsWith(`/tmp${sep}`) || out === before || out === after)
  throw new Error('--out must resolve beneath /tmp and differ from both input directories');
const threshold = .1, reviewFraction = .02, views = [];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
for (const { name, oldBytes, newBytes, width, height } of pairs) {
  // A negative reporting limit asks this wrapper to return its real pixel count
  // and diagnostic PNG even for identical images. We apply the 2% review rule
  // ourselves using the exact count, not Playwright's rounded error-message ratio.
  const result = compare(newBytes, oldBytes, { comparator: 'pixelmatch', threshold, maxDiffPixels: -1 });
  const count = result?.errorMessage?.match(/^(\d+) pixels \(ratio [\d.]+ of all image pixels\) are different\.$/);
  if (!count || !Buffer.isBuffer(result.diff)) throw new Error(`Playwright pixelmatch adapter returned an unexpected result for ${name}`);
  const differentPixels = Number(count[1]), totalPixels = width * height, fraction = differentPixels / totalPixels;
  const diffFile = name.replace(/\.png$/, '.diff.png');
  await writeFile(resolve(out, diffFile), result.diff);
  views.push({ name, width, height, totalPixels, differentPixels, fraction, review: fraction > reviewFraction,
    beforeSha256: sha256(oldBytes), afterSha256: sha256(newBytes), diffFile });
  console.log(`${name}: ${differentPixels}/${totalPixels} pixels (${(fraction * 100).toFixed(4)}%)${fraction > reviewFraction ? ' — REVIEW' : ''}`);
}
const report = {
  before, after, out, comparator: 'pixelmatch', dependency: `playwright-core@${version} bundled pixelmatch/pngjs`,
  threshold, includeAA: false, reviewFraction,
  masking: 'None: both input tours hide the HUD, so no HUD clock/FPS mask is needed.',
  policy: 'Differences above 2% are review items, not automatic failures. Baselines are never rewritten.',
  reviewRequired: views.some(view => view.review), views,
};
await writeFile(resolve(out, 'comparison.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Review report: ${resolve(out, 'comparison.json')}`);

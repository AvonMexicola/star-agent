/**
 * Build the Cosmic Chicken runtime textures from the retained masters.
 *
 *   node scripts/cosmic-chicken-textures.mjs
 *
 * The two supplied poster masters carry a broken wordmark: the M of COSMIC was
 * generated as an A-like glyph, so both posters read COSAIC. The menu master
 * carries the same wordmark, correctly set, in the same typeface and colours.
 * This script lifts the correct word from the menu master and composites it over
 * the damaged word on each poster, then encodes the 1024-max WebP derivatives.
 *
 * Deterministic and offline: Chromium is used only as an image decoder, canvas
 * and WebP encoder. Nothing is downloaded and no master is modified in place.
 */
import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const masters = new URL('assets/cosmic-chicken/source/', root);
const out = new URL('public/textures/station/', root);

/** Measured on the retained masters with a cream-pixel bounding-box scan, in
 * master pixels. Both wordmark lines are flat cream type on the same dark
 * ground, so lifting the word keeps the letterforms, weight and colour exactly.
 * The lockup is justified: COSMIC and CHICKEN share their left and right edges,
 * so the replacement is drawn to the damaged word's box rather than to its own
 * aspect, which costs about four per cent of horizontal width on a geometric
 * sans and is not visible at any in-game distance. */
const MENU_WORD = { x: 595, y: 75, w: 565, h: 75 };      // "COSMIC", menu master
const POSTER_WORD = { x: 270, y: 310, w: 637, h: 90 };   // "COSAIC", both poster masters
const CLEAN_ROW = 303;                                    // dark ground just above the word

const TEXTURES = [
  { master: 'cosmic-chicken-poster-wings.png', name: 'cosmic-chicken-poster-wings', repair: true, max: 1024, quality: .9 },
  { master: 'cosmic-chicken-poster-sando.png', name: 'cosmic-chicken-poster-sando', repair: true, max: 1024, quality: .9 },
  { master: 'cosmic-chicken-menu.png', name: 'cosmic-chicken-menu', repair: false, max: 1024, quality: .92 },
];

const dataUrl = async file => `data:image/png;base64,${(await readFile(new URL(file, masters))).toString('base64')}`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await mkdir(fileURLToPath(out), { recursive: true });

const menuSource = await dataUrl('cosmic-chicken-menu.png');
const results = [];
for (const texture of TEXTURES) {
  const source = await dataUrl(texture.master);
  const encoded = await page.evaluate(async ({ source, menuSource, texture, MENU_WORD, POSTER_WORD, CLEAN_ROW }) => {
    const load = src => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('decode failed'));
      image.src = src;
    });
    const master = await load(source);
    const canvas = document.createElement('canvas');
    canvas.width = master.naturalWidth; canvas.height = master.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(master, 0, 0);
    if (texture.repair) {
      const menu = await load(menuSource);
      // Paint out the damaged word by stretching the clean row of ground just
      // above it down over the whole line. That keeps the poster's own
      // horizontal shading instead of stamping a flat rectangle over it.
      const pad = { left: 8, right: 8, top: 6, bottom: 6 };
      const box = { x: POSTER_WORD.x - pad.left, y: POSTER_WORD.y - pad.top,
        w: POSTER_WORD.w + pad.left + pad.right, h: POSTER_WORD.h + pad.top + pad.bottom };
      const row = ctx.getImageData(box.x, CLEAN_ROW, box.w, 1);
      const strip = document.createElement('canvas');
      strip.width = box.w; strip.height = 1;
      strip.getContext('2d').putImageData(row, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(strip, 0, 0, box.w, 1, box.x, box.y, box.w, box.h);
      ctx.imageSmoothingEnabled = true;
      // Draw the correct word into the damaged word's exact box.
      ctx.drawImage(menu, MENU_WORD.x, MENU_WORD.y, MENU_WORD.w, MENU_WORD.h,
        POSTER_WORD.x, POSTER_WORD.y, POSTER_WORD.w, POSTER_WORD.h);
    }
    const longest = Math.max(canvas.width, canvas.height);
    const factor = Math.min(1, texture.max / longest);
    const target = document.createElement('canvas');
    target.width = Math.round(canvas.width * factor);
    target.height = Math.round(canvas.height * factor);
    const tctx = target.getContext('2d');
    tctx.imageSmoothingEnabled = true; tctx.imageSmoothingQuality = 'high';
    tctx.drawImage(canvas, 0, 0, target.width, target.height);
    const blob = await new Promise(resolve => target.toBlob(resolve, 'image/webp', texture.quality));
    const buffer = new Uint8Array(await blob.arrayBuffer());
    return { width: target.width, height: target.height, bytes: [...buffer] };
  }, { source, menuSource, texture, MENU_WORD, POSTER_WORD, CLEAN_ROW });
  const file = new URL(`${texture.name}.webp`, out);
  await writeFile(file, Buffer.from(encoded.bytes));
  results.push({ name: texture.name, size: `${encoded.width}x${encoded.height}`, bytes: encoded.bytes.length, repaired: texture.repair });
}
await browser.close();
for (const r of results) console.log('COSMIC_TEXTURE', r.name, r.size, r.bytes + ' bytes', r.repaired ? '(wordmark repaired)' : '');

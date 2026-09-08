import { readFileSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
// Original licensed Google Fonts TTFs are retained outside the shipped directory.
for (const font of JSON.parse(readFileSync('public/fonts/sources.json'))) {
  const source = resolve(font.source);
  execFileSync('woff2_compress', [source]);
  renameSync(source.replace(/\.ttf$/, '.woff2'), resolve('public/fonts', font.file));
}

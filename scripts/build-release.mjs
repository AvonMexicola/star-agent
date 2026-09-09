import { build } from 'vite';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { resolve, posix } from 'node:path';
import config from '../vite.config.js';
import {MULTIPLAYER_VERSION,MAX_PLAYERS,WORLD_SEED} from '../src/multiplayer/protocol.js';

const channel = process.argv[2];
if (!['solo', 'multiplayer'].includes(channel)) throw new Error('Choose solo or multiplayer.');
process.env.VITE_SOLO_BUILD = channel === 'solo' ? '1' : '0';
process.env.VITE_DEV_TOOLS = '1';
process.env.VITE_MULTIPLAYER_ENTRY = channel === 'multiplayer' ? '1' : '0';
const outDir = `dist/${channel}`;
const input = { ...config.build.rollupOptions.input }, sourceAliases = new Map();
{
  // Public files normally pass through Vite untouched. These viewers import
  // source modules, so give each a real bundled entry for static hosting.
  for (const name of await readdir('public/dev')) {
    if (name.endsWith('.js')) input[`viewer-${name.slice(0, -3)}`] = resolve('public/dev', name);
  }
  input['viewer-freighter'] = resolve('src/freighter-studio.js');
  input['viewer-style'] = resolve('src/style.css');
  // Standalone pages also point directly at newer source studios and stable
  // /assets aliases. Include their real modules/styles in both scene-enabled builds.
  for (const name of (await readdir('public/dev')).sort()) {
    if (!name.endsWith('.html')) continue;
    const html = await readFile(`public/dev/${name}`, 'utf8');
    for (const [, url] of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/g)) {
      const source = url.startsWith('/src/') ? url.slice(1) : url.startsWith('/assets/') ? `src/${posix.basename(url)}` : null;
      if (!source || !/\.(?:js|css)$/.test(source) || !(await stat(source).catch(() => null))?.isFile()) continue;
      sourceAliases.set(url, source);
      const path = resolve(source);
      if (!Object.values(input).includes(path)) input[`viewer-source-${sourceAliases.size}`] = path;
    }
  }
}
await build({ ...config, configFile: false, build: { ...config.build, outDir, manifest: true,
  rollupOptions: { ...config.build.rollupOptions, input } } });
{
  const manifest = JSON.parse(await readFile(`${outDir}/.vite/manifest.json`, 'utf8'));
  for (const name of await readdir(`${outDir}/dev`)) {
    if (!name.endsWith('.html')) continue;
    const path = `${outDir}/dev/${name}`;
    let html = await readFile(path, 'utf8');
    const styles = new Set();
    html = html.replace(/(<(?:script|link)\b[^>]*\b(?:src|href)=["'])([^"']+)(["'])/g, (tag, before, url, after) => {
      const source = sourceAliases.get(url) ?? (url.startsWith('/src/') ? url.slice(1)
        : url.startsWith('/public/') ? url.slice(1)
        : url.startsWith('/assets/') ? null : posix.normalize(`public/dev/${url}`));
      const entry = source && manifest[source];
      if (!entry) return tag;
      for (const css of entry.css ?? []) styles.add(css);
      return `${before}/${entry.file}${after}`;
    });
    html = html.replaceAll('/src/style.css', `/${manifest['src/style.css'].file}`);
    if (!/<link\b[^>]*rel=["']icon["']/.test(html)) html = html.replace('</head>', '<link rel="icon" type="image/svg+xml" href="/favicon.svg"></head>');
    html = html.replace('</head>', [...styles].map(css => `<link rel="stylesheet" href="/${css}">`).join('') + '</head>');
    await writeFile(path, html);
  }
}
await writeFile(`${outDir}/release.json`, JSON.stringify({ channel,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  builtAt: new Date().toISOString(), multiplayerVersion: MULTIPLAYER_VERSION, maxPlayers: MAX_PLAYERS, seed: WORLD_SEED, devTools: true }) + '\n');

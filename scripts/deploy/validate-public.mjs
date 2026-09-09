import { readFile, readdir, stat } from 'node:fs/promises';
import { posix } from 'node:path';
const html=await readFile('site/index.html','utf8');
for(const host of ['https://play.staragent.site/','https://multiplayer.staragent.site/'])if(!html.includes(`href="${host}"`))throw Error(`Missing play link: ${host}`);
const local=new Set([...html.matchAll(/(?:src|href|poster|data-loop)="(\/[^"#]*)"/g)].map(m=>m[1]));
for(const url of local){const path='site'+(url==='/'?'/index.html':url);if(!(await stat(path)).isFile())throw Error(`Missing site asset: ${path}`);}
for(const path of ['dist/solo/index.html','dist/solo/release.json','site/media/flight.mp4','site/media/hangar.mp4','site/media/field-notes.mp4','site/media/nomad-aeon-arrival.mp4','site/media/burrow-atlas.mp4'])if((await stat(path)).size===0)throw Error(`Empty release file: ${path}`);
const release=JSON.parse(await readFile('dist/solo/release.json','utf8'));if(release.channel!=='solo')throw Error('Expected the explicit solo build.');
console.log(`Public site and solo assets verified (${local.size} site files).`);

// Standalone tool pages must use real static output, not Vite-only source URLs.
for (const channel of ['solo', ...(process.argv.includes('--multiplayer') ? ['multiplayer'] : [])]) {
  const root = `dist/${channel}`;
  const metadata = JSON.parse(await readFile(`${root}/release.json`, 'utf8'));
  if (metadata.channel !== channel) throw Error(`Wrong release channel: ${channel}`);
  let viewerReferences = 0;
  for (const name of await readdir(`${root}/dev`)) {
    if (!name.endsWith('.html')) continue;
    const html = await readFile(`${root}/dev/${name}`, 'utf8');
    for (const [, url] of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/g)) {
      if (/^(?:data:|https?:)/.test(url)) continue;
      const path = posix.resolve('/dev', url);
      if (!(await stat(`${root}${path}`)).isFile()) throw Error(`Missing viewer dependency: ${channel}: ${name}: ${url}`);
      viewerReferences++;
    }
  }
  console.log(`${channel}: packaged viewer references verified (${viewerReferences}).`);
}

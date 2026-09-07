// One owned static preview serves the homepage and the exact solo build.
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.woff2':'font/woff2', '.glb':'model/gltf-binary', '.mp4':'video/mp4', '.webm':'video/webm' };
for (const [port, dir] of [[5568,'site'],[5569,'dist/solo']]) {
  const root = resolve(dir);
  http.createServer(async (req,res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (path.endsWith('/')) path += 'index.html';
      const file = resolve(root, '.'+path);
      if (!file.startsWith(root+'/')) { res.writeHead(403).end(); return; }
      const info = await stat(file);
      if (!info.isFile()) throw new Error('Missing');
      const headers = { 'Content-Type':types[extname(file)]??'application/octet-stream', 'Accept-Ranges':'bytes' };
      const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      const start = range ? +range[1] : 0, end = range?.[2] ? Math.min(+range[2],info.size-1) : info.size-1;
      if (start > end || start >= info.size) { res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end(); return; }
      headers['Content-Length'] = end-start+1;
      if(range) headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
      res.writeHead(range?206:200,headers);
      if(req.method==='HEAD')res.end();else createReadStream(file,{start,end}).pipe(res);
    } catch { res.writeHead(404).end('Not found'); }
  }).listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${port}`));
}

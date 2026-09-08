import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Public assets keep readable paths; revisions make cached bytes match this build. */
export function modelRevisions(directory) {
  const revisions = {};
  function visit(folder, prefix) {
    const entries = readdirSync(folder, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      const path = join(folder, entry.name);
      const url = `${prefix}/${encodeURIComponent(entry.name)}`;
      if (entry.isDirectory()) visit(path, url);
      else if (entry.isFile()) revisions[url] = createHash('sha256').update(readFileSync(path)).digest('hex');
    }
  }
  visit(directory, '/models');
  return revisions;
}

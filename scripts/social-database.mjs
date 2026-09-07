// Disposable local PostgreSQL. Never read DATABASE_URL or the shared dev cluster.
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { startLocalDatabase } from '../server/local-database.js';
const directory = await mkdtemp(join(tmpdir(), 'sa-social-'));
let database;
try {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  await mkdir(directory, { recursive: true });
  database = await startLocalDatabase({ XDG_DATA_HOME: directory, DEV_DATABASE_NAME: 'social-test', DEV_DATABASE_PORT: String(port) });
  const files = process.argv.slice(2);
  const child = spawn(process.execPath, ['--test', ...(files.length ? files : ['tests/server-social.test.js', 'tests/server-auth.test.js'])], {
    stdio: 'inherit', env: { ...process.env, TEST_DATABASE_URL: database.connectionString },
  });
  process.exitCode = await new Promise(resolve => { child.once('error', () => resolve(1)); child.once('exit', code => resolve(code ?? 1)); });
} finally { await database?.close(); await rm(directory, { recursive: true, force: true }); }

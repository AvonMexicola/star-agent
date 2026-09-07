import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, chmod, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/** Settings for the isolated local preview. Never inherit a production DATABASE_URL. */
export function localDatabaseOptions(env = process.env) {
  if (env.DEV_DATABASE_URL !== undefined) {
    let url;
    try { url = new URL(env.DEV_DATABASE_URL); } catch { throw new Error('DEV_DATABASE_URL must be a local PostgreSQL URL.'); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error('DEV_DATABASE_URL must point to PostgreSQL on loopback.');
    }
    return { connectionString: env.DEV_DATABASE_URL };
  }
  const name = env.DEV_DATABASE_NAME ?? 'star-agent-local';
  const databasePort = Number(env.DEV_DATABASE_PORT ?? 51224);
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(name)) throw new Error('DEV_DATABASE_NAME must use lowercase letters, digits and hyphens.');
  if (!Number.isInteger(databasePort) || databasePort < 1024 || databasePort > 65535) {
    throw new Error('DEV_DATABASE_PORT must be between 1024 and 65535.');
  }
  const dataRoot = env.XDG_DATA_HOME || (process.platform === 'win32' ? env.LOCALAPPDATA : null) || join(homedir(), '.local', 'share');
  return { name, databasePort, directory: resolve(dataRoot, 'star-agent', 'postgres', name) };
}

async function exists(path) { try { await access(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
async function readCredentials(directory) {
  const credentials = JSON.parse(await readFile(join(directory, 'credentials.json'), 'utf8'));
  if (credentials.user !== 'star_agent' || !/^[A-Za-z0-9_-]{43}$/.test(credentials.password)) throw new Error('Invalid local database credentials file.');
  return credentials;
}
const connectionFor = (credentials, port) => `postgresql://${credentials.user}:${credentials.password}@127.0.0.1:${port}/star_agent`;
function launch(binary, args) {
  const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, LC_ALL: 'C' } });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { output = (output + data).slice(-12000); });
  const closed = new Promise(resolve => { child.once('error', () => resolve({ code: 1 })); child.once('close', (code, signal) => resolve({ code, signal })); });
  return { child, closed, output: () => output };
}

/** Native PostgreSQL in a private user data directory, with no root or Docker requirement. */
export async function startLocalDatabase(env = process.env) {
  const options = localDatabaseOptions(env);
  if (options.connectionString) return { connectionString: options.connectionString, description: 'configured local PostgreSQL', async close() {} };
  if (process.getuid?.() === 0) throw new Error('Run local PostgreSQL as a regular user, or set DEV_DATABASE_URL.');
  // Only use the portable binaries. The wrapper's process-wide exit hook would
  // stop SQL before the API has drained pending inventory writes.
  const platform = process.platform === 'win32' ? 'windows' : process.platform;
  const { postgres, initdb } = await import(`@embedded-postgres/${platform}-${process.arch}`);
  const { directory, databasePort } = options, cluster = join(directory, 'cluster');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const credentialPath = join(directory, 'credentials.json');
  if (!await exists(credentialPath)) {
    if (await exists(cluster)) throw new Error('Existing database has no credentials file; restore it instead of resetting accounts.');
    try { await writeFile(credentialPath, JSON.stringify({ user: 'star_agent', password: randomBytes(32).toString('base64url') }), { mode: 0o600, flag: 'wx' }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const credentials = await readCredentials(directory);
  if (!await exists(join(cluster, 'PG_VERSION'))) {
    const passwordFile = join(directory, '.init-password');
    await writeFile(passwordFile, credentials.password, { mode: 0o600 });
    try {
      const setup = launch(initdb, ['-D', cluster, '-U', credentials.user, '--auth=scram-sha-256', `--pwfile=${passwordFile}`, '--encoding=UTF8', '--locale=C']);
      if ((await setup.closed).code !== 0) throw new Error('Local PostgreSQL initialization failed. Existing files were preserved.');
    } finally { await unlink(passwordFile); }
  }
  if ((await readFile(join(cluster, 'PG_VERSION'), 'utf8')).trim() !== '16') {
    throw new Error('Local PostgreSQL major version mismatch; migrate the database before upgrading.');
  }
  const server = launch(postgres, ['-D', cluster, '-p', String(databasePort), '-h', '127.0.0.1', '-c', 'unix_socket_directories=', '-c', 'max_connections=30']);
  let closePromise;
  const close = () => closePromise ??= (async () => {
    if (server.child.exitCode === null && !server.child.signalCode) server.child.kill('SIGINT');
    return server.closed;
  })();
  let startupPoll;
  try {
    await Promise.race([
      new Promise((resolve, reject) => {
        const started = Date.now();
        startupPoll = setInterval(() => {
          if (server.output().includes('database system is ready to accept connections')) { clearInterval(startupPoll); resolve(); }
          else if (server.child.exitCode !== null || Date.now() - started > 15000) { clearInterval(startupPoll); reject(new Error('Local PostgreSQL did not start; check database ownership and port availability.')); }
        }, 25);
      }),
      server.closed.then(() => { throw new Error('Local PostgreSQL exited before startup.'); }),
    ]);
    const { default: pg } = await import('pg');
    const admin = new pg.Client({ ...credentials, host: '127.0.0.1', port: databasePort, database: 'postgres', connectionTimeoutMillis: 5000 });
    try {
      await admin.connect();
      if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname='star_agent'")).rowCount) await admin.query('CREATE DATABASE star_agent');
    } finally { await admin.end(); }
    return { connectionString: connectionFor(credentials, databasePort),
      description: `PostgreSQL 16 (${directory})`, directory, closed: server.closed, close };
  } catch (error) { await close(); throw error; }
  finally { clearInterval(startupPoll); }
}

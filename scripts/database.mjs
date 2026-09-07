import { createPostgresStore } from '../server/database.js';
import { startLocalDatabase } from '../server/local-database.js';

const action = process.argv[2];
if (action === 'migrate') {
  const store = await createPostgresStore({ connectionString: process.env.DATABASE_URL });
  try { await store.migrate(); console.log('Account migrations applied without resetting data.'); }
  finally { await store.close(); }
} else if (action === 'local') {
  const database = await startLocalDatabase();
  console.log(`${database.description} ready. Data persists after Ctrl+C.`);
  let closing = false;
  const stop = () => {
    if (closing) return; closing = true;
    database.close().catch(() => { console.error('LOCAL_DATABASE_SHUTDOWN_FAILED'); process.exitCode = 1; });
  };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
} else {
  throw new Error('Use npm run db:migrate with DATABASE_URL, or npm run db:local.');
}

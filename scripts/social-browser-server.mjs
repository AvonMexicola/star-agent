// Explicit disposable acceptance fixture. These are real account/friend rows in
// an isolated memory store, never fake UI data or the shared development DB.
import { createMemoryStore } from '../server/database.js';
import { createAuth } from '../server/auth.js';
import { createServer } from '../server/index.js';
import { createWorld } from '../server/world.js';
import { createRoom } from '../server/room.js';
const store = createMemoryStore(), publicOrigin = 'http://127.0.0.1:5544';
const auth = createAuth({ store, publicOrigin, secureCookies: false });
const registered = await auth.register({ email: 'PagePilot@example.test', callsign: 'PagePilot', password: 'isolated social password' });
if (registered.status !== 201) throw new Error('Could not initialize isolated account fixture.');
const account = await store.findAccountByEmail('PagePilot@example.test');
for (let i = 0; i < 30; i++) {
  const callsign = `Roster_${String(i).padStart(2, '0')}`;
  const peer = await store.createAccount({ email: `${callsign}@example.test`, callsign, passwordHash: account.passwordHash });
  await store.socialChange(account.id, peer.id, 'request'); await store.socialChange(peer.id, account.id, 'accept');
}
const world = await createWorld(), room = createRoom({ store, world });
const app = await createServer({ store, room, publicOrigin });
await app.listen(8094); console.log('Isolated social acceptance server ready on8094.');
let stopping = false;
async function close() { if (stopping) return; stopping = true; await app.close(); }
process.once('SIGINT', () => { void close(); }); process.once('SIGTERM', () => { void close(); });

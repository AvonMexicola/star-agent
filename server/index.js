import {createBaseSites} from './base-sites.js';
import { createServer as createHTTPServer, STATUS_CODES } from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { createAuth, SESSION_COOKIE } from './auth.js';
import { createMemoryStore, createPostgresStore } from './database.js';
import { createSMTPMailer } from './mail.js';
import { createSocialService } from './social.js';
import { CHAT_POLICY, createChatModerator } from './chat-moderation.js';

const MAX_BODY = 16 * 1024;
const MAX_BUFFERED = 256 * 1024;
const POST_ACTIONS = new Set(['register', 'login', 'logout', 'forgot', 'reset']);
const httpError = (status, message) => Object.assign(new Error(message), { status });
const errorMessage = error => ({
  ROOM_FULL: 'This universe has ten players. Try joining again when a place is free.',
  ACCOUNT_CONNECTED: 'This account is already connected to the universe.',
})[error?.code] ?? 'The multiplayer request could not be completed.';

function readJSON(req, maximum = MAX_BODY) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) throw httpError(415, 'Use application/json.');
  if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') throw httpError(415, 'Compressed request bodies are not supported.');
  if (Number(req.headers['content-length']) > maximum) throw httpError(413, 'Request body exceeds the size limit.');
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0, settled = false;
    const fail = error => { if (!settled) { settled = true; chunks.length = 0; reject(error); } };
    req.on('data', chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > maximum) { fail(httpError(413, 'Request body exceeds the size limit.')); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      try {
        const input = size ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Object required.');
        settled = true; resolve(input);
      } catch { fail(httpError(400, 'Send a valid JSON object.')); }
    });
    req.on('aborted', () => fail(httpError(400, 'Request aborted.')));
    req.on('error', () => fail(httpError(400, 'Request interrupted.')));
  });
}

function createRequestLimiter() {
  const entries = new Map();
  return (kind, ip) => {
    const now = Date.now();
    for (const [key, value] of entries) if (value.until <= now) entries.delete(key);
    const key = `${kind}:${ip}`;
    const entry = entries.get(key) ?? { count: 0, until: now + 60000 };
    if (!entries.has(key) && entries.size >= 10000) return false;
    entry.count++; entries.set(key, entry);
    return entry.count <= (kind === 'upgrade' ? 30 : 180);
  };
}

function cookieValue(cookie) {
  return String(cookie ?? '').split(';').map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`));
}

/** Owns supplied room/store/mail lifecycle. Mount /api and /ws behind the same origin as the game. */
export async function createServer({ store, mail, room, publicOrigin, secureCookies = false,
  trustProxy = false, heartbeatIntervalMs = 30000, logger = console, chatPolicy = CHAT_POLICY } = {}) {
  if (!room || !store) throw new Error('An explicit room and account store are required.');
  if (!Number.isFinite(heartbeatIntervalMs) || heartbeatIntervalMs < 10) throw new Error('Heartbeat interval must be at least 10 ms.');
  const bases=store.mutateBaseSites?createBaseSites({store}):null;
  const origin = new URL(publicOrigin).origin;
  const limit = createRequestLimiter();
  const peers = new Map(), tasks = new Set(), upgradeSockets = new Set();
  let closing = false, closePromise;
  const diagnostic = code => { try { logger.error?.(code); } catch { /* logging must not crash the server */ } };
  const social = createSocialService({ store, onError: diagnostic, moderate: createChatModerator(chatPolicy) });
  function track(task) {
    const promise = Promise.resolve(task).catch(() => diagnostic('ROOM_OPERATION_FAILED'));
    tasks.add(promise); promise.finally(() => tasks.delete(promise)); return promise;
  }
  function context(req) {
    // Set trustProxy only when direct access is restricted to a proxy that replaces this header.
    const forwarded = trustProxy && typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',')[0].trim() : '';
    return { cookie: req.headers.cookie, ip: (forwarded || req.socket.remoteAddress || 'unknown').slice(0, 100) };
  }
  function endPeer(ws, code, message) {
    if (ws.readyState === WebSocket.OPEN) ws.close(code, message);
    else if (ws.readyState === WebSocket.CONNECTING) ws.terminate();
  }
  function leavePeer(peer) {
    social.leave(peer.social);
    if (peer.id === null || peer.leaveStarted) return;
    peer.leaveStarted = true;
    track(peer.receiveChain.then(() => room.leave(peer.id)));
  }
  const auth = createAuth({ store, mail, publicOrigin, secureCookies,
    onMailError: ({ code }) => diagnostic(code),
    onSessionsRevoked: async accountId => {
      for (const [ws, peer] of peers) if (peer.account.id === accountId) endPeer(ws, 1008, 'Session revoked. Sign in again.');
      await room.revoke(accountId);
    },
  });
  function respond(res, status, body, headers = {}) {
    if (res.destroyed || res.writableEnded) return;
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
      'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', ...headers });
    res.end(JSON.stringify(body));
  }
  const server = createHTTPServer({ maxHeaderSize: MAX_BODY }, async (req, res) => {
    try {
      if (closing) throw httpError(503, 'Server is shutting down.');
      const ctx = context(req);
      if (!limit('http', ctx.ip)) throw httpError(429, 'Too many requests. Try again shortly.');
      if ((req.headers.origin && req.headers.origin !== origin) || (req.method === 'POST' && req.headers.origin !== origin)) throw httpError(403, 'A same-origin request is required.');
      const path = new URL(req.url, origin).pathname;
      if (path === '/api/health' && req.method === 'GET') { respond(res, 200, { ok: true }); return; }
      if(path==='/api/bases'&&bases){
        const account=await auth.authenticate(ctx);if(!account)throw httpError(401,'Sign in to save bases on the server.');
        if(!['GET','POST'].includes(req.method))throw httpError(405,'Use GET or POST.');
        const command=req.method==='GET'?{action:'read'}:await readJSON(req,2*1024*1024);
        if(req.method==='POST'&&command.accountId!==account.id)throw httpError(409,'Account changed. Reconnect base saves with the owning account.');
        const state=await bases.command(account.id,command);respond(res,200,{...state,accountId:account.id});return;
      }
      const match = /^\/api\/auth\/([a-z]+)$/.exec(path);
      if (!match || (!POST_ACTIONS.has(match[1]) && match[1] !== 'session')) throw httpError(404, 'Not found.');
      const action = match[1];
      if (req.method !== (action === 'session' ? 'GET' : 'POST')) {
        respond(res, 405, { error: 'Method not allowed.' }, { allow: action === 'session' ? 'GET' : 'POST' }); return;
      }
      let response;
      if (action === 'session') response = await auth.session(ctx);
      else {
        const input = await readJSON(req);
        response = action === 'logout' ? await auth.logout(ctx) : await auth[action](input, ctx);
        if (action === 'logout') {
          const token = cookieValue(ctx.cookie);
          if (token) for (const [ws, peer] of peers) if (cookieValue(peer.context.cookie) === token) endPeer(ws, 1008, 'Signed out.');
        }
      }
      respond(res, response.status, response.body, response.headers);
    } catch (error) {
      if (!error.status) diagnostic('HTTP_REQUEST_FAILED');
      req.resume();
      respond(res, error.status ?? 500, { error: error.status ? error.message : 'The server could not complete the request.' }, { connection: 'close' });
    }
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.timeout = 15000;
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_BODY, perMessageDeflate: false });
  function rejectUpgrade(socket, status, message) {
    if (socket.destroyed) return;
    const body = JSON.stringify({ error: message });
    socket.end(`HTTP/1.1 ${status} ${STATUS_CODES[status]}\r\nConnection: close\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  }
  server.on('upgrade', (req, socket, head) => {
    upgradeSockets.add(socket);
    socket.once('close', () => upgradeSockets.delete(socket));
    socket.on('error', () => {});
    socket.setTimeout(10000, () => socket.destroy());
    track((async () => {
      if (closing) { rejectUpgrade(socket, 503, 'Server is shutting down.'); return; }
      if (new URL(req.url, origin).pathname !== '/ws') { rejectUpgrade(socket, 404, 'Not found.'); return; }
      if (req.headers.origin !== origin) { rejectUpgrade(socket, 403, 'A same-origin request is required.'); return; }
      const ctx = context(req);
      if (!limit('upgrade', ctx.ip) || wss.clients.size + upgradeSockets.size > 64) { rejectUpgrade(socket, 429, 'Too many connections. Try again shortly.'); return; }
      let account;
      try { account = await auth.authenticate(ctx); }
      catch { diagnostic('WEBSOCKET_AUTH_FAILED'); rejectUpgrade(socket, 503, 'Authentication is temporarily unavailable.'); return; }
      if (!account) { rejectUpgrade(socket, 401, 'Sign in before joining multiplayer.'); return; }
      if (closing || socket.destroyed) return;
      socket.setTimeout(0);
      wss.handleUpgrade(req, socket, head, ws => {
        upgradeSockets.delete(socket);
        const peer = { account, context: ctx, id: null, closed: false, alive: true, checking: false,
          messageWindow: Date.now(), messages: 0, pendingMessages: 0, receiveChain: Promise.resolve() };
        peers.set(ws, peer);
        const send = message => {
          if (ws.readyState !== WebSocket.OPEN) return;
          if (ws.bufferedAmount > MAX_BUFFERED) { endPeer(ws, 1013, 'Connection is too slow.'); return; }
          try { ws.send(JSON.stringify(message), error => { if (error) ws.terminate(); }); }
          catch { diagnostic('WEBSOCKET_SEND_FAILED'); endPeer(ws, 1011, 'Unable to send multiplayer state.'); }
        };
        ws.on('error', () => { /* invalid frames/maxPayload are handled by ws and close */ });
        ws.on('pong', () => { peer.alive = true; });
        ws.on('close', () => {
          peer.closed = true; peers.delete(ws);
          leavePeer(peer);
        });
        ws.on('message', (data, isBinary) => {
          if (peer.closed || ws.readyState !== WebSocket.OPEN) return;
          if (isBinary) { endPeer(ws, 1003, 'Send JSON text messages.'); return; }
          if (Date.now() - peer.messageWindow >= 1000) { peer.messageWindow = Date.now(); peer.messages = 0; }
          if (++peer.messages > 120 || peer.pendingMessages >= 64) {
            // Keep the public rejection and both bounds unchanged, but distinguish
            // an input burst from commands waiting on admission or room storage.
            diagnostic(peer.messages > 120 ? 'WEBSOCKET_MESSAGE_RATE_LIMIT' : 'WEBSOCKET_PENDING_MESSAGE_LIMIT');
            endPeer(ws, 1008, 'Too many messages.'); return;
          }
          let message;
          try { message = JSON.parse(data.toString()); if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error(); }
          catch { endPeer(ws, 1007, 'Send a valid JSON object.'); return; }
          peer.pendingMessages++;
          peer.receiveChain = peer.receiveChain.then(async () => {
            // The room can send welcome before social storage finishes loading.
            // Keep early commands in the same bounded queue until admission is
            // complete; never silently drop a request the client will await.
            await peer.admission;
            if (!peer.closed && peer.id !== null && peer.social && ws.readyState === WebSocket.OPEN) {
              if (message.type === 'social') await social.receive(peer.social, message);
              else await room.receive(peer.id, message);
            }
          }).catch(() => { diagnostic('ROOM_MESSAGE_REJECTED'); endPeer(ws, 1008, 'Invalid multiplayer command.'); })
            .finally(() => { peer.pendingMessages--; });
          track(peer.receiveChain);
        });
        peer.admission = (async () => {
          try {
            peer.id = await room.join(account, send);
            if (!peer.closed && !closing) peer.social = await social.join(account, send, (code, reason) => {
              peer.closed = true; endPeer(ws, code, reason); leavePeer(peer);
            });
            if (peer.closed || closing) leavePeer(peer);
          } catch (error) {
            const known = error?.code === 'ROOM_FULL' || error?.code === 'ACCOUNT_CONNECTED';
            if (!known) diagnostic('ROOM_JOIN_FAILED');
            send({ type: 'error', code: known ? error.code : 'JOIN_FAILED', message: errorMessage(error) });
            endPeer(ws, error?.code === 'ROOM_FULL' ? 1013 : 1008, errorMessage(error).slice(0, 120));
            if (peer.id !== null) leavePeer(peer);
          }
        })();
        track(peer.admission);
      });
    })().catch(() => { diagnostic('WEBSOCKET_UPGRADE_FAILED'); rejectUpgrade(socket, 400, 'WebSocket upgrade failed.'); }));
  });
  const heartbeat = setInterval(() => {
    for (const [ws, peer] of peers) {
      if (ws.readyState !== WebSocket.OPEN) { ws.terminate(); continue; }
      if (!peer.alive) { ws.terminate(); continue; }
      peer.alive = false;
      ws.ping();
      if (peer.checking) continue;
      peer.checking = true;
      track((async () => {
        try { if (!(await auth.authenticate(peer.context))) endPeer(ws, 1008, 'Session expired. Sign in again.'); }
        catch { diagnostic('WEBSOCKET_SESSION_CHECK_FAILED'); endPeer(ws, 1011, 'Session verification failed.'); }
        finally { peer.checking = false; }
      })());
    }
  }, heartbeatIntervalMs);
  heartbeat.unref();
  const pruning = setInterval(() => { track(Promise.resolve().then(() => store.pruneExpired?.(Date.now())).then(()=>bases?.sweep())); }, 60000);
  pruning.unref();
  return {
    server, wss,
    listen(port = 0, host = '127.0.0.1') {
      return new Promise((resolve, reject) => {
        const onError = error => { server.off('listening', onListening); reject(error); };
        const onListening = () => { server.off('error', onError); resolve(server.address()); };
        server.once('error', onError); server.once('listening', onListening); server.listen(port, host);
      });
    },
    close() {
      if (closePromise) return closePromise;
      closing = true; clearInterval(heartbeat); clearInterval(pruning);
      closePromise = (async () => {
        const httpClosed = new Promise(resolve => { server.close(() => resolve()); server.closeAllConnections(); });
        for (const socket of upgradeSockets) socket.destroy();
        for (const ws of wss.clients) ws.terminate();
        await new Promise(resolve => wss.close(() => resolve()));
        await Promise.all([...peers.values()].map(peer => peer.receiveChain));
        while (tasks.size) await Promise.all([...tasks]);
        const failures = [];
        for (const release of [() => social.close(), () => room.close(), () => mail?.close?.(), () => store.close?.()]) {
          try { await release(); } catch (error) { failures.push(error); }
        }
        await httpClosed;
        if (failures.length) throw new Error('Server resource shutdown failed.');
      })();
      return closePromise;
    },
  };
}

async function main() {
  const production = process.env.NODE_ENV === 'production';
  if (!process.env.PUBLIC_ORIGIN) throw new Error('PUBLIC_ORIGIN is required (the browser game origin).');
  if (production && process.env.STAR_AGENT_MEMORY === '1') throw new Error('In-memory multiplayer is forbidden in production.');
  const store = process.env.STAR_AGENT_MEMORY === '1' && !production ? createMemoryStore()
    : await createPostgresStore({ connectionString: process.env.DATABASE_URL });
  let mail, app;
  try {
    await store.migrate();
    if (process.env.SMTP_HOST || process.env.SMTP_FROM || process.env.SMTP_USER || process.env.SMTP_PASSWORD) mail = await createSMTPMailer();
    else console.warn('SMTP_NOT_CONFIGURED: password reset email delivery is unavailable.');
    const [{ createWorld }, { createRoom }] = await Promise.all([import('./world.js'), import('./room.js')]);
    const world = await createWorld();
    const room = createRoom({ world, store, onError: () => console.error('ROOM_OPERATION_FAILED') });
    app = await createServer({ store, mail, room, publicOrigin: process.env.PUBLIC_ORIGIN,
      secureCookies: new URL(process.env.PUBLIC_ORIGIN).protocol === 'https:', trustProxy: process.env.TRUST_PROXY === '1' });
    const port = Number(process.env.PORT ?? 8084);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be a valid port.');
    const address = await app.listen(port, process.env.HOST ?? '127.0.0.1');
    console.log(`Star Agent multiplayer listening on ${address.address}:${address.port}`);
    let stopping = false;
    const shutdown = () => {
      if (stopping) return; stopping = true;
      app.close().then(() => { process.exitCode = 0; }).catch(() => { console.error('SERVER_SHUTDOWN_FAILED'); process.exitCode = 1; });
    };
    process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
  } catch (error) {
    if (app) await app.close();
    else { try { await mail?.close?.(); } finally { await store.close(); } }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('SERVER_STARTUP_FAILED: check PUBLIC_ORIGIN, DATABASE_URL, SMTP configuration and port availability.'); process.exitCode = 1; });
}

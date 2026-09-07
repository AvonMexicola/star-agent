import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import WebSocket from 'ws';
const origin = 'http://127.0.0.1:5544';
const output = new URL('../test-results/social-captures/', import.meta.url).pathname;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(read) { for (let i = 0; i < 300; i++) { const result = read(); if (result) return result; await pause(10); } throw new Error('Isolated social fixture timed out.'); }
async function otherPilot(callsign, existing = false) {
  const response = await fetch(`${origin}/api/auth/${existing ? 'login' : 'register'}`, { method: 'POST', headers: { Origin: origin, 'content-type': 'application/json' }, body: JSON.stringify({ callsign, email: `${callsign}@example.test`, password: 'isolated social password' }) });
  expect(response.status).toBe(existing ? 200 : 201); const account = (await response.json()).account;
  const cookie = response.headers.get('set-cookie').split(';')[0];
  let connection;
  async function connect() {
    const messages = [];
    const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { headers: { Origin: origin, Cookie: cookie } });
    ws.on('message', data => messages.push(JSON.parse(data))); ws.on('error', () => {});
    await until(() => messages.find(message => message.type === 'social'));
    connection = { ws, messages };
  }
  await connect();
  return { account, connect, async close() { if (!connection || connection.ws.readyState > 1) return; const closed = new Promise(resolve => connection.ws.once('close', resolve)); connection.ws.close(); await closed; },
    get messages() { return connection.messages; },
    async send(action, fields = {}) {
      const requestId = crypto.randomUUID(); connection.ws.send(JSON.stringify({ type: 'social', requestId, action, ...fields }));
      return until(() => connection.messages.find(message => message.type === 'ack' && message.requestId === requestId));
    },
  };
}
async function pulse(page, index) {
  await page.evaluate(index => { window.socialPad.buttons[index] = { pressed: true, value: 1 }; }, index);
  await page.waitForTimeout(70);
  await page.evaluate(index => { window.socialPad.buttons[index] = { pressed: false, value: 0 }; }, index);
  await page.waitForTimeout(95);
}
async function choose(page, key, activate = true) {
  const target = page.locator('dialog[open]').last().locator(`[data-controller-key="${key}"]`); await expect(target).toBeVisible(); await expect(target).toBeEnabled();
  for (let i = 0; i < 100; i++) {
    const route = await target.evaluate(target => {
      const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
      const items = [...dialog.querySelectorAll('summary,button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(element => !element.closest('[hidden],[inert]') && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
      const current = items.indexOf(document.activeElement), goal = items.indexOf(target);
      return { done: document.activeElement === target, next: (goal - current + items.length) % items.length <= items.length / 2 ? 13 : 12 };
    });
    if (route.done) { if (activate) await pulse(page, 0); return; }
    await pulse(page, route.next);
  }
  await expect(target).toBeFocused();
}
async function setup(page, context, callsign, existing = false) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    window.socialPad = { id: 'Social fixture standard controller', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.socialPad] });
  });
  const registered = await context.request.post(`/api/auth/${existing ? 'login' : 'register'}`, { headers: { Origin: origin }, data: { callsign, email: `${callsign}@example.test`, password: existing ? 'isolated social password' : 'isolated browser password' } });
  expect(registered.status()).toBe(existing ? 200 : 201); const account = (await registered.json()).account;
  await page.goto('/?debug'); await expect.poll(() => page.evaluate(() => window.starAgent?.state.ready), { timeout: 90000 }).toBe(true);
  await expect(page.locator('#multiplayer-account-dialog')).toBeVisible();
  await choose(page, 'join-multiplayer');
  await expect.poll(() => page.evaluate(() => window.starAgent.state.multiplayer.connected), { timeout: 30000 }).toBe(true);
  await pulse(page, 1); await expect(page.locator('#multiplayer-account-dialog')).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => window.starAgent.state.controller.armed)).toBe(true);
  return { errors, account };
}
async function openComms(page) {
  await pulse(page, 9); await choose(page, 'tab-comms'); await expect(page.locator('#multiplayer-comms-dialog')).toBeVisible();
}

test('controller enters Comms, composes text, manages real friends, blocks chat and returns with held inputs neutral', async ({ page, context }) => {
  await mkdir(output, { recursive: true }); const stamp = String(Date.now()).slice(-7);
  const other = await otherPilot(`Orion_${stamp}`);
  try {
    const { errors, account } = await setup(page, context, `Nova_${stamp}`);
    await openComms(page); await choose(page, 'comms-chat'); await choose(page, 'chat-compose');
    await expect(page.locator('#multiplayer-chat-keyboard')).toBeVisible();
    // Bumpers and bracket keys must not switch the underlying gameplay screen.
    await pulse(page, 5); await expect(page.locator('#multiplayer-chat-keyboard')).toBeVisible();
    await expect(page.locator('#multiplayer-comms-dialog')).toBeVisible();
    await choose(page, 'chat-key-7'); await choose(page, 'chat-key-8'); await choose(page, 'chat-space'); await choose(page, 'chat-symbols'); await choose(page, 'chat-key-33'); await choose(page, 'chat-key-38');
    await expect(page.locator('.mp-chat-draft')).toHaveText('hi 7!');
    await page.screenshot({ path: `${output}/controller-keyboard.png` });
    await choose(page, 'chat-done'); await choose(page, 'chat-send');
    await expect(page.locator('.mp-chat-log')).toContainText('hi 7!');
    await expect.poll(() => other.messages.filter(message => message.type === 'chat').map(message => message.text)).toContain('hi 7!');
    await choose(page, 'comms-friends'); await choose(page, 'friends-pilots'); await choose(page, `friend-request-${other.account.id}`);
    await expect(page.locator('.mp-social-lists')).toContainText('Awaiting acceptance');
    await other.send('accept', { targetId: account.id }); await expect(page.locator('.mp-social-lists')).toContainText('Online in this server');
    await choose(page, `friend-remove-${other.account.id}`); await expect(page.locator('[data-friends-count]')).toHaveText('0 friends');
    await other.send('request', { targetId: account.id }); await choose(page, 'friends-requests'); await choose(page, `friend-decline-${other.account.id}`);
    await expect(page.locator('.mp-social-lists')).not.toContainText('Wants to be friends');
    await other.send('request', { targetId: account.id }); await choose(page, 'friends-requests'); await choose(page, `friend-accept-${other.account.id}`);
    await expect(page.locator('[data-friends-count]')).toHaveText('1 friends'); await choose(page, 'friends-friends');
    await page.screenshot({ path: `${output}/controller-friends-desktop.png` });
    await choose(page, `friend-block-${other.account.id}`); await expect(page.locator('[data-friends-count]')).toHaveText('0 friends');
    await other.send('chat', { text: 'withheld by block' });
    await choose(page, 'comms-chat'); await expect(page.locator('.mp-chat-log')).not.toContainText('withheld by block');
    await choose(page, 'comms-friends'); await choose(page, 'friends-blocked'); await choose(page, `friend-unblock-${other.account.id}`);
    await choose(page, 'friends-pilots'); await choose(page, `friend-request-${other.account.id}`); await other.send('accept', { targetId: account.id });
    await choose(page, 'friends-friends'); await other.close(); await expect(page.locator('.mp-friend').filter({ hasText: other.account.callsign })).toContainText('Offline');
    await other.connect(); await expect(page.locator('.mp-friend').filter({ hasText: other.account.callsign })).toContainText('Online in this server');
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: `${output}/controller-friends-phone.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const baseline = await page.evaluate(() => ({ position: window.starAgent.state.position, inventory: window.starAgent.state.multiplayer.inventory }));
    await page.evaluate(() => { window.socialPad.axes[1] = -.8; window.socialPad.buttons[7] = { pressed: true, value: 1 }; });
    await pulse(page, 1); await expect(page.locator('#multiplayer-comms-dialog')).not.toBeVisible();
    await page.waitForTimeout(350);
    const displacement = () => page.evaluate(start => Math.hypot(...window.starAgent.state.position.map((v, i) => v - start[i])), baseline.position);
    expect(await displacement()).toBeLessThan(.03);
    await page.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); }); await page.waitForTimeout(250);
    expect(await displacement()).toBeLessThan(.03);
    await page.evaluate(() => { window.socialPad.connected = false; }); await page.waitForTimeout(160);
    await page.evaluate(() => { window.socialPad.connected = true; window.socialPad.id = 'Replacement standard controller'; }); await page.waitForTimeout(250);
    expect(await displacement()).toBeLessThan(.03);
    await page.evaluate(() => { window.socialPad.mapping = ''; }); await page.waitForTimeout(180);
    expect(await displacement()).toBeLessThan(.03);
    await page.evaluate(() => { window.socialPad.mapping = 'standard'; window.socialPad.axes[1] = 0; window.socialPad.buttons[7] = { pressed: false, value: 0 }; });
    await expect.poll(() => page.evaluate(() => window.starAgent.state.controller.armed)).toBe(true);
    expect(await page.evaluate(() => window.starAgent.state.multiplayer.inventory)).toEqual(baseline.inventory);
    await openComms(page); await choose(page, 'comms-friends'); await expect(page.locator('[data-friends-count]')).toHaveText('1 friends');
    await writeFile(`${output}/controller-result.json`, JSON.stringify({ browser: await page.context().browser().version(), viewport: page.viewportSize(), errors, physicalController: false, renderer: await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); }) }, null, 2));
    expect(errors).toEqual([]);
  } finally { await other.close(); }
});

test('keyboard and touch send safe plain text, retain friends after reload and show a private kick reason', async ({ page, context }) => {
  await mkdir(output, { recursive: true }); const stamp = String(Date.now()).slice(-7); const other = await otherPilot(`Vega_${stamp}`);
  try {
    const { errors, account } = await setup(page, context, `Lyra_${stamp}`);
    await page.locator('#multiplayer-access').press('Enter'); await page.locator('[data-controller-key="comms-chat"]').click();
    await page.locator('#mp-chat-text').fill('hell, shit, fuck; Jewish and gay friends welcome'); await page.locator('#mp-chat-text').press('Enter');
    await expect(page.locator('.mp-chat-log')).toContainText('Jewish and gay friends welcome');
    await other.send('chat', { text: '<img src=x onerror="window.chatInjected=true">' });
    await expect(page.locator('.mp-chat-log')).toContainText('<img src=x'); expect(await page.locator('.mp-chat-log img').count()).toBe(0);
    expect(await page.evaluate(() => window.chatInjected)).toBeUndefined();
    await page.screenshot({ path: `${output}/keyboard-chat-desktop.png` });
    await page.locator('[data-controller-key="chat-compose"]').click(); await page.keyboard.press(']');
    await expect(page.locator('#multiplayer-chat-keyboard')).toBeVisible(); await expect(page.locator('#multiplayer-comms-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.down('KeyW'); await page.keyboard.press('Escape'); await page.waitForTimeout(120);
    const start = await page.evaluate(() => window.starAgent.state.position);
    await page.keyboard.down('KeyW'); await page.waitForTimeout(300);
    expect(await page.evaluate(start => Math.hypot(...window.starAgent.state.position.map((v, i) => v - start[i])), start)).toBeLessThan(.03);
    await page.keyboard.up('KeyW');
    await page.locator('#multiplayer-access').click(); await page.locator('[data-controller-key="comms-friends"]').click();
    await other.send('request', { targetId: account.id }); await page.locator('[data-controller-key="friends-requests"]').click(); await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(`[data-controller-key="friend-accept-${other.account.id}"]`).tap(); await expect(page.locator('[data-friends-count]')).toHaveText('1 friends'); await choose(page, 'friends-friends');
    await page.screenshot({ path: `${output}/touch-friends-phone.png` });
    await page.reload(); await expect.poll(() => page.evaluate(() => window.starAgent?.state.ready), { timeout: 90000 }).toBe(true);
    await page.locator('[data-join]').tap(); await expect.poll(() => page.evaluate(() => window.starAgent.state.multiplayer.connected)).toBe(true);
    await page.locator('#multiplayer-account-dialog [data-mp-close]').tap(); await page.locator('#multiplayer-access').tap();
    await page.locator('[data-controller-key="comms-friends"]').tap(); await expect(page.locator('[data-friends-count]')).toHaveText('1 friends');
    await page.locator('[data-controller-key="comms-chat"]').tap(); await page.locator('#mp-chat-text').fill('Hello again'); await page.locator('[data-chat-send]').tap();
    await expect(page.locator('.mp-chat-log')).toContainText('Hello again'); await page.screenshot({ path: `${output}/touch-chat-phone.png` });
    await page.locator('#mp-chat-text').fill('heil hitler'); await page.locator('[data-chat-send]').tap();
    await expect.poll(() => page.evaluate(() => window.starAgent.state.multiplayer.connected)).toBe(false);
    await expect(page.locator('.mp-social-feedback')).toContainText('Removed from this session for severe hateful abuse.');
    expect(other.messages.some(message => message.type === 'chat' && message.text === 'heil hitler')).toBe(false);
    await page.screenshot({ path: `${output}/private-kick-phone.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
  } finally { await other.close(); }
});

test('ten admitted pilots and thirty saved friends stay paged and focused on a phone; long drafts retain Done', async ({ page, context }) => {
  await mkdir(output, { recursive: true }); const others = [];
  try {
    for (let i = 0; i < 9; i++) others.push(await otherPilot(`Roster_${String(i).padStart(2, '0')}`, true));
    const { errors } = await setup(page, context, 'PagePilot', true);
    await openComms(page); await choose(page, 'comms-friends'); await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('[data-friends-count]')).toHaveText('30 friends');
    await expect(page.locator('.mp-friend')).toHaveCount(1); await expect(page.locator('.mp-friend-pages span')).toHaveText('1 / 30');
    await choose(page, 'friends-next'); await expect(page.locator('.mp-friend-pages span')).toHaveText('2 / 30');
    await expect(page.locator('[data-controller-key="friends-next"]')).toBeFocused();
    await choose(page, 'friends-pilots'); await expect(page.locator('.mp-friend-pages span')).toHaveText('1 / 9');
    await expect.poll(() => page.evaluate(() => window.starAgent.state.multiplayer.players.length)).toBe(10);
    await choose(page, 'friends-next'); await expect(page.locator('.mp-friend')).toContainText('Roster_01');
    await choose(page, `friend-remove-${others[1].account.id}`);
    await expect(page.locator(`[data-controller-key="friend-request-${others[1].account.id}"]`)).toBeFocused();
    const fits = () => page.evaluate(() => {
      const box = document.querySelector('#multiplayer-comms-dialog .gameplay-content').getBoundingClientRect();
      return [...document.querySelectorAll('.mp-social button')].filter(button => !button.closest('[hidden]') && button.getClientRects().length).every(button => {
        const rect = button.getBoundingClientRect(); return rect.left >= box.left && rect.right <= box.right && rect.top >= box.top && rect.bottom <= box.bottom;
      });
    });
    expect(await fits()).toBe(true); await page.screenshot({ path: `${output}/ten-pilots-thirty-friends-phone.png` });
    await choose(page, 'comms-chat'); await page.locator('#mp-chat-text').fill('A long draft '.repeat(33).slice(0, 400));
    await choose(page, 'chat-compose');
    expect(await page.locator('.mp-chat-draft').evaluate(output => output.scrollHeight > output.clientHeight)).toBe(true);
    await choose(page, 'chat-done', false);
    expect(await page.locator('[data-controller-key="chat-done"]').evaluate(button => { const r = button.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })).toBe(true);
    await page.screenshot({ path: `${output}/long-draft-keyboard-phone.png` });
    await page.evaluate(() => { window.socialPad.buttons[5] = { pressed: true, value: 1 }; }); await page.waitForTimeout(100); await pulse(page, 1);
    await expect(page.locator('#multiplayer-chat-keyboard')).not.toBeVisible(); await expect(page.locator('#multiplayer-comms-dialog')).toBeVisible();
    await page.waitForTimeout(200); await expect(page.locator('#multiplayer-comms-dialog')).toBeVisible();
    await page.evaluate(() => { window.socialPad.buttons[5] = { pressed: false, value: 0 }; });
    expect(errors).toEqual([]);
  } finally { for (const peer of others) await peer.close(); }
});

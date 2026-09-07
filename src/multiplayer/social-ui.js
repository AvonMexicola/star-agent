if (typeof document !== 'undefined') void import('./social-ui.css');
const MAX_LENGTH = 400;
const keys = [...'abcdefghijklmnopqrstuvwxyz0123456789', '.', ',', '!', '?', "'", '-', '_', '/', '@', ':', '(', ')'];
const pointLength = text => [...text].length;
import { socialView } from './social-state.js';


/** Tabs within Comms. All untrusted content uses textContent; native semantic
 * buttons use the existing shared dialog/controller router. */
export function createSocialUI({ nav, client, dialog, flight }) {
  const tabs = document.createElement('nav'); tabs.className = 'mp-social-tabs'; tabs.setAttribute('aria-label', 'Communications pages');
  const panel = document.createElement('section'); panel.className = 'mp-social'; panel.hidden = true;
  panel.innerHTML = `<section data-social-page="chat">
    <div class="mp-social-heading"><h3>Server chat</h3><span data-chat-link></span></div>
    <p class="mp-social-note">Messages reach the pilots in this server. History lasts for this connection.</p>
    <ol class="mp-chat-log" role="log" aria-label="Server chat messages" aria-live="polite" aria-relevant="additions" tabindex="0" data-controller-key="chat-log" data-controller-scroll></ol>
    <p data-chat-empty class="mp-social-note">No messages in this connection yet.</p>
    <form class="mp-chat-compose"><label for="mp-chat-text">Message <span data-chat-count>0 / 400</span></label><input id="mp-chat-text" name="message" type="text" autocomplete="off" maxlength="1600" placeholder="Say hello to the other pilots" data-controller-key="chat-input">
      <div class="mp-action-row"><button type="button" data-chat-keyboard data-controller-key="chat-compose">Compose with controller</button><button type="submit" data-chat-send data-controller-key="chat-send">Send message</button></div>
    </form>
    <p class="mp-social-note">Swearing is allowed. Severe hateful abuse is withheld and removes the sender from this session. Describe reports without repeating severe slurs.</p>
  </section><section data-social-page="friends" hidden>
    <div class="mp-social-heading"><h3>Friends</h3><span data-friends-count></span></div>
    <p class="mp-social-note">Requests need acceptance. Blocking stops chat and removes friendship.</p>
    <nav class="mp-friend-filters" aria-label="Friend lists"></nav>
    <div class="mp-social-lists"></div>
    <nav class="mp-friend-pages" aria-label="Friend list pages"><button type="button" data-friend-page="previous" data-controller-key="friends-previous">Previous</button><span role="status"></span><button type="button" data-friend-page="next" data-controller-key="friends-next">Next</button></nav>
  </section><p class="mp-social-feedback" role="status" aria-live="polite"></p>`;
  dialog.querySelector('h2').after(tabs);
  flight.after(panel);
  const keyboard = document.createElement('dialog'); keyboard.id = 'multiplayer-chat-keyboard'; keyboard.setAttribute('aria-labelledby', 'mp-chat-keyboard-title');
  keyboard.innerHTML = `<div class="mp-social-heading"><h2 id="mp-chat-keyboard-title">Compose message</h2><button type="button" data-chat-key-action="done" data-controller-key="chat-keyboard-close" aria-label="Return to chat">✕</button></div>
    <output class="mp-chat-draft" aria-label="Message draft" tabindex="0" data-controller-key="chat-draft" data-controller-scroll></output><nav class="mp-key-pages" aria-label="Keyboard pages"><button type="button" data-key-page="letters" data-controller-key="chat-letters" aria-pressed="true">Letters</button><button type="button" data-key-page="symbols" data-controller-key="chat-symbols" aria-pressed="false">Numbers / symbols</button></nav><div class="mp-chat-keys" aria-label="Message characters"></div>
    <div class="mp-action-row"><button type="button" data-chat-key-action="space" data-controller-key="chat-space">Space</button><button type="button" data-chat-key-action="case" data-controller-key="chat-case">Uppercase</button><button type="button" data-chat-key-action="backspace" data-controller-key="chat-backspace">Backspace</button><button type="button" data-chat-key-action="clear" data-controller-key="chat-clear">Clear</button><button type="button" data-chat-key-action="done" data-controller-key="chat-done">Done</button></div>
    <p class="mp-social-note">D-pad / left stick selects · A adds a character · B returns to chat. Choose Send message when your draft is ready.</p>`;
  document.body.append(keyboard);
  let page = 'flight', busy = false, uppercase = false, state = client.state, previousList = '', previousChats = null, lastAccount = state.account?.id;
  let previousInputs = null;
  let friendFilter = 'friends', friendPage = 0, savedFocus = null;
  const input = panel.querySelector('input'), log = panel.querySelector('.mp-chat-log'), feedback = panel.querySelector('.mp-social-feedback');
  const pageButtons = new Map();
  for (const [id, label] of [['flight', 'Flight link'], ['chat', 'Server chat'], ['friends', 'Friends']]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset.controllerKey = `comms-${id}`;
    button.addEventListener('click', () => {
      page = id; flight.hidden = id !== 'flight'; panel.hidden = id === 'flight';
      for (const [key, element] of pageButtons) element.setAttribute('aria-pressed', String(key === id));
      panel.querySelectorAll('[data-social-page]').forEach(section => { section.hidden = section.dataset.socialPage !== id; });
      nav.gamepad?.suspend?.();
    });
    button.setAttribute('aria-pressed', String(id === page)); tabs.append(button); pageButtons.set(id, button);
  }
  const setFeedback = (text, error = false) => { feedback.textContent = text; feedback.classList.toggle('error', error); };
  function updateDraft() {
    panel.querySelector('[data-chat-count]').textContent = `${pointLength(input.value)} / ${MAX_LENGTH}`;
    const draft = keyboard.querySelector('output');
    if (draft.textContent !== (input.value || 'Empty draft')) { draft.textContent = input.value || 'Empty draft'; draft.scrollTop = draft.scrollHeight; }
    panel.querySelector('[data-chat-send]').disabled = busy || !socialView(state).ready || !input.value.trim() || pointLength(input.value) > MAX_LENGTH;
  }
  input.addEventListener('input', updateDraft);
  for (const [index, value] of keys.entries()) {
    const key = document.createElement('button'); key.type = 'button'; key.textContent = value; key.dataset.character = value; key.dataset.controllerKey = `chat-key-${index}`;
    key.dataset.keyGroup = index < 26 ? 'letters' : 'symbols'; key.hidden = index >= 26;
    if (index === 0) key.dataset.controllerFocus = '';
    keyboard.querySelector('.mp-chat-keys').append(key);
  }
  const closeKeyboard = () => {
    if (keyboard.open) keyboard.close();
    nav.gamepad?.suspend?.();
    panel.querySelector('[data-chat-keyboard]').focus({ preventScroll: true });
  };
  keyboard.addEventListener('close', () => { nav.gamepad?.suspend?.(); if (dialog.open) { nav.enabled = false; panel.querySelector('[data-chat-keyboard]').focus({ preventScroll: true }); } });
  panel.querySelector('[data-chat-keyboard]').addEventListener('click', () => {
    if (!socialView(state).ready || busy) return;
    nav.keys?.clear?.(); client.suspendInput?.(); nav.gamepad?.suspend?.(); updateDraft(); keyboard.showModal();
    const draft = keyboard.querySelector('output'); draft.scrollTop = draft.scrollHeight;
  });
  keyboard.addEventListener('click', event => {
    const page = event.target.closest('[data-key-page]')?.dataset.keyPage;
    if (page) {
      keyboard.querySelectorAll('[data-key-group]').forEach(key => { key.hidden = key.dataset.keyGroup !== page; });
      keyboard.querySelectorAll('[data-key-page]').forEach(key => key.setAttribute('aria-pressed', String(key.dataset.keyPage === page)));
      nav.gamepad?.suspend?.(); return;
    }
    const key = event.target.closest('[data-character]');
    if (key && pointLength(input.value) < MAX_LENGTH) input.value += uppercase ? key.dataset.character.toUpperCase() : key.dataset.character;
    const action = event.target.closest('[data-chat-key-action]')?.dataset.chatKeyAction;
    if (action === 'space' && pointLength(input.value) < MAX_LENGTH) input.value += ' ';
    if (action === 'backspace') input.value = [...input.value].slice(0, -1).join('');
    if (action === 'clear') input.value = '';
    if (action === 'case') {
      uppercase = !uppercase;
      keyboard.querySelectorAll('[data-character]').forEach(button => { button.textContent = uppercase ? button.dataset.character.toUpperCase() : button.dataset.character; });
      keyboard.querySelector('[data-chat-key-action="case"]').textContent = uppercase ? 'Lowercase' : 'Uppercase';
    }
    if (action === 'done') closeKeyboard();
    updateDraft();
  });
  async function perform(action, onSuccess) {
    if (busy || !socialView(state).ready) return;
    busy = true; setFeedback('Sending…'); render(state, true);
    try { const result = await action(); onSuccess?.(); setFeedback(result.message || 'Message sent.'); }
    catch (error) { setFeedback(error.message || 'The request could not be completed.', true); }
    finally { busy = false; render(state, true); }
  }
  panel.querySelector('form').addEventListener('submit', event => {
    event.preventDefault(); const draft = input.value;
    if (!draft.trim() || pointLength(draft) > MAX_LENGTH) { setFeedback('Enter a message of up to 400 characters.', true); return; }
    void perform(() => client.sendChat(draft), () => { if (input.value === draft) input.value = ''; });
  });
  panel.addEventListener('click', event => {
    const pager = event.target.closest('[data-friend-page]');
    if (pager && pager.getAttribute('aria-disabled') !== 'true') { friendPage += pager.dataset.friendPage === 'next' ? 1 : -1; renderFriends(socialView(state)); return; }
    const button = event.target.closest('[data-friend-action]');
    if (button) void perform(() => client.friend(button.dataset.friendAction, button.dataset.target));
  });
  const filterButtons = new Map();
  for (const [id, label] of [['friends', 'Friends'], ['requests', 'Requests'], ['pilots', 'Online pilots'], ['blocked', 'Blocked']]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset.controllerKey = `friends-${id}`;
    button.addEventListener('click', () => { friendFilter = id; friendPage = 0; savedFocus = null; renderFriends(socialView(state)); });
    panel.querySelector('.mp-friend-filters').append(button); filterButtons.set(id, { button, label });
  }
  function action(row, label, verb, account, ready) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.setAttribute('aria-label', `${label} · ${account.callsign}`); button.dataset.friendAction = verb; button.dataset.target = account.id;
    button.dataset.controllerKey = `friend-${verb}-${account.id}`; button.disabled = busy || !ready; row.append(button);
  }
  function renderFriends(view) {
    const list = panel.querySelector('.mp-social-lists');
    if (list.contains(document.activeElement)) savedFocus = { key: document.activeElement.dataset.controllerKey, id: document.activeElement.closest('[data-friend]')?.dataset.friend };
    list.replaceChildren();
    const known = new Map(view.relationships.map(account => [account.id, account]));
    const groups = { friends: view.relationships.filter(account => account.status === 'friend'), requests: view.relationships.filter(account => account.status !== 'friend'),
      pilots: view.pilots.map(account => known.get(account.id) ?? { ...account, status: 'pilot' }), blocked: view.blocked.map(account => ({ ...account, status: 'blocked' })) };
    for (const [key, { button, label }] of filterButtons) { button.textContent = `${label} (${groups[key].length})`; button.setAttribute('aria-pressed', String(key === friendFilter)); }
    const entries = groups[friendFilter], size = innerWidth < 750 || innerHeight < 720 ? 1 : 4, count = Math.max(1, Math.ceil(entries.length / size));
    friendPage = Math.max(0, Math.min(count - 1, friendPage));
    const pager = panel.querySelector('.mp-friend-pages'); pager.hidden = !view.ready || count <= 1;
    pager.querySelector('span').textContent = `${friendPage + 1} / ${count}`;
    pager.querySelector('[data-friend-page="previous"]').setAttribute('aria-disabled', String(friendPage === 0));
    pager.querySelector('[data-friend-page="next"]').setAttribute('aria-disabled', String(friendPage === count - 1));
    if (!view.ready || !entries.length) {
      const empty = document.createElement('p'); empty.className = 'mp-social-empty';
      empty.textContent = !view.ready ? state.connected ? 'Loading your friend list…' : 'Join multiplayer to see your friends and the live roster.' : `No ${friendFilter === 'pilots' ? 'other available pilots' : friendFilter} yet.`;
      list.append(empty);
    }
    for (const account of entries.slice(friendPage * size, (friendPage + 1) * size)) {
        const kind = account.status;
        const row = document.createElement('article'); row.className = 'mp-friend'; row.dataset.friend = account.id;
        const info = document.createElement('div'), name = document.createElement('strong'), status = document.createElement('span');
        name.textContent = account.callsign;
        status.textContent = kind === 'friend' ? account.online ? 'Online in this server' : 'Offline' : kind === 'incoming' ? 'Wants to be friends' : kind === 'outgoing' ? 'Awaiting acceptance' : kind === 'blocked' ? 'Chat blocked' : 'Online in this server';
        info.append(name, status); row.append(info); const buttons = document.createElement('div'); buttons.className = 'mp-friend-actions';
        if (kind === 'incoming') { action(buttons, 'Accept', 'accept', account, view.ready); action(buttons, 'Decline', 'decline', account, view.ready); }
        if (kind === 'friend') action(buttons, 'Remove friend', 'remove', account, view.ready);
        if (kind === 'outgoing') action(buttons, 'Cancel request', 'remove', account, view.ready);
        if (kind === 'pilot') action(buttons, 'Add friend', 'request', account, view.ready);
        action(buttons, kind === 'blocked' ? 'Unblock' : 'Block', kind === 'blocked' ? 'unblock' : 'block', account, view.ready);
        row.append(buttons); list.append(row);
    }
    if (savedFocus && !busy) {
      const buttons = [...list.querySelectorAll('button:not(:disabled)')];
      const target = buttons.find(button => button.dataset.controllerKey === savedFocus.key) ?? buttons.find(button => button.dataset.target === savedFocus.id) ?? filterButtons.get(friendFilter).button;
      target.focus({ preventScroll: true }); savedFocus = null;
    }
  }
  function render(next, force = false) {
    state = next;
    // Movement snapshots replace the players array, but social presence only
    // depends on IDs/callsigns. Chat/social objects change on their own events.
    const roster = JSON.stringify((state.players ?? []).map(({ id, callsign }) => [id, callsign]));
    const inputs = [state.connected, state.account?.id, state.ownId, state.social, state.chat, state.moderation, state.error, roster];
    if (!force && previousInputs && inputs.every((value, index) => value === previousInputs[index])) return;
    previousInputs = inputs;
    if (lastAccount !== state.account?.id || !state.connected) { input.value = ''; lastAccount = state.account?.id; if (keyboard.open) closeKeyboard(); }
    const view = socialView(state);
    input.disabled = busy || !view.ready; panel.querySelector('[data-chat-keyboard]').disabled = busy || !view.ready;
    panel.querySelector('[data-chat-link]').textContent = state.connected ? `${state.players?.length ?? 0} pilots connected` : 'Offline';
    panel.querySelector('[data-friends-count]').textContent = `${view.relationships.filter(account => account.status === 'friend').length} friends`;
    const signature = JSON.stringify(view);
    if (signature !== previousList || force) { previousList = signature; renderFriends(view); }
    if (previousChats !== state.chat) {
      previousChats = state.chat; const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
      const chats = state.connected ? state.chat ?? [] : [], ids = new Set(chats.map(chat => chat.id));
      for (const node of [...log.children]) if (!ids.has(node.dataset.message)) node.remove();
      const existing = new Set([...log.children].map(node => node.dataset.message));
      for (const chat of chats) {
        if (existing.has(chat.id)) continue;
        const row = document.createElement('li'); row.dataset.message = chat.id;
        const name = document.createElement('strong'), text = document.createElement('span'), time = document.createElement('time');
        name.textContent = chat.sender.callsign; text.textContent = chat.text;
        const date = new Date(chat.sentAt); time.textContent = Number.isNaN(date.valueOf()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        row.append(name, time, text); log.append(row);
      }
      panel.querySelector('[data-chat-empty]').hidden = chats.length > 0;
      if (nearBottom) log.scrollTop = log.scrollHeight;
    }
    if (!state.connected && state.moderation) setFeedback(state.moderation, true);
    else if (!state.connected && state.error) setFeedback(state.error, true);
    updateDraft();
  }
  const onClose = () => { if (keyboard.open) closeKeyboard(); nav.gamepad?.suspend?.(); };
  const onResize = () => renderFriends(socialView(state));
  window.addEventListener('resize', onResize);
  dialog.addEventListener('close', onClose);
  const unsubscribe = client.subscribe(render);
  return { dispose() { unsubscribe(); window.removeEventListener('resize', onResize); dialog.removeEventListener('close', onClose); keyboard.remove(); panel.remove(); tabs.remove(); } };
}

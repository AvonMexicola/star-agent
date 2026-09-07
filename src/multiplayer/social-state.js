const sortName = (a, b) => String(a.callsign).localeCompare(String(b.callsign));

export function socialView(state = {}) {
  const data = state.connected ? state.social : null;
  const blocked = new Set((data?.blocked ?? []).map(account => account.id));
  const live = new Map((state.connected ? state.players ?? [] : []).map(player => [player.id, player]));
  return {
    ready: Boolean(state.connected && data),
    relationships: (data?.relationships ?? []).filter(account => !blocked.has(account.id)).map(account => ({ ...account, online: live.has(account.id) })).sort(sortName),
    blocked: [...data?.blocked ?? []].sort(sortName),
    pilots: [...live.values()].filter(player => player.id !== state.ownId && !blocked.has(player.id)).map(({ id, callsign }) => ({ id, callsign })).sort(sortName),
  };
}


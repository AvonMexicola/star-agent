/** Accepts only room-resolved impacts. No wire target, damage, friend flag or
 * position is consumed here. The social store remains the relationship owner. */
import {protectionAt,securityStations,selectDefensePose} from '../src/station-security-policy.js';
import {shipPose} from './combat.js';

const alive = player => player && player.health > 0 && player.shipHealth > 0;
const pointOf = (player,kind) => kind === 'ship' ? shipPose(player)?.position ?? player.nav.position : player.nav.position;

export function createStationSecurity({world,areFriends = async () => false,onStrike = () => {},onError = () => {}}) {
  const stations = securityStations(world), tasks = new Map(), seen = new WeakMap();
  let sequence = 0;

  async function resolve(attack) {
    const {attacker,victim,kind,cause,damage,point,id,vehicle} = attack;
    if (!attacker || !victim || attacker === victim || !['player','ship','vehicle'].includes(kind) ||
        !['shot','ram'].includes(cause) || !Number.isFinite(damage) || damage <= 0 ||
        !point?.isVector3 || !point.toArray().every(Number.isFinite) || !alive(attacker) || !alive(victim)) return {accepted:false,damage:0};
    if(kind==='vehicle'&&(!vehicle||!Number.isFinite(vehicle.health)||vehicle.health<=0||vehicle.ownerId!==victim.id&&!Object.values(vehicle.seats??{}).some(s=>s.id===victim.id)))return {accepted:false,damage:0};
    const attackerLife = attacker.nav, victimLife = victim.nav;
    let incidents = seen.get(attacker);
    if (!incidents || incidents.life !== attackerLife) { incidents = {life:attackerLife,ids:new Set()}; seen.set(attacker,incidents); }
    if (typeof id !== 'string' || incidents.ids.has(id)) return {accepted:false,damage:0};
    incidents.ids.add(id);
    // Room IDs are monotonic; retain a bounded recent set, never a durable ledger.
    if (incidents.ids.size > 256) incidents.ids.delete(incidents.ids.values().next().value);
    const station = protectionAt(stations,point);
    let friend = false;
    if (station) {
      try {
        friend = await areFriends(attacker.account.id,victim.account.id);
        if (typeof friend !== 'boolean') throw new Error('Friend authority did not return a boolean.');
      } catch (error) {
        onError(error);
        // Neither damage nor retaliation is guessed when relationships cannot
        // be read. The accepted shot still spends its ordinary charge/cooldown.
        return {accepted:false,damage:0,reason:'friendship-unavailable'};
      }
    } else await Promise.resolve(); // admit simultaneous contacts before applying either hit
    // A delayed query cannot hit a respawn or a different victim life. Ordinary
    // movement is permitted: the original validated impact point owns the zone.
    if (attacker.nav !== attackerLife || victim.nav !== victimLife) return {accepted:false,damage:0};
    const key = kind === 'ship' ? 'shipHealth' : 'health',target=kind==='vehicle'?vehicle:victim;
    const applied = Math.min(Math.max(0,target[key]),damage);
    target[key] = Math.max(0,target[key] - applied);
    let strike = null;
    if (station && !friend && alive(attacker)) {
      const target = pointOf(attacker,attacker.nav.mode === 'flight' || attacker.nav.cabinFlight ? 'ship' : 'player').clone();
      const pose = selectDefensePose(station,target,sequence % 2);
      attacker.health = 0; attacker.shipHealth = 0;
      attacker.weapon = null;
      attacker.nav.velocity?.set(0,0,0); attacker.nav.shipVelocity?.set(0,0,0);
      attacker.nav.angularVelocity?.set(0,0,0); attacker.nav.shipAngularVelocity?.set(0,0,0);
      attacker.nav.travel = null; attacker.nav.cabinFlight = false; attacker.nav.mode = 'crashed';
      if (pose) strike = {type:'event',event:'stationStrike',id:`${station.id}:${++sequence}`,stationId:station.id,
        attackerId:attacker.id,victimId:victim.id,cause,mountId:pose.mountId,barrel:pose.barrel,
        yaw:pose.yaw,pitch:pose.pitch,origin:pose.origin.toArray(),direction:pose.direction.toArray(),target:pose.target.toArray()};
      await onStrike(attacker,victim,strike);
    }
    return {accepted:true,damage:applied,protected:Boolean(station),friend,strike};
  }

  return {
    stations,
    protectedAt:point => protectionAt(stations,point),
    pending:player => (tasks.get(player)?.size ?? 0) > 0,
    submit(attack,onResolved = () => {}) {
      // Both accounts participate in this pending mutation. A victim's leave,
      // reconnect or respawn must wait just as the attacker's does, otherwise a
      // late callback could persist the old object over a newly joined account.
      const participants = [...new Set([attack.attacker,attack.victim].filter(Boolean))];
      const task = resolve(attack).then(result => { onResolved(result); return result; }).catch(error => { onError(error); return {accepted:false,damage:0}; });
      for (const player of participants) {
        let pending = tasks.get(player);
        if (!pending) { pending = new Set(); tasks.set(player,pending); }
        pending.add(task);
        task.finally(() => { pending.delete(task); if (!pending.size) tasks.delete(player); });
      }
      return task;
    },
    async settle(player) { await Promise.all([...(tasks.get(player) ?? [])]); },
    async close() { await Promise.all([...tasks.values()].flatMap(pending => [...pending])); },
  };
}

export const FAUNA_SPECIES = Object.freeze({
  pyrebear: Object.freeze({ name: 'Pyrebear', maxHealth: 240, damage: 14, speed: 3.3,
    aggroRange: 24, biteRange: 2.7, mouthHeight: 1.2, maxBiteHeight: 2.8, windup: .6, cooldown: 1.8, leash: 100 }),
  suloher: Object.freeze({ name: 'Suloher dog', maxHealth: 90, damage: 8, speed: 4,
    aggroRange: 34, biteRange: 1.6, mouthHeight: .65, maxBiteHeight: 2.3, windup: .6, cooldown: 1.8, leash: 100 }),
  'aeon-amphibian': Object.freeze({ name: 'Tideback', maxHealth: 120, damage: 6, speed: 1.8,
    aggression: 'provoked', patrolSpeed: .45, aggroRange: 24, biteRange: 1.4,
    mouthHeight: .35, maxBiteHeight: 2.3, windup: .8, cooldown: 2, leash: 100 }),
  'aeon-grazer': Object.freeze({ name: 'Mallow grazer', maxHealth: 360, damage: 0, speed: 2,
    aggression: 'never', patrolSpeed: .55, aggroRange: 0, biteRange: 0,
    mouthHeight: 1, maxBiteHeight: 0, windup: 1, cooldown: 2, leash: 100 }),
});
export const FAUNA_WEAPON_DAMAGE = Object.freeze({ rifle: 30, pistol: 18 });
const MAX_ENTITIES = 8, MAX_DT = .25, MAX_STEP = .05, TAU = Math.PI * 2;
const copyPosition = p => Array.isArray(p) ? [...p] : [p?.x, p?.y, p?.z];
const finite = p => p?.length === 3 && p.every(Number.isFinite);
const add = (a, b, scale = 1) => a.map((v, i) => v + b[i] * scale);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const unit = a => { const n = Math.hypot(...a); return n > 1e-10 ? a.map(v => v/n) : null; };
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const distance = (a, b) => Math.hypot(...sub(a, b));
const tangent = (v, up) => add(v, up, -dot(v, up));
function basis(up) {
  const x = unit(cross(Math.abs(up[1]) > .9 ? [1, 0, 0] : [0, 1, 0], up));
  return { x, z: cross(x, up) };
}
function face(entity, direction) {
  const forward = unit(tangent(direction, entity.normal));
  if (!forward) return;
  const { x, z } = basis(entity.normal);
  entity.forward = forward;
  entity.heading = Math.atan2(-dot(forward, x), -dot(forward, z));
}

/** Session-local authority only. Arrays are metre/double world coordinates.
 * sampleGround(species,proposed) must return the canonical grounded position and
 * unit normal, or null for an unsafe biome/slope. canMove tests the whole swept
 * segment against structures/ships; this module does not invent collision.
 * forward is world tangent direction for asset local -Z, up is normal. Heading
 * uses X=cross(reference,up), Z=cross(X,up), with local-Y rotation of -Z.
 * update player.position is the standing player's eye (~1.75m above ground),
 * not feet. Bite horizontal range and vertical separation are checked separately.
 * update(0,...) freezes every clock/state. active=false suppresses movement and
 * cancels windups (cabins/stations/online); menus should pass dt=0 to pause.
 */
export function createHostileSimulation({ sampleGround, canMove = () => true,
  lineOfSight = () => true, onBite = () => {}, onAttack = () => {} } = {}) {
  if (typeof sampleGround !== 'function') throw new TypeError('Canonical fauna ground callback required');
  const live = new Map(), defeated = new Set(), wounds = new Map();
  let steps = 0, totalBites = 0, totalHits = 0, droppedTime = 0, paused = true;

  function reconcile(spawns, species, playerPosition) {
    const config = FAUNA_SPECIES[species], player = copyPosition(playerPosition);
    if (!finite(player)) return;
    for (const [id, entity] of live) {
      if (distance(entity.position, player) > 600) {
        if (entity.health > 0 && entity.health < FAUNA_SPECIES[entity.species].maxHealth) {
          wounds.set(id, { health: entity.health, provoked: entity.provoked });
        }
        live.delete(id);
      }
    }
    // A null species is the integration's leave-planet path: still unload far
    // actors, but do not create wildlife on an unsupported body.
    if (!config) return;
    // Habitat adapters return <=6. Bound malformed/external candidate lists too.
    for (const spawn of (Array.isArray(spawns) ? spawns.slice(0, 64) : [])) {
      if (live.size >= MAX_ENTITIES) break;
      if (typeof spawn?.id !== 'string' || !spawn.id || live.has(spawn.id) || defeated.has(spawn.id)) continue;
      if (!finite(spawn.position) || !finite(spawn.normal)) continue;
      const normal = unit(spawn.normal), range = distance(spawn.position, player);
      if (!normal || range < 30 || range > 500) continue;
      const heading = Number.isFinite(spawn.heading) ? spawn.heading : 0;
      const phase = Number.isFinite(spawn.phase) ? ((spawn.phase % 1) + 1) % 1 : 0;
      const { x, z } = basis(normal);
      const entity = { id: spawn.id, species, position: [...spawn.position], normal,
        home: [...spawn.position], homeNormal: [...normal], heading, phase,
        forward: add(z.map(v => -v * Math.cos(heading)), x, -Math.sin(heading)),
        state: 'patrol', health: wounds.get(spawn.id)?.health ?? config.maxHealth,
        provoked: wounds.get(spawn.id)?.provoked ?? false,
        deathTime: 0, speed: 0, timer: 0, cooldown: 0, patrolAngle: phase * TAU, lostSight: 0 };
      live.set(entity.id, entity);
    }
  }
  const sees = (entity, player, config) => lineOfSight(add(entity.position, entity.normal, config.mouthHeight), player);
  function biteReach(entity, player, config) {
    const delta = sub(player, entity.position), vertical = dot(delta, entity.normal);
    // Player position is eye-height; horizontal reach and vertical clearance are
    // independent so a 1.6m dog can reach a standing player but not a roof above.
    return vertical >= -.75 && vertical <= config.maxBiteHeight
      && Math.hypot(...tangent(delta, entity.normal)) <= config.biteRange;
  }
  function move(entity, target, speed, dt) {
    const delta = tangent(sub(target, entity.position), entity.normal), remaining = Math.hypot(...delta);
    if (remaining < .15) return true;
    const forward = unit(delta), step = Math.min(speed * dt, remaining);
    face(entity, forward);
    const proposed = add(entity.position, forward, step), ground = sampleGround(entity.species, proposed);
    if (!ground || !finite(ground.position) || !finite(ground.normal)) return false;
    const normal = unit(ground.normal);
    // A discontinuous or erroneous callback must not teleport an entity. The
    // canonical 18deg habitat permits <=1.06x travel; 1.5 allows numeric margin.
    if (!normal || distance(ground.position, entity.position) > step * 1.5 + .005
      || !canMove(entity.position, ground.position, entity)) return false;
    entity.speed = distance(ground.position, entity.position) / dt;
    entity.position = [...ground.position]; entity.normal = normal;
    face(entity, forward);
    return remaining <= step + .15;
  }
  function startReturn(entity) { entity.state = 'return'; entity.timer = 0; entity.lostSight = 0; }

  function update(dt, player = {}) {
    if (!Number.isFinite(dt) || dt <= 0) { paused = true; return; }
    const p = copyPosition(player.position);
    if (!finite(p)) { paused = true; return; }
    const duration = Math.min(dt, MAX_DT);
    droppedTime += Math.max(0, dt - duration);
    const count = Math.ceil(duration / MAX_STEP), step = duration / count;
    let health = Number.isFinite(player.health) ? player.health : 0;
    const active = player.active === true && health > 0;
    paused = !active;
    for (let i = 0; i < count; i++) {
      steps++;
      for (const entity of live.values()) {
        entity.speed = 0;
        if (entity.state === 'dead') { entity.deathTime += step; continue; }
        if (!active || health <= 0) {
          if (entity.state === 'windup') startReturn(entity);
          continue;
        }
        const config = FAUNA_SPECIES[entity.species];
        entity.cooldown = Math.max(0, entity.cooldown - step);
        const playerDistance = distance(entity.position, p), homeDistance = distance(entity.home, p);
        const aggressive = config.aggression !== 'never' && (config.aggression !== 'provoked' || entity.provoked);
        if (entity.state === 'patrol' && aggressive && playerDistance <= config.aggroRange && homeDistance <= config.leash && sees(entity, p, config)) entity.state = 'chase';
        if (entity.state === 'flee') {
          entity.timer -= step;
          if (entity.timer <= 0 || distance(entity.position, entity.home) > config.leash * .75) { startReturn(entity); continue; }
          const away = unit(tangent(sub(entity.position, p), entity.normal)) ?? entity.forward;
          move(entity, add(entity.position, away, 8), config.speed, step);
        } else if (entity.state === 'chase') {
          if (homeDistance > config.leash || playerDistance > config.aggroRange * 2) { startReturn(entity); continue; }
          const visible = sees(entity, p, config);
          entity.lostSight = visible ? 0 : entity.lostSight + step;
          if (entity.lostSight > 2) { startReturn(entity); continue; }
          face(entity, sub(p, entity.position));
          if (visible && biteReach(entity, p, config) && entity.cooldown === 0) {
            entity.state = 'windup'; entity.timer = config.windup;
            onAttack({type:'creature-attack',species:entity.species,position:[...entity.position],id:entity.id});
          } else move(entity, p, config.speed, step);
        } else if (entity.state === 'windup') {
          face(entity, sub(p, entity.position));
          entity.timer -= step;
          if (entity.timer <= 1e-9) {
            // Recheck at impact, never rely on the windup's earlier conditions.
            entity.state = 'recovery'; entity.timer = config.cooldown; entity.cooldown = config.cooldown;
            if (homeDistance <= config.leash && biteReach(entity, p, config) && sees(entity, p, config)) {
              const outcome = onBite(config.damage, { creatureName: config.name });
              if (outcome !== false && outcome?.ok !== false) { totalBites++; health = Math.max(0, health - config.damage); }
            }
          }
        } else if (entity.state === 'recovery') {
          entity.timer -= step;
          if (entity.timer <= 1e-9) { entity.state = homeDistance > config.leash ? 'return' : 'chase'; entity.timer = 0; }
        } else if (entity.state === 'return') {
          if (move(entity, entity.home, config.speed * .7, step)) entity.state = 'patrol';
        } else if (entity.state === 'patrol') {
          const { x, z } = basis(entity.homeNormal), radius = 8 + entity.phase * 6;
          const target = add(add(entity.home, x, Math.sin(entity.patrolAngle) * radius), z, Math.cos(entity.patrolAngle) * radius);
          if (move(entity, target, config.patrolSpeed ?? config.speed * .35, step) || entity.speed === 0) entity.patrolAngle += 2.399963229728653;
        }
      }
    }
  }
  function hit(id, damage) {
    const entity = live.get(id);
    if (!entity || entity.health <= 0 || !Number.isFinite(damage) || damage <= 0) return { ok: false };
    const applied = Math.min(damage, entity.health);
    entity.health -= applied; totalHits++;
    // Only a validated player hit provokes defensive wildlife. Keep this with
    // session wounds so streaming an injured actor out cannot make it peaceful.
    const peaceful = FAUNA_SPECIES[entity.species].aggression === 'never';
    entity.provoked = !peaceful;
    wounds.set(id, { health: entity.health, provoked: entity.provoked });
    if (entity.health === 0) {
      defeated.add(id); entity.state = 'dead'; entity.deathTime = 0; entity.speed = 0; entity.timer = 0;
    } else { entity.state = peaceful ? 'flee' : 'chase'; entity.timer = peaceful ? 4 : 0; entity.lostSight = 0; }
    return { ok: true, killed: entity.health === 0, damage: applied, health: entity.health };
  }
  return { reconcile, update, hit, get entities() { return [...live.values()]; },
    get state() { return { count: live.size, alive: [...live.values()].filter(e => e.health > 0).length,
      dead: [...live.values()].filter(e => e.health === 0).length, defeated: defeated.size,
      totalBites, totalHits, steps, droppedTime, paused, maxEntities: MAX_ENTITIES }; } };
}

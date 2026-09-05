# Star Agent — Roadmap

*Maintained by Claude (project manager). Astra (Codex) leads core simulation and netcode. Opus/Fable agents take
scoped modules. Last updated 2026-09-05. Status legend: ✅ done · 🔧 in progress · ⏳ planned.*

Star Agent is a browser-native, seamless space-to-surface sandbox: fly from orbit, land, walk, build, mine, trade
and fight, on a ¼-Earth procedural planet and its neighbours, with no loading screens. Everything is procedural
(a seed grows the world) except a handful of hero assets (station, base props) built in Blender or Meshy.

---

## Phase 0 — Foundation (now)

| Item | Owner | Status |
|---|---|---|
| Camera-relative 64-bit navigation, LOD terrain streaming in workers | Astra | ✅ |
| Atmosphere (single scattering) + volumetric clouds + stars/sun | Astra | ✅ |
| Terrain v2: ridged mountains, cliffs, beaches, metre relief | Claude | ✅ adopted |
| Per-pixel terrain material, ocean shader, real trees, cascaded shadows | Claude | ✅ ready, ⏳ wiring by Astra |
| Orbital station (Blender) with animated hangar + `station.js` | Claude | ✅ ready, ⏳ hangar landing (Astra) |
| Physical boarding loop (hatch, ramp, cabin, pilot seat) | Astra | ✅ |
| Tests: unit (30) + Playwright smoke on system Chromium | Claude | ✅ |
| Public repo, README, AGENTS.md, CONTRIBUTING | Astra | 🔧 |

Exit criteria: all ready modules wired, first commit + push on `main`, CI running `npm test` and the smoke test.

---

## Phase 1 — Flight physics & the edge of space

**Goal:** the ship *feels* the atmosphere; two flight regimes with a defined boundary; landing gear that absorbs shock.

**Where space starts.** Atmosphere shell is `ATMOSPHERE_HEIGHT = 70 km` (Kármán line at ¼ scale ≈ 25 km, but 70 km
matches the scattering shell already rendered). Define:

| Altitude | Regime | Behaviour |
|---|---|---|
| > 70 km | **Space (6-DOF)** | Newtonian: RCS translation on all axes, torque control, flight-assist damping toggle, no drag, velocity capped only by travel mode. |
| 20–70 km | **Transition** | Aero forces scale with density `ρ(h) = ρ0·exp(−h/8000)`; control authority blends from RCS to control surfaces by dynamic pressure `q = ½ρv²`. HUD shows "ATMO 43 %". Re-entry heating glow when `q·v` exceeds a threshold. |
| < 20 km | **Plane flight** | Lift/drag from angle of attack and airspeed, stall below `v_stall`, banked turns, gravity 9.81·(¼ mass planet ≈ 2.45 m/s² — decide: keep 1 g for game feel, expose as constant). Thrust-limited top speed. |

**Work items**
1. `src/flight-model.js` — pure function `step(state, controls, env, dt)`; env = `{ density, gravity, groundRadius }`. Unit-tested (stall, terminal velocity, RCS in vacuum). *Astra.*
2. Regime blend + HUD regime indicator; speed limits per regime and per travel/combat mode (Phase 4). *Astra.*
3. `src/landing-gear.js` — per-strut spring-damper (`k`, `c`, travel 0.6 m), one raycast per strut against `terrainHeight`/`station.deckHeightAt`, touchdown g-force → damage event; gear animation from `ship-mk2.js`. *Fable agent.*
4. Re-entry heating/plasma shader on the hull (emissive, uses `q`). *Opus agent.*
5. Audio: wind loudness from `q`, RCS puffs in vacuum. *Astra's audio subagent.*

Exit criteria: fly from orbit to landing with continuous behaviour change; hard landing bounces on struts; 6-DOF strafe works in space and not on the deck.

---

## Phase 2 — Cockpit: MFDs, radar sphere, power management

**Goal:** four standardized rectangular MFDs in the corners of the player's view, a radar sphere between the lower
two, all data-driven and cheap.

**Standard MFD spec** (`src/mfd/`):
- Canvas 512×384 (4:3), rendered to a `CanvasTexture` on a cockpit quad **or** a DOM overlay in photo-mode-off; same page code either way.
- Pages: `CONTACTS` (contact list with range/closing speed/IFF), `POWER` (classic three-way pips: weapons / thrusters / shields, afterburner reserve), `SHIP` (damage per component, fuel, gear, mode), `NAV` (destination, ETA, regime, station/hangar guidance), `COMMS/CARGO` (Phase 6-7).
- Bezel buttons: 5 per side, keyboard `1-4` selects MFD, `[ ]` pages.
- **Efficiency contract:** each page is a pure `draw(ctx, shipState)`; MFDs update at 12 Hz staggered (one MFD per frame), only when its dirty hash changes; `ShipState` is a single typed-array bus updated by the sim, never DOM reads in the loop. Budget: < 1 ms/frame total on a laptop.
- Radar sphere: instanced points + rings, up to 256 contacts, colour by IFF, up/down stalks for elevation; 3D sphere between the lower MFDs, updated at 20 Hz.

**Work items**
1. `ShipState` bus + `mfd/host.js` (page routing, dirty tracking, staggering). *Astra ("hook-up").*
2. Page renderers `mfd/pages/*.js` with a shared design system (mint brand, mono type, 2-px grids). *Opus agent (frontend).*
3. Radar sphere `mfd/radar.js`. *Opus agent.*
4. Cockpit geometry with 4 screen quads + sphere mount in `ship-walkable.js` cabin. *Astra.*
5. Perf gate in the smoke test: MFD update cost measured via `performance.measure`. *Claude.*

Exit criteria: all four MFDs live with real data at < 1 ms/frame; radar shows station, moons, contacts.

---

## Phase 3 — Celestial expansion

**Goal:** a second (hot) planet, a moon, an asteroid ring visible from the surface, and travel modes to reach them.

**Bodies** (all procedural, sharing `world.js` primitives via a `Body` abstraction: radius, seed, palette, atmosphere, rotation):
- **Aeon** (current): R = 1 592.75 km at 25 M km from the star.
- **Moon "Sel"**: R ≈ 434 km (¼ Luna), orbit 75 000 km, no atmosphere, grey regolith palette, craters (crater noise term), 1/6 g. Visible as a disc from Aeon's surface (angular size ≈ 0.66°, slightly larger than our Moon).
- **Asteroid ring** around Aeon at 2.4–2.9 R (≈ 3 800–4 600 km): a ring shader for distance (band visible from the surface like Saturn's rings, casting a faint shadow line) + instanced rocks (5–200 m) within 50 km of the player; fly through it; mineable in Phase 6.
- **Hot planet "Pyre"**: R ≈ 1 200 km at 10 M km from the star, thin CO₂ atmosphere, lava-cracked basalt palette, day side 400 °C (HUD warning, hull temp), no water/vegetation. From Aeon it is a bright morning/evening "star".

**Travel modes** (speed limits enforce the regimes):
- Combat ≤ 250 m/s (afterburner 400 m/s) — Phase 4.
- Travel ≤ 3 km/s inside a body's gravity well.
- **Jump** (quantum-style) between bodies: align, spool 4 s, fly at 0.05 c in a straight line with a tunnel effect; 75 000 km moon ≈ 5 s, 15 M km to Pyre ≈ 17 min → allow 0.2 c for interplanetary (≈ 4 min) or an "interplanetary lane" with 0.5 c. Sun shadow/eclipse visuals as you pass.
- Time/orbits: bodies move on Keplerian ellipses at 1× real time; positions are doubles; rebasing already handles origin.

**Work items**: `Body` refactor of planet/atmosphere/vegetation (*Astra*), moon palette + craters (*Fable agent*), ring shader + instanced belt (*Fable agent*), Pyre palette + heat mechanic (*Opus agent*), jump travel + tunnel FX + nav MFD page (*Astra + Opus*), sky: moon/planets as lit discs from the surface (*Claude*).

Exit criteria: stand on Aeon's beach at dusk and see the ring arc, the moon rising and Pyre as a bright point; jump to the moon and land in a crater.

---

## Phase 4 — Combat

**Goal:** Wing Commander-style dogfighting at ≤ 4 km, travel vs combat mode, shields.

- **Modes**: Travel (fast, weapons safe, shields low) ↔ Combat (≤ 250 m/s, afterburner to 400 m/s with heat/fuel budget, weapons hot, gimbal assist). Mode switch takes 1.5 s; MFD POWER page pips redistribute.
- **Weapons on mounts**: hardpoint sockets on the ship (wing tips, nose, belly); types: laser repeater (hitscan-ish with travel time, energy), ballistic cannon (projectile, ammo), missiles (lock-on, countermeasures). 4 km hard max range; lead indicator computed from target velocity; projectile sim in a fixed 60 Hz sub-step.
- **Shields**: 4 quadrants (F/R/L/R) with pools, recharge after 3 s no-hit, power pips scale recharge; hull HP per component (engines, wings, gear → gameplay effects); visual: shield-impact ripple shader, sparks, smoke trail on damaged engines.
- **AI**: 3 behaviours (pursue with lead, strafe-and-extend, evade); difficulty by turn rate and accuracy; spawn "patrol" encounters near the station and the ring. Server-authoritative once Phase 5 exists; single-player first.
- **Assets**: turrets/mounts/missiles from Meshy (see Assets), muzzle/impact VFX procedural.

**Work items**: `src/combat/` (weapons, projectiles, shields, damage) *Astra*; targeting HUD + lock, lead indicator, shield ripple *Opus agent*; AI *Fable agent*; damage model wired to flight model (Phase 1) *Astra*; balance tests (TTK tables) *Claude*.

Exit criteria: a 3-v-1 dogfight near the station at 60 fps; shields matter; travel→combat transition is legible.

---

## Phase 5 — Multiplayer

**Goal:** shared solar system, dozens of ships in view, persistent bases (Phase 6).

**Architecture**
- Client stays static (Vite build) on a CDN — the world is procedural, so the server ships **no terrain**, only entities.
- **Authoritative server** in TypeScript (Node 22/Bun) or Rust: fixed 30 Hz sim tick, WebSocket (fallback) + WebTransport (preferred) transport, binary packets (Flatbuffers/own schema), client prediction + reconciliation, interest management by **spatial cells per body** (players only receive entities within ~50 km, plus low-rate "beacon" updates for everything in the system).
- **Sharding**: one process per body (Aeon, Sel, Pyre, the ring, deep space) → all fit on one machine early; split machines later with a gateway that hands players between shards on jump.
- Persistence: Postgres (accounts, inventories, bases, economy), Redis pub/sub between shards. Auth: magic-link email or GitHub OAuth; no passwords stored.
- Anti-cheat baseline: server owns damage, resources and economy; the client owns only its own flight input.

**Server sizing** (single region, EU; bandwidth dominates before CPU)

| Tier | Concurrent players | Machine | Est. cost | Notes |
|---|---|---|---|---|
| 0 — site only | unlimited | Cloudflare Pages / Netlify (static) | €0 | Client + assets (~6 MB, cached at edge). |
| 1 — MVP | ≤ 200 CCU | 1× Hetzner CPX41 / CCX23 (4-8 vCPU, 16 GB, 20 TB traffic) | €25-45 / mo | All shards on one box; Postgres + Redis local. 200 players × 25 KB/s down ≈ 5 MB/s ≈ 40 Mbit/s. |
| 2 — growth | ≤ 2 000 CCU | 3× CCX33 (8 vCPU, 32 GB) + 1 small gateway + managed Postgres | €200-300 / mo | Shards by body; ~400 Mbit/s peak; add regions (US) as a second cluster. |
| 3 — blow-up | 10 000+ CCU | Autoscaled shard fleet (k8s or Nomad), Redis cluster, CDN for everything static | €1.5-3 k / mo | Per-player cost ≈ €0.1-0.3 / month at scale; instance shards further by cells. |

Rules of thumb: budget **~25 KB/s down + 5 KB/s up per player** at 20 Hz with 50 entities in interest; **~0.3 ms CPU per player-tick** at 30 Hz in JS → ~250 players per core-ish; RAM is negligible (entities only). Bandwidth is what you pay for: Hetzner's 20 TB/month per server covers ~2.6 MB/s sustained, so Tier 1 is fine to ~200 CCU average. Add a **Cloudflare tunnel/DDoS front** before any public announcement.

**Ads / funding (modest):** the client is a static site, so ordinary web ads work on the **landing view and loading screen only, never in the HUD**: one 300×250 or a native "sponsor" card under the mission panel, EthicalAds or Carbon Ads (developer-friendly, no consent banners), or AdSense (needs a consent banner in the EU). Add a privacy policy page and an "ad-free supporter" tier (Ko-fi/GitHub Sponsors) — that will likely out-earn banners for this audience.

**Work items**: protocol + schema, server skeleton with one shard and interest management (*Astra*), client netcode (prediction, interpolation, remote ships) (*Astra*), accounts/persistence (*Opus agent*), load test with 500 bot clients (*Claude*), deploy scripts + Cloudflare (*Claude*).

Exit criteria: 50 players formation-flying around the station at 20 Hz with < 150 ms perceived latency in EU.

---

## Phase 6 — Bases, resources, mining, caves

**Goal:** Rust/Dune-style modular building; harvest → refine → craft; caves with rare items.

- **Building**: socket-snapped pieces (foundation 4 m, wall, doorway, window, roof, ramp, pillar, gate; tiers wood → stone → metal), placed against `terrainHeight` with a levelling foundation; 1 000-piece bases; server-validated placement; ownership + **access code**.
- **Interference shield**: base core projects a sphere (radius by tier, 150–600 m); ships without the code get a "NO ENTRY" MFD warning at 2 R and are pushed out/engines cut inside R; players on foot can still walk in (raids), so walls matter. Visual: faint hex-bubble shader at the boundary.
- **Resources**: wood (trees — chopping removes the instance via the existing exclusion system and regrows), stone (rocks/cliffs), metal ore (veins in cliffs and caves, ring asteroids), crystals (caves only). Tools: hatchet, pick, **mining laser** (beam + heat, works on ore and asteroids).
- **Processing chain**: campfire → forge (ore → ingots) → refinery (fuel from ice/regolith) → fabricator (parts, weapons, base pieces). Inventory with mass; ship cargo hold; storage crates.
- **Caves**: carve the terrain with a 3D worm/noise field (`caveField(x,y,z)`), voxelized near the player and meshed with **marching cubes in a worker** (chunks 32³ at 1 m), entrances where the field intersects steep terrain; interior lit by crystal emissives + headlamp; rare items spawn deep. Height-field terrain stays as is; cave chunks replace it locally with a stencil/discard on the surface mesh.
- **Assets (Meshy, 25 k credits)**: an Opus agent drives Meshy via Chrome (you stay logged in; the agent never enters credentials) to generate textured hero props: forge, refinery, fabricator, storage crate, base gate, turret bases, mining laser, shop kiosk, asteroid set, crystal set. Keep each under 10 k tris; retopo/decimate in Blender headless; export glTF to `public/models/`. Check the per-model credit cost in the Meshy dashboard first; the budget should cover on the order of a hundred assets, so plan ~40 and keep the rest for iterations.

**Work items**: `src/build/` snapping + validation (*Astra*), pieces kit (*Opus + Meshy*), shield mechanic (*Astra*), resources/inventory/crafting (*Opus agent*), cave field + marching cubes worker (*Fable agent*), mining laser + tools (*Opus agent*).

Exit criteria: two players build a walled base, lock it with a code, mine metal in a cave, forge ingots, craft a turret.

---

## Phase 7 — Economy & pre-built outposts

- Pre-built NPC outposts (one per biome + the station concourse) with shops: buy/sell resources, fuel, ammo, ship parts; prices drift with server-wide supply/demand; mission board (deliver, escort, clear patrol, survey cave).
- Currency + ledger server-side; player-to-player trade at kiosks; taxes fund server costs conceptually (lore for the ad-free tier).
- Cave "special items" (crystals, artefacts) are the high-value trade goods.

Exit criteria: a full loop — mine, sell, buy a weapon, win a fight, repair — in under 30 minutes of play.

---

## Phase 8 — Launch & scale

CI (tests + smoke + bundle size), telemetry (fps/latency histograms, opt-in), crash reporting, Cloudflare in front, EU + US regions, community: Discord, contributor guide for **bringing your own agent** (AGENTS.md), weekly builds.

---

## Team & process

| Role | Who | Scope |
|---|---|---|
| Core sim, netcode, integration | **Astra (Codex, GPT)** | `main.js`, `navigation.js`, `planet.js`, `world.js`, flight model, server |
| Project management, QA, module design, docs | **Claude (Fable)** | `ROADMAP.md`, `HANDOFF.md`, tests, screenshot tours, agent orchestration |
| Frontend / MFDs / HUD / shaders | **Opus agents** | `src/mfd/`, combat HUD, VFX |
| Hard maths & shaders (physics, caves, rings) | **Fable agents** | landing gear, marching cubes, ring, moon |
| 3D art | **Opus + Meshy / Blender** | hero props, station variants |

Rules that keep this working: one owner per file (see `HANDOFF.md`), new features land as new modules with a documented
swap, every module ships with a `/dev/` test page and a screenshot, `npm test` stays green, requests between agents
go in `HANDOFF.md`, and the roadmap is updated when a phase's exit criteria are met.

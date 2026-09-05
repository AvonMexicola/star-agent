# Star Agent — Roadmap

*Maintained by Claude (project manager). Astra (Codex, GPT-6) and its subagents (incl. Sol 5.6) do the implementation;
Claude reviews, tests and integrates, and spawns Claude agents only for exceptions (see Token policy). Last updated 2026-09-05 15:00. Status legend: ✅ done · 🔧 in progress · ⏳ planned.*

Star Agent is a browser-native, seamless space-to-surface sandbox: fly from orbit, land, walk, build, mine, trade
and fight, on a ¼-Earth procedural planet and its neighbours, with no loading screens. Everything is procedural
(a seed grows the world) except a handful of hero assets (station, base props) built in Blender or Meshy.

---

## Token policy (decided 2026-09-05)

Cees's ChatGPT/Codex plan is now 20×, so **implementation load goes to Astra and its Codex subagents (Sol 5.6 for
bounded, test-covered pieces)**. Claude's budget is reserved for: project management, design specs and acceptance
criteria, code review of Astra's commits, QA (screenshot tours, tests, perf gates), and small integration glue. Claude
agents (Opus/Fable) are spawned only when (a) Astra is saturated on a deadline, (b) a task needs Claude's browser/Chrome
tooling (e.g. Meshy asset generation), or (c) a Fable-grade shader/maths item stalls on Astra's side. Owner labels
below reflect this: *Astra* = Astra or a Codex subagent; *Claude* = review/QA/spec, not implementation.

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
3. `src/landing-gear.js` — per-strut spring-damper (`k`, `c`, travel 0.6 m), one raycast per strut against `terrainHeight`/`station.deckHeightAt`, touchdown g-force → damage event; gear animation from `ship-mk2.js`. *Astra (Codex subagent); Claude reviews.*
4. Re-entry heating/plasma shader on the hull (emissive, uses `q`). *Astra subagent.*
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
2. Page renderers `mfd/pages/*.js` with a shared design system (mint brand, mono type, 2-px grids). *Astra subagent; Claude supplies the design spec + reviews visuals.*
3. Radar sphere `mfd/radar.js`. *Astra subagent.*
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

**Work items**: `Body` refactor of planet/atmosphere/vegetation (*Astra*), moon palette + craters, ring shader + instanced belt, Pyre palette + heat mechanic, jump travel + tunnel FX + nav MFD page, moon/planets as lit discs from the surface (*Astra + subagents*); Claude reviews and runs the screenshot tour per body.

Exit criteria: stand on Aeon's beach at dusk and see the ring arc, the moon rising and Pyre as a bright point; jump to the moon and land in a crater.

---

## Phase 4 — Combat

**Goal:** Wing Commander-style dogfighting at ≤ 4 km, travel vs combat mode, shields.

- **Modes**: Travel (fast, weapons safe, shields low) ↔ Combat (≤ 250 m/s, afterburner to 400 m/s with heat/fuel budget, weapons hot, gimbal assist). Mode switch takes 1.5 s; MFD POWER page pips redistribute.
- **Weapons on mounts**: hardpoint sockets on the ship (wing tips, nose, belly); types: laser repeater (hitscan-ish with travel time, energy), ballistic cannon (projectile, ammo), missiles (lock-on, countermeasures). 4 km hard max range; lead indicator computed from target velocity; projectile sim in a fixed 60 Hz sub-step.
- **Shields**: 4 quadrants (F/R/L/R) with pools, recharge after 3 s no-hit, power pips scale recharge; hull HP per component (engines, wings, gear → gameplay effects); visual: shield-impact ripple shader, sparks, smoke trail on damaged engines.
- **AI**: 3 behaviours (pursue with lead, strafe-and-extend, evade); difficulty by turn rate and accuracy; spawn "patrol" encounters near the station and the ring. Server-authoritative once Phase 5 exists; single-player first.
- **Assets**: turrets/mounts/missiles from Meshy (see Assets), muzzle/impact VFX procedural.

**Work items**: `src/combat/` (weapons, projectiles, shields, damage) *Astra*; targeting HUD + lock, lead indicator, shield ripple *Astra subagent*; AI *Astra subagent*; damage model wired to flight model (Phase 1) *Astra*; balance tests (TTK tables) *Claude*.

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

**Ordered 2026-09-05: netcup RS 2000 G12** (Nuremberg) — 8 dedicated AMD EPYC cores, 16 GB DDR5 ECC, 512 GB NVMe,
2.5 Gbit/s, fair-use unmetered traffic, €16.89/mo (x86-64, so no Arm build concerns). This is the Tier-1 box; it
also covers Tier 2 for a while. Deployment target: Ubuntu 24.04, Node 22 or Bun, Postgres 16 + Redis on the box,
Cloudflare in front, deploy via SSH + systemd units (scripts in `scripts/deploy/`, owned by Claude).

**Server sizing** (single region, EU; bandwidth dominates before CPU). Prices verified 2026-09-05 after Hetzner's
June-2026 increase (CPX/CCX roughly doubled; CX/CAX and dedicated AX barely moved). Hetzner CX43 was out of stock,
hence netcup.

| Tier | Concurrent players | Machine | Est. cost | Notes |
|---|---|---|---|---|
| 0 — site only | unlimited | Cloudflare Pages / Netlify (static) | €0 | Client + assets (~6 MB, cached at edge). |
| 1 — MVP | ≤ 200 CCU | **Hetzner CX43** (8 shared vCPU, 16 GB, 160 GB, 20 TB) — or **CAX31** (8 Arm vCPU, 16 GB, €20.99) if the server is Node/Bun (both run on aarch64) | **€15.99 / mo** (+ ~€0.60 IPv4) | All shards on one box; Postgres + Redis local. 200 players × 25 KB/s ≈ 40 Mbit/s, ≈ 13 TB/month at full load — inside the 20 TB allowance. Shared vCPU is fine at this size. |
| 2 — growth | ≤ 2 000 CCU | **Hetzner AX42 dedicated** (Ryzen 7 PRO 8700GE 8c/16t, 64 GB DDR5 ECC, 2× NVMe, **unmetered 1 Gbit**) + Cloudflare in front | **€46 / mo** (+ €39 setup) | One dedicated box outperforms 3 cloud CCX33s (now €138 each) and traffic is unmetered, which is what a game server needs. Run shards by body as separate processes. Second AX42 in a US location when needed. |
| 3 — blow-up | 10 000+ CCU | 4–8× AX42/AX102 (or EPYC AX162 for a 48-core hub) behind a gateway, Redis cluster, managed Postgres, CDN for all static | €400–1 500 / mo | Per-player cost ≈ €0.05–0.15 / month; shard further by cell. Still far cheaper than any hyperscaler for this bandwidth profile. |

Rules of thumb: budget **~25 KB/s down + 5 KB/s up per player** at 20 Hz with 50 entities in interest; **~0.3 ms CPU per player-tick** at 30 Hz in JS → ~250 players per core-ish; RAM is negligible (entities only). Bandwidth is what you pay for: Hetzner's 20 TB/month per server covers ~2.6 MB/s sustained, so Tier 1 is fine to ~200 CCU average. Add a **Cloudflare tunnel/DDoS front** before any public announcement.

**Ads / funding (modest):** the client is a static site, so ordinary web ads work on the **landing view and loading screen only, never in the HUD**: one 300×250 or a native "sponsor" card under the mission panel, EthicalAds or Carbon Ads (developer-friendly, no consent banners), or AdSense (needs a consent banner in the EU). Add a privacy policy page and an "ad-free supporter" tier (Ko-fi/GitHub Sponsors) — that will likely out-earn banners for this audience.

**Work items**: protocol + schema, server skeleton with one shard and interest management (*Astra*), client netcode (prediction, interpolation, remote ships) (*Astra*), accounts/persistence (*Astra subagent*), load test with 500 bot clients (*Claude*), deploy scripts + Cloudflare (*Claude*, small).

Exit criteria: 50 players formation-flying around the station at 20 Hz with < 150 ms perceived latency in EU.

---

## Phase 6 — Bases, resources, mining, caves

**Goal:** Rust/Dune-style modular building; harvest → refine → craft; caves with rare items.

- **Building**: socket-snapped pieces (foundation 4 m, wall, doorway, window, roof, ramp, pillar, gate; tiers wood → stone → metal), placed against `terrainHeight` with a levelling foundation; 1 000-piece bases; server-validated placement; ownership + **access code**.
- **Interference shield**: base core projects a sphere (radius by tier, 150–600 m); ships without the code get a "NO ENTRY" MFD warning at 2 R and are pushed out/engines cut inside R; players on foot can still walk in (raids), so walls matter. Visual: faint hex-bubble shader at the boundary.
- **Resources**: wood (trees — chopping removes the instance via the existing exclusion system and regrows), stone (rocks/cliffs), metal ore (veins in cliffs and caves, ring asteroids), crystals (caves only). Tools: hatchet, pick, **mining laser** (beam + heat, works on ore and asteroids).
- **Processing chain**: campfire → forge (ore → ingots) → refinery (fuel from ice/regolith) → fabricator (parts, weapons, base pieces). Inventory with mass; ship cargo hold; storage crates.
- **Voxel mining (asteroids and planetside)**: every mineable volume is a signed-distance field (SDF) meshed with
  **marching cubes in a worker** — the same engine serves ring asteroids, cave interiors and ore outcrops.
  - *Asteroids*: SDF = ellipsoid + 3 noise octaves + ore-vein noise (metal/ice/crystal materials by a second field);
    meshed in 32³ chunks at 0.5–2 m depending on size; only asteroids within ~2 km are voxelized, farther ones use the
    baked instanced mesh. Mining subtracts a sphere from the SDF (mining laser brush 0.6–1.5 m); edits are stored as a
    sparse **brush list per asteroid** (position, radius, material removed) — tiny to persist and to replicate over the
    network, deterministic to replay, so two players see the same hole. Chunks re-mesh in < 4 ms.
  - *Planetside*: the height-field terrain stays authoritative for the surface; **voxel islands** (ore outcrops on cliffs,
    cave interiors, and a dig volume under any placed "excavation marker") overlay it with the same SDF/brush system.
    Digging anywhere on the open surface is out of scope for v1 (a height-field can't have overhangs); caves, cliff
    faces and outcrops cover the fantasy. Material yield = removed volume × ore density at the brush position.
  - Tools: pick (small brush, slow), mining laser (beam, heat, larger brush), later a ship-mounted mining laser for
    asteroids (Phase 4 mount system). Chunks cast/receive shadows and use the terrain material's rock/ore layers.
- **Caves**: carve the terrain with a 3D worm/noise field (`caveField(x,y,z)`), voxelized near the player and meshed with **marching cubes in a worker** (chunks 32³ at 1 m), entrances where the field intersects steep terrain; interior lit by crystal emissives + headlamp; rare items spawn deep. Height-field terrain stays as is; cave chunks replace it locally with a stencil/discard on the surface mesh.
- **Assets (Meshy, 25 k credits)** — pipeline that works best (Cees, 2026-09-05): (1) write a one-paragraph prop brief
  (function, silhouette, materials, scale in metres); (2) have ChatGPT render an **isometric 2D concept** of the prop on a
  plain background, ¾ view, neutral lighting, no text; (3) feed that image to **Meshy image-to-3D** (PBR textures on,
  target ≤ 10 k tris), pick the best of the variants, refine once; (4) download the GLB, run it through headless Blender
  (`blender -b --python blender/clean_asset.py -- in.glb out.glb`: decimate if > 10 k tris, apply transforms, origin at
  the base, Y-up, metres) and drop it in `public/models/props/`; (5) add a row to `public/models/props/manifest.json`
  (name, file, tris, footprint, credits spent). A Claude Opus agent drives the Chrome tabs (the one standing exception
  to the token policy); Cees stays signed in to both sites and the agent never handles credentials or payments.
  Targets: forge, refinery, fabricator, storage crate, base gate, turret bases, mining laser, shop kiosk, an asteroid
  set and a crystal set. Check per-model credit cost in the Meshy dashboard first; plan ~40 assets, keep the rest for
  iterations.

**Work items**: `src/build/` snapping + validation (*Astra*), pieces kit (*Meshy via a Claude Opus agent in Chrome — exception (b)*), shield mechanic (*Astra*), resources/inventory/crafting (*Astra subagent*), `src/voxel/` SDF + marching cubes worker + brush lists — shared by asteroids, caves and outcrops (*Astra; Fable agent only if it stalls — exception (c)*), asteroid SDFs and ore fields (*Astra subagent*), cave field + entrances (*Astra subagent*), mining laser + tools (*Astra subagent*), brush-list replication/persistence (*Astra*, Phase 5).

Exit criteria: two players build a walled base, lock it with a code, mine metal in a cave, forge ingots, craft a turret.

---

## Phase 7 — Economy & pre-built outposts

- Pre-built NPC outposts (one per biome + the station concourse) with shops: buy/sell resources, fuel, ammo, ship parts; prices drift with server-wide supply/demand; mission board (deliver, escort, clear patrol, survey cave).
- Currency + ledger server-side; player-to-player trade at kiosks; taxes fund server costs conceptually (lore for the ad-free tier).
- Cave "special items" (crystals, artefacts) are the high-value trade goods.

Exit criteria: a full loop — mine, sell, buy a weapon, win a fight, repair — in under 30 minutes of play.

---

## Phase 8 — Launch & scale

CI (tests + smoke + bundle size), telemetry (fps/latency histograms, opt-in), crash reporting, Cloudflare in front, EU + US regions, weekly builds.

**Community model (decided 2026-09-05):** the GitHub repo is **private and invitation-based**. Anyone who wants to
contribute by bringing their own coding agent (Claude Opus 5 / Fable, GPT-6 / Sol, etc.) asks Cees for an invite;
`AGENTS.md` + `HANDOFF.md` are the onboarding for agents (file ownership, module-swap pattern, `/dev/` test pages,
tests must stay green). Invitees work on branches and open PRs; the agents' owners review each other's PRs.

---

## Team & process

| Role | Who | Scope |
|---|---|---|
| Implementation lead: sim, netcode, integration, shaders, UI | **Astra (Codex, GPT-6)** + Codex subagents | everything in `src/`, server, MFD pages, effects |
| Bounded, test-covered pieces | **Sol 5.6 (GPT)** under Astra | scoped files only, reviewed by Astra |
| Project management, specs, review, QA | **Claude (Fable)** | `ROADMAP.md`, `HANDOFF.md`, tests, screenshot tours, PR review, perf gates |
| Exceptions only (browser tooling, stalled hard maths) | Claude Opus / Fable agents | Meshy asset generation; a shader or solver if Astra is stuck |

Rules that keep this working: one owner per file (see `HANDOFF.md`), new features land as new modules with a documented
swap, every module ships with a `/dev/` test page and a screenshot, `npm test` stays green, requests between agents
go in `HANDOFF.md`, and the roadmap is updated when a phase's exit criteria are met.

# SA-WORLD-004 — local delivery, 2026-09-09

Status: implemented, checked and locally integrated development checkpoint.
Next owner: Cees for local play and product decisions; independent domain/art,
physical-device and release performance acceptance remain separate.
Branch `feat/planet-rotation`, base `f1ef821`, runtime `7c6169c`, integrated
`8f819ac` after checked faction/vacuum-base delivery `2a6e405`.
Draft PR104 tracks this work. Owned paths are in `project/tasks/SA-WORLD-004.json`.
Private worktree `.worktrees/planet-rotation`; private5682/API8682 jobs have exited.

## What changed and what remains

Aeon, Selene, Pyre and Miasma rotate around Y on a 60-minute day. Centres retain
existing positions. Terrain, station, settlement, building, mining and parked-hull
anchors remain canonical body-fixed double metres; sunlight and sky evolve.
Disjoint three-radius coordinate domains preserve physical position, attitude and
velocity across transitions. Existing eight-radius gravity/navigation domains
are unchanged. Parked EVA/boarding and carried-cabin collision use the hull's
actual coordinate frame. Drive navigation leads rotating arrivals.

Protocol9 shares server planetary time and peer coordinate frames. Existing
terrain seeds and surface saves remain compatible; no database migration.
Straight routes may be blocked by a planet at some phases. This does not add
curved route finding, tilted axes, moving body centres or N-body dynamics.
Existing assisted flight/stabilized EVA and pause semantics remain in place.

## Validation

Combined `8f819ac` passes 1233 normal cases/162files31.05s,204 multiplayer cases
with 2 existing opt-in skips37.59s (including actual PostgreSQL freight persistence),
production build20.21s, repository checks and suggested plan. Nine numerical and
eight authority/room regressions cover the new frame contracts. Hosted all five
pass at preceding runtime a4d07d4/run34289735420; do not infer later-head results.

Production Chromium 151.0.7922.173, AMD 860M ANGLEgl,1440×900 scale 1, seed 7291.
Four-world/two-phase rendering04 passes. Complete injected-controller ground06
passes1.4min on unchanged navigation bytes: landing, hatch, walking/day-night,
inventory, held-input modal/reconnect suppression, boarding and launch. Sun dot
0.6470→−0.4635; ground drift 0.00361m, parked hull 0m. Combined09 passes actual
controller moon acquisition/travel50.4s and two real-client station/clock1.7min.
129 drive samples cross Aeon→inertial→Selene, arrival 20,000.016m. Two clocks skewed
seven minutes converge within 0.5s; actual controller walking/peer convergence and
stationary deck contact pass. Credentials are typed before controller play.
Application error arrays are empty; Vite logs ECONNRESET when a test context closes.

The adjacent README retains all failed fixture assumptions and scheduling
interruptions.08 overlapped a peer launch due its omitted CLI spelling; only our
own CLI was gracefully stopped. Guards now recognize all observed Node forms and
controlled Chromium. No browser startup failure was disguised or retried with
security/backend changes. Curated images/receipt are committed; raw logs/traces
remain ignored in test-results/planet-rotation. Physical-controller/native-touch
rotation journeys, independent art/domain review and performance remain unclaimed.

## Integration and operations

Local dev/all-features fast-forwarded2a6e405→8f819ac at00:13:49UTC. The exact dirty
shared HANDOFF remained 520678 bytes, SHA256
2f201781af25958b2287a4e28a4a172a83f4b77b143bcd0c93b53edf4bc45823.
Managed star-agent-persistent-preview.service gracefully refreshed the existing
5178/API8087 pair, MainPID2330283, protocol 9. Nine served routes and both health
checks pass; existing PostgreSQL 51224/public table counts are unchanged, with four
existing migrations and no schema/reset. Later handoff updates are append-only.
The managed service remains running; all private browser/server jobs exited.
No public/main merge, remote dev protection bypass or public deployment occurred.

Composition preserved Miasma's canonical camera and transformed parked-hull
argument while adding canonical construction claims; no claim-frame rotation is
needed because saved claims are already canonical. Both test inventories and
all checked faction/pirate source/evidence are retained. Keep garage interactions
installed before pirate hooks. Future integrations must retain rotation fields
and coordinate transforms; never replace protocol 9 with a lower pending version.
Deep-space authored points remain inertial; surface destinations remain canonical.

## Resume here

Refresh http://127.0.0.1:5178/ and use normal flight, walking, building and map
controls. No rotation toggle or new binding is required. Review the coordinate
ADR and this evidence before changing world/navigation/render/server hooks.
Cees retains product and public release authority.

# All-features local development

The ongoing local test branch is `dev/all-features`. Cees explicitly requests new
features integrated here as they become coherent commits. It is separate from
main's production review/deployment process. Use an isolated worktree; do not
switch or overwrite another agent's dirty feature worktree.

## Run and use

```sh
npm ci
npm run dev:all
```

Open http://127.0.0.1:5178/. The launcher offers Nomad 02, Kestrel and the current
30 m Atlas, with station hangar/approach, Aeon coast/forest/highlands/polar/orbit,
Selene surface/rings, Pyre twilight/surface, Miasma approach/surface and stellar
observation starts. Choose a ship, choose a location, then Launch test flight.
F2 or controller Menu → DEV · Ship & location reopens the dialog after taking
control. D-pad/left stick selects; A confirms; B returns. Keyboard Tab/Enter and
touch use the same buttons. No account or ship-unlock milestone is needed.

Each launch reloads into an isolated temporary test inventory and unlocked fleet.
Normal browser progression is neither read nor written. Test-session cargo and
construction reset when reloading. The current seed is retained in the URL;
use `?seed=42` or the ordinary controls panel to choose a different world.
A copied test URL includes its ship and start. This selector is gated by
`VITE_DEV_TOOLS=1`, set by `dev:all`; ordinary production builds retain their entry.

The Atlas Mark II link opens the separate 64 m studio. That asset and its pending
refresh are not the flyable 30 m fleet Atlas. Offline Kestrel has no cargo hold and
no installed weapons. Multiplayer currently uses the server's Nomad flight model;
joining it returns to the authoritative station spawn instead of keeping a dev
teleport, ship selection or test inventory. Local construction is not replicated.

The runner starts Vite on 5178 and an isolated memory API on 8087. Optional local
registration/login works through ACCOUNT; accounts reset when the runner stops.
Forgotten-password emails require SMTP and are unavailable in this local mode.
Ports in use cause an explicit failure rather than killing another preview.
Override `DEV_PORT` and `DEV_API_PORT` when needed. Ctrl+C stops both owned services.

## Integration snapshot

| Feature | Integrated source |
| --- | --- |
| Main world chain: Pyre, star, Miasma, seeded rocks | `origin/main` at `48a8468` |
| Consolidated flight, grass/terrain loading, mining/EVA/inventory, station opening | `integrate/main-2026-09-06` through multiplayer ancestry |
| Gear-limited flight, handling, drive, utilities, graphics, multiplayer | `feat/multiplayer-ten` at `f7a30ef` |
| Flyable Kestrel and shared Meridian identity | `feat/kestrel-flight` at `e4ec7df` |
| Nomad 02 hull, cabin, berth, cargo rack, folding gear | `feat/nomad-utility` at `be68a64` (asset/gameplay `9a363cb`) |
| Construction, mainframes, recipes and polished building pieces | `feat/base-building` at `891c916` |
| Current station concourse/shop finishes and prop production records | `feat/retail-soft-props` at `9f02d24` |
| Surface mist, volcanic ash, toxic wisps and shallow lunar dust | `feat/world-atmospherics` at `8bcdcc3` |
| Six local soundtrack variants with scene transitions | `feat/suno-soundtrack` at `f29c30d` |

Atlas exterior refresh and further character production remain in owner worktrees
without coherent new feature commits at this snapshot. Pending
Meshy retail soft-prop candidates are production records, not installed props.
Check shared HANDOFF.md and feature heads before updating this table.

## Updating the shared preview

Commit coherent feature work in its own branch. Merge that branch into
`dev/all-features`, preserving the combined runtime contracts. Resolve overlaps
explicitly; never replace main/navigation/world wholesale with a single older
branch. Run appropriate unit and browser checks, including the controller journey,
then refresh the running local preview and record the new source head here and
in HANDOFF.md. Do this without waiting for a production merge. Refresh feature refs
from origin before integration; review local owner commits as well as pushed heads. Public publishing
and main merges are separate actions; this dev branch is not a release sign-off.

The initial integration preserves both canonical seeded rock relief and parent
triangle terrain morphing, authored Nomad/Kestrel gear with all-ship speed limits,
physical berth/ladder access, build occlusion and attached third-person weapons,
and multiplayer account entry with offline fleet tooling. Cargo follows the
construction branch's 48 kg mineral capacity per installed box and 120 kg Nomad
supplies limit. Normal flight remains continuous; only explicit dev/quick-transit
starts teleport.

## Validation

See `docs/qa/local-development.md` for exact checks and limitations. Do not infer
whole-scene visual approval, physical controller testing or public deployment from
the presence of a feature branch in this test build.

## Space patrol combat

The local integration includes the offline patrol loop from `feat/space-combat`.
Choose **Nomad 02** or **Kestrel**, start in **Orbit**, then open **Patrol console**
(on-screen button or controller Menu) and accept. Fly to the amber beacon, brake,
and fight the Nomad/Kestrel pair. T / A fires; 1–3 / Menu selects weapons;
Tab / Menu selects the next hostile. The physical hangar cargo terminal also opens
the console. File the combat report after both kills, or recover after ship loss.

Shields regenerate after six seconds without a hit; docking repairs hull damage.
Progress resets on reload. This first slice is offline and does not add persistent
contracts or credit rewards. See [combat controls and scope](space-combat.md) and
[verification evidence](qa/space-combat.md). The asset studios remain inspection
surfaces; shared gameplay energy weapons do not imply new fitted gun meshes.

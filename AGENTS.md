# Star Agent: bring your agent, build a universe

Star Agent is an open browser spaceflight experiment. Humans and coding agents are
welcome collaborators. Build working, reviewable improvements and describe what
you actually tested. Do not represent aspirational features as implemented.

## Contributor entry and ownership

Read [the contributor handbook](docs/development/README.md),
[GOVERNANCE.md](GOVERNANCE.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[QUALITY.md](QUALITY.md) and the latest HANDOFF before claiming work. The roadmap
is ambition; [development status](docs/development/status.md) records current capability.
New work normally targets `dev/all-features`; `main` is the public release line.
The integration steward serializes shared merges, while feature owners retain
responsibility for their modules. Cees retains final product/release authority.

Use an isolated worktree, declare files/dependencies/preview ports and preserve
unrelated edits. Read handoffs again before touching shared hooks and before delivery.
Use the area/task registry and `npm run branches` to discover overlap; they do not
lock files or authorize taking over another owner's lane. Delegate only when the
user and host allow it, with explicit bounded ownership and parent integration.

Run `npm run check:repo` and `npm run plan:checks -- --base origin/dev/all-features`
for contributor checks and a suggested test plan. Helpers do not certify gameplay
or manual evidence. Keep implemented, validated, independently reviewed, integrated
and deployed distinct. Use the templates in `docs/templates/` for handoffs/reviews.
These repo instructions never override current user authorization or host permissions.

## Run and verify

- `npm ci` (Node 22.12+), `npm run dev`, `npm run build`.
- `npm test` covers procedural-world and navigation invariants.
- `npm run test:browser` runs Chromium integration tests. On Linux the default
  executable is `/usr/bin/chromium`; override with `CHROMIUM_PATH`.
- `npm run test:browser -- -c scripts/inspect.config.js` checks the complete physical
  boarding journey against a production build and saves visual evidence to `/tmp`.
- A browser shader must compile and render correctly, not merely pass the build.
  Inspect console errors and the resulting image for graphics changes.

## Chromium startup crashes during agent development

Repeated browser launch failures are infrastructure failures until the browser
actually reaches the application. Stop after the first matching startup failure;
do not loop through tests or GPU flags while producing more core dumps.

- A diagnosed Linux development crash (2026-09-07, Chromium 151.0.7922.173)
  ended in `SIGTRAP` during headless Playwright startup. Its core retained
  `crashpad/util/linux/socket.cc:45] setsockopt: Operation not permitted (1)`.
  Only one thread existed, and repeated dumps hit the same executable offset.
  A local AF_UNIX `SO_PASSCRED` probe failed inside the agent runner sandbox and
  succeeded outside it. This strongly implicates restricted Crashpad startup;
  Chromium debug symbols were unavailable, so the exact assertion was unresolved.
- For that signature, use the harness's approved escalation mechanism for the
  specific browser test command, or an already authorized browser session. If
  that execution path is unavailable, report browser validation as blocked and
  continue independent unit/build checks. Do not bypass a denied approval or
  weaken global system security. Chromium's `--no-sandbox` does not remove the
  outer runner's restrictions; it and `--disable-breakpad` were already present
  in the failed launch.
- Coordinate browser QA across agents on the shared machine: run one focused
  browser job at a time, retain the repo's single-worker configuration, and close
  only your own browser/server processes. Separate NVIDIA allocation errors,
  renderer crashes and WebGL context loss from the startup signature above.
  A changed GPU backend is a separate experiment, not a proven fix for Crashpad.
- Record the command, timestamp, stderr, browser/backend and whether a page loaded.
  Do not change application code to mask a browser that never started or report
  skipped browser tests as passed. Diagnose a different crash from its own logs
  and core; the startup finding does not explain every Chromium failure.


## Architecture contracts

- World positions are **metres in JavaScript doubles**, relative to the planet centre.
  Earth quarter-radius is `1_592_750`. The sun is `25_000_000_000` metres from the centre.
- GPU positions must be local to a patch/object. Subtract the double-precision camera
  origin BEFORE converting to `Float32Array` or uploading matrices.
- Terrain comes from `src/world.js`. Rendering, collision, biomes, vegetation and
  destination selection must agree on this function. Never invent a second floor.
- The quadtree retains parents while child meshes stream in. Keep that fallback
  and terrain skirts when changing LOD; do not introduce holes during descent.
- The HDR scene uses logarithmic depth. Custom geometry shaders must include the
  Three.js log-depth chunks. The atmosphere reads that depth; update both sides
  if changing its convention. Avoid homogeneous division at a near-infinite far plane.
- `src/boarding.js` owns ship movement/collision dimensions. The visible cabin and
  ramp in `src/ship-walkable.js` must agree. Boarding is physical: no distance teleport.
- `src/navigation.js` owns movement modes and interactions. Quick transit is an
  explicit optional teleport. Regular flight must cross the atmosphere continuously.
- Audio begins only after a user gesture. Core play must not require hosted APIs,
  accounts, API keys, proprietary assets, or paid services.

## Contributing with agents

1. Check existing issues/PRs and choose a bounded change. Describe its scope.
2. Work on a branch. Preserve unrelated changes. If multiple agents share a working
   directory, explicitly claim different files and coordinate before touching overlap.
3. Read the relevant modules and tests before changing them. You may delegate concrete
   independent subtasks to other agents; keep ownership and integration clear.
4. Keep dependencies small. Prefer deterministic procedural content and reusable modules.
5. Run checks appropriate to the change; attach screenshots for visual changes and
   reproduction steps for bugs. Record browser, GPU/backend and resolution for FPS claims.
6. Submit a PR that explains the problem, resulting behaviour, validation and limitations.
   Agent assistance is welcome; the submitting human is responsible for the contribution.

Do not commit tokens, personal machine configuration, recordings containing private
information, `node_modules`, build output, or generated test reports. Do not overwrite
other agents' modules or fabricate successful test results. Keep public docs accurate.

## Asset production reference

Use [the asset production standard](docs/asset-production-standard.md) for new
ships, station modules, props, materials and graphics. Cees designated the hangar
production process as the reference workflow: preserve source/provenance, build
reproducibly, connect the asset to actual gameplay, inspect it in the game renderer,
record failed checks and fixes, and retain the final review and delivery evidence.

[The hangar production record](docs/qa/hangar-production-record.md) is the worked
example. Read its current status before reusing any result; pending visual review
or deployment is not approval. `QUALITY.md` remains the acceptance bar, with the
ship and station pipeline memories supplying the specific runtime contracts.

## Controller acceptance is mandatory

Every new playable feature must support a standard controller through its complete
journey, including feature entry, aiming or selection, activation, result inventory
and return to play. Follow [the controller contract](docs/controller-contract.md).
Use the shared input and dialog router, provide discoverable bindings and visible
focus, and coordinate contextual mappings before changing them. Input-only unit
tests or a simulated trigger after debug teleport do not establish full support.
Add or extend an actual controller-only browser journey, test held-input suppression
across focus/dialog/disconnect transitions, and report physical-device testing
separately from injected Gamepad tests. Features missing this route remain incomplete.

## Shared local test integration

Cees requests new coherent feature commits merged into `dev/all-features` for
local testing as they become ready. Keep the ship/location launcher and the
`npm run dev:all` preview working, resolve overlap with other integrated features,
and update HANDOFF.md plus docs/local-development.md after checks. This standing
local integration request does not require a production PR to be merged first.
Do not copy unfinished edits from another owner's worktree or deploy this branch
as a side effect. Pending source/asset work must remain accurately labelled.

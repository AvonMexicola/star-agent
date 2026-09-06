# Star Agent: bring your agent, build a universe

Star Agent is an open browser spaceflight experiment. Humans and coding agents are
welcome collaborators. Build working, reviewable improvements and describe what
you actually tested. Do not represent aspirational features as implemented.

## Run and verify

- `npm ci` (Node 22.12+), `npm run dev`, `npm run build`.
- `npm test` covers procedural-world and navigation invariants.
- `npm run test:browser` runs Chromium integration tests. On Linux the default
  executable is `/usr/bin/chromium`; override with `CHROMIUM_PATH`.
- `npm run test:browser -- -c scripts/inspect.config.js` checks the complete physical
  boarding journey against a production build and saves visual evidence to `/tmp`.
- A browser shader must compile and render correctly, not merely pass the build.
  Inspect console errors and the resulting image for graphics changes.

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

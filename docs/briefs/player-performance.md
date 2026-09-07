# Player and multiplayer CPU optimisation

User request: optimise the combined local development build for eventual single-player and multiplayer releases without losing fidelity.

Base: local `dev/all-features` at `4706d62`. Isolated branch `fix/player-multiplayer-performance`.

Preserve exact terrain samples, authoritative simulation and snapshot rates, packet fields and privacy, physical collision, origin precision, character poses, complete ship meshes, materials, textures, shadows and rendering resolution. Remove repeated work and temporary allocations only. No dependencies or protocol/save migrations.

Ownership: parent owns navigation altitude sampling, validation harness, task/docs and integration. Server delegate owns room/broadcast work; remote delegate owns remote presentation/client reconciliation; character delegate owns rig/IK work. Shared main loop is read-only for this pass. Preview ports 5592/5593; one browser job after the existing wildlife/hub queue releases. Shared services and database stay with their current integration owner.

Acceptance: focused equivalence/regression tests, reproducible before/after CPU measurements, full unit/multiplayer tests with a disposable SQL database, production build, and focused browser checks using the unchanged real assets. Report operation-specific gains separately from whole-game FPS and any outstanding validation honestly.

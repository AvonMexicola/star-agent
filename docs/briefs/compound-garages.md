# SA-GARAGE-001 — compound vehicle garages

Status: active. Cees requests garages that spawn ground vehicles. Codex owns
`feat/compound-garages`, based on checked `23ca619`, in the matching worktree.
Private preview5674/API8674; disk-backed browser cache and evidence.

Replace the right-hand storehouse of each existing trade compound with a
drive-through Burrow garage using the original construction kit. Preserve the
large ship pad, trader, left warehouse, floodlights and established site origins.
Add a reachable vehicle terminal, clear boarding space, workshop fittings and a
supported ramp that joins the canonical terrain. This reuses authored kit assets;
it introduces no manufactured mesh or external dependency.

The player lands, walks to the terminal, requests the existing Burrow, physically
boards it, drives through the garage and down the ramp, opens its actual ore bin,
then returns to normal play. One live solo rover is reused. Retrieval must preserve
ore and cutter charge, refuse occupied/busy/moving/carried vehicles, refuse an
obstructed destination, and revalidate reach after asynchronous model loading.
No automatic seat teleport, new fees, free cargo grants or multiplayer authority.
Rover positions retain the existing session lifecycle; inventory retains its
existing save. The same vehicle can be requested again after a reload.

Use shared F/X interaction and semantic modal/controller routing, visible focus,
keyboard and native390 touch actions. Test held inputs across close/focus/device
transitions and repeated requests. Add physical construction support to the rover
through the existing kit geometry; no alternate world floor or disabled collisions.

Owned: new settlements/garage-* and rover-build-support modules, kit layout and
settlement state additions, narrow rover support/deployment and main hookups,
tests/UI/brief/QA. Builder's build/system.js and Pirate001 combat ownership stay
separate. Parent also delegates secret pirate compound SA-PIRATE-002 per Cees.

Checks: all-site wheel/body/entry/ship clearance and ramp traversal invariants,
blocked/repeated request and inventory preservation, complete actual controller
journey and keyboard/touch checks, renderer images and diagnostics, unit/build/
repository plan. Independent art, physical-device and frame-budget acceptance
remain distinct from the standing local integration checkpoint. No public release.

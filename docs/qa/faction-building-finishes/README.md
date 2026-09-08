# Faction building finishes — development record

Parent authors paint/print/UI and four corporate sites; delegated Pirate003 owns
Miasma and both enclosed entrances. Base cc1e749. Current implementation is private,
not yet browser-validated or locally integrated. No public deployment.

Original deterministic 512×768 Canvas prints are authored in src/factions/graphics.js;
all eight texts/colours are in src/factions/catalog.js. Meridian paths are copied
exactly from its existing identity and checked against that original source. The
other five marks and two safety diagrams are original code-native artwork. No
image generation, paid tools, new GLBs or third-party assets. Printed enamel faces
are 1.4×2.1 m at wall-local y1.55/z±.181, beyond the ±.164 m authored wall envelope.
They use scene-lit standard materials, cast no shadow, and add no collider/light.
Textures are shared per graphic and released with the last referencing wall;
pad identities reuse existing pad canvases. Geometry, UVs, normals, light colours
and costs remain authored. One front exchange window becomes a solid sign panel
at each public site; the actual kit wall collider matches that panel.

First CPU checks: build-finish/build-state/settlements/pirate-compound all four
files PASS5.72s; nine new appearance invariants PASS1.22s. They cover private
materials, atomic actual reticle/save/reload, failed writes, real reach/ownership,
old saves and hostile metadata, server revision safety, original emblem paths,
site/cargo/garage identity, wall clearance and shared texture lifetime. No browser
or controller gameplay pass is implied by these checks.

Initial contributor check correctly flagged Pirate002's stale review status as
an active shared claim, despite its cc1e749 integration/receipt. Metadata corrected
to integrated, retaining formal art/hardware/performance caveats. No source taken
from that old lane. Build and production browser evidence follow below. A new
worktree read was attempted before checkout finished and found no module yet;
checkout completed normally and the read was repeated, with no missing-source fix.

Full normal registered suite:160 files PASS60.20s on48be92e, two workers with
disk TMPDIR, raw test-results/faction-units-01/unit.{json,log}. First production
build PASS46.98s before the final no-readback pad redraw refactor; the browser
runner includes the final production build. Existing Vite chunk advisory retained.
Repository/diff checks pass. First browser candidate5d4d3ff is queued after the
shared machine's earlier ready Recovery/Sentry/Rotation jobs; no GPU acquired.

# Independent functional review request

Review the uncommitted character fidelity change in this worktree against HEAD.
Read AGENTS.md, QUALITY.md and docs/asset-production-standard.md. Do not change
files, commit, push, or affect other working directories. You are the independent
Claude functional reviewer required by QUALITY.md. Return numbered findings with
severity, file/line, reproduction and concrete fix. Say whether the implementation
is functionally ready for review. Distinguish missing validation from a proven bug.

User explicitly requested a higher polygon, higher texture Meshy character with
many animations and natural held weapons across first/third person. The old asset
budget is superseded for this character: 62,177 triangles, 2 × 2K WebP PBR maps,
24 bones, 26 clips, two sparse glove morphs, ~8.05 MB. No hosted runtime dependency.
The branch is stacked on feat/flight-options / PR 38, which owns camera shortcuts.
Do not demand rewriting unrelated game architecture or speculate new features.

Scope: src/character.js, character-ik.js, equipment.js, mining/tool.js, main.js,
ship-camera.js, opening-sequence.js, player-avatar.js, avatar-studio.js/css,
blender/prepare-avatar.mjs and helpers, related assets/manifest/tests/config.
Ladder/sitting/reload/interact clips are previewable assets with state-machine
hooks; this request does not implement new physical ladders, seat interactions,
ammo reload mechanics or damage sources. Actual game uses locomotion, injury input,
weapon/tool aim/fire and a controller-accessible Wave command. A single Equipment
instance is reparented between floating first-person and skeletal third-person.

Run relevant tests/build if useful; existing browser journey is currently being
run by the primary agent, so do not start a competing GPU browser. Inspect the
actual binary rig and its CPU tests. Pay particular attention to camera-relative
precision, crosshair/muzzle obstruction, same inventory/heat/ammo across cameras,
animation layer/fade behavior, one-shots, gesture interruptions and IK restoration.
Do not silently treat tests as proof of visual quality; that is the next reviewer.

Already observed/fixed: wrong Meshy emissive material and missing ORM, backward
spine names, travelling clip roots, open fingers, overly long rifle stock, support
arm reach failures, one-frame stale render origin, production studio entry/favicon.
Full npm test had one cancelled moon module while other GPU work ran; its isolated
15 tests then passed. Final full rerun is pending. New actual-GLB tests pass.
First browser attempt rendered all requested studio views but found a favicon
404 (fixed); controller wave completed but test awaited a transient idle instead
of returning rifle aim (corrected). The rerun is in progress.

Use final response as the review record; do not create a separate output file.

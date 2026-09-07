# Blender Nomad ship — ready for review

PR: https://github.com/AvonMexicola/star-agent/pull/4
Commit: 9370c53 on feat/blender-nomad-ship, stacked on PR #1 (feat/inertial-flight).
Isolated review checkout: /tmp/star-agent-ship-review.
The combined shared workspace keeps the ship changes beside controller/crash work.
This session did not switch the shared branch back or commit unrelated changes.

Delivered: editable assets/ship/nomad.blend and deterministic Blender builder,
public/models/nomad.glb, sloped panoramic canopy, swept wings/engine/gear detail,
hinged starboard cargo container, 120 kg ship / 20 kg backpack persistent inventory,
four live rectangular MFDs, physical cabin/hatch/ramp/seat preservation and GLB fallback.
MFDs are telemetry displays; button/page interaction, cargo item use/gathering,
and cargo weight affecting flight physics remain unimplemented.

Owned files: assets/ship/, public/models/nomad.glb, src/ship-walkable.js,
src/ship-mfd.js, src/ship-inventory*, src/ship-studio.js, public/dev/ship.html,
ship tests/configs and docs/nomad-ship.md + docs/images/nomad-*.png.
Shared integration: boarding.js storage bounds/collision/interaction;
navigation.js storage prompt and openInventory callback; main.js UI/MFD updates,
asset weathering and diagnostics; index.html cargo controls; package test entry;
surface-materials.js exemption for canvas MFD screen materials.

Verified: isolated 46 unit tests, production build, both production ship browser
cases and studio browser case pass with no page/shader errors. Combined shared
workspace also passed its 56-test unit suite and both ship browser cases before
extraction. Chromium / ANGLE SwiftShader, game 1440x900, studio 1600x1000;
movement tests at scale .4, final screenshots at scale 1.0. No FPS claim.
Production ship checks use /tmp/star-agent-ship-build and port 5186;
studio uses a separate dependency cache and port 5190. A development studio
was left running from the isolated checkout: http://localhost:5190/dev/ship.html.

See docs/nomad-ship.md for commands, limitations and screenshots.

Resume check: PR #4 remains open and mergeable; GitHub verify and Vercel checks succeeded, with no human review requests. Restarted the viewer as transient user service star-agent-ship-viewer.service on port 5190 and verified HTTP 200. It now survives the tool session; no PR merge performed.

Comprehensive reusable pipeline saved in [SHIP-PIPELINE-MEMORY.md](SHIP-PIPELINE-MEMORY.md). Fable 5.1 was addressed in the appended manager notification in HANDOFF.md; acknowledgement is pending.

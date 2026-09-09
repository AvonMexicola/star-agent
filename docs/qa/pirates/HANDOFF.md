# SA-PIRATE-001 — handoff, 8 September 2026

Status and next owner: author validation in progress; Codex retains this lane
until final controller/input receipts and local integration are recorded.
Branch `feat/pirate-ground-encounters`; original base `8b5ecd4`, checked combined
runtime `9be1630`. Dependencies: locally integrated Transport `65f1721`,
compound garages `83e10ae` (runtime `e098947`) and handheld tools `0abc2f7`.
Owned worktree `/home/cees/projects/star-agent/.worktrees/pirates`; private
production preview5664. The earlier `/tmp/star-agent-pirates` worktree was moved
to disk to relieve the host temporary-file quota. No other owner's edits copied.

Player-visible result: five rigged humans form two solo ground camps with ranged
combat, distinct tactics, cover and finite salvage. The active expedition player
has crouch idle, forward/backward walking and both strafes, usable with C/R3.
Lizzy has corrected arms and four guide-ready clips. The tutorial itself is pending.

## What changed and what remains

Owner files are `src/pirates/`, its source/runtime assets and builders, tests,
studio and QA docs. Shared changes are bounded to navigation stance, Character
clip selection, main setup/update/input menu hooks, mining weapon impact,
weapon-target nearest candidates, development start options, player GLB/manifest,
generic medical emergency heading, build entry and normal test registration.

Source files and hashes are retained; runtime characters fit the existing asset
budgets. Every terrain contact uses canonical body ground. Positions remain
double-precision world metres with the render origin subtracted before GPU use.
Caches use the existing save's containers, no new schema. Multiplayer suppresses
these solo entities and crouch input; there is no authoritative NPC protocol.

Enemy clearance lasts for the current browser session. Cache depletion persists
and cannot be farmed by reloading. Pickup/carry clips are present, but no new
heavy-object gameplay is claimed. Lizzy has no placement/dialogue/tutorial script.
Independent rubric, physical controller and controlled performance acceptance
are separate from author checks. No production deployment is authorized by this
local checkpoint and none was performed.

## Validation

Full combined unit suite:1,210 cases pass, zero fail/skip, on runtime `9be1630`.
Normal and development-enabled production builds pass; existing chunk warning
retained. Repository checker and suggested-check planner pass. The
[production record](README.md) gives exact commands, assets, failed candidates,
browser captures and measured budgets. Final browser/integration update pending.

Actual five-pirate rendering and Lizzy's idle/walk/run/wave pass with zero app
diagnostics. An earlier complete Aeon standard Gamepad journey passed with actual
ammo, health loss, medical use, all three kills, loot transfer and reboarding.
The final natural-obstruction revision passes the complete Aeon camp journey.
The first lunar approach was too steep; `8364d5d` selects a canonical apron
with a measured maximum4.13degree slope. Its Selene journey is running.
Keyboard/native390 regressions are recorded separately from controller-only play.

One shared GPU job at a time, Chromium151/ANGLE AMD860M GLES3.2,1440×900 and390×844,
seed7291/epoch1788000000000. Physical devices were not tested. Original failure
videos/traces are retained in ignored root `test-results/pirates-*`; curated
images are tracked alongside this file. Do not erase failed evidence or relabel
the original WebGL/quota and test-fixture failures as passing checks.

## Integration and operations

Local integration pending. Candidate tracked HANDOFF.md intentionally matches the
integrated branch so native Git can preserve that worktree's dirty coordination
journal byte-for-byte. The root worktree remains unrelated `feat/controller-support`.
Read both journals and current dev head immediately before the source-only merge.
Only ready commits are merged; no service restart, data reset or production push.

Both existing5178/8087 `/api/health` routes returned200, and served main source
included checked garage hooks before this task's merge. Final pirate served-source
and exact GLB hashes must be checked after local integration. Already approved
curl/Git/QA prefixes suffice; no new routine approval prompt is required.

## Resume here

Inspect the current focused runner's final evidence, correct any observed failure,
retain its screenshots/receipt, then finalize this handoff and the task registry.
Integrate into current `dev/all-features` with the dirty journal preserved and
verify actual served source/assets. Submit the bounded draft PR with checked
dependency bases. Release only this task's preview and GPU processes.

# SA-PIRATE-001 — pirate and guide production record

Status: implemented in isolated `feat/pirate-ground-encounters`; final combined
browser checks and local integration pending. Runtime candidate `9be1630`
contains checked Transport `65f1721`, compound garages `83e10ae` and handheld
tools `0abc2f7`. Owner: Codex
pirate encounters. Worktree `.worktrees/pirates`, production preview5664.
No public deployment, protocol/schema change or independent acceptance is claimed.

## Result and production

Three Aeon pirates and two Selene pirates inhabit two reachable solo camps.
Roles vary movement speed, range, toughness, flanking, burst size and reload.
Aim windups lock a point the player can dodge. Low-cover captains stand to aim
and crouch on reload. Actual weapon muzzle rays, camp barriers, natural rocks,
canonical terrain, buildings and the parked ship obstruct shots. NPC movement
uses the existing rock capsule colliders while preserving the player's last
grounded contact and mining aim. No alternate floor is introduced.

Player shots spend existing loadout ammunition; enemy hits use existing medical
transactions and recovery. Death is sticky within the session. After clearance,
the finite cache uses real native inventory transfers and persisted depletion.
The [player route](../../pirate-encounters.md) gives entry, bindings and limits.

Exact user downloads, original ZIP members and hashes remain in
`assets/pirates/source-manifest.json` and
`assets/characters/lizzy/source-manifest.json`. Static pirate meshes receive a
common 22-bone skeleton; heat weights failed on disconnected clothing and were
replaced by normalized four-influence nearest donor-surface weights. Sources,
authoring scripts and build settings remain reproducible. Blender intermediates
are ignored; runtime exports and source hashes are tracked.

Five pirate GLBs each contain approximately18,000 triangles and21 clips, below2 MB each
(approximately 1.75–1.84 MB). Base maps are1024px and surface maps512px WebP.
The bevelled barricade is147,236 bytes and salvage cache101,896 bytes. Their
visible dimensions match camp collision boxes. `public/models/pirates/manifest.json`
and `assets/pirates/build.json` record exact output identities.

Image headers and glTF materials were inspected directly: each pirate has one
material and three embedded maps (1024²,512²,512²), about6 MiB decoded RGBA base
levels or8 MiB with a full mip chain. Lizzy has one material/1024² map,4 MiB base
levels (about5.33 MiB with mips). These are format estimates, not measured GPU
allocation. The two camp props use four/five materials without texture maps.
The five-character studio reports22 calls/138,056 triangles, including its
floor/grid and equipment. Earlier Aeon gameplay snapshots show676–800 calls and
1.47–1.72M triangles at adaptive0.8–0.85 render scale. These are workload
observations; they do not certify frame-time targets under shared-machine load.

The active expedition player retains its detailed skin, glove morphs, shadow
index LOD and sockets. Nine additional clips and a deeper forward crouch bring
it to35 clips and8,686,516 bytes, inside its existing9 MB exception. Crouch
transitions, idle and directional movement share the existing Character mixer
and preserve the upper-body rifle aim layer. Prop manifest clip/hash metadata is
regenerated with the model.

Lizzy is inferred to be the newest rigged Trailblazer T Pose download. The
source walk holds her upper arms away from the torso. The retained correction
reduces lateral shoulder abduction in evaluated world space, preserves her
supplied gait and authored skin, then converts back to each bone's own axes.
Idle and wave are authored from her rest pose; root travel is removed.
The 17,999-triangle,24-bone runtime is1,171,008 bytes with four clips and a1K map;
SHA-256 `6296661e307fc6fa90757f00db6bee6980f01c68d03155fd9a86b0c4c910e223`.
Two generic retarget attempts were rejected for pelvis distortion and unsuitable
head pose. Retained direct correction renders normally in the actual loader.
Tutorial script, dialogue, voice and in-world placement remain unimplemented.

## Author validation

- `npm test -- --test-concurrency=2`: **1,210 cases pass**,0fail/skip,37.71s on
  `9be1630`. Includes combined handheld, garage, transport, player and collision suites.
  New tests inspect actual skinned vertices at sampled animation phases, weights,
  clip selection while aiming, real rock triangles, tactical timing, dodge,
  muzzle veto, paused state, death and finite persistent loot transactions.
- `npm run build` and `VITE_DEV_TOOLS=1 npm run build`: pass. Existing large-chunk
  warning retained; no new dependencies. The latter is the browser candidate.
- `npm run check:repo` and `npm run plan:checks -- --base origin/dev/all-features`:
  pass after adding the player/production docs (40 tasks/41 managed documents).
  The140-path suggested plan includes checked dependencies; helpers do not certify play.
- Actual five-character renderer review passed in the20:20:48UTC batch: idle,
  walk, run, crouched idle, both crouched strafes, carrying walk, death and armed
  rifle pose. Zero page/console errors or warnings. The author inspected captures.
- Full Aeon controller journey passed in the same batch (5.0min), including
  actual Contracts transit activation, landing, hatch/ramp exit, movement,
  third-person crouch, return fire and health loss, all three kills, medical use,
  held RT across modal/native focus/device replacement/unsupported mapping,
  exact loot transfers and physical reboarding. The final natural-cover revision
  also passed the complete Aeon route in the20:38:34UTC batch (5.0min):9 enemy
  shots,35 damage applied, all3 pirates defeated, carbine ammo60→43, exact cache
  transfers and final mode `landed` after physical reboarding. Zero diagnostics.
  See [firing](aeon-fight.png), [crouched player](aeon-player-crouch.png),
  [real loot result](aeon-loot-result.png) and [returned cockpit](aeon-returned.png).
- Lizzy's four clips rendered successfully in the20:33:38UTC batch (3.9s),
  zero diagnostics. Author inspection confirms intact body proportions, arms
  closer to torso and a readable greeting. Studio review is distinct from
  future in-world tutorial acceptance.

Browser: Chromium151.0.7922.173, ANGLE AMD Radeon860M/radeonsi/OpenGL ES3.2,
1440×900; phone control regression390×844. Seed7291, epoch1788000000000.
One focused GPU job at a time, one worker, no retries. Gamepad journeys inject a
standard controller and read debug state only for steering/assertions; they do
not set pose, health, damage or inventory. Physical-device testing is separate.
Keyboard/native touch regressions are scoped separately from a full phone fight.
Shared-machine snapshots do not establish FPS or performance acceptance.

## Retained failures and corrections

The initial studio run had a single missing favicon404; adding an explicit data
favicon corrected it. A first game run lost its WebGL context and hit the host
temporary-file quota. Its truncated trace and diagnostics remain; it is not a
Chromium-before-page startup failure. Subsequent evidence uses disk-backed short
TMPDIR and no changed security/GPU flags. An early walking fixture overshot at
low frame rates; its steering now runs from browser animation frames.

The19:59Aeon run completed combat but its focus assertion failed because default
Playwright focus emulation prevented a real blur. The test now disables that
emulation during actual tab switching, waits for document/navigation blur/focus,
then verifies held-trigger neutral arming. No input runtime change masked it.

The20:20Selene run landed and reached the hatch with zero diagnostics, but the
walking helper projected its cabin waypoint against planet up instead of the
tilted ship's up. It timed out at a valid hatch interaction. The helper now uses
the actual ship plane inside and canonical surface normal outside. The original
failure PNG, state, video and trace remain.

After that correction, the20:38Selene route opened the hatch and exited but
exposed a real site-placement defect: a small formation under the landing
approach tilted the ship51 degrees. The original yard-only samples ended before
that area. Revision `8364d5d` samples the complete30×40 m hull/ramp apron every3 m
and selects a different canonical site. Its measured maximum apron slope is
4.13 degrees with4.56 m yard relief. The regression inspects those actual normals;
the rebuilt browser route is checking physical return as well as arrival.

The first keyboard-only fixture held S although the Nomad deliberately turns
the pilot toward the rear on standing. Its retained video shows the pilot chair
blocking backward travel. It now uses W for the actual aft exit, without a
navigation/runtime change. Native phone crouch remains a separate scoped check.

Original large artifacts stay ignored under root `test-results/pirates-*`;
earlier diagnostics remain in `/tmp/star-agent-pirates-qa` and `/tmp/lizzy-audit`.
The [five equipped pirates](five-pirates.png) and [crouched movement](pirates-crouch.png)
are captures from the actual Three.js loader. Lizzy's [idle](lizzy-idle.png),
[walking](lizzy-walk.png) and [greeting](lizzy-wave.png) show the retained correction.
Her [original Blender walking render](lizzy-original-blender.png) is intake evidence
with different lighting/camera; it is not a same-camera render comparison.
Final gameplay captures and integration receipt will be added after the current
focused run. Independent art rubric, controlled performance acceptance, physical
controller and public deployment remain pending.

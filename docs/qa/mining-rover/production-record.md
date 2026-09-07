# Meridian Burrow M-04 production record

Burrow is a playable development candidate: an enclosed four-wheel mining rover
carried by the current flyable 30 m Atlas. The complete production controller
journey passes. Keyboard/touch journeys and final visual acceptance remain in
progress; this is not a release approval.

## Player result

Use the development launcher's **Atlas + Burrow / Selene** entry, or open a build
with development tools enabled at `/?dev=1&intro=0&ship=atlas&start=moon&rover=1`.
Leave Atlas's pilot seat, walk aft on the starboard aisle and approach the rover's
port door. Board, lower the lift, drive out and aim at an existing mineral deposit.
Collected ore goes into the rover's persistent 96 kg mineral bin.

| Action | Keyboard | Standard controller | Touch |
| --- | --- | --- | --- |
| Board / exit | F | X | Cabin |
| Drive / steer | W/S, A/D | Left stick | Drive pad |
| Aim cutters | Arrow keys | Right stick | Aim pad |
| Sustain both beams | T | RT | Mine |
| Brake | X | LT | Brake |
| Atlas lift | G | Y | Lift |
| Ore bins | I | View | Cargo |

The twin cutters provide 120 seconds of continuous charge and recharge in 30
seconds after release. Both follow the actual named emitter tips, ray-test the
world individually, and use the existing atomic rock-and-inventory transaction.
Each beam can be obstructed independently. Full bins or failed persistence stop
extraction without granting ore or publishing an unsaved cut.

## Measured contract

Metres, +Y up, −Z forward; world poses stay in JavaScript doubles and rendered
geometry is relative to the camera. The source of dimensions is
[layout.json](../../../assets/mining-rover/layout.json).

| Measurement | Export / runtime contract |
| --- | --- |
| Closed, straight wheels | 4.65 m long × 3.02 m wide including fixed steps × 2.50 m high |
| Steering sweep | 3.232 m conservative width; ±0.52 rad front steering |
| Wheels | Four, 0.52 m radius, 2.16 m track, 2.70 m wheelbase; ±0.22 m suspension |
| Atlas main lift | 8 × 10 m, floor Y 0–4 m, cargo ceiling Y 9.2 m |
| Initial parking | Atlas local [−1.6, 4, 5], facing aft to unload forward |
| Asset candidate 09 | 21,570 triangles; 2,178,492 bytes; four embedded textures |
| GLB SHA-256 | `0ce536332a9e1b29d89d29981e510739c975cd739514cfe1e9e0b810120617fb` |

The finite independent geometry probes find all 762 sampled closed-cabin side
rays hit the shell. Sampled wheel/link poses, cutter rays, lamp supports and
boarding-eye clearance pass. This is not a proof of global watertightness or a
continuous full-body collision sweep. The cabin has no pressure/life-support
simulation; seated hand IK and multiplayer vehicle replication are outside scope.

## Validation

The production controller test passed in 2.5 minutes on Chromium 151.0.7922.173,
AMD Radeon 860M through ANGLE GLES 3.2, 1440×900, DPR 1, seed 7291. It uses injected
Gamepad input and read-only state feedback, with no movement or action setters.
The journey walks from Atlas's pilot seat, physically boards the rover, lowers the
lift, unloads onto four canonical terrain contacts, turns toward the existing
mineral deposit, mines with both beams, transfers ore through the inventory,
returns to the lift, raises it, walks back to Atlas's pilot seat and launches.
The rover remains carried within 0.02 m of its parked local pose in flight.

The same run checks held-trigger recovery after cargo, focus, disconnect,
controller replacement and unsupported mapping. No page/console errors or
warnings occurred. It recorded 11.4163 cumulative cutter seconds and 0.693861 kg
remaining after the test's ore transfer. The 120-second duty cycle and 30-second
recharge are separate simulated-time unit checks, not a two-minute browser hold.

Initial complete unit runs passed 711, then 714 tests after regression additions.
The Vite production build passes with the inherited large-chunk warning. Latest complete source run passed **714/714** in 41.94 s; the production
build passed in 21.52 s after the current cargo-label fix. No physical gamepad, physical phone or listening test is claimed.

The controller's last instantaneous scene count was 335 draws / 885,874 triangles;
this is context, not a hardware frame-time or sustained performance pass. Shared
GPU contention prevents treating incidental FPS samples as acceptance evidence.
The asset is under its 30k-triangle / 4 MB brief budget.

## Reproduce

See the [asset README](../../../assets/mining-rover/README.md) for deterministic
Blender/texture rebuilding. Dependencies are unchanged. No save version, database
schema or multiplayer protocol changed. Only ore uses the existing saved
transaction; rover position and charge reset with the development session.

```sh
npm ci
VITE_DEV_TOOLS=1 npm run build
npm run preview -- --port 5417 --strictPort
# In another terminal; use a short, writable directory for Chromium sockets.
TMPDIR=/path/short ROVER_URL=http://127.0.0.1:5417 ROVER_OUTPUT=/path/qa/controller npm run test:browser -- -c scripts/mining-rover.config.js
TMPDIR=/path/short ROVER_URL=http://127.0.0.1:5417 ROVER_INPUT_OUTPUT=/path/qa/inputs ROVER_INPUT_RETURN=1 npm run test:browser -- -c scripts/mining-rover-inputs.config.js
```

`ROVER_SMOKE=1` intentionally stops the controller test after unloading. It does
not establish mining or return. Keyboard/touch tests record original videos and
source hashes; full routes require `ROVER_INPUT_RETURN=1`.

## Evidence and review

- [Twin beams in the actual game](04-twin-cutters.png)
- [Saved ore and tested transfer](05-ore-bins.png) — historical capture still shows the inherited “Nomad cargo” carrier label; presentation fix is awaiting the next run.
- [Physical return on Atlas's lift](06-reloaded-atlas.png)
- [Rover carried in flight](07-carried-in-flight.png)
- [Iteration history](iteration-history.md) retains failures and their corrections.
- Independent runtime reviewer `/root/nomad_cutter`: seven runtime findings closed. Physics/mining modules authored by that reviewer are excluded from the claimed independent scope.
- Independent asset reviewer `/root/kestrel_reviewer`: finite mechanism probes and actual native PBR captures. Candidate 04 scored 3.42 and candidate 07 scored 3.68; neither is accepted art. Candidate 09's final disposition is pending.

The isolated PBR fixture and actual gameplay are distinct evidence. Its original
shadow-off control was invalid because cached material programs still received
shadows; the corrected control disables shadows before first draw. Do not infer
a texture cause from the invalid comparison. The stale pre-render mannequin
bounds in the first fixture are corrected in the retained [erratum](erratum-candidate-04.md).

## Delivery boundary

Implementation: `feat/meridian-mining-rover`, base `4d38827`; first coherent source
checkpoint `44eb3a2`. The integration steward has that explicitly unfinished
checkpoint in its isolated content-review candidate. The shared persistent
preview 5178 / API 8087 / PostgreSQL 51224 are steward-owned and preserved.

The bounded review branch is `review/meridian-burrow`, stacked on the gameplay
menu PR #60 (`f8e48d9`). Rover does not depend on the fitted ship-weapon modules;
those unrelated local integrations are excluded from this PR. Cees gates the
PR and release. Final input, visual, performance and combined integration status
remain separate; no public merge or deployment is claimed.

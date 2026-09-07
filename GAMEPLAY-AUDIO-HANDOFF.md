# Star Agent gameplay audio — 7 September 2026

Branch: `feat/gameplay-audio`, isolated at
`/home/cees/projects/star-agent-gameplay-audio`, based on multiplayer `f7a30ef`.
This branch includes the current-main Suno music work from PR #47, adapted to
preserve the multiplayer branch's power/cabin, controller and account behavior.
Its review base is `feat/multiplayer-ten` (PR #44); it must not replace main's
newer planet/star integration. Main merge and public deployment are pending.

## Implemented

- Rock, grass, snow, wet shoreline, sand and metal footsteps. World height,
  biome and slope select a coarse material; there is no new collision floor.
  Snow uses the existing large-scale shader snowline, not per-pixel noise masks.
- Actual displacement drives alternating, slightly varied steps. Ground contact
  gates playback; jump/EVA, stationary/blocked movement, menus, tab suspension
  and teleports do not accumulate a step backlog. Cabin coordinates prevent
  the ship's world speed from generating footsteps. Simulation time preserves
  steps when rendering is slow. Water is the existing wet shoreline, not swimming.
- Distinct carbine, sidearm, Cobalt pulse, Solar lance and Singularity sounds.
  EnergyEffects emits presentation events only for accepted visual shots and
  actual impacts. Personal weapons pass their own sound identity. Server fire
  broadcasts use the authoritative weapon ID; local online ammo authorization
  remains disabled, preventing predicted duplicate shot sounds.
- Cutter motor/contact rasp, heat-dependent pitch, overheat cue and a short
  confirmed-collection chime. Continuous audio stops on mute, visibility/focus
  loss, menus, map, holstering and release. Nearby shots/impacts attenuate and pan.
- All effects are original procedural synthesis, cached after first use, with
  four variants and a 24-voice limit. No audio service or extra downloads.
  The Suno recordings remain the optional background score.

## Validation

- `npm test -- --test-concurrency=4`: all 68 configured test-file suites pass.
- Twelve explicit focused sound/music cases pass using `--test-isolation=none`.
  Covers surface boundaries, cadence at 5/30/60/120 Hz, jumping/pause/warp,
  moving cabins, finite non-clipping/distinct PCM, accepted/delayed shot events,
  mute/voice bounds, cutter shutdown, distance limits, disposal and music fades.
- Production build passes; inherited large-JavaScript-chunk warning remains.
- Connected Chrome sound studio: real AudioContext starts only on Enable,
  nonzero analyser output; sampled material and weapon buttons generate cached PCM
  and retire their voices. Cutter/contact produce sustained output, mute stops it.
- Fresh full-game Chrome check: opening gesture enables Blue Horizon with an
  advancing media clock and no failed tracks; actual backward navigation on the
  hangar deck emits a metal footstep. Real equipped carbine and sidearm fire and record their
  distinct sounds. The final check has no captured console warnings/errors.
- Initial dev test-control events targeted document and hit an existing
  element-only input handler; corrected to originate at the canvas. A temporary
  dev process terminated during an earlier run, causing music/model fetch errors;
  final preview runs as a persistent service, and fresh playback succeeds.

This is an initial synthesized sound-design pass. No recording-quality, full
surface traversal, physical-controller, remote-player listening or FPS claim.
Remote player footsteps are not added. Existing mining-panel cosmetic item buttons
are not wired by this change; keyboard 1/2/3 and actual loadout controls work.

## Try it

Game: http://127.0.0.1:5306/ — move after loading, or H → SOUND ON.
Sound studio: http://127.0.0.1:5306/tests/gameplay-audio.html
Persistent service: `star-agent-gameplay-audio.service`.
Dev diagnostics: `/?audioDebug`, including short walk/fire test inputs. These
controls and their status output are excluded from the production build.

The standalone main-branch music preview remains at http://127.0.0.1:5305/.

## Engine and muffled deck revision

Cees requested an audible engine and more muffled metallic steps. Added a
triangle turbine, upper harmonic and filtered exhaust, smoothed on the audio
clock. Actual shared simulation engine acceleration drives load for keyboard,
controller, automatic flight and braking; coasting speed alone cannot trigger
full thrust. Powered seated/flight modes idle; power loss, walking away, EVA
and crash silence the new layer. The existing Sound/visibility gate applies.

Metal footsteps now use a 12 ms attack, shorter low resonances, filtered low
noise and a lower peak (.44 versus .72), removing the bright deck ring.
Sound studio now includes engine idle/cruise/full-thrust/boost/off controls.

25 focused gameplay/engine/moon/hangar cases pass; production build passes.
Chrome verifies real nonzero engine output, rising thrust/boost parameters and
power-off/mute controls. No new control bindings or physical-controller test.

Final engine revision: all 68 configured test files pass; Chrome engine-off
settles to zero analyser output, metal plays successfully, and mute shows zero
output with no console warnings/errors.

## Ship flybys

Nearby rendered multiplayer ships now produce a stereo turbine/whoosh as their
position changes relative to the camera. Approach raises pitch, recession lowers
it, and distance rolls off the sound to silence by 400 m. Relative motion keeps
stationary and co-moving ships quiet. Four strongest passes share a bounded mixer;
spawn, large network/camera warps, frame gaps, disconnect, mute, focus loss, menus,
map and transit reset tracking or silence voices. Positions remain JS doubles.
The local player's ship is excluded by the existing remote-player collection.
This adds presentation to existing flight controls; no new bindings.

The studio includes left-to-right, right-to-left and distant 180 m/s passes.
Chrome produced nonzero flyby output (peak RMS approximately .020), returned to
zero after the pass, and showed muted/zero output with no captured console errors.
Nine focused gameplay-audio cases pass, including Doppler/pan/distance, formation
flight, warps, lifecycle and voice limits. Full `npm test -- --test-concurrency=4`
reports 511 passing cases; production build passes with the inherited chunk warning.
The real two-pilot listening journey and physical-controller testing remain untested.

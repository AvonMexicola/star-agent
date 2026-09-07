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

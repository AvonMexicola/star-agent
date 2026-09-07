# Fleet engine audio candidate

2026-09-07. Audio lane for SA-FX-001, based on `20e9f1b` in
`feat/fleet-engine-audio`. This record covers source/CPU verification; the parent
owns combined engine effects, actual browser playback and development integration.

The existing sound auto-start belonged only to the opening movement gesture, so
development starts which skipped that opening had no equivalent automatic route.
The procedural engine module also ran beside a legacy oscillator whose gain and
pitch followed speed/held boost. An inertially coasting ship could therefore sound
as if it were accelerating. Blur and several paused render paths suspended only
the gameplay/flyby channels. Finally, media activation errors were treated as
missing songs, potentially excluding both variants until reload.

The audio candidate adds:

- Original bounded Atlas, Kestrel and Nomad engine voices: low/slower Atlas,
  high/faster Kestrel, and middle Nomad. Actual normalized engine acceleration
  controls load; afterburner sound also requires forward demand. Powered cabins
  retain a quieter filtered engine bed. Walking outside, EVA, power loss and
  crashed/destroyed states silence that ship voice.
- `FlightAudio.unlock(state?)`, an idempotent gesture hook which caches the latest
  navigation state, starts/retries media during the gesture and preserves an
  explicit Sound-off choice. `setSuspended()` gates the whole mixer. Browser
  context interruptions stop all channels and can be retried without rebuilding
  oscillator graphs. State diagnostics expose requested/enabled, audible,
  context state, muted choice, selected hull and soundtrack state.
- The six existing local MP3s, scene thresholds and six-second fades remain.
  `NotAllowedError`/`AbortError` await another gesture instead of blacklisting
  tracks. Pauses retain media/fade positions; obsolete playback promises cannot
  clear or revive a later playback operation. Genuine asset failures retain the
  bounded alternate-track fallback. Station hum/door motors, atmospheric wind,
  footsteps, tools, ship weapons and creature effects remain separate channels.

Required parent hooks: spread `enginePresentation(nav)` into `audio.update()`
with raw `mode`, `shipId`, `active`, `powered`, `insideShip`, `cabinFlight`,
`throttle`, `forwardThrottle` and `boost`; add environmental/music telemetry as
before. Call `unlock()` on trusted keyboard/pointer/touch gestures and appropriate
fresh controller activity, excluding explicit Sound buttons from automatic
activation so one click cannot enable and immediately toggle off. Suspend on
hidden/focus/dialog/transit/graphics early-return paths. A controller injection
does not establish browser autoplay permission or physical-device acceptance.

Verification on 2026-09-07, completed at approximately 20:31 UTC:

- `node --test --test-isolation=none tests/gameplay-audio.test.js tests/music.test.js tests/ship-power-support.test.js tests/opening-support.test.js tests/moon.test.js`
  passes **51/51**. It covers PCM invariants, all hull profiles, coasting/boost,
  cabin/power state, graph reuse, synchronous gesture playback, explicit mute,
  context interruption, paused fade clocks, stale promises and missing/blocked
  media. The first expanded run passed 48 and failed three old audio fixtures:
  they omitted AudioContext `state` and asserted the legacy station oscillator as
  propulsion. With parent approval those blocks now supply `state: 'running'`,
  assert engine mix/load/power directly, and retain airless/wind/door expectations.
- `npm run build` passes (286 modules); the existing large-chunk warning remains.
- `npm run check:repo` and `git diff --check` pass.
- `npm run plan:checks -- --base origin/dev/all-features` was read, but its 860
  paths include unrelated integration work against the older remote base. The
  scoped rerun against `20e9f1b` identifies the audio lane. Neither plan is a test.

The parent `main.js` hookup was inspected read-only: cached raw engine state,
whole-mixer suspension, Sound-control exclusions, fresh controller activation and
diagnostic access match this API. No parent source, shared service or GPU job was
changed here. Browser listening, actual mixer sample output, controller journeys,
touch, integration and deployment remain parent-owned and are not established by
numerical tests or the build. No physical controller or audio-device test was run.

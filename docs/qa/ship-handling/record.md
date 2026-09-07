# Ship handling production record

Cees requests a nimble Kestrel, average Nomad and heavy Atlas while retaining
close top speeds. Work is isolated in feat/flight-options / PR38, preview5290,
based on efab725. No meshes, textures or physical boarding dimensions changed.
[Player/tuning guide](../../ship-handling.md).

The Nomad baseline is retained. Kestrel and Atlas speed multipliers are1.05/.95;
turn multipliers1.55/.42; assisted velocity response5.5/.85 versus Nomad3.5.
Atlas has0.22-second angular response on mouse, keyboard and controller. Inertial
thrust, RCS and angular acceleration vary by hull. Safety caps precede throttle
and remain unchanged. Emergency brake is still immediate; ordinary assist
release and inertial motion express the weight difference.

Failures and corrections:

1. Existing Atlas bank-direction checks expected more rotation than a heavy hull
   now produces after0.25s. Extended the actual held input to0.5s, retaining the
   signed bank and unchanged-nose assertions; new comparative handling tests
   separately check that Atlas rotation is substantially slower than Nomad.
2. Independent reviewer reproduced reduced Atlas mouse steering at low render
   frame rates: pending mouse input was consumed in the first physics substep.
   Main now calls beginFrame before subdivision, distributing the requested mouse
   rate over all substeps. Actual Navigation regressions compare15/30/60/120Hz.
3. The first browser fixture expected Menu to open the keyboard help dialog.
   It correctly opened the controller Command menu. Corrected the test selector;
   no application assertion was weakened. Both ships passed the preceding turn,
   acceleration and deceleration checks before that fixture failure.

Final full unit suite:485/485 passed. Production build passed, with the inherited
large-chunk warning. Seven new handling tests cover speed spread/safety caps,
assisted acceleration/stopping, inertial authority/coasting, matching keyboard and
controller axes, mouse limits/settling/menu/seat interruption and frame rates.
Runtime477dbc3 passes the actual controller-only handling journey2/2: load saved
Nomad/Atlas through supported orbital entry, yaw, accelerate, release to settle,
open/close Command menu, suppress held steering until neutral, resume and switch
to external camera. No debug ship swap or position change. At about0.6s yaw,
Nomad turns0.524rad and Atlas0.146rad. One second after releasing thrust, Nomad
retains2.9% speed and Atlas43.2%. These are short simulation behavior checks,
not a sustained FPS benchmark. Browser warnings/errors:zero.

Chromium151.0.7922.173, AMD Radeon860M via ANGLE/OpenGL ES3.2,1440×900.
[Nomad capture](nomad-controller-flight.png), [Atlas](atlas-controller-flight.png),
[Nomad measurements](nomad.json), [Atlas measurements](atlas.json).

Independent source review passes:34/34 targeted tests, no remaining source
blocker. The original mouse reproduction now produces0.63546885032549rad across
15/30/60/120FPS with agreement below1e-12; release behavior also agrees.
[Exact independent source review](source-review.md). Builder images are labeled
as builder evidence, not independent asset approval.

Logs remain at /tmp/star-agent-handling-{initial,unit,unit-final,build-final,
browser,browser-retry,policy}.log. Tests use injected standard Gamepad and saved
Fleet selections, not physical controller hardware. Kestrel remains a tested
profile pending its separate asset/Fleet integration, not a claimed playable ship.
No sustained-FPS or inherited whole-scene art approval is claimed.


Final opening/boarding regression:4/4 passed on477dbc3. Actual keyboard and
controller hangar reveal, physical boarding, launch/departure, default controller
intro/orbital entry and moving-origin floor view remain functional. Log:
/tmp/star-agent-handling-boarding.log. The handling browser2/2 and full485units
were run on the same source candidate. The independent source report was written
immediately before that candidate was committed; no runtime edits followed it.
Preview5290 responds200. Feature branch delivery only; no merge or production
deployment. Source ownership released for integration.

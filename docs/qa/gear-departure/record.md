# Landing gear departure and speed cues

Runtime3398dce on feat/flight-options / PR38, preview5290. User requests a physical
boarding/takeoff sequence, slow maneuvering with gear down, a discoverable retract
prompt, normal flight speeds after retraction, and a tunnel only for relativistic
travel. Existing Nomad/Atlas gear meshes are retained; no asset or collision-envelope
change. Kestrel uses the shared ship-ID handling policy when its separate asset
joins Fleet; this change does not integrate that asset.

Navigation now owns gear progress and supplies it to the renderer. The1.8-second
motion shares a clock with the speed policy, so higher speed is enabled only when
stowage completes. Gear down or in motion caps powered maneuvering at35m/s;
tighter floor/station/debris guards remain. Boost and inertial thrust cannot
bypass it. Redeployment from high speed brakes progressively; an unpowered hull
still coasts physically. Automatic surface descent now also caps at35m/s.
Orbital entry starts stowed; station opening, docking and landing use gear down.

The flight HUD says PRESS G or LB+RB + D-PAD down, then GEAR RETRACTING, and clears
when gear is up. Prompt uses existing palette tokens and updates its live-region
text only when the message changes. Holding forward thrust while retracting
allows the ship to build normal speed after the station proximity guard relaxes.
Both target-route and free-heading relativistic drive entry require stowed gear.

The speed-driven braided Slipstream is disabled. Ordinary spaceflight uses sparse
neutral dust aligned with velocity, including reverse/strafe, and honors reduced
motion. Dust is excluded near stations, in atmosphere and during the drive.
TravelEffects is the sole tunnel and requires an active travel state, including
spool/braking/cooldown; it hides immediately when drive travel ends.

Validation:

- Final495/495 unit tests pass; build passes with existing large-chunk warning.
- Extended actual opening/boarding journey4/4: keyboard and standard injected
  controller board physically, launch, fly out at limited speed, see the input-
  specific prompt, retract, stay limited during motion, then exceed80m/s after
  clearing the bay. Default intro and floor-view regressions pass too. This run
  preceded only the final surface-autoland cap and dust-count diagnostic; its
  actual departure path is unchanged by those two later edits.
- Final orbital controller journey1/1 on3398dce: ordinary flight exceeds900m/s
  with actual spaceDust particles and no tunnel; gear cycles fully, drive spools
  with tunnel, and exit hides it. Existing controller utilities, Graphics and
  held-input/focus/disconnect/replacement suppression also pass.
- Browser errors/warnings zero. Chromium151, AMD Radeon860M via ANGLE/OpenGL
  ES3.2,1440×900. Injected Gamepad, no physical-device or sustained-FPS claim.
- Independent source review38/38 passes after correcting surface autoland.
  [Exact source report](source-review.md) preserves the finding and its fix.

[Keyboard prompt](gear-down-keyboard.png), [controller prompt](gear-down-controller.png),
[departure after retraction](gear-up-departure.png),
[ordinary space dust](ordinary-space-dust.png), [drive tunnel](relativistic-tunnel.png).
These are builder captures. The independent visual review is recorded separately.

Failures/corrections: the first full run had3 fixture/behavior failures.
A utility test assumed orbital gear started down; it now explicitly deploys and
retracts. Descent and surface-to-space tests previously flew fast after automatic
gear deployment; they now retract before cruise/inertial descent. New tests cover
slow deployed behavior separately. Independent source review found the old800m/s
surface-autoland bypass; the branch now uses35m/s with a5km descent regression.
No asserted safety behavior was removed to pass these checks.

Raw logs: /tmp/star-agent-gear-flight-{initial,unit,unit-final,build-final,boarding,
orbital}.log. Review captures document the changed prompt/effects, not approval
of inherited ship/station/world art. No merge or production deployment.


Independent final review: **bounded PASS4.0/5**, all six criteria4, on3398dce.
[Exact report](final-review.md) retains the closed autoland finding,38 independent
tests and scope limits. Own keyboard/controller HUD captures fit desktop and
390px phone; the prompt is358×66px on phone with12px type and no overflow.
Settled ordinary3km/s flight has152dust particles and no tunnel; active drive
54.99Mm/s has a tunnel and no dust; exit has no tunnel. Both independent browser
runs report zero errors/warnings. The first effect screenshots caught preload/
HUD-lag transients and were recaptured; the report preserves those proceedings.

[Desktop prompt](independent-desktop-controller-gear-prompt.png),
[phone controller](independent-phone-controller-gear-prompt.png),
[phone keyboard](independent-phone-keyboard-gear-prompt.png),
[ordinary dust](independent-desktop-ordinary-space-dust.png),
[active drive](independent-desktop-relativistic-drive-tunnel.png),
[drive exit](independent-desktop-drive-exit-no-tunnel.png),
[settled metadata](independent-metadata.json). Inherited orbit draw budgets
remain outside approval. No whole-scene performance or asset-quality claim.

Per current HANDOFF, PR38 targets main with consolidated baseline PR34 as a
prerequisite. Only the feature branch is pushed; production remains unchanged.

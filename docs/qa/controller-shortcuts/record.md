# Controller utility shortcuts

Requested by Cees after flight options: direct controller access to the new
functions. Runtime77e8578 on feat/flight-options / PR38, based on the previous
d44ed8b delivery. Worktree /tmp/star-agent-flight-options, preview5290.

Hold LB+RB (L1+R1), then D-pad up toggles heading drive, down toggles landing gear,
left toggles contextual lights, right toggles camera, and Menu/Options opens
Graphics. Existing eligibility checks and command-menu actions remain authoritative.
The gameplay HUD switches to the chord legend while held; the command menu and
help list mappings. Controller travel shows B to disengage; the chord also works.

The modifier remains latched until both shoulders release so release order cannot
cause stray roll. Consumed D-pad holds stay suppressed until released, avoiding
throttle, map, equipment or quick-item leakage. Normal mappings return after
release. Existing neutral-input gates cover focus, dialogs, disconnect and device
replacement. An unarmed Graphics chord cannot fall through to ordinary Menu.

Validation:

- npm test:471/471 passed, including all5 mappings, one-shot toggles, shoulder and
  D-pad release ordering, ordinary roll/map/throttle restoration, interruption
  gating and unarmed Graphics suppression.
- Production build passes; existing large-chunk build warning remains.
- Controller-only orbital browser journey:1/1. Real right-stick steering, gear,
  lights, external camera, free drive spool/disengage through the same chord,
  Graphics values, no map/throttle leakage, held shortcuts across focus,
  disconnect, replacement and Graphics closure, and neutral recovery.
- Opening/boarding suite:4/4. Actual keyboard and controller boarding/launch;
  on-foot rifle selection/fire, camera chord, flashlight chord without weapon
  cycling; default intro/orbital boot and floor-view regression.
- DOM controller router:1/1 after fixing its input timing. Its80ms button taps
  missed the initial Menu edge in two runs; the first also overlapped a Vite
  main.js reload. Holding each state for3 rendered input frames passed in6.8s
  on the same runtime. The source fix is in the test helper, not a weakened
  application assertion. This fixture is not substituted for the real journeys.

Logs: /tmp/star-agent-utility-hotkeys-{unit,build,browser,boarding}.log and
/tmp/star-agent-utility-hotkeys-router-{retry,frames}.log. Actual-game browser
checks use Chromium151 and hardware AMD Radeon860M ANGLE/OpenGL ES3.2;1440×900.
No FPS claim or physical controller hardware testing. Shader/ship/world assets
are unchanged in this follow-up. Independent source assertions passed; bounded
HUD/help desktop and phone visual review is pending.

[Builder HUD capture](hud-builder.png). Production is unchanged; no merge or
public deployment is claimed. Keyboard controls remain as in flight options.


Independent first visual review scored3.83/5: mappings/help fit, but the modifier
legend's inherited7–8px muted text was hard to read against clouds and cockpit
screens. Exact report: [first-review.md](first-review.md). The correction adds a
scoped panel using the existing opaque dialog color token, inherited text color,
11px desktop /12px phone type, and wrapping. It only styles the held-modifier
legend. The production build passes; final browser re-review follows.

# Touch look capture correction

The real Stratum touch01 journey on `9610187` / build10 stopped while looking
between cockpit displays. Its original2.2minute failure, input samples, screenshots
and video remain at `/home/cees/projects/.medium-ships-qa/stratum-primary-touch-01`.
The first display was reached; the second target's yaw/pitch error then remained
unchanged despite repeated trusted touch gestures. No page diagnostics appeared.

A separate unchanged-game probe reproduced the cause: a6px touch drag generated
a trusted viewport click with `pointerType: touch` and `firesTouchEvents: true`.
The generic capture handler requested mouse pointer lock, and the existing
canvas drag guard correctly refused further touch input while locked. Original
receipt/video: `/tmp/star-agent-stratum-touch-look-01`; runner exit0 and result
`REPRODUCED`. This is an application bug, not a browser-startup failure.

The handler now enters the player interface without requesting mouse lock for
touch-origin clicks. Help's Fly button forwards its actual click event, and MFD
picking safely rejects absent/nonfinite screen coordinates. Actual display
actions, ordinary mouse clicks and intentional keyboard capture remain intact.
The Stratum fixture now records touch moves, clicks and lock transitions and
rejects an unwanted lock immediately instead of waiting through a full aim loop.

The corrected actual-game probe passes on build11 `main-Bl7F_107.js`: the same
trusted6px compatibility click remains unlocked, the next80px drag changes the
actual navigation orientation, and a subsequent trusted mouse click locks the
viewport normally. Page errors are empty. Main source SHA256 is
`6afa49e2125ce58a7545979b2df97bc6957ce8c1d269e5ec665ef4d68c0362dc`.
Originals and finalized video are in `/tmp/star-agent-stratum-touch-look-02`,
with log `/tmp/star-agent-stratum-touch-look-02.log`. The native run uses
Chromium151 / ANGLE OpenGL on AMD Radeon860M,390×844, DPR1, native CDP touch
contacts followed by a native Playwright mouse click; no debug pose writes.

The independently prepared permanent regression executes the actual main
entry, capture, drag and MFD closures, Navigation.capture, and a genuine Three
raycast against a test display. All13 grouped CPU cases pass in the root checkout
(102.4ms), including Begin, Kestrel launch, Help, legacy touch provenance, mouse,
keyboard, unavailable states and a short-click-then-large-drag sequence. The
original source fails nine of those cases. These event-shaped CPU objects are
separate from the native browser evidence. Exact test SHA256:
`efc109eb50954fcc695d6be69f8cdb17e1bc55051a317bdee7519dcf4eda244c`.
The source-preserving probe/archive/negative logs remain under
`/tmp/star-agent-touch-capture-review`.

Sixty focused navigation/mining/rover/medium checks also pass in3.969seconds,
and build11 passes4.98seconds. The follow-up medium phone layout puts flight
status above the inspected displays and actual actions at the bottom. Landed
MFD inspection follows the rendered optical tilt through real touch input;
flight aim still follows the ship bore. Full touch gameplay and final phone
layout review remain separate pending checks. No FPS, physical-device,
multiplayer or deployment acceptance is inferred from this correction.

# Fullscreen resolution

Runtime candidate `7713a3c`, feat/flight-options / PR38, production preview
http://localhost:5290. Requested by Cees: raise rendering resolution in fullscreen.

Automatic restarts at full scale when entering/leaving fullscreen, when display
pixel density changes, or after cumulative viewport area growth above20%.
Fullscreen uses display pixel density up to2 (windowed cap1.25), and Automatic
can reduce scale only as far as80% in fullscreen (55% windowed). Stable gameplay
at50fps or above gradually restores quality in10-point steps. Explicit60/80/100%
Graphics choices stay fixed through fullscreen transitions. Higher density costs
GPU time; no FPS improvement or universal performance claim is made.

Use browser fullscreen (F11 on desktop browsers) with Graphics resolution set to
Automatic. Fullscreen API changes are handled too. F11 recognition uses a
screen-filling content/window geometry heuristic, not a keyboard binding.
There is no new fullscreen gesture or controller action. Existing controller
Graphics access remains available through LB+RB plus Menu/Options.

Validation on the final runtime:

- `npm test`:478/478 passed, including7 pure resolution tests for fullscreen,
  fixed choices, density limits, cumulative resizing, recovery and inactive frames.
- `npm run build`:passed, with the existing large-chunk warning.
- `npm run test:browser -- -c scripts/fullscreen-resolution.config.js`:1/1 passed.
  Actual trusted-click Fullscreen API entry/exit, renderer buffer dimensions,
  real Graphics60% selection and preservation through entry/exit are checked.
- Chromium151.0.7922.173, AMD Radeon860M via ANGLE/OpenGL ES3.2. Test viewport
  1000×650, emulated device density2 and screen1600×900. The buffer increases
  from1250×812 windowed to2000×1300 fullscreen; manual60% gives1200×780.
  Zero browser errors/warnings. This is not a physical F11 or gamepad test.

[Windowed](windowed.png), [fullscreen](fullscreen.png),
[restored](windowed-restored.png), [manual60%](fullscreen-manual.png),
[measured metadata](metadata.json). The temporary entry button is browser-test
instrumentation, not shipped UI. Screenshots show the actual game renderer;
headless Fullscreen API entry preserves this test's CSS viewport dimensions.

Failures and corrections retained:

1. Independent source review found incremental resizing could evade a reset.
   Track cumulative growth from the quality baseline; regression test added.
2. Review found a global FPS interval could include cheap menu/preload frames.
   Measure only uninterrupted eligible gameplay frames; reset across map,
   visibility, modal and focus interruptions. Regression test added.
3. First browser fixture put `screen` outside Playwright contextOptions. The
   resulting screen matched the window, triggering the F11 geometry detector.
   Correcting the emulated screen fixture passed the original assertions.

Raw logs remain in /tmp/star-agent-fullscreen-{unit-final,build,browser,
browser-retry,policy}.log. No generated test report or build output is committed.
Independent final review passes the bounded resolution behavior and appearance
scope on runtime7713a3c. Both source findings are resolved. At1440×900 CSS and
DPR2, the actual windowed buffer1800×1125 increases to2880×1800 fullscreen and
restores on exit. Manual60% follows1080×675 →1728×1080 →1080×675. All six
captures match policy; no browser errors/warnings. Applicable integration,
cohesion, function and motion criteria score4/5; unchanged asset criteria are N/A.
[Exact report](final-review.md), [independent windowed](independent-windowed-auto.png),
[fullscreen](independent-fullscreen-auto.png),
[manual60%](independent-fullscreen-manual-60.png),
[metadata](independent-metadata.json). This scoped resolution change
is not certification of inherited scene materials or whole-game performance.
Production remains unchanged pending integration.

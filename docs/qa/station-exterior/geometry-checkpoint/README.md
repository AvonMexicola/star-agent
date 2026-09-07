# Final geometry checkpoint, before shared-build integration

Author captures from actual Chromium production rendering on 2026-09-07.
Hero SHA `5b39b183030d529a710de0b2dad308a36a8e597b067d3061d82f01bb721b76e6`;
distant SHA `ec98e225e57bbadb18c4c4567614bab2c5a23694e16effeeba99a4ce0b5ffdcb`.
Base `8576e99` plus the station exterior changes. This is an unfinished,
explicitly enabled development geometry preview, not final art approval.

`npm run test:browser -- -c scripts/station-exterior.config.js` passed both
cases in 3.8 minutes (59.8 s capture case, 2.7 min input case). All seven
inspection views assert the actual camera and hidden player ship. The input
case enters through the existing local launcher using an injected standard
Gamepad, opens/closes the controller menu, verifies held-direction suppression,
and taps the actual launcher link in a separate 390×844 touch context. No physical
controller was tested. Both cases recorded zero browser errors or warnings.

[Scene identity and counts](evidence.json) include browser, GPU/backend and
resolution; they establish no frame-time result. The two playable screenshots
retain cockpit/HUD UI, including the phone start toast. The other seven images
are deliberate fixed camera inspections, not evidence of a complete physical
boarding/departure journey. The runner log remains local at
`/tmp/station-exterior-final-01.log`; no generated test report is committed.

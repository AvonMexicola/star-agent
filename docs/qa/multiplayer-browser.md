# Multiplayer browser QA

Validated on 2026-09-07 against the production application path with the multiplayer server and Vite proxy isolated on `127.0.0.1:8086` and `127.0.0.1:5301`. The checked-in default proxy remains `127.0.0.1:8084`.

Command:

```text
npm run test:browser -- -c scripts/multiplayer.config.js
```

Result: 1 test passed in 1.5 minutes. Chromium 151.0.7922.173 reported `ANGLE (AMD, AMD Radeon 860M Graphics (radeonsi krackan1 ACO), OpenGL ES 3.2)`. The run collected no page or console errors.

The test created two accounts through the desktop registration form and joined both pilots to the same authoritative room. The first pilot joined with an injected W3C standard gamepad, opened COMMS through the controller command menu, requested Hangar 01, received the landing marker and open door, transferred a rifle from pack to ship, and returned to play. The system map retained the selected Pyre target while correctly disabling engagement because the ship was still at the station with landing gear down.

The first pilot then used sustained controller flight input to cross the approach physically until the station reported docking available, pressed Y to dock, and reached the server-authoritative `landed` and `dockedAtStation` state. No test teleport or direct position mutation was used. From the docked state, the controller inventory route transferred one ration from ship to station. Inventory revisions advanced from 0 to 1 and then 2. The final room state reported Hangar 01 occupied and its door fully open. A second pilot's keyboard flight input produced movement observed through the first pilot's authoritative roster snapshot.

Evidence:

- [Desktop two-pilot COMMS](multiplayer/desktop-two-pilot-comms.png) — 1440 × 900, DPR 1.
- [Phone signed-in account](multiplayer/phone-account.png) — 390 × 844.

The controller route used an injected standard-gamepad interface; a physical Xbox controller was not connected for this run. Desktop registration used browser form controls and pointer input. The on-screen controller keyboard was present but was not used for an end-to-end account registration. The rendered cockpit MFD exposes and routes its pointer action to COMMS, but a direct click or touch on that 3D screen was not exercised here; controller-menu COMMS was exercised. Password-reset email delivery was not tested because this local memory-server run had no mail transport. The test used `?intro=0` to keep the multiplayer journey bounded, so it did not exercise joining during the opening cinematic. No frame-rate claim is made.

After the browser run, root added a focused recovery regression: a destroyed own
ship exposes Respawn even if suit health remains positive; another pilot's wreck
and an incomplete health snapshot do not. This visibility condition was checked
in the UI unit suite. The healthy-pilot docking journey is unchanged.

## Public preview verification

The isolated preview is live at
https://multiplayer.staragent.site/?intro=0&seed=7291. The production bundle was
opened in Chromium151 at1440×900: seed7291, station ready, ship asset ready, and
zero page/console errors. See [public account screen](multiplayer/public-account.png).
A separate public HTTPS probe created a synthetic account, received its secure
session cookie, joined over authenticated WSS and requested a hangar. The probe
closed its socket and deleted only its own fixture account afterward.

Final validation: existing suite496/496; multiplayer suite80/80 on server Node22
with real PostgreSQL (no skips); final focused UI/effects checks23/23. Production
build passes with the existing large-chunk size warning. The latest source also
blocks offline ship-mounted weapon effects in shared play, while retaining shared
shot effects and normal flight particles. Ship-mounted combat is a follow-up.

The public service uses its own database and hostname. The production play/next
sites remain separate. SMTP delivery, physical controller hardware, a full
controller-entered registration and the Opus visual/whole-scene quality review
remain unverified; this is a review preview, not a main-branch acceptance claim.

# Hostile fauna integration record

Development candidate on `feat/pyrebear`; local integration, Suloher controller
journey and final visual acceptance remain pending. The complete Pyrebear route
has passed against a frozen production build. This record is updated as
checks finish; the asset receipt is in [pyrebear-asset.md](pyrebear-asset.md).

## Behavior and authority

Pyrebear inhabits dry Pyre terminator basalt plains; Suloher dog inhabits Miasma
sulphur uplands outside mineral basins. Versioned deterministic shell cells sample
canonical terrain and reject steep slopes. Six candidates per species query,
eight actors globally, 500 m activation and 600 m unload bounds. Runtime uses
metre-scale local transforms after subtracting double-precision world positions.

Offline session wildlife owns 240 HP Pyrebears and 90 HP dogs. Existing carbine
shots apply 30 damage, sidearm shots 18, only after the equipped ammo transaction
succeeds. Camera and actual muzzle rays select the nearest terrain, building,
parked hull, mining rock or living torso. Aiming and the mining cutter do not
apply damage. A defeated spawn ID remains dead for this session; injuries and
kills are not a multiplayer protocol or cross-reload creature save.

Bites have a 0.6 s warning and a 1.8 s recovery. They recheck reach, elevation and
line of sight at impact and persist through the existing suit-health transaction.
Pyrebear deals 14, Suloher 8. Cabins, menus, focus loss and online play suppress
attacks. Downing locks movement and offers explicit controller-accessible emergency
evacuation to Aeon orbit, retaining inventory; storage failure leaves the player
safely downed for retry. Quick-slot medical items use the existing loadout rules.

## Checks and fixes

- Initial full unit run: **726 passed**, zero failed/skipped. Includes terrain,
  deterministic habitats, combat timing, escape, collision callbacks, wounds,
  death persistence, ammo obstruction and medical transactional failure cases.
- Production build passed. Existing large-chunk warning remains.
- Repository check passed. Contributor test-plan helper and branch inventory run;
  plan includes unrelated changes already in local dev relative to remote dev.
- Open PR inspection found no competing creature implementation. Audio lane
  SA-AUD-002 separately supplies species attack synthesis in local dev.
- Independent integration review caught slope-normal versus radial dev transit,
  clone skeleton texture disposal, gait-speed mismatch, unobstructed HUD ray,
  high-altitude unloading and failed-load cleanup. These are corrected; rerun
  and final reviewer confirmation are pending.
- First Chromium attempt reached a renderer crash during navigation, PID2788072,
  SIGTRAP at18:20:33CEST, and Playwright reported write errno-122. Unlike the
  previously diagnosed Crashpad startup crash, this had a renderer process and
  many threads. Unsymbolized core info does not prove its precise assertion.
  No OOM-kill entry was found; free memory was1.8GiB with33GiB swap free.
  `/tmp` filesystem had3.1GiB free, but the quota error remains direct evidence
  of a failed test write. No global cleanup or system change was made.
- Moving only this test's temporary storage to the project drive allowed the
  browser to reach game/asset loading. The second attempt was invalidated by
  Vite live reload during root edits. QA now uses a frozen production build.

## Reproduction

With local development tools enabled, use the existing Test starts menu:
Nomad → Pyre · Pyrebear habitat or Miasma · Suloher habitat. These start a ship35m
above an actual habitat site; Y/B lands, X/F leaves the pilot seat. Walk to the
rear hatch, X/F opens it, then physically walk down the ramp. D-pad left cycles
weapons, right selects the cutter, RT fires; keyboard1/2 selects guns and T fires.
Creature health appears when aimed at; move away during the attack warning.

The browser fixture uses an injected standard Gamepad, never a physical-controller
claim. It must traverse landing, cabin, hatch, ramp, terrain approach, right-stick
aim, firing, death and return-to-play input suppression. Screenshots and raw
browser records belong in ignored `test-results/fauna-evidence`, not Git.

## Checkpoint update

Pyrebear controller-only browser route passed in1.8m: physical landing, pilot exit,
hatch, ramp, terrain approach, right-stick aim, eight ammo-authorized carbine
shots, one held death and Menu/held-RT suppression. Chromium151.0.7922.173,
AMD Radeon860M / ANGLE GLES3.2,1280×800; no page/console/shader errors. Screenshots
are captured at40m and prove behavior, not close art acceptance. That run used
the initial corpse export; corrected clips require their separate final capture.

The corrected authoring exports are bear `30afc5a9459538fbab2954a38369f42df25ecfde032d7b819f60bf1e1f8639e6`
and dog `413335683e7f35484637622a4ae203613014f328f46dc7f32eda9071c5ef0f87`.
Scoped independent pose review is4/5, with dense measured skin intersections
25.65mm/12.60mm under an explicit30mm authoring tolerance. These are authored
collapses, not physics ragdolls. Whole-scene visual acceptance remains pending.

Post-review HUD targeting is throttled to10Hz; shot/impact obstruction remains
fresh. HUD moved above the equipment bar after a real screenshot exposed overlap.
The optional onAttack sound hook now connects to SA-AUD-002's committed synthesis
modules; its real simulation-to-mixer checks pass for both species, including
pause/death suppression. The updated build and focused tests pass.

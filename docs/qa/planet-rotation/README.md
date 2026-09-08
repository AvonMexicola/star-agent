# Planetary rotation — development evidence

SA-WORLD-004, isolated `.worktrees/planet-rotation`, `feat/planet-rotation` from
`f1ef821`. Implementation is present; final combined validation and integration
are in progress. No independent acceptance, physical-device test or deployment
is claimed. [Decision](../../decisions/planet-rotation.md).

## Checks and limits

- Eight numerical invariants cover disjoint domains, terrain/save anchors through
  a day on all worlds, double precision, moving arrivals with/without spool,
  frame position/attitude/momentum, inertial flight and render-root boundaries.
- Five authoritative regressions cover cross-frame hitscan, continuous swept hull
  contact, polar reconciliation, protected station rams and parked-hull EVA access.
- Freight authority and isolated PostgreSQL persistence pass at a deterministic
  clear departure phase. Real wall-clock phases can correctly block the direct
  line through a planet; this fixture does not certify a physical freight journey.
- Focused rotation/ship-mining tests pass 41 cases; broad final runs are pending.

The first production orbital inspection passed all four worlds in 57 seconds,
with eight PNGs and no application errors. Chromium 151.0.7922.173, ANGLE OpenGL,
AMD Radeon 860M (radeonsi, krackan1, ACO), 1440x900 at scale1. Orbital poses were
explicit debug fixtures. Images show moving geography and stable inertial sky;
LOD streaming was still settling, so this is not performance or maximum-LOD
acceptance. Final-source orbital/controller/shared-clock evidence follows.

## Failure ledger

| Attempt | Actual result and correction |
| --- | --- |
| Initial frame tests | Eight-radius overlap assumption failed; disjoint three-radius domains introduced. |
| Initial repository check | Invalid task status/area corrected to active/flight. |
| Normal suite01 | 1182 pass / 18 failures (including parent cases): borrowed Navigation.update fixtures lacked updateLocal; wrapper now calls the prototype method. Focused 28-case mining regression then passed. |
| Multiplayer01 | 198 pass / 1 failure / 2 existing opt-in skips. Freight fixture aimed at the old fixed bearing. Updated to observed bearing, inertial plan comparison and fixed clear phase; original logs retained. |
| Browser01 | Four-world orbital renderer check passed; no controller claim. |
| Browser02 | Landing, hatch, ground/day-night and inventory reached; final seat wait stopped outside actual chair reach. Interrupted after trace diagnosis; fixture now waits for the actual seat interaction. Day/night contact checks and PNGs passed. |
| Browser03 | Cancelled during build to honor another queued GPU job; no browser acceptance. Playwright reused the output directory, so the earlier02 trace may have been erased. Surviving logs/PNGs are the retained evidence, not an asserted archived trace. Subsequent attempts use unique directories. |

Raw local receipts are ignored under `test-results/planet-rotation/`. Only curated
final PNGs and this handoff belong in Git. No public recordings or test accounts
are retained. Physical-controller testing, independent domain/art review and
release performance acceptance remain separate from injected controller checks.

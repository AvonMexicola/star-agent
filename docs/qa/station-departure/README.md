# Station departure correction — 2026-09-06

L now lifts the ship one metre from its docked height (Nomad pilot eye 3.55 m,
Atlas 6.55 m above the deck). The final step is capped at the target even during
long frames. Launch requests the hangar doors open. If swept station contact
interrupts the lift, it cancels the assist and returns manual flight control;
previously the lift kept retrying upward and ignored translation indefinitely.
Automatic deck capture now requires a gentle arrival at the ship’s parked eye
height; a shallow nose-down correction cannot re-dock the departing Nomad at
the planetary clearance threshold. The shared approach policy now permits 20 m/s in the bay, up from 6 m/s, and
progressively releases the restriction farther from the station. Swept hull
collision and the existing approach restriction outside the bay remain active.

The original nominal, level departures did not collide in the checked geometry.
The stuck-lift path was reproduced with a low obstruction above the docked hull;
this establishes the control bug without claiming every reported exit failure
was a roof strike.

Validation:

- `npm test`: 458 passed. Includes both ship layouts launching without overshoot,
  reaching 20 m/s and clearing the doorway without contact; all 20 tilted berths
  clear both full hull envelopes; an interrupted lift releases forward movement.
- `npm run build`: passed, with the existing loader chunk-size advisory.
- `npm run test:browser -- -c scripts/main-integration.config.js scripts/opening.spec.js --grep 'physical boarding and launch'`:
  2 passed. Each walks from the cinematic through the Nomad rear hatch to the
  pilot seat, launches, reaches >19 m/s and clears local z=-100 m while holding
  the new lift height. One journey uses keyboard, the other standard Gamepad API
  inputs exclusively. No page or browser console errors.
- Attached screenshots were captured by those production-browser journeys:
  Chromium, ANGLE OpenGL configuration, 1440×900 viewport and 0.55 render scale.
  No FPS or new art-quality claim is made from these functional captures.

Test at http://localhost:5280 after refreshing. This patch is part of draft PR34;
production is unchanged and the PM's separate visual blockers remain open.

Review response: the initial independent review is retained here. Its recapture
finding is fixed by the slow parked-height capture and a shallow-descent regression
test. The Atlas fixture now instantiates FreighterSystems, and the controller
journey was rerun with the correct B brake (button 1). The final keyboard and
controller departure screenshots are separate; intermediate historical /tmp
opening screenshots are not used as retained per-input evidence. Explicit door
opening is a redundant request alongside proximity automation; swept door
collision remains the authority and the request is not a promise of instant doors.

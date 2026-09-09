# SA-GARAGE-002 — civilian garage vehicle choice

Cees requests a Burrow or Burrow Sentry choice at non-pirate compound garages,
integration of completed updates into development, and publication to both play
and multiplayer. This authorization includes the existing release targets.

Worktree `.worktrees/compound-vehicle-choice`, branch `feat/compound-vehicle-choice`,
base `3ea6b07d50d7a0e91acaf3c5047b5d56d06aadba`. Private browser5688/API8688.
Release composition is separate in `.worktrees/compounds-release`.

Reuse the four existing civilian garages and shared native dialog/controller
router. Select either original mining Burrow or the completed two-seat laser
Sentry, deploy into the clear bay, board physically, drive down the authored kit
ramp, use the actual inventory and return. The pirate compounds get no vehicle
service. Retrieval preserves the existing vehicle's cargo, charge and condition;
it cannot move occupants or repair damage. Recheck reach and bay clearance after
model loading, reject moving/carried/busy vehicles, and suppress held inputs.

Sentry tyres must query the same construction supports as Burrow. Canonical
planet frames, terrain, assets and the authoritative Sentry protocol remain
intact. No new dependencies, models or generated art. Current compound garage
service scope is solo; connected multiplayer authority is a distinct extension.
Both public builds must retain their existing entry and persistence contracts.

Validation: four-world wheel/support/ramp and rejection invariants; actual
controller landing/walking/selection/boarding/drive/aim/inventory/return;
keyboard/native390 retrieval; neutral gating across modal/focus/device changes;
production render and diagnostics, full source/server tests and paired public
health/release/WS checks. Physical controllers and independent art/performance
acceptance remain separate. Publish only committed, checked updates; do not copy
unfinished work from another owner.

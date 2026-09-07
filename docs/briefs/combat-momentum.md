# Combat momentum repair

User scope: correct moving on-foot muzzle effects; default six-axis fly-by-wire with finite drift correction and braking; unlocked inertial manoeuvres; combat speed weapon interlock. Every hull retains momentum, with Atlas slowest to recover. No new assets or dependencies.

Ownership: fix/combat-momentum, isolated checkout, browser preview port 5398. Claims: flight-model, navigation, ship-handling, combat, energy/flight effects, mining/tool, main input/HUD hooks, help and relevant tests. Base dev/all-features 73e90bc. Integrated base was refreshed to 931ea10; preserve the completed fitted gun and RT/menu integrations. Navigation-targets owns separate map/drive hooks; coordinate shared navigation/main integration. Existing asset work remains untouched.

Fly-by-wire retains hover/aero compensation as a separate reserve, bounds commanded velocity correction in ship axes by thrust/RCS, and stabilizes rotation. Unlocked mode keeps force integration and rotation. Speed changes brake rather than clamp momentum; contact/crash and explicit transit retain their contracts. Landing automation requires speed below 10 m/s. Combat speed selection is independent of assist selection.

Validation and integration are recorded in the final QA and handoff.

Final runtime is 6f8b195. The combined integration steward SA-INT-002 has incorporated this runtime in its candidate. Shared main wiring is released; the final patrol and evidence are complete. Runtime ownership is released to the integration steward. No further gameplay source changes are planned.

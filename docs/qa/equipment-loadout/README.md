# Equipment loadout — production verification, 2026-09-06

Final preview: http://127.0.0.1:5271/ — `index-B3rNxrVo.js`.
Branch `feat/equipment-loadout`, stacked on expedition `c3ef10c` / PR24.

- All 30 numerical files pass (`npm test`). Eight new loadout cases cover one-time
  migration, exact item conservation, full-container and save-quota rollback,
  compatible finite ammo, atomic medical effects, backpack removal/capacity,
  malformed saves and late model loading/denied-fire behavior. Targeted loadout
  and Equipment checks passed again after the final model/hotbar corrections.
- Final production browser run: **four cases pass in 4.1 minutes** on dedicated
  port4271: storage transfers/reload, medical + equipment UI/mobile, complete
  controller equipment/Selene journey, and physical EVA asteroid mining.
- The separate mining-particle pointer/touch/controller-interruption regression
  passed (58.1 seconds) on the preceding build. Later changes only corrected the
  equipment tab/heading, gun HUD/heat visibility and sidearm presentation.

The full controller journey swaps the two weapons, moves bandages into Quick3,
stows/re-equips ammo, rejects wasting a full-health bandage, then uses the actual
command menu, landing, chair/hatch interaction, walking, stick aiming and RT to
mine. It subsequently fires both equipped guns, checks one ammo charge per shot
and unchanged rock revision, suppresses held RT across inventory closure, tests
D-pad quick selection/use, re-equips the cutter and inspects the actual backpack.
Only standard Gamepad injection changes gameplay; debug state is read for steering.
A dialog scroll reset is used solely to frame its screenshot.

Medical success uses a clearly identified injured-save fixture (45 health and
bleeding), then real UI actions reach60 with a bandage and100 with a stim. No
natural environmental/combat injury source is claimed. Mouse and actual CDP touch
manage slots; saves restore selected hand slot, counts and health. Space test uses
real walking/EVA inputs plus a debug aiming seam; storage test seeds minerals and
uses location fixtures. The mining-input regression covers mouse/touch firing,
menu and focus/reconnect held-trigger suppression, and empty-space effects.

Final screenshots were inspected for all10 slots on desktop, narrow-screen
scrolling without horizontal overflow, selected/focused states, the held sidearm
and carbine, visible firing, correct Fire hint and hidden mining heat on guns.

Initial findings and correction: the first container test found two buttons
named Backpack (new tab and old location selector). The new tab is now Storage;
the unchanged test passes. Captures also exposed a cached Mine hint and CSS
keeping gun heat visible; both are fixed and asserted in the controller journey.
An earlier mixed run ended with SIGTERM before its space-test outcome; no pass
was inferred. The final dedicated-port run completed normally.

Chromium151.0.7922.173, ANGLE Vulkan SwiftShader, desktop1440x900/mobile390x844.
Adaptive scaling for full gameplay; see individual JSON for fixture details.
No physical Xbox test or hardware FPS claim. Browser origin/port scopes saves.

## Starter laser rifle and particle integration follow-up

The rifle now uses PR27's (`d9f4d7c`) immediate solar laser beam, core, muzzle
particles and impact bursts. The sidearm uses crimson pulses. Starter equipment
remains a rifle, mining tool and 60 compatible rifle charges, plus the existing
sidearm, backpack and medical kit. Saved IDs/counts are preserved.

All 30 numerical files pass again, including the particle agent's laser,
singularity and slipstream invariants. The final production browser run passes
both the complete controller loadout journey (3.6 minutes) and mining input/
interruption regression (1.4 minutes), 5.2 minutes total, with zero page/console
errors. The controller route now asserts the fresh starter kit, laser profile
and active beam, immediate impacts, exact rifle ammo consumption, unchanged rock
revision, and beam retirement in menus. Six measured rifle shots consume six
charges and produce six impacts. Mining still supports pointer/touch and held
controller suppression across menus, focus and disconnect/reconnect.

Updated desktop loadout, rifle, sidearm and controller JSON evidence comes from
this build. The rifle capture shows its beam from the held muzzle to the rock,
bright core and orange bursts; the sidearm shows crimson contact particles.
The updated mining regression JSON and inspected mining capture confirm the green
cutter beam and committed ore feedback. Previous medical/mobile/storage/EVA
evidence above belongs to the initial equipment build and is not a claim those
unmodified journeys were repeated for this effects-only follow-up. Same Chromium
151 / ANGLE Vulkan SwiftShader environment; no physical Xbox or FPS claim.

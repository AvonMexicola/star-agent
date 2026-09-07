# Aeon Tideback and Mallow wildlife

Development source candidate on feat/pyrebear. User requested the latest
amphibious GLB on Aeon beaches, then a large friendly grazer. The exported models and physical
controller encounters now pass browser checks. This is a scoped development
checkpoint, not full visual acceptance or shared-preview integration. The original deer remains a
separate asset-only repair.

## Behavior and habitat

Tideback (aeon-amphibian) uses canonical low COASTLAND at0.5–8m above mean sea
level, all dry samples and at most12degrees slope. Aeon has no separate BEACH
biome; this elevation subset is a low-shore proxy, not a measured horizontal
water-distance test. It patrols at0.45m/s, has120HP, and only retaliates after a
real successful shot. It warns for0.8s, approaches at1.8m/s and attacks for6.
Unloading retains injuries and provocation within the session.

Mallow grazer (aeon-grazer) occupies canonical GRASSLAND at100–1800m, dry gentle
slopes. It has360HP and patrols at0.55m/s. It never attacks, even after injury;
nonfatal shots trigger a four-second retreat at2m/s before returning to its
local territory. Streaming preserves its injury but never turns it hostile.

Both use stable120m shell-lattice population cells, terrain seed separate from
population seed, body-sized footing and broad spawn clearance. Tideback density
is0.14/cell, at most6candidates; grazer0.08/cell, at most4. Candidates from both
habitats share one global8-actor limit,500m activation/600m unload distance,
and nearest-first additions. Existing nearby actors retain identity; this is
not a guarantee that every currently retained actor is among the closest eight.
Only populated habitats request models; actors are created after their export
and manifest load, so an invisible loading animal cannot attack.

Canonically sampled movement, double-precision camera-origin subtraction,
private skeleton/mixer disposal and shared assets follow the existing fauna
pipeline. Held/charged gunfire uses actual loadout ammunition. Online wildlife
is disabled; there is no server NPC protocol, saved creature population, loot,
swimming, wave collision, pet system or full rigid-body animal collision in this
pass. Player-facing status identifies calm Tidebacks and peaceful grazers.

## Authoring and validation

Tideback is a compact teal plated shell with paddle/claw feet, normalized to
0.80m shell crown. Mallow retains the supplied lavender/cream barrel body and
friendly face at2.0m dorsal shoulder. Exact source/runtime identities and failed
animation iterations belong in each asset record. No generation credits or new
hosted service were used.

The final full npm test invocation passes 748 individual cases across 101 test
files, with no failures or skips (36.707 seconds on source 95c8056).
Focused cases cover canonical habitats, seeded anchors, wrong-biome/water/slope
exclusions, large-body footing, peaceful contact, real provocation, attack pause,
injury persistence, grazer retreat and the combined population cap. The measured body sweep regression also passes against a parked hull and the
actual building collision system at stellar coordinates. An independent code
review confirmed full grazer clearance (about 2.23 m radius), with an oriented
building envelope. Conservative bounds can stop an animal slightly early.

The initial asset-dependent production build passed. Its main-582ZOfRE.js SHA-256 is
eedcaeeb614300e736eef4105f2ef7f07f78784ba4cf8fdaab202db6c8da7f31.
[Tideback asset record](aeon-amphibian-asset.md) and
[Mallow asset record](aeon-grazer-asset.md) retain exact identities, source,
editable Blender files, deformation measurements and failed iterations. Both
final corpse poses received scoped independent 4/5 reviews. These are studio
judgments, not complete six-criterion game-art acceptance.

Development starts: Nomad → Aeon · Tideback beach or Aeon · Mallow grassland.
Both place the ship35m above the canonical site; land, leave the chair, open the
rear hatch and walk down the ramp normally. Scripts/aeon-fauna.spec.js owns the
physical injected-Gamepad route; the standalone rig viewer is explicitly a
studio/export review, not gameplay traversal. Physical hardware and final
continuous-motion aesthetic acceptance remain separately unverified.


## Runtime follow-up: blocked grazer retreat

The first physical grazer encounter reached four actual grassland animals and
applied one real rifle hit (360 → 330 HP), with no provocation, bite or player
damage. Its retreat moved only 0.451 m before the next canonical footprint
exceeded the unchanged 12-degree slope ceiling. The gameplay displacement
assertion failed and remains retained in the browser ledger.

The correction probes at most seven next-step directions, trying direct escape
and lateral movement before a wider turn around the local terrain obstruction.
It remembers the chosen side, commits at most one safe step per substep, and
restores its facing if every option is blocked. All probes use the existing
canonical terrain and swept collision functions. This is local steering; it
cannot guarantee a route around every enclosure. It never changes aggression.

The exact recorded terrain-edge regression and a fully obstructed seven-sweep
regression pass, along with all 21 simulation cases and the focused habitat and
targeting suites. Independent code review found no blocker. The updated build
passes and is frozen on preview 5517: main-BExzhz0l.js SHA-256
63f37b482fce33dba24de21b777b1778cfb09689adc767d810f475b17014715f.
The Tideback controller route passed against the preceding build; this delta
affects only flee behavior, which Tidebacks never enter. Grazer-only verification
of this updated build passed in 2.6 minutes. Both model hashes remain unchanged.


## Completed browser checkpoint

Both exported models passed desktop/mobile Three.js walk/death rendering and
held-final-pose checks (two tests, 12.9 seconds). Tideback's physical controller
route passed in 2.8 minutes on c8162f9: actual landing, cabin/ramp exit, walking
around the parked hull, peaceful approach, four ammunition-authorized hits, one
provoked bite, death hold and menu-held-trigger suppression. Its first approach
fixture hit the ship hull; the corrected route used physical waypoints without
changing runtime collision.

Mallow's physical route passed on 95c8056 with the terrain-edge steering fix:
landing and exit, four real grassland spawns, peaceful approach, one rifle hit
(360 → 330 HP), observable retreat, zero bites and player health remaining 100,
followed by menu-held-trigger suppression and return to play.

All four final browser cases report zero console/page errors. Browser:
Chromium 151.0.7922.173, ANGLE AMD Radeon 860M / OpenGL ES 3.2; gameplay viewport
1280 × 800, model viewer also 390 × 844. Actual-world screenshots were personally
inspected by root and the QA agent. The [browser ledger](aeon-fauna-browser.md)
contains commands, exact identities, retained failures and screenshot locations.

No FPS or physical-device claim follows from these injected-controller tests.
Full continuous-motion aesthetics and complete six-criterion art acceptance
remain open; the independently reviewed studio poses and working encounters
qualify this as a scoped development checkpoint. Shared integration remains
with the steward.

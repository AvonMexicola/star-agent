# Aeon Tideback and Mallow wildlife

Development source candidate on feat/pyrebear. User requested the latest
amphibious GLB on Aeon beaches, then a large friendly grazer. Assets, authored
poses and browser encounters are under final review; this is not a full visual
acceptance or shared-preview integration claim. The original deer remains a
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

The complete npm test invocation passes101test-file suites, no failures/skips.
Focused cases cover canonical habitats, seeded anchors, wrong-biome/water/slope
exclusions, large-body footing, peaceful contact, real provocation, attack pause,
injury persistence, grazer retreat and the combined population cap. The measured body sweep regression also passes against a parked hull and the
actual building collision system at stellar coordinates. An independent code
review confirmed full grazer clearance (about 2.23 m radius), with an oriented
building envelope. Conservative bounds can stop an animal slightly early.

The final asset-dependent production build passes. Browser checks are pending;
preview 5517 is frozen for the QA owner. Its main-582ZOfRE.js SHA-256 is
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

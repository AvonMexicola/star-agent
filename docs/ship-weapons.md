# Meridian ship weapons

The offline fleet carries visible Cobalt pulse, Solar lance and Singularity guns.
The existing family selector changes the fitted set: **1 / 2 / 3**, the on-screen
buttons, or **controller Menu → Ship → Ship weapon**. Fire with **T**, **Hold to fire**, or
**RT / R2**. Raise and fully retract the landing gear first (**G** or **Menu → Ship → Gear**).
The interlock prevents the Kestrel belly gun firing through its nose gear.

| Ship | Mounts | Size | Pulse / lance / singularity damage |
| --- | ---: | ---: | --- |
| Nomad 02 | 2 | S1 | 24 / 48 / 100 |
| Kestrel | 4 | S2 | 42 / 84 / 175 |
| Atlas, flyable 30 m hull | 3 | S3 | 72 / 144 / 300 |

Guns fire in turn from their fixed bores. Shots and attached muzzle flashes start
at the named barrel tips; selecting a target does not bend the beam. S2 fires at
1.18× the S1 interval and S3 at 1.4×, with greater range, stronger effects and a
lower sound pitch. Handheld weapons keep their existing profiles.

The separate Atlas Mark II inspection studio also carries three S3 guns, including
its original aft-facing mount. Mark II remains a studio asset, not the flyable
Atlas. This change adds no inventory purchases, missiles, turret aiming, save
schema or multiplayer damage authority. The family selector remains the prototype
loadout control. Missing optional gun assets disable firing while preserving the
loaded hull.

Original source: `assets/ship-weapons/ship-weapons.blend`, the three Blender/Python
builders in `blender/`, original 1024² procedural PBR maps and their provenance.
Rebuild with Python/Pillow and Blender using the commands in
[the production record](qa/ship-weapons/production-record.md). No hosted service
or paid asset is required. Exact profiles live in `src/ship-weapon-profiles.js`.

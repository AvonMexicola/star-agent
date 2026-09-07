**Independent ship weapon mount audit — 7 September 2026**

The compact guns can fit the existing ships with small local foundations. Packed candidate 03 still needs the Nomad connector spacer and a nose return shaped to the Kestrel chine. The revised Kestrel nose position, socket-local `[0,0,-1.00]`, has no actual gun/gear surface intersections in the sampled poses. This is a CPU geometry and contract review, not visual acceptance, a continuous-motion certificate, or a gameplay/FPS result.

I read the baseline assets in `/home/cees/projects/star-agent-dev` at base `a748be101aad4ea672a157481044ce9ed6b03e35`, and independently measured the new exported kit. I changed no production source or asset and used no GPU. Full socket matrices, triangle witnesses and measured support rays are in the adjacent JSON files.

| Asset | SHA-256 | Bytes | Triangles |
|---|---|---:|---:|
| Nomad | `33a64aba2093e40768862fb130e81382b1900c11a8913080202efe9d89f204da` | 3,413,568 | 57,628 |
| Kestrel | `c48ed4e94b823f1f585e5d389ba8c88776731034025a7620162c8c3a5eb13b8a` | 2,331,576 | 36,226 including hidden AB geometry |
| Flyable Atlas | `5548d428e4d5cb4fa0f8e3d506803b3e2f63f53fcf9e3e3ad9051b66655b1cea` | 3,771,268 | 58,460 |
| Atlas Mark II studio | `f61dfd26570635436ffd05a4243b38be11a891a28dada35f758ae789ed2b396e` | 3,859,404 | 59,443 |
| Weapon kit 03 | `3ce80a2acf99a9522ba7eccc3fa7891885403679723660031ba31ca479c80d38` | 2,746,148 | 24,808, including four adapter prototypes |

The first actual-kit audit used `2f2f327c9975a8e21099892d03728396290ec9a68d603a3f8ad9a66edd18589d`. Its evidence is preserved separately. The earlier compact-package screen excluded the mating foot and therefore did **not** certify that foot: the actual mesh exposed its nose-gear collision. Candidate 03 extends the nose rails and is rerun in `exact-fit-03.json` and `foundations-03.json`.

**Ranked closures for candidate 03**

1. **Nomad S1 connector/foot overlap.** The existing capped connector is baked into `Nomad hull / rigid batch` and protrudes 12 mm beyond the mating plane. All three S1 feet intersect it at zero offset; +Y 12 mm still touches, while +Y 14 and 15 mm clear the measured surfaces. Use socket-local `[0,.015,0]` and a 15 mm peripheral spacer, outer radius .25 m and inner radius at least .14 m, clearing both the connector and old S1 lettering. This preserves the original sockets and avoids trying to hide part of a batched hull. The original 25 runtime gear poses are clear of all three S1 guns; the spacer is a proposed closure requiring its own final mesh check.
2. **Kestrel nose support has the wrong skin profile.** The .10 m wide returns at local X ±.34 currently stop at a flat local Y −.38. Across each width, the steep chine is only about −.106 to −.124 at |X| .29 but −.468 to −.497 at |X| .39. The flat post buries its inner edge by about .26 m and leaves the outer edge short by up to .12 m. Keep the .04 m longitudinal thickness and open central channel; shape the upper contact surface through the measured corner/middle samples, with 5–8 mm burial. Keep the lower end at local Y +.02. Exact samples are under `skinSamples` in `foundations-03.json`.
3. **Record the actual nose margin honestly.** At −.85 m forward, all three S2 feet intersect `Gear_Nose` in 5/97 sampled poses. In the denser 193-pose sweep, .93 m still intersects in two poses; .94 m is the smallest clear offset tested at 1 cm steps. At −1.00 m, the actual kit is clear, but a foot cylinder expanded by 50 mm still meets gear in three samples. At −1.05 m that expanded cylinder clears all 193 samples. −1.00 m is an actual sampled fit; it is not a certified 50 mm clearance. Do not reuse the earlier receiver-only −.80/.85 m result for the complete gun.
4. **Exterior collision must include installed guns.** The new nose reaches Z −8.380 m, while the old Kestrel nose stops at −6.752 m. `armedShipLayout()` adds fitted bounds to station flight collision, but the inspected `constrainKestrelStep()` / `constrainKestrelEVA()` still use their imported original ship parts. Extend exterior walking/EVA obstacles from actual fitted bounds if physical contact is required. The boarding route at port Z −1.75 is well separated from these additions.
5. **Refine the shallow foundations.** The wing .50×.50 m footing is supported, but its flat −.13 m top buries 8–51 mm into a sloped skin. A four-corner wedge with 5 mm burial is sufficient. The legacy Atlas aft plinth reaches the central spine correctly but overlaps radiator vanes by 48 mm. A notched underside or narrow supports on the central spine would keep the fins physically readable. These are supported static contacts, not gear-motion collisions.

**Measured sockets and the smallest local adaptations**

All coordinates are metres in ship space, +Y up and −Z forward. Attachment +Y is the mounting normal; attachment −Z is the bore. Values below are rounded for reading; `measurements.json` keeps full exported column-major matrices and quaternion-derived directions.

| Ship / socket | Origin [X,Y,Z] | Normal / bore | Size | Placement |
|---|---|---|---|---|
| Nomad `HP_Weapon_Port` | [−2.07,1.42,−4.03] | −X / −Z | S1 | +.015 local Y proposed |
| Nomad `HP_Weapon_Starboard` | [+2.07,1.42,−4.03] | +X / −Z | S1 | +.015 local Y proposed |
| Kestrel `HP_Nose` | [0,1.193,−4.98] | −Y / −Z | S2 | −1.00 local Z, open fork |
| Kestrel `HP_Belly` | [0,.893,.55] | −Y / −Z | S2 | Zero gun offset; small skin return if required |
| Kestrel `HP_WingL` | [−2.90,1.573,2.43] | −Y / −Z | S2 | Zero gun offset, shaped skin return |
| Kestrel `HP_WingR` | [+2.90,1.573,2.43] | −Y / −Z | S2 | Zero gun offset, mirrored skin return |
| Proposed legacy Atlas `HP_Atlas_Port` | [−3.8,9.56,−5] | +Y / −Z | S3 | 60 mm roof plinth |
| Proposed legacy Atlas `HP_Atlas_Starboard` | [+3.8,9.56,−5] | +Y / −Z | S3 | 60 mm roof plinth |
| Proposed legacy Atlas `HP_Atlas_Aft` | [0,9.85,7.5] | +Y / −Z | S3 | Shaped 60–105 mm spine support |
| Mark II `Mount_S3_DorsalPort` | [−11.2,8.9,−9] | +Y / −Z | S3 | Zero extra offset for this kit |
| Mark II `Mount_S3_DorsalStarboard` | [+11.2,8.9,−9] | +Y / −Z | S3 | Zero extra offset for this kit |
| Mark II `Mount_S3_Aft` | [0,14.6,19.5] | +Y / **+Z** | S3 | Zero extra offset; preserve aft bore |

Nomad rotates its side mounts about Z by ±90°. All Kestrel sockets use a 180° Z rotation: local +X points toward ship −X, local +Y points down. Mark II aft uses a 180° Y rotation. Do not replace these with position-only mounts. Nomad/Kestrel metadata uses `kind:'weapon', size, mount:'fixed'`; Mark II uses the older `role:'weapon-mount', mountSize:3` schema. The shared size helper can accept both resolved sizes, but plain `extras.kind` filtering alone would miss Mark II.

The legacy Atlas has no original hardpoint nodes. Its existing visible asset is about 30 m long and remains distinct from the 64 m Mark II studio asset. The proposed aft-position legacy gun faces forward; Mark II's existing aft gun faces aft. They have different physical layouts and must not share an assumed bore rotation.

**Gun geometry and firing origins**

Each family has a named `Weapon_{pulse|laser|void}-sN` root and `Muzzle_{family}-sN` child. The actual exported tip empties lie exactly on each gun's foremost Z plane in this kit. All nine have attachment normal +Y and bore −Z.

| Size | Actual bounds min → max | Actual muzzle [X,Y,Z] | Laser / pulse / void triangles |
|---|---|---|---:|
| S1 | [−.25,0,−1.65] → [.25,.430881,.25] | [0,.279,−1.65] | 2,232 / 2,304 / 2,592 |
| S2 | [−.40,0,−2.40] → [.40,.593668,.40] | [0,.3844,−2.40] | 2,508 / 2,580 / 2,964 |
| S3 | [−.625,0,−3.75] → [.625,.909648,.625] | [0,.589,−3.75] | 2,816 / 2,888 / 3,368 |

The mating feet extend to +Z equal to docking radius, beyond the receivers. Use the whole exported geometry in fitting checks. The old runtime generic shot point `[side*2.35,1.55,-3.3]` is not any of these barrel tips. Projectiles, beam starts, flashes and hit queries must share the current transformed `Muzzle_*` frame. A graph `matrixWorld` in rebased render space needs the camera's double-precision origin added exactly once for world-space effects; alternatively transform the ship-local muzzle by the ship's double-precision position and orientation.

All 45 actual muzzle rays in `exact-fit-03.json` are clear of their own ship for 100 m, with Kestrel gear fully retracted. This includes three families, every mount, and the tested alternate nose offsets. The original belly bore meets the down nose gear roughly 2.06–2.09 m beyond its tip in the compact-ray probe. Keep the explicit fully-retracted gear firing interlock; a clear endpoint does not authorize firing through an unfolding leg. Recoil, projectile radius and beam/flash width are outside this ray-only result.

**Support and occupied-space constraints**

Kestrel fork rails in the original `HP_Nose` frame use X [−.39,−.29] and [.29,.39], Y [−.02,.025], Z [−1.17,.02]. The .58 m central opening keeps the known nose-gear channel clear. Candidate 03's exact rails and return meshes have zero gear intersections in 193 sampled poses. The rejected lateral crossbar crossed the channel and collided in 36/97 earlier poses; do not restore it.

For a .50×.50 m wing footing, the contact Y at local (X,Z) corners (−.25,−.25), (−.25,+.25), (+.25,−.25), (+.25,+.25) is:

| Socket | Four local skin Y values |
|---|---|
| `HP_WingL` | −.078679, −.090398, −.111677, −.120974 |
| `HP_WingR` | −.111677, −.121540, −.080493, −.094604 |

Subtract about .005 from each Y for a slight embedded contact. The belly mating plane is about 28–40 mm below the actual skin; its compact gun remains about .299 m above the ground at its lowest exported vertex. The nose gun at −1.00 m remains about .599 m above the ground. No proposed gun requires changing the PilotEye, seat, canopy or access path.

Nomad guns sit outside the forward pressure shell, away from the interior X ±1.65 m, berth Z −.85…1.40 m, cargo rack Z 2.05…3.65 m and rear ramp Z 4…7.2 m. Their current barrels reach Z −5.68 m, already inside the existing conservative flight minimum −6.82 m. Actual new gun parts should still be included in exterior collision instead of relying only on that aggregate box.

Legacy Atlas front adapters span Y 9.498…9.560 m, meeting its flat roof at Y 9.500 m with about 2 mm burial. The aft adapter spans Y 9.742…9.850 m; the central spine is Y 9.745 m and radiator tops Y 9.790 m. The S3 gun tops reach about 10.470 m forward and 10.760 m aft, beyond the original 9.8 m flight bound. The sockets sit above its cabin, central lift X ±4/Z 0…10 m and side lifts X 3.7…5.9/Z −6…−3 m. Gear pivots at Y 4.3 m and their shortening motion remain far below these fittings. The berth/cabin and ramp contract need no redesign. A full station approach/sweep test must use the updated flight envelope; no such browser result is claimed here.

Mark II's actual compact S3 guns clear all foreign static geometry and forward/aft muzzle rays at zero extra offset. The old full standard clearance cylinder is still not clear at the two dorsal mounts: foreign braces reach radius .8201 m within the .875 m radius, an intrusion of about 55 mm. This does not intersect this compact kit, but the sockets cannot be advertised as accepting every future full-envelope S3 weapon. The existing half-metre foundations are part of the ship; support rays excluding those descendants hit the underlying hull about .5 m lower and do **not** establish that the foundations float.

Added armament changes visible resource counts. The maximum active gun-only addition is 5,184 triangles on Nomad, 11,856 on Kestrel, and 10,104 on either Atlas. Candidate 03 brackets add 360 on Kestrel and 384 on legacy Atlas. Thus the armed Nomad/Atlas totals exceed their earlier bare-ship 60k targets; report armed costs separately and validate them in the actual scene. No FPS or budget acceptance is inferred from kit file size.

**Evidence and reproduction**

`probe.mjs` decodes glTF accessor data and full hierarchy matrices, screens compact boxes/standard cylinders against actual triangles, checks muzzle/support rays, and samples real runtime/clip movement. `exact-fit.mjs` builds triangle BVHs and uses separating axes including coplanar axes for actual exported surface intersections. It verifies that sampled gear meshes exist and move. Four synthetic crossing/separation diagnostics guard the narrow phase. `foundations.mjs` performs the denser 193-pose offset and bracket checks plus support measurements. `atlas-footings.mjs` records exact plinth contacts.

```bash
node /tmp/star-agent-ship-weapons-mount-review/probe.mjs > /tmp/star-agent-ship-weapons-mount-review/measurements.json
node /tmp/star-agent-ship-weapons-mount-review/adapters.mjs > /tmp/star-agent-ship-weapons-mount-review/adapters.json
WEAPON_KIT=/tmp/star-agent-ship-weapons-mount-review/kit-03.glb EXACT_OUT=exact-fit-03.json node /tmp/star-agent-ship-weapons-mount-review/exact-fit.mjs
WEAPON_KIT=/tmp/star-agent-ship-weapons-mount-review/kit-03.glb FOUNDATION_OUT=foundations-03.json node /tmp/star-agent-ship-weapons-mount-review/foundations.mjs
node /tmp/star-agent-ship-weapons-mount-review/atlas-footings.mjs
```

These are surface-intersection and bounded pose samples, with reported mating contact. They do not prove watertight volume containment, all motion between samples, manufacturing tolerance, recoil clearance, renderer quality, input behavior or runtime combat balance. The local frozen GLB copies preserve the audited bytes; they need not be duplicated in a PR because the production asset already owns those bytes.

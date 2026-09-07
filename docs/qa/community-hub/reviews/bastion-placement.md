# Bastion06 station placement — author-side CPU audit

**Disposition: the four plane-aligned mounts have full foundation support and clear the authored station throughout the bounded full articulation envelope.** The original nominal mounts bury only the fixed foundation by 2.817 mm above / 7.004 mm below. The shared mount table can remove that small discrepancy without changing Bastion geometry. This is an author-side geometry finding, not independent visual acceptance, proof of clear firing arcs, or performance certification.

## Exact candidate and recommended frames

The audited Bastion06 GLB is `adf6c5b03da18710a3d97341dd503ec95433e564d81610ed67037b226af8e4ca` (9,177 triangles, 908,388 bytes). The assembled authored station exterior is `5b39b183030d529a710de0b2dad308a36a8e597b067d3061d82f01bb721b76e6` (2,600,828 bytes). Complete hashes for station, props, concourse, elevator, layout and runtime sources are in `audit.json`; the source commit recorded at this checkpoint is `78fa508f51e050b68dabb880b205200ff09f88ec`.

Positions below are **station-local metres**; quaternions are `[x,y,z,w]`. The station's own double-precision orientation/translation applies outside these frames.

| Mount | Recommended position | Quaternion |
| --- | --- | --- |
| bastion-1-upper | `[-665, -17.997183184697576, 0]` | `[0,0,0,1]` |
| bastion-2-upper | `[665, -17.997183184697576, 0]` | `[0,0,0,1]` |
| bastion-1-lower | `[-665, -92.0070038910506, 0]` | `[0,0,1,0]` |
| bastion-2-lower | `[665, -92.0070038910506, 0]` | `[0,0,1,0]` |

These are the actual decoded, quantized surfaces, rather than the builder's nominal −18 / −92 planes. Each six-triangle foundation bottom spans **252.585603098 m²**. Clipping every bottom triangle against the two actual supporting station triangles covers its complete area. The supporting triangles have zero pairwise overlapping area. Upper-left contact is on `FixedStructure_ExteriorIvory_Geometry` triangles 354/355; lower-left contact is on `FixedStructure_ExteriorSteel_Geometry` triangles 1988/1989. The corresponding positive-X records are retained in the JSON.

The original nominal placements' only intrusion is the measured shallow foundation mounting contact. The lowest non-foundation part is `Bastion_Yaw_PBR` at local Y1.399999976 m. Analytic extrema of all actual non-foundation vertices over the full pitch and recoil interval leave **at least 1.392996085 m** above the decoded support surface in the nominal configuration. No moving part is hidden inside that contact allowance. Plane alignment eliminates even the fixed-base embedding.

## Coverage and nearby structure

The envelope is a conservative all-yaw cylinder with radius **29.6 m**, local Y**0..38.1 m**, pitch **−0.20..π/2**, and recoil **0..0.60 m**. It comes from the earlier analytic actual-vertex extrema, preserved by candidate05→06's exact oriented local/world triangle and complete rig comparison. The full cylinder overestimates occupied space.

The probe decodes the actual GLBs with Three's GLTFLoader and calls the shared runtime exterior assembly. It tests **40,928 fixed visible triangles** and cross-checks the **40,284 actual runtime collider triangle AABBs**. Each triangle is clipped to the cylinder's height interval and its projected convex polygon is checked against the radius. At the aligned frames there are **zero non-contact triangles or collider AABBs in the full-motion cylinder**. Only the measured mounting plane is excluded; no volume-wide contact exemption is used. Numerical plane tolerance is 0.00001 m. Six predicate controls cover clipping, overlap and radial-distance behavior.

The closest upper non-contact structure is the passenger/service arm: its geometry and collider AABBs begin **6.411933 m beyond the conservative radius**. The corresponding lower minimum is about 296.319 m in actual geometry / 296.113 m in collider bounds. Distinct turret envelopes are separated by at least 74 m.

All ring rotation phases retain their X extents: the nearest rotating ring is **at least 298.4 m axially clear**. The current procedural room plus actual concourse asset is **over 613.19 m clear**. All 20 transformed berth hull/prop bounds are **at least 445.59 m clear**. Measured mouth cross-sections extended outward are **at least 512.39 m clear**. These rounded-down figures cover the millimetre mount correction. The probe measures 63,336 hub/concourse triangles, 126,176 bay/prop triangles and the 4,724-triangle elevator asset, but uses distant assembly bounds instead of claiming a detailed sweep for each door or furniture pose.

## Explicit remaining constraints

1. **Physical articulation clearance does not imply unobstructed fire.** Twelve diagnostic rays from actual named muzzle transforms at three poses on the upper/lower negative-X mounts are retained. Upper yaw0 / pitch−0.2 hits the pressure arm **7.746522 m beyond the muzzle**, at `[-669.199999809, -16.300406983, -36.014038300]` for Port, on `FixedStructure_ExteriorPetrol_Geometry` triangle1051. Upper yaw0 / pitch0 hits the bay cradle about451.396 m away. Root states that enforcement intentionally uses unconditional hitscan following an admitted damaging impact, as authorized by the user. These obstructed arcs remain explicit; this audit neither changes that policy nor certifies its behavior.
2. **Legacy fallback does not share these mounting surfaces.** Its spine top is Y−16, so the upper foundation intersects it by roughly2 m. Its bottom is Y−54, leaving a lower mount at Y−92 unsupported by roughly38 m. Normal main/server paths load the authored exterior, and the server rejects a failed authored load; the browser fallback must not inherit this placement PASS. No legacy geometry edit is proposed here.
3. The mouth corridor comparison does not certify arbitrary approach yaw, giant ships, user-built objects or movement through the occupied turret cylinder. Runtime articulated collision remains necessary. This audit includes no browser/GPU, materials, motion aesthetics, live strike, arbitrary ray coverage or FPS assessment.

## Reproduction and retained failures

Run `node /tmp/star-agent-bastion-placement/audit.mjs`. It accepts `BASTION_PLACEMENT_ROOT` and `BASTION_PLACEMENT_OUT`; it reads production source/assets and writes only its report directory. The original nominal-plane findings remain in `nominal-planes.json`; `audit.json` includes nominal and plane-aligned findings together. The initial launch's unnecessary subprocess Git lookup returned EPERM after producing its output. The probe now reads Git metadata directly, remains CPU-only and does not request or require a browser. No production files were edited.

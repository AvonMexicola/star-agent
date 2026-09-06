# Weapon mount fitting standard

Star Agent ship assets use a shared mechanical fitting frame so model exporters,
runtime code and future attachments agree without guessing scale or orientation.
The machine-readable source is
[`assets/atlas-mark-ii/mount-standard.json`](../assets/atlas-mark-ii/mount-standard.json).
All dimensions are metres.

At each named mount node, the origin is the centre of the docking plane. Local
`+Y` is the outward mount normal, local `-Z` is the future bore direction and
local `+X` is right. Exported nodes must keep unit scale. The node world matrix is
the complete mating transform; attachments authored in the same frame can use it
directly.

| Slot | Dock diameter | Interface clearance | Bolt circle |
|---|---:|---:|---|
| S1 | 0.50 m | 0.75 m diameter, 0.60 m above and 0.15 m below the plane | 6 × 24 mm holes on 0.40 m PCD |
| S3 | 1.25 m | 1.75 m diameter, 1.20 m above and 0.25 m below the plane | 8 × 40 mm holes on 1.00 m PCD |

The cylindrical clearance is service space around the mating interface. It is
not the volume of a weapon. The JSON also records provisional package allocation
boxes for asset planning: S1 is 0.9 m wide, 0.9 m above the plane, 3 m forward
with 0.3 m rear allowance; S3 is 1.8 m wide, 2.4 m above the plane, 7 m forward
with 0.6 m rear allowance. These boxes may change when real equipment design
begins and must not be treated as collision or combat statistics.

Compatibility is exact-size by default. An S1 attachment therefore fails an S3
mount check unless the caller explicitly allows a smaller fitting, representing
a separately modelled adapter. Sizes other than S1 and S3 are invalid rather
than silently approximated.

The Atlas Mark II layout declares three S3 node slots: dorsal port, dorsal
starboard and aft defence. `mountTransformFromAsset()` resolves those named nodes
from the loaded asset and returns their world matrices after compatibility
validation. `createMountFittingGauge()` creates a wireframe interface and bore
axis for debug viewers. It is explicitly a fitting gauge; this slice adds no
weapon geometry, firing, damage, targeting or combat behaviour.

`NOMAD_FUTURE_S1_ATTACHMENT` reserves an S1 debug fitting definition for later
Nomad work. The current Nomad model has no corresponding node and is unchanged.

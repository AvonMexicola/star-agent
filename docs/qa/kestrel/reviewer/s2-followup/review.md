# Kestrel S2 socket follow-up

**Scoped result: PASS. The round-6 visual recommendation remains applicable.**

Reviewed GLB SHA-256:
`c48ed4e94b823f1f585e5d389ba8c88776731034025a7620162c8c3a5eb13b8a`.
The candidate is 2,331,576 bytes and retains 36,226 triangles.

Four existing sockets now declare fixed, empty S2 mounts. Their mating origins
and frames are corrected while their protective covers retain exactly the same
world-space geometry. The studio derives a readable **4 × S2 hardpoints** label
from the loaded node metadata. I found no regression that invalidates the
[round-6 review's 4.25 / 5 recommendation](../round-6/review.md). This scoped
follow-up does not assign a new art score; Cees retains the PR gate.

## Geometry and rig preservation

The independent [geometry and mount audit](geometry-and-mount-audit.json)
compares this export to approved commit `bd19367`, whose GLB hash is
`ef42a970295f0db8535fdd08aa6f8b2385243545891f512816392befdbaed374`.

- The complete BIN chunk is byte-identical, preserving geometry and embedded
  image payloads. Mesh, accessor, buffer-view, material, texture, image and
  animation records are unchanged.
- Compared all **53,513 vertices on 45 meshes**, including initially hidden AB
  geometry, in the resting scene and at five evaluated times for each of the
  three animation clips: **16 poses / 856,208 vertex comparisons**.
  Maximum world-position difference was **0 metres**; world normals and every
  mesh world matrix also matched exactly in those poses.
- The only changed node records are the four HP nodes and their four PBR cover
  children. Child transform compensation preserves visible cover placement
  despite the corrected parent socket transform.

## Socket and standard checks

All four nodes expose `kind: weapon`, `size: 2`, `mount: fixed`,
`installedWeapon: null`, `forward: [0, 0, -1]` and `socketOnly: true`.

| Socket | World mating origin, metres |
|---|---|
| HP_Nose | (0, 1.193, -4.98) |
| HP_WingL | (-2.9, 1.573, 2.43) |
| HP_WingR | (2.9, 1.573, 2.43) |
| HP_Belly | (0, 0.893, 0.55) |

Coordinates above are rounded. Each origin moves down 17 mm from its prior
cover centre and coincides with the retained cover's underside plane. All
frames have unit scale and determinant +1. Local +Y maps to ship -Y, local -Z
remains ship -Z, and local +X maps to ship -X, preserving a right-handed frame.

The actual shared helper accepts S2 and rejects S1/S3 under default exact-size
compatibility for every socket. Its resolved mating matrix equals the exported
node world matrix. Invalid sizes are rejected. The S2 definition supplies the
documented 0.8 m docking diameter. The S1 and S3 records match the Atlas reference
unchanged, and `src/weapon-mounts.js` matches the Atlas helper byte for byte.
The audit records the exact Atlas reference commit.

These checks establish socket metadata, frame and size-class compatibility.
The existing small covers remain covers. No installed weapon, exposed mating
hardware, service-envelope clearance, provisional weapon-package clearance or
combat behaviour is certified by this follow-up.

## Independent browser evidence

I took and inspected [desktop 1440 × 900](desktop-exterior.png) and
[phone 390 × 844](phone-exterior.png) screenshots from the frozen production
studio. The label is visible, fits horizontally on both layouts and agrees with
four loaded S2 fixed mounts with no installed weapon. Shape and finish remain
consistent with the approved appearance.

The independent browser case passed in **4.7 s**, **5.3 s** including startup.
Chromium 151.0.7922.173 used AMD Radeon 860M through ANGLE OpenGL ES 3.2 / radeonsi.
There were zero browser page errors or console warnings/errors. The asset hash
remained unchanged. [Browser evidence](browser-evidence.json) records the
metadata, label bounds, camera, renderer backend and resolution. No performance
measurement or repeated full art tour is claimed.

GPU use ended before report writing. Reviewer writes are confined to this new
folder and `/tmp/kestrel-review*`; round 6, builder source and assets are unchanged
by the reviewer. Builder-reported full test/build results were not independently
rerun here.

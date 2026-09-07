# Burrow clear forward view

Cees requested removal of the central windscreen strut on 2026-09-08. The
original Blender builder now omits that single mullion, and the editable source
and packed runtime GLB have been rebuilt. No runtime, cabin layout, glass,
perimeter frame, light bracket or moving mechanism was changed.

The decoded before/after comparison retains 21,526 identical triangles including
their positions, normals and UVs, removes exactly 44 mullion triangles, and adds
none. All 308 glazing triangles, embedded WebP payloads, materials, node
transforms and layout match. Twenty rays from the canonical seated eye that hit
the old centre strut now pass through the retained glazing without that opaque
obstruction.

The existing focused geometry probes also pass: 762 lateral shell rays, 125
boarding camera samples and 32 forward enclosure rays, plus 18 cutter aim states
with both lamp attachments intact. These are finite geometry checks; they do
not establish simulated cabin pressure or a new complete driving acceptance.

Runtime GLB SHA256:
`831b9569633efda11652e3827057d2f4bc3f47d20f23a47df152fa437cb29468`.
Size: 2,175,556 bytes. Original candidate10 SHA:
`88448d9dd48e0a0acdb2397465302e8ab41335b8ffaab6234050d136bf6cc78f`.

The source/export receipt and exact geometry proof are retained locally under
`/tmp/star-agent-rover-windscreen-qa` and
`/tmp/star-agent-rover-windscreen-delta-11-files.json`. The first attempted pack
failed because that interpreter lacked Pillow; packing succeeded with the
existing authoring environment. No dependency was added.

A paired native cockpit inspection is queued behind the already active shared
browser jobs. This source checkpoint does not claim that pending visual check
or a shared preview deployment. The permanent forward-visibility requirement
is recorded in [ship pipeline memory](../../../SHIP-PIPELINE-MEMORY.md).

# Outdoor construction floodlights

Cees requests outdoor floodlights after the settlement night review. Produce one
original, rebuildable six-metre twin-head mast in the existing white armour,
dark polymer, brushed steel and mint kit language. Warm-neutral diffusers,
angled housings, cooling fins, pivot brackets, anchor bolts and a reachable
switch box should explain its construction at walking distance and on approach.
No external imagery, generation service, new texture or dependency is needed.

Origin is the mounting surface; game metres, Y up, beam faces local -Z and the
service panel faces +Z at 1.2 m. Keep the mesh under 10k triangles and 1 MB,
material-batch the export and preserve editable Blender source plus measured
manifest. Match pole/head collision to the exported geometry.

The existing Power palette, placement, material ledger and saved lightOn flag
own construction and switching. A powered light consumes 600 W; an off or
unpowered lamp emits no useful light. The renderer shares one bounded pool
across player, authored settlement and registered-base renderers: at most six
spotlights and two shadow maps. Positions remain double-precision until the
camera origin is subtracted. No volumetric beam, ambient-light override or
global exposure change is planned.

Place six lights around each settlement's pad, preserving every supported
ship's landing envelope and all door/ramp
routes. Actual night game captures, before/after views, source/asset checks,
power/save tests and a complete controller placement/switch/reload route are
required. Record keyboard/phone coverage, held-input gates and renderer metrics;
builder evidence is distinct from independent or physical-device acceptance.

Worktree .worktrees/outdoor-floodlights, branch feat/outdoor-floodlights,
base32966e3, preview5654. New asset and lighting modules are isolated first;
coordinate small catalog/BuildSystem/Power-palette hooks with the active terrain
foundation owner before editing those shared files. No public deployment.

# ADR 0003 — Solid landmark bedrock above canonical terrain

Status: proposed; implemented development checkpoint, independent domain review pending.
Date: 2026-09-07. Owner: Cees / @AvonMexicola; builder: Codex.
Related brief: [rare Aeon formations](../briefs/landmark-rocks.md).

The user requested rare large rocks with real overhangs. The existing canonical
heightfield cannot represent their undersides. Inflating a mineable four-metre
density domain would also break cutter metre/volume and saved-rock contracts.

Use a separate deterministic bedrock object layer on Aeon, anchored to samples
from `world.js`. CPU geometry and collision share the exact close mesh. A mesh
obstacle adapter composes with existing building/mining contact. This follows the
existing solid-object boundary; no second terrain height sampler is introduced.
Uniform scale and rotation apply to both mesh and contact. Flight uses a sphere
enclosing the current ship envelope, so contact is deliberately conservative.

Landmark generator/geometry versions start at 1. Terrain and mining save versions
remain unchanged. Existing saved mined IDs and densities are retained. New loose
stones and plants reject landmark footprints; the forest layout version advances
from 2 to 3 for that exclusion. Trees outside those footprints retain their old
coordinates, shapes and hashes. No saved ore is refilled or silently deleted.
An older build can render the original scenery and reload the same mining saves.

The new formations are static bedrock, too large for the handheld cutter. They
do not introduce inventory rewards, online extraction authority or a save schema.
Restored Aeon outpost claims suppress overlapping landmark meshes and colliders;
authored construction wins over newly introduced scenery. These clearings are
captured at startup, so placing a piece does not erase a rock during play. The
procedural plant exclusion stays empty there, leaving the established outpost
cleared. New construction's general rock-intersection validation remains outside
this scenery change. The checkpoint is reversible without touching the database.

One worker builds twelve reusable templates and three LODs; a coarse instance is
retained until its complete finer representations arrive. Swept physical queries
work without visual residency. Existing CC0 textures are reference-counted, with
their procedural fallback retained. No asset download or runtime dependency is added.

Adoption is local development integration under the standing request. Unit and
browser evidence belongs in the task QA record. Independent acceptance and public
release are separate; this record grants no exception to QUALITY.

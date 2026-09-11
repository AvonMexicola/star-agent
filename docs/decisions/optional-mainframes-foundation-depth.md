# Optional mainframes and measured foundation depth

Status: implemented development change, requested by Cees on 2026-09-08.

A construction site retains its stable local owner, body anchor and ID when its
first foundation is placed. It may contain zero or one mainframe. A mainframe
adds its existing physical supply container and door controls to that site;
removing an empty mainframe leaves structures and their inventories in place,
disables buffer use and opens doors. Last-piece removal removes an empty site.
The same rules validate browser and account-backed solo saves. This does not
change multiplayer identity, protocol or construction authority. Explicitly public
commissioned trade sites remain open to visitors.

Build save version 1 gains optional `supportDepth`, in metres below deck level,
on square/triangle/curved and braced foundations. Absence retains the historical
0.6 m depth; the new braced type defaults to 3.6 m. Finite bounds are 0.6–8 m
(1.1–8 m for braces). Old saves therefore load unchanged. Rendering, ghost
geometry, placement bounds and physical collision consume the same dimension.
The server cannot resize an existing piece through a stale account-save update.
No database migration is required. Older clients may reject the new piece type;
paired local client/API source updates are required before testing cloud saves.

Ordinary foundation depth reaches the lowest canonical terrain sample, with a
small buried margin. Deck vertices and half-metre edge samples must remain above
the dry terrain. Braces retain exactly 45 degrees and both feet must contact dry
terrain within the footing allowance. Footings and steel members collide but do
not add walking support planes. Braced foundations use nine draws (five inherited
deck batches plus four articulated members), 1,272 triangles and 120,720 bytes.
They stay within the shared per-prop triangle/byte limits; the older five-static-
mesh kit check is extended only for these independently moving members.

Author checks and actual renderer evidence are in the terrain-foundations QA
record. Independent review and physical gamepad testing remain separate.

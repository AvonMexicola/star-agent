# Greenbank drive target selection

User reports reaching Aeon but ending 870 km from Greenbank Supply. Reproduction
with the actual seed 7291 settlement pad shows exact nose alignment without map
selection chooses Aeon and arrives 871.041 km from the pad. An explicit settlement
selection also falls back to Aeon whenever the settlement leaves the aim cone.
The settlement route itself reaches its 35 km approach correctly.

Prioritize narrow point beacons over broad world disks. Keep an explicit selected
destination until it is cleared or replaced in the map; losing aim resets charge
rather than changing the target. Preserve sight occlusion, selected far-side
routing, charge gates, body-only automatic acquisition and server authority.

Own isolated fix/greenbank-drive-target from e06f04f; shared navigation-targets and
its focused tests plus a controller Greenbank journey. Preview 5698, one browser
worker after checking the shared slot. Integrate locally after source/build and
full actual controller approach/arrival checks. The prior public release remains
blocked at the GitHub billing/required-check gate; this report is not permission
to bypass that gate. Supersede its staged candidate before any later publication.

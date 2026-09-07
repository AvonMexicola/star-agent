# Fixed production world views

Captured with `scripts/hangar-integration-tour.mjs`, production build on 5295,
seed 7291, 1600 × 900, DPR 1, render scale 1. Each world viewpoint used a fresh
Chromium process and waited for drained terrain workers and stable visible LOD.
Opening and cockpit used a final shared fresh process. These are camera fixtures;
the separate utility/controller journeys establish physical gameplay.

Chromium 151.0.7922.173; ANGLE / AMD Radeon 860M / radeonsi krackan1 ACO /
OpenGL ES 3.2. Zero browser errors, warnings, failed requests or unexpected
lifecycle events. GLB SHA-256:
`33a64aba2093e40768862fb130e81382b1900c11a8913080202efe9d89f204da`.

| View | Three.js draws | Triangles |
| --- | ---: | ---: |
| [Orbit](01-orbit.png) | 488 | 335,374 |
| [Coast, 95 m facing sea](02-coast.png) | 425 | 931,028 |
| [Forest, 95 m](03-forest.png) | 573 | 1,215,870 |
| [Highlands, 700 m](04-highlands.png) | 278 | 577,038 |
| [Opening, exactly t = 10 s](05-hangar-t10.png) | 519 | 762,693 |
| [Seated cockpit](06-cockpit.png) | 535 | 752,860 |

The game disables Three.js automatic resets and clears the counters before its
frame render, so these counts include shadow and post-processing draws. They are
scene counts, not an isolated ship cost or independent GPU timer. The orbit
draw count exceeds QUALITY's 300-draw target. This lane does not certify the
whole inherited world budget. The orbit fixture hides the idle ship; its count
does not attribute that excess to Nomad. Forest and hangar/cockpit counts fit
their corresponding draw/triangle targets at this recorded resolution.

The user's Kestrel preview remained open. Observed frame intervals are retained
in the local `/tmp/star-agent-nomad-world-v1/evidence.json` archive, but are not
used to approve the 1440 × 900 hardware frame budgets. No pixel-diff baseline
update or final material approval is implied. The terrain retains the base's
broad coastal plain, distant tree impostors and grazing-angle cloud banding;
the Nomad change does not modify those world systems.

Reproduce against a production preview:

```sh
node scripts/hangar-integration-tour.mjs --url http://127.0.0.1:5295 --out /tmp/star-agent-nomad-world --hardware
```

# Burrow candidate 05 — focused CPU findings

Reviewed immutable SHA `9d72896e1bff33fb4908f55a02368a286b201df19f015fcc008477f0544f45af`, **21,012 triangles / 2,132,436 bytes**, against candidate 04 SHA `80c495d025d7529acc79e8ce743547b3c361d167b70bd0d63f122a83566f762e`. No render or art score is assigned to 05.

**Disposition: corrective iteration required.** The nominal envelope and front text correction are sound, but added structure introduced these defects:

- Outer fender returns hit both rear tyres at +0.22 m compression: 22 port / 20 starboard unexpected triangle pairs in the 24-state wheel probe, near X ±1.25–1.27 and Y 1.185–1.206.
- Both straight stringers connect the treads to the chassis, but rise through the walking surfaces within each tread footprint: maximum protrusion **66.35 / 44.57 / 23.14 mm** above the low/middle/high treads. Six actual stringer/tread combinations were clipped against the top-plane/footprint volumes.
- Gasket/body gaps are **1.495 mm front, 0.995 mm port and 44.981 mm starboard**. Front fasteners float 4.965 mm ahead of the cover; side latches have about 1 mm cover gaps.
- The entry-path rerun exposes the inherited head-rest issue described in `erratum-candidate-04.md`. The proposed forward waypoint clears the sampled camera sphere.

The front text has 718 exported vertices on both versions; 05 matches the intended 180-degree in-plane correction within 26.3 micrometres of quantization. Text up is game +Y and its face normal is −Z. Rest bounds remain approximately `[-1.72,0,-2.55]…[1.30,2.50,2.10]`.

Evidence: frozen `candidate-05.glb`, `layout-05.json`, `builder-05.py`; `joints-05.mjs/.json`, `cabin-05.mjs/.json`, `structure-05.mjs/.json`, and `entry-route-05.mjs/.json`. Contact tests use actual exported triangles and explicit runtime articulation. They preserve intended hub/clevis and chassis joints and do not certify material quality, manufacturing strength, continuous motion or gameplay.

The corrected `capture-05.mjs` was prepared and syntax checked without a browser launch. It was not run before the parent superseded this geometry. No closure is claimed for the intervening candidate 06, which retained the straight stringers. Candidate 07 is reviewed separately.

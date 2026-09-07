# Kestrel gear contact-plane closure

Root's production test found that launch stopped immediately at the authored 2.49 m pilot eye height. The initial conservative gear sweep boxes extended 18–19 mm below the rig's actual ground plane. The station's expanded-box sweep correctly treated that as a starting overlap and returned a hit at time zero for both upward and lateral movement.

The independent CPU diagnostic `/tmp/kestrel-review-gear-floor.mjs` reproduces that failure using the actual `constrainStationSweep` implementation and a flat deck. With envelope minY −0.019, a 5 cm lift and a 5 cm lateral step are both blocked. With minY 0, both moves pass. Results and source-derived coefficients are in `/tmp/kestrel-review-gear-floor.json`.

The rig supports the tighter floor bound throughout its original GearDown animation. Rigid upper gear vertices remain above 0.24726 m; lower oleo geometry remains above 0.21467 m, even with independent conservative extension and rotation ranges. Only the counter-rotated shoes reach y 0.

For the lowest shoe vertex, normalized rotation gives `y = A(1 − cos θ) + d cos θ − 0.25 sin θ`, where `A = 1.650000006` and the exported synchronized extension satisfies `d/θ ≥ 0.381970`. Using the weaker bound 0.38 still proves positive clearance before exact full deployment, where the height is exactly zero.

The diagnostic additionally proves the result for the runtime's slightly non-unit encoded quaternions, rather than relying only on that idealized expression. Positive slerp weights bound extension by `d ≥ 0.76 q.x` continuously on every key interval. Root and shoe tracks are exact conjugates. Substituting their actual matrix coefficients, and including the encoded norm error, gives positive coefficients below `q.x = 0.4` and a positive constant lower bound above it. Thus the result does not depend on finding a minimum in sampled frames. As a further check, actual Three.js interpolation at 3,601 unique subposes per gear yields minimum shoe y exactly 0.

Root has applied the scoped fix: only the three gear flight-part minimum Y values and aggregate flight bound minimum Y become 0. All conservative x/z/top margins remain. The station's general overlap behavior is unchanged. This is a tighter bound justified by this asset's geometry and animation; it is not a general rule to clip arbitrary collision boxes at the floor.

The original padded audit remains historical evidence. Independent suspension compression, altered gear motion or replacement geometry would require a new contact-plane proof. This closure verifies the geometry and floor sweep; it does not itself claim a successful production-browser launch.

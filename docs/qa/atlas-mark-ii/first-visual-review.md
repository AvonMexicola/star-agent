# First-pass visual review

Independent Claude Opus review of the initial rendered candidate. Superseded by subsequent corrections; not approval.

## Verdict

Not at the bar, and the gap isn't small — but it's the gap a first authoring pass should have. Scoring only what's in the three frames:

| # | Criterion | Score | Why |
|---|---|---|---|
| 1 | Silhouette & scale | **2** | Reads as a flat barge/slab, not a 64 m heavy hauler |
| 2 | Materials & detail | **2** | Near-uniform albedo, no panel-line hierarchy, zero emissive on the hull |
| 3 | Lighting & integration | **2** | Interior flat (known); exterior floats — no contact occlusion where parts meet |
| 4 | Cohesion | **3** | Interior teal/white/graphite is consistent; exterior shares none of it |
| 5 | Function | **3** | Cargo deck reads as a cargo deck; bridge does not read as a bridge |

**Average 2.4.** Motion not assessable from stills.

The honest headline: **213k tris are not buying silhouette.** The budget is going into repeated roof segments and shelf uprights, not into the shapes that make the ship legible. Raising the budget is defensible; spending it this way isn't yet.

## Three highest-impact changes

**1. Invert the value scheme on the hull.** White 0.8 is roughly 60% of the visible exterior, so the ship reads as painted foamcore and the whole upper deck flattens into one blown value. Faction language says white *armour* over matte dark polymer — right now the polymer is a skirt. Make graphite the primary hull (that's already the intent for the sides; extend it to the roof), and demote white to ~20–25%: cargo-cover panels, bridge shell, a few structural caps. Then add a three-tier panel line hierarchy (deep structural splits → panel seams → shallow scribes), because at present the only dark lines on the roof are gaps between mesh segments, which is why the top deck looks like stacked cards rather than plate.

**2. Put human-scale hardware on the exterior, and fix the aft massing.** Nothing on the hull tells you this is 64 m rather than 6 m: no airlock door, no ladder rungs, no handrail runs, no twistlocks, no RCS ports, no registry or hazard markings. Add those at true size against the 1.80 m reference — a single 2.1 m door on the flank does more for scale than the next 50k tris. Same pass: the aft end just stops. A Caterpillar/Hercules silhouette earns its read from the engine cluster and dorsal spine breaking the box; give it a real aft thruster mass and a raised spine so the profile isn't a constant-height rectangle. Also move the 1.80 m silhouette out of the right margin and stand it on the ground beside the hull — floating at the edge of frame it proves nothing.

**3. Rebuild the bridge as crew stations, not a reception counter.** This is the weakest frame by a distance. What's modelled is a flat box with teal rectangles for screens, two arm-mounted MFDs, a soffit, and an empty dark window plane. Missing, in order of payoff: **seats** (two stations — the only true scale anchor in an interior), console volume with *recessed* bezels so the MFDs are geometry rather than albedo, window mullions with real depth and a frame thickness you can see edge-on, and overhead structural ribs instead of a smooth wedge. Make the screens emissive at the same time — currently nothing in the frame indicates the ship is powered, which is also the §1 "at least one emissive/status detail" failure across all three views.

## Smaller notes

- **Exterior has no emissive at all** — no nav lights, no mint accent, no status. By §1 that alone is a "not done".
- The **review camera is working against you**: the high three-quarter top-down flattens the ship into its plan view. Add a low port-quarter and a straight side ortho to the QA set — those are the angles the silhouette has to survive.
- Visible **gap and no contact darkening** between the aft sponson and the hull; the parts read as composited rather than assembled.
- Cargo bay is the strongest asset here, but everything shares one bevel radius and one grime level (i.e. none). Vary the bevel by part class and put wear where hands and forklifts go — door edges, lane markings, shelf uprights at knee height.
- **Floating "BAY 07/08/09" labels** read as a debug overlay. If they're meant to be diegetic, they need to be on a surface — stencil on the upright or a lit sign plate.
- Container doors read as appliances: one handle, big uniform fillet, no hinge, latch or label. Cheapest fix in the set.

Not mergeable against the §3 gate as it stands. The route to ≥4.0 is #1–#3 plus the ngon split and the interior lighting you've already got queued — not more triangles.

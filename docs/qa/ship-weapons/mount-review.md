**Independent candidate 05 CPU follow-up — 7 September 2026**

The current placement and foundation geometry clears this bounded CPU review. The Nomad connector overlap, unsupported Kestrel nose return, wing footing mismatch and Atlas radiator overlap found in candidate 03 are closed by the actual exported candidate 05 meshes. A separate initial-overlap escape defect remains in the newly added walking/EVA attachment collision helper. Visual acceptance and gameplay verification are still separate gates.

Audited kit: `/home/cees/projects/star-agent-ship-weapons/public/models/ship-weapons.glb`, SHA-256 `308a1ebeae4b1d5119dd98f96d21cc478335a638317fde19fdc542703f9cde67`, 2,806,012 bytes, 25,852 total triangles including six foundation roots. The four ship asset identities are unchanged from [the original audit](review.md). The local frozen `kit-05.glb` preserves these exact bytes. No production files were edited and no GPU/browser was used.

| Independent check | Result |
|---|---|
| 36 actual gun/mount combinations, all three families across all four ships | Zero foreign static gun-surface intersections |
| 18 gun fits on Nomad and Kestrel, 193 actual gear poses each | Zero sampled gear intersections |
| Five installed Nomad/Kestrel foundation placements, 193 poses each | Zero sampled gear intersections |
| Kestrel nose foot cylinder expanded by 50 mm at local Z −1.05 | Zero intersections in all 193 poses |
| 36 actual muzzle rays against the own ship, including all fitted guns/foundations of the selected family | No hit in 100 m, Kestrel gear fully up |
| Nine exported muzzle empties versus each gun's foremost tip plane | Maximum error 0 m in decoded geometry |
| Kestrel profiled skin contacts, 80 independent points including points between authored samples | No missing support |

The direct mesh probe reads actual positions, indices and hierarchy matrices, uses triangle BVHs and separating-axis intersection including coplanar surfaces, and verifies that the sampled gear meshes exist and move. Kestrel uses its exported keyed `GearDown` clip; Nomad uses its live runtime fold/translation formula. Static support contact is recorded separately from free gun bodies and moving mechanisms.

The final Nomad gun offset is socket-local `[0,.015,0]`; the radius .14… .25 m spacer spans local Y 0… .015. The gun bodies now clear both existing capped connectors. The spacer retains contact with the existing docking plate. This removes the need to edit the batched Nomad hull.

Kestrel's nose uses socket-local `[0,0,-1.05]` with rails Z [−1.22,.02] and the same open .58 m central gear channel. Its new return posts meet the chine at all 30 sampled contact points, with measured burial 6.70–11.88 mm. The left wing return has 5.00–6.21 mm burial across 25 points; the right has 4.76–6.28 mm. These are shallow supported contacts, replacing the old ~.12 m outer-edge gap and deep inner-edge overlap. The foremost installed nose tip is now Z −8.430 m.

The legacy Atlas front plinths retain their roughly 2 mm roof contact. The new aft adapter's two stands contact only the deep-petrol central spine; exact triangle checking finds no contact with the graphite radiator fins. The bridge plate sits above the fins. No additional Mark II offsets are necessary for these compact guns, and the original Mark II aft mount continues to fire along ship +Z. The pre-existing full-size S3 cylinder/brace limitation from the original review remains outside these compact bodies; it has not become a generic future-weapon clearance certificate.

The new `weaponParts` plumbing reaches station flight bounds and both walking/EVA call paths. One source defect remains in the inspected helper `src/ship-attachment-collision.js`, SHA-256 `4fa4d8db4d7bacbbb34fca999ea613965f6c946c45f805be11fc2c35c4d1bb21`: when the suit already overlaps an inflated attachment box, the helper rejects every small step until a single step would leave the whole box. That can trap an initially overlapping/restored player.

The reproducible current Nomad port case uses the actual candidate 05 fitted bounds: eye `[-2.50,1.75,-4.50]`, proposed outward eye `[-2.52,1.75,-4.50]`. The helper returns the original eye unchanged. Permit incremental motion toward the nearest exit boundary while continuing to reject entry from outside. The original failing source identity and numeric reproduction are preserved in `attachment-escape.json`.

Reproduce the mesh review with:

```bash
node /tmp/star-agent-ship-weapons-mount-review/candidate-05.mjs
node /tmp/star-agent-ship-weapons-mount-review/attachment-escape.mjs
```

The detailed results and triangle/contact witnesses are in `candidate-05.json`. Prior candidate reports and failures are preserved. These checks certify the listed sampled surface/ray conditions only. They do not prove all inter-sample motion, watertight volume containment, recoil or beam radius clearance, the completed input journey, rendered material quality, FPS, or a final merge gate. The larger armed-ship resource costs recorded in the original review still need actual-scene validation.

**Scoped source closure, same frozen geometry**

The attachment escape defect is now closed. I independently reran the exact Nomad reproduction against helper SHA-256 `e6663f295d851c8399220e5d3e6c54a6f576835348f19a83551459ea5cffd514`: the 20 mm outward step succeeds. Six checks pass: gradual walking/EVA escape succeeds; further inward walking/EVA motion remains blocked; outside entry and a fast complete crossing remain blocked. The original failing result stays in `attachment-escape.json`; the successful follow-up is `attachment-escape-closed.json`.

Reproduce without replacing the failing evidence:

```bash
ESCAPE_OUT=attachment-escape-closed.json node /tmp/star-agent-ship-weapons-mount-review/attachment-escape.mjs
```

There are no remaining blockers in this bounded CPU geometry/source review. The distinct visual, input and performance gates remain pending; no art score is awarded by this CPU closure.

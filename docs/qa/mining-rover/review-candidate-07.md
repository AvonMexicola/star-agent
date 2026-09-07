# Burrow candidate 07 — added structure closure and cabin limits

Reviewed immutable SHA `67b5c6947b06bb020096696d6ece5116c746d4bf6a7ac53f9acd1e9a92ec89f3`, **21,206 triangles / 2,181,360 bytes**. Candidate 05 failures remain preserved; candidate 06 is not independently cleared.

**The specific candidate 05 added-structure blockers are closed. The complete cabin remains subject to the header/side-gap corrections below; this is not an unconditional mechanical or final art pass.**

## What closed

- Both stepped stringers contact all three treads and their own chassis attachment blocks; both blocks contact the floor. All six stringer/tread footprint tests have **zero stringer triangles above the walking top**. This proves a geometric load path, not structural strength.
- Raised outer fender returns start at **Y 1.269972**. All **24** focused steering/suspension/spin wheel states have zero unexpected contacts outside the previously defined own-hub/clevis mating region.
- Gasket overlap into the host skin is **1.495 mm front, 4.008 mm port and 2.991 mm starboard**. Covers intersect their gaskets; front fastener overlap is **5.024 mm**, and side latch overlap is approximately **2 mm**.
- The canonical extra forward waypoint clears the raised head-rest. The 125 sampled camera centres on actual 07 have a **0.149987 m** minimum surface distance for a **0.12 m** sphere. Whole-body transit and continuous sweeps remain separate.
- Front text basis is correct: up +Y, face −Z. Its 718 exported vertices match the intended correction from 04 within **26.3 micrometres**. The roof inset and additional caps stay in the established envelope.
- Actual rest bounds are `[-1.72000003,0.00000816,-2.54999995]…[1.30000427,2.50001478,2.09999990]`; differences from the nominal box are export rounding, not a size expansion.

## Remaining cabin construction

The 13-pose door review preserves header contacts through about 0.55 rad opening. Component classification shows **rubber top/edge seals against the hard roof and roof rail**, not moving glass or metal. The same contact exists on 04. The current top seal reaches Y 2.392 while the roof begins near 2.36, so this cannot be described as a clear complete door sweep.

The parent is preparing shorter vertical seal ends and a flat top gasket whose upper face mates at the roof underside. The proposed rounded gasket with top Y 2.359 would instead leave about a 1 mm geometric gap; a flat mating face is the more direct closure.

Checking the requested pressure-gap question also found inherited lateral openings: starboard near Z −0.665 between windows, the port fixed strip behind the door jamb near Z +0.55, both rear window edges near Z +0.645, and above the fixed starboard pane at Y 2.35–2.359. Actual horizontal rays escape at these locations. The earlier 32 quarter-glazing rays did not cover the complete side envelope and must not be represented as a watertight-cabin certificate. Fixed divider, rear-strip and header geometry is pending. `header-07.mjs/.json` retains component classification and a broader closed-cabin side-ray grid for a repeatable follow-up.

## Reproducibility and limits

Frozen `candidate-07.glb`, `layout-07.json`, `builder-07.py`; actual runtime pose helper `candidate-07.mjs`; `joints-07`, `cabin-07`, `structure-07` and `header-07` scripts/results. Contact points and intended own joints remain explicit. Generic sit-idle hand/yoke and harness contacts are not a driving-animation or IK certificate. Discrete triangle/ray checks are not a pressure simulation, fabrication or continuous swept-volume guarantee.

The corrected `capture-07.mjs` uses `scene.updateMatrixWorld(true)` before skin measurement and checks placed bounds against local posed bounds plus the root translation. Parent execution succeeded; the numerical human placement now agrees with the independent CPU skinning audit. Its native PBR images are scored separately in `review-visual-07.md`. No browser was launched by this reviewer.

# Independent Opus visual recheck — 2026-09-07

Preserved exact final recheck. Disposition of remaining findings is recorded separately in production-record.md.

I've inspected 15 fresh frames plus targeted zooms. Here is the final recheck.

## Independent visual recheck — `player-expedition` (round 2)

**Evidence**: my own single run of `node scripts/character-motion-captures.mjs` — 23 fresh frames, Chromium 151, ANGLE/AMD, **zero console errors or warnings**. I moved the pre-existing `motion/` directory aside first so nothing stale could contaminate the set. The state record confirms every frame was taken with `transition: null` **and** `characterState` equal to the requested state, and mixer time advances monotonically (run 19.54 → 19.86 → 20.19 s), so these are genuine continuous playing frames. Inspected: sit-0/side, climb-0/side, run-0/1/2/side, walk-side, rifle hands/side/palms, pistol palms, tool side/palms, plus 450–500 % zooms on each grip. No tour rerun; scene/UI/scale observations carried over unchanged as instructed.

### Scores

| # | Criterion | R1 | **R2** | Change |
|---|---|---|---|---|
| 1 | Silhouette & scale | 5 | **5** | — geometry/scale unchanged |
| 2 | Materials & detail | 4 | **4** | — maps unchanged |
| 3 | Lighting & integration | 4 | **4** | — carried over |
| 4 | Cohesion | 4 | **4** | — carried over |
| 5 | Function (grip in hand) | 3 | **4** | ▲ aim + pistol grip fixed |
| 6 | Motion | 3 | **4** | ▲ sit and climb now verifiable and correct |

**Average 4.17** (was 3.83). Meets QUALITY.md §3: ≥ 4.0, no item below 3.

### What actually changed — clip fixes vs. evidence corrections

**Genuine fixes (confirmed in images):**
- **Rifle is now shouldered.** The stock is in the shoulder pocket and the weapon is level on the visor sight line. In R1 it floated at chest height with the muzzle low. R1 finding 3 — resolved.
- **Pistol grip encloses.** At 500 % the grip block passes *between* the fingers and the palm, with the thumb along the top. That is a real hold.
- **Both hands are now at the weapon.** In R1 the trigger hand hung in front of the chest; it is now on the rifle grip in every view.
- **Finger curl and adduction** are visibly tighter and fingers are together, not splayed — the 31 mm change is real and observable.

**Evidence corrections (not clip fixes):**
- **Climb** was unverifiable in R1 because the frame caught the preceding stand-up. It is now captured in the actual `climb` state and is a distinct clip from walk/run. Nothing about the clip changed — my prior evidence was simply invalid.
- **Sit** is the nuanced one. The side view shows an unambiguously correct seated pose: hips dropped and set back, thigh carried forward, knee near 90°, torso upright. My R1 finding was made from a front view where foreshortening hid the hip drop. I cannot cleanly separate how much of the improvement is the new camera versus the integrated hip-pivot and leg-retarget work — a front-view RMSE against my own R1 capture is 6.9 % (an out-of-phase run frame scores 11 % for scale), so the pose did shift measurably, but the decisive proof here is the camera angle. **I am recording this as primarily an evidence correction on my part, not as a fix I can credit to the revision.**

### Remaining defects

1. **Support hand still closes on air on both two-handed items** (rifle and cutter). At 500 % on the opposing palm camera, the rifle's support glove forms a fist *below* the handguard: studio background is visible between the fingertips and the palm, there is a gap between the knuckles and the forend underside, and no thumb wraps the rail. The grip centre is roughly one hand-radius too low. The cutter shows the same, though a hand pressed flat to a wide slab body is a more defensible read there. **This is the one item that a strict reading of the "visibly supported by both palms" acceptance condition would still fail.** I have scored it 4 rather than 3 because at gameplay scale and in the plain front and side views it now reads as correctly held — the gap only appears under 450–500 % magnification, whereas in R1 the open splayed hand was obvious at 100 %. If Cees wants that condition met literally, this is the item to hold merge on; that call is his, not mine.
2. **Climb pose reads ambiguous.** Hands reach forward at chest height with a forward torso lean rather than overhead with a near-vertical body. Without a ladder to register against it reads closer to a scramble than a ladder ascent. Scope says there is no physical ladder, so this is a preview-only concern.
3. **Black under-suit crevices still read as unlit holes** — prominent on the lit side of the torso and thigh in the tool palms frame. Carried over from R1, unchanged.
4. **Back remains lower fidelity than the front** (flat texture-only ports, specular seam streak, no life-support pack). Carried over, unchanged.
5. **Studio shadows stay blobby** and do not resolve limbs, visible again across the run sequence. Cosmetic, studio-only.

Per the recheck request I have excluded the first-person floating weapon from scoring — that is the requested presentation, not a defect.

### Motion: observed vs. still unprovable

**Observed**: walk has correct heel-strike and toe-off with natural arm opposition; run shows correct contralateral swing, a real flight phase and the trailing leg folded to the buttock. The run sequence gives a clean ~0.65 s loop period (run-0 and run-2 match at 0.1 % RMSE across Δt = 0.65 s while run-0 vs run-1 differs by 11.4 %) — that is ≈185 steps/min, believable cadence, and proves continuous playback rather than a frozen pose. Legs now read anatomically sound with no knee inversion, consistent with the hip correction having landed.

**Still not provable from stills**: blend easing and transition durations, foot sliding against real locomotion speed (the studio plays in place), popping at clip boundaries during actual gameplay state changes, and whether the support hand tracks the weapon through a firing/recoil cycle. These need video.

### Verdict

**Mergeable.** 4.17 average, no criterion below 3, 508 unit tests passing, 62,177 tris / 24 joints / 26 clips / 8,496,328 bytes all inside the 2026-09-07 exception (≤ 65 k, ≤ 9 MB, two 2K maps). The aim and pistol-grip fixes are real and verified; the sit result is correct but I credit it mainly to better evidence rather than to the revision. Finding 1 is worth a follow-up pass on the rifle's support-grip centre, but it no longer reads as broken at the scale players will see.

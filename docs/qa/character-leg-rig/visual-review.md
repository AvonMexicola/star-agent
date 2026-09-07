# Independent review — expedition leg-rig pivot correction

**Scope:** only the hip-pivot lift + leg retarget in `blender/avatar-legs.mjs`. Not whole-character acceptance.

**Evidence I took myself:** `node scripts/character-leg-review.mjs` → 12 fresh renders in `/home/cees/.cache/star-agent-leg-rig/candidate` (0 errors, 0 warnings). Inspected `original-hip-pivots.png` plus before/after pairs for crouch (side, front), jump 0.333 front, jump 0.667/1.1 side, sit 0.5 side, rest side.

**Cause confirmed visually.** In the pivot capture the magenta hip markers sit clearly *inside* the ceramic thigh plate, roughly a hand's width below the flexible hip seam, while the cyan markers correctly land on the knee covers. That is a real defect, not a cosmetic preference.

**Does it improve the reported distortion?** Yes, and legibly:
- **Crouch side:** the mid-thigh crease and shortened femur are gone; the plate now hinges at the seam and the knee cover sits over the actual bend. Shin/ankle/foot placement is unchanged against the original.
- **Jump 0.333 front:** the raised leg's thigh no longer collapses into a bunched dark wedge; upper/lower leg proportion reads human.
- **Sit side:** the thigh reads as one continuous plate to a lower knee instead of buckling mid-plate.
- **Rest side:** visually identical to source, consistent with the inverse-bind-preserving claim.

## Rubric (this correction only)
| # | Item | Score | Note |
|---|---|---|---|
|1|Silhouette & scale|**4.5**|Leg proportion now reads correctly in deep poses; height unchanged.|
|2|Materials & detail|**4**|No geometry/UV/texture change; plate detail survives the bend. Inherited material polish not judged.|
|3|Lighting & integration|**4**|Unchanged shading; feet stay planted, no new float or shadow mismatch.|
|4|Cohesion|**4**|No token or palette impact.|
|5|Function|**4.5**|Hinge is where the armour hinges; grips/sockets untouched, weapon-grip tests pass.|
|6|Motion|**4**|Frozen poses only — see caveat.|

**Average ≈ 4.2, no item < 3.**

## Concrete remaining defects
1. `crouch-0.75-side` / `jump-1.1-side`: a thin dark under-suit wedge is exposed at the front hip crease on the deeply flexed leg — reads as a small gap, not a fold.
2. `jump-0.666667-side`: hard dark crease behind the trailing knee; the knee cover slides slightly off the joint.
3. `sit-0.5-side`: knee pad reads flatter/less domed than in the original; upper-thigh volume is marginally thinner near the hip.

These are skin-weight polish items around the moved joint, owned by the character owner.

## Frozen vs continuous
Everything above is **static pose evidence**. I have not observed continuous playback: no popping, easing, pole-flip-in-motion, foot sliding or blend behaviour is verified by me. The claimed 3 mm inter-key sole bound, the 1,017°/s peak and the pole-flip fix are numeric/test evidence I read but did not independently observe in motion. No FPS or hardware-controller claim is made or checked.

## Verdict
**Narrowly: accept this bounded correction.** It fixes a genuine rig error and introduces no obvious new shape defect in the poses captured. Merge into the owner's candidate, not as a standalone feature. Continuous-motion review, the three weight defects above, and complete-character acceptance remain open with the character owner.

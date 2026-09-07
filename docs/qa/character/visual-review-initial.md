# Independent Opus visual review — initial candidate

Preserved exact report from the reviewer session on 2026-09-07. Later dispositions are recorded separately.

I have what I need — 12 full captures plus 5 zoom crops. Here is the review.

## Independent visual review — `player-expedition` character upgrade

**Evidence**: my own run of `node scripts/character-review-captures.mjs` (Chromium 151, ANGLE/AMD Radeon 860M, hardware GL). 26 character captures + 9 tour views, **zero pageerror/console errors or warnings** — the script throws on any, and it proceeded to the tour. Inspected: old/new suit desktop, new phone, rifle/tool/pistol hands, rifle side + back, sit, climb, run, wave, props intake, gameplay first/third-person/walk, plus 5 magnified crops.

### Scores

| # | Criterion | Score | Basis |
|---|---|---|---|
| 1 | Silhouette & scale | **5** | Props intake proves 1.85 m against the 1.8 m reference on a 1 m grid — correct. Domed helmet, angular pauldrons, knee plates and tapered boots give a distinct read at 14 m and 19 m in gameplay. |
| 2 | Materials & detail | **4** | Front is a large jump over the old suit (which had a black void visor and flat blobby limbs): layered bevelled plates, panel lines, ribbed under-armour, a properly specular visor. Back is markedly weaker. |
| 3 | Lighting & integration | **4** | In the hangar the suit picks up warm bounce from the floor strips on one side and a green rim on the boots; ACES holds, whites never clip beside the emissives. No discernible contact shadow at the boots. |
| 4 | Cohesion | **4** | Matches the ship's cool blue-grey hard-surface language; studio page uses the product's own tokens. Carries no faction accent at all. |
| 5 | Function (grip in hand) | **3** | One hand grips; the support hand does not close on the weapon. |
| 6 | Motion | **3** | Gameplay locomotion is good; the settled `sit` pose is wrong. |

**Average 3.83** — below the §3 bar of 4.0. No item below 3.

### Findings, ranked

1. **Support hand does not close on the weapon** (image defect). The side profile is unambiguous: with the rifle equipped, the forward glove's fingers are *extended and splayed underneath* the handguard — the forend passes above open fingers, no wrap. The pistol view shows the same: the sidearm's body floats relative to a splayed glove whose fingers overlap the frame instead of wrapping a grip. The rear/trigger hand is close to correct. This is the one requirement the scope statement calls out by name ("visibly supported by both palms"). Candidate owners: `public/models/props/equipment-sockets.json` grip transforms and `blender/avatar-grips.mjs` / the glove morphs — *I did not open these; that is where to look, not a diagnosis.*
2. **`sit` settles into a standing crouch** (image defect). The script waits for `transition === null` before shooting, so this is the clip's resting state, not a mid-blend — yet the hips stay at standing height, the thighs are vertical and the feet are flat. It does not read as sitting. Scope notes sit is a hook with no seating system, but the previewed clip contradicts its own label.
3. **Rifle is not shouldered in the "aim rifle" pose.** The buttstock floats in front of the chest, well forward and below the shoulder pocket, and the visor is not on the sight line. Reads as "holding at chest", not aiming.
4. **Back is a lower-fidelity surface than the front.** At 400% the mid-back "ports" are flat texture ovals with no geometric depth, scattered asymmetrically; there is a bright specular seam streak down the torso/arm boundary; and there is no life-support pack on an EVA expedition suit. Also visible in gameplay: black inter-plate crevices receive almost no ambient fill and read as holes rather than under-suit fabric.
5. **First-person weapon has no arms or gloves.** The rifle viewmodel sits bottom-right, clipped by the screen edge, with nothing holding it — a floating weapon in the player's own view. Least severe of the five but it is the view the player occupies by default.

Not defects, checked and cleared: scale, socket attachment across all three items, back-stow (the dark mass over the shoulder in gameplay *is* the slung rifle — I confirmed this on a brightened crop), phone layout at 390×844, budget compliance (62,177 tris / 2×2048² / 26 clips, and hangar at 547 draw calls / 836,857 tris against §5's ≤600 / ≤900k).

### Motion: what the frames actually show

**Observed**: `run` has correct contralateral arm/leg swing with the trailing foot lifted. The two gameplay frames prove locomotion genuinely translates the character — ship distance goes 14 m → 19 m with a proper mid-stride pose, not an in-place shuffle. `wave`, captured 90 frames after the button, reaches full extension clear of the head. No T-pose, popping or flicker in any captured frame, and no console errors across all 26.

**Not proven, and I will not claim it**: easing curves, blend durations, foot-plant lock versus locomotion speed (foot sliding), popping at clip boundaries, and whether the support hand tracks the weapon through a firing/recoil cycle — all need video, not stills. The `climb` capture is inconclusive: its caption read "stand-up" while the selector said "Climb ladder", because the script only waits for settle on `sit`, so that frame caught a transition out of the previous state. It says nothing about the climb clip either way. I attempted one targeted follow-up capture to settle sit and climb properly, but the write of the probe script wasn't permitted, so climb remains unverified.

### Mergeable?

**Not as it stands** — 3.83 against a 4.0 gate. This is a near-miss, not a rejection: no criterion is below 3, and the upgrade is a clear improvement over the previous suit on every axis I scored. Fixing finding 1 (support-hand grip) and finding 2 (sit pose) would plausibly lift criteria 5 and 6 to 4 each, giving **4.17** and a pass. Findings 3–5 are polish and can follow.

The alternative legitimate path is Cees's explicit "polish later" waiver under §2, which would be reasonable if `sit` is deliberately a stub awaiting a seating system — but I would not waive finding 1, since two-palm support was the named condition of the authorized scope.

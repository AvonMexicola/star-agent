> Archived candidate04 review. A later expanded check found that its head-rest
> move invalidated the retained boarding-eye clearance claim. Candidate07 adds
> a forward waypoint and rechecks the actual path. The later review also records
> an inherited rubber header-seal/roof contact. See the current production record
> and final review; this historical record is not whole-mechanism acceptance.

# Burrow M-04 — mechanical closure, ready for rendering

Final reviewed identity: `80c495d025d7529acc79e8ce743547b3c361d167b70bd0d63f122a83566f762e`, 2,291,904 bytes / 19,528 triangles. Independent CPU review by `/root/kestrel_reviewer`. No GPU run or art score is claimed.

**Disposition: the specific moving-wheel, rear-link/cargo and backpack/backrest blockers are closed within the checks below. Candidate04 is ready for native PBR visual review. Runtime journeys, driving animation and final art acceptance remain separate.**

## What closed

- **Front damper/rim:** the non-spinning inboard clevis and0.32 m link endpoint remove the previous forged-rim penetration. Across24 focused wheel states with actual steer, suspension, spin and articulated link transforms, every wheel contact lies in the own clevis/hub mating region. No outside-rim contact remains. The hub region test uses carrier-local inboard X[0.10,0.235], radialYZ≤0.215; it does not exclude the entire wheel, arm or damper.
- **Rear linkage and storage:**20 focused rear-link configurations cover five suspension positions. Every link/hull intersection point is inside the authored rear suspension-mount box, X±[0.69,0.79], Y[0.43,0.90], Z[1.65,1.75], with1 mm numerical allowance. No point reaches the rerouted rail, raised load frame or mineral cassette. The prior long contact through storage is closed. Contacts at the shared clevis and structural mounting brackets remain intentional; the raw results retain all of them.
- **Suited seating:** the moved back panel's full conservative box has zero intersections with the correctly posed human. Candidate04 also clears the head-rest/backpack intersection: actual head-rest bounds Y[1.74000075,1.97997999] have zero posed-human triangle overlap. Its lower edge is60.52 mm above the previously intersecting backpack top.
- **Exact04 delta:** all37,329 evaluated exported vertices were compared to candidate03. Only96 head-rest vertices changed, each moving approximately+0.18 m inY. Every other vertex is identical; topology and material records are identical. This makes the03 linkage findings applicable to04 without repeating an unrelated mechanism tour.

The earlier door/step, glass/jamb, front-quarter glazing gaps, work-lamp/gimbal and seat-location closures remain documented in candidate02. Fixed steps use their explicit floor support joint. The eye-path result remains scoped to100 sampled positions with a0.12 m sphere and a0.149987 m minimum surface distance, not a whole-body continuous boarding certificate.

## Limits retained

- These are sampled poses and exact surface/contact-point checks, not a continuous swept-volume or manufacturing certificate.
- Front link roots still meet the intentionally retained keel/footwell attachment skin. Raw contacts remain recorded; this report does not silently exclude entire links or certify complete bearing-pocket fabrication.
- Generic sit-idle hands/harness and yoke contact are not a certified driving animation or hand-IK pose. Visual review should judge the actual posed evidence, and runtime review should judge implemented player behaviour.
- Geometric glazing closure does not implement pressure simulation.
- This report provides no material/silhouette score, gameplay/controller/touch acceptance, FPS claim, PR/merge approval or final feature gate.

## Evidence / reproducibility

`candidate-03.glb`, `layout-03.json`, `candidate-04.glb` and `layout-04.json` preserve exact snapshots. Candidate01/02 failing evidence is untouched.

- `joints-03.mjs` / `.json`:24 focused wheel states, explicit wheel-carrier contact coordinates, and raw link contacts.
- `closure-03.mjs` / `.json`:20 rear-link configurations checked against the specific authored mount boxes, plus posed-human/backrest/head-rest diagnostics.
- `closure-04.mjs` / `.json`: exact geometry delta, actual04 head-rest bounds and zero posed-human overlap.
- `cabin-03.mjs` / `.json`: actual skinning using joint-world × inverse-bind matrices; no cloned-skeleton or undeformed-bounds shortcut. Human SHA`8a46b5b09f0659661a0e4373db159f9b87d43136144e118e908265f45ba6a52d`; idle height1.79950 m.

The read-only helpers in `/tmp/star-agent-ship-weapons-mount-review/{probe,exact-fit}.mjs` and local`contact-lib.mjs` accompany these probes. Candidate03's pose helper now reads its immutable local snapshot so later production exports cannot change the review input.

## Ready native render fixture

`/tmp/star-agent-rover-review/capture-04.mjs` verifies final04 and human hashes, then loads actual PBR assets and the original human skeleton. It measures skinned vertices after skeleton/animation updates, checks actual1.8 m standing and seated bounds, and uses projected-vertex guards for complete model framing.

The fixture is **ready but has not been executed by this reviewer**. Node syntax checks passed for the outer fixture and the unchanged embedded browser module. It makes one browser launch with no retry and stores browser temporary files on disk. Default output: `/home/cees/projects/.mining-rover-qa/reviewer/candidate-04`; override with`ROVER_REVIEW_OUT`. Default port5434; override with`ROVER_REVIEW_PORT`.

Views: six desktop1440×900 captures (human exterior, open port/posed seated human, cockpit, cutter roots, articulated underside, rear) and one390×844 phone framing capture. These isolate asset materials and explicitly evaluated poses. They do not pretend to be the actual game, live telemetry, emitted mining effects, touch operation or a performance test.

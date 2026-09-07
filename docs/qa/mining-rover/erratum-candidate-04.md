# Candidate 04 — retained eye-path claim corrected

The head-rest-only closure for SHA `80c495d025d7529acc79e8ce743547b3c361d167b70bd0d63f122a83566f762e` correctly measured the seated backpack/head-rest clearance. Its statement retaining the earlier 0.149987 m eye-path minimum was incorrect: the path had not been rerun after raising the head-rest.

The candidate 05 rerun, with the same raised head-rest and old canonical route, found a minimum camera-centre distance of **0.108923 m**, failing a 0.12 m sphere at four of 100 sampled centres near the final inboard segment. The head-rest is the nearest surface. This is inherited from 04, not caused by the new 05 roof. `cabin-05.json` preserves the failure.

Adding the forward waypoint `[-0.55, 2.12, -0.65]` before moving inboard clears that head-rest. `entry-route-05.mjs/.json` test 245 centres per candidate path; the chosen route has a 0.149987 m minimum. Candidate 07 includes the waypoint in its canonical layout and `cabin-07.mjs/.json` confirms it on the actual 07 export. These remain sampled camera-sphere checks, not whole-body or continuous swept-volume certificates.

The original candidate 04 report and images remain historical evidence. The separate pre-render human-bounds fixture error is described in `review-visual-04.md`; it was corrected and successfully validated in the candidate 07 render metadata.

# Independent Opus visual review request

You are the senior game art/UI reviewer required by QUALITY.md §3. Review this
character upgrade, not the entire inherited game. Read QUALITY.md and the current
production record. The independent functional review is recorded in
functional-review.md; its listed fixes are summarized in production-record.md.
Do not edit source, commit, push, merge or inspect unrelated working directories.

Take your own fresh screenshots by running `node scripts/character-review-captures.mjs`
from this worktree. It uses the live renderer at http://127.0.0.1:5318, hardware
Chromium and a home-cache temporary directory, then exits. Outputs are under
`~/.cache/star-agent-character/opus-review/`: six fixed tour views, same-camera
old/new suit desktop and phone, actual gameplay first/third-person, props scale
intake, hand/side/back equipment views and motion samples. Inspect the actual
images with Read. You may take further captures with Playwright to resolve a
specific concern, but do not rerun unrelated large suites or read every old image.
The script takes about two minutes; allow its process to finish.

Score all six rubric criteria 1–5, give average, rank up to five concrete findings
(file/element/fix), and say whether this bounded visual change is mergeable.
Acceptance is average ≥4.0 with no item below 3. Do not rubber-stamp it; distinguish
actual image defects from speculative code causes. Explicitly state what motion
was observed from frame sequences and what still images cannot prove.

User-authorized scope: 62,177 triangles, 24 joints, 26 animation clips, two 2K PBR
WebP maps, two glove morphs. Existing credits used in Meshy, no hosted dependency.
This request supersedes the old 20k/1K character default, recorded in QUALITY.md.
The gun/tool must be visibly supported by both palms where appropriate. Ladder,
sit, reload, pickup and injury inputs are animation hooks and studio previews;
there is no new physical ladder, seating system, ammo reload or damage source.

Keep this review bounded: inspect around 12–16 representative images, use the
recorded test results for functional facts, and return the completed report in
your final response. Do not create a separate review file or rewrite source.

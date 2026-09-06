# Star Agent — Quality bar

*Owner: Claude (PM/QA). Added 2026-09-06 after Cees's review: "assets look whiteboxy, the map had three giant blobs that
should have been an obvious planetary system". Tests passing is not the bar. Looking finished is.*

## 1. Art direction (what "finished" looks like)

**Faction language.** White armour (0.8) and matte dark polymer (0.16) with brushed metal (metallic .65 / rough .35) and
**mint #b6efd1** emissive accents; warm amber only for warnings and hangar interiors. Reference board: Star Citizen
(ships, stations, MFDs), Elite Dangerous (system map, HUD hierarchy), Mass Effect (gear), Alien: Isolation (UI grain).

**No whitebox ships.** An asset is *not done* if it is untextured primitives, uniform grey, or a Meshy blob. Every shipped
mesh has all of: a readable silhouette at 30 m, material definition (bevels that catch light, panel lines, insets, edge
wear or grime where plausible), at least one emissive/status detail where the design calls for it, correct scale against
the 1.80 m silhouette on `/dev/props.html`, an origin where the manifest says (grip, base, back-plate, feet), and a
review render in `docs/qa/`. Hard-surface = Blender script; organic = Meshy; both are re-buildable from the repo.

**UI is information first.** A map shows where you are, where you're going, the route, and the scale. An MFD page shows
the number that matters largest. Every screen uses the design tokens (`--mint`, `--line`, `--muted`, Space Mono labels,
Barlow Condensed numerals, DM Sans body) and the base `dialog` chrome. New palette = defect.

**World.** No popping (geomorph + hysteresis), no z-fighting, no flat plane views: at any destination the screenshot must
show relief, material detail and something on the horizon. Night has light sources. Hangars are lit by their lights.

## 2. Definition of Done — every PR (functional + visual)

- [ ] `npm test` green; `vite build` green; zero console errors/warnings in the browser check.
- [ ] Screenshot tour at the 5 fixed viewpoints (§4) attached to the PR (or in `docs/qa/pr-N/`), plus before/after for
      anything visual, at 1440×900 **and** 390×844 for UI.
- [ ] Perf: draw calls, triangles and ms/frame at the viewpoint the PR affects, within budget (§5), noted in the PR.
- [ ] Accessibility/reach: works with keyboard, controller and touch where the feature is reachable at all.
- [ ] HANDOFF `READY FOR REVIEW: <files>` line; PR based on `feat/visual-fidelity`; no branch switching in the shared tree.
- [ ] **Visual PRs: an Opus review with the rubric (§3), score ≥ 4.0**, or an explicit "polish later" decision from Cees.

## 3. Visual review rubric (Opus reviewer, 1–5 each; merge at ≥ 4.0 average, no item < 3)

| # | Criterion | 5 looks like |
|---|---|---|
| 1 | Silhouette & scale | reads instantly at distance; correct size next to the human/ship |
| 2 | Materials & detail | bevels, panel lines, wear, emissives; nothing uniform or blobby |
| 3 | Lighting & integration | sits in the scene's light; shadows; matches ACES exposure; no blown emissives |
| 4 | Cohesion | faction language, design tokens, same product as the rest of the screen |
| 5 | Information design (UI) / Function (assets) | the map maps, the gauge gauges, the grip is in the hand |
| 6 | Motion | no popping, no flicker, transitions eased, animation timing believable |

Reviewer prompt (reuse): *"You are a senior game art/UI reviewer. Score §3 for `<PR>` from screenshots you take
yourself at the §4 viewpoints (desktop + phone for UI). Be concrete: file + element + fix. Rank top 5. Say mergeable
yes/no and why."*

## 4. Fixed QA viewpoints (screenshot regression)

`?intro=0&seed=7291`, 1600×900, HUD hidden unless the PR is UI: **orbit** (start), **coast** at 95 m facing the sea,
**forest** at 95 m, **highlands** at 700 m, **hangar** (opening t = 10 s), **cockpit** (seated). Playwright captures to
`docs/qa/baseline/*.png`; a PR's captures are diffed (pixelmatch, 2 % tolerance, masked HUD clock/fps); any diff is a
review item, not an automatic fail. Baselines are updated only in the merge commit that intentionally changes the look.

## 5. Budgets (laptop GPU, 1440×900)

| Scene | draw calls | triangles | frame |
|---|---|---|---|
| Orbit | ≤ 300 | ≤ 400 k | ≤ 8 ms |
| Surface (forest) | ≤ 900 | ≤ 1.8 M | ≤ 12 ms |
| Hangar / cockpit | ≤ 600 | ≤ 900 k | ≤ 10 ms |
| Modal open (map/menu) | scene render skipped or ≤ 25 % of the above | | |

Assets: props ≤ 10 k tris / ≤ 1 MB, characters ≤ 20 k / ≤ 2 MB, ships ≤ 60 k / ≤ 4 MB, textures ≤ 1024² WebP.

## 6. Process

1. **Two-stage review on every PR**: Claude (functional: tests, build, tour, perf) → Opus (visual rubric) for anything
   the player sees. Findings go to HANDOFF as numbered requests; the PR isn't merged until the score passes or Cees
   waives it.
2. **Weekly quality pass** (Claude): full tour at the §4 viewpoints on the integration branch, a scored report in
   `docs/qa/weekly-<date>.md`, top-10 defects filed. Cees's own review notes are logged there too.
3. **Asset intake**: nothing enters `public/models/` without a manifest row, a props-page render, and a rubric score.
4. **Design tokens are law**: a PR that adds a hex colour or a font-family outside `src/style.css` tokens gets a
   review item automatically (grep in CI).
5. **"Whitebox" is a label, not a shipped state**: placeholder assets (mannequin, capsules, boxes) may be merged only
   behind the `?dev=` flag or when the roadmap marks the slice as placeholder-allowed.

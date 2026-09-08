# SA-TOOL-001 / SA-TOOL-002 — handheld delivery

Status: author implementation, final portrait framing and full input journeys
validated; ready for local integration. Parent retains integration.
Branch `art/rotating-mining-tool`, worktree `.worktrees/rotating-mining-tool`.
Current combined runtime `d666490` includes checked Garage `83e10ae` and
Transport `65f1721`; no pending Pirate or Sentry source is copied.
Private preview 5672 / memory API 8672 is used only by the serialized QA guard.

## What changed and what remains

Construction draws a compact Meridian builder with live piece/status text and a
success-only projection. Existing recipes, costs, placement authority and input
router remain responsible for construction. Leaving restores prior equipment.

The supplied yellow mining reference becomes an editable, reproducibly built
K-17 Mk1. Its three-pod cartridge accelerates with the actual heat-gated beam
and coasts down; the bore, lens and grip sockets remain fixed. The K17-M30 mount
supports later authoring, but higher-tier selection or bonuses are not implemented.

Supplied bandage and stim GLBs are preserved and normalized for the native prop
library. Their existing inventory effects are unchanged; medical use/equip
animations remain separate. The repair tool filename has not been identified.

Owned source and budgets are in the [builder record](../builder-tool/README.md),
[cutter record](README.md), `assets/builder-tool/`, `assets/field-cutter/` and
`assets/medical-items/`. Shared equipment/held-tool hooks belong to this combined
branch; the delegated Sentry variant remains isolated with its feature owner.

## Validation

- Combined `d666490`: all 158 registered normal test files pass with Node
  `--test --test-concurrency=2`, 72.02 s. Log: ignored
  `assets/field-cutter/.staging/all-unit05.log`.
- `VITE_DEV_TOOLS=1 node tests/handheld-tools/build-preview.mjs`: passes in
  45.03 s, with the existing large-chunk warning; `production05.log`.
- `npm run check:repo`: passes. `npm run plan:checks -- --base
  origin/dev/all-features` completes; this is a suggested plan, not gameplay proof.
- Builder browser04: complete controller, keyboard and native CDP touch journeys
  pass, 3.9 min. Combined01 repeats the full controller route successfully.
- Combined02 at `d1078be`: builder keyboard/phone, native cutter/medical props,
  and the complete land/walk/mine/inventory/return journey pass, 2.9 min. Held
  inputs across modal/focus/device transitions are exercised; sources and GLBs
  remain unchanged throughout. Zero application errors, warnings or failed
  requests in the passing run. Raw guard/state/video evidence is retained in
  `assets/field-cutter/.staging/qa-combined02`.
- Combined03 at `d666490`: final complete controller-mining/keyboard/native-touch
  case passes in 1.3 min with no application diagnostics or failed requests.
  Final phone head/emitter framing inspected; all guarded source and GLB hashes
  are unchanged. Evidence: `assets/field-cutter/.staging/qa-combined03`.

Browser: Chromium 151.0.7922.173, ANGLE AMD Radeon 860M / OpenGL ES 3.2,
1440×900 and 390×844, seed 7291. Gameplay uses injected standard Gamepad input,
keyboard and trusted native CDP touch; physical-device testing, independent art
review and FPS acceptance are not claimed. Native fixture views and gameplay
captures are labelled separately. Original failed author and browser attempts
and their corrections remain in the production records.

## Integration and operations

Local integration is not yet claimed. The intended target is the existing
`dev/all-features` preview on 5178 with API 8087. This handheld delta adds no
server protocol, schema or database change. Refresh the unchanged Vite config's
timestamp once after the checked merge so its model revision map includes the
new GLBs; verify served bytes and preserve the existing services and dirty journal.
No production deployment or protected branch merge is authorized by this delivery.

## Resume here

Serialize the checked local merge, preserve the dirty journal, verify served
hashes and the regenerated model revision map, then update the local guide/root
journal and open the draft PR for Cees's gate. No further handheld browser job is
queued. Continue the separately delegated Sentry review/integration when ready.

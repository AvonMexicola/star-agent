# SA-COMBAT-001 — Regional enemy ship encounters

Status: active. Sponsor: Cees / @AvonMexicola. Implementer: Codex mission designer.
Branch: `feat/enemy-encounters`, base `c766544b5c9beb98ec3c66b50595e4c974b461f3`.
Worktree: `/home/cees/projects/star-agent/.worktrees/enemy-encounters`.
Preview: 5398. No new dependencies, assets, services or shared main-loop hooks.

## Problem and result

The existing offline console offers the same two-ship patrol everywhere. Offer
Easy, Standard and Hard sorties specific to Aeon, Selene, Pyre, Miasma and the
Selene asteroid belt. Travel to a region normally, accept through Contracts,
follow a nearby beacon, fight the advertised formation and waves, file a detailed
session report, and return to flight. Reuse the authored Nomad/Kestrel hulls and
real fitted weapons. Encounters are explicitly accepted, never surprise attacks
on a new pilot leaving the hangar.

## Scope and acceptance

- Regional briefs and rosters; difficulty changes integrity, pilot handling and
  firing pressure. Hard sorties add a telegraphed second wave with breathing room.
- Beacon and ships remain in the accepted region, safely above canonical terrain;
  belt patrols use clear space above the asteroid plane. No teleport on acceptance.
- Accurate total kills, wave progress, failures, abandonment and single-use report
  filing. Session report history is bounded. No currency, loot or durable rewards.
- Existing controller router: Menu / Contracts, D-pad / A selection, B resume,
  sticks flight/aim, RT fire, result inspection and return. Existing keyboard and
  touch actions remain. Held-input suppression retains the shared gate.
- Offline only. Existing spherical ship hits and asteroid weapon obstruction are
  retained; NPC terrain/asteroid avoidance and ship collisions are outside scope.

## Verification and delivery

Extend simulation tests for difficulty, region placement, reinforcement delay,
pause/abort/death and report isolation. Run repository checks and suggested plan,
unit/build and a focused actual-game controller encounter across each difficulty
and location. Inspect 1440×900 / 390×844 interface captures and live combat rendering.
Record failed attempts, backend, source and device limitations. Independent review
and physical controller testing remain distinct from builder checks. Integrate a
checked local checkpoint under Cees's standing instruction; no public deployment.

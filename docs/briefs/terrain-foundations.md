# SA-BUILD-002 — Foundation-first construction

Status: locally integrated and author-validated. Sponsor: Cees. Implementer: Codex. Branch feat/terrain-foundations,
base 32966e3 (local development including completed base commerce and settlements).
Private worktree /tmp/star-agent-foundations; preview 5642. No new dependencies.
Owned paths are recorded in project/tasks/SA-BUILD-002.json. Checked runtime
4396029 is integrated with current settlement/combat development at 8b5ecd4.
Shared preview 5178 and API8087 were refreshed together; private preview is stopped.

## Result and acceptance

Start a site by placing a foundation; build walls, doors and storage before a
mainframe exists. Fit one mainframe on an existing deck without moving its site,
spending materials/allocating supplies atomically. Sites without mainframes have
open doors; fitting a mainframe enables ordinary owner door controls. Preserve the
existing explicitly open commissioned trade-site visitor route. Solo construction
is still solo; this does not introduce shared multiplayer construction authority.

Square, triangle and curved foundations adapt their depth to dry canonical terrain
up to 8 m, with the existing quarter-metre height controls. A cliff variant uses
two 45-degree steel braces with actual terrain contact; reject unsupported spans.
Rendering, ghost, placement collision and saved dimensions must agree. Old saves
retain their original .6 m depth. Optional supportDepth is bounded and validated.

Exercise paid foundation → walls/door → mainframe on deck, save/reload, no-core
buffer/power paths, blocked/double placement and actual controller entry, aiming,
placement, material result, return plus held-input gates. Retain keyboard/phone
screens and actual renderer evidence. Physical controller and independent review
are separate from builder checks. Local integration requested; no public deploy.

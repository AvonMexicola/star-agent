# Independent integration review

Reviewed 2026-09-06 in `/tmp/star-agent-base-work`, branch `feat/base-building`,
against the working implementation based on `6f80fc0`. This reviewer did not author
the implementation and changed no runtime source. The review covered construction
state and transactions, body anchors, placement/support/collision, inventory access,
crafting, construction deposits, mining/weapon obstruction, navigation and shared
controller routing. Read the repository instructions, quality bar and slice/pipeline
documents before reviewing.

## Confirmed finding: fixed during review

**P1 — malformed construction records could prevent the entire game from starting.**

At the original `src/build/state.js:15`, `validBuild` dereferenced a claim before
checking its shape. The mainframe count also dereferenced every piece before the
piece-validation loop. A persisted `build.claims: [null]`, or a correctly shaped
claim containing `pieces: [null]`, therefore threw instead of returning `false`.
`BuildSystem` calls this validator at initialization before the anchor-restoration
error handler; the exception could reach the fatal startup handler in `src/main.js`.
This broke the promised behavior of retaining the save and pausing construction.

Independent Node reproductions against the original implementation returned:

```text
THREW Cannot read properties of null (reading 'id')
THREW Cannot read properties of null (reading 'type')
```

Sent the finding to the integrating agent immediately. That agent added claim and
piece object/array/null guards before dereference and an own-property piece-type
check, plus persisted malformed-save regression coverage. The latter also rejects
`constructor` as a piece type instead of accepting an inherited object property.

Post-fix independent verification:

- Constructing `BuildSystem` with `claims: [null]` now returns `blocked: true`.
- `node --test --test-name-pattern='malformed claim and piece' tests/build-state.test.js`
  passed. This targeted regression checks null claims, null pieces and inherited
  piece-type names through save reload and initialization, retaining the raw save.

**Status: corrected and independently verified.** No additional high-impact defect
was confirmed in this bounded review.

## Follow-up: upper-floor placement correction

The integrating agent subsequently found a separate **P1 functional defect**:
an upper floor's 0.18 m slab intersects the top band of its supporting walls, so
the general occupied-space check rejected the intended joint before checking the
two-wall support requirement. This reviewer did not discover that defect.

Independently inspected the correction in `src/build/system.js`: the exception is
limited to a floor and wall-category piece at the matching storey height and within
the existing supporting-edge distance. It works in either placement order, retains
the separate two-wall support requirement, and explicitly excludes door-sweep boxes
from the exception. Floor/floor duplication and arbitrary piece overlap remain
subject to the normal occupied-space check. No new concern was identified in this
narrow correction.

Independently ran:

```sh
node --test --test-name-pattern='an upper slab|malformed claim and piece|placement rejects overlapping' tests/build-state.test.js
```

The targeted check passed. Its new slab regression uses actual `place()`, verifies
successful material consumption, and rejects a duplicate floor. The selected
existing regression also checks unsupported upper-floor rejection. Re-read the
null/object guards and confirmed they still precede claim/piece dereferences.
No browser or GPU was launched for this follow-up.

## Follow-up: wall rotation parity (2026-09-07)

Opus identified a wall-facing defect when an odd quarter-turn was retained from
another selected piece. Wall actions add two quarter-turns; the previous candidate
mapping discarded both odd states, so rotation could leave the facing unchanged.
The integrating agent changed the candidate offset to `Math.floor(turn / 2) * Math.PI`.

Independent Node checks called the real `BuildSystem.candidates` and `rotate`
methods for wall, window and doorway, all four initial turn values, both rotation
directions and all four foundation-edge sockets. All **96 flip checks passed**:
one action reverses facing by 180 degrees, snapped positions and ordering remain
unchanged, and a second action restores the original candidates. No runtime source
was edited and no GPU/browser was launched. This verifies the bounded rotation fix;
it is not a replacement for the separately required visual review.

Also verified the repository regression at `tests/build-state.test.js:26`, named
`wall pieces flip on their socket after any quarter-turn carried from another piece`.
It passed independently with `node --test --test-name-pattern='wall pieces flip on
their socket' tests/build-state.test.js`. An intermediate reviewer message saying
the regression was absent was mistaken; the test is near the beginning of the file.

## Integration assessment and limits

Code inspection confirms that placement combines payment, piece IDs, claims and
physical containers in one prospective `MiningStore` write; crafting uses that same
store. Construction buffer spending is opt-in and restricted to the actor's local
claim, while physical container availability is checked by distance. Building
obstruction is connected to both mining camera/muzzle checks and weapon targeting.
The shared controller route consumes contextual construction actions, and the
mining tool suppresses firing while construction is active.

These observations establish integration paths, not a complete gameplay acceptance
result. I did not launch a browser/GPU, rerun the broad suite, measure performance,
inspect screenshots or perform a controller journey. The known mainframe-to-storage
dialog transition was being fixed and checked by its UI owner; I did not claim that
browser result. The integrating agent separately reported the Pyre core placement
and next-day reload journey passing; I did not independently reproduce it.

The documented limits remain: local ownership, bounded claims/storage, conservative
ship box sweeps without angular sweep, no mineable-rock overlap check in placement,
instant door state changes, and no engineering/power/survival systems. These are
scope limits, not newly reproduced failures in this review.

This report is an independent functional/code review. It is **not an Opus visual
review or merge approval**. The required visual rubric, screenshot/controller
evidence and performance gates must retain their separately recorded status.

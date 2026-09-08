# Terrain foundations — development verification

Implemented and author-validated on 2026-09-08; local integration follows the
checked candidate. Independent art review and physical-controller testing are not
claimed. No public deployment. Source is the `feat/terrain-foundations` change;
asset identity and rebuilding instructions are in [asset.json](asset.json).

## Player result

A first foundation creates an unsecured site. Doors stay open until a mainframe
is installed on the ground or an existing supported deck. The mainframe retains
that site's anchor/ID and creates its supply buffer atomically. Empty mainframe
removal keeps the building and reopens access. Square/triangle/curved foundations
extend their concrete to canonical dry terrain up to 8 m; the new 4×4 m cliff deck
uses two articulated 45° braces. Full collider/ghost/render dimensions agree.

## Checks actually run

- `npm test`: final source passes all 149 files, including seven new terrain,
  transaction, removal, actual-export and account-save cases.
- `npm run test:multiplayer`: 191 pass, two existing opt-in database skips.
- `node --test tests/base-power-database.test.js`: one actual isolated PostgreSQL
  restart, account isolation, concurrent revision/conflict rollback and expiry
  regression passes. It used a temporary database, not shared development data.
- `npm run build`: passes; inherited >500 kB chunk advisory remains.
- `npm run check:repo` and `npm run plan:checks -- --base origin/dev/all-features`:
  pass. The remote comparison includes already integrated feature work, so the
  suggested broad plan is not a claim that every listed manual scene was repeated.
- `npm run test:browser -- -c scripts/terrain-foundations.config.js`: final two
  tests pass in 4.2 minutes, one worker/no retries, exit 0, zero page/console errors
  or warnings. Main route 2.8 minutes; hillside/device closure 1.1 minutes.

Chromium 151.0.7922.173, AMD Radeon 860M via ANGLE OpenGL ES 3.2, 1440×900 and
390×844. Injected standard Gamepad, keyboard and native touchscreen events;
physical gamepad and FPS measurements were not performed.

The main journey begins with an empty sandbox save and its normal finite supply
bank. Every movement, aim, placement and inventory action then uses real input:
foundation → doorway → walk through open entrance → mainframe on deck → owner
opens secured door → tall concrete and cliff foundations → inventory → held A
across dialog/native focus/disconnect → reload → return → keyboard/phone palette.
Only debug reads steer/assert the route. The second case starts from the checked
canonical hillside save, uses actual walking/aiming and proves replacement and
unsupported mapping cannot replay a held place action. It is a separate visual
fixture, not evidence of manually constructing that particular hillside base.

[Journey receipt](journey.json), [hillside and renderer receipt](hillside.json).
The slope has **4.859 m** terrain relief across the footprint; the 5.5 m braced
assembly seats both feet. Unit tests also validate a solid concrete alternative
at that location. Unit legacy fixtures retain the original .6 m depth.

## Builder inspection

The deck/mainframe contact, unobstructed open doorway, concrete depth, brace angle
and two terrain contacts were inspected in original game captures. Phone controls
fit without horizontal overflow and keep focus visible. The hillside underside is
dark in shadow; this is retained in the evidence and is not independent lighting
or final art acceptance. Braces are 1,272 triangles / 120,720 bytes, nine authored
mesh batches (five inherited deck materials and four articulated members).

## Retained failures and corrections

- Initial npm install hit sandbox `esbuild` spawn EPERM; the approved outside-
  sandbox install completed. No dependency versions changed.
- One broad manually combined Node26 `--test-isolation=none` run aborted with an
  async-id assertion after running tests. The normal process-isolated npm suite
  passes; no claim that this Node assertion was diagnosed or fixed.
- Initial regression fixtures assumed every site had a mainframe and five static
  mesh batches. They now explicitly create a secured site for door-motion tests
  and allow the measured four independently articulated brace/foot members.
- Browser01 reached deck mainframe placement, then its waypoint was 3.67 m from
  a 3.5 m door interaction. Its missing optional API also returned 500. Original
  receipts remain `/tmp/star-agent-foundations-attempt01`.
- API harness attempts used a wrong relative server path and then `/health`
  instead of `/api/health`. Both stopped before launching Chromium; corrected
  explicit cwd/health and isolated memory API8642 resolved the harness failures.
- Browser03's diagonal path clipped the wall at X2.253. The fixture now walks
  clear at X3 before approaching the door; runtime collision was preserved.
  Original receipts remain `/tmp/star-agent-foundations-attempt03`.
- First full route passed in 2.4 minutes, retained separately at
  `/tmp/star-agent-foundations-pass04`. Final05 reran it after a door-read lookup
  optimization and added the actual hillside/device closure. Final raw receipts
  remain `/tmp/star-agent-foundations-evidence`.

Construction remains solo/account-backed solo. This change does not implement
multiplayer construction or new visitor authorization services. Commissioned
shared trade layouts retain their explicitly open public entrances.

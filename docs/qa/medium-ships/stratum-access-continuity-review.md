# Independent review — Stratum continuity packet 02

**Disposition: the revised four-file fixture correction is suitable for root's import and native rerun. No remaining blocker found in the bounded source/CPU scope.** Packet 01 was rejected; its failure and exact source remain preserved. This does not change the original browser journey from FAIL or certify a completed gameplay route.

Reviewer: `/root/kestrel_reviewer`. I did not author this helper or its correction. I previously authored the original Stratum input fixtures, so this review is limited to the new continuity logic, its test cases and preservation of those existing paths/assertions. No runtime, shared source, service, browser or GPU changes were made.

Reviewed against integration `19e4ab0d6f416037410fd46b5b574a4cb746baec`. Frozen manifest: `/tmp/star-agent-stratum-continuity-delta-02.json`, SHA256 `5b2d5cef62c93b899ef86b7fd0350d5b16770c2a5543983a3152ad50d844f9bf`. Archive SHA256: `6bb513539cfbe00d670b595449daa2db48cc04e291c055dd9196b08d325be4c0`.

| Allowed path | Reviewed final SHA256 |
| --- | --- |
| `scripts/stratum-access-continuity.js` | `1e221c7b4f555f81bc92bc2fd577d77baefeaca0df00b7614f64fc7ab54e936e` |
| `tests/stratum-access-continuity.test.js` | `ed85f43212eb84fac7be065ed380e6327728a1dbbb7fd38e10f4d4c4517a508e` |
| `scripts/stratum-gameplay.spec.js` | `d107d055efb47746f46b5f806525cab621df6af9800fd110a6ac40ffcd44e41f` |
| `scripts/stratum-primary-inputs.spec.js` | `30c705ff7b8b704205ba2ae650d9abd731f7568d66787fd6e8241a9af1610045` |

## Findings and closure

The original inbound sample 31→32 moves **0.726119990138 m horizontally in 166.6 ms**, or **4.358463326159 m/s**. Its rise follows the canonical **1.35/5.2** ramp grade. Its 3D distance, **0.750188498581 m**, exceeds the obsolete fixed 0.75 m/frame threshold without exceeding unboosted walking speed. The original receipt SHA256 is `cd0185d92b36259af67ff6a405928f6f7280d7f012bbe1da90b031ed35ef2d8d`.

The correction's horizontal limit matches `main.frame`: elapsed RAF time capped at **0.2 s**, divided into navigation steps no larger than **0.025 s**. `navigation.js` interpolates velocity toward **4.5 m/s** outside and **2.3 m/s** inside; cabin entry can retain outside velocity, making 2.3 an unsuitable instantaneous ceiling. RAF recorder timestamps share the main update's clock. The helper adds only **10 µm** numeric allowance, not extra elapsed time. It validates each double-precision world/local pair against the recorded fixed ship transform using the same quaternion convention as Navigation.

**Packet 01 had a real vertical-teleport gap.** My copied-trace negative placed sample 32 on authoritative terrain directly beneath the ramp, preserving coherent world/local coordinates. It then rose **1.1937105355 m in 16.7 ms**, yet packet 01 accepted the path because each reported support defined its own expected height. That receipt and rejected source remain under `/tmp/star-agent-stratum-continuity-independent/`.

**Packet 02 closes that gap.** It selects deck/ramp/terrain from canonical horizontal footprints independently of the reported source and height. Support changes must cross the actual aft hinge or tip inside the ramp width. It also bounds vertical travel independently using ramp grade × horizontal travel, authoritative ground-height change and the explicitly measured tip join. The exact mutant now fails canonical source, support and vertical checks; its 1.19371 m rise is compared against an independent **0.0193439568 m** limit. The tip footprint is not expanded: the tested 2 µm crossing remains legal in both directions.

Both specs are byte-identical to reviewed packet 01. Against their original bases, all bytes outside the allowed import/identity/access-recorder blocks remain identical. Physical waypoints, actions, aiming, walk-mode checks, endpoints and the **more-than-ten ramp-support samples** requirement remain. New receipts are written before continuity assertions so future failures retain diagnostics. Exact source and preservation hashes are in `source-review-packet-01.json` and `source-review-packet-02.json` in the independent review directory. The seven inspected runtime/layout files were still unchanged at closure.

## Checks I executed

- `node tests/stratum-access-continuity.test.js` in the revised stage: **13/13 PASS**, including cadence through 500 ms, capped teleport rejection, support/frame errors, original failed pair, ramp-side rejection and exact-tip crossings.
- My `reproduce-support-hop.mjs` against the revised helper: both complete, unmodified original traces pass (**89 outbound / 64 inbound samples**), while the independently discovered support hop is rejected. Original world-distance maxima remain identical; maximum support error stays below **1.8 nm**.
- My `check-copied-negatives.mjs`: **12/12 corruptions rejected**—short excessive speed, endpoint teleport, off-floor height, world-only mismatch, duplicate time, nonfinite local/world/time values, wrong mode, closed ramp, jump and boost.
- Verified all four final file hashes, both base spec hashes and the final archive/manifest hashes. Original failed browser receipt remains byte-for-byte unchanged.

Commands and detailed receipts are retained under `/tmp/star-agent-stratum-continuity-independent/`. The author's earlier synthetic polar tip-test setup failure remains in its QA history; its corrected test uses the actual landed frame. I did not run a browser or repeat unrelated runtime suites.

## Limits and next step

This helper is scoped to the existing **stationary landed Stratum, no-boost/no-jump, aft access route on Selene**. Canonical X/Z selection deliberately rejects ground travel under the ship and lateral ramp exits in that route; it is not a general walking collision solver, moving-carrier validator or arbitrary-terrain/landing-frame certification. Sampled endpoints cannot prove every intermediate collision-free position. The measured tip-join term is assessed here for the actual landed route, not as permission for an arbitrary support-height gap.

Root should import only the four manifest paths, add the test once to the normal test list, and execute the pending native journeys. Those actual reruns remain necessary for gameplay acceptance; CPU replay does not relabel the preserved failed journey.

# Fitted ship weapons — independent integration review

**Result: PASS for the bounded integration scope. All four required findings are closed.**

Reviewer: Astra `/root/nomad_cutter`, 2026-09-07. Original candidate
`eac55d4b22a5aa92015cc1584c853666b1ea1659`; closure candidate
`2faa71c0ed8bd07fc71d89ef37ed8c14218b6135`. Weapon export stayed
`308a1ebeae4b1d5119dd98f96d21cc478335a638317fde19fdc542703f9cde67`
(2,806,012 bytes). Closure completed at 14:29:29 UTC with Node v26.7.0.
The eight reviewed source/asset hashes were identical before and after the probe;
full hashes are in `closure.json`.

Scope: root-authored fitted weapon loading, profiles, attachment envelopes,
flight input adapter, main pose/readiness hooks and navigation attachment hook.
The reviewer authored the separate combat simulation/render lane and does **not**
claim independent review of that lane. No production files were edited, and no
browser/GPU or physical controller was used in this review.

| Finding on the rejected candidate | Correction independently verified |
| --- | --- |
| **Empty body accepted.** Removing the two physical meshes from `Weapon_pulse-s1`, while retaining its real muzzle and metadata, produced a ready fitting and one recorded shot with zero physical gun meshes. | The same actual-GLB fixture now throws `Weapon has no valid physical body: pulse-s1`. The intact kit still yields nine variants and four Kestrel fittings. |
| **Partial attachment survived failure.** Removing `Adapter_Kestrel_WingL` caused unavailable status but left three fitting groups / thirteen physical meshes, while the collision layout reverted to the unarmed hull. | Foundation validation occurs before fitting allocation. The same missing-foundation case now leaves zero fitting groups and zero physical fitting meshes, with unavailable status and the original layout retained. |
| **Online input remained latched.** The real adapter handlers accepted held keyboard/controller fire while online, then emitted one shot when `connected` became false without a release. | Keyboard, controller and pointer cases each emit zero shots online and zero on disconnect while held. Release plus a new press emits one shot, proving recovery. Modal, focus, gear, power and loading gates still suppress held-input replay. |
| **Hidden hull had a stale muzzle transform.** Main updated the root transform only inside `if(ship.visible)`, although ordinary uncaptured Nomad flight could fire while hidden. This original finding was established from the exact main/input path; its first quantitative probe was interrupted by the quota failure. | The probe executes the exact revised main pose/visibility fragment on an actual fitted Nomad, keeps it hidden, and fires through the real adapter. First and second frames at approximately 25 billion metres match the current position/orientation: measured position error 0 m; maximum direction-vector error 2.49e-16. |

The online finding was an adapter boundary defect, not a reproduced network
journey failure. Main's normal WebSocket-close path disables navigation and opens
Comms; explicit leave reloads the page. Those additional gates already mitigated
the ordinary UI path. The revised adapter now independently enforces neutral input.

Validation commands, run from `/home/cees/projects/star-agent-ship-weapons`:

```sh
node /tmp/star-agent-weapon-integration-review/closure.mjs
node --test --test-isolation=none tests/ship-weapons.test.js tests/energy-effects.test.js tests/navigation.test.js
```

The closure probe passed all assertions. Focused units passed **41/41**, zero
failures or skips, in **1,387.94 ms**. The original targeted run passed 40/40 before
the additional malformed-kit regression test; those passing units did not conceal
the independently reproduced failures above. The actual-GLB CPU loader retains
geometry, named hierarchy and buffers, omitting texture image decoding.

Evidence: `probe-rejected.json` retains the original measured failures and
`reviewed-source/` retains the original source/asset snapshot. `closure.mjs` and
`closure.json` contain the runnable correction probes and their results. The old
`probe.mjs` remains truncated after an EDQUOT write failure and is not the runnable
closure script. A sandbox launcher quota failure and later optional metadata
subprocess restriction delayed execution; neither is reported as an application
test failure or a passing run.

No required finding remains open in this scope. This result does not certify art,
GPU shader execution, a complete browser/controller journey, performance, the
separate combat implementation, or the combined development branch. Root and the
other reviewer own those checks and the separate overlap-recovery review.

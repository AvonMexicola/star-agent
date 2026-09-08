# Ship mining reconnect correction — independent source review

**No safety blocker found in the bounded staged correction.** Reviewed `src/ship-mining-input.js`, SHA-256 `b6fc75b90b7d3a180b760aa2fb808f06e0e8effdd5cbaff1c93260ac98c97d2a`, against its controller02 predecessor `563f59ba7da83dd8b02dd0f848ebcbc1866b9dcd3a643132e8e6c3ed3191c0d5`. Reviewer `/root/nomad_cutter` did not author this adapter correction. No production edits or browser/GPU were used.

The original defect is consistent with source: neutral reconnect frames use `primary` while `nav.controllerActive` is false. The first used RT sets the controller-active flag, changes the cutter source identity and invalidates the fresh-neutral gate while the trigger is already held.

The correction derives context from connected pad ID/index during both neutral and pressed frames. I verified `GamepadInput.connected` is true only for its selected standard-mapped device; unsupported devices clear it. Neutral reconnect frames therefore address the same cutter context as the first RT press.

The aggregate `primary || pad.trigger` signal prevents a held keyboard/pointer/touch input from being mistaken for neutral. Although a held primary sets the supplied `armed` flag true, `createShipMining` only rearms when the aggregate trigger is false; this override cannot rearm by itself during a held primary. With no primary held, a connected but unarmed pad supplies `armed:false`, so its suppressed zero does not count as a physical release. Pad identity/connectivity changes still change context and invalidate cutter arming. Modal, focus, visibility, pointer-lock, power and cockpit eligibility guards are unchanged.

The correction preserves source identity when switching between keyboard/touch and an already connected pad, removing an unnecessary first-press context transition. New action still requires the existing aggregate neutral gate after an interruption.

This is a read-only source/contract assessment. Mendel owns the composed real-adapter/Gamepad/cutter/GLB regression and original negative case. The complete controller02 run failed and remains failed; the real browser reconnect retry is still required. This report does not claim an executed browser closure or replace the desktop UI review in `review.md`.

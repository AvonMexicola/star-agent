# Burrow candidate 10 — final physical MFD footer closure

**Scoped PASS: the footer clipping finding is closed.** In `desktop-cockpit-footer.png`, the complete status line **“ATLAS CARGO / PARKING BRAKE”** is visible on the physical display above its lower bezel. Neither the instrument shelf nor the right-hand control panel covers the line. The speed, cutter charge and ore rows remain readable.

Reviewer `/root/kestrel_reviewer`, 2026-09-07. I independently inspected the supplied 1440×900 image and `capture.json` at `/home/cees/projects/.mining-rover-qa/footer-10/`. The root executed the single capture after physical Atlas-to-rover boarding and a settled pause. I did not launch a browser, move the camera or edit production.

The record identifies runtime `e7e297b` and unchanged GLB SHA256 `88448d9dd48e0a0acdb2397465302e8ab41335b8ffaab6234050d136bf6cc78f`. The rover is occupied, idle, aboard Atlas and stopped, with its door closed and no boarding transition in progress. The first-person camera is unobstructed. Chromium 151.0.7922.173 uses ANGLE / AMD Radeon 860M / radeonsi krackan1 ACO / OpenGL ES 3.2; the record is complete with no errors or warnings. This is injected controller input followed by one settled desktop still, not a physical-device test or repeated full journey.

This new image supplies the visual evidence missing from the earlier phone frame, where the touch panel hid the physical MFD. The old clipped keyboard frame and the obscured phone frame remain unchanged as earlier evidence.

**Scores remain unchanged:** native static 4.04/5, previously observed keyboard motion 3.8/5, explicitly mixed-evidence six-criterion mean 4.00/5. The cargo-ceiling chase contraction remains a motion-polish finding. This footer closure grants no new flight, mining-duration, save, performance, all-platform or complete-product acceptance. Cees retains PR gating.

# Independent Astra review — startup and station departure

Approved the bounded startup-preload and station-departure patches. Loading UI
score: **4.0/5**. This does not approve PR34's outstanding visual blockers.
The reviewer was a separate, read-only session from the builder and took its own
browser captures against the final production preview.

| QUALITY criterion | Score | Evidence |
|---|---:|---|
| Silhouette / scale | 4 | Centered layout fits desktop and phone. |
| Materials / detail | 4 | Crisp progress track and clear typography. |
| Lighting / integration | 4 | Readable contrast; no distracting background leakage. |
| Cohesion | 4 | Existing typography and mint progress treatment. |
| Information design | 4 | Honest task progress and specific preparation status. |
| Motion | 4 | Stable loading layout; successful fade into play. |

No blocking findings remain. The builder addressed the review concerns about
held keyboard input and graphics failure handling.

Independent verification:

- 28 targeted tests passed; latest startup tests passed 6/6.
- Desktop boot reached completed orbital resolution4096, settled terrain and a
  hidden loading overlay.
- Actual WEBGL_lose_context during phone warmup preserved the reload message,
  disabled navigation, prevented readiness and stopped rendered-frame advancement
  for three seconds. Both browser runs recorded zero console errors/warnings.
- Station lift, obstruction release, speed cap and slow deck-arrival capture agree
  with the navigation/collision contracts.

Minor presentation limitations: inherited status text is small on phone; the
inherited fatal heading wraps with left alignment. Neither prevents understanding
or recovery. These scores apply to the loading interface, not the station art.

Browser: Chromium151.0.7922.173, ANGLE AMD Radeon860M, radeonsi krackan1 ACO,
OpenGL ES3.2; desktop1600×900 and phone390×844, DPR1. No portable FPS improvement
or physical-controller testing is claimed.

Evidence: [desktop](loading-desktop.png), [phone](loading-phone.png),
[phone graphics failure](context-loss-phone.png).

# Community hub — independent actual-game visual closure

**Bounded decision: the recorded station placement, live strike presentation and
phone UI pass this review. No blocking visual defect is identified in these
supplied cases.** The native Bastion08 review remains 4.00/5 across its five
scored criteria. This report adds actual-game evidence; it does not replace
the native report or turn a sampled recording into an all-arcs motion test.

Reviewer: `/root/nomad_cutter`. I inspected the original four defense stills,
seven native screencast frames and four touch PNGs listed below, and read the
actual JSON receipts. No production files or evidence images were edited; no
browser/GPU was launched by this review.

## Exact scope and receipts

- Bastion GLB: `8d0dcbb6395479ad083cd609217833b97c74008acdd15b72ed9182ced46b64ae`, 948,632 bytes. The defense receipt independently records the same served hash and unchanged before/after asset and runtime source hashes. Root identifies candidate source `004979d`.
- [Defense witness receipt](defense-01/witness/journey.json): complete, 2026-09-07 21:21:47.219–21:22:41.224 UTC; Chromium151.0.7922.173 / ANGLE AMD Radeon860M / radeonsi krackan1 ACO / OpenGLES3.2;1440×900 viewport and drawing buffer. Browser, peer, warning and capture error lists are empty.
- Defense actors use documented disposable-server initial EVA fixtures; the witness uses controller menu entry, real accounts/authenticated WebSockets and an accepted durable friendship. No client pose mutation or physical-controller claim. This is not a physical journey from a normal spawn to the turret.
- [Keyboard09 receipt](game-09/keyboard/journey.json): complete,21:18:25.044–21:20:00.854 UTC. [Touch09 receipt](game-09/touch/journey.json): complete,21:20:00.971–21:21:35.678 UTC. Both record the same exact08 asset and native AMD backend; phone images are390×844. Root executed these journeys; this reviewer inspected the resulting records and specified images.
- No FPS/performance claim. This review does not extend the native-renderer05/06/07 failures into passes; those records remain frozen.

Keep `defense-01/` and `game-09/` beside this portable report. Originals are under
`/home/cees/projects/.community-hub-qa/`.

## Placement, materials and live effect

[01-before-fire](defense-01/witness/01-before-fire.png) clearly shows the actual
battery seated on the fixed station roof. The bearing meets the support surface,
and the ivory/graphite/petrol materials remain readable under the real station
lighting. The ship-scale turret is naturally small against the much larger
station; both barrels and their dark bores still read at this witness distance.
No obvious floating base, detached assembly or gross roof intersection is visible.
This view establishes this upper mounting case, not every hidden lower mount.

[03-strike-window-native](defense-01/witness/03-strike-window-native.jpg) and
[03-instant-request](defense-01/witness/03-instant-request.png) show a strong mint
hitscan beam emerging at the visibly elevated barrel mouth and meeting a bright
target impact. It does not visibly begin behind the gun or at the station centre.
The selected mouth glows while the adjacent bore stays dark, so the firing barrel
is unambiguous. The effect is intentionally forceful, consistent with the requested
instant lethal response. The aim snaps into its firing solution; that matches
the specified instant-aim/hitscan behavior and is not scored as a missing slow slew.

The actual event receipt corroborates the image: mount `bastion-2-upper`, barrel0,
strike `aeon-orbital:1`, cause `shot`. The accepted friend shot deals25 damage,
leaving target health75 and friend alive with no station retaliation. The next
nonfriend shot leaves target health50; the aggressor reaches health0/shipHealth0,
mode`crashed`, weapon`null`. These are verified receipt values, not inferences
from an explosion picture. Ramming, simultaneous impacts and other boundary
cases remain covered by their separate CPU acceptance work, not this screenshot.

## Motion: observed sequence and explicit gap

I inspected native frames `0003`, `0006`, `0008`, `0010`, `0011`, `0012`, `0015`
and [05-recoil-return](defense-01/witness/05-recoil-return.png). Before fire the
barrels are level. The shot views show the elevated firing pose, correct visible
beam origin and expanding target effect. Later the beam clears, particles remain
briefly, and the final image retains an intact elevated assembly. The selected
barrel's recorded recoil peaks at0.60m and returns to0; the other barrel stays0.
There is no obvious joint detachment, long-lived beam or incorrect final pose in
the observed sequence.

This is a **limited visual pass for one strike and its return endpoint**. It is
not a full temporal-quality score: native frame receipt timing has a128→439ms
gap, covering a significant part of recoil return. Frame0006 at+10ms still shows
the earlier level pose; receipt time is not an exact measurement of when the
compositor displayed a new simulation state. I therefore do not derive reaction
latency, a precise200ms visible duration, smoothness across the missing interval,
all-angle clearance or a motion/FPS average from these samples. The previous
native motion category remains unscored for a complete animation-quality grade.

## Phone UI

- [Elevator destinations](game-09/touch/01-elevator-destinations.png): clear station/berth context, a prominent hands-free hub destination, large reachable destination buttons and visible pagination. The page fits390×844 without horizontal clipping.
- [Hands-free inventory](game-09/touch/03-hands-free-inventory.png): the community-hub stow policy is stated in the inventory description; equipment and transfer controls fit the panel. The screenshot alone cannot prove disabled semantics, but the successful journey's policy assertions are consistent with it.
- [Commodity market](game-09/touch/04-market-buy.png): source terminal, wallet, selected ship/capacity, quantity, stock and explicit buy/sell prices are readable together. It identifies shared Aeon stock/prices, and its pagination is visible. The receipts record a2SBU round trip at41CR ask/24CR bid, stock restored to1024 and wallet1500→1483. The pre-buy image displays the pre-buy quote; it is not evidence of the later sell price by itself.
- [Return to berth](game-09/touch/05-return-to-berth.png): the modal has closed and touch movement/interact/Commands controls are available again. The lower-middle ship/location HUD labels are crowded, a minor legibility issue in the inherited play overlay; they do not cover the touch controls or invalidate the completed transit. This is not a broader HUD redesign approval.

The supplied phone menus have no blocking overlap, clipped principal action or
unreadable transaction amount. Existing controller hints in the footer do not
prevent touch use; no physical-phone/GPU-performance or physical-gamepad claim
is made. All-three-input-mode functionality and held-input interruption coverage
remain described by root's actual journey reports, not expanded here.

## Integrity

| Receipt | SHA-256 |
| --- | --- |
| defense-01/witness/journey.json | `e4424e87bcd941dd062c6a636ad96c2bb688e1313aaf5c8b3968de6e756b2f1d` |
| game-09/keyboard/journey.json | `7312627cf05e3cd16679eb163d81139edffbc78432b90af8cc26ff6c5f20cc0f` |
| game-09/touch/journey.json | `90b3f5e3ce1439dba75e60970d9fe03c68df595cdf4460229098c7fd3e31d5d0` |

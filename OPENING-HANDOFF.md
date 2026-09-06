# Station opening handoff

User request: implement HANDOFF request 18's space-station starting scene.
Branch feat/station-opening, isolated /tmp/star-agent-opening-work. Based on
travel PR #11; preserve that dependency when merging into feat/visual-fidelity.
No shared runtime source files were replaced.

Default boot loads the landed Nomad and rigged pilot on the station's authored
deck. A ten-second camera/door reveal frames Aeon's limb. First movement eases
into the physical navigation eye over 0.9 seconds and buffers a tapped step.
The player then physically walks around the ship, opens its rear hatch, boards,
sits and launches. M/travel, O and destination shortcuts work after handover.
intro=0 retains orbital boot and the old station pose for existing tours.

## Files and integration

- opening-sequence.js/CSS: request sequencing, existing Character/CharacterCamera
  adapter, pilot asset yaw correction, camera composition, input buffer and inert
  hidden UI. The rig clears the Nomad wing with a four-metre lateral offset.
- navigation.js: authored-deck spawn, intro input gate, physical key tracking,
  tilted-deck walking plane. No boarding teleport or second floor.
- station.js: controlled DoorsOpen timeline with matching collider poses,
  optional station orientation, true deck up and warm bay lamps.
- audio.js: low hangar hum/motor through the existing Web Audio graph.
  Polling a controller cannot create audio; keyboard activation is a user gesture.
- main.js: loading/reveal timing, tab clock reset, actual cinematic camera origin
  for every renderer, fixed-exposure interior lighting and lifecycle wiring.
- Existing orbital browser tours now pass intro=0 explicitly.

When combining with external/player camera PR #9, the opening camera must take
priority only while cinematic/blending. Reuse one Character instance and hand its
visibility/state to the normal player camera after the blend. Do not instantiate
two pilots. Equipment is a separate lane. Freighter/fleet selection should retain
the Nomad as the default starter and keep deck/ship spawn ownership in Navigation.
Keep travel route gates and crash-state guards when combining those PRs.

## Evidence and limits

120 unit cases pass before the final far-deck walking regression is added.
Both production opening browser cases passed, covering keyboard boarding/launch
and controller/default/intro=0 handover. Source updates from final review now
exclude hidden-tab time, wait for root terrain readiness and keep the true deck
plane at far hangar corners. Final sequential regression results will follow.

Screenshots at the closed/revealing/open phases are committed under docs/images.
Chromium / ANGLE SwiftShader, 1440x900; opening screenshots pause navigation and
render at native scale, journey movement uses 0.55 scale. No shader/page errors
were observed in the opening journey.

One overlapping software-rendered standard landing test timed out at 0 FPS.
The final runs are sequential; preserve actual results in the follow-up below.
Cold local production startup was about nine seconds: the requested <=3 seconds
and 60 FPS on a laptop are not verified. The scene keeps the loading cover during
asset/terrain setup and does not consume the reveal while warming the first frames.

Player guide: docs/station-opening.md. Local test view: http://localhost:5178/.
Manager owns review/merge/deployment. No opening deployment by this author.

## Final verification (2026-09-06)

121 unit cases pass and the production build passes. Both final production intro
cases pass, including the injected 30-second hidden-tab timestamp gap, controller
handover and complete physical keyboard boarding/launch. The seven existing
browser cases passed across runs: six in the standard suite and the forest flight
case in a subsequent isolated run. Earlier shared SwiftShader runs timed out at
0–1 FPS; the journey test now uses 0.4 internal render scale and permits longer
transit/landing waits while retaining all gameplay assertions. This is test
resource tolerance, not evidence of a frame-rate improvement. The final opening
run reached ready at 4.9 seconds on this machine, still above the 3-second target.

PR #12 is ready for manager review. Preview: http://localhost:5178/.

## Floor flicker follow-up

Cees reported dense flicker on the deck in the 5178 preview. Both authored station
LODs had structural Hull floor tops at -8 m, exactly coplanar with LandingDeck's
visible top. The Blender generator now ends the structural slab at the deck's
underside (-8.4 m); LandingDeck, pad and walking height stay at -8 m. Both GLBs
were regenerated. This removes the competing visible surfaces without depth bias
or a shifted collision floor. Asset-only fix commit: c4eb24c; independent real-GLB
regression commit: e0478b0. Manager can carry these into other station branches.

All 123 unit cases pass. The new downward-ray checks fail for both pre-fix GLBs
and pass for both replacements. The software renderer did not reproduce the
user's exact dense speckle pattern in the initial angle, but the overlapping
surfaces were confirmed directly in geometry. Browser follow-up covers eye-height
camera-origin movement at native and 0.55 scales plus the physical opening journey.

Both follow-up production browser cases pass (physical opening boarding/launch
and low-angle moving-origin floor inspection). Native and 0.55-scale captures
were inspected: no speckled floor was visible; reduced scale still has ordinary
jagged object edges. Chromium 151 / ANGLE Vulkan SwiftShader, 1440x900. Curated
native image: docs/images/station-floor-fixed.png. The 5178 dev preview serves
the corrected models; reload the page to replace an already loaded GLB.

## Relaxed pilot idle follow-up

Cees disliked the raised right hand in the starter pilot's idle. The male GLB now
uses relaxed shoulder/arm/forearm/hand rotations sampled from the existing
mannequin-retargeted idle, while retaining the original idle torso, hips and legs.
All other clips, geometry, textures, rig and transforms are byte-preserved. The
original grounded body avoids the elevated leg present in the full alternate clip.

Reproduce with `python3 blender/relax_pilot_idle.py public/models/props/player-male.glb`.
The small checked-in pilot-idle-arms.json preset contains only upper-limb rotations;
the script maps them onto the original loop duration and closes the arm pose.
Repeated application was verified byte-identical. Only 6,131 bytes changed, all
within the eight original idle rotation output channels. No runtime override.

124 unit cases pass. The real-GLB regression samples 241 poses: wrists remain
within 3cm of the pelvis line, both feet retain <1.4cm height difference and
<1.2mm drift, and the loop closes. The original raised-hand asset fails this test.
Native 1200x1000 Chromium/SwiftShader close-up inspected at multiple idle times;
evidence docs/images/pilot-relaxed-idle.png. The preview on 5178 serves this asset
on reload. Manager can carry the male GLB into the external-camera lane too.

Final production build and complete opening/physical boarding/launch browser case
pass with the relaxed pilot. That case also checks the actual playing idle's hand
heights five seconds into the reveal. No shader/page errors were observed.

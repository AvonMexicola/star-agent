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

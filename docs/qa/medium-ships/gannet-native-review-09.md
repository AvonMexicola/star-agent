# Gannet geometry09 — independent native visual review

Reviewer: root Codex integration owner, independent of this authored Gannet asset.
The author of Gannet geometry/finish and its MFD correction is a different agent.
This report assesses the isolated asset images; it does not independently approve
root-authored gameplay integration, lighting code or controller fixtures.

**Changes required.** Clear central glazing and the corrected MFD faces are
confirmed. The current exterior and finish do not reach the medium-ship brief.

| Criterion | Score / 5 | Observed evidence |
| --- | --- | --- |
| Silhouette and scale | 3.2 | The protected central load volume reads, but the broad plain side pontoons, flat roof and simple pointed fins lack a strong functional shape hierarchy; below the brief's 4.5 target. |
| Materials and detail | 2.4 | Large uninterrupted pale panels and yellow/gold floor/edge surrounds dominate; fine repeated vertical streaks do not substitute for fitted panel depth and material separation. |
| Lighting and integration | 2.8 | Studio highlights flatten the pale outer faces and floor; contact and useful industrial detail remain weak. Actual game lighting is a separate pending correction. |
| Cohesion | 3.2 | Ivory and petrol relate to Meridian, but the wide yellow surfaces and bright surrounds overwhelm its restrained amber accents. |
| Information / physical read | 3.8 | The clear window and unobstructed screen faces are improvements; the actual Burrow fits visibly in the open bay. The outer MFD text is partly cropped at the default desktop projection. |
| Motion | Unscored, applicable | Only the saved still sequence was reviewed. No continuous motion acceptance is inferred. |

Partial static mean: **3.08 / 5**. The material criterion is below three. This is
a retained failed candidate review, not a complete six-criterion acceptance.
The builder is revising the actual hull hierarchy, fitted surfaces and restrained
finish, while retaining the clear windscreen, MFD supports and measured access.

Evidence: [exterior](gannet-native-09/desktop-exterior.png),
[real Burrow in bay](gannet-native-09/desktop-bay-burrow.png),
[canonical pilot eye](gannet-native-09/desktop-cockpit.png). These are unchanged
copies of the originals. The four faces have no opaque centre bars; this does
not certify that every face fits simultaneously in a narrow portrait projection.

## Identity and executed check

Root ran `GANNET_HARDWARE=1 GANNET_URL=http://127.0.0.1:5581
GANNET_EVIDENCE=/tmp/star-agent-gannet-native-09/evidence npm run test:browser --
-c scripts/gannet.config.js` from medium integration `e052d23`.
The one test passes: 26.3 seconds (29.6 seconds total), thirteen desktop and
390×844 portrait-sized images, no recorded page/console errors.
The portrait sequence resizes the desktop page and uses pointer activation;
it is not native-touch gameplay acceptance. No motion video was recorded by
this studio fixture, and the still sequence cannot rule out transient defects.

Browser executable: Chromium 151.0.7922.173. Actual recorded renderer: ANGLE
AMD Radeon 860M Graphics (radeonsi krackan1 ACO), OpenGL ES 3.2. Desktop is
1440×900, portrait390×844, device scale1. The final portrait frame reports
11 renderer calls /33,334 triangles; this is a single isolated scene observation,
not sustained frame-time or loaded-game performance acceptance.

HTTP retrieval of both built models was verified before capture; sources stayed
frozen throughout. Gannet GLB `67f650cee7a6af5f47b35fb597ffbb02f7fd3be9fef08e08146a5aa512597e52`,
39,966 triangles /2,422,200 bytes. Burrow reference
`831b9569633efda11652e3827057d2f4bc3f47d20f23a47df152fa437cb29468`.
Original screenshots and `state.json`: `/tmp/star-agent-gannet-native-09/evidence`;
runner log: `/tmp/star-agent-gannet-native-09.log`. The original first preview
bound IPv6 localhost; the IPv4 HTTP preflight failed before any browser launch.
The preview configuration now binds its advertised127.0.0.1 address.

## First actual gameplay findings

The separate controller journey on the frozen same runtime reached physical
pilot exit, rover door/steps boarding, full hatch/elevator lowering and all four
wheels onto canonical terrain. It failed after2.2minutes at cutter aiming:
the half-circle route left the observed deposit at required yaw−.44035rad,
outside the existing±.4rad limit. The fixture now continues the actual turn
until the deposit is well within the unchanged aiming arc. It still records its
outbound path and requires driving back along it. No pose assignment, wider
mining arc, mocked ray or inventory grant is used as a correction.

Actual images also show a dark cabin/bay and a chase camera entering the rear
wall after all wheels leave the elevator. Runtime lamps must correspond to real
emitting fixtures; the rover camera now clips against the carrier even when no
longer anchored. At the captured departure, the actual hull clips2.022m from the
8.216m camera boom, leaving6.195m outside the wall. The complete desktop MFD row
needs a wider projection while retaining the same physical pilot eye.

Original failure, controller inputs, source hashes, screenshots and video remain
under `/home/cees/projects/.medium-ships-qa/gannet-controller-01`. No ore, return
loading, carried flight/landing, native touch or full-game visual approval is
claimed from that failed journey. Follow-up is pending on corrected code/art.

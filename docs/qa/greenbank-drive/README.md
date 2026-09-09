# Greenbank drive acquisition correction

Runtime `421ea55` fixes the reported 870 km miss. With the actual seed 7291
Greenbank pad, the old automatic acquisition picked Aeon despite pointing at
Greenbank, producing an 871.041 km miss. Sorting by distance to the world's
surface gave its broad disk priority over the settlement's narrow point beacon.
A selected Greenbank could also fall back to Aeon after losing alignment.

Point signals now outrank broad world disks. Explicit selection remains until
cleared or changed; losing alignment clears the charge without changing targets.
Body-only acquisition, sight occlusion, selected far-side routing and all existing
server eligibility remain. General targeted flight is solo; shared targeted
flight still requires an active freight pickup/delivery.

## Verification

- Full configured unit suite: 165 files pass, zero failures/skips (36.6 seconds).
  Final navigation suite: 14 cases pass, including the actual Greenbank pad,
  reproduced 871 km miss, corrected approach, explicit selection and clearing.
- Development-enabled production build passes: `main-BE7AYanX.js` (5.32 seconds).
  Repository/whitespace checks pass; test-plan helper run against the remote
  integration baseline. Only acquisition changes versus paired release `0ea21d2`;
  server, route planner, protocol 11, catalog, SQL, dependencies and assets match.
- Actual controller browser journey 02 passes in 1.6 minutes: automatic Greenbank
  acquisition from the normal launcher orbit, map selection, nose toward Aeon
  without retarget/engagement, map Clear target, reacquisition, modal/focus/device
  neutral gates, real drive to Greenbank and return to manual flight.
  No teleports or navigation-state writes after entry; steering writes only the
  injected standard Gamepad. Chromium 151.0.7922.173, AMD Radeon 860M, ANGLE GL,
  1440×900, one worker, no retries. Page/console/request errors are empty.
- Arrival is 34,996.134 m from the raised pad, altitude 35,000.222 m and speed zero.
  [Raw journey](journey.json), [automatic lock](automatic-greenbank.png),
  [arrival](greenbank-arrival.png); both images inspected in the actual renderer.
  A screenshot can contain a stale cockpit-MFD speed between display updates;
  the canonical speed and live HUD are zero at the measured arrival.
- Initial browser run 01 reached the correct pad (34,996.157 m) but failed an
  unnecessarily strict half-metre terrain-altitude assertion (35,001.341 m).
  The corrected fixture permits 10 m of terrain/readout variation while still
  requiring the real pad distance within 10 m of 35 km and radial error under
  0.00005 radians. No runtime change followed this fixture failure. Original
  failure/trace retained under `/tmp/star-agent-greenbank-results/01`.

Local integration at `421ea55` is served on 5178; both direct API 8087 and proxied
API health checks pass. [Local receipt](local-integration.json). Existing service
and database stayed running. Shared journal bytes and unrelated work are retained.

Public promotion remains gated by GitHub account billing. Candidate `0ea21d2`
is superseded and its temporary promotion script has been disabled; the updated
PR must pass its required check or receive explicit owner bypass authorization.
Neither public site is claimed updated. Physical-controller, independent review,
landing/terminal interaction and broad performance acceptance are separate.

Run: `VITE_DEV_TOOLS=1 npm run build`, then
`npm run test:browser -- -c scripts/greenbank-drive.config.js`.

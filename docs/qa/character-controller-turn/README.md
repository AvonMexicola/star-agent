# Character controller turn speed

Runtime `66dc1da` raises right-stick yaw and pitch from 0.85 to 1.5 radians per
second while walking and in EVA: about 76% faster, or a half-turn in 2.1 seconds.
The existing dead zone and proportional response preserve small stick movements.
Mouse, keyboard, EVA roll and ship/vehicle handling retain their previous rates.

The shared movement code applies the same rate on the multiplayer server. The
client scales keyboard contributions in normalized input packets so arrows still
turn at 0.85 radians per second. No input field, wire version, save format or
dependency changes.

## Verification

- Five affected test files pass: navigation, gamepad, EVA, multiplayer UI and
  server room (6.73 seconds, no failures/skips). Regression cases exercise actual
  navigation updates with full stick, half stick, keyboard and mixed/opposing
  inputs in walking, EVA and flight, plus normalized multiplayer parity.
- Production build with `VITE_DEV_TOOLS=1` passes (6.08 seconds,
  `main-C2PNrg9B.js`). Repository and whitespace checks pass; suggested check plan
  recorded. No frame-rate or physical-controller claim.
- The actual browser controller journey passes in 1.5 minutes. It uses
  supported orbit entry, leaves the seat, measures full/half-stick turning,
  checks focus/disconnect/replacement suppression, opens the hatch, moves into
  EVA, measures again and physically returns to the seat. After startup the
  fixture writes only standard Gamepad input, never a navigation pose.

## Delivery

Integrated locally with the separate player-guide work preserved. The managed
5178/8087 client/API pair was refreshed with the existing persistent database;
three served input modules and both health routes pass. Refresh existing clients.
[Local receipt](local-integration.json).

Browser 151.0.7922.173, AMD Radeon 860M, ANGLE GL, 1440×900, one worker and
no retries. Measured full/half rates: walking 1.527/0.757 rad/s; EVA
1.524/0.760 rad/s. Final state is flight after physical return and reseating, with
zero page/console errors. [Journey](journey.json), [returned seat](returned-to-seat.png).
Both original images inspected. Private5702/browser exited and GPU released.
Raw evidence remains in `/tmp/star-agent-character-turn-evidence/01`.
Public release candidate `c5eb519` / PR113 remains separate and billing-gated.
No public deployment or independent acceptance is claimed.

Run `VITE_DEV_TOOLS=1 npm run build` then
`npm run test:browser -- -c scripts/character-turn.config.js`.

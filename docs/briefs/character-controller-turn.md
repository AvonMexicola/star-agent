# Character controller look speed

Increase right-stick yaw/pitch from 0.85 to 1.5 rad/s while walking or in EVA
(about 76% faster; a full-stick half-turn takes 2.1 seconds). Preserve analog
dead zone/proportional aiming, mouse/keyboard rates and all ship/vehicle handling.
Scale keyboard contribution in the existing normalized multiplayer input so
server and client agree without changing the wire format or mouse accumulation.

Own fix/character-controller-turn from 7a23050: gamepad rate constants,
navigation input rates, multiplayer normalization and focused regression/browser
checks. Private preview 5702, queued behind the active player-guide GPU owner.
Integrate checked source locally while preserving that separate guide work,
station wheel correction and all journal bytes. User subsequently requested release to play and multiplayer; prepare the paired
candidate while retaining the existing protected-check billing gate.

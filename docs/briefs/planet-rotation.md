# Planetary rotation

Cees requests spinning planets. Work in progress on `feat/planet-rotation` from
`f1ef821`; private preview port 5682. No integration or deployment yet.

Implement axial rotation of Aeon, Selene, Pyre and Miasma, with fixed existing
body centres and a default 60-minute day. Keep terrain generation, persisted
surface anchors, construction, mining and parked vehicles in body-fixed metres.
Render the surface, atmosphere, sunlight and stars in consistent frames, and
preserve inertial pose/momentum across transitions into deep space. Existing
navigation and controller interactions remain the entry path; no new binding.

Acceptance requires numerical frame/terrain/precision/route checks, normal and
multiplayer regression checks, a production WebGL frame inspected at several
phases, and an actual controller journey through launch, flight, landing and
return to play. Physical controller testing is reported separately. Surface
save compatibility and shared clock/protocol adoption must be explicit.

An initial numerical test disproved the assumption that the existing eight-radius
navigation domains are disjoint: Pyre and Miasma overlap. Rotation charts use
three radii, leaving a gap without changing the existing gravity-domain policy.
The combined runtime passes 1,216 normal tests, 201 multiplayer checks with two
existing optional skips, production build and repository checks. Four-world WebGL
inspection and the full ground controller journey pass; final two-client browser
and targeted-drive cases remain pending. See the current [QA record](../qa/planet-rotation/README.md).

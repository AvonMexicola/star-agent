# Space steering

While piloting in space, the right stick yaws and pitches around the ship's own
axes. LB / RB rolls. RT / LT translates along ship up / down, including after a
roll. Mouse look, arrow keys and Space / C use the same space steering frame.
Assisted and inertial flight agree on these axes; inertial flight retains angular
momentum. Crossing space without steering preserves the ship's attitude.

Assisted atmospheric ascent remains relative to planetary gravity. Surface walking
retains its upright frame and pitch limit. On foot in EVA, RT operates the mining
laser, A / B supplies vertical thrust and LT brakes suit drift.

`tests/space-steering.test.js` verifies screen-relative yaw and pitch at the actual
Ring Survey approach and arbitrary rolled/radial attitudes, both directions of
trigger thrust, mouse input, inertial torque, and atmospheric/walking regressions.

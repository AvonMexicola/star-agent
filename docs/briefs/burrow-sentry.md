# Burrow Sentry

Cees requested a separate Burrow variant replacing the aft mining bins with a
laser turret. A physically boarded second player owns turret aim and fire while
seated. When the gunner seat is empty, the pilot has the same controls. The mining
Burrow and its storage, extraction and driving remain unchanged.

Reuse the measured Burrow chassis, unobstructed cabin, suspension and Atlas/Gannet
clearance. A sealed aft operator pod replaces both cassettes. Its external yaw
ring and pitch cradle carry two laser barrels with named emitter sockets. The
gunner sits at flat sensor displays; no centre strut crosses glazing or screens.
Retain source, original manufacturer PBR maps and independent animation pivots.

One shared simulation owns movement, physically traversed seat access, yaw/pitch,
charge/cooldown and neutral-input gates. Solo uses it locally; online the room
owns every vehicle and seat, validates deployment/reach/life/speed/ownership,
advances canonical four-wheel physics and resolves hits through station security.
Clients send bounded control intent and seat requests, never poses or damage.
Vehicles are session state; no persistent ownership or new economy is implied.

Bindings: existing X/F interaction boards the nearby port pilot door or aft gunner
door; LS/WASD drives only from the pilot seat, RS/arrows/mouse aims, RT/T fires,
LT/X brakes, X/F exits once stationary, View/I opens the normal backpack. Shared
controller neutral arming suppresses held fire on every authority/seat/context
transition. Touch uses the same controls. Both seats use a turret sight camera
with visible ownership, charge and hit state; the pilot may retain the existing
chase view for driving.

Acceptance requires actual model/muzzle/sweep checks, server reach/lease/spoof/
disconnect/seat-handover/occlusion checks, injected controller physical entry to
aim/fire/result/exit, a two-browser gunner-priority journey, keyboard and native
phone checks, real renderer stills/motion, unit/build/repo/plan checks. Physical
controller, independent art review and hardware FPS remain separate evidence.

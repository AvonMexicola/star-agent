# Compound garages

The garage candidate converts the right-hand building at each of the four solo
trade settlements into a drive-through vehicle bay. It reuses the construction
kit and the existing Meridian **Burrow M-04** mining rover.

1. Find a trade settlement on **Map → world → Locations**, land on its large pad
   and walk out of your ship. F2 / Dev → Ship & location also offers an approach
   above each settlement for local testing.
2. Walk to the **Garage** console beside the right-hand bay entrance. Look at it
   and press **F / controller X**, or tap the visible Garage button.
3. Choose **Deploy Burrow**, or **Retrieve Burrow** if it is already parked
   elsewhere. Walk to the rover's port-side door and press **F / X** to board.
4. Drive through the outer gate and down the supported driveway to the surface.
   **W/S** drives forward/reverse, **A/D** steers and keyboard **X** brakes.
   Controller left stick drives/steers, **LT** brakes, **RT** runs the cutters,
   and **X** leaves the cabin after stopping. Touch controls are on the rover HUD.
5. **View / I → ore bins** opens the rover's existing 96 kg storage. Stop and use
   **F / X** to return through the cabin door and steps.

One live Burrow is shared between garages in a solo session. Retrieval keeps its
ore and cutter charge; it refuses a vehicle that is occupied, moving, accessing
its cabin or aboard a carrier. A blocked destination also refuses the request.
Closing the garage while its model loads cancels that request.

Ore uses the existing mining save. Vehicle location and cutter charge keep the
existing session lifecycle: after a reload, request Burrow at a garage again.
There is no fee or new vehicle ownership economy. These garages are solo content;
online vehicle authority remains a separate feature.

The driveway uses real foundations and ramps. Uneven terrain, rocks and vegetation
beyond it still affect driving. The four default-seed routes have outbound and
reverse wheel-physics checks; this does not promise a clear road across a planet.
See [the current verification record](qa/compound-garages/README.md) for browser
acceptance and local integration status.

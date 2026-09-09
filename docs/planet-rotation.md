# Spinning planets

Aeon, Selene, Pyre and Miasma each complete a day in **60 real minutes**. Their
centres keep their current positions. Sunlight moves across the terrain, and
night follows day while ground, bases, mining sites and parked vehicles stay
attached to the world. The orbital station follows Aeon's rotation.

Use the existing flight, landing, walking and controller controls. There is no
rotation toggle or new binding. The day continues while menus are open and across
reloads. Online players use the server's planetary clock.

Drive navigation aims ahead of a rotating surface destination. If its approach
is behind a planet, climb or fly around the limb before engaging. Regular flight
still crosses the atmosphere continuously. Flight assist follows the local frame;
inertial flight preserves motion and attitude as you leave it.

This adds axial spin, not changing orbital positions or a gravity simulation of
the whole system. Existing terrain, construction and mining saves remain compatible.
See the [validation and remaining acceptance](qa/planet-rotation/README.md).

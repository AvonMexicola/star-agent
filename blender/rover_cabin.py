"""Manufactured Burrow interior and shell details, at the unchanged physical size.

Original geometry informed by the approved concept images in the authoring area.
All panel screens declare their physical sizes on their exported anchors.
"""
import math


def build_cabin(*, g, box, rod, panel, text, plain, root, door, parts):
    warm = plain('Warm cabin cove diffuser', (.97, .76, .48), .65, emission=.75)
    face = plain('Flush control glass', (.035, .068, .076), .3, .12)

    def display(name, pos, width, height, *, yaw=0, tilt=0):
        anchor = g.empty(name, pos, root)
        anchor['displayWidth'] = width
        anchor['displayHeight'] = height
        anchor['interface'] = 'Meridian flat panel'
        x, y, z = pos
        box(name+' / fitted housing', (x, y, z-.025), (width+.065, height+.065, .065), 1, .02, anchor)
        box(name+' / inner seal', (x, y, z+.009), (width+.019, height+.019, .009), 3, .002, anchor)
        box(name+' / flush glass', (x, y, z+.015), (width, height, .006), parent=anchor, mat=face, bevel=.002)
        # Game Y is Blender Z; local X is shared. Apply to the whole assembly.
        anchor.rotation_euler = (tilt, 0, yaw)
        return anchor

    # The wide fascia sits above the fully compressed tyres. Its narrow lower
    # trunk stays inside the existing footwell, clear of the entry bend.
    box('Console fitted plinth', (0, 1.228, -1.37), (1.08, .11, .33), 1, .022)
    box('Console shoulder shelf', (0, 1.325, -1.38), (1.43, .05, .13), 1, .012)
    box('Console ivory lower reveal', (0, 1.193, -1.22), (1.02, .06, .035), 0, .009)
    display('RoverDisplay', (0, 1.415, -1.31), .68, .245)
    display('RoverCuttersDisplay', (-.535, 1.425, -1.305), .265, .225, yaw=.16)
    display('RoverOreDisplay', (.535, 1.425, -1.305), .265, .225, yaw=-.16)

    # Flush armrest control pads, no wheel, pedals, column, sticks or handles.
    # Forward of the physical boarding bend at Z -.65, leaving its X -.55 lane.
    for s, name in [(-1, 'RoverDrivePad'), (1, 'RoverMiningPad')]:
        rod('Control pad seat rail', (s*.30, .91, -.79), (s*.37, 1.015, -1.075), .024, 2, n=8)
        box('Control pad palm rest', (s*.385, 1.035, -1.015), (.17, .07, .28), 3, .018)
        display(name, (s*.385, 1.145, -1.12), .145, .18, tilt=-.78)

    # Fitted wall liners terminate at the pressure frame; the door's interior
    # panel and latch move with the actual CabinDoor pivot.
    for s in (-1, 1):
        owner = door if s < 0 else root
        box('Inner wall liner', (s*.819, .935, -.12), (.03, .69, .87), 0, .012, owner)
        box('Door pocket shadow' if s < 0 else 'Cabin stowage recess', (s*.798, .87, -.075), (.014, .29, .54), 1, .01, owner)
        box('Fitted stowage door', (s*.782, .864, -.075), (.018, .235, .474), 4, .012, owner)
        box('Recessed stowage latch', (s*.768, .885, -.22), (.013, .09, .047), 2, .003, owner)
        box('Cabin sill soft trim', (s*.819, 1.284, -.12), (.06, .045, .88), 1, .009, owner)
        for z in (-.44, .24):
            rod('Interior liner captive screw', (s*.79, .662, z), (s*.804, .662, z), .013, 2, owner, n=6)
        # These coves are outboard of the measured entry capsule; the central
        # ceiling remains above Y2.34 rather than lowering the standing roof.
        box('Side roof cove housing', (s*.795, 2.365, -.10), (.045, .035, 1.08), 1, .006)
        box('Warm side cove', (s*.765, 2.339, -.10), (.012, .012, 1.02), mat=warm, bevel=.002)

    box('Inner pressure latch socket', (-.789, 1.11, -.437), (.03, .125, .09), 1, .006, door)
    rod('Inner pressure latch', (-.761, 1.075, -.447), (-.761, 1.145, -.447), .012, 2, door, n=8)

    # A shallow ceiling assembly with visible panel joints and recessed vents.
    box('Ceiling central shadow joint', (0, 2.355, -.05), (.83, .013, 1.48), 1, .005)
    for z, depth in [(-.54, .44), (.10, .78)]:
        box('Fitted ceiling liner', (0, 2.349, z), (.79, .013, depth), 0, .009)
        for x in (-.33, .33):
            rod('Ceiling captive fastener', (x, 2.339, z), (x, 2.346, z), .012, 2, n=6)
    box('Forward vent recess', (0, 2.331, -.86), (.49, .028, .18), 1, .008)
    for i in range(5):
        box('Forward vent vane', (0, 2.313, -.921+i*.03), (.42, .01, .011), 3, .002)
    box('Forehead warm cove backing', (0, 2.302, -1.078), (1.25, .035, .035), 1, .006)
    box('Forehead warm cove', (0, 2.293, -1.05), (1.17, .012, .012), mat=warm, bevel=.002)

    # Front footwell and shallow removable cover, visible beneath the console.
    box('Footwell removable cover seal', (0, .89, -1.534), (.58, .42, .013), 1, .012)
    box('Footwell removable cover', (0, .89, -1.522), (.52, .36, .017), 0, .018)
    box('Footwell cover latch', (0, 1.009, -1.508), (.12, .024, .009), 1, .003)
    for s in (-1, 1):
        box('Footwell vent well', (s*.406, .845, -1.528), (.17, .31, .014), 1, .008)
        for i in range(5):
            box('Footwell vent vane', (s*.406, .737+i*.05, -1.513), (.135, .018, .012), 3, .002)
    for x in (-.36, -.18, 0, .18, .36):
        box('Footwell traction channel', (x, .545, -1.23), (.012, .009, .49), 3, .001)

    # Seat construction remains at its accepted pose; fine welts do not become
    # a second collision box or put rigid geometry through the seated pilot.
    for s in (-1, 1):
        box('Seat cushion stitched welt', (s*.275, 1.018, -.69), (.012, .009, .48), 1, .002)


def build_shell_details(*, g, box, rod, panel, root, light, amber):
    # Shallow front fenders leave the full ±.22 m suspension / steering crown
    # underneath them. Their width remains inside the original resting envelope.
    for s in (-1, 1):
        panel('Front folded wheel fender', [
            (s*.83, 1.337, -1.96), (s*1.27, 1.337, -1.96),
            (s*1.29, 1.40, -1.78), (s*1.29, 1.40, -.99),
            (s*.83, 1.40, -.99)], 0, .035)
        box('Front fender graphite crown', (s*1.059, 1.416, -1.37), (.39, .017, .69), 1, .007)
        box('Fender leading marker socket', (s*1.08, 1.355, -1.954), (.13, .038, .024), 1, .004)
        box('Fender amber marker', (s*1.08, 1.355, -1.969), (.08, .018, .008), mat=amber, bevel=.002)
        box('Fender chassis riser', (s*.83, 1.331, -.93), (.07, .12, .13), 2, .007)
        # Headlamp housings have thickness and lips, instead of floating strips.
        box('Forward worklight housing', (s*.72, 1.50, -1.677), (.234, .077, .045), 1, .008)
        box('Forehead worklight housing', (s*.615, 2.401, -1.138), (.155, .071, .052), 1, .007)
        box('Forehead worklight lens', (s*.615, 2.403, -1.169), (.107, .028, .009), mat=light, bevel=.002)
        box('Rear fender service inset', (s*1.055, 1.356, 1.35), (.34, .012, .79), 1, .005)
        for z in (1.02, 1.67):
            rod('Fender captive fastener', (s*1.055, 1.363, z), (s*1.055, 1.370, z), .015, 2, n=6)

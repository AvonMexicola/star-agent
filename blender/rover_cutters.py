"""Original sealed Burrow cutter cartridges. All detail follows the aim pivot.

The existing socket, 0.8 m barrel length and open 86 mm bore are contracts.
Keep the rear gimbal small: the front tyre and work lamp sweep past it.
"""
import math


def build_cutters(*, layout, g, box, rod, ring, root, light):
    for cutter in layout['cutters']:
        x, y, z = cutter['position']
        pivot = g.empty(cutter['pivot'], (x, y, z), root)
        rod('Cutter support', (x, 1.30, -1.57), (x, y, z), .072, 2)
        ring('Gimbal bearing', (x, y, z),
             [(-.06, .072), (-.06, .108), (.055, .108), (.055, .072), (-.06, .072)],
             2, 'Z', pivot, segments=20)
        box('Sealed cutter receiver', (x, y, z-.235), (.19, .16, .36), 1, .018, pivot)
        for side in (-1, 1):
            box('Split ceramic receiver armour', (x, y+side*.079, z-.215),
                (.192, .038, .30), 0, .012, pivot)
            box('Petrol service cheek', (x+side*.098, y, z-.225),
                (.018, .13, .245), 4, .012, pivot)
            box('Recessed cheek socket', (x+side*.108, y, z-.21),
                (.008, .064, .152), 1, .005, pivot)
            for depth in (-.15, -.28):
                rod('Captive cheek fastener', (x+side*.111, y+.043, z+depth),
                    (x+side*.116, y+.043, z+depth), .012, 2, pivot, n=6)
            # Real fin gaps and a recessed manifold break up the former white tube.
            for i in range(5):
                box('Receiver heat exchanger fin', (x+side*.113, y-.009, z-.155-i*.029),
                    (.012, .043, .011), 2, .002, pivot)
        box('Lower cartridge dovetail', (x, y-.109, z-.29), (.11, .028, .37), 2, .006, pivot)
        ring('Dark collimator body', (x, y, z),
             [(-.38, .048), (-.38, .074), (-.66, .074), (-.70, .059),
              (-.70, .048), (-.38, .048)], 1, 'Z', pivot, segments=24)
        ring('Ochre cartridge lock', (x, y, z),
             [(-.395, .075), (-.395, .099), (-.425, .099), (-.425, .075), (-.395, .075)],
             5, 'Z', pivot, segments=24)
        for depth in (-.45, -.53, -.61):
            ring('Machined cooling collar', (x, y, z),
                 [(depth, .073), (depth, .087), (depth-.012, .087),
                  (depth-.012, .073), (depth, .073)], 2, 'Z', pivot, segments=24)
        # Four separate ceramic ribs leave the darker cooling collars visible.
        for i in range(4):
            angle = math.pi/4+i*math.tau/4
            offset = (.077*math.cos(angle), .077*math.sin(angle))
            rib = box('Replaceable ceramic collimator rib',
                      (x+offset[0], y+offset[1], z-.539), (.048, .034, .24), 0, .008, pivot)
            # Helper meshes contain world-space vertices, so rotate each vertex
            # about the rib centre rather than moving the object around origin.
            cx, cy = x+offset[0], y+offset[1]
            for vertex in rib.data.vertices:
                dx, dy = vertex.co.x-cx, vertex.co.z-cy
                vertex.co.x = cx+math.cos(angle)*dx-math.sin(angle)*dy
                vertex.co.z = cy+math.sin(angle)*dx+math.cos(angle)*dy
        ring('Stepped nozzle shoulder', (x, y, z),
             [(-.655, .048), (-.655, .094), (-.682, .094), (-.705, .078),
              (-.705, .048), (-.655, .048)], 4, 'Z', pivot, segments=24)
        ring('Recessed aperture light', (x, y, z),
             [(-.726, .044), (-.726, .058), (-.741, .058), (-.741, .044), (-.726, .044)],
             axis='Z', parent=pivot, mat=light, segments=24)
        ring('Bored tungsten nozzle', (x, y, z),
             [(-.70, .058), (-.70, .077), (-.757, .077), (-.779, .068),
              (-.80, .068), (-.80, .043), (-.776, .043), (-.755, .058), (-.70, .058)],
             2, 'Z', pivot, segments=24)
        for side in (-1, 1):
            box('Nozzle locking ear', (x+side*.078, y, z-.725), (.020, .037, .043), 1, .004, pivot)
        g.empty(cutter['muzzle'], (x, y, z-.8), pivot)

"""Manufactured service assemblies and a fitted pilot console for the Nomad.

Labels and hardware describe construction; interactive display faces remain in
the runtime MFD module. This module adds no fictional usable switches or drawers.
"""
import math
import bpy


def detail_nomad(api, cabin):
    xyz, box, rod, poly, surface, label = (api[k] for k in ['xyz','box','rod','poly','surface','label'])
    ivory, dark, metal, teal, orange, rubber, mint, amber = (api[k] for k in ['ivory','dark','metal','teal','orange','rubber','mint','amber'])
    identity=api['IDENTITY']

    # One service family: inset cover, captive quarter-turns, external lifting eyes.
    for side in [-1, 1]:
        x = side * 4.26
        box('Drive / recessed inspection cover', (x,2.14,.40), (.045,.46,1.22), dark,.035)
        box('Drive / patrol petrol insert', (side*4.288,2.14,.40), (.010,.35,1.09), teal,.012)
        for y in [1.995,2.285]:
            for z in [-.10,.90]:
                rod('Drive / captive cover bolt',(side*4.294,y,z),(side*4.308,y,z),.021,metal,6)
        label('Drive / vessel registration',f'{identity["name"].upper()}  {identity["revision"]}',(side*4.305,2.12,.40),.114,ivory,(math.pi/2,0,side*math.pi/2))
        box('Drive / rescue band',(side*4.295,2.14,-.25),(.026,.34,.11),orange,.012)
        # Dark recessed thermal vanes follow the tapered aft drive, below the root.
        for j in range(7):
            z = 1.94 + j * .10
            radius = .99 - (z-1.89) / .87 * .24
            xx = side * (3.26 + radius * .951 + .020)
            box('Drive / aft thermal slot',(xx,2.14,z),(.030,.29,.035),rubber,.008)
        for j in range(10):
            angle = (j+.5) * math.tau/10
            # Petal heat shields are actual relief inside the recessed bore.
            a=(side*3.26+math.cos(angle)*.49,2.12+math.sin(angle)*.49,3.52)
            b=(side*3.26+math.cos(angle)*.55,2.12+math.sin(angle)*.55,3.90)
            rod('Drive / nozzle cooling rib',a,b,.018,metal,6)
        # The nozzle emitter is broken by an unlit centre core, so it reads as
        # a recessed annular assembly rather than an exposed featureless disk.
        rod('Drive / recessed emitter core',(side*3.26,2.12,3.49),(side*3.26,2.12,3.60),.19,dark,12)
        for angle in [math.pi/6,math.pi*5/6,math.pi*1.5]:
            rod('Drive / emitter support',(side*3.26+math.cos(angle)*.18,2.12+math.sin(angle)*.18,3.60),
                (side*3.26+math.cos(angle)*.46,2.12+math.sin(angle)*.46,3.57),.014,metal,6)
        # Broad landing soles have visible cleats and an exposed hydraulic sleeve.
        for z in [-2.50,2.87]:
            before_gear=set(bpy.context.scene.objects)
            for offset in [-.29,0,.29]:
                box('Gear / sole tread',(side*2.98,.157,z+.18+offset),(.67,.025,.055),dark,.007)
            rod('Gear / polished ram',(side*2.78,.65,z+.10),(side*2.94,.29,z+.17),.064,metal,10)
            box('Gear / service lug',(side*2.94,.29,z+.17),(.20,.17,.18),teal,.025)
            leg=next(leg for leg in api['LAYOUT']['gear']['legs'] if leg['pivot'][0]*side>0 and leg['pivot'][2]==z)
            pivot=bpy.data.objects[leg['name']]
            for obj in set(bpy.context.scene.objects)-before_gear:obj.parent=pivot;obj.matrix_parent_inverse=pivot.matrix_world.inverted()
        # Two service connectors beside the boarding handle; zero moving gameplay.
        for y in [1.78,2.91]:
            box('Portal / service insert',(side*1.58,y,4.086),(.15,.21,.025),dark,.018)
            box('Portal / insert contact',(side*1.58,y,4.103),(.075,.08,.012),metal,.008)
        box('Portal / caution tab',(side*1.11,3.35,4.213),(.19,.08,.015),orange,.007)
        # A pair of reinforced tie-down eyes belong to the aft loading structure.
        rod('Loading / cleat bridge',(side*1.77,1.27,3.99),(side*1.77,1.52,3.99),.043,dark,8)
        for y in [1.27,1.52]:
            rod('Loading / cleat foot',(side*1.77,y,3.87),(side*1.77,y,3.99),.038,metal,8)

    # One inset dorsal cooling assembly, deliberately clear of the walking liner.
    for j in range(15):
        z = -.48 + j*.13
        box('Roof / radiator fin',(0,3.99+(z+.48)*.008,z),(.67,.022,.046),metal,.007)
    for z in [-.61,1.55]:
        box('Roof / radiator end seal',(0,4.009,z),(.76,.022,.055),rubber,.006)
    box('Forebody / landing sensor housing',(0,1.38,-5.247),(.47,.20,.055),dark,.025)
    box('Forebody / landing sensor lens',(0,1.40,-5.281),(.27,.09,.025),teal,.012)
    label('Forebody / model mark',f'{identity["name"][0]} / {identity["revision"]}',(0,1.85,-5.265),.095,dark,(math.pi/2,0,math.pi))
    for socket in api['LAYOUT']['hardpoints']:
        x,y,z=socket['position'];side=1 if x>0 else -1
        slot=next(slot for slot in api['MOUNT_STANDARD']['geometrySlots'] if slot['size']==socket['size'])
        box('Hardpoint / S1 attachment housing',(x-side*.10,y,z),(.12,.58,.64),dark,.025)
        plate=rod('Hardpoint / S1 empty docking plate',(x-side*.035,y,z),(x,y,z),slot['dockingDiameter']/2,metal,32)
        for mod in list(plate.modifiers):plate.modifiers.remove(mod)
        pattern=slot['boltPattern']
        for i in range(pattern['count']):
            angle=i*math.tau/pattern['count'];yy=y-side*math.cos(angle)*pattern['pitchCircleDiameter']/2;zz=z+math.sin(angle)*pattern['pitchCircleDiameter']/2
            bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=pattern['holeDiameter']/2,depth=.15,location=xyz((x,yy,zz)),rotation=(0,math.pi/2,0));cutter=bpy.context.object
            modifier=plate.modifiers.new('Shared S1 bolt hole','BOOLEAN');modifier.operation='DIFFERENCE';modifier.object=cutter
            bpy.context.view_layer.objects.active=plate;bpy.ops.object.modifier_apply(modifier=modifier.name);bpy.data.objects.remove(cutter,do_unlink=True)
        edge=plate.modifiers.new('Dock edge radius','BEVEL');edge.width=.002;edge.segments=1
        box('Hardpoint / capped connector',(x+side*.006,y,z),(.012,.066,.071),teal,.006)
        label('Hardpoint / size label','S1',(x+side*.010,y+.087,z),.060,dark,(math.pi/2,0,side*math.pi/2))
        bpy.ops.object.empty_add(type='PLAIN_AXES',location=xyz(socket['position']));node=bpy.context.object;node.name=socket['name']
        node.rotation_euler=(0,side*math.pi/2,0)
        for key in ['kind','size','mount','forward','socketOnly']:node[key]=socket[key]
        # Blender custom properties cannot represent null. The packer records the
        # explicit installedWeapon:null in glTF extras without inventing a weapon.

    # The seated console is a sculpted cross-beam with a central knee recess and
    # individual MFD shelves. Nothing rises in front of the screen rectangles.
    before=set(bpy.context.scene.objects)
    poly('Console / faceted main beam',[(-1.52,-4.41),(1.52,-4.41),(1.47,-3.91),(.70,-3.84),(.49,-4.04),(-.49,-4.04),(-.70,-3.84),(-1.47,-3.91)],1.87,.46,dark,.045)
    for i in range(4):
        x=(i-1.5)*.52
        poly('Console / instrument cradle',[(x-.25,-4.35),(x+.25,-4.35),(x+.25,-4.07),(x+.21,-3.99),(x-.21,-3.99),(x-.25,-4.07)],1.912,.072,teal,.018)
        box('Console / cradle lower lip',(x,1.906,-3.984),(.39,.023,.025),metal,.007)
        rod('Console / instrument pedestal',(x,1.56,-4.31),(x,1.91,-4.31),.054,metal,8)
    for side in [-1,1]:
        mirror=lambda points:[(side*x,z) for x,z in points]
        poly('Console / side equipment pod',mirror([(.83,-3.86),(1.48,-3.89),(1.53,-3.54),(1.42,-2.38),(.95,-2.43),(.86,-2.90)]),1.72,.41,dark,.055)
        poly('Console / angled control deck',mirror([(.92,-3.71),(1.43,-3.73),(1.40,-2.49),(1.02,-2.53)]),1.744,.020,teal,.014)
        for j in range(3):
            box('Console / tactile switch bed',(side*1.16,1.767,-3.49+j*.105),(.27,.032,.076),rubber,.012)
            box('Console / covered switch',(side*1.16,1.793,-3.49+j*.105),(.065,.035,.052),orange if j==0 else metal,.010)
        # Side sticks and guarded controls are visible hardware, not extra inputs.
        rod('Console / stick socket',(side*.52,1.63,-2.99),(side*.52,1.78,-2.99),.092,dark,10)
        rod('Console / shaped stick',(side*.52,1.76,-2.99),(side*.52,1.97,-3.05),.046,rubber,10)
        box('Console / stick grip',(side*.52,1.96,-3.05),(.10,.13,.11),dark,.035)
        box('Console / stick thumb cap',(side*.52,2.037,-3.054),(.061,.021,.071),orange,.010)
        box('Console / illuminated system strip',(side*1.20,1.774,-2.63),(.24,.008,.028),mint,.003)
        label('Console / side identification','FLIGHT' if side<0 else 'UTILITY',(side*1.19,1.768,-2.89),.046,ivory,(0,0,0))
        surface('Console / sloping cheek',[(side*1.46,1.41,-3.84),(side*1.46,1.86,-3.84),(side*1.56,1.81,-4.32),(side*1.56,1.27,-4.32)],metal,.025)
        for j in range(4):
            box('Console / cooling grille',(side*1.28,1.645-j*.07,-3.895),(.24,.018,.010),rubber,.004)
    box('Console / central lower bridge',(0,1.47,-4.07),(.75,.14,.13),metal,.025)
    label('Console / pilot identifier','NOMAD / PILOT',(0,1.50,-3.992),.055,ivory,(math.pi/2,0,0))
    parts=set(bpy.context.scene.objects)-before
    bpy.ops.object.empty_add(type='PLAIN_AXES',location=(0,0,0));console=bpy.context.object;console.name='NomadConsole';console.parent=cabin
    for obj in parts:obj.parent=console

"""Original fitted utility interior. Called by build_ship.py; no external assets."""
import json
import math
import subprocess
import bpy


def build_cabin(api):
    root, xyz = api['ROOT'], api['xyz']
    box, rod, label, material = (api[k] for k in ['box', 'rod', 'label', 'material'])
    ivory, dark, metal, teal, rubber, mint = (api[k] for k in ['ivory', 'dark', 'metal', 'teal', 'rubber', 'mint'])
    # Runtime boarding remains the single authority, including the fixture sockets.
    layout = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
        "import {SHIP_LAYOUT} from './src/boarding.js'; process.stdout.write(JSON.stringify(SHIP_LAYOUT));"], cwd=root))
    b, r = layout['berth'], layout['cargoRack']
    start = set(bpy.context.scene.objects)
    fabric = material('Cabin / woven sage', (.17, .23, .18), .0, .92)
    blanket = material('Cabin / field blanket', (.065, .10, .078), .0, .98)
    warning = material('Cabin / warm marker', (.73, .42, .11), .15, .56)
    cx, cz = (b['minX'] + b['maxX']) / 2, (b['minZ'] + b['maxZ']) / 2
    width, length = b['maxX'] - b['minX'], b['maxZ'] - b['minZ']
    box('Berth / support plinth', (cx, 1.32, cz), (width-.035, .60, length-.035), dark, .035)
    box('Berth / rounded sleeping pan', (cx, 1.61, cz), (width, .10, length), metal, .035)
    box('Berth / tailored mattress', (cx, 1.725, cz), (width-.10, .15, length-.10), fabric, .06)
    box('Berth / raised head cushion', (cx, 1.84, 1.08), (.70, .14, .37), fabric, .055)
    box('Berth / folded blanket', (cx, 1.822, -.03), (.75, .044, 1.17), blanket, .018)
    for z in [-.49, -.44, .41, .46]:
        box('Berth / stitched bands', (cx, 1.847, z), (.69, .003, .008), fabric, .001)
    for z in [-.49, .24, .97]:
        box('Berth / drawer shadow', (-.706, 1.30, z), (.018, .41, .64), rubber, .01)
        box('Berth / drawer front', (-.706, 1.30, z), (.021, .35, .59), teal, .02)
        rod('Berth / recessed pull', (-.692, 1.37, z-.12), (-.692, 1.37, z+.12), .012, metal, 8)
    # The grab rail and mattress stay inside the same conservative collision box.
    for z in [-.75, 1.30]:
        rod('Berth / end grab rail', (-1.52, 1.91, z), (-.76, 1.91, z), .018, metal, 10)
    box('Berth / service headboard', (-1.58, 2.31, .45), (.08, .82, 1.67), dark, .03)
    for z in [-.12, .72]:
        box('Berth / acoustic inset', (-1.532, 2.33, z), (.018, .53, .73), fabric, .01)
    box('Berth / reading-light bracket', (-1.48, 2.76, 1.11), (.22, .07, .18), metal, .025)
    box('Berth / reading-light lens', (-1.465, 2.715, 1.11), (.16, .012, .12), mint, .004)
    box('Berth / identification plaque', (-1.516, 2.48, -.25), (.014, .21, .66), dark, .004)
    label('Berth / identification', '01 / BERTH', (-1.505, 2.43, -.25), .076, ivory, (math.pi/2, 0, math.pi/2))
    # Lidded overhead personal shelves read as fitted cabinetry, with safe headroom.
    box('Cabin / overhead locker', (-1.44, 2.98, .31), (.36, .40, 2.12), ivory, .045)
    for z in [-.39, .29, .97]:
        box('Cabin / locker inset', (-1.250, 2.98, z), (.016, .29, .57), dark, .012)
        box('Cabin / locker latch', (-1.234, 2.89, z), (.026, .055, .13), metal, .007)
    # Cabin ribs separate cockpit, living space and the aft load area.
    for z in [-1.57, 1.80]:
        for side in [-1, 1]:
            box('Cabin / doorway rib', (side*1.61, 2.18, z), (.10, 2.24, .12), metal, .024)
            box('Cabin / rib inset', (side*1.536, 2.75, z), (.018, .62, .07), dark, .004)
        box('Cabin / overhead beam', (0, 3.32, z), (3.25, .10, .16), metal, .025)
    # A rear rack exposes all eight physical box mounts. Visibility follows inventory.
    for x in [-1.615, -.886]:
        for z in [2.10, 3.60]:
            rod('Cargo rack / upright', (x, 1.04, z), (x, 2.58, z), .027, metal, 10)
    for y in [1.08, 1.79, 2.50]:
        box('Cargo rack / load shelf', (-1.25, y, 2.85), (.78, .055, 1.59), dark, .012)
        box('Cargo rack / shelf lip', (-.864, y+.018, 2.85), (.026, .085, 1.52), metal, .007)
    box('Cargo rack / backplate', (-1.637, 1.84, 2.85), (.025, 1.55, 1.54), teal, .007)
    box('Cargo rack / console bracket', (-1.15, 2.64, 2.83), (.37, .11, .15), metal, .015)
    box('Cargo rack / live display housing', (-.962, 2.91, 2.83), (.14, .51, 1.12), dark, .04)
    box('Cargo rack / status strip', (-.883, 3.14, 2.83), (.017, .018, .72), mint, .004)
    for z in [2.36, 3.31]:
        box('Cargo rack / control key', (-.883, 2.695, z), (.02, .032, .095), metal, .005)
    boxes = []
    for index in range(8):
        parts = set(bpy.context.scene.objects)
        y, z = 1.42 + (index//4)*.71, 2.26 + (index%4)*.39
        box('Cargo box / impact shell', (-1.23, y, z), (.60, .55, .335), ivory, .045)
        box('Cargo box / lid seam', (-.923, y+.15, z), (.015, .017, .26), rubber, .003)
        box('Cargo box / recessed face', (-.920, y-.035, z), (.025, .30, .258), dark, .012)
        box('Cargo box / ID stripe', (-.903, y+.057, z), (.016, .023, .20), teal, .003)
        rod('Cargo box / handle', (-.894, y-.15, z-.075), (-.894, y-.15, z+.075), .011, metal, 8)
        for zz in [z-.115, z+.115]:
            box('Cargo box / restraint band', (-.907, y, zz), (.014, .48, .018), metal, .003)
        parts = set(bpy.context.scene.objects)-parts
        bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0,0,0))
        mount = bpy.context.object;mount.name = f'CargoBox_{index+1}'
        for obj in parts: obj.parent = mount
        boxes.append(mount)
    for name, point in [('BerthEye', b['eye']), ('BerthStand', b['stand']),
                        ('CargoRackAccess', [r['accessX'], 2.75, r['accessZ']])]:
        bpy.ops.object.empty_add(type='PLAIN_AXES', location=xyz(point));bpy.context.object.name=name
    parts = set(bpy.context.scene.objects)-start
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0,0,0));cabin = bpy.context.object;cabin.name='NomadCabin'
    for obj in parts:
        if obj.parent is None: obj.parent=cabin
    cabin['role']='Solo utility starter / physical berth and inventory box mounts'
    return cabin, boxes

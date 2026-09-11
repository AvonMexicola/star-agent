"""Original AEON retail promenade: four storefronts and the sealed Deck 05 door.

Rebuild from repository root with Blender 5.2:
  env ALSOFT_DRIVERS=null blender --background --factory-startup -noaudio \
    --python-exit-code 1 --python blender/build_station_promenade.py

Append -- --render-dir /tmp/aeon-promenade-studio for CPU Cycles QA images.

Game coordinates: metres, X right/Y up/Z aft. Promenade floor Y=-8, shared with
the concourse. The corridor runs aft from the concourse portal at Z -19 to the
sealed bulkhead at Z -49. Shop rooms occupy X 4.6..13 on both sides; the mid
court between them opens to the same width and keeps the station glazing.

`src/station-promenade.js` owns the pressurised shell, glazing and lighting;
this file owns the storefronts, fixtures, display stock and the locked door.
Static batches share materials; the exported scene extras carry assembly bounds
for collision and budget audits. No external geometry, texture, font download
or decoder dependency.
"""
import json
import math
import re
import sys
import tempfile
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/models'
CSS = (ROOT / 'src/style.css').read_text(encoding='utf-8')
M = {}
PARTS = {}
STOCK = []
ASSEMBLY = ''

# Shared room contract. src/station-promenade.js repeats these planes; changing
# one side alone leaves a visible gap between the shell and the storefronts.
FLOOR = -8.0
CORRIDOR = 4.6          # corridor half width, and the storefront plane
BACK = 13.0             # shop back wall plane
# The shop ceiling's lowest visible underside is Y -4.66 (its party downstands),
# with beams at -4.62 and cassettes at -4.50: 3.34 m of headroom, matching the
# enclosed concourse shops. The corridor ceiling above the fascia is at -3.45.
UNITS = [
    {'key': 'Galley', 'side': -1, 'z': -25.7, 'accent': 'Ochre'},
    {'key': 'Outfitter', 'side': 1, 'z': -25.7, 'accent': 'Dark'},
    {'key': 'Hydroponics', 'side': -1, 'z': -38.9, 'accent': 'Foliage'},
    {'key': 'Souvenir', 'side': 1, 'z': -38.9, 'accent': 'Petrol'},
]
HALF = 4.3              # unit half length along Z
BULKHEAD_Z = -48.9


def vec(p):
    return Vector((p[0], -p[2], p[1]))


def material(name, token, metallic, roughness, emission=0):
    color = re.search(r'--' + token + r':\s*#([0-9a-fA-F]{6})', CSS).group(1)
    rgb = [int(color[i:i+2], 16) / 255 for i in (0, 2, 4)]
    # CSS tokens are sRGB; Blender node base colours are scene-linear.
    rgb = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb]
    m = bpy.data.materials.new('Finish' + name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    if emission:
        p.inputs['Emission Color'].default_value = (*rgb, 1)
        p.inputs['Emission Strength'].default_value = emission
    M[name] = m


def reset():
    global PARTS, STOCK
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    PARTS = {}
    STOCK = []


def finish(obj, name, mat, radius=0):
    obj.name = ASSEMBLY + '_' + name
    obj.data.materials.append(M[mat])
    if radius:
        mod = obj.modifiers.new('Manufactured radius', 'BEVEL')
        mod.width = radius
        mod.segments = 2 if radius >= .02 else 1
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod = obj.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    PARTS.setdefault(ASSEMBLY, []).append(obj)
    return obj


def box(name, p, size, mat='Ivory', radius=.018):
    bpy.ops.mesh.primitive_cube_add(size=1, location=vec(p))
    obj = bpy.context.object
    obj.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, min(radius, min(size) * .22))


def rod(name, a, b, radius, mat='Steel', sides=12):
    va, vb = vec(a), vec(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius,
        depth=(vb-va).length, location=(va+vb)/2)
    obj = bpy.context.object
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = (vb-va).to_track_quat('Z', 'Y')
    return finish(obj, name, mat, min(.009, radius * .13))


def profile(name, yz, x, depth, mat='Ivory', radius=.016):
    # Extrude a purposeful side silhouette along X, never a flattened image.
    count = len(yz)
    verts = [vec((xx, y, z)) for xx in (x-depth/2, x+depth/2) for y, z in yz]
    faces = [tuple(range(count-1, -1, -1)), tuple(range(count, count*2))]
    faces += [(i, (i+1) % count, (i+1) % count+count, i+count) for i in range(count)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return finish(obj, name, mat, radius)


def plan(name, xz, y, height, mat='Ivory', radius=.008, top=1.0):
    """Extrude an authored plan outline upward, optionally tapering the top ring
    about its centroid, so pots and planters have a real draft angle."""
    count = len(xz)
    cx = sum(p[0] for p in xz) / count
    cz = sum(p[1] for p in xz) / count
    verts = [vec((cx+(x-cx)*scale, yy, cz+(z-cz)*scale))
        for yy, scale in ((y, 1.0), (y+height, top)) for x, z in xz]
    faces = [tuple(range(count-1, -1, -1)), tuple(range(count, count*2))]
    faces += [(i, (i+1) % count, (i+1) % count+count, i+count) for i in range(count)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return finish(obj, name, mat, radius)


def bolt(p, axis='x'):
    d = Vector((.01, 0, 0) if axis == 'x' else (0, 0, .01))
    rod('Captive fastener', Vector(p)-d, Vector(p)+d, .012, 'Steel', 6)


def anchor(name, p):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = vec(p)
    return obj


def record_stock(kind, start):
    STOCK.append({'kind': kind, 'rack': ASSEMBLY, 'objects': PARTS[ASSEMBLY][start:]})


# ----------------------------------------------------------------- storefronts

def storefront(unit):
    """A constructed retail unit inside the promenade: party walls, an opaque
    ceiling of its own, and a wide unobstructed opening onto the corridor."""
    global ASSEMBLY
    key, s, zc, accent = unit['key'], unit['side'], unit['z'], unit['accent']
    ASSEMBLY = key + 'Architecture'
    mid = s * (CORRIDOR + BACK) / 2
    depth = BACK - CORRIDOR
    box('Back wall', (s*(BACK+.15), -6.31, zc), (.3, 3.38, HALF*2), 'Ivory')
    box('Back wall foot trim', (s*(BACK-.02), -7.91, zc), (.05, .18, HALF*2), 'Steel')
    for i in range(3):
        box('Back wall cassette', (s*(BACK-.03), -6.16, zc+(i-1)*2.78),
            (.05, 2.66, 2.56), accent if i == 1 else 'Petrol')
    for dz in (-HALF-.125, HALF+.125):
        box('Party wall', (mid, -6.31, zc+dz), (depth, 3.38, .25), 'Ivory')
        box('Party wall trim', (mid, -7.91, zc+dz-math.copysign(.15, dz)), (depth, .18, .04), 'Steel')
    # Ceiling: continuous skin, replaceable cassettes, exposed beams, downstands.
    box('Continuous roof skin', (mid, -4.35, zc), (depth+.1, .08, HALF*2+.1), 'Dark', .012)
    for i in range(3):
        for j in range(4):
            box('Replaceable ceiling cassette',
                (s*(CORRIDOR+(i+.5)*depth/3), -4.455, zc-HALF+(j+.5)*HALF/2),
                (depth/3-.08, .09, HALF/2-.09), 'Ivory', .012)
            if (i, j) == (1, 1):
                box('Recessed return vent', (s*(CORRIDOR+(i+.5)*depth/3), -4.503,
                    zc-HALF+(j+.5)*HALF/2), (1.34, .016, .76), 'Dark', .004)
                for dz in (-.27, -.18, -.09, 0, .09, .18, .27):
                    box('Vent louvre', (s*(CORRIDOR+(i+.5)*depth/3), -4.518,
                        zc-HALF+(j+.5)*HALF/2+dz), (1.24, .025, .026), 'Steel', .005)
    for j in range(5):
        box('Cross beam', (mid, -4.56, zc-HALF+j*HALF/2), (depth, .12, .13), 'Steel', .012)
    for x in (CORRIDOR+.06, BACK-.06):
        box('Perimeter beam', (s*x, -4.555, zc), (.12, .13, HALF*2), 'Dark', .012)
    for dz in (-HALF-.12, HALF+.12):
        box('Sealed party downstand', (mid, -4.52, zc+dz), (depth, .30, .16), 'Petrol', .012)
    box('Sealed rear downstand', (s*(BACK+.02), -4.52, zc), (.2, .30, HALF*2+.3), 'Petrol', .012)
    # Frontage: piers, a suspended fascia carrying the brand, and a lightline.
    box('Suspended fascia', (s*CORRIDOR, -4.085, zc), (.5, 1.27, HALF*2), accent, .025)
    box('Fascia soffit', (s*CORRIDOR, -4.745, zc), (.54, .05, HALF*2), 'Dark', .008)
    box('Recessed sign field', (s*4.335, -4.16, zc), (.03, .62, 7.9),
        'Dark' if accent in ('Foliage', 'Ochre') else 'Ivory', .008)
    box('Portal lightline', (s*4.40, -4.79, zc), (.05, .03, 7.0), 'Mint', .004)
    for dz in (-3.95, 3.95):
        box('Portal pier', (s*CORRIDOR, -6.34, zc+dz), (.5, 3.32, .7), 'Ivory', .03)
        box('Pier foot guard', (s*CORRIDOR, -7.72, zc+dz), (.56, .58, .76), 'Dark')
        for y in (-7.0, -5.6):
            bolt((s*4.34, y, zc+dz))
    box('Threshold plate', (s*CORRIDOR, -7.982, zc), (.52, .036, 7.2), 'Steel', .004)
    # Shop floor: a laid finish inside the unit, framed by an accent border.
    box('Shop floor finish', (mid, -7.985, zc), (depth-.16, .03, HALF*2-.16), 'Rubber', 0)
    for dz in (-HALF+.06, HALF-.06):
        box('Floor border', (mid, -7.982, zc+dz), (depth-.16, .036, .1), accent, 0)
    anchor(key+'Sign', (s*4.31, -4.16, zc))


def counter(unit, length=5.0, accent_face=True):
    """Service counter with a customer face, staff drawers and a terminal."""
    global ASSEMBLY
    key, s, zc, accent = unit['key'], unit['side'], unit['z'], unit['accent']
    ASSEMBLY = key + 'Counter'
    x = s * 9.9
    box('Recessed toe plinth', (x, -7.87, zc), (.66, .26, length-.1), 'Dark')
    box('Cabinet carcass', (x, -7.42, zc), (.75, .82, length), 'Petrol', .035)
    box('Radiused worktop', (x, -6.97, zc), (.87, .10, length+.2), 'Steel', .03)
    box('Work surface insert', (x, -6.914, zc-.8), (.69, .012, length*.42), 'Rubber', .004)
    step = length / 4
    for i in range(4):
        z = zc + (i - 1.5) * step
        box('Customer panel', (x-s*.389, -7.43, z), (.045, .72, step-.06), 'Ivory', .012)
        box('Panel inset', (x-s*.418, -7.43, z), (.012, .42, step-.24),
            accent if accent_face else 'Petrol', .004)
        for dz in (-.31, .31):
            bolt((x-s*.428, -7.64, z+dz))
        box('Staff drawer face', (x+s*.39, -7.27, z), (.04, .28, step-.09), 'Ivory')
        rod('Drawer pull', (x+s*.435, -7.26, z-.16), (x+s*.435, -7.26, z+.16), .016, 'Steel', 8)
    for dz in (-length/2-.02, length/2+.02):
        box('End bumper', (x, -7.44, zc+dz), (.83, .86, .065), 'Dark')
    box('Under-counter diffuser', (x-s*.427, -7.055, zc), (.015, .025, length-.15), 'Mint', .003)
    # Mount for the runtime interaction label; catalogue state lives in its modal.
    rod('Terminal stem', (x, -6.92, zc+1.23), (x, -6.54, zc+1.23), .026)
    box('Terminal back', (x-s*.025, -6.53, zc+1.23), (.09, .38, .48), 'Dark')
    box('Terminal recess', (x-s*.075, -6.53, zc+1.23), (.018, .30, .4), 'Rubber', .006)
    anchor(key+'Screen', (x-s*.09, -6.53, zc+1.23))


def wall_shelving(unit, z_offset, shelves, width=2.6):
    """Recessed back-wall shelving; the stock functions fill its levels."""
    s, zc, accent = unit['side'], unit['z'], unit['accent']
    x = s * 12.65
    z = zc + z_offset
    box('Shelving foot', (x, -7.94, z), (.72, .12, width), 'Dark')
    box('Recessed backing', (x+s*.19, -6.62, z), (.1, 2.58, width-.06), 'Petrol')
    for dz in (-width/2+.06, width/2-.06):
        box('Extruded upright', (x, -6.68, z+dz), (.12, 2.56, .11), 'Steel')
        for y in (-7.7, -7.2, -6.7, -6.2, -5.7):
            box('Adjustable slot', (x-s*.067, y, z+dz), (.014, .075, .027), 'Rubber', .001)
    box('Shelving header', (x, -5.36, z), (.38, .13, width-.02), accent)
    box('Header diffuser', (x-s*.15, -5.44, z), (.025, .02, width-.24), 'Mint', .002)
    for y in shelves:
        box('Folded shelf', (x-s*.06, y, z), (.66, .055, width-.16), 'Steel')
        box('Shelf front lip', (x-s*.36, y+.035, z), (.04, .09, width-.16), 'Ivory')
    box('Inventory label mount', (x-s*.36, -7.62, z), (.045, .11, width*.6), 'Ivory')
    return x, z


# ---------------------------------------------------------------- galley stock

def meal_tin(x, y, z, width=.24, height=.075):
    start = len(PARTS.get(ASSEMBLY, []))
    plan('Pressed meal tin', [(x-width/2, z-.155), (x+width/2, z-.155),
        (x+width/2+.012, z-.13), (x+width/2+.012, z+.13), (x+width/2, z+.155),
        (x-width/2, z+.155), (x-width/2-.012, z+.13), (x-width/2-.012, z-.13)],
        y, height, 'Steel', .004)
    box('Sealed foil lid', (x, y+height+.004, z), (width+.02, .008, .30), 'Paper', .002)
    box('Printed band', (x, y+height*.45, z), (width+.026, .028, .312), 'Ochre', .002)
    record_stock('mealTin', start)


def brew_urn(x, y, z, height=.62, radius=.155):
    start = len(PARTS.get(ASSEMBLY, []))
    rod('Insulated urn body', (x, y+.05, z), (x, y+height-.06, z), radius, 'Ivory', 14)
    rod('Urn base ring', (x, y, z), (x, y+.05, z), radius+.018, 'Dark', 14)
    rod('Urn lid', (x, y+height-.06, z), (x, y+height, z), radius+.012, 'Steel', 14)
    rod('Lid grip', (x, y+height, z), (x, y+height+.045, z), .034, 'Rubber', 10)
    box('Sight gauge', (x-radius-.008, y+height*.55, z), (.03, .30, .05), 'Petrol', .004)
    rod('Dispense spout', (x, y+.185, z-radius-.02), (x, y+.185, z-radius-.085), .017, 'Steel', 10)
    box('Lever handle', (x, y+.30, z-radius-.055), (.036, .13, .05), 'Dark', .006)
    record_stock('brewUrn', start)


def cup_stack(x, y, z, count=7, radius=.043):
    start = len(PARTS.get(ASSEMBLY, []))
    for i in range(count):
        rod('Nested cup', (x, y+i*.021, z), (x, y+i*.021+.027, z), radius+i*.0015, 'Paper', 8)
    record_stock('cupStack', start)


def galley_stock(unit):
    global ASSEMBLY
    s, zc = unit['side'], unit['z']
    ASSEMBLY = 'GalleyServiceWall'
    x, z = wall_shelving(unit, -2.05, (-7.64, -6.62), 2.9)
    box('Stainless prep counter', (s*12.35, -7.5, z), (1.0, 1.0, 2.9), 'Steel', .02)
    box('Prep counter splashback', (s*12.82, -6.62, z), (.06, .76, 2.9), 'Steel', .008)
    for i, dz in enumerate((-.95, 0, .95)):
        brew_urn(s*12.3, -7.0, z+dz, .62 - i*.05, .155 - i*.012)
    for dz in (-.75, -.25, .25, .75):
        meal_tin(s*12.4, -7.585, z+dz, .24, .075)
    for dz in (-.6, .1, .8):
        meal_tin(s*12.4, -6.565, z+dz, .21, .065)
    ASSEMBLY = 'GalleyCounterService'
    x = s * 9.9
    cup_stack(x-s*.16, -6.915, zc-1.55)
    cup_stack(x-s*.16, -6.915, zc-1.31)
    box('Tray dispenser', (x+s*.02, -6.83, zc+.15), (.44, .28, .56), 'Dark', .012)
    for i in range(5):
        box('Stacked service tray', (x+s*.02, -6.70+i*.016, zc+.15), (.40, .012, .52), 'Ivory', .003)
    box('Condiment caddy', (x-s*.13, -6.845, zc-.62), (.20, .14, .30), 'Ochre', .012)
    for dz in (-.09, 0, .09):
        rod('Caddy bottle', (x-s*.13, -6.90, zc-.62+dz), (x-s*.13, -6.72, zc-.62+dz), .026, 'Petrol', 10)
    box('Order display mount', (x+s*.02, -6.55, zc-1.95), (.2, .5, .04), 'Steel', .006)
    ASSEMBLY = 'GalleyStandingRail'
    # A narrow standing rail with three stools, clear of the entrance line.
    rx = s * 6.35
    box('Standing rail top', (rx, -6.98, zc+2.3), (.46, .06, 3.4), 'Ivory', .012)
    box('Rail apron', (rx, -7.14, zc+2.3), (.10, .26, 3.3), 'Petrol', .008)
    for dz in (-1.45, 1.45):
        rod('Rail leg', (rx, -7.98, zc+2.3+dz), (rx, -7.01, zc+2.3+dz), .038, 'Steel', 12)
        rod('Leg foot', (rx-.14, -7.975, zc+2.3+dz), (rx+.14, -7.975, zc+2.3+dz), .028, 'Dark', 8)
    for dz in (-1.05, 0, 1.05):
        sx = rx - s*.62
        rod('Stool column', (sx, -7.96, zc+2.3+dz), (sx, -7.32, zc+2.3+dz), .036, 'Steel', 12)
        rod('Stool base', (sx, -7.98, zc+2.3+dz), (sx, -7.93, zc+2.3+dz), .17, 'Dark', 12)
        rod('Stool foot ring', (sx-.14, -7.72, zc+2.3+dz), (sx+.14, -7.72, zc+2.3+dz), .014, 'Steel', 8)
        rod('Stool seat', (sx, -7.32, zc+2.3+dz), (sx, -7.27, zc+2.3+dz), .175, 'Ivory', 12)
        rod('Seat cushion', (sx, -7.27, zc+2.3+dz), (sx, -7.24, zc+2.3+dz), .168, 'Rubber', 12)


# ------------------------------------------------------------- outfitter stock

def hanging_garment(x, y, z, length=.86, width=.40, colour='Petrol'):
    """A hung soft garment read from the aisle: garments hang side by side along
    the rail, so the wide dimension is Z and the depth on X is a hand's width.
    A sloped shoulder line, a body tapering to the hem, sleeves hanging clear of
    it and a fastened front placket give it a garment silhouette rather than a
    block. Extruding the silhouette the other way makes it read as a locker."""
    start = len(PARTS.get(ASSEMBLY, []))
    half = width / 2
    rod('Hanger hook', (x, y+.10, z), (x, y+.17, z), .006, 'Steel', 8)
    rod('Hanger bar', (x, y+.055, z-half*.84), (x, y+.055, z+half*.84), .011, 'Steel', 8)
    profile('Shouldered garment body', [
        (y+.045, z-.085), (y+.045, z+.085),
        (y-.03, z+half), (y-length*.44, z+half*.94), (y-length, z+half*.80),
        (y-length, z-half*.80), (y-length*.44, z-half*.94), (y-.03, z-half)],
        x, .105, colour, .014)
    for sz in (-1, 1):
        profile('Sleeve', [
            (y-.055, z+sz*half*.82), (y-.055, z+sz*half*1.03),
            (y-length*.62, z+sz*half*.99), (y-length*.68, z+sz*half*.78)],
            x, .086, colour, .012)
    box('Fastened front placket', (x-.054, y-length*.46, z), (.012, length*.84, .055), 'Ivory', .004)
    for fraction in (.28, .52, .76):
        box('Front fastening', (x-.061, y-length*fraction, z), (.014, .026, .034), 'Steel', .003)
    box('Woven collar band', (x, y+.055, z), (.112, .05, .19), 'Ivory', .012)
    record_stock('hangingGarment', start)


def folded_stack(x, y, z, count=4, width=.40, depth=.30, colour='Ivory'):
    start = len(PARTS.get(ASSEMBLY, []))
    for i in range(count):
        box('Folded garment', (x, y+.045+i*.075, z+(i % 2)*.008),
            (depth, .062, width - i*.012), colour, .012)
    record_stock('foldedStack', start)


def torso_form(x, y, z):
    start = len(PARTS.get(ASSEMBLY, []))
    rod('Form base', (x, y, z), (x, y+.04, z), .21, 'Dark', 12)
    rod('Form column', (x, y+.04, z), (x, y+.86, z), .028, 'Steel', 12)
    profile('Shaped torso', [(y+.86, z-.10), (y+1.02, z-.13), (y+1.34, z-.16),
        (y+1.44, z-.10), (y+1.44, z+.10), (y+1.34, z+.16), (y+1.02, z+.13),
        (y+.86, z+.10)], x, .34, 'Ivory', .02)
    box('Displayed jacket front', (x-.178, y+1.14, z), (.03, .46, .30), 'Petrol', .01)
    box('Displayed jacket back', (x+.178, y+1.14, z), (.03, .46, .30), 'Petrol', .01)
    for sx in (-1, 1):
        profile('Displayed sleeve', [(y+1.36, z-.07), (y+1.36, z+.07),
            (y+.98, z+.06), (y+.98, z-.06)], x+sx*.19, .09, 'Petrol', .008)
    record_stock('torsoForm', start)


def outfitter_stock(unit):
    global ASSEMBLY
    s, zc = unit['side'], unit['z']
    ASSEMBLY = 'OutfitterFoldedWall'
    x, z = wall_shelving(unit, -2.1, (-7.62, -6.86, -6.10), 2.7)
    for i, y in enumerate((-7.62, -6.86, -6.10)):
        for j, dz in enumerate((-.86, 0, .86)):
            folded_stack(x-s*.16, y, z+dz, 3 + (i + j) % 3, .40 - j*.03, .30,
                ('Ivory', 'Petrol', 'Ochre')[(i + j) % 3])
    # Two rails flanking the customer route to the till, never across it.
    for index, dz in enumerate((2.35, -2.6)):
        ASSEMBLY = 'OutfitterRail' + str(index)
        rx = s * 7.2
        rz = zc + dz
        for ddz in (-1.15, 1.15):
            rod('Rail upright', (rx, -7.97, rz+ddz), (rx, -5.72, rz+ddz), .034, 'Steel', 12)
            rod('Upright foot', (rx-.34, -7.965, rz+ddz), (rx+.34, -7.965, rz+ddz), .03, 'Dark', 8)
        box('Rail head', (rx, -5.70, rz), (.18, .09, 2.5), 'Dark', .012)
        rod('Hanging rail', (rx, -5.88, rz-1.13), (rx, -5.88, rz+1.13), .019, 'Steel', 12)
        for i in range(6):
            hanging_garment(rx, -5.94, rz - .85 + i*.34, .82 + (i % 3)*.06,
                .40 - (i % 2)*.04, ('Petrol', 'Ochre', 'Ivory')[i % 3])
        box('Lower display shelf', (rx, -7.42, rz), (.52, .05, 2.4), 'Steel')
        for ddz in (-.7, 0, .7):
            folded_stack(rx, -7.40, rz+ddz, 3, .34, .28, ('Ochre', 'Ivory', 'Petrol')[index])
    # Two window displays inside the piers. They are separate assemblies: one
    # shared bounding box would make the 6 m of open floor between them solid.
    for index, dz in enumerate((-3.1, 3.1)):
        ASSEMBLY = 'OutfitterForm' + str(index)
        torso_form(s*5.6, -7.98, zc + dz)


# ---------------------------------------------------------- hydroponics stock

def leafy_plant(x, y, z, height=.34, leaves=7, spread=.15):
    """An authored plant: a tapered pot, growing medium and radial leaf blades."""
    start = len(PARTS.get(ASSEMBLY, []))
    plan('Tapered pot', [(x-.085, z-.085), (x+.085, z-.085), (x+.085, z+.085),
        (x-.085, z+.085)], y, .105, 'Ochre', .012, 1.26)
    box('Growing medium', (x, y+.108, z), (.15, .02, .15), 'Rubber', .002)
    rod('Central stem', (x, y+.11, z), (x, y+.11+height*.55, z), .011, 'Foliage', 8)
    for i in range(leaves):
        a = i * math.tau / leaves + (i % 2) * .22
        tip = (x + math.cos(a)*spread, y + .11 + height*(.55 + .30*(i % 3)/2), z + math.sin(a)*spread)
        mid = (x + math.cos(a)*spread*.45, y + .11 + height*.42, z + math.sin(a)*spread*.45)
        profile('Leaf blade', [(mid[1], mid[2]), (tip[1], tip[2]),
            (tip[1]-.035, tip[2]-.012), (mid[1]-.03, mid[2]-.01)],
            (mid[0]+tip[0])/2, .055 + (i % 2)*.02, 'Foliage', .004)
    record_stock('potPlant', start)


def grow_tray(x, y, z, width=2.3, sprouts=9):
    start = len(PARTS.get(ASSEMBLY, []))
    box('Hydroponic tray', (x, y+.05, z), (.55, .10, width), 'Petrol', .012)
    box('Tray growing bed', (x, y+.105, z), (.47, .022, width-.08), 'Ochre', .003)
    for dz in (-width/2+.09, width/2-.09):
        rod('Nutrient line', (x-.2, y+.13, z+dz), (x+.2, y+.13, z+dz), .012, 'Steel', 8)
    for i in range(sprouts):
        sz = z - width/2 + (i + .5) * width / sprouts
        sx = x + (-.12 if i % 2 else .12)
        top = y + .12 + .15 + (i % 3)*.03
        rod('Seedling stem', (sx, y+.12, sz), (sx, top, sz), .011, 'Foliage', 6)
        for dz, dx in ((.075, .036), (-.068, -.032), (.030, -.045), (-.026, .048)):
            profile('Seedling leaf', [(top-.05, sz), (top+.038, sz+dz),
                (top+.006, sz+dz*.84)], sx+dx, .040, 'Foliage', 0)
    record_stock('growTray', start)


def hydroponics_stock(unit):
    global ASSEMBLY
    s, zc = unit['side'], unit['z']
    for index, dz in enumerate((-2.15, 1.0)):
        ASSEMBLY = 'HydroponicsGrowRack' + str(index)
        x = s * 12.5
        z = zc + dz
        width = 2.6 if index else 3.0
        box('Rack foot', (x, -7.94, z), (.86, .12, width), 'Dark')
        for ddz in (-width/2+.08, width/2-.08):
            box('Rack upright', (x, -6.58, z+ddz), (.12, 2.62, .11), 'Steel')
        box('Rack header', (x, -5.24, z), (.9, .1, width), 'Ivory')
        for i, y in enumerate((-7.86, -7.0, -6.14)):
            grow_tray(x, y, z, width-.2, 7 if index else 9)
            box('Grow light housing', (x, y+.92, z), (.42, .07, width-.3), 'Dark', .008)
            box('Grow light emitter', (x, y+.875, z), (.34, .022, width-.4), 'Mint', .004)
        box('Nutrient reservoir', (x-s*.02, -7.72, z), (.5, .32, width-.5), 'Petrol', .02)
    ASSEMBLY = 'HydroponicsPotBench'
    x, z = wall_shelving(unit, 3.0, (-7.62, -6.72), 2.0)
    for i, dz in enumerate((-.62, -.1, .42, .84)):
        leafy_plant(x-s*.14, -7.585, z+dz, .30 + (i % 3)*.05, 6 + i % 3, .13 + (i % 2)*.03)
    for i, dz in enumerate((-.5, .16, .74)):
        leafy_plant(x-s*.14, -6.685, z+dz, .26 + (i % 2)*.04, 5 + i % 2, .11)
    ASSEMBLY = 'HydroponicsPlanters'
    for i, dz in enumerate((-3.0, -1.4)):
        px = s * 6.5
        pz = zc + dz
        plan('Floor planter', [(px-.42, pz-.42), (px+.42, pz-.42),
            (px+.42, pz+.42), (px-.42, pz+.42)], -7.98, .62, 'Ivory', .03, 1.09)
        box('Planter rim', (px, -7.34, pz), (.92, .06, .92), 'Steel', .012)
        box('Planter medium', (px, -7.375, pz), (.78, .04, .78), 'Rubber', .004)
        for j, (ddx, ddz) in enumerate(((-.16, -.14), (.15, -.05), (-.02, .18))):
            leafy_plant(px+ddx, -7.36, pz+ddz, .46 + (j % 2)*.10, 7 + j, .20 + j*.02)


# ------------------------------------------------------------- souvenir stock

def hull_model(x, y, z, length=.44, colour='Ivory'):
    """A desk-scale display hull on a machined stand. No flight geometry."""
    start = len(PARTS.get(ASSEMBLY, []))
    rod('Model stand base', (x, y, z), (x, y+.018, z), .085, 'Dark', 12)
    rod('Model stand post', (x, y+.018, z), (x, y+.115, z), .011, 'Steel', 8)
    profile('Display hull body', [(y+.115, z-length*.5), (y+.165, z-length*.30),
        (y+.175, z+length*.24), (y+.145, z+length*.5), (y+.100, z+length*.46),
        (y+.088, z-length*.28)], x, .105, colour, .012)
    for sx in (-1, 1):
        profile('Display wing', [(y+.128, z+length*.02), (y+.140, z+length*.26),
            (y+.118, z+length*.30), (y+.112, z+length*.06)],
            x+sx*.115, .13, 'Petrol', .006)
    rod('Display drive', (x, y+.121, z+length*.47), (x, y+.121, z+length*.54), .022, 'Steel', 10)
    record_stock('hullModel', start)


def gift_box(x, y, z, width=.20, height=.13, colour='Ochre'):
    start = len(PARTS.get(ASSEMBLY, []))
    box('Printed gift carton', (x, y+height/2, z), (.17, height, width), colour, .008)
    box('Carton band', (x, y+height*.62, z), (.176, .028, width+.006), 'Ivory', .003)
    box('Carton lid', (x, y+height+.008, z), (.178, .016, width+.008), 'Steel', .004)
    record_stock('giftBox', start)


def print_rack(x, y, z):
    """A rotating card rack with real pockets and standing printed cards."""
    start = len(PARTS.get(ASSEMBLY, []))
    rod('Rack base', (x, y, z), (x, y+.035, z), .30, 'Dark', 14)
    rod('Rack column', (x, y+.035, z), (x, y+1.42, z), .034, 'Steel', 12)
    for level, ly in enumerate((.62, .96, 1.30)):
        rod('Rack hub', (x, y+ly-.02, z), (x, y+ly+.02, z), .075, 'Dark', 12)
        for i in range(6):
            a = i * math.tau / 6 + level * .26
            dx, dz = math.cos(a), math.sin(a)
            # Turn each pocket to face outward. Game yaw about +Y is Blender Z.
            yaw = math.atan2(-dz, dx)
            pocket = box('Card pocket', (x+dx*.205, y+ly, z+dz*.205), (.035, .19, .16), 'Steel', .004)
            pocket.rotation_euler[2] = yaw
            print_card = box('Standing print', (x+dx*.228, y+ly+.06, z+dz*.228),
                (.010, .21, .148), 'Paper', .002)
            print_card.rotation_euler[2] = yaw
    record_stock('printRack', start)


def souvenir_stock(unit):
    global ASSEMBLY
    s, zc = unit['side'], unit['z']
    ASSEMBLY = 'SouvenirModelWall'
    x, z = wall_shelving(unit, -2.0, (-7.60, -6.90, -6.20), 2.9)
    for i, dz in enumerate((-1.0, -.1, .82)):
        hull_model(x-s*.16, -7.575, z+dz, .44 - i*.05, ('Ivory', 'Petrol', 'Ochre')[i])
    for i, dz in enumerate((-.94, .0, .9)):
        hull_model(x-s*.16, -6.875, z+dz, .34 + (i % 2)*.06, ('Petrol', 'Ivory', 'Steel')[i])
    for i, dz in enumerate((-1.05, -.6, -.15, .3, .75, 1.2)):
        gift_box(x-s*.16, -6.185, z+dz, .18 + (i % 3)*.03, .12 + (i % 2)*.03,
            ('Ochre', 'Petrol', 'Ivory')[i % 3])
    ASSEMBLY = 'SouvenirIsland'
    ix = s * 7.4
    iz = zc - 1.9
    box('Island display plinth', (ix, -7.62, iz), (1.05, .76, 2.1), 'Ivory', .03)
    box('Island toe recess', (ix, -7.92, iz), (.9, .16, 1.95), 'Dark')
    box('Island top', (ix, -7.21, iz), (1.15, .06, 2.2), 'Steel', .012)
    for i, dz in enumerate((-.66, 0, .66)):
        hull_model(ix, -7.18, iz+dz, .40 + (i % 2)*.06, ('Petrol', 'Ivory', 'Ochre')[i])
        box('Model label card', (ix-s*.4, -7.16, iz+dz), (.1, .012, .16), 'Paper', .002)
    ASSEMBLY = 'SouvenirPrintRack'
    print_rack(s*6.6, -7.98, zc + 2.4)


# ------------------------------------------------------------ shared promenade

def bench(x, z, index, length=2.4):
    global ASSEMBLY
    ASSEMBLY = 'PromenadeBench' + str(index)
    rod('Bench beam', (x-length/2+.1, -7.69, z), (x+length/2-.1, -7.69, z), .045, 'Steel')
    for dx in (-length/2+.28, length/2-.28):
        rod('Upright', (x+dx, -7.93, z), (x+dx, -7.64, z), .035, 'Steel')
        rod('Stable foot', (x+dx, -7.965, z-.26), (x+dx, -7.965, z+.29), .035, 'Dark')
    for dx in (-.63, 0, .63):
        profile('Formed seat shell', [(-7.66, z-.27), (-7.66, z+.25), (-7.02, z+.38),
            (-6.96, z+.33), (-7.60, z+.17), (-7.60, z-.27)], x+dx, .55, 'Ivory', .02)
        box('Seat pad', (x+dx, -7.59, z-.045), (.49, .10, .43), 'Rubber', .025)
        back = box('Upholstered back', (x+dx, -7.23, z+.255), (.49, .46, .07), 'Petrol', .015)
        back.rotation_euler.x = -.15
    for dx in (-.945, -.315, .315, .945):
        rod('Arm support', (x+dx, -7.62, z+.15), (x+dx, -7.32, z+.10), .014, 'Steel', 8)
        rod('Armrest', (x+dx, -7.32, z-.15), (x+dx, -7.32, z+.15), .025, 'Dark', 10)


def directory_pylon(x, z, name):
    global ASSEMBLY
    ASSEMBLY = name + 'Pylon'
    box('Anchored plinth', (x, -7.94, z), (.88, .12, .44), 'Dark', .025)
    box('Recessed foot', (x, -7.78, z), (.67, .24, .32), 'Steel', .025)
    box('Cabinet carcass', (x, -6.62, z), (.78, 2.7, .34), 'Ivory', .03)
    box('Display bezel', (x, -6.45, z+.178), (.67, 2.0, .022), 'Steel', .01)
    box('Portrait display inset', (x, -6.45, z+.194), (.58, 1.88, .012), 'Rubber', .006)
    box('Lower service cassette', (x, -7.63, z+.178), (.61, .22, .026), 'Petrol', .008)
    for dx in (-.23, .23):
        bolt((x+dx, -7.63, z+.198), 'z')
    box('Status diffuser', (x, -5.34, z+.18), (.38, .024, .028), 'Mint', .004)
    for y in (-7.57, -7.65, -7.73):
        box('Rear ventilation', (x, y, z-.177), (.44, .025, .018), 'Dark', .004)
    anchor(name, (x, -6.45, z+.208))


def mid_court_planter(x, z, index):
    global ASSEMBLY
    ASSEMBLY = 'PromenadeCourtPlanter' + str(index)
    plan('Court planter shell', [(x-.72, z-.72), (x+.72, z-.72), (x+.72, z+.72),
        (x-.72, z+.72)], -7.98, .70, 'Ivory', .04, 1.07)
    box('Planter capping', (x, -7.26, z), (1.56, .07, 1.56), 'Steel', .014)
    box('Planter medium', (x, -7.30, z), (1.36, .04, 1.36), 'Rubber', .004)
    for j, (dx, dz) in enumerate(((-.34, -.28), (.30, -.10), (.06, .34))):
        leafy_plant(x+dx, -7.28, z+dz, .52 + (j % 3)*.09, 7 + j % 3, .22 + (j % 2)*.04)


def sealed_bulkhead():
    """A heavy pressure door at the aft end. Locked: no animation, no opening."""
    global ASSEMBLY
    ASSEMBLY = 'BulkheadArchitecture'
    z = BULKHEAD_Z
    # Structural surround inside the corridor: jambs, head and a raised sill.
    for sx in (-1, 1):
        box('Door jamb', (sx*3.72, -5.9, z), (.78, 4.2, .62), 'Ivory', .035)
        box('Jamb service panel', (sx*3.72, -6.9, z+.32), (.52, 1.4, .03), 'Petrol', .008)
        for y in (-7.5, -6.3, -5.1):
            bolt((sx*3.72, y, z+.34), 'z')
    box('Door head beam', (0, -3.86, z), (8.9, .48, .62), 'Ivory', .035)
    box('Head hazard band', (0, -3.86, z+.32), (8.4, .2, .03), 'Ochre', .006)
    box('Raised sill', (0, -7.93, z), (7.5, .14, .58), 'Steel', .02)
    for dx in (-3.0, -1.5, 0, 1.5, 3.0):
        box('Sill grip strip', (dx, -7.855, z), (.34, .014, .5), 'Rubber', .003)
    # Two static leaves. They are modelled shut and carry no animation clip.
    for sx in (-1, 1):
        box('Sealed pressure leaf', (sx*1.66, -5.99, z), (3.28, 4.02, .22), 'Steel', .025)
        box('Leaf inset cassette', (sx*1.66, -6.05, z+.13), (2.86, 3.5, .03), 'Ivory', .01)
        box('Leaf recess', (sx*1.66, -6.3, z+.155), (1.9, 2.1, .012), 'Petrol', .006)
        for y in (-7.7, -4.4):
            box('Reinforcing band', (sx*1.66, y, z+.14), (3.0, .1, .026), 'Dark', .005)
        box('Hazard chevron block', (sx*1.66, -7.42, z+.145), (2.7, .34, .022), 'Ochre', .004)
        rod('Leaf edge seal', (sx*.03, -7.98, z), (sx*.03, -4.0, z), .028, 'Rubber', 8)
        for dy in (-1.35, 1.35):
            box('Locking dog', (sx*3.28, -5.99+dy, z), (.16, .34, .3), 'Dark', .014)
    box('Meeting stile', (0, -5.99, z-.04), (.13, 4.02, .18), 'Dark', .012)
    # Control side: a recessed panel, an amber sealed lamp and a printed notice.
    box('Access control housing', (-4.36, -6.5, z-.5), (.42, .78, .5), 'Dark', .02)
    box('Access control recess', (-4.36, -6.5, z-.755), (.32, .56, .03), 'Rubber', .006)
    box('Sealed status lamp', (-4.36, -6.02, z-.75), (.2, .05, .035), 'Warm', .005)
    box('Notice backplate', (4.36, -6.3, z-.5), (.52, .72, .5), 'Dark', .02)
    box('Notice paper', (4.36, -6.3, z-.756), (.42, .6, .006), 'Paper', .002)
    anchor('SealedDoorSign', (0, -4.42, z-.33))
    anchor('SealedDoorPanel', (-4.36, -6.5, z-.775))
    anchor('SealedDoorNotice', (4.36, -6.3, z-.762))


# ---------------------------------------------------------------------- export

def export_asset(filename):
    manifest = []
    collision_boxes = []
    bpy.context.view_layer.update()
    stock_manifest = []
    for item in STOCK:
        points = [obj.matrix_world@Vector(corner) for obj in item['objects'] for corner in obj.bound_box]
        game = [(p.x, p.z, -p.y) for p in points]
        stock_manifest.append({'kind': item['kind'], 'rack': item['rack'], 'bounds': {
            'min': [min(p[i] for p in game) for i in range(3)],
            'max': [max(p[i] for p in game) for i in range(3)]}})
    for name, objects in PARTS.items():
        points = [obj.matrix_world@Vector(corner) for obj in objects for corner in obj.bound_box]
        game = [(p.x, p.z, -p.y) for p in points]
        triangles = 0
        for obj in objects:
            obj.data.calc_loop_triangles()
            triangles += len(obj.data.loop_triangles)
        manifest.append({'name': name, 'bounds': {
            'min': [min(p[i] for p in game) for i in range(3)],
            'max': [max(p[i] for p in game) for i in range(3)]}, 'triangles': triangles})
        if triangles > 10000:
            raise RuntimeError(f'Assembly {name} exceeds 10k triangles: {triangles}')
        # Measure a real standalone GLB per assembly, including its own JSON and
        # materials. Never charge the entire shared aggregate buffer to each prop.
        with tempfile.TemporaryDirectory(prefix='aeon-promenade-budget-') as directory:
            bpy.ops.object.select_all(action='DESELECT')
            for obj in objects:
                obj.select_set(True)
            audit_path = Path(directory)/'assembly.glb'
            bpy.ops.export_scene.gltf(filepath=str(audit_path), export_format='GLB',
                export_yup=True, export_apply=True, use_selection=True,
                export_extras=False, export_texcoords=False)
            manifest[-1]['standaloneBytes'] = audit_path.stat().st_size
        if manifest[-1]['standaloneBytes'] > 1000000:
            raise RuntimeError(f'Assembly {name} exceeds 1MB')
        # Walls, ceilings, jambs and the sealed leaves need individual solids:
        # one enclosing AABB per shop would seal the room the player walks into.
        if 'Architecture' in name:
            for obj in objects:
                points = [obj.matrix_world@Vector(c) for c in obj.bound_box]
                p = [(v.x, v.z, -v.y) for v in points]
                lo = [min(v[i] for v in p) for i in range(3)]
                hi = [max(v[i] for v in p) for i in range(3)]
                if min(hi[i]-lo[i] for i in range(3)) < .025:
                    continue
                # Threshold plates, laid shop floors and their borders are a few
                # centimetres of finish on the deck. A walking body's feet are at
                # the deck, so a solid box here stops the player at the doorway.
                if hi[1] <= FLOOR + .06:
                    continue
                collision_boxes.append({'name': obj.name, 'min': lo, 'max': hi})
        else:
            collision_boxes.append({'name': name, **manifest[-1]['bounds']})
    # Batch static geometry by material: one draw per finish for the whole kit.
    # Collect every batch before the first join; joining frees the merged objects
    # and a later lookup through PARTS would reference removed Blender data.
    batches = []
    for mat in M.values():
        objects = [obj for values in PARTS.values() for obj in values if obj.data.materials[0] == mat]
        if objects:
            batches.append((mat, objects))
    for mat, objects in batches:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        bpy.context.object.name = 'Static_' + mat.name
    bpy.context.scene['assetManifest'] = json.dumps(manifest, separators=(',', ':'))
    bpy.context.scene['collisionBoxes'] = json.dumps(collision_boxes, separators=(',', ':'))
    bpy.context.scene['stockManifest'] = json.dumps(stock_manifest, separators=(',', ':'))
    bpy.context.scene['coordinates'] = 'Game metres, X right / Y up / Z aft'
    bpy.context.scene['builder'] = 'blender/build_station_promenade.py'
    bpy.ops.export_scene.gltf(filepath=str(OUT/filename), export_format='GLB',
        export_yup=True, export_apply=True, export_extras=True, export_texcoords=False)
    print('PROMENADE_EXPORT', filename, json.dumps(manifest, separators=(',', ':')))


def render_studio():
    """Explicitly Blender studio evidence, never represented as game rendering."""
    global ASSEMBLY
    if '--render-dir' not in sys.argv:
        return
    directory = Path(sys.argv[sys.argv.index('--render-dir')+1])
    directory.mkdir(parents=True, exist_ok=True)
    ASSEMBLY = 'StudioOnly'
    box('Studio ground', (0, FLOOR-.05, -34), (34, .1, 32), 'Dark', 0)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.world.use_nodes = True
    world = scene.world.node_tree.nodes.get('Background')
    world.inputs['Color'].default_value = (.24, .28, .32, 1)
    world.inputs['Strength'].default_value = .5
    for name, power, size, p in [('Key', 2600, 10, (2, FLOOR+5.5, -24)),
        ('Fill', 1800, 9, (-11, FLOOR+4.5, -33)), ('Rim', 2000, 8, (11, FLOOR+4.5, -42))]:
        data = bpy.data.lights.new(name, 'AREA')
        data.energy = power
        data.shape = 'DISK'
        data.size = size
        ob = bpy.data.objects.new(name, data)
        scene.collection.objects.link(ob)
        ob.location = vec(p)
        ob.rotation_euler = (vec((0, FLOOR+1.6, -34))-ob.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    scene.camera = camera
    for name, position, look, lens in [
        ('promenade', (0, -6.3, -19.5), (0, -6.6, -48), 30),
        ('galley', (-5.6, -6.3, -22.6), (-12.4, -6.8, -27.4), 30),
        ('outfitter', (5.6, -6.3, -22.6), (12.4, -6.8, -27.4), 30),
        ('hydroponics', (-5.6, -6.3, -35.8), (-12.4, -6.8, -40.6), 30),
        ('souvenir', (5.6, -6.3, -35.8), (12.4, -6.8, -40.6), 30),
        ('sealed-door', (0, -6.0, -41.4), (0, -5.8, -49), 28)]:
        camera.location = vec(position)
        camera.rotation_euler = (vec(look)-camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.lens = lens
        scene.render.filepath = str(directory/(name+'.png'))
        bpy.ops.render.render(write_still=True)


material('Ivory', 'station-ivory', .18, .46)
material('Petrol', 'station-petrol', .28, .45)
material('Steel', 'station-steel', .65, .35)
material('Dark', 'station-dark', .30, .55)
material('Rubber', 'station-rubber', 0, .84)
material('Mint', 'mint', .0, .42, .7)
material('Ochre', 'station-ochre', .22, .54)
material('Paper', 'station-paper', 0, .92)
# Sealed-door status uses the station's existing warning token; planting uses the
# mint accent as an unlit surface colour. Neither introduces a new palette entry.
material('Warm', 'station-warm', .0, .48, .9)
material('Foliage', 'mint', .0, .78)

reset()
for unit in UNITS:
    storefront(unit)
for unit in UNITS:
    counter(unit)
galley_stock(UNITS[0])
outfitter_stock(UNITS[1])
hydroponics_stock(UNITS[2])
souvenir_stock(UNITS[3])
bench(-9.4, -32.3, 0)
bench(9.4, -32.3, 1)
mid_court_planter(-9.4, -33.6, 0)
mid_court_planter(9.4, -33.6, 1)
directory_pylon(-2.6, -32.3, 'PromenadeDirectory')
sealed_bulkhead()
export_asset('station-promenade.glb')
render_studio()

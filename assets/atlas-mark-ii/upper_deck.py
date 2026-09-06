"""Fixed pressure-room construction, original Atlas upper-deck mesh source.

Metres, Y up. All low wall additions stay inside the corresponding authored
collider; angled crown members remain above the standing capsule. End-wall
meshes consume the same raw dimensions as runtime collision.
"""
import json
import math
from pathlib import Path

import bpy
import bmesh


def extrusion(g, name, profile, depth, material, parent, axis="z", station=0):
    """Closed beveled stock from an XY (or ZY) polygon, not a flat decal."""
    def position(u, y, d):
        return (u, y, d) if axis == "z" else (d, y, u)
    vertices = [g.xyz(position(u, y, station + d))
                for d in (-depth / 2, depth / 2) for u, y in profile]
    n = len(profile)
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return g.finish(obj, name, material, min(.025, depth * .18), parent)


def clipped_rect(left, right, low, high, cut=.20):
    return [(left + cut, low), (right - cut, low), (right, low + cut),
            (right, high - cut), (right - cut, high), (left + cut, high),
            (left, high - cut), (left, low + cut)]


def build_upper_deck(g, m, layout, upper, crew, galley, bridge):
    floor, ceiling = layout["upper"]["floor"], layout["upper"]["ceiling"]
    ivory, dark, steel = m["ivory"], m["dark"], m["steel"]
    petrol, mint, amber = m["petrol"], m["mint"], m["amber"]
    # Close previously open room ends. Zero bevel keeps pressure joints closed.
    colliders = json.loads(Path(__file__).with_name("interior-colliders.json").read_text())
    for collider in colliders["colliders"]:
        if not collider["id"].startswith(("crew-pressure-", "galley-pressure-")):
            continue
        lo, hi = collider["min"], collider["max"]
        g.box(collider["label"], tuple((a + b) / 2 for a, b in zip(lo, hi)),
              tuple(b - a for a, b in zip(lo, hi)), ivory, bevel=0,
              parent=crew if collider["id"].startswith("crew") else galley)

    def crown(name, left, right, z, parent, top=ceiling, knee=.64):
        # Substantial continuous web: vertical attachment lands, 45-degree
        # shoulders and a narrow crown. The opening is at least 2.35 m high.
        profile = [(left, top), (right, top), (right, top - .92),
                   (right - .18, top - .92), (right - knee, top - .30),
                   (left + knee, top - .30), (left + .18, top - .92),
                   (left, top - .92)]
        extrusion(g, name + " pressure web", profile, .25, ivory, parent, station=z)
        # Separate inset flange face gives the stock thickness and a shadow seam.
        for side, x in ((-1, left), (1, right)):
            inner = x - side * knee
            g.rod(name + f" shoulder seam {side}", (x - side * .16, top - .80, z - .145),
                  (inner, top - .24, z - .145), .032, steel, vertices=8, parent=parent)
        g.box(name + " crown insert", ((left + right) / 2, top - .14, z - .145),
              (max(.3, right - left - knee * 2), .13, .045), petrol, bevel=.02, parent=parent)

    # Repeated crew cross-frames attach to the liner and inboard partition.
    # Their legs are behind bunk envelopes or within the widened partition band.
    for index, z in enumerate((1.30, 4.0, 8.1, 12.3, 16.65)):
        crown(f"Crew frame {index}", -6.52, -1.50, z, crew)
        for side, x in enumerate((-6.47, -1.59)):
            g.box(f"Crew frame {index} foot {side}", (x, floor + 1.20, z),
                  (.18, 2.40, .23), petrol, bevel=.025, parent=crew)
        g.box(f"Crew frame {index} aisle marker", (-1.685, floor + .31, z),
              (.012, .16, .13), mint, bevel=.008, parent=crew)

    # Recessed ceiling cassettes, with angled service shoulders over the bunks.
    # Individual panels and seals replace one uninterrupted apartment ceiling.
    for index, (z, length) in enumerate(((2.65, 2.28), (6.05, 3.70),
                                        (10.2, 3.80), (14.45, 3.88))):
        g.box(f"Crew ceiling cassette {index}", (-3.08, ceiling - .07, z),
              (2.58, .10, length), petrol, bevel=.055, parent=crew)
        for side in (-1, 1):
            g.box(f"Crew ceiling rail {index} {side}", (-3.08 + side * 1.12, ceiling - .145, z),
                  (.09, .09, length - .15), steel, bevel=.016, parent=crew)
        g.box(f"Crew recessed aisle diffuser {index}", (-2.10, ceiling - .20, z),
              (.10, .035, length - .50), mint, bevel=.015, parent=crew)
        extrusion(g, f"Crew service haunch {index}",
                  [(-6.52, ceiling - .02), (-4.25, ceiling - .02),
                   (-4.25, ceiling - .20), (-5.72, ceiling - .20),
                   (-6.52, ceiling - .72)], length, dark, crew, station=z)

    # Shaped maintenance panels against the inboard wall, leaving the fold desk.
    for index, (z0, z1) in enumerate(((4.24, 5.82), (8.35, 11.99), (12.56, 16.33))):
        extrusion(g, f"Crew inner liner gasket {index}",
                  clipped_rect(z0, z1, floor + .30, ceiling - .48), .035, dark, crew,
                  axis="x", station=-1.525)
        extrusion(g, f"Crew inner liner plate {index}",
                  clipped_rect(z0 + .07, z1 - .07, floor + .39, ceiling - .57, .18),
                  .045, ivory, crew, axis="x", station=-1.575)
        g.box(f"Crew liner latch {index}", (-1.61, floor + 1.18, z0 + .25),
              (.035, .22, .08), steel, bevel=.015, parent=crew)
        for vent in range(4):
            g.box(f"Crew liner vent {index} {vent}", (-1.607, floor + .61 + vent * .10, (z0 + z1) / 2),
                  (.02, .032, (z1 - z0) * .55), dark, bevel=.008, parent=crew)

    # Each bunk is a recessed berth within a thick clipped structural surround.
    for bunk, z in enumerate((6.0, 10.2, 14.4)):
        for end in (-1, 1):
            at = z + end * 1.62
            extrusion(g, f"Berth {bunk} end shell {end}",
                      [(-6.50, floor + .08), (-4.48, floor + .08),
                       (-4.17, floor + .40), (-4.17, ceiling - .51),
                       (-4.48, ceiling - .20), (-6.50, ceiling - .20)],
                      .09, ivory, crew, station=at)
            extrusion(g, f"Berth {bunk} end inset {end}",
                      clipped_rect(-6.30, -4.35, floor + .52, ceiling - .56, .22),
                      .022, petrol, crew, station=at + end * .068)
            g.box(f"Berth {bunk} service latch {end}", (-4.44, floor + 1.52, at + end * .088),
                  (.08, .26, .035), steel, bevel=.015, parent=crew)
        g.box(f"Berth {bunk} insulated back", (-6.435, floor + 1.55, z),
              (.15, 2.85, 3.12), petrol, bevel=.04, parent=crew)
        g.box(f"Berth {bunk} crown cassette", (-5.3, ceiling - .25, z),
              (2.34, .16, 3.10), ivory, bevel=.05, parent=crew)
        for level, y in enumerate((floor + .36, floor + 1.92)):
            g.box(f"Berth {bunk} {level} privacy track", (-4.17, y + .87, z),
                  (.13, .10, 3.02), steel, bevel=.025, parent=crew)
            g.box(f"Berth {bunk} {level} head cove", (-6.31, y + .61, z - .87),
                  (.04, .045, .55), mint, bevel=.01, parent=crew)
            g.box(f"Berth {bunk} {level} entry badge", (-4.105, y - .02, z - .94),
                  (.018, .10, .23), amber, bevel=.009, parent=crew)

    # A clearly visible end-wall assembly: gasket, chamfered removable cover,
    # radiator and restrained emergency kit. Everything mounts aft of z=16.69.
    extrusion(g, "Crew aft environmental gasket", clipped_rect(-5.45, -2.05, floor + .25, ceiling - .35),
              .05, dark, crew, station=16.965)
    extrusion(g, "Crew aft environmental cover", clipped_rect(-5.33, -2.17, floor + .37, ceiling - .47),
              .10, petrol, crew, station=16.87)
    for fin in range(9):
        g.box(f"Crew aft heat exchanger fin {fin}", (-3.75, floor + .74 + fin * .14, 16.795),
              (1.82, .045, .045), steel, bevel=.008, parent=crew)
    g.text("Crew pressure-room designation", "CREW / 06", (-3.75, ceiling - .68, 16.75),
           .21, ivory, rotation=(math.pi / 2, math.pi, 0), parent=crew)
    g.box("Crew emergency kit", (-2.60, floor + 1.11, 16.79), (.34, .55, .16),
          ivory, bevel=.055, parent=crew)
    g.box("Crew emergency kit stripe", (-2.60, floor + 1.11, 16.695), (.10, .35, .02),
          amber, bevel=.009, parent=crew)

    # Corridor and mess use the same clipped crown family. Side-door openings
    # remain untouched; the frames only occupy existing partition bands.
    for index, z in enumerate((4.15, 8.3, 10.9, 16.6)):
        crown(f"Upper corridor frame {index}", -1.34, 1.34, z, upper, knee=.46)
        for side in (-1, 1):
            g.box(f"Upper corridor frame {index} socket {side}",
                  (side * 1.415, floor + 1.20, z), (.14, 2.4, .24),
                  petrol, bevel=.025, parent=upper)
    for index, z in enumerate((1.35, 5.2, 9.8)):
        crown(f"Mess pressure frame {index}", 1.50, 6.52, z, galley)
    for index, (z0, z1) in enumerate(((3.95, 4.93), (5.47, 9.51), (10.08, 11.12))):
        extrusion(g, f"Mess service liner gasket {index}",
                  clipped_rect(z0, z1, floor + .32, ceiling - .50, .16),
                  .010, dark, galley, axis="x", station=1.503)
        extrusion(g, f"Mess service liner cover {index}",
                  clipped_rect(z0 + .06, z1 - .06, floor + .42, ceiling - .59, .13),
                  .018, ivory, galley, axis="x", station=1.517)
        g.box(f"Mess captive latch {index}", (1.534, floor + 1.31, z0 + .23),
              (.012, .20, .075), steel, bevel=.012, parent=galley)
    for index, z in enumerate((6.05, 10.2, 14.45)):
        g.prism(f"Crew replaceable sole {index}",
                [(-3.55, z - 1.45), (-2.15, z - 1.45), (-1.95, z - 1.25),
                 (-1.95, z + 1.25), (-2.15, z + 1.45), (-3.55, z + 1.45)],
                floor + .006, floor + .024, m["rubber"], bevel=.004, parent=crew)
    for index, z in enumerate((5.4, 9.5, 14.7)):
        g.box(f"Corridor removable ceiling cassette {index}", (0, ceiling - .035, z),
              (1.92, .05, 2.4), petrol, bevel=.055, parent=upper)
    # Thicker angular overhead bridge beams replace the visual weight of thin
    # struts without intruding into the canopy or the pilot approach.
    for index, (z, span) in enumerate(((-19.5, 5.25), (-16.0, 6.55))):
        roof = layout["bridge"]["ceiling"] + min(0, z + 18) * (.5 / 7.4)
        crown(f"Bridge pressure crown {index}", -span, span, z, bridge, top=roof, knee=.95)

"""Authored interior for the Atlas Mark II.

Game coordinates are metres, Y up, with the ship's nose along -Z.  This module
only contributes fixed interior geometry.  The top-level builder owns the hull,
cargo base floor, outer cargo walls, ramps, elevator platform, rails and export.
"""

import math


def _mat(materials, name):
    """Keep missing material failures close to the authored object that uses it."""
    return materials[name]


def build_interior(g, m, layout):
    """Build fixed cargo, upper-deck, crew and bridge geometry.

    ``g`` is the common Atlas geometry helper and ``m`` is its material mapping.
    Positions and sizes passed to the helper remain in game coordinates.
    """
    cargo = layout["cargo"]
    upper = layout["upper"]
    bridge = layout["bridge"]
    crew = layout["crew"]
    galley = layout["galley"]
    corridor = layout["corridor"]

    ivory = _mat(m, "ivory")
    dark = _mat(m, "dark")
    steel = _mat(m, "steel")
    deck = _mat(m, "deck")
    rubber = _mat(m, "rubber")
    mint = _mat(m, "mint")
    amber = _mat(m, "amber")
    glass = _mat(m, "glass")
    petrol = _mat(m, "petrol")
    cloth = _mat(m, "cloth")
    warning = _mat(m, "warning")
    display = _mat(m, "display")

    interior_root = g.empty("Interior", (0, 0, 0))
    cargo_root = g.empty("InteriorCargo", (0, 0, 0), parent=interior_root)
    upper_root = g.empty("InteriorUpper", (0, 0, 0), parent=interior_root)
    bridge_root = g.empty("InteriorBridge", (0, 0, 0), parent=upper_root)
    crew_root = g.empty("InteriorCrew", (0, 0, 0), parent=upper_root)
    galley_root = g.empty("InteriorGalley", (0, 0, 0), parent=upper_root)
    hygiene_root = g.empty("InteriorHygiene", (0, 0, 0), parent=upper_root)

    cargo_floor = cargo["floor"]
    cargo_ceiling = cargo["ceiling"]
    cargo_half_lane = cargo["driveLaneHalfWidth"]

    # Replaceable tread plates sit over the root-owned structural cargo floor.
    # Everything raised is outside the full-width x +/- 4 m drive lane.
    plate_inner = cargo_half_lane + .2
    plate_outer = cargo["maxX"] - .28
    plate_width = plate_outer - plate_inner
    for side in (-1, 1):
        plate_x = side * (plate_inner + plate_width / 2)
        for index, z in enumerate((-21, -15, -9, -3, 3, 9, 15, 21)):
            if side > 0 and z == -3:
                continue  # The low crew-elevator platform occupies this plate bay.
            g.box(
                f"Cargo tread plate {side:+d} {index:02d}",
                (plate_x, cargo_floor + .014, z),
                (plate_width, .028, 5.72),
                deck,
                bevel=.012,
                parent=cargo_root,
            )
        edge_runs = ((0, 47.4),) if side < 0 else ((-14.825, 17.75), (10.825, 25.75))
        for run, (z, length) in enumerate(edge_runs):
            g.box(
                f"Cargo drive-lane rubber edge {side:+d} {run}",
                (side * (cargo_half_lane + .075), cargo_floor + .018, z),
                (.11, .036, length),
                rubber,
                bevel=.012,
                parent=cargo_root,
            )

    # A regular pressure-frame rhythm makes the 48 m bay legible at a glance.
    # Cross-members remain at the ceiling and preserve the vehicle envelope.
    rib_zs = tuple(range(-20, 21, 4))
    for rib_index, z in enumerate(rib_zs):
        for side in (-1, 1):
            x = side * (cargo["maxX"] - .16)
            g.box(
                f"Cargo wall rib {side:+d} {rib_index:02d}",
                (x, (cargo_floor + cargo_ceiling) / 2, z),
                (.22, cargo_ceiling - cargo_floor - .22, .20),
                steel,
                bevel=.035,
                parent=cargo_root,
            )
            if not (side > 0 and z == -4):
                g.rod(
                    f"Cargo rib knee {side:+d} {rib_index:02d}",
                    (side * (cargo["maxX"] - .23), cargo_ceiling - 1.12, z),
                    (side * (cargo["maxX"] - 1.12), cargo_ceiling - .18, z),
                    .075,
                    steel,
                    vertices=10,
                    parent=cargo_root,
                )
        if z != -4:
            g.box(
                f"Cargo ceiling frame {rib_index:02d}",
                (0, cargo_ceiling - .12, z),
                (cargo["maxX"] * 2 - .42, .20, .20),
                steel,
                bevel=.035,
                parent=cargo_root,
            )
            g.text(
                f"Cargo frame number {rib_index:02d}",
                f"BAY {rib_index + 1:02d}",
                (5.55, cargo_ceiling - .43, z + .105),
                .22,
                ivory,
                rotation=(math.pi / 2, 0, 0),
                parent=cargo_root,
            )
            g.box(
                f"Cargo frame number backing {rib_index:02d}",
                (5.55, cargo_ceiling - .43, z + .06),
                (1.58, .52, .06),
                dark,
                bevel=.035,
                parent=cargo_root,
            )

    # Longitudinal gantry rails bind the pressure frames into a credible
    # overhead service route.  They are above the declared cargo clearance.
    for side in (-1, 1):
        g.rod(
            f"Cargo overhead gantry rail {side:+d}",
            (side * 3.25, cargo_ceiling - .28, -22.4),
            (side * 3.25, cargo_ceiling - .28, 22.4),
            .072,
            steel,
            vertices=12,
            parent=cargo_root,
        )
        g.rod(
            f"Cargo overhead power bus {side:+d}",
            (side * 3.52, cargo_ceiling - .38, -22.1),
            (side * 3.52, cargo_ceiling - .38, 22.1),
            .045,
            petrol,
            vertices=10,
            parent=cargo_root,
        )
        for index, z in enumerate(rib_zs):
            if z == -4:
                continue
            g.box(
                f"Cargo gantry hanger {side:+d} {index:02d}",
                (side * 3.38, cargo_ceiling - .27, z),
                (.42, .34, .12),
                dark,
                bevel=.025,
                parent=cargo_root,
            )

    # Inset wall liners fill the spaces between frames without replacing the
    # root-owned pressure hull.  Their lower kick strips tolerate cargo impacts.
    for side in (-1, 1):
        liner_x = side * (cargo["maxX"] - .055)
        for index, z in enumerate(range(-18, 19, 4)):
            g.box(
                f"Cargo wall liner {side:+d} {index:02d}",
                (liner_x, cargo_floor + 2.85, z),
                (.07, 4.75, 3.66),
                petrol if index % 3 == 1 else dark,
                bevel=.025,
                parent=cargo_root,
            )
            g.box(
                f"Cargo liner inset {side:+d} {index:02d}",
                (side * (cargo["maxX"] - .09), cargo_floor + 3.05, z),
                (.035, 2.25, 2.82),
                ivory,
                bevel=.055,
                parent=cargo_root,
            )
            g.box(
                f"Cargo kick strip {side:+d} {index:02d}",
                (side * (cargo["maxX"] - .13), cargo_floor + .32, z),
                (.12, .44, 3.48),
                rubber,
                bevel=.025,
                parent=cargo_root,
            )
            for bolt in (-1.46, 1.46):
                g.box(
                    f"Cargo liner fastener {side:+d} {index:02d} {bolt:+.0f}",
                    (side * (cargo["maxX"] - .155), cargo_floor + 4.98, z + bolt),
                    (.045, .09, .09),
                    steel,
                    bevel=.012,
                    parent=cargo_root,
                )

        # Paired service trunks follow the bay instead of becoming loose floor
        # clutter.  Brackets and colour breaks communicate actual routing.
        for run, (height, material, radius) in enumerate((
            (cargo_floor + 4.68, petrol, .075),
            (cargo_floor + 5.02, steel, .055),
            (cargo_floor + 5.31, warning, .042),
        )):
            utility_runs = ((-22.4, 22.4),) if side < 0 else ((-22.4, -6.05), (-1.95, 22.4))
            for segment, (start_z, end_z) in enumerate(utility_runs):
                g.rod(
                    f"Cargo utility run {side:+d} {run} {segment}",
                    (side * (cargo["maxX"] - .34), height, start_z),
                    (side * (cargo["maxX"] - .34), height, end_z),
                    radius,
                    material,
                    vertices=10,
                    parent=cargo_root,
                )
        for index, z in enumerate(range(-20, 21, 4)):
            if side > 0 and z == -4:
                continue
            g.box(
                f"Cargo utility clamp {side:+d} {index:02d}",
                (side * (cargo["maxX"] - .36), cargo_floor + 5.0, z),
                (.16, .82, .13),
                dark,
                bevel=.022,
                parent=cargo_root,
            )

    # Ceiling luminaires give the drive lane an unbroken visual centre line.
    for index, z in enumerate(range(-21, 22, 6)):
        g.box(
            f"Cargo light housing {index:02d}",
            (0, cargo_ceiling - .18, z),
            (2.8, .12, .46),
            dark,
            bevel=.06,
            parent=cargo_root,
        )
        g.box(
            f"Cargo light diffuser {index:02d}",
            (0, cargo_ceiling - .245, z),
            (2.34, .025, .22),
            mint,
            bevel=.02,
            parent=cargo_root,
        )

    # Flush tie-downs form a repeatable loading grid outside the vehicle lane.
    for side in (-1, 1):
        for row, x in enumerate((4.52, 6.28)):
            for index, z in enumerate(range(-20, 21, 4)):
                if side > 0 and -5.8 <= z <= -2.2:
                    continue
                g.box(
                    f"Cargo tie-down {side:+d} {row} {index:02d}",
                    (side * x, cargo_floor + .035, z),
                    (.20, .07, .28),
                    steel,
                    bevel=.055,
                    parent=cargo_root,
                )
                g.box(
                    f"Cargo tie-down slot {side:+d} {row} {index:02d}",
                    (side * x, cargo_floor + .073, z),
                    (.07, .008, .16),
                    rubber,
                    bevel=.015,
                    parent=cargo_root,
                )

    def cargo_rack(side, index, z):
        """A restrained two-level freight rack with a clear inward face."""
        inner_x = side * 4.42
        outer_x = side * 6.62
        centre_x = (inner_x + outer_x) / 2
        for post, x in enumerate((inner_x, outer_x)):
            for dz in (-1.35, 1.35):
                g.rod(
                    f"Cargo rack post {side:+d} {index} {post} {dz:+.0f}",
                    (x, cargo_floor + .10, z + dz),
                    (x, cargo_floor + 4.20, z + dz),
                    .055,
                    steel,
                    vertices=10,
                    parent=cargo_root,
                )
        for shelf, y in enumerate((cargo_floor + .18, cargo_floor + 2.16, cargo_floor + 4.12)):
            g.box(
                f"Cargo rack shelf {side:+d} {index} {shelf}",
                (centre_x, y, z),
                (2.20, .12, 2.76),
                steel,
                bevel=.025,
                parent=cargo_root,
            )
        for level, y in enumerate((cargo_floor + 1.12, cargo_floor + 3.08)):
            g.box(
                f"Cargo unit {side:+d} {index} {level}",
                (side * 5.62, y, z),
                (1.62, 1.60, 2.18),
                ivory if (index + level) % 2 == 0 else petrol,
                bevel=.10,
                parent=cargo_root,
            )
            g.box(
                f"Cargo unit recess {side:+d} {index} {level}",
                (side * 4.795, y, z),
                (.035, .82, 1.34),
                dark,
                bevel=.035,
                parent=cargo_root,
            )
            for latch_z in (-.72, .72):
                g.box(
                    f"Cargo latch {side:+d} {index} {level} {latch_z:+.0f}",
                    (side * 4.765, y, z + latch_z),
                    (.055, .20, .16),
                    warning,
                    bevel=.025,
                    parent=cargo_root,
                )
            # Two compact hinge blocks on the opposite door edge give every
            # container a readable opening side without adding floor clutter.
            for hinge_y in (-.57, .57):
                g.box(
                    f"Cargo hinge {side:+d} {index} {level} {hinge_y:+.2f}",
                    (side * 4.755, y + hinge_y, z + .91),
                    (.065, .18, .13),
                    steel,
                    bevel=.018,
                    parent=cargo_root,
                )

    # The starboard rack nearest z=-4 is omitted for the full elevator shaft
    # and lobby.  Both ramp control zones remain open at the bay ends.
    for side in (-1, 1):
        rack_zs = (-15, -7, 5, 13) if side < 0 else (-15, 5, 13)
        for index, z in enumerate(rack_zs):
            cargo_rack(side, index, z)

    # Local ramp stations are mounted outside the drive lane and inside the
    # authored controls' reach points from layout.json.
    for ramp in layout["ramps"]:
        x, _, z = ramp["control"]
        side = -1 if x < 0 else 1
        g.box(
            f"{ramp['id'].title()} ramp control pedestal",
            (x, cargo_floor + .58, z),
            (.48, 1.16, .48),
            steel,
            bevel=.07,
            parent=cargo_root,
        )
        g.box(
            f"{ramp['id'].title()} ramp control face",
            (x, cargo_floor + 1.10, z - ramp["outward"] * .25),
            (.36, .30, .035),
            petrol,
            bevel=.035,
            parent=cargo_root,
        )
        g.box(
            f"{ramp['id'].title()} ramp status",
            (x + side * .10, cargo_floor + 1.13, z - ramp["outward"] * .273),
            (.08, .10, .012),
            mint,
            bevel=.012,
            parent=cargo_root,
        )

    # ------------------------------------------------------------------ upper deck
    upper_floor = upper["floor"]
    upper_ceiling = upper["ceiling"]
    bridge_ceiling = bridge["ceiling"]
    upper_min_x, upper_max_x = upper["minX"], upper["maxX"]
    upper_min_z, upper_max_z = upper["minZ"], upper["maxZ"]
    lift = layout["elevator"]
    lift_min_x = lift["centre"][0] - lift["width"] / 2
    lift_max_x = lift["centre"][0] + lift["width"] / 2
    lift_min_z = lift["centre"][1] - lift["length"] / 2
    lift_max_z = lift["centre"][1] + lift["length"] / 2
    slab_thickness = .22

    def slab(name, min_x, max_x, min_z, max_z):
        if max_x <= min_x or max_z <= min_z:
            return
        g.box(
            name,
            ((min_x + max_x) / 2, upper_floor - slab_thickness / 2, (min_z + max_z) / 2),
            (max_x - min_x, slab_thickness, max_z - min_z),
            deck,
            bevel=0,
            parent=upper_root,
        )

    # The bridge floor follows the same wedge as the root-owned pressure shell;
    # a full-width rectangle here would protrude through the forward cheeks.
    pressure = bridge["pressureFootprint"]
    pressure_front_z = max(upper_min_z, pressure["frontZ"])
    pressure_aft_z = pressure["aftZ"]
    g.prism(
        "Upper deck tapered bridge slab",
        (
            (-pressure["frontHalfWidth"], pressure_front_z),
            (pressure["frontHalfWidth"], pressure_front_z),
            (pressure["aftHalfWidth"], pressure_aft_z),
            (-pressure["aftHalfWidth"], pressure_aft_z),
        ),
        upper_floor - slab_thickness,
        upper_floor,
        deck,
        bevel=0,
        parent=upper_root,
    )

    # Four aft pieces retain the complete x=4.1..6.9, z=-5.8..-2.2 lift
    # aperture.  Their forward edge meets the tapered slab at z=-17.8.
    slab("Upper deck port slab", upper_min_x, lift_min_x, pressure_aft_z, upper_max_z)
    slab("Upper deck starboard rim", lift_max_x, upper_max_x, pressure_aft_z, upper_max_z)
    slab("Upper deck lift forward bridge", lift_min_x, lift_max_x, pressure_aft_z, lift_min_z)
    slab("Upper deck lift aft bridge", lift_min_x, lift_max_x, lift_max_z, upper_max_z)

    # Raised frame sits wholly outside the aperture so the moving platform and
    # its runtime collision can occupy the authoritative dimensions exactly.
    frame_width = .12
    frame_height = .055
    g.box("Crew lift frame port", (lift_min_x - frame_width / 2, upper_floor + frame_height / 2,
                                   lift["centre"][1]),
          (frame_width, frame_height, lift["length"]), steel, bevel=.015, parent=upper_root)
    g.box("Crew lift frame starboard", (lift_max_x + frame_width / 2, upper_floor + frame_height / 2,
                                        lift["centre"][1]),
          (frame_width, frame_height, lift["length"] - .30), steel, bevel=.015, parent=upper_root)
    # The root-owned guide channels occupy both starboard corners.  Stop the
    # transverse trim before x=6.9 and shorten the rim rail around their depth.
    transverse_min_x = lift_min_x - frame_width
    transverse_max_x = lift_max_x - .05
    g.box("Crew lift frame forward", ((transverse_min_x + transverse_max_x) / 2,
                                      upper_floor + frame_height / 2,
                                      lift_min_z - frame_width / 2),
          (transverse_max_x - transverse_min_x, frame_height, frame_width), steel,
          bevel=.015, parent=upper_root)
    g.box("Crew lift frame aft", ((transverse_min_x + transverse_max_x) / 2,
                                  upper_floor + frame_height / 2,
                                  lift_max_z + frame_width / 2),
          (transverse_max_x - transverse_min_x, frame_height, frame_width), steel,
          bevel=.015, parent=upper_root)

    # The central runner and overhead light rhythm mark an unobstructed route
    # from bridge to crew spaces.  All partitions stop outside x +/- 1.3 m.
    g.box(
        "Upper central corridor runner",
        (0, upper_floor + .014, (corridor["minZ"] + corridor["maxZ"]) / 2),
        (corridor["maxX"] - corridor["minX"] - .20, .028,
         corridor["maxZ"] - corridor["minZ"] - .30),
        rubber,
        bevel=.014,
        parent=upper_root,
    )
    for index, z in enumerate((-10, -6, -2, 2, 6, 10, 14, 17)):
        # Skip the lift's starboard ceiling fixture; the shaft remains open.
        g.box(
            f"Upper corridor light housing {index:02d}",
            (0, upper_ceiling - .12, z),
            (1.72, .14, .42),
            dark,
            bevel=.055,
            parent=upper_root,
        )
        g.box(
            f"Upper corridor light {index:02d}",
            (0, upper_ceiling - .195, z),
            (1.34, .018, .18),
            mint,
            bevel=.015,
            parent=upper_root,
        )

    # A framed transfer vestibule makes the upper landing read as a destination
    # from the bridge corridor.  The low runner stops before the platform and
    # every portal post sits outside its swept shaft.
    vestibule_root = g.empty("InteriorLiftVestibule", (0, 0, 0), parent=upper_root)
    g.box("Lift vestibule runner", (2.65, upper_floor + .014, lift["centre"][1]),
          (2.60, .028, 1.28), rubber, bevel=.014, parent=vestibule_root)
    for portal, z in enumerate((-10.0, .2)):
        for side, x in enumerate((1.55, 6.48)):
            g.box(f"Lift vestibule portal {portal} post {side}",
                  (x, upper_floor + 1.63, z), (.18, 3.18, .18),
                  steel, bevel=.045, parent=vestibule_root)
        g.box(f"Lift vestibule portal {portal} header", (4.015, upper_ceiling - .20, z),
              (5.11, .28, .24), steel, bevel=.045, parent=vestibule_root)
    g.box("Lift vestibule ceiling spine", (4.02, upper_ceiling - .14, -4.90),
          (4.76, .16, 9.95), dark, bevel=.055, parent=vestibule_root)
    for index, z in enumerate((-8.0, -4.0, -1.2)):
        g.box(f"Lift vestibule light {index}", (3.10, upper_ceiling - .235, z),
              (1.68, .025, .20), mint, bevel=.015, parent=vestibule_root)
    g.text("Lift vestibule registry", "CREW TRANSFER  /  02",
           (4.0, upper_ceiling - .50, -9.87), .19, ivory,
           rotation=(math.pi / 2, 0, 0), parent=vestibule_root)
    # Bridge pressure bulkhead, split around the full-width corridor door.
    partition_y = (upper_floor + upper_ceiling) / 2
    partition_h = upper_ceiling - upper_floor
    bridge_partition_y = (bridge["floor"] + bridge_ceiling) / 2
    bridge_partition_h = bridge_ceiling - bridge["floor"]
    bridge_door_half = 1.28
    for side in (-1, 1):
        edge = bridge["minX"] if side < 0 else bridge["maxX"]
        inner = -bridge_door_half if side < 0 else bridge_door_half
        g.box(
            f"Bridge aft bulkhead {side:+d}",
            ((edge + inner) / 2, bridge_partition_y, bridge["maxZ"] + .08),
            (abs(inner - edge), bridge_partition_h, .16),
            ivory,
            bevel=.045,
            parent=bridge_root,
        )
        g.box(
            f"Bridge door jamb {side:+d}",
            (side * (bridge_door_half + .08), upper_floor + 1.52, bridge["maxZ"] - .04),
            (.16, 3.04, .28),
            steel,
            bevel=.035,
            parent=bridge_root,
        )
    g.box("Bridge door lintel", (0, bridge_ceiling - .20, bridge["maxZ"] - .04),
          (bridge_door_half * 2 + .32, .28, .28), steel, bevel=.045, parent=bridge_root)

    # The tapered bow carries three grouped flight stations on a sloped
    # dashboard.  A recessed lower face gives knee/foot scale and prevents the
    # console from reading as one broad reception counter.
    g.box("Bridge forward console", (0, upper_floor + .43, -23.95),
          (7.8, .86, .72), dark, bevel=.12, parent=bridge_root)
    dashboard = g.box("Bridge angled dashboard", (0, upper_floor + .98, -23.45),
                      (7.55, .16, .92), steel, bevel=.055, parent=bridge_root)
    g.rotate_game(dashboard, (.20, 0, 0))
    g.box("Pilot instrument console extension", (-2.1,upper_floor+.90,-23.20),
          (2.50,.20,.96), dark, bevel=.055, parent=bridge_root)
    # Four physical pilot display frames. Named anchors and dimensions are
    # shared with the runtime canvas screens; no baked placeholder telemetry.
    for index, definition in enumerate(layout["pilotMFDs"]):
        x,y,z=definition["position"]
        width,height=definition["width"],definition["height"]
        g.rod(f"Pilot display {index} mounting stalk", (x,upper_floor+.96,z-.22),
              (x,y-.08,z-.04), .035, steel, vertices=10, parent=bridge_root)
        anchor=g.empty(definition["node"], (x,y,z), parent=bridge_root)
        anchor["role"]="pilot-mfd";anchor["screenWidth"]=width;anchor["screenHeight"]=height
        g.box(f"Pilot display {index} chassis", (x,y,z-.02),
              (width+.10,height+.10,.10), dark, bevel=.025, parent=anchor)
        g.box(f"Pilot display {index} recessed face", (x,y,z+.037),
              (width+.01,height+.01,.014), petrol, bevel=.004, parent=anchor)
        for side in (-1,1):
            g.box(f"Pilot display {index} vertical bezel {side}", (x+side*(width/2+.022),y,z+.041),
                  (.04,height+.08,.03), steel, bevel=.007, parent=anchor)
            g.box(f"Pilot display {index} horizontal bezel {side}", (x,y+side*(height/2+.022),z+.041),
                  (width,.04,.03), steel, bevel=.007, parent=anchor)
        g.rotate_game(anchor, definition["rotation"])

    def pilot_seat(name, x):
        """Compact ergonomic flight chair inside the authored seat collider."""
        g.box(f"{name} pedestal foot", (x, upper_floor + .08, -21.25),
              (.54, .12, .48), steel, bevel=.07, parent=bridge_root)
        g.rod(f"{name} pedestal", (x, upper_floor + .10, -21.25),
              (x, upper_floor + .39, -21.25), .16, steel, vertices=12, parent=bridge_root)

        pan_shell = g.box(f"{name} pan shell", (x, upper_floor + .43, -21.28),
                          (.96, .16, .86), steel, bevel=.10, parent=bridge_root)
        g.rotate_game(pan_shell, (.08, 0, 0))
        pan = g.box(f"{name} pan cushion", (x, upper_floor + .54, -21.28),
                    (.78, .17, .70), cloth, bevel=.11, parent=bridge_root)
        g.rotate_game(pan, (.08, 0, 0))

        back_shell = g.box(f"{name} angled back shell", (x, upper_floor + 1.05, -20.98),
                           (.98, .98, .12), steel, bevel=.10, parent=bridge_root)
        g.rotate_game(back_shell, (.17, 0, 0))
        back_pad = g.box(f"{name} back cushion", (x, upper_floor + 1.03, -21.055),
                         (.68, .77, .11), cloth, bevel=.085, parent=bridge_root)
        g.rotate_game(back_pad, (.17, 0, 0))
        for side in (-1, 1):
            bolster = g.box(f"{name} back bolster {side:+d}",
                            (x + side * .46, upper_floor + 1.01, -21.01),
                            (.15, .76, .16), dark, bevel=.065, parent=bridge_root)
            g.rotate_game(bolster, (.17, 0, 0))

        head_shell = g.box(f"{name} headrest shell", (x, upper_floor + 1.49, -20.94),
                           (.68, .34, .13), steel, bevel=.075, parent=bridge_root)
        g.rotate_game(head_shell, (.17, 0, 0))
        head_pad = g.box(f"{name} headrest cushion", (x, upper_floor + 1.48, -21.015),
                         (.51, .24, .10), cloth, bevel=.065, parent=bridge_root)
        g.rotate_game(head_pad, (.17, 0, 0))

        for side in (-1, 1):
            g.rod(f"{name} arm support {side:+d}",
                  (x + side * .49, upper_floor + .48, -21.05),
                  (x + side * .49, upper_floor + .72, -21.18),
                  .035, steel, vertices=10, parent=bridge_root)
            g.box(f"{name} armrest {side:+d}",
                  (x + side * .49, upper_floor + .77, -21.18),
                  (.14, .15, .62), dark, bevel=.055, parent=bridge_root)
            g.rod(f"{name} control stalk {side:+d}",
                  (x + side * .46, upper_floor + .82, -21.43),
                  (x + side * .46, upper_floor + 1.02, -21.61),
                  .03, steel, vertices=10, parent=bridge_root)
            g.box(f"{name} control grip {side:+d}",
                  (x + side * .46, upper_floor + 1.04, -21.63),
                  (.10, .09, .14), dark, bevel=.035, parent=bridge_root)

    pilot_seat("Pilot seat", layout["pilotEye"][0])
    pilot_seat("Copilot seat", -layout["pilotEye"][0])

    # Side banks stay aft of the bow taper and leave the widened pressure-shell
    # shoulders as circulation space instead of running into the pilot seats.
    for side in (-1, 1):
        g.box(f"Bridge side console {side:+d}", (side * 5.60, upper_floor + .55, -15.8),
              (1.25, 1.06, 4.5), petrol, bevel=.11, parent=bridge_root)
        for index, z in enumerate((-17.25, -15.8, -14.35)):
            g.box(f"Bridge side readout {side:+d} {index}",
                  (side * 4.955, upper_floor + .84, z),
                  (.025, .44, .90), glass, bevel=.025, parent=bridge_root)
            g.box(f"Bridge side status {side:+d} {index}",
                  (side * 4.935, upper_floor + 1.12, z),
                  (.012, .08, .58), display if index != 1 else amber,
                  bevel=.012, parent=bridge_root)
        for locker, z in enumerate((-16.55, -13.65)):
            g.box(f"Bridge overhead locker {side:+d} {locker}",
                  (side * 5.58, bridge_ceiling - .52, z),
                  (1.44, .72, 2.35), ivory, bevel=.08, parent=bridge_root)
            g.box(f"Bridge overhead locker inset {side:+d} {locker}",
                  (side * 4.835, bridge_ceiling - .52, z),
                  (.025, .44, 1.88), dark, bevel=.025, parent=bridge_root)
            g.box(f"Bridge concealed light {side:+d} {locker}",
                  (side * 5.18, bridge_ceiling - .89, z),
                  (.72, .018, 1.52), mint, bevel=.014, parent=bridge_root)

    def bridge_ceiling_at(z):
        if z >= -18:
            return bridge_ceiling
        return bridge_ceiling + (z + 18) * (.5 / 7.4)

    # Two shallow chevron ribs track below the sloped pressure ceiling.  Their
    # spans are deliberately narrower than the hull at each station.
    for rib, (z, half_span) in enumerate(((-22.4, 4.35), (-19.5, 5.25))):
        y = bridge_ceiling_at(z)
        for side in (-1, 1):
            g.rod(f"Bridge transverse rib {rib} {side:+d}",
                  (side * half_span, y - .25, z + .14),
                  (side * .48, y - .10, z - .18),
                  .07, steel, vertices=12, parent=bridge_root)
            g.box(f"Bridge rib end block {rib} {side:+d}",
                  (side * half_span, y - .27, z + .14),
                  (.22, .28, .24), dark, bevel=.04, parent=bridge_root)
        g.box(f"Bridge rib practical housing {rib}", (0, y - .20, z - .18),
              (1.72, .08, .20), dark, bevel=.035, parent=bridge_root)
        g.box(f"Bridge rib practical {rib}", (0, y - .245, z - .18),
              (1.36, .018, .11), mint, bevel=.012, parent=bridge_root)

    # ---------------------------------------------------------------- crew quarters
    # Port partition is segmented for a 1.6 m structural opening at the forward end.
    crew_partition_x = crew["maxX"] + .08
    for index, (min_z, max_z) in enumerate(((crew["minZ"], 2.2), (3.8, crew["maxZ"]))):
        g.box(f"Crew corridor partition {index}",
              (crew_partition_x, partition_y, (min_z + max_z) / 2),
              (.16, partition_h, max_z - min_z), ivory, bevel=.04, parent=crew_root)
    for side in (-1, 1):
        g.box(f"Crew doorway jamb {side:+d}",
              (crew_partition_x, upper_floor + 1.45, 3.0 + side * .88),
              (.28, 2.90, .20), steel, bevel=.035, parent=crew_root)
    g.box("Crew doorway lintel", (crew_partition_x, upper_ceiling - .18, 3.0),
          (.28, .28, 1.92), steel, bevel=.04, parent=crew_root)

    # Three double bunks use the outer pressure wall as their service spine.
    for bunk, z in enumerate((6.0, 10.2, 14.4)):
        for level, y in enumerate((upper_floor + .36, upper_floor + 1.92)):
            g.box(f"Crew bunk frame {bunk} {level}", (-5.22, y, z),
                  (2.18, .16, 3.18), steel, bevel=.045, parent=crew_root)
            g.box(f"Crew bunk mattress {bunk} {level}", (-5.17, y + .14, z),
                  (1.92, .18, 2.82), cloth, bevel=.10, parent=crew_root)
            g.box(f"Crew bunk head pad {bunk} {level}", (-5.16, y + .34, z - 1.26),
                  (1.64, .30, .18), petrol, bevel=.07, parent=crew_root)
            g.box(f"Crew bunk reading light {bunk} {level}", (-4.12, y + .62, z - 1.12),
                  (.035, .12, .34), mint, bevel=.02, parent=crew_root)
        g.rod(f"Crew bunk ladder {bunk}", (-3.98, upper_floor + .12, z + 1.22),
              (-3.98, upper_floor + 2.86, z + 1.22), .045,
              steel, vertices=10, parent=crew_root)
        for rung in range(5):
            g.rod(f"Crew bunk ladder rung {bunk} {rung}",
                  (-4.16, upper_floor + .42 + rung * .50, z + 1.22),
                  (-3.80, upper_floor + .42 + rung * .50, z + 1.22),
                  .025, steel, vertices=8, parent=crew_root)

    # Personal lockers and a compact fold desk complete the forward crew bay.
    for locker in range(4):
        z = 1.34 + locker * .58
        g.box(f"Crew locker {locker}", (-5.76, upper_floor + 1.30, z),
              (1.22, 2.55, .51), ivory, bevel=.055, parent=crew_root)
        g.box(f"Crew locker seam {locker}", (-5.13, upper_floor + 1.30, z),
              (.018, 1.92, .32), dark, bevel=.012, parent=crew_root)
        g.box(f"Crew locker latch {locker}", (-5.11, upper_floor + 1.30, z + .10),
              (.025, .16, .07), warning, bevel=.015, parent=crew_root)
    g.box("Crew fold desk", (-2.05, upper_floor + .88, 7.0),
          (.80, .10, 1.82), steel, bevel=.045, parent=crew_root)
    g.box("Crew desk terminal", (-1.99, upper_floor + 1.38, 7.64),
          (.55, .76, .08), petrol, bevel=.055, parent=crew_root)
    g.box("Crew desk display", (-1.99, upper_floor + 1.40, 7.585),
          (.43, .52, .018), glass, bevel=.025, parent=crew_root)

    # ---------------------------------------------------------------- galley and hygiene
    starboard_partition_x = galley["minX"] - .08
    # Separate galley and hygiene partitions retain two corridor doors.
    for index, (min_z, max_z) in enumerate(((galley["minZ"], 2.0), (3.6, 11.4), (13.0, 17.0))):
        g.box(f"Starboard corridor partition {index}",
              (starboard_partition_x, partition_y, (min_z + max_z) / 2),
              (.16, partition_h, max_z - min_z), ivory, bevel=.04,
              parent=galley_root if index < 2 else hygiene_root)
    for doorway, z in enumerate((2.8, 12.2)):
        for side in (-1, 1):
            g.box(f"Starboard doorway {doorway} jamb {side:+d}",
                  (starboard_partition_x, upper_floor + 1.45, z + side * .88),
                  (.28, 2.90, .20), steel, bevel=.035,
                  parent=galley_root if doorway == 0 else hygiene_root)
        g.box(f"Starboard doorway {doorway} lintel", (starboard_partition_x,
                                                       upper_ceiling - .18, z),
              (.28, .28, 1.92), steel, bevel=.04,
              parent=galley_root if doorway == 0 else hygiene_root)

    # Galley cabinets form one coherent service wall.  Their aft end stops at
    # z=9.45, leaving a capsule-clear turn into the hygiene side of the room.
    cabinet_zs = (1.65, 3.05, 4.45, 5.85, 7.25, 8.65)
    for cabinet, z in enumerate(cabinet_zs):
        g.box(f"Galley base cabinet {cabinet}", (5.74, upper_floor + .54, z),
              (1.42, 1.02, 1.18), ivory, bevel=.065, parent=galley_root)
        g.box(f"Galley cabinet inset {cabinet}", (4.995, upper_floor + .54, z),
              (.025, .67, .87), dark, bevel=.025, parent=galley_root)
        g.box(f"Galley cabinet latch {cabinet}", (4.975, upper_floor + .57, z - .39),
              (.018, .14, .13), warning, bevel=.012, parent=galley_root)
        g.box(f"Galley overhead locker {cabinet}", (5.86, upper_floor + 2.72, z),
              (1.18, .63, 1.16), petrol, bevel=.07, parent=galley_root)
        # Full-scale handles and two recessed appliance faces make the run read
        # as usable storage rather than a row of identical white boxes.
        g.rod(f"Galley base handle {cabinet}",
              (4.955, upper_floor + .69, z - .26),
              (4.955, upper_floor + .69, z + .26),
              .026, steel, vertices=8, parent=galley_root)
        g.rod(f"Galley overhead handle {cabinet}",
              (5.245, upper_floor + 2.62, z - .24),
              (5.245, upper_floor + 2.62, z + .24),
              .024, steel, vertices=8, parent=galley_root)
        if cabinet in (1, 4):
            g.box(f"Galley appliance bezel {cabinet}",
                  (4.958, upper_floor + .54, z), (.055, .78, .94),
                  steel, bevel=.035, parent=galley_root)
            g.box(f"Galley appliance recess {cabinet}",
                  (4.922, upper_floor + .57, z), (.018, .56, .72),
                  glass, bevel=.025, parent=galley_root)
            for status, offset_z in enumerate((-.22, 0, .22)):
                g.box(f"Galley appliance status {cabinet} {status}",
                      (4.908, upper_floor + .76, z + offset_z),
                      (.012, .025, .10), display if status != 1 else amber,
                      bevel=.005, parent=galley_root)

    worktop_min_z, worktop_max_z = 1.0, 9.45
    worktop_z = (worktop_min_z + worktop_max_z) / 2
    worktop_length = worktop_max_z - worktop_min_z
    g.box("Galley worktop", (5.36, upper_floor + 1.10, worktop_z),
          (2.20, .10, worktop_length), steel, bevel=.045, parent=galley_root)
    g.box("Galley worktop backsplash", (6.33, upper_floor + 1.42, worktop_z),
          (.12, .58, worktop_length), petrol, bevel=.035, parent=galley_root)
    for section, z in enumerate((2.2, 5.2, 8.2)):
        g.box(f"Galley backsplash utility strip {section}",
              (6.255, upper_floor + 1.45, z), (.025, .18, 1.75),
              dark, bevel=.018, parent=galley_root)
        for outlet in (-.48, .48):
            g.box(f"Galley utility indicator {section} {outlet:+.2f}",
                  (6.238, upper_floor + 1.47, z + outlet),
                  (.012, .055, .12), display, bevel=.008, parent=galley_root)
    g.box("Galley induction surface", (5.18, upper_floor + 1.165, 3.75),
          (1.20, .022, 1.45), glass, bevel=.06, parent=galley_root)
    for ring in (-.36, .36):
        g.box(f"Galley induction marker {ring:+.2f}", (5.18, upper_floor + 1.18, 3.75 + ring),
              (.72, .008, .025), amber, bevel=.008, parent=galley_root)
    g.box("Galley sink", (5.18, upper_floor + 1.155, 6.62),
          (1.18, .035, 1.38), rubber, bevel=.10, parent=galley_root)
    g.rod("Galley faucet riser", (5.72, upper_floor + 1.18, 6.62),
          (5.72, upper_floor + 1.68, 6.62), .045, steel,
          vertices=12, parent=galley_root)
    g.rod("Galley faucet neck", (5.72, upper_floor + 1.68, 6.62),
          (5.24, upper_floor + 1.68, 6.62), .045, steel,
          vertices=12, parent=galley_root)

    # A wall-mounted mess leaf replaces the floor island and stools.  The leaf
    # projects only to x=3.74, retaining 1.64 m of centre-path clearance after
    # the runtime expands it and the corridor partition by the 0.3 m capsule.
    mess_min_x, mess_max_x = 3.74, 4.32
    mess_min_z, mess_max_z = 4.25, 7.15
    mess_leaf_min_x = mess_min_x + .025
    g.box("Galley wall-mounted mess counter",
          ((mess_leaf_min_x + mess_max_x) / 2, upper_floor + 1.08,
           (mess_min_z + mess_max_z) / 2),
          (mess_max_x - mess_leaf_min_x, .10, mess_max_z - mess_min_z),
          steel, bevel=.045, parent=galley_root)
    g.box("Galley mess counter nosing",
          (mess_min_x + .035, upper_floor + 1.04, (mess_min_z + mess_max_z) / 2),
          (.07, .18, mess_max_z - mess_min_z), dark,
          bevel=.025, parent=galley_root)
    for bracket, z in enumerate((mess_min_z + .28, mess_max_z - .28)):
        g.rod(f"Galley mess counter brace {bracket}",
              (4.27, upper_floor + 1.00, z),
              (4.05, upper_floor + .55, z),
              .035, steel, vertices=10, parent=galley_root)
    for place, z in enumerate((5.05, 6.35)):
        g.box(f"Galley mess place inset {place}",
              (3.99, upper_floor + 1.135, z), (.34, .012, .72),
              rubber, bevel=.045, parent=galley_root)
        g.box(f"Galley mess place marker {place}",
              (3.97, upper_floor + 1.145, z - .25), (.18, .008, .035),
              warning, bevel=.006, parent=galley_root)

    # Hygiene occupies the starboard aft room.  Fixtures are deliberately
    # shallow so its inward walkway stays usable.
    g.box("Hygiene dividing wall", (4.10, partition_y, 14.0),
          (.12, partition_h, 6.0), ivory, bevel=.04, parent=hygiene_root)
    g.box("Hygiene shower tray", (5.34, upper_floor + .08, 15.45),
          (2.12, .16, 2.42), rubber, bevel=.10, parent=hygiene_root)
    for corner, (x, z) in enumerate(((4.35, 14.30), (6.33, 14.30), (4.35, 16.60), (6.33, 16.60))):
        g.rod(f"Hygiene shower post {corner}", (x, upper_floor + .12, z),
              (x, upper_ceiling - .24, z), .035, steel, vertices=10, parent=hygiene_root)
    g.rod("Hygiene shower rail", (4.35, upper_ceiling - .28, 14.30),
          (6.33, upper_ceiling - .28, 14.30), .035, steel,
          vertices=10, parent=hygiene_root)
    g.box("Hygiene privacy pane", (4.34, upper_floor + 1.55, 15.45),
          (.035, 2.65, 2.10), glass, bevel=.018, parent=hygiene_root)
    g.box("Hygiene basin cabinet", (2.72, upper_floor + .48, 15.25),
          (1.90, .92, 1.24), petrol, bevel=.075, parent=hygiene_root)
    g.box("Hygiene basin", (2.72, upper_floor + .98, 15.25),
          (1.62, .10, 1.02), ivory, bevel=.10, parent=hygiene_root)
    g.box("Hygiene mirror", (2.22, upper_floor + 2.05, 15.25),
          (.025, 1.36, 1.18), glass, bevel=.035, parent=hygiene_root)
    for vent in range(6):
        g.box(f"Hygiene vent slot {vent}", (5.20 + vent * .19, upper_ceiling - .12, 12.05),
              (.10, .05, .52), dark, bevel=.015, parent=hygiene_root)

    # Upper wall service strips and room lighting use the same industrial
    # language as cargo while keeping all central circulation volumes clear.
    for side in (-1, 1):
        wall_x = side * 6.42
        for index, z in enumerate((-9, -5, -.5, 4, 8.5, 13, 16)):
            # Skip the starboard lift zone; platform and rails remain root-owned.
            if side > 0 and z + 1.91 > lift_min_z and z - 1.91 < lift_max_z:
                continue
            g.box(f"Upper wall service panel {side:+d} {index}",
                  (wall_x, upper_floor + 1.55, z),
                  (.20, 2.62, 3.82), dark if index % 2 else petrol,
                  bevel=.055, parent=upper_root)
            for slot in range(4):
                g.box(f"Upper panel vent {side:+d} {index} {slot}",
                      (wall_x - side * .115, upper_floor + 2.15 + slot * .16, z),
                      (.025, .07, 2.65), steel, bevel=.012, parent=upper_root)

    for room, x, zs, parent in (
        ("Crew", -4.15, (4.4, 9.2, 14.0), crew_root),
        ("Galley", 4.10, (3.2, 7.5), galley_root),
        ("Hygiene", 5.20, (14.7,), hygiene_root),
    ):
        for index, z in enumerate(zs):
            g.box(f"{room} light housing {index}", (x, upper_ceiling - .13, z),
                  (2.20, .14, .50), dark, bevel=.055, parent=parent)
            g.box(f"{room} light diffuser {index}", (x, upper_ceiling - .205, z),
                  (1.78, .018, .22), mint, bevel=.015, parent=parent)

    # Sparse floor registry marks are intentionally planar; the common helper's
    # default text orientation is the approved floor-marking orientation.
    g.text("Cargo forward registry", "FWD  /  RAMP 01", (0, cargo_floor + .035, -20.8),
           .38, warning, parent=cargo_root)
    g.text("Cargo aft registry", "AFT  /  RAMP 02", (0, cargo_floor + .035, 20.8),
           .38, warning, parent=cargo_root)
    g.text("Upper lift registry", "CREW LIFT", (3.0, upper_floor + .035, -4.0),
           .28, warning, parent=upper_root)

    from upper_deck import build_upper_deck
    build_upper_deck(g, m, layout, upper_root, crew_root, galley_root, bridge_root)

    return {
        "root": interior_root,
        "cargo": cargo_root,
        "upper": upper_root,
        "bridge": bridge_root,
        "crew": crew_root,
        "galley": galley_root,
        "hygiene": hygiene_root,
        "vestibule": vestibule_root,
    }

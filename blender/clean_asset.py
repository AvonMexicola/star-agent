"""
clean_asset.py -- headless Blender clean-up for Meshy image-to-3D output.

Usage:
    blender -b --python blender/clean_asset.py -- IN.glb OUT.glb \
        [--tris 10000] [--height 12.0] [--origin base|grip|back|center] \
        [--max-tex 2048] [--keep-separate] [--no-scale]

What it does, in order:
    1. import the GLB (Meshy exports Y-up glTF; Blender imports it Z-up)
    2. join mesh objects into one (skipped when an armature is present, or --keep-separate)
    3. triangulate + decimate down to the triangle budget, preserving UVs
    4. apply transforms
    5. uniformly scale so the object's height matches --height metres
    6. move the object so the chosen origin point sits at the world origin
    7. downscale any texture larger than --max-tex
    8. export GLB, Y-up, metres, textures embedded
    9. print before/after stats

Conventions (Star Agent):
    metres, Y-up glTF, origin at the base (ground contact), <= 10k tris
    (characters <= 20k), PBR textures <= 2048 px.
"""

import os
import sys
import bpy
import bmesh
from mathutils import Vector


# ---------------------------------------------------------------- arguments

def parse_args(argv):
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []

    if len(argv) < 2:
        raise SystemExit(
            "usage: blender -b --python clean_asset.py -- IN.glb OUT.glb "
            "[--tris N] [--height M] [--origin base|grip|back|center] "
            "[--fit z|longest] [--max-tex N] [--keep-separate] [--no-scale]"
        )

    args = {
        "input": argv[0],
        "output": argv[1],
        "tris": 10000,
        "height": None,
        "origin": "base",
        "max_tex": 2048,
        "keep_separate": False,
        "scale": True,
        "fit": "z",
        "actions": None,
    }

    i = 2
    while i < len(argv):
        a = argv[i]
        if a == "--tris":
            args["tris"] = int(argv[i + 1]); i += 2
        elif a == "--height":
            args["height"] = float(argv[i + 1]); i += 2
        elif a == "--origin":
            args["origin"] = argv[i + 1]; i += 2
        elif a == "--max-tex":
            args["max_tex"] = int(argv[i + 1]); i += 2
        elif a == "--keep-separate":
            args["keep_separate"] = True; i += 1
        elif a == "--no-scale":
            args["scale"] = False; i += 1
        elif a == "--fit":
            args["fit"] = argv[i + 1]; i += 2
        elif a == "--actions":
            args["actions"] = argv[i + 1]; i += 2
        else:
            raise SystemExit("unknown argument: %s" % a)
    return args


# ------------------------------------------------------------------ helpers

def log(msg):
    print("[clean_asset] %s" % msg, flush=True)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images,
                  bpy.data.objects, bpy.data.armatures, bpy.data.actions):
        for item in list(block):
            try:
                block.remove(item)
            except Exception:
                pass


def mesh_objects():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def armature_objects():
    return [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]


def count_tris(objs):
    """Exact triangle count of the evaluated (modifier-applied) meshes."""
    total = 0
    deps = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        eval_obj = o.evaluated_get(deps)
        try:
            me = eval_obj.to_mesh()
        except RuntimeError:
            continue
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        total += len(bm.faces)
        bm.free()
        eval_obj.to_mesh_clear()
    return total


def select_only(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    if objs:
        bpy.context.view_layer.objects.active = objs[0]


def world_bbox(objs):
    """Axis-aligned world-space bounding box of the given objects."""
    mins = Vector((float("inf"),) * 3)
    maxs = Vector((float("-inf"),) * 3)
    deps = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        eval_obj = o.evaluated_get(deps)
        try:
            me = eval_obj.to_mesh()
        except RuntimeError:
            continue
        mat = o.matrix_world
        for v in me.vertices:
            wv = mat @ v.co
            for k in range(3):
                mins[k] = min(mins[k], wv[k])
                maxs[k] = max(maxs[k], wv[k])
        eval_obj.to_mesh_clear()
    return mins, maxs


# ------------------------------------------------------------ pipeline steps

def do_import(path):
    log("importing %s" % path)
    bpy.ops.import_scene.gltf(filepath=path)
    objs = mesh_objects()
    if not objs:
        raise SystemExit("no mesh objects found in %s" % path)
    log("imported %d mesh object(s), %d armature(s)"
        % (len(objs), len(armature_objects())))
    return objs


def drop_unskinned(objs):
    """Delete meshes that the armature does not deform.

    Meshy's animated exports ship a stray helper primitive (a unit icosphere at
    the origin) alongside the character. Left in, it doubles the bounding box
    and every measurement downstream -- height, footprint, origin -- comes out
    wrong.
    """
    keep, junk = [], []
    for o in objs:
        skinned = any(m.type == "ARMATURE" for m in o.modifiers) or (
            o.parent is not None and o.parent.type == "ARMATURE")
        (keep if skinned else junk).append(o)
    if not keep:
        return objs
    for o in junk:
        log("dropping unskinned mesh %s (%d verts)" % (o.name, len(o.data.vertices)))
        bpy.data.objects.remove(o, do_unlink=True)
    return keep


def do_join(objs):
    if len(objs) < 2:
        return objs
    log("joining %d meshes into one" % len(objs))
    select_only(objs)
    bpy.ops.object.join()
    return mesh_objects()


def apply_transforms(objs):
    select_only(objs)
    try:
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    except RuntimeError as e:
        log("transform_apply skipped: %s" % e)


def do_decimate(objs, budget):
    """Triangulate then collapse-decimate each mesh down to the budget."""
    before = count_tris(objs)
    log("triangles before decimate: %d (budget %d)" % (before, budget))

    # Triangulate first so the ratio maps onto real triangles.
    for o in objs:
        if not any(m.type == "TRIANGULATE" for m in o.modifiers):
            tri = o.modifiers.new(name="sa_triangulate", type="TRIANGULATE")
            tri.keep_custom_normals = True
    tri_total = count_tris(objs)

    if tri_total <= budget:
        log("already within budget after triangulation (%d tris)" % tri_total)
        bake_modifiers(objs)
        return before, count_tris(objs)

    ratio = float(budget) / float(tri_total)
    log("decimate ratio %.4f (%d -> ~%d tris)" % (ratio, tri_total, budget))

    # Share the budget across meshes by triangle count when not joined.
    per_obj = {}
    if len(objs) > 1:
        counts = {o.name: count_tris([o]) for o in objs}
        total = sum(counts.values()) or 1
        for o in objs:
            share = max(64, int(budget * counts[o.name] / total))
            per_obj[o.name] = min(1.0, share / max(1, counts[o.name]))
    else:
        per_obj[objs[0].name] = ratio

    for o in objs:
        dec = o.modifiers.new(name="sa_decimate", type="DECIMATE")
        dec.decimate_type = "COLLAPSE"
        dec.use_collapse_triangulate = True
        dec.ratio = per_obj[o.name]

    bake_modifiers(objs)
    after = count_tris(objs)
    log("triangles after decimate: %d" % after)
    return before, after


def bake_modifiers(objs):
    """Apply all modifiers so the exported mesh is final.

    ARMATURE modifiers are left alone: applying one would freeze the rest pose
    into the mesh and drop the skinning the animations need.
    """
    deps = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            if m.type == "ARMATURE":
                continue
            try:
                bpy.ops.object.modifier_apply(modifier=m.name)
            except RuntimeError as e:
                log("could not apply modifier %s on %s: %s" % (m.name, o.name, e))


def scene_roots():
    return [o for o in bpy.context.scene.objects if o.parent is None]


def scale_to_height(objs, target_h, fit="z"):
    """Uniformly scale so one world-space extent equals target_h metres.

    fit="z"       -- the vertical extent, for anything that stands upright.
    fit="longest" -- the largest of the three extents. Hand-held props come out
                     of Meshy lying along their length, so their "size" is that
                     length, not their height; measuring Z would inflate a
                     1.1 m rifle to a 3 m one.

    Rigged assets keep the scale live on the root node instead of applying it:
    baking a scale into an armature rescales the bones but not the pose-space
    translation keys, which would tear the animations apart. glTF carries the
    root node TRS just fine.
    """
    mins, maxs = world_bbox(objs)
    size = maxs - mins
    cur_h = max(size.x, size.y, size.z) if fit == "longest" else size.z
    if cur_h <= 1e-9:
        log("degenerate height, skipping scale")
        return 1.0
    factor = target_h / cur_h
    log("scaling %s %.4f m -> %.4f m (factor %.5f)" % (fit, cur_h, target_h, factor))
    roots = scene_roots()
    for o in roots:
        o.scale = o.scale * factor
        o.location = o.location * factor
    bpy.context.view_layer.update()
    if not armature_objects():
        apply_transforms(roots)
    return factor


def set_origin(objs, mode):
    """Translate the object so the chosen anchor point sits at (0,0,0).

    Blender is Z-up here; the exporter converts to Y-up on the way out.
        base   -> footprint centre, lowest point   (ground contact / feet)
        grip   -> bbox centre in X/Y, ~25% up Z    (hand-held weapons)
        back   -> back plate (min Y), mid height   (backpacks)
        center -> bbox centre
    """
    mins, maxs = world_bbox(objs)
    mid = (mins + maxs) * 0.5
    height = maxs.z - mins.z

    if mode == "base":
        anchor = Vector((mid.x, mid.y, mins.z))
    elif mode == "grip":
        anchor = Vector((mid.x, mid.y, mins.z + 0.25 * height))
    elif mode == "back":
        anchor = Vector((mid.x, mins.y, mid.z))
    elif mode == "center":
        anchor = mid.copy()
    else:
        raise SystemExit("unknown origin mode: %s" % mode)

    log("origin '%s' anchor at (%.3f, %.3f, %.3f)"
        % (mode, anchor.x, anchor.y, anchor.z))

    roots = scene_roots()
    for o in roots:
        o.location = o.location - anchor
    bpy.context.view_layer.update()

    # Put each root object's own origin at its new local zero.
    for o in roots:
        if o.type == "MESH":
            select_only([o])
            try:
                bpy.context.scene.cursor.location = (0.0, 0.0, 0.0)
                bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
            except RuntimeError as e:
                log("origin_set skipped for %s: %s" % (o.name, e))
    return anchor


def clamp_textures(max_px):
    resized = []
    for img in bpy.data.images:
        if img.size[0] == 0 or img.size[1] == 0:
            continue
        w, h = img.size[0], img.size[1]
        if max(w, h) <= max_px:
            continue
        if w >= h:
            nw, nh = max_px, max(1, int(round(h * max_px / w)))
        else:
            nh, nw = max_px, max(1, int(round(w * max_px / h)))
        try:
            img.scale(nw, nh)
            resized.append("%s %dx%d -> %dx%d" % (img.name, w, h, nw, nh))
        except Exception as e:
            log("could not scale image %s: %s" % (img.name, e))
    for r in resized:
        log("texture resized: %s" % r)
    return resized


def texture_report():
    out = []
    for img in bpy.data.images:
        if img.size[0] and img.size[1]:
            out.append("%s (%dx%d)" % (img.name, img.size[0], img.size[1]))
    return out


def remap_actions(path):
    """Rename the imported actions to the project's clip names, drop the rest.

    `path` is a JSON file: {"Meshy_Action_Name": "walk", ...}. Anything not
    listed is deleted so the exported GLB carries only the contract clips.
    NLA tracks/strips are renamed alongside — the glTF exporter takes the
    animation name from whichever of those it finds.
    """
    import json
    with open(path) as f:
        mapping = json.load(f)

    kept, dropped = [], []
    for act in list(bpy.data.actions):
        new = mapping.get(act.name)
        if new is None:
            dropped.append(act.name)
            continue
        act.name = new
        act.use_fake_user = True
        kept.append(new)

    for obj in bpy.context.scene.objects:
        ad = obj.animation_data
        if not ad:
            continue
        for track in list(ad.nla_tracks):
            strips = list(track.strips)
            live = [s for s in strips if s.action is not None]
            if not live:
                ad.nla_tracks.remove(track)
                continue
            for s in live:
                s.name = s.action.name
            track.name = live[0].action.name
        if ad.action is not None and ad.action.name not in kept:
            ad.action = None

    # Deleting after the NLA sweep: strips holding a dropped action are gone
    # by now, so the datablocks fall to zero users and can be removed.
    for act in list(bpy.data.actions):
        if act.name not in kept:
            bpy.data.actions.remove(act)

    log("actions kept (%d): %s" % (len(kept), ", ".join(sorted(kept))))
    if dropped:
        log("actions dropped (%d): %s" % (len(dropped), ", ".join(dropped)))
    return kept


def set_rest_pose(rest):
    """Switch every armature between its rest (bind) pose and its posed state."""
    mode = "REST" if rest else "POSE"
    for arm in armature_objects():
        arm.data.pose_position = mode
    bpy.context.view_layer.update()
    bpy.context.evaluated_depsgraph_get().update()


def do_export(path, has_anim):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    kwargs = dict(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_animations=has_anim,
        export_skins=has_anim,
        use_selection=False,
    )
    log("exporting %s (animations=%s)" % (path, has_anim))
    try:
        bpy.ops.export_scene.gltf(**kwargs)
    except TypeError as e:
        log("exporter rejected some options (%s), retrying minimal" % e)
        bpy.ops.export_scene.gltf(
            filepath=path, export_format="GLB", export_yup=True
        )


# --------------------------------------------------------------------- main

def main():
    args = parse_args(sys.argv)
    reset_scene()

    objs = do_import(args["input"])
    has_arm = bool(armature_objects())

    if not args["keep_separate"] and not has_arm:
        objs = do_join(objs)
    elif has_arm:
        log("armature present -- keeping meshes separate, preserving rig")
        objs = drop_unskinned(objs)
        # Measure and place the BIND pose, not whatever frame the importer left
        # the rig on: that rest shape is what a glTF viewer's bounding box sees,
        # and the clips animate around it. Restored before export.
        set_rest_pose(True)

    apply_transforms([o for o in objs if o.parent is None])

    tris_before, tris_after = do_decimate(objs, args["tris"])

    if args["scale"] and args["height"]:
        scale_to_height(objs, args["height"], args["fit"])

    set_origin(objs, args["origin"])

    clamp_textures(args["max_tex"])

    if args["actions"]:
        remap_actions(args["actions"])

    mins, maxs = world_bbox(objs)   # rest-pose figures for the manifest

    if has_arm:
        set_rest_pose(False)

    do_export(args["output"], has_arm)

    size = maxs - mins
    size_bytes = os.path.getsize(args["output"]) if os.path.exists(args["output"]) else 0

    print("")
    print("=" * 62)
    print("STATS %s" % os.path.basename(args["output"]))
    print("  triangles   : %d -> %d (budget %d)" % (tris_before, tris_after, args["tris"]))
    # glTF is Y-up: Blender Z is glTF Y (height), Blender Y is glTF -Z.
    print("  height (m)  : %.3f" % size.z)
    print("  footprint(m): %.3f x %.3f" % (size.x, size.y))
    print("  origin mode : %s" % args["origin"])
    print("  textures    : %s" % (", ".join(texture_report()) or "none"))
    print("  animations  : %d" % len(bpy.data.actions))
    print("  file size   : %.2f MB" % (size_bytes / 1048576.0))
    print("=" * 62)
    # machine-readable line for the manifest step
    print("CLEANSTATS|%s|%d|%.4f|%.4f|%.4f|%d|%d" % (
        os.path.basename(args["output"]), tris_after, size.z, size.x, size.y,
        len(texture_report()), size_bytes))


if __name__ == "__main__":
    main()

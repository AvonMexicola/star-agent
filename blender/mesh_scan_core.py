"""Read-only mesh diagnostics. Coordinates and thresholds are in metres.

No Blender dependency: the adapter supplies Blender's polygon tessellation.
Findings are review candidates, never automatic repair instructions.
"""

from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from itertools import product
import math


@dataclass(frozen=True)
class Settings:
    weld_distance: float = 1e-5
    plane_distance: float = 1e-4
    overlap_distance: float = 5e-4
    angle_degrees: float = 0.1
    min_patch_triangles: int = 8
    min_reduction_ratio: float = 2.0
    sliver_ratio: float = 100.0
    max_candidates: int = 2_000_000
    max_samples: int = 100


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def length(a):
    return math.sqrt(dot(a, a))


def bounds(points):
    return [tuple(min(p[k] for p in points) for k in range(3)),
            tuple(max(p[k] for p in points) for k in range(3))]


def weld(points, distance):
    """Virtual seam welding, with Euclidean checks across bucket boundaries.

    Representatives are deterministic first vertices; this is not a transitive
    merge and does not modify UVs, normals, weights or source geometry.
    """
    cells, representatives, mapping = defaultdict(list), [], []
    for p in points:
        cell = tuple(math.floor(v / distance) for v in p)
        match = None
        for offset in product((-1, 0, 1), repeat=3):
            for index in cells[tuple(cell[k] + offset[k] for k in range(3))]:
                if length(sub(p, representatives[index])) <= distance:
                    match = index
                    break
            if match is not None:
                break
        if match is None:
            match = len(representatives)
            representatives.append(p)
            cells[cell].append(match)
        mapping.append(match)
    return representatives, mapping


def sample_ids(ids, limit):
    ids = sorted(set(ids))
    return {"count": len(ids), "sample": ids[:limit], "truncated": len(ids) > limit}


def edge_map(faces):
    edges = defaultdict(list)
    for fi, face in enumerate(faces):
        for a, b in zip(face, face[1:] + face[:1]):
            if a != b:
                edges[tuple(sorted((a, b)))].append((fi, a, b))
    return edges


def edge_stats(edges, limit):
    rows = {}
    for kind, predicate in (
        ("boundary", lambda uses: len(uses) == 1),
        ("non_manifold", lambda uses: len(uses) > 2),
        ("inconsistent_winding", lambda uses: len(uses) == 2 and uses[0][1:] == uses[1][1:]),
    ):
        keys = sorted(k for k, uses in edges.items() if predicate(uses))
        rows[kind] = {"count": len(keys), "sample": keys[:limit], "truncated": len(keys) > limit}
    return rows


def boundary_corners(face_ids, faces, points, cfg):
    """One simple boundary loop only. Holes/branches deliberately yield no fit."""
    counts = Counter(tuple(sorted((a, b))) for fi in face_ids
                     for a, b in zip(faces[fi], faces[fi][1:] + faces[fi][:1]) if a != b)
    if any(n > 2 for n in counts.values()):
        return None
    adjacency = defaultdict(list)
    for (a, b), n in counts.items():
        if n == 1:
            adjacency[a].append(b)
            adjacency[b].append(a)
    if not adjacency or any(len(ns) != 2 for ns in adjacency.values()):
        return None
    first = min(adjacency)
    loop, seen, previous, current = [first], {first}, first, min(adjacency[first])
    while current != first:
        if current in seen:
            return None
        loop.append(current)
        seen.add(current)
        next_vertex = next(v for v in adjacency[current] if v != previous)
        previous, current = current, next_vertex
    if len(loop) != len(adjacency):
        return None  # more than one loop (e.g. a hole)
    # Remove straight boundary subdivisions, keeping actual corners.
    changed = True
    while changed and len(loop) > 3:
        changed = False
        for i, b in enumerate(loop):
            a, c = loop[i-1], loop[(i+1) % len(loop)]
            ab, bc, ac = sub(points[b], points[a]), sub(points[c], points[b]), sub(points[c], points[a])
            if (dot(ab, bc) > 0 and length(cross(ab, bc)) <=
                    math.sin(math.radians(cfg.angle_degrees)) * length(ab) * length(bc)
                    and length(cross(ab, ac)) <= cfg.plane_distance * length(ac)):
                loop.pop(i)
                changed = True
                break
    return loop


def analyze_object(data, cfg):
    points, source_faces = data["vertices"], data["faces"]
    geometric_points, mapping = weld(points, cfg.weld_distance)
    faces = [tuple(mapping[v] for v in face) for face in source_faces]
    raw_edges, edges = edge_map(source_faces), edge_map(faces)
    triangles, by_face = [], defaultdict(list)
    degenerate, slivers = set(), set()
    for tri_ids, fi in data["triangles"]:
        ps = [points[v] for v in tri_ids]
        vector = cross(sub(ps[1], ps[0]), sub(ps[2], ps[0]))
        twice_area = length(vector)
        if twice_area <= cfg.weld_distance ** 2:
            degenerate.add(fi)
            continue
        normal = tuple(v / twice_area for v in vector)
        longest_squared = max(dot(sub(ps[i], ps[j]), sub(ps[i], ps[j]))
                              for i, j in ((0, 1), (1, 2), (2, 0)))
        if longest_squared / twice_area > cfg.sliver_ratio:
            slivers.add(fi)
        tri = {"points": ps, "normal": normal, "area": twice_area / 2,
               "object": data["name"], "face": fi, "bounds": bounds(ps)}
        by_face[fi].append(tri)
        triangles.append(tri)
    normals = {}
    cosine = math.cos(math.radians(cfg.angle_degrees))
    for fi, ts in by_face.items():
        n, p = ts[0]["normal"], ts[0]["points"][0]
        if all(dot(n, t["normal"]) >= cosine for t in ts) and all(
                abs(dot(n, sub(points[v], p))) <= cfg.plane_distance for v in source_faces[fi]):
            normals[fi] = n
    neighbours = defaultdict(set)
    for uses in edges.values():
        if len(uses) == 2:
            a, b = uses[0][0], uses[1][0]
            neighbours[a].add(b)
            neighbours[b].add(a)
    # Plane anchored at the seed: successive slightly bent faces cannot drift.
    patches, assigned = [], set()
    for fi in sorted(normals):
        if fi in assigned:
            continue
        n, p = normals[fi], points[source_faces[fi][0]]
        queue, region = [fi], set()
        assigned.add(fi)
        while queue:
            current = queue.pop()
            region.add(current)
            for other in sorted(neighbours[current]):
                if (other not in assigned and other in normals and dot(n, normals[other]) >= cosine
                        and all(abs(dot(n, sub(points[v], p))) <= cfg.plane_distance
                                for v in source_faces[other])):
                    assigned.add(other)
                    queue.append(other)
        corners = boundary_corners(region, faces, geometric_points, cfg)
        count = sum(len(by_face[f]) for f in region)
        patches.append({"ids": region, "corners": corners, "triangles": count})

    findings = []

    def finding(kind, ids, **extra):
        findings.append({"kind": kind, "faces": sample_ids(ids, cfg.max_samples), **extra})

    if degenerate:
        finding("degenerate_faces", degenerate)
    if slivers:
        finding("sliver_faces", slivers)
    for patch in patches:
        corners, count = patch["corners"], patch["triangles"]
        if corners and count >= cfg.min_patch_triangles:
            theoretical = max(1, len(corners) - 2)
            if count / theoretical >= cfg.min_reduction_ratio:
                finding("dense_planar_patch", patch["ids"], triangles=count,
                        boundary_corners=len(corners), ideal_flat_triangles=theoretical,
                        caveat="Geometry-only estimate; retain UV/material/sharp/rig/detail boundaries.")
    # Fit whole connected face islands, including parts separated by export seams.
    visited, shapes = set(), []
    for fi in range(len(faces)):
        if fi in visited:
            continue
        queue, component = [fi], set()
        visited.add(fi)
        while queue:
            current = queue.pop()
            component.add(current)
            for other in neighbours[current]:
                if other not in visited:
                    visited.add(other)
                    queue.append(other)
        relevant = [p for p in patches if p["ids"] <= component]
        if not relevant or set().union(*(p["ids"] for p in relevant)) != component:
            continue
        if any(not p["corners"] for p in relevant):
            continue
        component_edges = edge_map([faces[i] for i in sorted(component)])
        if any(len(uses) != 2 for uses in component_edges.values()):
            continue
        all_corners = set().union(*(set(p["corners"]) for p in relevant))
        signature = (len(all_corners), tuple(sorted(len(p["corners"]) for p in relevant)))
        shape, ideal = {(5, (3, 3, 3, 3, 4)): ("pyramid", 6),
                        (8, (4, 4, 4, 4, 4, 4)): ("box", 12),
                        (6, (3, 3, 4, 4, 4)): ("wedge", 8)}.get(signature, (None, None))
        if shape:
            count = sum(len(by_face[i]) for i in component)
            shapes.append({"shape": shape, "faces": sample_ids(component, cfg.max_samples),
                           "triangles": count, "ideal_unbeveled_triangles": ideal})
            if count / ideal >= cfg.min_reduction_ratio:
                finding("overbuilt_simple_shape", component, shape=shape, triangles=count,
                        ideal_unbeveled_triangles=ideal,
                        caveat="Primitive geometry fit only; UVs, vertex shading, deformation and authored detail may require the subdivisions.")
    expectation = data.get("expect_shape")
    if expectation and (len(shapes) != 1 or shapes[0]["shape"] != expectation):
        finding("shape_expectation_mismatch", range(len(faces)), expected_shape=expectation,
                caveat="Inspect/rebuild the intended part; noise, bevels, holes or other islands can prevent a fit.")
    used_vertices = set(v for f in source_faces for v in f)
    face_edges = set(raw_edges)
    loose_edges = [i for i, edge in enumerate(data.get("edges", []))
                   if tuple(sorted(edge)) not in face_edges]
    edge_vertices = set(v for e in data.get("edges", []) for v in e)
    report = {"name": data["name"], "metadata": data.get("metadata", {}),
              "counts": {"vertices": len(points), "polygons": len(faces),
                         "triangles": len(data["triangles"]), "welded_vertices": len(geometric_points),
                         "coincident_vertex_excess": len(points)-len(geometric_points)},
              "raw_topology": edge_stats(raw_edges, cfg.max_samples),
              "welded_topology": edge_stats(edges, cfg.max_samples),
              "loose_vertices": sample_ids(set(range(len(points)))-used_vertices-edge_vertices, cfg.max_samples),
              "loose_edges": sample_ids(loose_edges, cfg.max_samples),
              "simple_shapes": shapes, "findings": findings,
              "bounds_metres": bounds(points) if points else None}
    return report, triangles


def boxes_overlap(a, b, distance):
    return all(a[0][k] <= b[1][k]+distance and b[0][k] <= a[1][k]+distance for k in range(3))


def build_tree(triangles, indices):
    box = [tuple(min(triangles[i]["bounds"][0][k] for i in indices) for k in range(3)),
           tuple(max(triangles[i]["bounds"][1][k] for i in indices) for k in range(3))]
    if len(indices) <= 8:
        return (box, indices, None, None)
    axis = max(range(3), key=lambda k: box[1][k]-box[0][k])
    ordered = sorted(indices, key=lambda i: sum(triangles[i]["bounds"][j][axis] for j in (0, 1)))
    mid = len(ordered)//2
    return (box, None, build_tree(triangles, ordered[:mid]), build_tree(triangles, ordered[mid:]))


def candidate_pairs(a, b, distance):
    """AABB broad phase, including coplanar triangles. Stream each pair once."""
    if not boxes_overlap(a[0], b[0], distance):
        return
    if a is b:
        if a[1] is not None:
            for pos, i in enumerate(a[1]):
                for j in a[1][pos+1:]:
                    yield i, j
        else:
            yield from candidate_pairs(a[2], a[2], distance)
            yield from candidate_pairs(a[2], a[3], distance)
            yield from candidate_pairs(a[3], a[3], distance)
    elif a[1] is not None and b[1] is not None:
        for i in a[1]:
            for j in b[1]:
                yield i, j
    elif a[1] is None:
        yield from candidate_pairs(a[2], b, distance)
        yield from candidate_pairs(a[3], b, distance)
    else:
        yield from candidate_pairs(a, b[2], distance)
        yield from candidate_pairs(a, b[3], distance)


def projected_overlap_area(a, b, normal):
    """Clip two projected triangles. Shared edges/vertices have zero area."""
    axis = max(range(3), key=lambda k: abs(normal[k]))
    axes = [k for k in range(3) if k != axis]
    # Translate before projection to avoid cancellation far from the origin.
    origin = a[0]
    polygon = [tuple(p[k]-origin[k] for k in axes) for p in a]
    clip = [tuple(p[k]-origin[k] for k in axes) for p in b]

    def side(p, x, y):
        return (y[0]-x[0])*(p[1]-x[1])-(y[1]-x[1])*(p[0]-x[0])

    if side(clip[2], clip[0], clip[1]) < 0:
        clip.reverse()
    for x, y in zip(clip, clip[1:] + clip[:1]):
        output = []
        if not polygon:
            return 0.0
        previous = polygon[-1]
        d_previous = side(previous, x, y)
        for current in polygon:
            d_current = side(current, x, y)
            if (d_current >= 0) != (d_previous >= 0):
                t = d_previous / (d_previous-d_current)
                output.append(tuple(previous[k]+t*(current[k]-previous[k]) for k in range(2)))
            if d_current >= 0:
                output.append(current)
            previous, d_previous = current, d_current
        polygon = output
    if len(polygon) < 3:
        return 0.0
    area = abs(sum(p[0]*q[1]-p[1]*q[0] for p, q in zip(polygon, polygon[1:]+polygon[:1]))) / 2
    return area / abs(normal[axis])


def overlap_scan(triangles, cfg):
    counts, samples = Counter(), []
    checked, complete = 0, True
    if triangles:
        tree = build_tree(triangles, list(range(len(triangles))))
        cosine = math.cos(math.radians(cfg.angle_degrees))
        for i, j in candidate_pairs(tree, tree, cfg.overlap_distance):
            a, b = triangles[i], triangles[j]
            if a["object"] == b["object"] and a["face"] == b["face"]:
                continue
            if not boxes_overlap(a["bounds"], b["bounds"], cfg.overlap_distance):
                continue
            if checked >= cfg.max_candidates:
                complete = False
                break
            checked += 1
            alignment = dot(a["normal"], b["normal"])
            if abs(alignment) < cosine:
                continue
            separation = max(
                max(abs(dot(a["normal"], sub(p, a["points"][0]))) for p in b["points"]),
                max(abs(dot(b["normal"], sub(p, b["points"][0]))) for p in a["points"]))
            if separation > cfg.overlap_distance:
                continue
            area = projected_overlap_area(a["points"], b["points"], a["normal"])
            if area <= max(cfg.weld_distance**2, min(a["area"], b["area"])*1e-8):
                continue
            kind = "coplanar_overlap" if separation <= cfg.weld_distance else "near_coplanar_overlap"
            counts[kind] += 1
            if len(samples) < cfg.max_samples:
                samples.append({"kind": kind, "a": {"object": a["object"], "face": a["face"]},
                                "b": {"object": b["object"], "face": b["face"]},
                                "separation_metres": separation, "overlap_area_m2": area,
                                "opposed_normals": alignment < 0})
    return {"complete": complete, "candidate_pairs_checked": checked,
            "triangle_pair_counts": dict(sorted(counts.items())), "samples": samples,
            "samples_truncated": sum(counts.values()) > len(samples),
            "limitation": "Positive-area near-parallel surface overlap only; not general self-intersection or a rendered Z-fighting test."}


def scan(objects, cfg=None):
    cfg = cfg or Settings()
    reports, triangles = [], []
    for data in sorted(objects, key=lambda o: o["name"]):
        report, ts = analyze_object(data, cfg)
        reports.append(report)
        triangles.extend(ts)
    overlap = overlap_scan(triangles, cfg)
    return {"schema_version": 1, "settings": asdict(cfg), "complete": overlap["complete"],
            "objects": reports, "overlaps": overlap}

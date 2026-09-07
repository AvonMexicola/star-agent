"""Pack authored material regions with UV-matched Meshy service detail.

blender -b --python-exit-code 1 --python blender/pack_fighter_textures.py
Uses /tmp/kestrel-uv.blend from export_fighter.py --prepare, without changing UVs
or geometry. --raw-meshy reproduces the direct import reviewed in round 5.
"""
from pathlib import Path
import argparse
import hashlib
import json
import sys
import bpy
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
TEX = ROOT/'assets/kestrel/textures'
SIZE = 1024
# Linear-light reflectance, roughness, metalness, Meshy normal detail strength.
FINISHES = {
    'Armour |': ((.72, .76, .73), .43, .08, .28),
    'Structure |': ((.026, .038, .040), .56, .04, .25),
    'Mechanism |': ((.27, .31, .32), .31, .88, .48),
    'Cockpit |': ((.019, .025, .028), .79, .0, .18),
    'Cavity |': ((.005, .009, .011), .82, .02, .12),
    'Warning |': ((.9, .36, .06), .49, .08, .12),
    'Decal |': ((.012, .025, .027), .52, .02, .10),
    'Livery |': ((.10, .28, .24), .47, .08, .22),
}


def read(path):
    image = bpy.data.images.load(str(path), check_existing=False)
    image.colorspace_settings.name = 'Non-Color'
    if list(image.size) != [SIZE, SIZE]:
        image.scale(SIZE, SIZE)
    pixels = np.empty(SIZE*SIZE*4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    bpy.data.images.remove(image)
    return pixels.reshape(SIZE, SIZE, 4)[:, :, :3]


def save(pixels, path):
    rgba = np.ones((SIZE, SIZE, 4), dtype=np.float32)
    rgba[:, :, :3] = np.clip(pixels, 0, 1)
    image = bpy.data.images.new(path.stem, SIZE, SIZE, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(rgba.reshape(-1))
    image.filepath_raw = str(path)
    image.file_format = 'PNG'
    image.save()
    bpy.data.images.remove(image)


def linear(rgb):
    return np.where(rgb <= .04045, rgb/12.92, ((rgb+.055)/1.055)**2.4)


def encoded(rgb):
    rgb = np.maximum(rgb, 0)
    return np.where(rgb <= .0031308, rgb*12.92, 1.055*rgb**(1/2.4)-.055)


def box_mean(values, radius=3):
    """Separable mean; masked callers prevent bleeding across materials."""
    out = values
    width = 2*radius+1
    for axis in (0, 1):
        pads = [(0, 0)]*out.ndim
        pads[axis] = (radius, radius)
        extended = np.pad(out, pads, mode='edge')
        pads[axis] = (1, 0)
        summed = np.pad(extended.cumsum(axis=axis, dtype=np.float64), pads)
        upper = [slice(None)]*out.ndim
        lower = upper.copy()
        upper[axis] = slice(width, None)
        lower[axis] = slice(None, -width)
        out = (summed[tuple(upper)]-summed[tuple(lower)])/width
    return out.astype(np.float32)


def material_regions(source_blend, layout):
    """Rasterize actual material ownership, including the two-texel bake margin."""
    bpy.ops.wm.open_mainfile(filepath=str(source_blend))
    sys.path.insert(0, str(ROOT/'blender'))
    from export_fighter import bake_targets
    objects = sorted(bake_targets(), key=lambda obj: obj.name)
    layouts = [{'name': obj.name, 'vertices': [list(v.co) for v in obj.data.vertices],
                'uv': [list(v.uv) for v in obj.data.uv_layers.active.data]}
               for obj in objects]
    digest = hashlib.sha256(json.dumps(layouts, separators=(',', ':')).encode()).hexdigest()
    if digest != layout:
        raise ValueError('Material mask source does not match recorded UVs')
    regions = np.zeros((SIZE, SIZE), dtype=np.uint8)
    positions = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    names = list(FINISHES)
    for obj in objects:
        mesh = obj.data
        mesh.calc_loop_triangles()
        uv = np.array([v.uv[:] for v in mesh.uv_layers.active.data])*SIZE
        world = np.array([tuple(obj.matrix_world @ vertex.co) for vertex in mesh.vertices])
        for triangle in mesh.loop_triangles:
            material = mesh.materials[triangle.material_index].name
            region = next((i+1 for i, prefix in enumerate(names) if material.startswith(prefix)), None)
            if region is None:
                raise ValueError('Unclassified opaque material: '+material)
            a, b, c = uv[list(triangle.loops)]
            low = np.maximum(np.ceil(np.minimum(np.minimum(a, b), c)-.5).astype(int), 0)
            high = np.minimum(np.floor(np.maximum(np.maximum(a, b), c)-.5).astype(int), SIZE-1)
            if np.any(low > high):
                continue
            v0, v1 = b-a, c-a
            determinant = v0[0]*v1[1]-v0[1]*v1[0]
            if abs(determinant) < 1e-9:
                continue
            y, x = np.mgrid[low[1]:high[1]+1, low[0]:high[0]+1]
            dx, dy = x+.5-a[0], y+.5-a[1]
            s = (dx*v1[1]-dy*v1[0])/determinant
            t = (v0[0]*dy-v0[1]*dx)/determinant
            inside = (s >= -1e-6) & (t >= -1e-6) & (s+t <= 1+1e-6)
            ys, xs = y[inside], x[inside]
            regions[ys, xs] = region
            va, vb, vc = world[list(triangle.vertices)]
            positions[ys, xs] = va+(vb-va)*s[inside, None]+(vc-va)*t[inside, None]
    covered = int(np.count_nonzero(regions))
    for _ in range(2):
        previous = regions.copy()
        old_positions = positions.copy()
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)]:
            shifted = np.roll(previous, (dy, dx), axis=(0, 1))
            if dy:
                shifted[0 if dy > 0 else -1, :] = 0
            if dx:
                shifted[:, 0 if dx > 0 else -1] = 0
            fill = (regions == 0) & (shifted != 0)
            regions[fill] = shifted[fill]
            positions[fill] = np.roll(old_positions, (dy, dx), axis=(0, 1))[fill]
    return regions, positions, {'uvLayoutSha256': digest, 'coveredTexels': covered,
                               'marginTexels': 2,
                               'regions': {name: int(np.count_nonzero(regions == i+1))
                                           for i, name in enumerate(names)}}


def finish(procedural, meshy, regions, positions):
    original = linear(procedural['basecolor'])
    generated = linear(meshy['basecolor'])
    coefficients = np.array([.2126, .7152, .0722])
    luminance = np.sum(generated*coefficients, axis=2)
    original_luma = np.sum(original*coefficients, axis=2)
    colour = original.copy()
    roughness = procedural['roughness'][:, :, 0].copy()
    metalness = procedural['metallic'][:, :, 0].copy()
    base_normal = procedural['normal']*2-1
    detail_normal = meshy['normal']*2-1
    normal = base_normal.copy()
    for i, (name, (tint, rough, metal, normal_strength)) in enumerate(FINISHES.items(), 1):
        mask = regions == i
        weights = mask.astype(np.float32)
        local_mean = box_mean(luminance*weights)/np.maximum(box_mean(weights), 1e-5)
        # Remove broad generated clouds/baked shading. Retain relative fine wear,
        # bounded to seven percent darkening on clean armour.
        detail = np.clip((luminance-local_mean)/np.maximum(local_mean, .04), -.25, .12)
        tint = np.array(tint)
        variation = np.clip(original_luma/np.dot(tint, coefficients), .78, 1.03)
        strength = .28 if name == 'Armour |' else .45
        if name in ('Livery |', 'Warning |', 'Decal |'):
            strength = .10
        colour[mask] = (tint[None, None, :]*variation[:, :, None]*(1+strength*detail[:, :, None]))[mask]
        if name == 'Mechanism |':
            # Small generated heat tint, without transferring generated light.
            hue = np.clip(generated/np.maximum(luminance[:, :, None], .04), .8, 1.15)
            colour[mask] *= (.75+.25*hue)[mask]
        # Material type owns reflectivity: ceramic stays dielectric, rubber matte.
        surface_rough = np.clip(rough+.20*(meshy['roughness'][:, :, 0]-.5), rough-.08, rough+.08)
        if name == 'Mechanism |':
            # Directional brushing in metres, coherent across UV seams.
            surface_rough += np.sin(positions[:, :, 2]*850+np.sin(positions[:, :, 0]*27))*.025
        roughness[mask] = surface_rough[mask]
        surface_metal = np.clip(metal+.12*(meshy['metallic'][:, :, 0]-.5), max(0, metal-.05), min(1, metal+.05))
        metalness[mask] = surface_metal[mask]
        # Whiteout blend retains authored bevels; attenuate generated detail only.
        detail_xy = detail_normal[:, :, :2]*normal_strength
        composed = np.dstack((base_normal[:, :, :2]+detail_xy,
                              base_normal[:, :, 2]*np.sqrt(np.maximum(1-np.sum(detail_xy**2, axis=2), .01))))
        normal[mask] = composed[mask]
    normal /= np.maximum(np.linalg.norm(normal, axis=2, keepdims=True), 1e-6)
    return encoded(colour), normal*.5+.5, roughness, metalness


def pack(source_blend, raw_meshy=False):
    layout = json.loads((TEX.parent/'texture-layout.json').read_text())['sha256']
    channels = ['basecolor', 'normal', 'roughness', 'metallic']
    present = sum((TEX/('meshy-'+channel+'.png')).exists() for channel in channels)
    if present not in (0, len(channels)):
        raise ValueError('Incomplete Meshy PBR set: provide all four imported channels')
    has_meshy = present == len(channels)
    region_record = None
    if has_meshy and not raw_meshy:
        regions, positions, region_record = material_regions(source_blend, layout)
    procedural = {name: read(TEX/('procedural-'+name+'.png')) for name in channels+['ao']}
    paths = [TEX/('procedural-'+name+'.png') for name in channels+['ao']]
    if has_meshy:
        meshy = {name: read(TEX/('meshy-'+name+'.png')) for name in channels}
        paths += [TEX/('meshy-'+name+'.png') for name in channels]
        if raw_meshy:
            base, normal = meshy['basecolor'], meshy['normal']
            rough, metal = meshy['roughness'][:, :, 0], meshy['metallic'][:, :, 0]
        else:
            base, normal, rough, metal = finish(procedural, meshy, regions, positions)
    else:
        base, normal = procedural['basecolor'], procedural['normal']
        rough, metal = procedural['roughness'][:, :, 0], procedural['metallic'][:, :, 0]
    save(base, TEX/'kestrel-basecolor.png')
    save(normal, TEX/'kestrel-normal.png')
    save(np.dstack((procedural['ao'][:, :, 0], rough, metal)), TEX/'kestrel-orm.png')
    files = {p.name: {'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'bytes': p.stat().st_size} for p in paths}
    mixed = has_meshy and not raw_meshy
    record = {'version': 2, 'uvLayoutSha256': layout,
              'basecolorSource': 'Authored material regions with filtered Meshy wear' if mixed else 'Meshy direct import' if has_meshy else 'Blender procedural only — Meshy pending',
              'packedChannels': {'R': 'Blender contact AO',
                                 'G': 'Material-specific roughness with Meshy variation' if mixed else 'meshy-roughness.png' if has_meshy else 'procedural-roughness.png',
                                 'B': 'Material-specific metalness with Meshy variation' if mixed else 'meshy-metallic.png' if has_meshy else 'procedural-metallic.png'},
              'normalSource': 'Authored bevel normal with attenuated Meshy tangent detail' if mixed else 'meshy-normal.png' if has_meshy else 'procedural-normal.png',
              'resolution': [SIZE, SIZE], 'sources': files}
    if region_record:
        record['materialRegions'] = region_record
        record['finishRecipe'] = {'source': 'blender/pack_fighter_textures.py', 'materialParameters': FINISHES,
                                 'meshGeometryChanged': False, 'uvLayoutChanged': False,
                                 'rawGeneratedMaps': 'meshy-source/'}
    (TEX/'provenance.json').write_text(json.dumps(record, indent=2)+'\n')
    print('KESTREL_TEXTURE_PACK '+json.dumps(record), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-blend', type=Path, default=Path('/tmp/kestrel-uv.blend'))
    parser.add_argument('--raw-meshy', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    pack(args.source_blend, args.raw_meshy)

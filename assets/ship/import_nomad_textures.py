"""Validate a Meshy export against our painting shell, then import its PBR maps.

blender -b --python-exit-code 1 --python assets/ship/import_nomad_textures.py -- --source downloaded.glb
Meshy's normalized geometry is used for verification only. The authored rig is
never replaced by the returned static mesh. Raw generated maps are retained.
"""
from pathlib import Path
import argparse
import hashlib
import json
import sys
import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from clean_meshy_upload import verify_chain
from nomad_texture_contract import load, verify_mesh, verify_material

ROOT = Path(__file__).resolve().parents[2]
TEX = ROOT/'assets/ship/textures'


def run(source):
    upload_path = ROOT/'assets/ship/nomad-meshy-clean.glb'
    layout = json.loads((TEX.parent/'texture-layout.json').read_text())
    chain = verify_chain(TEX.parent/layout['upload'], upload_path, layout)
    upload, original, _, read_original = load(upload_path)
    raw, result, binary, read_result = load(source)
    verification = verify_mesh(original, read_original, result, read_result)
    after = result['meshes'][0]['primitives'][0]
    images, material_contract = verify_material(result, after)
    prompt = (TEX.parent/'meshy-prompt.txt').read_bytes()
    job_bytes = (TEX.parent/'meshy-job.json').read_bytes()
    job = json.loads(job_bytes)
    if job['uploadSha256'] != chain['cleanUploadSha256']:
        raise ValueError('Recorded Meshy job used a different painting upload')
    if job['promptSha256'] != hashlib.sha256(prompt).hexdigest():
        raise ValueError('The exact prompt submitted to Meshy has changed')

    raw_dir = TEX/'meshy-source'
    raw_dir.mkdir(parents=True, exist_ok=True)
    (raw_dir/'prompt.txt').write_bytes(prompt)
    (raw_dir/'job.json').write_bytes(job_bytes)
    sources = {}
    for name, image_desc in images.items():
        view = result['bufferViews'][image_desc['bufferView']]
        start = view.get('byteOffset', 0)
        data = bytes(binary[start:start+view['byteLength']])
        extension = {'image/jpeg': '.jpg', 'image/png': '.png'}[image_desc['mimeType']]
        path = raw_dir/(name+extension)
        path.write_bytes(data)
        image = bpy.data.images.load(str(path), check_existing=False)
        image.colorspace_settings.name = 'Non-Color'
        resolution = list(image.size)
        image.scale(1024, 1024)

        def save(img, destination):
            img.filepath_raw = str(destination)
            img.file_format = 'PNG'
            img.save()

        if name == 'metallic-roughness':
            pixels = np.empty(1024*1024*4, dtype=np.float32)
            image.pixels.foreach_get(pixels)
            pixels = pixels.reshape(-1, 4)
            for label, channel in [('roughness', 1), ('metallic', 2)]:
                packed = np.ones_like(pixels)
                packed[:, :3] = pixels[:, channel, None]
                output = bpy.data.images.new('Meshy '+label, 1024, 1024, alpha=False)
                output.colorspace_settings.name = 'Non-Color'
                output.pixels.foreach_set(packed.reshape(-1))
                save(output, TEX/('meshy-'+label+'.png'))
        else:
            if name == 'normal':
                pixels = np.empty(1024*1024*4, dtype=np.float32)
                image.pixels.foreach_get(pixels)
                pixels = pixels.reshape(-1, 4)
                normal = pixels[:, :3]*2-1
                normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-6)
                pixels[:, :3] = normal*.5+.5
                image.pixels.foreach_set(pixels.reshape(-1))
            save(image, TEX/('meshy-'+name+'.png'))
        sources[path.name] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'resolution': resolution}
    record = {
        'version': 1, 'provider': job['provider'], 'model': job['model'], 'requestedResolution': job['requestedResolution'],
        'pbrEnabled': job['pbrEnabled'], 'prompt': 'prompt.txt', 'promptSha256': hashlib.sha256(prompt).hexdigest(),
        'jobMetadata': 'job.json', 'jobMetadataSha256': hashlib.sha256(job_bytes).hexdigest(),
        'displayedCredits': job['displayedCredits'],
        'sourceFile': source.name, 'sourceSha256': hashlib.sha256(raw).hexdigest(),
        'sourceBytes': len(raw), 'uploadSha256': chain['cleanUploadSha256'],
        'originalUploadSha256': chain['originalUploadSha256'],
        'uvLayoutSha256': chain['uvLayoutSha256'],
        'uvVerification': verification,
        'materialContract': material_contract,
        'sourceMaps': sources, 'importedResolution': [1024, 1024],
        'derivatives': {name: hashlib.sha256((TEX/name).read_bytes()).hexdigest()
                        for name in ('meshy-basecolor.png', 'meshy-normal.png', 'meshy-roughness.png', 'meshy-metallic.png')},
        'scope': 'Generated PBR maps only; Blender rig and authored UV layout preserved',
    }
    (raw_dir/'source.json').write_text(json.dumps(record, indent=2)+'\n')
    print('NOMAD_MESHY_IMPORT '+json.dumps(record), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    run(args.source)

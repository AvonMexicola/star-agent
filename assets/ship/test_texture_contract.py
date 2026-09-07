"""Run with python3 assets/ship/test_texture_contract.py; no Blender/GPU needed."""
from pathlib import Path
import copy
import json
import struct
import shutil
import tempfile
import unittest

from clean_meshy_upload import verify_chain
from nomad_texture_contract import load, verify_mesh, verify_material
from nomad_texture_layout import require_signature
from pack_nomad import publish

ROOT = Path(__file__).resolve().parent


def painting():
    doc = {'materials': [{}], 'meshes': [{'primitives': [{
        'attributes': {'POSITION': 0, 'TEXCOORD_0': 1}, 'indices': 2,
    }]}]}
    values = [[(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)],
              [(0, 0), (1, 0), (1, 1), (0, 1)], [(i,) for i in (0, 1, 2, 0, 2, 3)]]
    return doc, values


class PaintingContract(unittest.TestCase):
    def test_complete_corner_topology_accepts_reorder_winding_and_duplicate_faces(self):
        original, values = painting()
        returned = copy.deepcopy(values)
        returned[2] = [(i,) for i in (3, 2, 0, 2, 1, 0, 0, 1, 2)]
        result = verify_mesh(original, values.__getitem__, original, returned.__getitem__)
        self.assertEqual(result['usedCorners'], 4)
        self.assertEqual(result['uniqueTriangles'], 2)
        self.assertEqual(result['returnedTriangles'], 3)

    def test_three_vertex_subset_cannot_authorize_the_complete_atlas(self):
        original, values = painting()
        returned = [values[0][:3], values[1][:3], values[2][:3]]
        with self.assertRaisesRegex(ValueError, 'corner coverage'):
            verify_mesh(original, values.__getitem__, original, returned.__getitem__)

    def test_unused_vertex_buffer_cannot_conceal_missing_faces(self):
        original, values = painting()
        returned = copy.deepcopy(values)
        returned[2] = values[2][:3]
        with self.assertRaisesRegex(ValueError, 'corner coverage'):
            verify_mesh(original, values.__getitem__, original, returned.__getitem__)

    def test_all_corners_with_different_triangles_are_rejected(self):
        original, values = painting()
        returned = copy.deepcopy(values)
        returned[2] = [(i,) for i in (3, 0, 1, 1, 2, 3)]
        with self.assertRaisesRegex(ValueError, 'face coverage'):
            verify_mesh(original, values.__getitem__, original, returned.__getitem__)

    def test_changed_uv_is_rejected(self):
        original, values = painting()
        returned = copy.deepcopy(values)
        returned[1][0] = (.25, .25)
        with self.assertRaisesRegex(ValueError, 'position/UV'):
            verify_mesh(original, values.__getitem__, original, returned.__getitem__)

    def test_current_manifest_original_and_clean_upload_form_one_chain(self):
        layout = json.loads((ROOT/'texture-layout.json').read_text())
        chain = verify_chain(ROOT/layout['upload'], ROOT/'nomad-meshy-clean.glb', layout)
        self.assertEqual(chain['originalUploadSha256'], layout['uploadSha256'])
        self.assertEqual(chain['uvLayoutSha256'], layout['uvSha256'])

    def test_actual_shell_survives_float32_normalization_without_false_face_loss(self):
        _, doc, _, read = load(ROOT/'nomad-meshy-clean.glb')
        attribute = doc['meshes'][0]['primitives'][0]['attributes']['POSITION']
        positions = read(attribute)
        low = [min(v[i] for v in positions) for i in range(3)]
        high = [max(v[i] for v in positions) for i in range(3)]
        center = [(low[i]+high[i])*.5 for i in range(3)]
        scale = max(high[i]-low[i] for i in range(3))*.5
        normalized = [tuple(struct.unpack('<f', struct.pack('<f', (v[i]-center[i])/scale))[0]
                            for i in range(3)) for v in positions]
        result = verify_mesh(doc, read, doc, lambda n: normalized if n == attribute else read(n))
        self.assertEqual(result['matchedVertices'], len(positions))
        self.assertGreater(result['uniqueTriangles'], 35000)

    def test_mismatched_manifest_and_stale_clean_upload_are_rejected(self):
        layout = json.loads((ROOT/'texture-layout.json').read_text())
        source, cleaned = ROOT/layout['upload'], ROOT/'nomad-meshy-clean.glb'
        with self.assertRaisesRegex(ValueError, 'layout manifest'):
            verify_chain(source, cleaned, {**layout, 'uploadSha256': '0'*64})
        with self.assertRaisesRegex(ValueError, 'UV buffer'):
            verify_chain(source, cleaned, {**layout, 'uvSha256': '0'*64})
        with tempfile.TemporaryDirectory(prefix='nomad-stale-upload-test-') as temporary:
            stale = Path(temporary)/'stale.glb'
            stale.write_bytes(source.read_bytes())
            with self.assertRaisesRegex(ValueError, 'does not derive'):
                verify_chain(source, stale, layout)


class MaterialContract(unittest.TestCase):
    def setUp(self):
        self.doc = {'materials': [{'pbrMetallicRoughness': {
            'baseColorTexture': {'index': 0}, 'metallicRoughnessTexture': {'index': 1}},
            'normalTexture': {'index': 2, 'scale': .7}}],
            'textures': [{'source': i} for i in range(3)],
            'images': [{'bufferView': 0, 'mimeType': 'image/png'} for _ in range(3)],
            'bufferViews': [{}]}
        self.primitive = {'material': 0}

    def test_explicit_identity_transform_and_source_factors_are_recorded(self):
        self.doc['materials'][0]['normalTexture']['extensions'] = {'KHR_texture_transform': {'offset': [0, 0], 'scale': [1, 1], 'rotation': 0, 'texCoord': 0}}
        images, contract = verify_material(self.doc, self.primitive)
        self.assertEqual(set(images), {'basecolor', 'metallic-roughness', 'normal'})
        self.assertEqual(contract['factors']['normalScale'], .7)
        self.assertIn('intentionally replaced', contract['factorDisposition'])

    def test_uv1_cannot_borrow_uv0_geometry_approval(self):
        self.doc['materials'][0]['normalTexture']['texCoord'] = 1
        with self.assertRaisesRegex(ValueError, 'TEXCOORD_0'):
            verify_material(self.doc, self.primitive)

    def test_nonidentity_texture_transform_is_rejected(self):
        self.doc['materials'][0]['normalTexture']['extensions'] = {'KHR_texture_transform': {'offset': [.2, 0]}}
        with self.assertRaisesRegex(ValueError, 'TEXCOORD_0'):
            verify_material(self.doc, self.primitive)

    def test_unsupported_texture_indirection_is_rejected(self):
        self.doc['textures'][0]['extensions'] = {'KHR_texture_basisu': {'source': 1}}
        with self.assertRaisesRegex(ValueError, 'indirection'):
            verify_material(self.doc, self.primitive)

    def test_external_texture_uri_is_rejected(self):
        self.doc['images'][0]['uri'] = 'external.png'
        with self.assertRaisesRegex(ValueError, 'embedded PNG or JPEG'):
            verify_material(self.doc, self.primitive)


class ExportContract(unittest.TestCase):
    def test_packing_requires_the_signature_bound_at_upload_creation(self):
        with self.assertRaisesRegex(ValueError, 'no Blender hull signature'):
            require_signature({}, 'current-scene')
        with self.assertRaisesRegex(ValueError, 'changed after painting'):
            require_signature({'blenderHullLayoutSha256': 'upload-scene'}, 'other-scene')
        require_signature({'blenderHullLayoutSha256': 'upload-scene'}, 'upload-scene')

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='nomad-export-test-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root/'assets/ship').mkdir(parents=True)
        (self.root/'public/models').mkdir(parents=True)
        self.destinations = ['assets/ship/nomad.blend', 'public/models/nomad.glb', 'assets/ship/runtime-manifest.json']
        for name in self.destinations:
            (self.root/name).write_bytes(b'known-good')

    def export(self, path):
        shutil.copyfile(ROOT.parents[1]/'public/models/nomad.glb', path)

    def assert_originals(self):
        for name in self.destinations:
            self.assertEqual((self.root/name).read_bytes(), b'known-good')
        self.assertEqual(list((self.root/'assets/ship').glob('.nomad-export-*')), [])

    def test_over_budget_export_keeps_source_runtime_and_manifest(self):
        with self.assertRaisesRegex(ValueError, 'runtime budget'):
            publish(self.root, self.export, lambda path: self.fail('Source save must follow budget validation'), max_bytes=1)
        self.assert_originals()

    def test_failed_source_save_keeps_the_prior_bundle(self):
        def failure(path):
            path.write_bytes(b'incomplete-save')
            raise OSError('Simulated disk error during source save')
        with self.assertRaisesRegex(OSError, 'disk error'):
            publish(self.root, self.export, failure)
        self.assert_originals()

    def test_successful_export_publishes_verified_runtime_and_matching_manifest(self):
        report = publish(self.root, self.export, lambda path: path.write_bytes(b'new-source'))
        self.assertEqual((self.root/'assets/ship/nomad.blend').read_bytes(), b'new-source')
        self.assertEqual(json.loads((self.root/'assets/ship/runtime-manifest.json').read_text()), report)
        self.assertEqual(report['bytes'], (self.root/'public/models/nomad.glb').stat().st_size)
        self.assertEqual((self.root/'public/models/nomad.glb').read_bytes(), (ROOT.parents[1]/'public/models/nomad.glb').read_bytes())


if __name__ == '__main__':
    unittest.main()

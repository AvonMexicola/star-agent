"""Geometric regressions: python -m unittest discover -s tests/mesh_scan -v."""

from dataclasses import replace
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'blender'))
from mesh_scan_core import Settings, scan, weld


def mesh(name, points, faces):
    return {'name': name, 'vertices': points, 'faces': [tuple(f) for f in faces],
            'edges': sorted({tuple(sorted((a, b))) for face in faces for a, b in zip(face, face[1:]+face[:1])}),
            'triangles': [(tuple((face[0], face[i], face[i+1])), fi)
                          for fi, face in enumerate(faces) for i in range(1, len(face)-1)]}


def pyramid(subdivisions=1):
    points = [(-1., -1., 0.), (1., -1., 0.), (1., 1., 0.), (-1., 1., 0.), (0., 0., 2.)]
    faces = [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (3, 2, 1), (3, 1, 0)]
    if subdivisions == 1:
        return mesh('Pyramid', points, faces)
    # Independently tessellated triangles simulate GLB seam-split vertex data.
    out_points, out_faces = [], []
    for a, b, c in faces:
        grid = {}
        n = subdivisions
        for i in range(n+1):
            for j in range(n+1-i):
                grid[i, j] = len(out_points)
                out_points.append(tuple(points[a][k] + (points[b][k]-points[a][k])*i/n
                                        + (points[c][k]-points[a][k])*j/n for k in range(3)))
        for i in range(n):
            for j in range(n-i):
                out_faces.append((grid[i, j], grid[i+1, j], grid[i, j+1]))
                if i+j < n-1:
                    out_faces.append((grid[i+1, j], grid[i+1, j+1], grid[i, j+1]))
    return mesh('Pyramid', out_points, out_faces)


def triangle(name, points=None):
    return mesh(name, points or [(0., 0., 0.), (1., 0., 0.), (0., 1., 0.)], [(0, 1, 2)])


class MeshScanTests(unittest.TestCase):
    def test_clean_pyramid_is_not_overbuilt_or_overlapping(self):
        report = scan([pyramid()])
        row = report['objects'][0]
        self.assertEqual(row['simple_shapes'][0]['shape'], 'pyramid')
        self.assertEqual(row['findings'], [])
        self.assertEqual(report['overlaps']['triangle_pair_counts'], {})

    def test_dense_pyramid_and_export_seams(self):
        report = scan([pyramid(4)])
        row = report['objects'][0]
        findings = [f for f in row['findings'] if f['kind'] == 'overbuilt_simple_shape']
        self.assertEqual(findings[0]['shape'], 'pyramid')
        self.assertEqual(findings[0]['triangles'], 96)
        self.assertEqual(findings[0]['ideal_unbeveled_triangles'], 6)
        self.assertGreater(row['raw_topology']['boundary']['count'], 0)
        self.assertEqual(row['welded_topology']['boundary']['count'], 0)
        self.assertEqual(report['overlaps']['triangle_pair_counts'], {})
        self.assertEqual(sum(f['kind'] == 'dense_planar_patch' for f in row['findings']), 5)

    def test_box_and_wedge_signatures(self):
        box = mesh('Box', [(x,y,z) for z in (0.,1.) for y in (0.,1.) for x in (0.,1.)],
                   [(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)])
        wedge = mesh('Wedge', [(0.,0.,0.),(1.,0.,0.),(0.,1.,0.),(0.,0.,1.),(1.,0.,1.),(0.,1.,1.)],
                     [(2,1,0),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)])
        report = scan([box, wedge])
        self.assertEqual([o['simple_shapes'][0]['shape'] for o in report['objects']], ['box', 'wedge'])

    def test_planar_region_with_hole_has_no_simple_boundary_estimate(self):
        ring = mesh('Ring', [(0.,0.,0.),(3.,0.,0.),(3.,3.,0.),(0.,3.,0.),
                            (1.,1.,0.),(2.,1.,0.),(2.,2.,0.),(1.,2.,0.)],
                    [(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
        row = scan([ring])['objects'][0]
        self.assertNotIn('dense_planar_patch', {f['kind'] for f in row['findings']})
        self.assertEqual(row['welded_topology']['boundary']['count'], 8)

    def test_exact_duplicates_between_objects_and_opposed_normals(self):
        a, b = triangle('A'), triangle('B')
        b['faces'] = [(2, 1, 0)]
        b['triangles'] = [((2, 1, 0), 0)]
        report = scan([a, b])
        self.assertEqual(report['overlaps']['triangle_pair_counts'], {'coplanar_overlap': 1})
        self.assertTrue(report['overlaps']['samples'][0]['opposed_normals'])

    def test_duplicate_faces_within_one_object(self):
        a = triangle('A')
        a['faces'] += a['faces']
        a['triangles'].append(((0, 1, 2), 1))
        report = scan([a])
        self.assertEqual(report['overlaps']['triangle_pair_counts'], {'coplanar_overlap': 1})

    def test_partial_overlap_different_tessellation(self):
        square = mesh('Square', [(0.,0.,0.), (1.,0.,0.), (1.,1.,0.), (0.,1.,0.)], [(0,1,2),(0,2,3)])
        partial = triangle('Partial', [(0.2,0.1,0.), (0.8,0.1,0.), (0.2,0.9,0.)])
        report = scan([square, partial])
        self.assertEqual(report['overlaps']['triangle_pair_counts'], {'coplanar_overlap': 2})

    def test_shared_edges_vertices_disjoint_and_crossing_faces_are_not_z_fighting(self):
        a = triangle('A')
        neighbours = [triangle('edge', [(1.,0.,0.),(1.,1.,0.),(0.,1.,0.)]),
                      triangle('vertex', [(1.,0.,0.),(2.,0.,0.),(1.,-1.,0.)]),
                      triangle('disjoint', [(2.,2.,0.),(3.,2.,0.),(2.,3.,0.)]),
                      triangle('crossing', [(0.2,0.2,-1.),(0.2,0.2,1.),(0.8,0.2,0.)])]
        for other in neighbours:
            with self.subTest(other=other['name']):
                self.assertEqual(scan([a, other])['overlaps']['triangle_pair_counts'], {})

    def test_nearby_shell_and_far_parallel_faces(self):
        for gap, expected in ((0.0002, {'near_coplanar_overlap': 1}), (0.01, {})):
            b = triangle('B', [(0.,0.,gap),(1.,0.,gap),(0.,1.,gap)])
            self.assertEqual(scan([triangle('A'), b])['overlaps']['triangle_pair_counts'], expected)

    def test_thin_shell_with_opposed_normals_is_review_candidate(self):
        b = triangle('B', [(0.,0.,0.0002),(0.,1.,0.0002),(1.,0.,0.0002)])
        report = scan([triangle('A'), b])
        self.assertEqual(report['overlaps']['triangle_pair_counts'], {'near_coplanar_overlap': 1})
        self.assertTrue(report['overlaps']['samples'][0]['opposed_normals'])

    def test_degenerate_sliver_loose_and_winding(self):
        data = mesh('Bad', [(0.,0.,0.),(1.,0.,0.),(2.,0.,0.),(0.,0.00001,0.),(10.,0.,0.),(11.,0.,0.)],
                    [(0,1,2),(0,1,3)])
        data['vertices'].append((20.,0.,0.))
        data['edges'].append((4,5))
        row = scan([data])['objects'][0]
        self.assertEqual({f['kind'] for f in row['findings']}, {'degenerate_faces', 'sliver_faces'})
        self.assertEqual(row['loose_vertices']['sample'], [6])
        self.assertEqual(row['loose_edges']['count'], 1)
        self.assertEqual(row['raw_topology']['inconsistent_winding']['count'], 1)

    def test_weld_across_hash_boundary_uses_true_distance(self):
        points, mapping = weld([(0.99e-5,0.,0.),(1.01e-5,0.,0.),(1.99e-5,0.99e-5,0.)], 1e-5)
        self.assertEqual(mapping, [0,0,1])
        self.assertEqual(len(points), 2)

    def test_expected_noisy_pyramid_is_flagged(self):
        data = pyramid(3)
        data['vertices'][1] = tuple(v+0.01 for v in data['vertices'][1])
        data['expect_shape'] = 'pyramid'
        row = scan([data])['objects'][0]
        self.assertIn('shape_expectation_mismatch', {f['kind'] for f in row['findings']})

    def test_budget_and_samples_are_honest(self):
        objs = [triangle(str(i)) for i in range(6)]
        report = scan(objs, replace(Settings(), max_candidates=2, max_samples=1))
        self.assertFalse(report['complete'])
        self.assertEqual(report['overlaps']['candidate_pairs_checked'], 2)
        self.assertTrue(report['overlaps']['samples_truncated'])
        self.assertEqual(len(report['overlaps']['samples']), 1)

    def test_large_translation_and_input_order(self):
        a, b = triangle('A'), triangle('B')
        for data in (a,b):
            data['vertices'] = [tuple(v+1e8 for v in p) for p in data['vertices']]
        self.assertEqual(scan([a,b]), scan([b,a]))
        self.assertAlmostEqual(scan([a,b])['overlaps']['samples'][0]['overlap_area_m2'], 0.5)


if __name__ == '__main__':
    unittest.main()

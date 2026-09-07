"""Blender-authored quadruped death and conservative glTF animation append.

The source joint buffers remain untouched. Evaluated Blender pose matrices are
converted through each imported rest-bone correction back into the source glTF
node conventions, then written as new death tracks. No runtime procedural fake.
"""
import math
import struct
import bpy
from mathutils import Matrix, Vector, Quaternion


def set_clip(name):
    for obj in bpy.context.scene.objects:
        ad = obj.animation_data
        if not ad: continue
        matches = [(strip.action, strip.action_slot) for track in ad.nla_tracks for strip in track.strips
                   if strip.action and (track.name == name or strip.action.name == name)]
        if matches:
            ad.action, ad.action_slot = matches[0]
            ad.use_nla = False
        elif ad.action and ad.action.name == name:
            ad.use_nla = False
        else:
            # No matching clip on this object (e.g. an importer display helper).
            ad.action = None
            ad.use_nla = False
    bpy.context.scene.frame_set(0)


def source_worlds(doc):
    parents = {child: i for i, node in enumerate(doc['nodes']) for child in node.get('children', [])}
    result = {}
    def visit(index):
        if index in result: return result[index]
        node = doc['nodes'][index]
        if 'matrix' in node:
            a = node['matrix']; local = Matrix([[a[c*4+r] for c in range(4)] for r in range(4)])
        else:
            q = node.get('rotation', [0, 0, 0, 1])
            local = Matrix.LocRotScale(Vector(node.get('translation', [0, 0, 0])), Quaternion((q[3], *q[:3])), Vector(node.get('scale', [1, 1, 1])))
        result[index] = visit(parents[index]) @ local if index in parents else local
        return result[index]
    for i in range(len(doc['nodes'])): visit(i)
    return result, parents


def author_death(arm, mesh, doc, fit, duration):
    from finish_pyrebear import sample_walk, skin_points
    scene = bpy.context.scene
    scene.frame_set(0)
    walk_action = arm.animation_data.action
    walk_action.use_fake_user = True
    arm.animation_data.action = None
    arm.animation_data.use_nla = False
    hips = arm.pose.bones['Hips']
    low = min(point.z for point in skin_points(mesh))
    hips.matrix = arm.matrix_world.inverted() @ Matrix.Translation(Vector((0,0,-low))) @ arm.matrix_world @ hips.matrix
    bpy.context.view_layer.update()
    initial = {bone.name: (bone.location.copy(), bone.rotation_quaternion.copy(), bone.scale.copy()) for bone in arm.pose.bones}
    hips_world = arm.matrix_world @ hips.matrix
    pivot = hips_world.translation.copy()
    first_points = skin_points(mesh)
    body_height = max(point.z for point in first_points)
    body_width = max(point.x for point in first_points)-min(point.x for point in first_points)
    groups = {group.index:group.name for group in mesh.vertex_groups}
    torso = []
    head_vertices = []
    foot_vertices = {name:[] for name in ['frontleg2','R_frontleg2','backleg2','R_backleg2']}
    for vertex in mesh.data.vertices:
        weights = {groups[g.group]:g.weight for g in vertex.groups}
        if weights.get('head', 0) > .7: head_vertices.append(vertex.index)
        if weights.get('Hips',0)+weights.get('chest',0) > .65 and abs(first_points[vertex.index].x-pivot.x) < body_width*.24:
            torso.append(vertex.index)
        for name in foot_vertices:
            if weights.get(name,0) >= .25: foot_vertices[name].append(vertex.index)
    assert len(torso)>100
    original_feet = {name:arm.matrix_world @ arm.pose.bones[name].matrix for name in foot_vertices}
    sole_offsets = {name:min(first_points[i].z-original_feet[name].translation.z for i in indices) for name,indices in foot_vertices.items()}
    source, parents = source_worlds(doc)
    by_name = {node['name']:i for i,node in enumerate(doc['nodes']) if node.get('name')}
    basis = Matrix.Rotation(math.pi/2,4,'X')
    source_b = {i:fit @ basis @ matrix for i,matrix in source.items()}
    corrections = {bone.name:(arm.matrix_world @ bone.bone.matrix_local).inverted() @ source_b[by_name[bone.name]] for bone in arm.pose.bones}
    tracks = {bone.name:{'translation':[],'rotation':[],'scale':[]} for bone in arm.pose.bones}
    times = []
    def ease(value,start,end):
        t=min(1,max(0,(value-start)/(end-start)))
        return t*t*(3-2*t)
    def turn_bone(bone, rotation):
        world=arm.matrix_world @ bone.matrix
        at=world.translation.copy()
        bone.matrix=arm.matrix_world.inverted() @ Matrix.Translation(at) @ rotation @ Matrix.Translation(-at) @ world
        bpy.context.view_layer.update()
    def solve_chain(chain, target, side, bend, influence):
        points=[arm.matrix_world @ bone.head for bone in chain]
        lengths=[(b-a).length for a,b in zip(points,points[1:])]
        anchor=points[0].copy()
        if (target-anchor).length >= sum(lengths)-1e-6:
            direction=(target-anchor).normalized()
            solved=[anchor]
            for length in lengths: solved.append(solved[-1]+direction*length)
        else:
            # Knees/elbows fold out beside the body, with an upward bend pole.
            pole=Vector((side*body_height*.25,bend*body_height*.12,body_height*.17))
            solved=[anchor,points[1].lerp(anchor.lerp(target,1/3)+pole,influence),points[2].lerp(anchor.lerp(target,2/3)+pole*.7,influence),target.copy()]
            for _ in range(24):
                solved[-1]=target.copy()
                for j in range(2,-1,-1): solved[j]=solved[j+1]+(solved[j]-solved[j+1]).normalized()*lengths[j]
                solved[0]=anchor.copy()
                for j in range(3): solved[j+1]=solved[j]+(solved[j+1]-solved[j]).normalized()*lengths[j]
        for j,bone in enumerate(chain[:-1]):
            at=arm.matrix_world @ bone.head
            child=arm.matrix_world @ chain[j+1].head
            rotation=(child-at).normalized().rotation_difference((solved[j+1]-solved[j]).normalized())
            turn_bone(bone,rotation.to_matrix().to_4x4())
        foot=chain[-1]
        at=arm.matrix_world @ foot.head
        _,rotation,scale=original_feet[foot.name].decompose()
        foot.matrix=arm.matrix_world.inverted() @ Matrix.LocRotScale(at,rotation,scale)
        bpy.context.view_layer.update()
    for i in range(61):
        phase=i/60;frame=phase*duration*scene.render.fps
        scene.frame_set(math.floor(frame),subframe=frame%1)
        for bone in arm.pose.bones:
            bone.rotation_mode='QUATERNION'
            bone.location,bone.rotation_quaternion,bone.scale=initial[bone.name]
        collapse=ease(phase,.08,.80)
        settle=ease(phase,.58,1)
        fold=ease(phase,.06,.72)
        turn=Matrix.Rotation(math.radians(12)*collapse,4,'Y') @ Matrix.Rotation(.09*collapse,4,'X')
        hips.matrix=arm.matrix_world.inverted() @ Matrix.Translation(pivot) @ turn @ Matrix.Translation(-pivot) @ hips_world
        bpy.context.view_layer.update()
        turn_bone(arm.pose.bones['chest'],Matrix.Rotation(-.12*collapse,4,'X'))
        turn_bone(arm.pose.bones['head'],Matrix.Rotation(-.24*collapse-.10*settle,4,'X'))
        # Relax the lifted dog tail to a low lateral curve rather than a spring.
        tail_pitch=(-.50 if duration<1.5 else 0)*collapse
        turn_bone(arm.pose.bones['tail'],Matrix.Rotation(tail_pitch,4,'X') @ Matrix.Rotation(.20*collapse,4,'Z'))
        for name in ['tailstart','tail1','tail2','tail3']:
            turn_bone(arm.pose.bones[name],Matrix.Rotation((.28 if name=='tail3' and duration<1.5 else 0)*settle,4,'X'))
        points=skin_points(mesh)
        heights=sorted(points[index].z for index in torso)
        # Broad central belly support, excluding peripheral plate tips. A small
        # tolerated hard-tip intersection is preferable to levitating the mass.
        support=heights[max(0,int(len(heights)*.025))]
        drop=(support-.02)*collapse
        hips.matrix=arm.matrix_world.inverted() @ Matrix.Translation(Vector((0,0,-drop))) @ arm.matrix_world @ hips.matrix
        bpy.context.view_layer.update()
        # Let the heavy bear trunk settle onto a broad flank patch while keeping
        # its already lowered muzzle independent of that last pelvis movement.
        if duration > 1.5:
            head_world = arm.matrix_world @ arm.pose.bones['head'].matrix
            hips.matrix = arm.matrix_world.inverted() @ Matrix.Translation(Vector((0,0,-.02*settle))) @ arm.matrix_world @ hips.matrix
            bpy.context.view_layer.update()
            chest_bone = arm.pose.bones['chest']
            chest_bone.matrix = arm.matrix_world.inverted() @ Matrix.Translation(Vector((0,0,-.04*settle))) @ arm.matrix_world @ chest_bone.matrix
            bpy.context.view_layer.update()
            arm.pose.bones['head'].matrix = arm.matrix_world.inverted() @ head_world
            bpy.context.view_layer.update()
        # The dog's long lower jaw reaches the ground before the belly. Relieve
        # neck compression locally; never lift the body to its jaw/armor tips.
        points = skin_points(mesh)
        head_min = min(points[index].z for index in head_vertices)
        if head_min < -.012:
            head = arm.pose.bones['head']
            head.matrix = arm.matrix_world.inverted() @ Matrix.Translation(Vector((0,0,-.012-head_min))) @ arm.matrix_world @ head.matrix
            bpy.context.view_layer.update()
        for prefix in ['frontleg','R_frontleg','backleg','R_backleg']:
            foot_name=prefix+'2';old=original_feet[foot_name].translation
            side=1 if old.x>pivot.x else -1
            chest=arm.matrix_world @ arm.pose.bones['chest'].head
            hip=arm.matrix_world @ hips.head
            front='front' in prefix
            fore_width = (.43 if side > 0 else .34) if duration > 1.5 else .37
            goal=Vector((pivot.x+side*body_width*(fore_width if front else .30),
                         chest.y+body_height*.13 if front else hip.y-body_height*.28,
                         -sole_offsets[foot_name]+.006))
            target=old.lerp(goal,fold)
            chain=[arm.pose.bones[prefix+suffix] for suffix in ['', '0','1','2']]
            solve_chain(chain,target,side,1 if front else -1,fold)
        for bone in arm.pose.bones:
            for path in ['location','rotation_quaternion','scale']:
                bone.keyframe_insert(data_path=path,frame=frame,group=bone.name)
        posed={by_name[bone.name]:arm.matrix_world @ bone.matrix @ corrections[bone.name] for bone in arm.pose.bones}
        for bone in arm.pose.bones:
            index=by_name[bone.name];parent=parents[index]
            local=(posed[parent] if parent in posed else source_b[parent]).inverted() @ posed[index]
            location,rotation,scale=local.decompose()
            values=[rotation.x,rotation.y,rotation.z,rotation.w]
            previous=tracks[bone.name]['rotation']
            if previous and sum(a*b for a,b in zip(values,previous[-1]))<0: values=[-v for v in values]
            tracks[bone.name]['translation'].append(list(location));tracks[bone.name]['rotation'].append(values);tracks[bone.name]['scale'].append(list(scale))
        times.append(phase*duration)
    action=arm.animation_data.action;action.name='death';action.use_fake_user=True
    samples=sample_walk(arm,mesh)
    return {'duration':duration,'times':times,'tracks':tracks,'samples':samples,'nodeIndices':by_name}

def append_motion(doc, binary, wrapper, walk_samples, death):
    def accessor(rows, width, extrema=False):
        binary.extend(b'\0'*(-len(binary)%4))
        values = [value for row in rows for value in row]
        blob = struct.pack('<'+'f'*len(values), *values)
        view_index = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(blob)})
        binary.extend(blob)
        result = {'bufferView': view_index, 'componentType': 5126, 'count': len(rows), 'type': {1:'SCALAR',3:'VEC3',4:'VEC4'}[width]}
        if extrema:
            result['min'] = [min(row[i] for row in rows) for i in range(width)]
            result['max'] = [max(row[i] for row in rows) for i in range(width)]
        index = len(doc['accessors']); doc['accessors'].append(result)
        return index
    wrapper_index = len(doc['nodes'])-1
    base = wrapper['translation']
    walk = doc['animations'][0]
    times = accessor([[s['time']] for s in walk_samples], 1, True)
    values = accessor([[base[0],base[1]-s['bounds']['min'][1],base[2]] for s in walk_samples], 3)
    sampler = len(walk['samplers']);walk['samplers'].append({'input':times,'output':values,'interpolation':'LINEAR'})
    walk['channels'].append({'sampler':sampler,'target':{'node':wrapper_index,'path':'translation'}})
    clip = {'name':'death','channels':[],'samplers':[]}
    times = accessor([[t] for t in death['times']],1,True)
    for name, tracks in death['tracks'].items():
        for path, rows in tracks.items():
            output = accessor(rows,4 if path=='rotation' else 3)
            sampler = len(clip['samplers']);clip['samplers'].append({'input':times,'output':output,'interpolation':'LINEAR'})
            clip['channels'].append({'sampler':sampler,'target':{'node':death['nodeIndices'][name],'path':path}})
    # Explicitly hold the static wrapper so a crossfade from grounded walk cannot
    # leave the final corpse offset by the previous walk phase's ground track.
    input_index = accessor([[0],[death['duration']]],1,True)
    output = accessor([base,base],3)
    sampler = len(clip['samplers']);clip['samplers'].append({'input':input_index,'output':output,'interpolation':'LINEAR'})
    clip['channels'].append({'sampler':sampler,'target':{'node':wrapper_index,'path':'translation'}})
    doc['animations'].append(clip)

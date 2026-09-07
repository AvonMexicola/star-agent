"""Tideback source-preserving Aeon amphibian intake.

ALSOFT_DRIVERS=null blender -b --python-exit-code 1 \
  --python blender/finish_aeon_amphibian.py -- --shell-height .8

Uses the existing creature exporter/pose utilities in this process only; does not
edit shared helpers or rebuild other species. Source mesh/skin/walk buffers stay
exact. Studio evidence is Blender CPU, not the game renderer.
"""
import argparse, collections, hashlib, json, math, statistics, struct, subprocess, sys
from pathlib import Path
import bpy
sys.path.insert(0,str(Path(__file__).resolve().parent))
import finish_pyrebear as shared
from finish_pyrebear import (read_glb, identity, load_scene, sample_walk, union_bounds,
    skin_points, view_bytes, FEET)
from creature_motion import source_worlds, set_clip
from mathutils import Matrix, Vector, Quaternion
ROOT=Path(__file__).resolve().parents[1]
PACK=SOURCE=OUTPUT=None
SPECIES='aeon-amphibian'
SOURCE_SHA='a5954d75022d8f764bfa7da404dd69757428012c2258c4265ea392f0f800fd84'

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
    foot_vertices = {name:[] for name in ['frontleg2','R_frontleg2','backleg2','R_backleg2']}
    for vertex in mesh.data.vertices:
        weights = {groups[g.group]:g.weight for g in vertex.groups}
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
    def solve_chain(chain, target, side, bend, influence, paw_delta):
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
            solved=[anchor,points[1].lerp(anchor.lerp(target,.5)+pole,influence),target.copy()]
            for _ in range(24):
                solved[-1]=target.copy()
                for j in range(1,-1,-1): solved[j]=solved[j+1]+(solved[j]-solved[j+1]).normalized()*lengths[j]
                solved[0]=anchor.copy()
                for j in range(2): solved[j+1]=solved[j]+(solved[j+1]-solved[j]).normalized()*lengths[j]
        for j,bone in enumerate(chain[:-1]):
            at=arm.matrix_world @ bone.head
            child=arm.matrix_world @ chain[j+1].head
            rotation=(child-at).normalized().rotation_difference((solved[j+1]-solved[j]).normalized())
            turn_bone(bone,rotation.to_matrix().to_4x4())
        foot=chain[-1]
        at=arm.matrix_world @ foot.head
        _,rotation,scale=original_feet[foot.name].decompose()
        rotation=paw_delta.to_quaternion() @ rotation
        foot.matrix=arm.matrix_world.inverted() @ Matrix.LocRotScale(at,rotation,scale)
        bpy.context.view_layer.update()
    for i in range(61):
        phase=i/60;frame=phase*duration*scene.render.fps
        scene.frame_set(math.floor(frame),subframe=frame%1)
        for bone in arm.pose.bones:
            bone.rotation_mode='QUATERNION'
            bone.location,bone.rotation_quaternion,bone.scale=initial[bone.name]
        collapse=ease(phase,.10,.95)
        settle=ease(phase,.58,1)
        fold=ease(phase,.06,.72)
        turn=Matrix.Rotation(math.radians(6)*collapse+math.radians(8)*settle,4,'Y') @ Matrix.Rotation(.015*collapse,4,'X')
        hips.matrix=arm.matrix_world.inverted() @ Matrix.Translation(pivot) @ turn @ Matrix.Translation(-pivot) @ hips_world
        bpy.context.view_layer.update()
        # Shell, chest, head and tail retain their mutual source pose. Only the
        # whole rigid torso settles. Proximal limb bones also retain their source
        # pose because the imported shell carries weights from these joints;
        # only the two distal segments of each limb fold independently.
        points=skin_points(mesh)
        heights=sorted(points[index].z for index in torso)
        # Broad central belly support, excluding peripheral plate tips. A small
        # tolerated hard-tip intersection is preferable to levitating the mass.
        support=heights[max(0,int(len(heights)*.005))]
        drop=(support-.036)*collapse
        hips.matrix=arm.matrix_world.inverted() @ Matrix.Translation(Vector((0,0,-drop))) @ arm.matrix_world @ hips.matrix
        bpy.context.view_layer.update()
        for prefix in ['frontleg','R_frontleg','backleg','R_backleg']:
            foot_name=prefix+'2';old=original_feet[foot_name].translation
            side=1 if old.x>pivot.x else -1
            chest=arm.matrix_world @ arm.pose.bones['chest'].head
            hip=arm.matrix_world @ hips.head
            front='front' in prefix
            fore_width = .48 if side > 0 else .25
            front_reach = .20 if side > 0 else .03
            paw_delta=Matrix.Identity(4)
            sole=sole_offsets[foot_name]
            if front:
                roll=(1.05 if side>0 else -.25)*settle
                yaw=(-.70 if side>0 else .25)*settle
                paw_delta=Matrix.Rotation(yaw,4,'Z') @ Matrix.Rotation(roll,4,'Y')
                sole=min((paw_delta.to_3x3() @ (first_points[index]-old)).z for index in foot_vertices[foot_name])
            goal=Vector((pivot.x+side*body_width*(fore_width if front else .30),
                         chest.y+body_height*front_reach if front else hip.y-body_height*.28,
                         -sole+.008))
            target=old.lerp(goal,fold)
            chain=[arm.pose.bones[prefix+suffix] for suffix in ['0','1','2']]
            solve_chain(chain,target,side,1 if front else -1,fold,paw_delta)
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


def validate_motion(arm, mesh, crown_height):
    """Sample actual emitted skin; keep upper shell continuity a measured gate."""
    set_clip('walk')
    first=skin_points(mesh)
    shell=[i for i,p in enumerate(first) if p.z>crown_height*.8 and abs(p.x)<crown_height*.375]
    assert len(shell)>100, 'No meaningful upper-shell sample region'
    chains=[[prefix+suffix for suffix in ['', '0','1','2']] for prefix in ['frontleg','R_frontleg','backleg','R_backleg']]
    def lengths():
        return [(arm.matrix_world@arm.pose.bones[b].head-arm.matrix_world@arm.pose.bones[a].head).length for chain in chains for a,b in zip(chain,chain[1:])]
    def shell_local(points):
        hips=arm.matrix_world@arm.pose.bones['Hips'].matrix
        q=hips.to_quaternion().inverted()
        return [q@(points[i]-hips.translation) for i in shell]
    baseline=lengths(); shell_first=shell_local(first)
    set_clip('death'); initial=skin_points(mesh)
    start_error=max((a-b).length for a,b in zip(first,initial))
    start,end=arm.animation_data.action.frame_range
    length_error=shell_error=step=0; previous=initial
    for i in range(121):
        frame=start+(end-start)*i/120
        bpy.context.scene.frame_set(int(frame),subframe=frame%1)
        points=skin_points(mesh)
        length_error=max(length_error,max(abs(a-b)for a,b in zip(baseline,lengths())))
        shell_error=max(shell_error,max((a-b).length for a,b in zip(shell_first,shell_local(points))))
        step=max(step,max((a-b).length for a,b in zip(previous,points)));previous=points
    result={'sampleCount':121,'upperShellVertexCount':len(shell),'upperShellMaxRelativeMotionMetres':shell_error,
        'maxLimbJointDistanceChangeMetres':length_error,'walkZeroToDeathZeroMaxVertexDisplacementMetres':start_error,
        'maxAdjacentSampleVertexDisplacementMetres':step,'sampleIntervalSeconds':1.6/120,
        'scope':'Upper shell region above80% crown height and central75% crown-height width; full skin/limb sampling is not terrain or continuous visual acceptance.'}
    assert shell_error<.002, result
    assert length_error<.002 and start_error<.002 and step<.10, result
    return result


def studio(arm, mesh, out):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
    scene.cycles.seed = 7291
    scene.render.threads_mode = 'FIXED'; scene.render.threads = 4
    scene.render.resolution_x = 800; scene.render.resolution_y = 600
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = 0
    scene.world = bpy.data.worlds.new('Neutral creature studio')
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes['Background']
    background.inputs['Color'].default_value = (.16, .16, .16, 1)
    background.inputs['Strength'].default_value = .5
    target = Vector((0,0,.40))
    for name, position, energy in [('key', (4, 4, 6), 800), ('fill', (-4, 1, 3), 500), ('rim', (1, -4, 4), 650)]:
        data = bpy.data.lights.new(name, 'AREA'); data.energy = energy; data.size = 4
        obj = bpy.data.objects.new(name, data); scene.collection.objects.link(obj)
        obj.location = position; obj.rotation_euler = (target-obj.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.003))
    floor = bpy.context.object
    material = bpy.data.materials.new('Studio neutral floor'); material.diffuse_color = (.16, .16, .16, 1)
    floor.data.materials.append(material)
    bpy.ops.object.camera_add(); camera = bpy.context.object; scene.camera = camera
    camera.data.type = 'ORTHO'; camera.data.ortho_scale = 2.0
    scene.render.use_stamp = True; scene.render.use_stamp_note = True
    for flag in ['date', 'time', 'render_time', 'frame', 'frame_range', 'memory', 'hostname', 'camera', 'lens', 'scene', 'marker', 'filename']:
        if hasattr(scene.render, 'use_stamp_'+flag): setattr(scene.render, 'use_stamp_'+flag, False)
    scene.render.stamp_font_size = 14
    scene.render.stamp_foreground = (1,1,1,1)
    scene.render.stamp_background = (0,0,0,.8)
    outputs = []
    for name, clip, phase, direction in [('front', 'walk', 0, (0, 6, 1.5)), ('side', 'walk', 0, (6, 0, 1.3)),
                                    ('walk-000', 'walk', 0, (4, 5, 2.6)), ('walk-025', 'walk', .25, (4, 5, 2.6)),
                                    ('walk-050', 'walk', .5, (4, 5, 2.6)), ('walk-075', 'walk', .75, (4, 5, 2.6)),
                                    ('death-mid', 'death', .5, (4, 5, 2.6)), ('death-final', 'death', 1, (4, 5, 2.6)),
                                    ('death-side', 'death', 1, (6, 0, 1.3))]:
        set_clip(clip)
        start, end = arm.animation_data.action.frame_range
        frame = start+(end-start)*phase; scene.frame_set(math.floor(frame), subframe=frame % 1)
        camera.location = target+Vector(direction)
        camera.rotation_euler = (target-camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.stamp_note_text = f'BLENDER STUDIO / {SPECIES.upper()} / {name} / NOT GAME EVIDENCE'
        path = out / (name+'.png'); scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        webp = path.with_suffix('.webp')
        subprocess.run(['magick', str(path), '-quality', '90', str(webp)], check=True)
        path.unlink()
        outputs.append({'path': str(webp.relative_to(ROOT)), 'phase': phase, 'cameraBlender': list(camera.location)})
    return outputs



def shell_backing(doc, binary, mesh, factor):
    """Author a small inset membrane under the inspected real crown boundary."""
    primitive=doc['meshes'][0]['primitives'][0]
    def rows(index):
        a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
        width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']]
        stride=v.get('byteStride',struct.calcsize(fmt)*width)
        return [struct.unpack_from('<'+fmt*width,binary,v.get('byteOffset',0)+a.get('byteOffset',0)+i*stride) for i in range(a['count'])]
    attrs={name:rows(index) for name,index in primitive['attributes'].items()}
    indices=[row[0] for row in rows(primitive['indices'])]
    canonical={};weld=[]
    for i,position in enumerate(attrs['POSITION']):
        weld.append(canonical.setdefault(tuple(round(x,7) for x in position),i))
    edges=collections.Counter()
    for a,b,c in zip(indices[::3],indices[1::3],indices[2::3]):
        for u,v in [(a,b),(b,c),(c,a)]:edges[tuple(sorted((weld[u],weld[v])))]+=1
    adjacency=collections.defaultdict(set)
    for (a,b),count in edges.items():
        if count==1:adjacency[a].add(b);adjacency[b].add(a)
    points=skin_points(mesh);seen=set();upper=[]
    for start in adjacency:
        if start in seen:continue
        todo=[start];seen.add(start);component=[]
        while todo:
            vertex=todo.pop();component.append(vertex)
            for other in adjacency[vertex]:
                if other not in seen:seen.add(other);todo.append(other)
        if min(points[i].z for i in component)>max(p.z for p in points)*.75:upper.append(component)
    assert len(upper)==1 and len(upper[0])==38, 'Crown boundary changed; inspect topology again'
    start=min(upper[0]);loop=[start];previous=None;current=start
    while True:
        options=sorted(adjacency[current]-({previous} if previous is not None else set()))
        following=options[0]
        if following==start:break
        assert following not in loop
        loop.append(following);previous,current=current,following
    assert len(loop)==38
    positions=[Vector(attrs['POSITION'][i]) for i in loop]
    centre=sum(positions,Vector())/len(positions)
    normal=sum((Vector(attrs['NORMAL'][i]) for i in loop),Vector()).normalized()
    # Slight overlap under the rim avoids an exposed hairline, while the centre
    # lies deeper inside the shell. Existing ridge geometry stays untouched.
    positions=[centre+(position-centre)*1.03-normal*(.003/factor) for position in positions]
    positions.append(centre-normal*(.025/factor))
    face_norm=(positions[1]-positions[0]).cross(positions[-1]-positions[0])
    faces=[(i,(i+1)%len(loop),len(loop)) for i in range(len(loop))]
    if face_norm.dot(normal)<0:faces=[(b,a,c) for a,b,c in faces]
    # Existing teal crown texel; all original UVs and the original map are intact.
    crown=max(range(len(points)),key=lambda i:points[i].z)
    uv=attrs['TEXCOORD_0'][crown]
    joints=[list(attrs['JOINTS_0'][i]) for i in loop]
    weights=[list(attrs['WEIGHTS_0'][i]) for i in loop]
    centre_weights=collections.defaultdict(float)
    for js,ws in zip(joints,weights):
        for j,w in zip(js,ws):centre_weights[j]+=w/len(loop)
    strongest=sorted(centre_weights,key=centre_weights.get,reverse=True)[:4]
    total=sum(centre_weights[j] for j in strongest)
    joints.append(strongest);weights.append([centre_weights[j]/total for j in strongest])
    authored=bpy.data.meshes.new('Tideback inset crown membrane')
    authored.from_pydata([p*100 for p in positions],[],faces);authored.update()
    return {'positions':[list(p) for p in positions],'normals':[list(normal)]*len(positions),
        'uvs':[list(uv)]*len(positions),'joints':joints,'weights':weights,'faces':faces,
        'receipt':{'boundaryVertexIndices':loop,'addedVertices':39,'addedTriangles':38,
            'addedPrimitives':1,'addedMaterials':0,'addedJoints':0,'rimOverlapFactor':1.03,
            'rimInsetDesignMetres':.003,'centreInsetDesignMetres':.025,
            'material':'existing authored baseColor, matte material0','uvSampleSourceVertex':crown,
            'scope':'Small inner membrane beneath the single38vertex upper-shell boundary; original mesh/UV/skin buffers retained.'}}


def write_with_backing(doc,binary,image,factor,anchor,walk,death,backing):
    preserved,wrapper=shared.write_runtime(doc,binary,image,factor,anchor,walk,death)
    result,packed=read_glb(OUTPUT);packed=bytearray(packed)
    def accessor(rows,width,component=5126,minimum=False):
        packed.extend(b'\0'*(-len(packed)%4));offset=len(packed)
        fmt={5126:'f',5123:'H'}[component]
        values=[v for row in rows for v in row]
        packed.extend(struct.pack('<'+fmt*len(values),*values))
        view=len(result['bufferViews']);result['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(packed)-offset})
        a={'bufferView':view,'componentType':component,'count':len(rows),'type':{1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4'}[width]}
        if minimum:a.update({'min':[min(row[i]for row in rows)for i in range(width)],'max':[max(row[i]for row in rows)for i in range(width)]})
        index=len(result['accessors']);result['accessors'].append(a);return index
    attributes={name:accessor(backing[key],width,component,name=='POSITION') for name,key,width,component in [
        ('POSITION','positions',3,5126),('NORMAL','normals',3,5126),('TEXCOORD_0','uvs',2,5126),('JOINTS_0','joints',4,5123),('WEIGHTS_0','weights',4,5126)]}
    index=accessor([[i] for face in backing['faces'] for i in face],1,5123)
    result['meshes'][0]['primitives'].append({'attributes':attributes,'indices':index,'material':0,'mode':4})
    result['buffers'][0]['byteLength']=len(packed)
    metadata=json.dumps(result,separators=(',',':')).encode();metadata+=b' '*(-len(metadata)%4);packed.extend(b'\0'*(-len(packed)%4))
    glb=struct.pack('<4sII',b'glTF',2,28+len(metadata)+len(packed))+struct.pack('<II',len(metadata),0x4e4f534a)+metadata+struct.pack('<II',len(packed),0x004e4942)+packed
    OUTPUT.write_bytes(glb)
    check,check_binary=read_glb(OUTPUT)
    assert check['meshes'][0]['primitives'][0]==doc['meshes'][0]['primitives'][0]
    for key,digest in preserved.items():assert hashlib.sha256(view_bytes(check,check_binary,int(key))).hexdigest()==digest
    return preserved,wrapper


def main():
    global PACK, SOURCE, OUTPUT, SOURCE_SHA, SPECIES
    parser = argparse.ArgumentParser()
    parser.add_argument('--species', choices=['aeon-amphibian'], default='aeon-amphibian')
    parser.add_argument('--shell-height', type=float, default=.8)
    parser.add_argument('--skip-renders', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    SPECIES = args.species
    PACK = ROOT / 'assets/creatures' / SPECIES
    SOURCE = PACK / 'source' / (SPECIES+'-walking.glb')
    OUTPUT = ROOT / 'public/models/creatures' / (SPECIES+'.glb')
    SOURCE_SHA = 'a5954d75022d8f764bfa7da404dd69757428012c2258c4265ea392f0f800fd84'
    shared.SPECIES, shared.ROOT, shared.OUTPUT = SPECIES, ROOT, OUTPUT
    assert .5 <= args.shell_height <= 1.8
    assert identity(SOURCE)['sha256'] == SOURCE_SHA
    PACK.mkdir(parents=True, exist_ok=True)
    review = PACK / 'review'; review.mkdir(exist_ok=True)
    doc, binary = read_glb(SOURCE)
    assert len(doc['meshes']) == len(doc['skins']) == len(doc['animations']) == len(doc['images']) == 1
    arm, mesh, helpers = load_scene(SOURCE)
    source_samples = sample_walk(arm, mesh)
    source_bounds = union_bounds(source_samples)
    original_transforms = [{'name': o.name, 'matrixWorldBlender': [list(row) for row in o.matrix_world]} for o in [arm, mesh]]
    points = skin_points(mesh)
    # The broad shell crown is the anatomical landmark, not a mammalian shoulder.
    crown_top = max(p.z for p in points)
    lowest = source_bounds['min'][1]
    factor = args.shell_height/(crown_top-source_samples[0]['bounds']['min'][1])
    centre_x = (source_bounds['min'][0]+source_bounds['max'][0])/2
    centre_y = -(source_bounds['min'][2]+source_bounds['max'][2])/2
    anchor = Vector((centre_x, centre_y, lowest))
    fit = Matrix.Rotation(math.pi, 4, 'Z') @ Matrix.Scale(factor, 4) @ Matrix.Translation(-anchor)
    roots = [o for o in bpy.context.scene.objects if o.parent is None and o.type != 'MESH']
    assert arm in roots
    wrapper = bpy.data.objects.new(SPECIES+'Root', None); bpy.context.scene.collection.objects.link(wrapper)
    for obj in roots:
        matrix = obj.matrix_world.copy(); obj.parent = wrapper; obj.matrix_world = matrix
    wrapper.matrix_world = fit
    bpy.context.view_layer.update()
    # Natural dry hide: source albedo remains authored; the erroneously linked
    # full-albedo emission and metallic defaults are removed, no maps invented.
    for material in mesh.data.materials:
        material.name = SPECIES+' matte shell'
        for shader in material.node_tree.nodes:
            if shader.type != 'BSDF_PRINCIPLED': continue
            emission = shader.inputs.get('Emission Color') or shader.inputs.get('Emission')
            if emission:
                for link in list(emission.links): material.node_tree.links.remove(link)
                emission.default_value = (0, 0, 0, 1)
            shader.inputs['Metallic'].default_value = 0
            shader.inputs['Roughness'].default_value = .85
            if shader.inputs.get('IOR'): shader.inputs['IOR'].default_value = 1.5
            if shader.inputs.get('Specular IOR Level'): shader.inputs['Specular IOR Level'].default_value = .5
    arm.animation_data.action.name = 'walk'
    normalized_samples = sample_walk(arm, mesh, count=241)
    backing=shell_backing(doc,binary,mesh,factor)
    death = author_death(arm, mesh, doc, fit, duration=1.6)
    png = PACK/'source/albedo.png'
    png.write_bytes(view_bytes(doc, binary, doc['images'][0]['bufferView']))
    webp = PACK/(SPECIES+'-albedo.webp')
    subprocess.run(['magick', str(png), '-resize', '1024x1024>', '-quality', '88', str(webp)], check=True)
    preserved, runtime_wrapper = write_with_backing(doc, binary, webp.read_bytes(), factor, anchor, normalized_samples, death,backing)
    assert OUTPUT.stat().st_size <= 2_000_000, 'Runtime GLB exceeds character download budget'
    # Reimport actual output to verify skin, animation binding, axes and bounds.
    arm, mesh, output_helpers = load_scene(OUTPUT)
    set_clip('walk')
    output_samples = sample_walk(arm, mesh, count=241)
    max_error = max(abs(a['bounds'][side][axis]-(a['bounds']['min'][1] if axis==1 else 0)-b['bounds'][side][axis])
                    for a, b in zip(normalized_samples, output_samples)
                    for side in ['min', 'max'] for axis in range(3))
    assert max_error < .001, f'Runtime reimport deformation mismatch {max_error}'
    dense_walk = sample_walk(arm, mesh, count=481)
    full_bounds = union_bounds(output_samples)
    size = [full_bounds['max'][i]-full_bounds['min'][i] for i in range(3)]
    hips = [s['hips'] for s in output_samples]
    root_span = [max(p[i] for p in hips)-min(p[i] for p in hips) for i in range(3)]
    # Estimate travel speed from backward planted-foot motion in the in-place
    # gait. Low-foot intervals only; this is an estimate, not root displacement.
    stance_speeds = []
    for name in FEET:
        heights = [s['feet'][name]['soleMinY'] for s in output_samples]
        limit = min(heights)+(max(heights)-min(heights))*.35
        for a, b in zip(output_samples, output_samples[1:]):
            if max(a['feet'][name]['soleMinY'], b['feet'][name]['soleMinY']) > limit: continue
            speed = (b['feet'][name]['soleCentre'][2]-a['feet'][name]['soleCentre'][2])/(b['time']-a['time'])
            if speed > 0: stance_speeds.append(speed)
    gait_speed = statistics.median(stance_speeds)
    primitive = doc['meshes'][0]['primitives'][0]
    manifest = {'id': SPECIES, 'status': 'development-candidate; independent/game review pending',
        'source': identity(SOURCE), 'runtime': identity(OUTPUT), 'builder': 'blender/finish_aeon_amphibian.py', 'displayName': 'Tideback',
        'coordinates': 'glTF Y-up, metres, front -Z; base-centre across the sampled walk envelope',
        'triangles': doc['accessors'][primitive['indices']]['count']//3+38,
        'vertices': doc['accessors'][primitive['attributes']['POSITION']]['count']+39,
        'materials': 1, 'drawPrimitives': 2, 'localizedRepair':backing['receipt'], 'joints': len(doc['skins'][0]['joints']),
        'texture': {'file': '/models/creatures/'+SPECIES+'.glb (embedded)', 'format': 'WebP', 'maxEdge': 1024,
                    'maps': ['authored baseColor only'], 'roughness': .85, 'metalness': 0, 'emissive': 0},
        'shellCrownHeightMetres': args.shell_height, 'anatomicalLandmark': 'Phase-zero dorsal shell crown above grounded skin minimum',
        'crownMeasurement': 'Phase-zero maximum evaluated shell skin height, relative to the same phase plantar skin minimum; dense per-phase wrapper grounding',
        'boundsMetres': full_bounds, 'sizeMetres': size,
        'dimensions': {'width':size[0], 'height':size[1], 'length':size[2]},
        'gaitSpeed': round(gait_speed, 1), 'deathDuration': death['duration'],
        'collision': {'halfWidth': max(abs(full_bounds['min'][0]), abs(full_bounds['max'][0])),
                      'halfLength': max(abs(full_bounds['min'][2]), abs(full_bounds['max'][2])), 'height': full_bounds['max'][1]},
        'animation': {'name': 'walk', 'sourceName': doc['animations'][0]['name'], 'durationSeconds': output_samples[-1]['time'],
            'channels': len(doc['animations'][0]['channels'])+1, 'sourceJointChannels': len(doc['animations'][0]['channels']), 'inPlace': True,
            'horizontalRootSpanMetres': [root_span[0], root_span[2]], 'verticalRootBobMetres': root_span[1],
            'rootMotionEdit': 'Source is horizontally in-place. One new wrapper translation track grounds each sampled pose; all81 source joint channels/samplers and non-image buffer data remain intact.',
            'estimatedWalkSpeedMetresPerSecond': gait_speed, 'recommendedWalkSpeedMetresPerSecond': round(gait_speed, 1),
            'speedMethod': 'Median positive backward sole-centre speed across samples in the lowest35% of each weighted foot region height range',
            'footMinYRange': [min(s['bounds']['min'][1] for s in output_samples), max(s['bounds']['min'][1] for s in output_samples)],
            'sampleCount': len(output_samples), 'denseSampleCount':len(dense_walk),
            'denseGroundMinimumMetres': min(s['bounds']['min'][1] for s in dense_walk),
            'denseGroundMaximumMetres': max(s['bounds']['min'][1] for s in dense_walk)},
        'normalization': {'uniformScale': factor, 'sourceBaseBlender': list(anchor), 'sourceShellCrownTopBlenderZ': crown_top,
                          'wrapperNode': runtime_wrapper, 'sourceObjectTransforms': original_transforms},
        'validation': {'allNonImageBufferViewsPreservedSha256': preserved, 'allSourceSkinAccessorsOriginalPrimitiveJointChannelsSamplersUnchanged': True,
            'blenderRuntimeReimportMaxBoundsErrorMetres': max_error, 'helperExcludedFromBounds': helpers,
            'actualSampleReport': 'assets/creatures/'+SPECIES+'/deformation-samples.json'},
        'limitations': ['One supplied forward walk and one Blender-authored death; no attack/idle/swim animation authored.',
                       'Studio renders do not establish browser shading, gameplay, performance or independent visual acceptance.',
                       'Gait ground clearance is sampled, not continuously proven; terrain placement belongs to runtime.']}
    (PACK/'deformation-samples.json').write_text(json.dumps({'source': source_samples, 'runtime': output_samples, 'deathAuthored': death['samples']}, indent=2)+'\n')
    set_clip('death')
    death_samples = sample_walk(arm, mesh)
    death_error = max(abs(a['bounds'][side][axis]-b['bounds'][side][axis]) for a,b in zip(death['samples'],death_samples) for side in ['min','max'] for axis in range(3))
    assert death_error < .002, f'Death reimport mismatch {death_error}'
    dense_death = sample_walk(arm, mesh, count=121)
    assert min(s['bounds']['min'][1] for s in dense_death) >= -.03, 'Death contact exceeds documented30mm tolerance'
    manifest['death'] = {'name':'death', 'durationSeconds':death['duration'], 'loop':False, 'holdFinalPose':True, 'authoring':'Blender shell-preserving belly collapse, 14-degree late lean, asymmetric relaxed distal paddles and folded joint-length-constrained limbs; chest/head/tail/proximal limbs retain their mutual source pose; two distal segments of each limb fold while the rigid shell settles onto broad underside support', 'boundsMetres':union_bounds(death_samples), 'finalBoundsMetres':death_samples[-1]['bounds'], 'groundMinimumMetres':min(s['bounds']['min'][1] for s in death_samples), 'reimportBoundsErrorMetres':death_error, 'denseSampleCount':len(dense_death), 'denseGroundMinimumMetres':min(s['bounds']['min'][1] for s in dense_death)}
    motion=validate_motion(arm,mesh,args.shell_height)
    manifest['validation']['motion']=motion
    (PACK/'motion-validation.json').write_text(json.dumps(motion,indent=2)+'\n')
    set_clip('walk')
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(PACK/(SPECIES+'.blend')))
    if not args.skip_renders:
        manifest['studio'] = {'renderer': 'Blender '+bpy.app.version_string+' Cycles CPU', 'samples': 12,
                              'threads': 4, 'resolution': [800, 600], 'views': studio(arm, mesh, review)}
    assert identity(SOURCE)['sha256'] == SOURCE_SHA
    (PACK/'intake.json').write_text(json.dumps(manifest, indent=2)+'\n')
    (OUTPUT.parent/(SPECIES+'-manifest.json')).write_text(json.dumps(manifest, indent=2)+'\n')
    print(json.dumps({key: manifest[key] for key in ['runtime', 'sizeMetres', 'collision', 'animation', 'normalization']}, indent=2))


if __name__ == '__main__':
    main()

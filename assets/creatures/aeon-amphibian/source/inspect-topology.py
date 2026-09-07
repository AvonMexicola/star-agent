from pathlib import Path
import sys,bpy,json,struct,collections
sys.path.insert(0,str(Path.cwd()/'blender'))
from finish_pyrebear import read_glb,load_scene,skin_points
from creature_motion import set_clip
root=Path.cwd();doc,binary=read_glb(root/'assets/creatures/aeon-amphibian/source/aeon-amphibian-walking.glb')
def values(index):
 a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];w={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];fmt={5126:'f',5125:'I',5123:'H'}[a['componentType']];n=struct.calcsize(fmt)*w;return [struct.unpack_from('<'+fmt*w,binary,v.get('byteOffset',0)+a.get('byteOffset',0)+i*v.get('byteStride',n)) for i in range(a['count'])]
p=doc['meshes'][0]['primitives'][0];pos=values(p['attributes']['POSITION']);idx=[x[0]for x in values(p['indices'])]
arm,mesh,_=load_scene(root/'public/models/creatures/aeon-amphibian.glb');set_clip('walk');points=skin_points(mesh)
print('COUNTS',len(pos),len(mesh.data.vertices),'CO0',pos[0],list(mesh.data.vertices[0].co))
canonical={};weld=[];reverse={}
for i,p in enumerate(pos):
 key=tuple(round(x,7)for x in p);c=canonical.setdefault(key,i);weld.append(c);reverse.setdefault(c,[]).append(i)
edges=collections.Counter()
for a,b,c in zip(idx[::3],idx[1::3],idx[2::3]):
 for x,y in [(a,b),(b,c),(c,a)]:edges[tuple(sorted([weld[x],weld[y]]))]+=1
boundary=[e for e,n in edges.items()if n==1];adj=collections.defaultdict(set)
for a,b in boundary:adj[a].add(b);adj[b].add(a)
seen=set();rows=[]
for a in adj:
 if a in seen:continue
 q=[a];seen.add(a);component=[]
 while q:
  v=q.pop();component.append(v)
  for c in adj[v]:
   if c not in seen:seen.add(c);q.append(c)
 ps=[points[i]for i in component];lo=[min(p[i]for p in ps)for i in range(3)];hi=[max(p[i]for p in ps)for i in range(3)]
 rows.append({'vertices':len(component),'indices':component,'boundsBlender':{'min':lo,'max':hi}})
report={'sourceVertices':len(pos),'weldedVertices':len(canonical),'boundaryEdges':len(boundary),'nonManifoldEdges':sum(n>2 for n in edges.values()),'boundaryComponents':rows}
(root/'assets/creatures/aeon-amphibian/source/topology-inspection.json').write_text(json.dumps(report,indent=2)+'\n')
print('TOPOLOGY',json.dumps({k:v for k,v in report.items()if k!='boundaryComponents'}))
print('UPPER_BOUNDARIES',json.dumps([r for r in rows if r['boundsBlender']['max'][2]>.6]))

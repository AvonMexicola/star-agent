"""Loading ramp stock whose tapered toe meets the true landing plane."""
import bpy


def build_ramp_deck(g,m,parent,ramp,start,span):
    x,y,z=ramp['pivot'];d=ramp['outward'];width=ramp['width']
    if start==0:
        return g.box('Ramp structural deck',(x,y-.17,z+d*span/2),
                     (width,.34,span-.03),m['dark'],.06,parent)
    # The nominal 8 m walking surface is unchanged. The underside tapers over
    # the final metre to a contact edge instead of continuing below the ground.
    # No vertex clamp or displaced runtime floor hides the former penetration.
    end=start+span
    section=[(start+.015,y),(end,y),(end-1.0,y-.34),(start+.015,y-.34)]
    points=[g.xyz((x+dx,py,z+d*u)) for dx in (-width/2,width/2) for u,py in section]
    faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    mesh=bpy.data.meshes.new('Tapered ramp toe stock');mesh.from_pydata(points,[],faces);mesh.update()
    import bmesh
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    obj=bpy.data.objects.new('Tapered ramp toe stock',mesh);bpy.context.collection.objects.link(obj)
    return g.finish(obj,obj.name,m['dark'],0,parent)

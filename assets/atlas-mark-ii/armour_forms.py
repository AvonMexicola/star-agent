"""Manufactured bow wedges and stepped aft engineering fairing."""
import math
from mathutils import Vector


def build_bow_cheek(g,m,parent,side):
    top=[(6.35,5.0,-30.8),(8.4,4.8,-30.2),(11.4,6.2,-25),(13.3,7.65,-20.2),(12.5,7.65,-13),(9.3,7.65,-12),(6.6,7.2,-23.7)]
    top=[(side*x,y,z) for x,y,z in top]
    low=[(x-side*.45,3.2,z+.18) for x,y,z in top]
    root=g.empty('PortBowCheek' if side<0 else 'StarboardBowCheek',parent=parent)
    g.panel('Bow cheek underside',low,m['dark'],.18,.035,root)
    # The top follows a descending sweep toward the tip instead of a flat lid.
    centre=tuple(sum((Vector(p) for p in top),Vector())/len(top))
    for i in range(len(top)):
        j=(i+1)%len(top)
        g.panel('Swept bow top armour',[top[i],top[j],centre],m['ivory'] if i%3 else m['petrol'],.15,.025,root)
        quad=[Vector(p) for p in [low[i],low[j],top[j],top[i]]]
        g.panel('Faceted bow structure',[tuple(p) for p in quad],m['dark'],.2,.025,root)
        if i in [1,2,3]:
            mid=sum(quad,Vector())/4
            inset=[mid+(p-mid)*.78+Vector((side*.09,0,0)) for p in quad]
            g.panel('Bow flank replaceable armour',[tuple(p) for p in inset],m['ivory'] if i==2 else m['petrol'],.1,.025,root)
            for p in inset:
                q=mid+(p-mid)*.87
                g.rod('Bow armour captive fixing',q,q+Vector((side*.10,0,0)),.04,m['steel'],6,root)
        g.rod('Bow chine machined edge',low[i],low[j],.075,m['steel'],10,root)
    # Seat the sensor array on the actual sloped forward facet. Independent
    # world-X boxes floated above this hull after the bow redesign.
    a,b,c,d=[Vector(p) for p in (low[2],low[3],top[3],top[2])]
    tangent=(b-a).normalized()
    normal=tangent.cross(d-a).normalized()
    if normal.x*side<0: normal=-normal
    vertical=normal.cross(tangent).normalized()
    for i,t in enumerate((.18,.38,.58,.78)):
        centre=a.lerp(b,t).lerp(d.lerp(c,t),.52)+Vector((side*.09,0,0))
        def plate(name,offset,width,height,material,thickness):
            p=centre+normal*offset
            points=[tuple(p+tangent*u+vertical*v) for u,v in
                    [(-width/2,-height/2),(width/2,-height/2),(width/2,height/2),(-width/2,height/2)]]
            return g.panel(name,points,material,thickness,.014,root)
        plate(f'Flush bow sensor housing {i}',.09,.78,.44,m['dark'],.12)
        plate(f'Flush bow sensor lens {i}',.16,.48,.17,m['glass'],.018)
    return root


def build_aft_fairing(g,m,parent):
    root=g.empty('AftEngineering',parent=parent)
    front=[(-7.4,9.2,17.8),(7.4,9.2,17.8),(7.4,12.65,17.8),(6.25,14.1,17.8),(-6.25,14.1,17.8),(-7.4,12.65,17.8)]
    rear=[(-4.8,9.2,25.5),(4.8,9.2,25.5),(4.8,10,25.5),(3.8,11.2,25.5),(-3.8,11.2,25.5),(-4.8,10,25.5)]
    g.panel('Aft crew pressure bulkhead',front,m['dark'],.22,0,root)
    g.panel('Aft engineering end shield',rear,m['dark'],.18,.025,root)
    for i in range(6):
        j=(i+1)%6
        pts=[Vector(p) for p in [front[i],front[j],rear[j],rear[i]]]
        g.panel('Tapered aft engineering chassis',[tuple(p) for p in pts],m['dark'],.18,.035,root)
        if i in [1,2,4,5]:
            centre=sum(pts,Vector())/4
            normal=(pts[1]-pts[0]).cross(pts[2]-pts[0]).normalized()
            if normal.dot(Vector((centre.x,centre.y-10.5,0)))<0:normal=-normal
            g.panel('Aft chamfer armour',[tuple(centre+(p-centre)*.90+normal*.12) for p in pts],m['ivory'],.12,.035,root)
    slope=math.atan2(2.9,7.7)
    for z in [20.6,21.3,22,22.7,23.4,24.1]:
        y=14.1-(z-17.8)*2.9/7.7
        for side in [-1,1]:
            fin=g.box('Engineering radiator slat',(side*2.8,y+.13,z),(3.0,.11,.36),m['steel'],.022,root)
            g.rotate_game(fin,(slope,0,0))
    for side in [-1,1]:
        for z in [19,20,21,22,23,24]:
            x=side*(6.5-(z-17.8)*.31);y=12.1-(z-17.8)*.32
            g.rod('Aft flank hydraulic feed',(x,y,z-.3),(x,y,z+.3),.065,m['steel'],10,root)
    g.loft('Dorsal mount load pedestal',[(-1.7,18),(1.7,18),(1.7,21),(-1.7,21)],[(-1.15,18.4),(1.15,18.4),(1.15,20.6),(-1.15,20.6)],13.25,14.12,m['dark'],.05,root)
    for x in [-2.9,2.9]:
        g.box('Stern service identification',(x,10.1,25.61),(1.1,.3,.065),m['warning'],.015,root)
    return root

"""Faceted drive pods with open, recessed variable-area exhaust machinery."""
import math
from mathutils import Vector


def build_drive_pod(g,m,parent,side):
    root=g.empty('PortDrive' if side<0 else 'StarboardDrive',parent=parent)
    cx=side*13.1
    profile=[(-1,-.55),(-.55,-1),(.55,-1),(1,-.55),(1,.55),(.55,1),(-.55,1),(-1,.55)]
    sections=[(13.5,8.3,2.8,1.6),(19.0,8.0,3.45,2.75),(26.8,7.9,3.0,2.7),(29.6,7.9,2.55,2.55)]
    rings=[[(cx+x*w,y+h*v,z) for x,v in profile] for z,y,w,h in sections]
    g.panel('Drive inlet pressure cap',rings[0],m['dark'],.2,.035,root)
    for k,(a,b) in enumerate(zip(rings,rings[1:])):
        for i in range(8):
            j=(i+1)%8
            quad=[Vector(p) for p in [a[i],a[j],b[j],b[i]]]
            centre=sum(quad,Vector())/4
            g.panel('Octagonal drive load shell',[tuple(p) for p in quad],m['dark'],.18,.035,root)
            # Recesses around individual armour plates reveal a continuous chassis.
            normal=(quad[1]-quad[0]).cross(quad[2]-quad[0]).normalized()
            outward=Vector((centre.x-cx,centre.y-7.9,0))
            if normal.dot(outward)<0:normal=-normal
            armour=[centre+(p-centre)*.86+normal*.12 for p in quad]
            mat=m['ivory'] if i in [0,3,4,5,6] else m['petrol']
            g.panel('Drive replaceable facet',[tuple(p) for p in armour],mat,.12,.035,root)
            for p in armour:
                bolt=centre+(p-centre)*.88
                g.rod('Drive recessed socket fixing',bolt+normal*.065,bolt+normal*.095,.043,m['dark'],6,root)
            if k==1 and i in [3,7]:
                for t in [.2,.35,.5,.65,.8]:
                    start=quad[0].lerp(quad[3],t).lerp(centre,.2)+normal*.23
                    end=quad[1].lerp(quad[2],t).lerp(centre,.2)+normal*.23
                    g.rod('Drive heat-channel rail',start,end,.065,m['steel'],10,root)
    # Three concentric depth stages; no glowing flat disc over the exhaust mouth.
    cy=7.9
    for z,r,tube,material in [(27.65,1.25,.10,'dark'),(28.5,1.57,.10,'steel'),(29.45,1.91,.13,'dark'),(30.40,2.15,.13,'steel'),(30.65,2.18,.055,'dark')]:
        g.ring('Recessed nozzle machined ring',(cx,cy,z),r,tube,m[material],'z',root)
    g.rod('Deep engine backplate',(cx,cy,27.2),(cx,cy,27.35),1.42,m['rubber'],40,root)
    g.ring('Idle plasma annulus',(cx,cy,27.5),1.12,.075,m['engine'],'z',root)
    g.rod('Exhaust centre plug',(cx,cy,27.4),(cx,cy,28.15),.48,m['steel'],24,root)
    for i in range(24):
        a=2*math.pi*i/24;d=.115
        def p(angle,r,z):return (cx+math.cos(angle)*r,cy+math.sin(angle)*r,z)
        # Dark inner throat behind bright metal petal lips provides visible depth.
        g.panel('Divergent exhaust throat',[p(a-d,1.28,27.6),p(a+d,1.28,27.6),p(a+d,2.08,30.5),p(a-d,2.08,30.5)],m['dark'],.045,.008,root)
        g.panel('Variable exhaust overlapping petal',[p(a-d,2.35,29.0),p(a+d,2.35,29.0),p(a+d*.72,2.15,30.9),p(a-d*.72,2.15,30.9)],m['steel'] if i%3 else m['petrol'],.075,.018,root)
        g.rod('Nozzle actuator sleeve',p(a,2.46,28.1),p(a,2.40,29.65),.065,m['dark'],10,root)
        g.rod('Nozzle polished actuator',p(a,2.40,29.4),p(a,2.24,30.35),.03,m['steel'],10,root)
        g.rod('Exhaust flow straightener',p(a,.5,27.9),p(a,1.14,27.6),.04,m['dark'],8,root)
    # Separate feed systems sit against the inboard aft shoulder.
    for dy in [-.5,.5]:
        g.rod('Drive coolant feed',(cx-side*2.9,7.9+dy,18.5),(cx-side*2.8,7.9+dy,25.6),.13,m['steel'],12,root)
        for z in [19.0,22.0,25.0]:g.ring('Coolant flange',(cx-side*2.85,7.9+dy,z),.18,.045,m['dark'],'z',root)
    return root


def build_loading_bow(g,m,parent):
    """Continuous angular load arch around the drive-through mouth."""
    root=g.empty('LoadingBow',parent=parent)
    for side in [-1,1]:
        # An eight-sided mouth reads as one vessel instead of detached pontoons.
        g.panel('Bow arch upper bevel',[(side*6.0,8.62,-29.0),(side*8.9,6.8,-29.0),(side*9.15,7.85,-28.45),(side*6.2,9.5,-28.45)],m['ivory'],.24,.05,root)
        g.panel('Bow arch upright',[(side*8.9,3.0,-29.0),(side*8.9,6.8,-29.0),(side*9.15,7.85,-28.45),(side*9.15,3.35,-28.45)],m['dark'],.3,.04,root)
        g.panel('Swept bow shoulder',[(side*4.9,9.3,-25.9),(side*6.2,9.5,-28.45),(side*9.15,7.85,-28.45),(side*10.45,7.85,-23.6),(side*7.8,9.3,-23.6)],m['ivory'],.16,.035,root)
        g.rod('Bow load arch edge',(side*6.0,8.6,-29.07),(side*8.9,6.8,-29.07),.11,m['steel'],12,root)
        for z in [-28.0,-26.5,-25.0]:
            g.box('Bow docking sensor recess',(side*9.8,7.6,z),(.4,.28,.55),m['dark'],.03,root)
        for y in [4,5,6]:g.box('Bow approach lamp',(side*8.93,y,-29.18),(.10,.22,.08),m['mint'],.01,root)
    g.prism('Continuous loading arch crown',[(-6.2,-29.05),(6.2,-29.05),(6.45,-28.2),(-6.45,-28.2)],8.62,9.48,m['dark'],.075,root)
    g.prism('Loading arch crown armour',[(-6.0,-29.08),(6.0,-29.08),(6.2,-28.15),(-6.2,-28.15)],9.47,9.62,m['ivory'],.035,root)
    g.box('Loading approach illumination',(0,8.66,-29.12),(6.4,.075,.08),m['mint'],.01,root)
    return root

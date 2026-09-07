"""Meridian Atlas primary forms, outside the retained pressure-room envelope.

The shaped dorsal shell, swept load shoulders and protected loading mouth are
authored independently of the interior. Coordinates are metres, +Y up, -Z bow.
"""
from mathutils import Vector

SHOULDER_STATIONS=[(-20,11.8,7.55),(-12,13.2,8.55),(-2,15.2,8.9),(8,17.7,9.05),(16.8,14.7,8.6)]


def _shoulder_frame(side,z,y):
    a,b=next((a,b) for a,b in zip(SHOULDER_STATIONS,SHOULDER_STATIONS[1:]) if a[0]<=z<=b[0])
    t=(z-a[0])/(b[0]-a[0]);outer=a[1]+(b[1]-a[1])*t;top=a[2]+(b[2]-a[2])*t
    v=Vector((-side*.65,top-.45-6.9,0)).normalized()
    u=Vector((side*(b[1]-a[1])/(b[0]-a[0]),0,1)).normalized()
    n=v.cross(u).normalized()
    if n.x*side<0:n=-n
    u=n.cross(v).normalized()
    centre=Vector((side*(outer-.65*(y-6.9)/(top-.45-6.9)),y,z))
    return centre,u,v,n


def _fitted_panel(g,name,centre,u,v,width,height,material,parent,thickness=.10):
    return g.panel(name,[tuple(centre+u*x+v*y) for x,y in
                        [(-width/2,-height/2),(width/2,-height/2),(width/2,height/2),(-width/2,height/2)]],
                   material,thickness,.025,parent)


def _plate(g,m,name,points,parent,material='ivory',inset=.93,offset=.075):
    points=[Vector(p) for p in points]
    # Each stock plate must be planar. A warped quad can triangulate across a
    # different diagonal than its host and cut through it at grazing angles.
    if len(points)==4:
        plane=(points[1]-points[0]).cross(points[2]-points[0]).normalized()
        if abs(plane.dot(points[3]-points[0]))>.005:
            return [_plate(g,m,name,triangle,parent,material,inset,offset)
                    for triangle in ((points[0],points[1],points[2]),
                                     (points[0],points[2],points[3]))]
    centre=sum(points,Vector())/len(points)
    normal=(points[1]-points[0]).cross(points[2]-points[0]).normalized()
    outward=Vector((centre.x,centre.y-8,0))
    if normal.dot(outward)<0:normal=-normal
    inset_points=[tuple(centre+(p-centre)*inset+normal*offset) for p in points]
    return g.panel(name,inset_points,m[material],.12,.025,parent)


def build_load_shoulder(g,m,parent,side):
    root=g.empty('PortLoadShoulder' if side<0 else 'StarboardLoadShoulder',parent=parent)
    # z, outer width, top height. The chine swells behind the front hardpoints,
    # then sweeps inward toward the drive instead of forming a parallel shelf.
    stations=SHOULDER_STATIONS
    rings=[]
    for z,outer,top in stations:
        rings.append([(side*x,y,z) for x,y in
            [(7.76,5.1),(outer-.95,5.7),(outer,6.9),(outer-.65,top-.45),(9.05,top),(7.76,8.85)]])
    for k,(a,b) in enumerate(zip(rings,rings[1:])):
        for i in range(6):
            j=(i+1)%6
            points=[a[i],a[j],b[j],b[i]]
            g.panel('Swept load shoulder structure',points,m['dark'],.16,.03,root)
            if i in (2,3):
                _plate(g,m,'Swept load shoulder armour',points,root,
                       'petrol' if i==2 and k==2 else 'ivory',.94,.10)
        # One exposed longitudinal load path links each shoulder into the hull.
        g.rod('Shoulder load spine',a[5],b[5],.13,m['steel'],10,root)
    g.panel('Forward shoulder closure',rings[0],m['dark'],.14,.025,root)
    g.panel('Aft shoulder closure',rings[-1],m['dark'],.14,.025,root)
    # Flat S3 foundation remains at its authoritative existing mating plane.
    g.prism('Dorsal hardpoint load pad',[(side*x,z) for x,z in
            [(9.55,-11),(12.9,-10.3),(13.0,-7.5),(9.55,-7.1)]],
            8.25,8.42,m['dark'],.05,root)
    # Purposeful radiator banks on the aft half, with sparse real fins.
    for z in (4.5,11.4):
        c,u,v,n=_shoulder_frame(side,z,7.5);c+=n*.23
        _fitted_panel(g,'Shoulder radiator plenum',c,u,v,2.5,.98,m['dark'],root)
        for j in range(7):
            p=c+u*(-1.05+j*.35)+n*.14
            g.panel('Shoulder radiator fin',[tuple(p-v*.38),tuple(p+v*.38),tuple(p+v*.38+n*.15),tuple(p-v*.38+n*.15)],m['steel'],.035,0,root)
        _fitted_panel(g,'Shoulder navigation lamp',c+v*.60+n*.035,u,v,.72,.07,m['mint'],root,.025)
    for z in (-8.2,14.5):
        c,u,v,n=_shoulder_frame(side,z,7.55);c+=n*.24
        _fitted_panel(g,'Fitted attitude-jet plate',c,u,v,1.60,.94,m['steel'],root)
        for dz in (-.48,0,.48):
            p=c+u*dz
            g.rod('RCS dark nozzle throat',p+n*.04,p+n*.23,.145,m['rubber'],12,root)
            ring=g.ring('RCS nozzle lip',tuple(p+n*.25),.165,.025,m['dark'],'y',root)
            ring.rotation_mode='QUATERNION';ring.rotation_quaternion=Vector(g.xyz(n)).to_track_quat('Z','Y')
        _fitted_panel(g,'RCS caution tab',c+v*.43+n*.08,u,v,.76,.075,m['warning'],root,.025)
    return root


def build_dorsal_shell(g,m,parent):
    root=g.empty('MeridianDorsalShell',parent=parent)
    # z, half-width at the roof, shoulder, root, roof height, shoulder height.
    # All pressure-room walls/ceilings stay inside this hollow outer shell.
    stations=[(-17.8,6.65,7.80,8.55,13.67,13.42),
              (-11.0,6.55,7.80,8.85,13.67,13.42),
              (-10.8,6.55,7.80,8.90,13.35,13.10),
              (3.0,6.25,7.80,9.15,13.35,13.10),
              (9.0,4.30,7.90,10.45,14.70,13.30),
              (13.0,4.30,7.90,9.55,14.70,13.30),
              (17.8,6.25,7.65,8.25,14.10,13.10)]
    for side in (-1,1):
        rings=[]
        for z,rw,sw,bw,height,shoulder_height in stations:
            rings.append([(side*bw,9.35,z),(side*sw,shoulder_height,z),
                          (side*rw,height,z),(0,height+.08,z)])
        for k,(a,b) in enumerate(zip(rings,rings[1:])):
            for i in range(3):
                points=[a[i],a[i+1],b[i+1],b[i]]
                # Split bent quads deliberately; avoid an implicit ngon diagonal.
                for triangle in ([points[0],points[1],points[2]],
                                 [points[0],points[2],points[3]]):
                    g.panel('Dorsal continuous pressure armour',triangle,m['dark'],.14,0,root)
                if i>0:
                    _plate(g,m,'Dorsal shaped ceramic cap',points,root,'ivory',.965,.105)
                elif k in (2,4):
                    # Fit the whole rectangular panel to one host triangle.
                    # Its corners cannot cut across the quad's bent diagonal.
                    a0,a1,a2=[Vector(p) for p in points[:3]]
                    normal=(a1-a0).cross(a2-a0).normalized()
                    if normal.x*side<0:normal=-normal
                    u=(a2-a1).normalized();v=normal.cross(u).normalized()
                    centre=(a0+a1+a2)/3+normal*.22
                    _fitted_panel(g,'Dorsal engineering access cover',centre,u,v,3.2,1.1,m['petrol'],root)
                    for sign in (-1,1):
                        p=centre+u*sign*.55+normal*.12
                        g.rod('Dorsal access cover handle',p-v*.20,p+v*.20,.035,m['steel'],6,root)
                # A single exposed seam follows the major transition, not a
                # repeated carriage-frame rhythm along every upper compartment.
                if i==1:g.rod('Dorsal armour return',a[1],b[1],.075,m['steel'],8,root)
        # Two raked frames visibly connect the pressure casing to the shoulder
        # load paths. The forward frame lands behind the fixed S3 mounting pad.
        for z,top_y,bottom_x in [(-11.8,13.30,12.05),(8.8,13.30,14.1)]:
            aft=2.2 if z<0 else 0
            points=[(side*8.08,top_y,z-.60),(side*8.08,top_y,z+.60),
                    (side*bottom_x,8.78,z+5.00+aft),(side*bottom_x,8.78,z+3.10+aft)]
            g.panel('Raked upper load buttress',points,m['dark'],.46,.065,root)
            _plate(g,m,'Buttress ceramic return',points,root,'ivory',.80,.30)
    return root


def build_bow_deck(g,m,parent):
    root=g.empty('MeridianBowCarapace',parent=parent)
    # Fill the structural transition behind the loading arch. Its underside
    # remains above the 8.8 m loading aperture; the front ramp sweep stays clear.
    g.panel('Loading arch to flight deck bridge',
            [(-6.1,9.64,-28.2),(6.1,9.64,-28.2),(4.9,9.48,-25.8),(-4.9,9.48,-25.8)],
            m['ivory'],.16,.035,root)
    for side in (-1,1):
        g.panel('Loading bow structural return',
                [(side*6.1,9.55,-28.2),(side*8.9,7.78,-28.2),
                 (side*10.4,7.9,-23.5),(side*7.45,9.5,-17.8),
                 (side*4.95,9.48,-25.8)],m['dark'],.18,.025,root)
    return root

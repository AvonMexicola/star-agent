"""Nomad: original compact expedition tender, rebuilt around its boardable cabin."""
import math
import bpy


def build_hull(api):
    xyz, finish, box, rod, ring, poly, surface, label = (api[k] for k in ['xyz','finish','box','rod','ring','poly','surface','label'])
    ivory, dark, metal, teal, orange, rubber, mint, amber, engine = (api[k] for k in ['ivory','dark','metal','teal','orange','rubber','mint','amber','engine'])
    layout=api['LAYOUT']
    def loft(name, x, y, sections, mat, sides=8, bevel=.045):
        vertices=[]
        for z, rx, ry in sections:
            vertices.extend(xyz((x+math.cos((i+.5)*math.tau/sides)*rx,y+math.sin((i+.5)*math.tau/sides)*ry,z)) for i in range(sides))
        faces=[tuple(range(sides-1,-1,-1)),tuple(range((len(sections)-1)*sides,len(sections)*sides))]
        for j in range(len(sections)-1):
            faces.extend((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i) for i in range(sides))
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
        obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
        bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');obj.select_set(False)
        return finish(obj,name,mat,bevel)

    # The habitation shell is a tapered eight-sided pressure body, left hollow.
    sections=[(-1.80,.87,3.63),(-.70,1.0,3.94),(1.57,1.0,3.96),(3.00,.95,3.77),(4.09,.85,3.67)]
    for side in [-1,1]:
        for j in range(len(sections)-1):
            z0,w0,h0=sections[j];z1,w1,h1=sections[j+1]
            profile=lambda w,h:[(side*.83*w,h),(side*1.60*w,h-.16),(side*2.31*w,2.82),(side*2.36*w,1.68),(side*1.86*w,.96)]
            a,b=profile(w0,h0),profile(w1,h1)
            for i in range(4):
                points=[(*a[i],z0),(*a[i+1],z0),(*b[i+1],z1),(*b[i],z1)]
                surface('Habitation / tapered pressure shell',points,dark if i==3 else ivory,.075)
            if side == 1:
                surface('Habitation / crown',[(-.83*w0,h0,z0),(.83*w0,h0,z0),(.83*w1,h1,z1),(-.83*w1,h1,z1)],ivory,.075)
    # A short, armored forward cell; windows are enclosed by deep cheek panels.
    poly('Forebody / impact keel',[(-1.98,-3.93),(-1.70,-4.92),(-1.08,-5.24),(1.08,-5.24),(1.70,-4.92),(1.98,-3.93)],1.69,.70,dark,.075)
    # The exterior nose keeps its height; a real inboard recess sits behind the
    # complete MFD faces and their lower sight rays from the original pilot eye.
    poly('Forebody / recessed nose',[(-1.94,-4.05),(-1.65,-4.97),(-1.07,-5.22),(1.07,-5.22),(1.65,-4.97),(1.94,-4.05),(1.48,-4.05),(1.42,-4.48),(-1.42,-4.48),(-1.48,-4.05)],2.075,.51,ivory,.045)
    poly('Forebody / anti-glare brow',[(-1.44,-4.49),(-1.56,-4.87),(1.56,-4.87),(1.44,-4.49)],2.092,.028,dark,.01)
    box('Forebody / navigation aperture',(0,1.57,-5.265),(1.43,.16,.04),rubber,.025)
    for side in [-1,1]:
        box('Forebody / landing lamp',(side*.60,1.60,-5.29),(.26,.075,.025),mint,.012)
        rod('Canopy / raked pillar',(side*1.60,2.09,-4.84),(side*1.60,3.34,-3.98),.078,dark)
        rod('Canopy / upper perimeter',(side*1.60,3.34,-3.98),(side*1.84,3.59,-2.48),.068,ivory)
        rod('Canopy / rear post',(side*1.84,2.19,-2.44),(side*1.84,3.59,-2.48),.060,dark)
        rod('Canopy / window belt',(side*1.60,2.09,-4.84),(side*1.84,2.19,-2.44),.057,dark)
        surface('Forebody / armored cheek',[(side*1.60,2.09,-4.84),(side*1.84,2.19,-2.44),(side*2.00,1.59,-1.66),(side*1.89,1.04,-1.80),(side*1.79,1.04,-4.37)],ivory,.10)
        surface('Cockpit / solid rear quarter',[(side*1.84,2.19,-2.44),(side*1.84,3.59,-2.48),(side*1.92,3.48,-1.64),(side*2.05,2.69,-1.24),(side*2.00,1.59,-1.66)],ivory,.11)
        surface('Cockpit / upper armor cheek',[(side*1.60,3.34,-3.98),(side*1.84,3.59,-2.48),(side*1.64,3.83,-1.83),(side*1.36,3.55,-4.04)],ivory,.10)
        surface('Cockpit / sealed rear roof shoulder',[(side*1.64,3.83,-1.83),(side*1.84,3.59,-2.48),(side*1.92,3.48,-1.64),(side*1.59,3.69,-.92)],ivory,.11)
        # Recessed maintenance doors follow the curved flank, not a row of windows.
        surface('Habitation / long service recess',[(side*2.355,1.82,-.49),(side*2.326,2.60,-.42),(side*2.326,2.60,1.26),(side*2.355,1.82,1.30)],dark,.008)
        surface('Habitation / service panel',[(side*2.367,1.91,-.32),(side*2.341,2.48,-.25),(side*2.341,2.48,1.08),(side*2.367,1.91,1.12)],teal,.010)
        # A broad rising root makes habitation and drive shoulders one mass.
        mirror=lambda points:[(side*x,z) for x,z in points]
        poly('Drive bridge / structural root',mirror([(1.92,-2.02),(2.57,-2.11),(3.59,-.89),(3.93,1.97),(3.39,3.31),(1.95,3.83)]),2.22,.76,dark,.08)
        # These rails share the drive cowl's longitudinal stations and top edge.
        # One fitted chamfer replaces the former thick, floating shoulder shelf.
        shoulder=[(-1.63,1.90,3.48,.73),(-.61,1.59,3.77,.98),(.93,1.59,3.78,.98),(1.89,1.587,3.72,.93),(2.76,1.57,3.58,.73)]
        for a,b in zip(shoulder,shoulder[1:]):
            z0,x0,y0,r0=a;z1,x1,y1,r1=b
            surface('Drive bridge / fitted shoulder',[(side*x0,y0,z0),(side*3.26,2.169+r0,z0),(side*3.26,2.169+r1,z1),(side*x1,y1,z1)],ivory,.040)
        surface('Drive bridge / forward closure',[(side*1.84,2.19,-2.44),(side*1.84,3.59,-2.48),(side*1.90,3.48,-1.63),(side*3.26,2.899,-1.63),(side*2.74,2.11,-1.83)],dark,.050)
        surface('Drive bridge / aft closure',[(side*1.57,3.58,2.76),(side*3.26,2.899,2.76),(side*3.26,2.82,3.00),(side*1.96,3.17,3.64)],ivory,.04)
        # One flared main housing tapers from intake to a smaller exhaust throat.
        x=side*3.26
        loft('Drive / continuous core',x,2.12,[(-2.09,.47,.49),(-1.70,.73,.72),(-.56,1.01,.98),(1.83,1.03,.96),(2.88,.79,.78),(3.43,.61,.62)],dark,sides=10)
        loft('Drive / swept ceramic shoulder',x,2.15,[(-1.63,.73,.73),(-.61,1.015,.98),(.93,1.04,.98),(1.89,.99,.93),(2.76,.75,.73)],ivory,sides=10,bevel=.04)
        loft('Drive / recessed intake surround',x,2.12,[(-2.10,.50,.52),(-1.97,.55,.57),(-1.74,.64,.66)],metal,sides=10,bevel=.02)
        loft('Drive / intake darkness',x,2.12,[(-2.115,.41,.43),(-2.11,.41,.43)],rubber,sides=10,bevel=0)
        for i in range(4):
            box('Drive / recessed intake stator',(x,1.88+i*.15,-2.125),(.62,.020,.022),metal,.003)
        # Small canted stabilizers are continuous extensions of the drive haunch.
        poly('Stabilizer / blended structural haunch',mirror([(3.66,.47),(4.12,.95),(4.88,2.55),(4.68,3.46),(3.54,2.94)]),1.89,.30,dark,.04)
        surface('Stabilizer / swept lifting skin',[(side*3.79,2.13,.78),(side*4.08,2.11,1.16),(side*4.82,2.31,2.61),(side*4.60,2.45,3.41),(side*3.76,2.20,2.79)],ivory,.12)
        rod('Stabilizer / position light',(side*4.70,2.38,2.82),(side*4.64,2.42,3.12),.026,mint if side>0 else amber,8)
        # Hollow nozzle: rings surround an open throat instead of a solid cylinder cap.
        verts=[];faces=[];segments=32
        for z,radius in [(3.38,.60),(4.00,.63),(4.00,.54),(3.42,.47)]:
            verts.extend(xyz((x+math.cos(i*math.tau/segments)*radius,2.12+math.sin(i*math.tau/segments)*radius,z)) for i in range(segments))
        for row in range(3):
            faces.extend((row*segments+i,row*segments+(i+1)%segments,(row+1)*segments+(i+1)%segments,(row+1)*segments+i) for i in range(segments))
        mesh=bpy.data.meshes.new('Drive / hollow nozzle');mesh.from_pydata(verts,[],faces);mesh.update();obj=bpy.data.objects.new('Drive / hollow nozzle',mesh);bpy.context.collection.objects.link(obj);finish(obj,obj.name,dark,.006)
        for z,r,t in [(3.49,.61,.045),(3.79,.64,.047),(4.02,.62,.045)]:ring('Drive / nozzle lip',(x,2.12,z),r,t,metal)
        rod('Drive / recessed luminous throat',(x,2.12,3.51),(x,2.12,3.53),.48,engine,24)
        # Four articulated feet and root fairings carry the wider shoulder masses.
        for z in [-2.50,2.87]:
            box('Gear / root fairing',(side*2.35,1.05,z),(.55,.35,.78),dark,.08)
            leg=next(leg for leg in layout['gear']['legs'] if leg['pivot'][0]*side>0 and leg['pivot'][2]==z)
            before=set(bpy.context.scene.objects)
            rod('Gear / trailing arm',(side*2.28,1.02,z),(side*2.96,.27,z+.17),.115,dark,12)
            rod('Gear / hydraulic piston',(side*2.55,.94,z+.35),(side*2.96,.29,z+.18),.063,metal,12)
            box('Gear / broad landing sole',(side*2.98,.075,z+.18),(.78,.15,1.06),rubber,.035)
            box('Gear / sculpted shoe',(side*2.98,.19,z+.18),(.66,.14,.88),metal,.045)
            box('Gear / caution inset',(side*2.98,.266,z+.18),(.37,.010,.49),teal,.003)
            parts=set(bpy.context.scene.objects)-before
            bpy.ops.object.empty_add(type='PLAIN_AXES',location=xyz(leg['pivot']));pivot=bpy.context.object;pivot.name=leg['name']
            pivot['kind']='landingGear';pivot['deployedContactY']=0
            for obj in parts:obj.parent=pivot;obj.matrix_parent_inverse=pivot.matrix_world.inverted()
        # Loading portal armor wraps the aperture with angled shoulders.
        surface('Portal / flat handle land',[(side*.94,1.02,4.15),(side*.94,3.49,4.15),(side*1.47,3.49,4.15),(side*1.47,1.02,4.15)],ivory,.10)
        surface('Portal / angled outer cheek',[(side*1.47,1.22,4.15),(side*1.99,1.22,3.83),(side*1.99,3.20,3.83),(side*1.47,3.20,4.15)],ivory,.09)
        box('Portal / recessed handhold',(side*1.30,2.37,4.21),(.22,.84,.035),dark,.045)
        rod('Portal / boarding grab bar',(side*1.30,2.05,4.24),(side*1.30,2.66,4.24),.033,metal,10)
        box('Portal / threshold beacon',(side*1.03,1.53,4.248),(.04,.31,.017),mint,.006)
    # Split crown follows the tapered shell. The small rear cassette houses hatch slats.
    surface('Canopy / forward roof',[(-1.36,3.55,-4.04),(1.36,3.55,-4.04),(1.64,3.83,-1.83),(-1.64,3.83,-1.83)],ivory,.10)
    surface('Canopy / rear roof transition',[(-1.64,3.83,-1.83),(1.64,3.83,-1.83),(1.59,3.77,-.60),(-1.59,3.77,-.60)],ivory,.09)
    rod('Canopy / continuous front brow',(-1.60,3.34,-3.98),(1.60,3.34,-3.98),.075,dark)
    surface('Roof / inset service spine',[(-.40,3.972,-.63),(.40,3.972,-.63),(.43,3.99,1.58),(-.43,3.99,1.58)],dark,.045)
    box('Portal / hatch cassette',(0,3.86,3.99),(2.01,.35,.40),dark,.075)
    identity=api['IDENTITY']
    label('Portal / vessel identity',' '.join(identity['name'].upper())+'  /  '+' '.join(identity['revision']),(0,3.79,4.205),.13,ivory,(math.pi/2,0,0))

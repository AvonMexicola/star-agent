"""Sealed, armoured wedge flight deck. All coordinates are game-space metres.
The pressure faces share their boundary vertices; glazing fills apertures rather
than floating above the floor. Decorative armour is separate from containment.
"""
from mathutils import Vector


def build_bridge_shell(g, m, parent):
    root=g.empty('PressureBridge',parent=parent)
    # Forward section rakes 2.7 m from low nose to brow; the aft ring joins
    # the rectangular crew-deck pressure shell behind the flight stations.
    front=[(-4.9,9.30,-25.9),(4.9,9.30,-25.9),(4.9,10.80,-25.4),
           (4.1,12.60,-23.8),(3.7,13.25,-23.2),(-3.7,13.25,-23.2),
           (-4.1,12.60,-23.8),(-4.9,10.80,-25.4)]
    back=[(-7.43,9.30,-17.8),(7.43,9.30,-17.8),(7.43,10.80,-17.8),
          (7.1,12.60,-17.8),(6.65,13.40,-17.8),(-6.65,13.40,-17.8),
          (-7.1,12.60,-17.8),(-7.43,10.80,-17.8)]

    def panel(name, points, material, thickness=.14):
        return g.panel(name,points,material,thickness,0,root)

    def window(name, polygon, inset):
        centre=sum((Vector(p) for p in polygon),Vector())/len(polygon)
        inner=[tuple(centre+(Vector(p)-centre)*inset) for p in polygon]
        for i in range(len(polygon)):
            j=(i+1)%len(polygon)
            panel(name+' armoured reveal',[polygon[i],polygon[j],inner[j],inner[i]],m['dark'],.20)
            g.rod(name+' double lip seal',inner[i],inner[j],.063,m['rubber'],12,root)
        panel(name+' laminated glazing',inner,m['glass'],.018)
        return inner

    # The front is three continuous pressure bands, not a panoramic ferry band.
    panel('Flight deck lower pressure skirt',[front[i] for i in [0,1,2,7]],m['ivory'],.20)
    window('Forward trapezoid canopy',[front[i] for i in [7,2,3,6]],.78)
    panel('Swept armoured brow',[front[i] for i in [6,3,4,5]],m['ivory'],.22)
    # Closed bottom and roof; side facets are deliberately triangulated so a
    # bent six-sided ngon cannot create misleading planar shading.
    panel('Flight deck pressure sole',[front[0],front[1],back[1],back[0]],m['dark'],.18)
    panel('Flight deck roof',[front[5],front[4],back[4],back[5]],m['dark'],.18)
    for side, indices in [(-1,(0,7,6,5)),(1,(1,2,3,4))]:
        low,waist,shoulder,top=indices
        panel('Flight deck solid lower cheek',[front[low],front[waist],back[waist],back[low]],m['dark'],.18)
        # One small triangular side pane per side; the remaining flank is armour.
        panel('Canopy solid forward cheek',[front[waist],front[shoulder],back[waist]],m['ivory'],.18)
        window('Angular quarter canopy',[front[shoulder],back[shoulder],back[waist]],.50)
        panel('Flight deck shoulder facet A',[front[shoulder],front[top],back[top]],m['ivory'],.16)
        panel('Flight deck shoulder facet B',[front[shoulder],back[top],back[shoulder]],m['ivory'],.16)
        # Pressure transition to the crew deck's rectangular upper corners.
        corner=(side*7.55,13.40,-17.8)
        panel('Aft canopy corner closure',[back[waist],back[shoulder],back[top],corner],m['dark'],.18)
        # Perimeter load beams and recessed fasteners establish construction.
        for a,b in [(front[low],front[waist]),(front[waist],back[waist]),(front[top],back[top])]:
            g.rod('Canopy structural edge beam',a,b,.085,m['steel'],12,root)
        for t in [.18,.40,.62,.84]:
            a=Vector(front[shoulder]).lerp(Vector(back[shoulder]),t)
            b=a+Vector((side*.08,.02,0))
            g.rod('Canopy retained fastener',a,b,.035,m['dark'],6,root)
        g.box('Canopy service status',(side*5.40,11.0,-20.0),(.08,.08,.62),m['mint'],.01,root)
    # Vertical pressure header joins the taller bridge roof to the lower crew liner.
    panel('Bridge aft pressure header',[(-7.55,13.1,-17.8),(7.55,13.1,-17.8),(7.55,13.4,-17.8),(-7.55,13.4,-17.8)],m['dark'],.20)
    # Front visor is a shaped ridge with a manufactured lip, not a flat slab.
    g.rod('Canopy upper crash beam',front[6],front[3],.115,m['dark'],16,root)
    g.rod('Canopy lower crash beam',front[7],front[2],.10,m['dark'],16,root)
    g.box('Flight deck forward recognition strip',(0,12.91,-23.47),(2.2,.065,.065),m['mint'],.012,root)
    root['role']='sealed-flight-deck';root['windowStyle']='recessed-raked-trapezoid'
    return root

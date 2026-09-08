"""Six retractable load legs in real pockets outside the pressure vessel.

Layout names and hinge coordinates are shared with AtlasMarkIISystems. Geometry
is authored deployed; the runtime folds each leg longitudinally, counter-levels
its pad and closes the two pocket doors only after the load leg clears them.
"""
import math


def build_landing_gear(g,m,ship,layout):
    for gear in layout['landingGear']['legs']:
        x,y,z=gear['pivot'];sign=gear['foldSign']
        bay=g.empty(gear['bayNode'],parent=ship)
        z0,z1=gear['pocketZ'];mid=(z0+z1)/2
        side=1 if x>0 else -1
        # These are hollow load pockets: no closed box occupies the leg sweep.
        for dx in (-1.68,1.68):
            g.box('Gear pocket cheek',(x+dx,4.25,mid),(.14,1.06,z1-z0),m['dark'],.04,bay)
            g.box('Gear pocket edge return',(x+dx,3.71,mid),(.21,.10,z1-z0),m['steel'],.03,bay)
        for end in (z0,z1):
            g.box('Gear pocket end diaphragm',(x,4.25,end),(3.5,1.06,.14),m['dark'],.04,bay)
        g.box('Gear pocket roof',(x,4.85,mid),(3.5,.14,z1-z0),m['dark'],.04,bay)
        # The pivot bears into the outboard end of an existing chassis frame.
        g.rod('Gear transverse load pin',(x-.9,y,z),(x+.9,y,z),.23,m['steel'],12,bay)
        g.rod('Gear frame lower tie',(side*7.45,1.98,z),(side*7.76,1.98,z),.20,m['dark'],12,bay)
        g.box('Gear frame vertical load web',(side*7.76,3.10,z),(.14,2.20,.72),m['dark'],.02,bay)
        g.rod('Gear frame upper tie',(side*7.76,y,z),(x-side*.80,y,z),.22,m['dark'],12,bay)
        for dx in (-.85,.85):
            g.box('Gear trunnion bearing',(x+dx,y,z),(.28,.72,.88),m['dark'],.07,bay)
        for door in gear['doors']:
            hinge=g.empty(door['node'],door['pivot'],ship)
            hx,hy,hz=door['pivot'];inward=door['inward']
            g.box('Gear pocket closing leaf',(hx+inward*.80,hy,hz),(1.58,.12,z1-z0-.25),m['ivory'],.035,hinge)
            g.rotate_game(hinge,(0,0,door['openAngle']))
            hinge['role']='landing-gear-door'
        root=g.empty(gear['node'],gear['pivot'],ship)
        g.rod('Gear upper load barrel',(x,y-.1,z),(x,1.92,z),.35,m['dark'],12,root)
        g.rod('Gear polished oleo',(x,2.62,z),(x,.59,z),.205,m['steel'],12,root)
        g.rod('Gear dust seal',(x,1.92,z),(x,1.80,z),.38,m['rubber'],12,root)
        for dx in (-.36,.36):
            g.rod('Gear torque link upper',(x+dx,2.25,z),(x+dx,1.49,z-sign*.46),.085,m['steel'],8,root)
            g.rod('Gear torque link lower',(x+dx,1.49,z-sign*.46),(x+dx,.74,z),.085,m['dark'],8,root)
        g.rod('Gear foot cross pin',(x-.8,.56,z),(x+.8,.56,z),.14,m['steel'],8,root)
        # Counter-rotation belongs at the cross pin, not at the sole centre;
        # otherwise the pin and its clevis separate as the load leg folds.
        foot=g.empty(gear['footNode'],(x,gear['padPivotY'],z),root)
        g.box('Landing load pad',(x,.21,z),(2.7,.30,3.3),m['dark'],.07,foot)
        g.box('Landing contact sole',(x,.03,z),(2.52,.06,3.12),m['rubber'],0,foot)
        for dx in (-.96,.96):
            g.box('Pad replaceable wear rail',(x+dx,.39,z),(.13,.10,2.7),m['steel'],0,foot)
        for dx in (-.5,.5):
            g.box('Pad bearing clevis',(x+dx,.46,z),(.19,.30,.72),m['dark'],.035,foot)
        root['role']='landing-gear-leg';root['foldSign']=sign
        foot['role']='counter-levelled-landing-pad'

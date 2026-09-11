"""Original aft Sentry conversion of the Burrow chassis. No source asset copies.
Run blender -b -t 4 --python blender/build_mining_rover.py -- --sentry, then
python3 blender/pack_mining_rover.py --sentry. All helpers use metres/Y up/-Z.
"""
import math

def build_turret(*, g, box, rod, panel, ring, text, root, light, amber, glass):
    root['model']='Burrow Sentry S-04'
    root['variant']='sentry'
    # Both mineral cassettes and front cutters are absent. Rear frame carries a
    # small sealed operator capsule, with a separate aft door and fixed steps.
    box('Gunner footwell',(0,1.08,1.43),(1.58,.12,1.35),1,.025)
    for side in (-1,1):
        box('Gunner pressure side',(side*.80,1.85,1.41),(.07,1.50,1.28),0,.025)
        box('Gunner side inset',(side*.843,1.82,1.39),(.016,.92,.91),4,.018)
        for z in (1.0,1.80):
            box('Gunner service latch',(side*.86,1.86,z),(.02,.17,.09),2,.007)
        rod('Aft shoulder rail',(side*.73,2.58,.82),(side*.73,2.58,2.02),.026,2)
        box('Aft door jamb',(side*.69,1.86,2.06),(.21,1.53,.09),0,.021)
    box('Gunner roof',(0,2.61,1.43),(1.59,.12,1.38),0,.025)
    box('Aft hatch header',(0,2.58,2.06),(1.29,.13,.09),0,.02)
    door=g.empty('GunnerDoor',(.57,1.10,2.07),root)
    box('Gunner door seal',(0,1.83,2.078),(1.13,1.41,.028),3,.012,parent=door)
    box('Gunner hatch skin',(0,1.83,2.101),(1.05,1.35,.039),0,.025,parent=door)
    box('Gunner hatch inset',(0,1.88,2.126),(.84,.83,.015),4,.022,parent=door)
    rod('Aft hatch handle',(-.40,1.65,2.173),(-.40,1.92,2.173),.021,2,parent=door)
    for y in (1.28,2.38):rod('Gunner hatch hinge',(.58,y-.07,2.08),(.58,y+.07,2.08),.037,2)
    for z,y in ((2.49,.22),(2.33,.48),(2.18,.75),(2.08,1.05)):
        box('Aft climbing tread',(0,y,z),(.79,.05,.24),2,.012)
        for x in (-.28,-.14,0,.14,.28):box('Aft grip rib',(x,y+.028,z),(.028,.009,.20),3,.002)
    for side in (-1,1):
        rod('Aft ladder spine',(side*.35,.18,2.52),(side*.35,1.12,2.02),.031,2)
        rod('Aft grab rail',(side*.59,1.20,2.22),(side*.59,2.22,2.22),.024,2)
    box('Gunner seat plinth',(0,1.26,1.38),(.44,.28,.43),1,.022)
    box('Gunner seat cushion',(0,1.47,1.40),(.59,.13,.53),3,.035)
    box('Gunner seat back',(0,1.78,1.76),(.60,.56,.14),3,.03)
    box('Gunner head restraint',(0,2.19,1.80),(.34,.23,.12),1,.02)
    for side in (-1,1):
        rod('Gunner safety harness',(side*.16,2.06,1.66),(side*.23,1.51,1.31),.023,4)
        box('Flat gunner control pad',(side*.36,1.60,1.17),(.20,.035,.40),1,.018)
        box('Gunner pad touch face',(side*.36,1.621,1.16),(.15,.008,.31),mat=light,bevel=.01)
    box('Gunner screen backing',(0,1.99,.83),(.80,.46,.08),1,.022)
    screen=g.empty('GunnerDisplay',(0,1.99,.88),root)
    # Empty local axes survive glTF Y-up conversion; a plane's normal is +Z.
    screen['displayWidth']=.70;screen['displayHeight']=.36
    # The bearing and pitch trunnions are separate motion parents, so packing
    # can share materials without flattening the actual articulation contract.
    rod('Turret armored bearing',(0,2.67,1.36),(0,2.78,1.36),.51,2,n=32)
    rod('Turret bearing gasket',(0,2.779,1.36),(0,2.813,1.36),.475,1,n=32)
    yaw=g.empty('SentryYaw',(0,2.82,1.36),root)
    rod('Azimuth housing',(0,2.815,1.36),(0,2.895,1.36),.45,4,parent=yaw,n=32)
    for side in (-1,1):
        box('Pitch cradle cheek',(side*.405,3.04,1.40),(.12,.35,.53),0,.035,parent=yaw)
        rod('Pitch bearing',(side*.34,3.02,1.36),(side*.48,3.02,1.36),.125,2,parent=yaw,n=20)
    pitch=g.empty('SentryPitch',(0,3.02,1.36),yaw)
    box('Twin laser receiver',(0,3.02,1.44),(.68,.23,.47),1,.034,parent=pitch)
    box('Receiver armor',(0,3.165,1.45),(.61,.06,.40),0,.022,parent=pitch)
    box('Charge cassette',(0,3.01,1.78),(.49,.18,.17),4,.026,parent=pitch)
    for i in range(6):box('Receiver cooling fin',(0,3.177,1.30+i*.058),(.48,.025,.017),2,.003,parent=pitch)
    for side in (-1,1):
        x=side*.215
        # Hollow shroud, protected luminous optic recessed within its lip. The
        # runtime ray starts just outside the visible axial aperture.
        ring('Laser barrel shroud',(x,3.02,0),[(1.30,.105),(.48,.105),(.43,.084),(.43,.053),(1.30,.053)],tile=2,axis='Z',parent=pitch,segments=24)
        for z in (.58,.80,1.05):ring('Laser cooling collar',(x,3.02,z),[(-.031,.108),(.031,.108)],tile=1,axis='Z',parent=pitch,segments=20)
        rod('Laser emission optic',(x,3.02,.460),(x,3.02,.475),.047,mat=light,parent=pitch,n=20)
        muzzle=g.empty('SentryMuzzle_'+('Port' if side<0 else 'Starboard'),(x,3.02,.419),pitch)
        muzzle['axis']='-Z'
    rod('Turret sensor housing',(0,3.09,1.12),(0,3.09,.78),.092,1,parent=pitch,n=20)
    rod('Turret sensor glass',(0,3.09,.771),(0,3.09,.782),.069,mat=glass,parent=pitch,n=20)
    sight=g.empty('SentrySight',(0,3.10,.765),pitch)
    sight['axis']='-Z'
    text('Aft turret identity','SENTRY',(0,2.42,2.15),.105,(math.pi/2,0,0),parent=door)
    for side in (-1,1):box('Gunner ready lamp',(side*.69,2.45,2.12),(.071,.026,.025),mat=amber)

"""Original, game-scale GLB viewmodels. Built from procedural mesh parts, not copyrighted meshes."""
from pathlib import Path
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals
from trimesh.transformations import rotation_matrix

OUT=Path(__file__).resolve().parents[1]/'apps/client/public/assets/weapons'
OUT.mkdir(parents=True,exist_ok=True)
M={}
for name,rgb,metal,rough in [
 ('metal',(45,51,57),.82,.38),('slide',(71,78,84),.80,.32),('edge',(97,102,105),.78,.42),
 ('black',(20,24,28),.48,.75),('rubber',(48,52,51),.10,.87),('polymer',(61,67,63),.12,.70),
 ('olive',(86,92,67),.22,.72),('wood',(110,69,42),.06,.72),('wood_dark',(64,39,29),.06,.8),
 ('bronze',(111,93,66),.75,.38),('optic',(27,46,52),.38,.18),('glass',(33,78,93),.40,.16),
 ('fabric',(40,48,48),.04,.89),('glove',(58,58,53),.07,.86),('seam',(123,124,109),.23,.68),
 ('muzzle',(5,9,13),.8,.5),('red',(167,35,23),.22,.33),('tan',(151,132,103),.2,.68),
]:
    M[name]=PBRMaterial(name=name,baseColorFactor=list(rgb)+[255],metallicFactor=metal,roughnessFactor=rough,doubleSided=True)

class Model:
    def __init__(self,id): self.id=id; self.scene=trimesh.Scene();self.i=0
    def add(self,mesh,name,mat,transform=None):
        mesh.visual=TextureVisuals(material=M[mat])
        self.scene.add_geometry(mesh,node_name=f'{name}_{self.i:03}',geom_name=f'{name}_{self.i:03}',transform=transform)
        self.i+=1
    def box(self,name,pos,size,mat,tilt=0):
        mesh=trimesh.creation.box(extents=size)
        tr=np.eye(4);tr[:3,3]=pos
        if tilt:
            rot=rotation_matrix(tilt,[1,0,0]);rot[:3,3]=pos;tr=rot
        self.add(mesh,name,mat,tr)
    def cyl(self,name,pos,radius,length,mat,axis='z',sections=14):
        mesh=trimesh.creation.cylinder(radius=radius,height=length,sections=sections)
        tr=np.eye(4);tr[:3,3]=pos
        if axis=='x':tr=rotation_matrix(np.pi/2,[0,1,0]);tr[:3,3]=pos
        if axis=='y':tr=rotation_matrix(np.pi/2,[1,0,0]);tr[:3,3]=pos
        self.add(mesh,name,mat,tr)
    def bar(self,name,p1,p2,r,mat):
        v=np.array(p2)-np.array(p1)
        mesh=trimesh.creation.cylinder(radius=r,height=np.linalg.norm(v),sections=10)
        tr=trimesh.geometry.align_vectors([0,0,1],v)
        tr[:3,3]=(np.array(p1)+np.array(p2))/2
        self.add(mesh,name,mat,tr)
    def details(self,kind):
        # Articulated appearance: receiver seams, screw heads, raised rail, ejection port.
        long=kind not in ('p9','magnum')
        self.box('chamber_mark',(.058,.035,-.14),(.012,.043,.12),'black')
        self.box('charging_handle',(.09,.065,-.08),(.04,.035,.045),'edge')
        for z in ([-.2,-.35,-.52,-.66] if long else [-.1,-.19]):
            self.box('top_rail_slot',(0,.115,z),(.105,.019,.019),'edge')
        for z in ([-.14,-.26,-.37] if long else [-.13]):
            self.cyl('screw_L',(-.097,.01,z),.012,.010,'bronze','x',8)
            self.cyl('screw_R',(.097,.01,z),.012,.010,'bronze','x',8)
        self.box('trigger_guard',(0,-.195,-.06),(.13,.016,.16),'metal')
        self.box('trigger',(0,-.16,-.06),(.014,.073,.019),'edge',-.25)
        self.box('grip',(0,-.22,.04),(.095,.27,.11),'rubber',-.19)
        for side in (-1,1):
            for i in range(4):
                self.box('grip_checkering',(side*.050,-.15-i*.035,.045),(.004,.008,.07),'edge')

    def hands(self,kind):
        long=kind not in ('p9','magnum')
        lx=-.15 if long else -.125
        lz=-.52 if long else -.28
        self.box('sleeve_left',(lx,-.32,lz+.10),(.19,.22,.36),'fabric',-.10)
        self.box('palm_left',(lx,-.205,lz),(.16,.135,.20),'glove')
        self.box('sleeve_right',(.11,-.44,.15),(.20,.28,.40),'fabric',-.13)
        self.box('palm_right',(.073,-.29,.085),(.15,.13,.20),'glove',-.15)
        for i in range(3):
            self.box('finger_L',(lx-.048+i*.047,-.162,lz-.076),(.041,.044,.14),'glove',-.16)
            self.box('finger_R',(.03+i*.043,-.30,-.01),(.04,.055,.13),'glove',-.1)
        self.box('thumb_left',(lx+.091,-.17,lz+.018),(.065,.085,.08),'glove',.38)
        self.box('thumb_right',(-.034,-.265,.045),(.067,.065,.11),'glove',.23)
        # Stitches and knuckle protection detail
        for x in (-.11,-.06,-.01):self.box('knuckle_left',(x,-.123,lz-.052),(.037,.014,.055),'seam')


def pistol(m,magnum=False):
    if magnum:
        m.box('revolver_frame',(0,.02,-.18),(.16,.14,.27),'slide')
        m.cyl('six_chamber_cylinder',(0,.00,-.20),.110,.195,'edge','x',16)
        for i in range(6):
            a=i*np.pi/3
            m.cyl('cylinder_chamber',(.100,.081*np.cos(a),-.20+.081*np.sin(a)),.024,.009,'black','x',10)
        m.cyl('long_magnum_barrel',(0,.045,-.43),.059,.42,'metal')
        m.cyl('silver_barrel_liner',(0,.045,-.645),.042,.032,'edge')
        m.cyl('muzzle_dark',(0,.045,-.666),.027,.009,'muzzle')
        m.box('hammer',(0,.127,-.085),(.044,.083,.037),'edge',-.22)
        m.box('rear_sight',(0,.15,-.07),(.105,.033,.034),'black')
        m.box('front_sight',(0,.119,-.60),(.028,.036,.030),'black')
    else:
        m.box('pistol_lower',(0,-.022,-.19),(.148,.115,.32),'polymer')
        m.box('pistol_slide',(0,.071,-.19),(.154,.078,.37),'slide')
        m.cyl('threaded_muzzle',(0,.056,-.415),.040,.07,'black')
        m.cyl('bore',(0,.056,-.453),.020,.011,'muzzle')
        m.box('rear_sight',(0,.133,-.043),(.090,.038,.026),'black')
        m.box('tritium_front_sight',(0,.133,-.356),(.026,.040,.027),'edge')
        for z in [-.09,-.12,-.15,-.18]:
            m.box('slide_serration_L',(-.079,.079,z),(.006,.060,.009),'black')
            m.box('slide_serration_R',(.079,.079,z),(.006,.060,.009),'black')
        m.box('frame_rail',(0,-.088,-.28),(.10,.035,.125),'black')
    m.details('magnum' if magnum else 'p9')


def compact(m,uzi=False):
    if uzi:
        m.box('stamped_receiver',(0,.02,-.24),(.21,.23,.48),'metal')
        m.box('forward_sleeve',(0,.012,-.56),(.16,.16,.25),'black')
        m.cyl('uzi_muzzle',(0,.033,-.715),.044,.12,'edge')
        m.box('cocking_handle',(0,.164,-.18),(.060,.035,.055),'edge')
        # folding stock silhouette
        for x in [-.094,.094]:m.bar('wire_stock',(x,-.025,.02),(x,-.035,.36),.012,'metal')
        m.bar('folding_stock_cross',(-.11,-.035,.37),(.11,-.035,.37),.016,'edge')
        m.box('magazine_well',(0,-.19,-.16),(.095,.37,.13),'black',-.12)
        m.box('uzi_vertical_foregrip',(0,-.21,-.49),(.08,.25,.08),'rubber')
    else:
        m.cyl('mp5_receiver',(0,.02,-.21),.128,.42,'metal',sections=12)
        m.cyl('ribbed_handguard',(0,-.012,-.54),.10,.36,'polymer',sections=10)
        for i in range(7):m.cyl('handguard_ring',(0,-.012,-.39-i*.043),.105,.009,'black')
        m.cyl('mp5_barrel',(0,.01,-.76),.038,.18,'edge')
        m.box('mp5_poly_stock',(0,-.014,.19),(.15,.17,.30),'black')
        m.box('rear_sling_mount',(0,.01,.36),(.16,.055,.05),'edge')
        for i in range(4):m.box('curved_mag',(0,-.19-i*.062,-.22-i*.022),(.083,.072,.10),'black',-.12)
        m.cyl('ring_sight',(0,.15,-.69),.047,.020,'edge')
    m.details('uzi' if uzi else 'mp5')


def rifle(m,ak=False):
    m.box('upper_receiver',(0,.038,-.20),(.187,.20,.48),'metal')
    m.box('lower_receiver',(0,-.100,-.11),(.165,.16,.31),'olive' if ak else 'polymer')
    m.box('foreend',(0,.03,-.58),(.154,.15,.44),'wood' if ak else 'black')
    m.cyl('barrel_shroud',(0,.032,-.86),.043,.36,'edge')
    m.cyl('muzzle_device',(0,.032,-1.065),.058,.10,'black')
    m.cyl('muzzle_bore',(0,.032,-1.121),.026,.012,'muzzle')
    if ak:
        m.box('laminated_stock',(0,-.006,.28),(.12,.14,.40),'wood')
        m.box('stock_butt',(0,-.015,.49),(.13,.19,.055),'wood_dark')
        for i in range(5):m.box('curved_mag',(0,-.205-i*.062,-.25-i*.030),(.105,.074,.130),'black',-.21)
        m.cyl('gas_piston',(0,.145,-.71),.026,.61,'metal')
        m.box('charging_handle',(.13,.083,-.15),(.08,.034,.034),'edge')
        m.box('iron_rear',(0,.15,-.11),(.10,.044,.038),'black')
        m.box('iron_front',(0,.155,-.96),(.068,.075,.035),'black')
    else:
        m.cyl('buffer_tube',(0,.02,.23),.054,.35,'black')
        m.box('adjustable_stock',(0,-.024,.39),(.145,.16,.24),'polymer')
        m.box('stock_butt',(0,-.040,.53),(.16,.20,.052),'rubber')
        m.box('stanag_mag',(0,-.24,-.16),(.11,.28,.15),'olive',-.12)
        m.box('flat_top_rail',(0,.149,-.36),(.12,.025,.45),'edge')
        m.box('optic_base',(0,.180,-.25),(.10,.043,.14),'black')
        m.cyl('red_dot_optic',(0,.225,-.26),.055,.15,'black')
        m.cyl('optic_glass',(0,.225,-.346),.035,.009,'glass')
        m.box('angled_foregrip',(0,-.165,-.58),(.075,.22,.075),'black',-.15)
    for x in [-.076,.076]:
        for i in range(5):m.box('handguard_vent',(x,.032,-.43-i*.055),(.004,.046,.022),'edge')
    m.details('ak47' if ak else 'm4')


def lmg(m,pkm=False):
    m.box('heavy_receiver',(0,.03,-.18),(.27,.27,.65),'metal')
    m.box('receiver_cover',(0,.185,-.21),(.27,.055,.64),'edge')
    m.box('long_handguard',(0,.045,-.75),(.19,.19,.48),'wood' if pkm else 'black')
    m.cyl('heavy_barrel',(0,.040,-1.24),.065,.66,'slide')
    m.cyl('heat_shield',(0,.04,-.94),.085,.37,'black',sections=12)
    m.cyl('flash_hider',(0,.04,-1.63),.07,.14,'edge')
    m.cyl('barrel_bore',(0,.04,-1.71),.038,.013,'muzzle')
    m.box('heavy_buttstock',(0,-.035,.32),(.17,.22,.45),'wood' if pkm else 'polymer')
    m.box('buttpad',(0,-.037,.57),(.185,.24,.05),'rubber')
    if pkm:
        m.box('belt_case',(.24,-.14,-.12),(.28,.32,.33),'olive')
        for z in [-.25,-.21,-.17,-.13,-.09]:
            m.box('ammo_belt',(.11,.12,z),(.04,.056,.031),'bronze')
        m.bar('carry_handle',(-.09,.245,-.51),(-.09,.345,-.36),.021,'edge')
        m.bar('carry_grip',(-.09,.345,-.36),(.09,.345,-.36),.021,'rubber')
    else:
        m.box('ammo_box',(.05,-.245,-.21),(.32,.36,.37),'olive')
        m.box('ammo_box_latch',(.195,-.18,-.13),(.023,.09,.06),'edge')
        m.bar('carry_handle',(-.09,.22,-.49),(-.09,.38,-.31),.024,'edge')
        m.bar('carry_grip',(-.09,.38,-.31),(.09,.38,-.31),.024,'rubber')
    for x in [-.09,.09]:
        m.bar('bipod_leg',(x,.000,-1.12),(x*1.9,-.29,-1.32),.020,'edge')
    for i in range(5):m.box('vent_slit',(.099,.055,-.66-i*.054),(.006,.054,.021),'edge')
    m.details('pkm' if pkm else 'm249')

for wid in ['p9','magnum','uzi','mp5','m4','ak47','m249','pkm']:
    m=Model(wid)
    if wid in ('p9','magnum'):pistol(m,wid=='magnum')
    elif wid in ('uzi','mp5'):compact(m,wid=='uzi')
    elif wid in ('m4','ak47'):rifle(m,wid=='ak47')
    else:lmg(m,wid=='pkm')
    m.hands(wid)
    out=OUT/f'{wid}.glb'
    out.write_bytes(m.scene.export(file_type='glb'))
    # Round-trip basic geometry integrity.
    check=trimesh.load(out,force='scene')
    assert len(check.geometry)>30,(wid,len(check.geometry))
    print(wid,'parts',len(check.geometry),'bytes',out.stat().st_size)

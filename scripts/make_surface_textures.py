"""Generate original tileable-ish urban PBR maps: color, tangent normal, roughness."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
OUT=Path(__file__).resolve().parents[1]/'apps/client/public/assets/materials'
OUT.mkdir(parents=True,exist_ok=True)
R=np.random.default_rng(41986)
S=512

def maps(name, rgb, height, rough):
    height=np.clip(height,0,255).astype(np.float32)
    rough=np.clip(rough,0,255).astype(np.uint8)
    color=np.clip(rgb,0,255).astype(np.uint8)
    Image.fromarray(color,'RGB').save(OUT/f'{name}_albedo.jpg',quality=76,optimize=True,progressive=True)
    # derive tangent-space normal; gentle 3D relief
    gy,gx=np.gradient(height/255)
    nx=-gx*5;ny=-gy*5;nz=np.ones_like(nx)
    ln=np.sqrt(nx*nx+ny*ny+nz*nz)
    norm=np.stack([.5+nx/ln*.5,.5+ny/ln*.5,.5+nz/ln*.5],axis=2)
    Image.fromarray(np.uint8(np.clip(norm*255,0,255)),'RGB').save(OUT/f'{name}_normal.jpg',quality=82,optimize=True,progressive=True)
    Image.fromarray(rough,'L').save(OUT/f'{name}_roughness.jpg',quality=76,optimize=True,progressive=True)

fine=R.normal(0,14,(S,S));coarse=np.array(Image.fromarray(R.integers(0,256,(48,48),dtype=np.uint8)).resize((S,S),Image.Resampling.BILINEAR).filter(ImageFilter.GaussianBlur(1)),dtype=np.float32)-128
base=np.clip(34+fine*.52+coarse*.09,12,78)
# road abrasion, patched seam lines, oil stains
for y in range(S):
    if y%190 in range(2):base[y,:]*=.64
for _ in range(120):
    x,y=R.integers(0,S,2)
    size=int(R.integers(1,6));base[max(0,y-size):y+size,max(0,x-size):x+size]+=R.uniform(-24,15)
color=np.stack([base*.86,base*.98,base*1.03],axis=2)
rough=np.clip(193+fine*.9-coarse*.22,110,245)
maps('asphalt',color,base*3,rough)

fine=R.normal(0,19,(S,S));coarse=np.array(Image.fromarray(R.integers(30,220,(36,36),dtype=np.uint8)).resize((S,S),Image.Resampling.BILINEAR),dtype=np.float32)-115
base=105+fine*.6+coarse*.20
# staining, water tracks
for x in range(28,S,130):base[:,x:x+2]-=15
color=np.stack([base*.90,base*.98,base*1.02],axis=2)
rough=np.clip(215+fine*.55,120,245)
maps('concrete',color,base*2,rough)

fine=R.normal(0,11,(S,S));coarse=np.array(Image.fromarray(R.integers(0,256,(24,24),dtype=np.uint8)).resize((S,S),Image.Resampling.BILINEAR),dtype=np.float32)-128
base=106+fine*.6+coarse*.19
joints=np.zeros((S,S),dtype=bool)
brick_w=128;brick_h=64
for y in range(S):
    row=y//brick_h
    joints[y,:]=(y%brick_h<3)
    offset=(row%2)*(brick_w//2)
    for x in range(S):
        if ((x+offset)%brick_w)<3:joints[y,x]=True
r=np.where(joints,40,base*1.18);g=np.where(joints,44,base*.79);b=np.where(joints,44,base*.66)
color=np.stack([r,g,b],axis=2)
height=np.where(joints,30,base*1.8)
rough=np.clip(np.where(joints,247,210+fine*.2),0,255)
maps('brick',color,height,rough)

fine=R.normal(0,11,(S,S));base=92+fine*.9
bands=np.sin(np.arange(S)[None,:]/6.5)*20
base=base+bands
for y in range(S):
    if y%180<=2:base[y,:]-=26
color=np.stack([base*.73,base*.91,base*.94],axis=2)
rough=np.clip(169+fine*.6,90,240)
maps('metal',color,base*2,rough)
print('generated',len(list(OUT.glob('*.jpg'))),'maps',sum(p.stat().st_size for p in OUT.glob('*.jpg')),'bytes')

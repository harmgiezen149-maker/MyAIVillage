import sys, numpy as np
from PIL import Image
src, outdir = sys.argv[1], sys.argv[2]
S = 3
boxes = {
 'bench-plain':(60,55,360,320), 'bench-iron':(420,50,725,320),
 'lamp-hanging':(830,15,975,350), 'lamp-post':(1055,55,1135,345),
 'fountain':(1225,35,1548,342),
 'barrel':(75,370,225,578), 'barrel-lid':(295,370,445,578), 'barrel-small':(520,405,655,572),
 'crate-large':(850,375,1072,602), 'crate-small':(1125,435,1272,592), 'crate-stack':(1335,365,1538,612),
 'flowerbed-a':(50,600,382,848), 'flowerbed-b':(420,612,742,848),
 'bush-large':(850,640,1068,815), 'bush-medium':(1128,648,1308,805), 'bush-small':(1373,662,1528,805),
 'fence-straight':(58,940,372,1122), 'fence-corner':(413,882,752,1127),
 'council-chair-a':(852,858,1032,1132), 'council-chair-b':(1083,858,1258,1132),
 'jukebox':(1298,828,1548,1138),
}
im = np.asarray(Image.open(src).convert('RGB')).astype(np.int32)
for name,(x0,y0,x1,y1) in boxes.items():
    c = im[y0*S:y1*S, x0*S:x1*S].copy()
    r,g,b = c[...,0],c[...,1],c[...,2]
    mag = np.minimum(r,b) - g            # how magenta a pixel is
    a = np.clip((70 - mag) / 50.0, 0, 1)  # >=70 -> clear, <=20 -> solid
    ex = np.clip(np.minimum(r,b) - g, 0, None)   # remove magenta spill
    c[...,0] = r - (ex*(1-a)).astype(np.int32); c[...,2] = b - (ex*(1-a)).astype(np.int32)
    rgba = np.dstack([np.clip(c,0,255), (a*255)]).astype(np.uint8)
    out = Image.fromarray(rgba, 'RGBA')
    bb = out.getchannel('A').point(lambda v: 255 if v>40 else 0).getbbox()
    if bb: out = out.crop(bb)
    out.save(f'{outdir}/{name}.png', optimize=True)
    print(name, out.size)

# keep only the prop itself: the biggest solid shape, drop loose scraps
from PIL import ImageDraw, ImageFilter
import glob, os
# hand-marked leftovers of the faded room (polygons in fractions of the cut-out)
erase = {
 'barrel-small': [[(0,0),(.2,0),(.2,.12),(0,.12)], [(.72,.9),(1,.9),(1,1),(.72,1)], [(.88,.6),(1,.6),(1,1),(.88,1)]],
 'bush-large': [[(0,0),(.08,0),(.08,.45),(0,.45)], [(0,.75),(.08,.75),(.08,1),(0,1)], [(0,.85),(.2,.85),(.2,1),(0,1)], [(0,0),(.25,0),(.25,.08),(0,.08)]],
 'crate-large': [[(0,0),(.035,0),(.035,1),(0,1)], [(0,.79),(.5,1.01),(0,1.01)], [(.5,1.01),(1,.79),(1,1.01)]],
 'flowerbed-b': [[(.62,0),(1,0),(1,.09),(.62,.09)], [(.93,0),(1,0),(1,.28),(.93,.28)], [(.93,.82),(1,.82),(1,1),(.93,1)], [(.8,.93),(1,.93),(1,1),(.8,1)]],
}
for name in boxes:
    f = f'{outdir}/{name}.png'
    out = Image.open(f)
    if name in erase:
        w, h = out.size
        cut = Image.new('L', out.size, 255)
        for poly in erase[name]:
            ImageDraw.Draw(cut).polygon([(x*w, y*h) for x, y in poly], fill=0)
        out.putalpha(Image.fromarray(np.minimum(np.asarray(out.getchannel('A')), np.asarray(cut)).astype(np.uint8), 'L'))
    if name == 'jukebox':   # its music notes float free of the body, so keep loose pieces
        continue
    A = np.asarray(out.getchannel('A'))
    solid = (A > 140).astype(np.uint8) * 255
    m = Image.fromarray(solid, 'L').copy()
    ys, xs = np.nonzero(solid)
    cy, cx = A.shape[0] / 2, A.shape[1] / 2
    i = np.argmin((ys - cy) ** 2 + (xs - cx) ** 2)
    ImageDraw.floodfill(m, (int(xs[i]), int(ys[i])), 128)
    keep = Image.fromarray(((np.asarray(m) == 128) * 255).astype(np.uint8), 'L').filter(ImageFilter.MaxFilter(7))
    a = np.minimum(A, np.asarray(keep)).astype(np.uint8)
    out.putalpha(Image.fromarray(a, 'L'))
    bb = out.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    out.crop(bb).save(f, optimize=True)

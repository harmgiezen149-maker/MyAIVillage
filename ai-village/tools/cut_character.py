"""Cuts a 4 x 3 walking sheet into clean transparent frames and packs them into one sprite sheet.
Each frame's own background colour is sampled from its corners (the AI does not always keep one flat colour),
the figure is lined up on a shared foot line and centre, and all frames share one scale.
Usage: python3 tools/cut_character.py <sheet.png> <out.png> [--mirror r,c=r2,c2 ...]"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROWS, COLS = 4, 3
OUT_W, OUT_H = 192, 256          # size of each frame in the packed sheet
FOOT = 244                       # foot line inside each packed frame

src, out = sys.argv[1], sys.argv[2]
mirrors = [a.split('=') for a in sys.argv[3:] if '=' in a]

sheet = Image.open(src).convert('RGB')
fw, fh = sheet.width / COLS, sheet.height / ROWS

def cut(r, c):
    box = (round(c * fw), round(r * fh), round((c + 1) * fw), round((r + 1) * fh))
    im = np.asarray(sheet.crop(box)).astype(np.int32)
    h, w, _ = im.shape
    corners = np.concatenate([im[:12, :12].reshape(-1, 3), im[:12, -12:].reshape(-1, 3), im[-12:, :12].reshape(-1, 3), im[-12:, -12:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    dist = np.sqrt(((im - bg) ** 2).sum(axis=2))
    # background = pixels close to the background colour AND connected to the frame edge;
    # anything enclosed by the figure (faded jeans, grey hair) stays solid
    near = Image.fromarray(((dist < 34) * 255).astype(np.uint8))
    flood = near.copy()
    for x in range(0, w, 6):
        for y in (0, h - 1):
            if flood.getpixel((x, y)) == 255: ImageDraw.floodfill(flood, (x, y), 128)
    for y in range(0, h, 6):
        for x in (0, w - 1):
            if flood.getpixel((x, y)) == 255: ImageDraw.floodfill(flood, (x, y), 128)
    inside = np.asarray(flood) != 128
    if bg[0] > 150 and bg[2] > 150 and bg[1] < 110:
        # a true magenta background never appears in clothes or skin, so gaps between arm and body go too
        inside &= dist >= 60
    figure = Image.fromarray((inside * 255).astype(np.uint8))
    # biggest blob only (drop specks), then a soft one-pixel edge
    keep = figure.copy()
    ys, xs = np.nonzero(np.asarray(keep))
    i = np.argmin((ys - h / 2) ** 2 + (xs - w / 2) ** 2)
    ImageDraw.floodfill(keep, (int(xs[i]), int(ys[i])), 128)
    solid = Image.fromarray(((np.asarray(keep) == 128) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))
    alpha = np.asarray(solid.filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
    # pull the background tint out of the soft edge
    rgb = im.astype(np.float32)
    a = alpha[..., None]
    rgb = np.where(a > 0.02, (rgb - (1 - a) * bg) / np.maximum(a, 0.02), 0)
    rgba = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
    fig = Image.fromarray(rgba, 'RGBA')
    return fig.crop(fig.getchannel('A').point(lambda v: 255 if v > 60 else 0).getbbox())

frames = {(r, c): cut(r, c) for r in range(ROWS) for c in range(COLS)}
for target, source in mirrors:
    tr, tc = map(int, target.split(',')); sr, sc = map(int, source.split(','))
    frames[(tr, tc)] = frames[(sr, sc)].transpose(Image.FLIP_LEFT_RIGHT)

tallest = max(f.height for f in frames.values())
scale = (FOOT - 8) / tallest
packed = Image.new('RGBA', (OUT_W * COLS, OUT_H * ROWS), (0, 0, 0, 0))
for (r, c), f in frames.items():
    g = f.resize((max(1, round(f.width * scale)), max(1, round(f.height * scale))), Image.LANCZOS)
    packed.paste(g, (c * OUT_W + (OUT_W - g.width) // 2, r * OUT_H + FOOT - g.height), g)
packed.save(out, optimize=True)
print('saved', out, packed.size, 'tallest frame', tallest, 'px')

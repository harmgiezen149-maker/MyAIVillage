"""Cuts a seated sheet (figures on magenta: toward the camera, facing right, facing left, facing away) into a
strip of four transparent frames: down, right, left, up. Each frame is 192 x 256 with the feet on line 244,
scaled to SEATED of the standing figure height (236), so a seated person matches their walking size.

The AI does not always keep a clean 2 x 2 grid (some sheets have 6 or 8 poses), so every figure is found on its
own and numbered in reading order (top row first). By default figures 0,1,2,3 are down, right, left, up.
Pick others with --pick down=0,right=1,left=4,up=5 ; add f to mirror one (left=1f).
Usage: python3 tools/cut_seated.py <sheet.png> <out.png> [--pick ...] [--no-shadow] [--show blobs.jpg]"""
import sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from cut_character import cut_frame

OUT_W, OUT_H, FOOT, FIGURE = 192, 256, 244, 236
SEATED = 0.92          # tallest seated frame vs the standing figure, so heads come out the same size as walking

def find_figures(sheet):
    small = sheet.resize((sheet.width // 8, sheet.height // 8))
    a = np.asarray(small).astype(int)
    magenta = (a[..., 0] > 170) & (a[..., 2] > 170) & (a[..., 1] < 110)
    mask = Image.fromarray(((~magenta) * 255).astype(np.uint8)).copy()   # copy: a numpy-backed image is read-only
    blobs = []
    w, h = mask.size
    for y in range(h):
        for x in range(w):
            if mask.getpixel((x, y)) == 255:
                ImageDraw.floodfill(mask, (x, y), 100)
                ys, xs = np.nonzero(np.asarray(mask) == 100)
                ImageDraw.floodfill(mask, (x, y), 0)
                if len(xs) > 60:
                    blobs.append((xs.min() * 8, ys.min() * 8, (xs.max() + 1) * 8, (ys.max() + 1) * 8))
    # merge blobs that overlap (a hand or a prop split off the body)
    merged = True
    while merged:
        merged = False
        for i in range(len(blobs)):
            for j in range(i + 1, len(blobs)):
                a1, b1 = blobs[i], blobs[j]
                if a1[0] < b1[2] + 16 and b1[0] < a1[2] + 16 and a1[1] < b1[3] + 16 and b1[1] < a1[3] + 16:
                    blobs[i] = (min(a1[0], b1[0]), min(a1[1], b1[1]), max(a1[2], b1[2]), max(a1[3], b1[3]))
                    del blobs[j]; merged = True; break
            if merged: break
    rowh = sheet.height / 4
    blobs.sort(key=lambda b: (round(((b[1] + b[3]) / 2) / (sheet.height / 2) - 0.5), b[0]))
    return blobs

def main():
    src, out = sys.argv[1], sys.argv[2]
    args = sys.argv[3:]
    sheet = Image.open(src).convert('RGB')
    blobs = find_figures(sheet)
    if '--show' in args:
        show = sheet.copy(); d = ImageDraw.Draw(show)
        for i, b in enumerate(blobs):
            d.rectangle(b, outline=(0, 255, 0), width=6); d.text((b[0] + 8, b[1] + 8), str(i), fill=(255, 255, 0))
        show.resize((800, 800)).save(args[args.index('--show') + 1])
    pick = {'down': '0', 'right': '1', 'left': '2', 'up': '3'}
    if '--pick' in args:
        for part in args[args.index('--pick') + 1].split(','):
            k, v = part.split('='); pick[k] = v
    frames = []
    for name in ('down', 'right', 'left', 'up'):
        v = pick[name]; flip = v.endswith('f'); i = int(v.rstrip('f'))
        x0, y0, x1, y1 = blobs[i]
        crop = sheet.crop((max(0, x0 - 24), max(0, y0 - 24), min(sheet.width, x1 + 24), min(sheet.height, y1 + 24)))
        f = cut_frame(crop, 0, 0, 1, 1, '--no-shadow' in args)
        frames.append(f.transpose(Image.FLIP_LEFT_RIGHT) if flip else f)
    scale = FIGURE * SEATED / max(f.height for f in frames)
    strip = Image.new('RGBA', (OUT_W * 4, OUT_H), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        g = f.resize((max(1, round(f.width * scale)), max(1, round(f.height * scale))), Image.LANCZOS)
        strip.paste(g, (i * OUT_W + (OUT_W - g.width) // 2, FOOT - g.height), g)
    strip.save(out, optimize=True)
    print('saved', out, len(blobs), 'figures found')

if __name__ == '__main__':
    main()

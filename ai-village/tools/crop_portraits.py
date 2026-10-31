"""Crops each AI face portrait to a tight square around the person (some come out small in the middle,
or inside a faint inner box) and saves a 256 px game copy to assets/portraits/<id>.jpg.
Usage: python3 tools/crop_portraits.py art/portraits/*-portrait-v1.png"""
import sys, os
import numpy as np
from PIL import Image

# Hand-picked crops where the automatic one fails (the faint inner box around Nova).
MANUAL = {'nova-lindqvist': (205, 195, 815, 805)}

for path in sys.argv[1:]:
    pid = os.path.basename(path).replace('-portrait-v1.png', '')
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.int32)
    h, w, _ = a.shape
    # background: a smooth vertical gradient, sampled per row from both side edges
    edge = np.concatenate([a[:, :12], a[:, -12:]], axis=1)
    bg = np.median(edge, axis=1)[:, None, :]
    fg = np.sqrt(((a - bg) ** 2).sum(axis=2)) > 40
    rows, cols = np.nonzero(fg)
    if pid in MANUAL:
        box = MANUAL[pid]
    elif len(rows) < 100:
        box = (0, 0, w, h)
    else:
        y0, y1 = np.percentile(rows, 0.5), np.percentile(rows, 99.5)
        x0, x1 = np.percentile(cols, 0.5), np.percentile(cols, 99.5)
        side = min(max(y1 - y0, x1 - x0) * 1.08, w)
        cx = (x0 + x1) / 2
        top = max(0, y0 - side * 0.06)
        left = min(max(0, cx - side / 2), w - side)
        top = min(top, h - side)
        box = tuple(int(round(v)) for v in (left, top, left + side, top + side))
    im.crop(box).resize((256, 256), Image.LANCZOS).save(f'assets/portraits/{pid}.jpg', quality=90)
    print(pid, box)

"""Works out where people can walk in town, from the art.
1. Ground: every 4 x 4 cell of the map is sorted by colour and texture (k-means). The clusters that are
   paths, cobbles, dirt and grass count as ground; roofs, walls, tree tops and props do not.
2. Solid things traced from the art (buildings, trees, hedges, the fountain, benches, stalls...) are cut out,
   and the forest around town is closed off.
3. Small specks are cleaned up and only ground connected to the town square is kept.
Writes tools/out/town-walk.npy (448 x 600, 1 = walkable) and a picture to check.
Usage: python3 tools/town_walk.py"""
import os
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H, CELL = 600, 448, 4

# ---------- 1. ground from colour and texture ----------
def ground_mask():
    im = Image.open(os.path.join(ROOT, 'assets/map.jpg')).convert('RGB')
    small = im.resize((W, H), Image.BOX)
    rgb = np.asarray(small).astype(float) / 255
    hsv = np.asarray(small.convert('HSV')).astype(float)
    h, s, v = hsv[..., 0] / 255 * 2 * np.pi, hsv[..., 1] / 255, hsv[..., 2] / 255
    lum = np.asarray(im.convert('L')).astype(float)
    b = im.width // W
    tex = lum[:H * b, :W * b].reshape(H, b, W, b).std(axis=(1, 3))
    def blur(x, r):
        m = x.max() or 1
        return np.asarray(Image.fromarray((x / m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(float) / 255 * m
    X = np.stack([np.cos(h) * s, np.sin(h) * s, v, blur(v, 3), blur(tex, 1.5) / 40, blur(tex, 4) / 40,
                  blur(rgb[..., 0], 2), blur(rgb[..., 1], 2), blur(rgb[..., 2], 2)], -1).reshape(-1, 9)
    X = (X - X.mean(0)) / X.std(0)
    rng = np.random.default_rng(1)
    C = X[rng.choice(len(X), 14, replace=False)]
    for _ in range(30):
        lab = ((X[:, None, :] - C[None]) ** 2).sum(-1).argmin(1)
        C = np.array([X[lab == k].mean(0) if (lab == k).any() else C[k] for k in range(14)])
    lab = lab.reshape(H, W)
    # which clusters are ground: the ones that cover most of the square, the paths and the lawns
    samples = [(1150, 1000), (1000, 900), (1300, 700), (900, 650), (1550, 700), (1450, 940), (300, 900),
               (1050, 1500), (700, 1450), (2000, 900), (1900, 850), (520, 1400), (1350, 1530), (1150, 650),
               (960, 600), (1500, 680), (2000, 820), (2050, 1100), (460, 1560), (1040, 1600), (1500, 760), (1600, 1300),
               (1850, 940), (700, 1330), (1400, 1470), (120, 820), (2200, 850), (1550, 900), (600, 900)]
    ground_ids = set()
    for x, y in samples:
        c, r = x // CELL, y // CELL
        win = lab[r - 3:r + 4, c - 3:c + 4].ravel()
        ground_ids.add(int(np.bincount(win).argmax()))
    return np.isin(lab, list(ground_ids))

# ---------- 2. solid things traced from the art (map units) ----------
R = lambda x, y, w, h: ('r', x, y, w, h)
E = lambda cx, cy, rx, ry: ('e', cx, cy, rx, ry)
P = lambda *pts: ('p', pts)
SOLID = [
    # forest around town
    R(0, 0, 2400, 290), R(0, 0, 715, 400), R(215, 290, 220, 480), R(1794, 0, 280, 405), R(1980, 405, 92, 215),
    R(2072, 0, 328, 340), R(2298, 340, 102, 925), R(2138, 1140, 262, 125),
    R(0, 860, 87, 932), R(87, 1060, 142, 732), R(229, 960, 186, 285), R(0, 1640, 600, 152),
    R(600, 1545, 230, 247), R(830, 1556, 120, 236), R(950, 1676, 250, 116), R(1200, 1765, 100, 27),
    P((1298, 1792), (1298, 1567), (1593, 1567), (1593, 1440), (1700, 1400), (1990, 1262), (2400, 1262), (2400, 1792)),
    # buildings
    R(0, 600, 235, 160),                                   # plain house, far top left (guest house)
    R(435, 560, 330, 145), R(410, 650, 95, 100), R(665, 715, 60, 55), R(745, 551, 75, 152),   # counting house, bush, crate, sign
    R(705, 380, 340, 165), R(640, 400, 95, 70),            # scholar's tower, bush
    R(1063, 0, 280, 528), R(1330, 0, 115, 470),            # council hall, bell tower
    R(1467, 380, 327, 165), R(1565, 534, 82, 70), R(1522, 632, 103, 99),   # post house, letter chest, notice board
    R(1653, 560, 327, 173), R(1725, 739, 61, 70), R(1811, 751, 57, 50), R(1872, 702, 115, 86), R(1983, 625, 49, 110),
    R(2072, 520, 268, 180), R(2097, 600, 60, 172), R(2270, 600, 56, 172), R(2060, 702, 50, 107), R(2236, 758, 82, 63),
    R(0, 763, 82, 82), R(169, 763, 218, 82), R(403, 763, 142, 82),          # hedges
    R(445, 950, 210, 155),                                 # tall house left of the square (closed): its footprint
    R(790, 1020, 65, 115), R(851, 1011, 50, 98),           # swing tree trunk and swing (the crown is walk-behind)
    R(447, 1150, 313, 199), R(760, 1100, 42, 74), R(447, 1098, 80, 130),     # family cottage, veg boxes
    R(832, 1290, 303, 150), R(1121, 1332, 30, 44), R(930, 1055, 16, 110), R(1117, 1055, 16, 110),  # guest cottage, barrel, washing line
    R(807, 1398, 76, 110), R(1080, 1403, 49, 100), R(900, 1431, 98, 76), R(998, 1507, 152, 55),
    R(720, 1398, 76, 71), R(622, 1478, 28, 52),           # garden beds, picnic table, flowers, toy cart, signpost
    P((191, 1535), (191, 1420), (280, 1300), (470, 1255), (562, 1380), (562, 1520)), R(380, 1490, 95, 75),
    R(430, 1470, 75, 55), R(555, 1465, 42, 52), R(275, 1550, 58, 65),   # carrier's depot (footprint under the long roof), crates, barrels, wheel
    R(1244, 1230, 370, 165), R(1304, 1376, 32, 55), R(1418, 1376, 131, 60), R(1260, 1398, 38, 93),
    R(1456, 1513, 93, 38), R(1262, 1525, 18, 25), R(1437, 1525, 18, 25), R(1552, 1525, 18, 25), R(1571, 1371, 82, 76),  # herald's lodge
    R(1660, 1150, 292, 128), R(1701, 1158, 100, 213),      # bard's house (footprint), bandstand
    R(1750, 960, 216, 180),                                # tall house right of the square (closed): its footprint
    R(2116, 1000, 190, 121),                                # market stall
    R(1249, 1605, 55, 104),                                # beacon brazier
    E(1200, 868, 124, 100),                                # fountain
]

# Roofs and tops of things that hide the ground behind them: drawn over people, not solid.
ROOFS = [R(1598, 993, 354, 285), R(435, 420, 330, 285), R(705, 140, 340, 405), R(1467, 125, 327, 420),
         R(1653, 403, 327, 330), R(2072, 333, 268, 367), R(447, 984, 365, 365), R(823, 1125, 312, 315),
         R(1244, 1065, 370, 330), R(2116, 899, 190, 222), R(0, 400, 235, 360), P((445, 950), (550, 762), (655, 950)), P((1750, 960), (1856, 792), (1966, 960)), R(191, 1245, 371, 290)]

# The routes you can see in the art, from every door to the square: always walkable (unless solid).
L = lambda *pts: ('l', pts)
ROUTES = [
    L((1194, 540), (1194, 800)),                                        # council hall
    L((915, 545), (960, 600), (1010, 680), (1080, 770)),                # scholar's tower
    L((712, 705), (780, 730), (900, 760), (1060, 790)),                 # counting house
    L((1562, 560), (1500, 640), (1420, 720), (1320, 770)),              # post house
    L((1716, 800), (1640, 830), (1500, 870), (1320, 880)),              # crier's press
    L((2190, 725), (2190, 800), (2040, 830), (1900, 820), (1780, 840), (1640, 860)),   # workshop, behind the tall house
    L((2050, 830), (2060, 1000), (2050, 1240)),                         # road past the market
    L((125, 810), (125, 870), (300, 880), (460, 880), (560, 860), (700, 830), (1000, 830)),   # top-left house, behind the tall house
    L((766, 1250), (790, 1300), (720, 1370), (695, 1440), (665, 1515), (580, 1560), (520, 1590), (350, 1590), (256, 1575)),  # family cottage to the depot
    L((790, 1300), (814, 1200), (840, 1150), (900, 1125), (990, 1080), (1100, 1000)),   # family cottage to the square
    L((1045, 1420), (1100, 1460), (1190, 1470)),                         # guest cottage
    L((1200, 980), (1200, 1760)),                                        # south road
    L((1380, 1420), (1380, 1475), (1320, 1495), (1290, 1510), (1200, 1510)),   # herald's lodge
    L((1684, 1305), (1680, 1380), (1660, 1460), (1580, 1478), (1380, 1475)),   # bard's house to the herald's yard
    L((1684, 1305), (1640, 1250), (1630, 1150), (1560, 1080), (1450, 1000), (1300, 930)),   # bard's house to the square
]

# Tree crowns over paths: the ground under them is walkable (people pass behind the crown).
CROWNS = [R(704, 831, 245, 189), R(229, 845, 186, 115)]

def shapes_mask(shapes):
    img = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(img)
    for s in shapes:
        if s[0] == 'r':
            _, x, y, w, h = s
            d.rectangle([x / CELL, y / CELL, (x + w) / CELL - 1, (y + h) / CELL - 1], fill=255)
        elif s[0] == 'e':
            _, cx, cy, rx, ry = s
            d.ellipse([(cx - rx) / CELL, (cy - ry) / CELL, (cx + rx) / CELL, (cy + ry) / CELL], fill=255)
        elif s[0] == 'l':
            d.line([(x / CELL, y / CELL) for x, y in s[1]], fill=255, width=13, joint='curve')
        else:
            d.polygon([(x / CELL, y / CELL) for x, y in s[1]], fill=255)
    return np.asarray(img) > 0

def solid_mask():
    return shapes_mask(SOLID)

def _unused_solid_mask():
    img = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(img)
    for s in SOLID:
        if s[0] == 'r':
            _, x, y, w, h = s
            d.rectangle([x / CELL, y / CELL, (x + w) / CELL - 1, (y + h) / CELL - 1], fill=255)
        elif s[0] == 'e':
            _, cx, cy, rx, ry = s
            d.ellipse([(cx - rx) / CELL, (cy - ry) / CELL, (cx + rx) / CELL, (cy + ry) / CELL], fill=255)
        else:
            d.polygon([(x / CELL, y / CELL) for x, y in s[1]], fill=255)
    return np.asarray(img) > 0

def morph(m, r, op):
    img = Image.fromarray((m * 255).astype(np.uint8)).copy()
    f = ImageFilter.MaxFilter(2 * r + 1) if op == 'dilate' else ImageFilter.MinFilter(2 * r + 1)
    return np.asarray(img.filter(f)) > 0

def keep_connected(m, x, y):
    img = Image.fromarray((m * 255).astype(np.uint8)).copy()
    ImageDraw.floodfill(img, (x // CELL, y // CELL), 128)
    return np.asarray(img) == 128

def main():
    import json
    world = json.load(open(os.path.join(ROOT, 'tools/out/doors.json')))
    ground = ground_mask()
    ground = morph(morph(ground, 2, 'dilate'), 2, 'erode')     # close cracks between cobbles
    notground = morph(morph(~ground, 2, 'erode'), 2, 'dilate')   # drop specks of shade on paths
    routes = shapes_mask(ROUTES)
    walk = ((~notground | shapes_mask(CROWNS)) & ~shapes_mask(ROOFS) | routes) & ~solid_mask()   # roofs: only where a route passes behind
    walk = morph(morph(walk, 1, 'erode'), 1, 'dilate')          # no one-cell slivers
    for x, y in world['doors']:                                  # every door has a clear step in front
        img = Image.fromarray((walk * 255).astype(np.uint8)).copy(); d = ImageDraw.Draw(img)
        d.ellipse([x / CELL - 3, y / CELL - 2, x / CELL + 3, y / CELL + 6], fill=255)
        walk = np.asarray(img) > 0
    walk = keep_connected(walk, 1200, 1010)
    os.makedirs(os.path.join(ROOT, 'tools/out'), exist_ok=True)
    np.save(os.path.join(ROOT, 'tools/out/town-walk.npy'), walk.astype(np.uint8))
    # cover: buildings, trees and props are drawn over anyone standing behind them
    cover = solid_mask() & ~walk | shapes_mask(CROWNS) | shapes_mask(ROOFS)
    np.save(os.path.join(ROOT, 'tools/out/town-cover.npy'), (cover * 2).astype(np.uint8))
    print('walkable share', walk.mean())

if __name__ == '__main__':
    main()

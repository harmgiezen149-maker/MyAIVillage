"""Works out where people can walk inside each house, from the art: the open floor between the walls,
minus every piece of furniture (traced from the room pictures, room units 1200 x 896).
The door strip in the front wall stays open so people can walk in and out.
Writes tools/out/<room>-walk.npy and -cover.npy (224 x 300 cells of 4 units)."""
import os, json
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H, CELL = 300, 224, 4

# floor: polygon of open floor between the walls. furniture: [x, y, w, h] boxes (block and are drawn over people behind them)
ROOMS = {
  'council-hall': dict(floor=[(150, 345), (1080, 345), (1150, 800), (60, 800)],
      furniture=[(530, 352, 150, 300), (440, 370, 92, 275), (678, 370, 92, 275), (560, 590, 85, 105), (555, 230, 100, 125),
                 (380, 270, 60, 100), (1000, 330, 200, 300)]),
  'post-house': dict(floor=[(150, 425), (1060, 425), (1100, 648), (70, 648)],
      furniture=[(660, 404, 191, 241), (872, 409, 137, 210)]),
  'counting-house': dict(floor=[(150, 395), (990, 395), (1080, 740), (70, 740)],
      furniture=[(251, 408, 332, 169), (371, 506, 76, 120), (807, 413, 180, 213), (807, 326, 71, 98), (720, 435, 81, 142), (660, 300, 260, 100)]),
  'scholars-tower': dict(floor=[(150, 360), (1080, 360), (1160, 740), (50, 740)],
      furniture=[(153, 330, 114, 79), (284, 330, 114, 63), (409, 300, 93, 60), (414, 344, 126, 141), (202, 403, 114, 142),
                 (338, 436, 82, 93), (649, 330, 93, 65), (785, 403, 311, 219), (927, 316, 125, 153)]),
  'artisans-workshop': dict(floor=[(643, 320), (1150, 600), (430, 880), (90, 560)],
      furniture=[(87, 400, 300, 160), (250, 330, 400, 90), (278, 430, 165, 158), (202, 523, 60, 108), (572, 309, 77, 110),
                 (731, 277, 110, 175), (807, 299, 109, 191), (894, 342, 98, 311), (998, 386, 103, 207), (698, 282, 54, 109),
                 (470, 590, 225, 170), (611, 497, 131, 178)]),
  'family-cottage': dict(floor=[(150, 330), (1050, 330), (1170, 760), (40, 760)],
      furniture=[(147, 316, 131, 169), (294, 278, 131, 98), (294, 360, 99, 120), (431, 305, 98, 98), (420, 398, 93, 104),
                 (125, 447, 71, 98), (98, 545, 273, 160), (485, 175, 229, 168), (769, 251, 169, 87), (834, 278, 55, 87),
                 (725, 294, 38, 39), (954, 213, 82, 174), (834, 393, 262, 234), (1118, 611, 76, 136)]),
  'bards-house': dict(floor=[(180, 348), (1020, 348), (1090, 768), (100, 768)],
      furniture=[(420, 353, 381, 131), (240, 330, 163, 78), (867, 326, 147, 153), (109, 451, 185, 224), (284, 440, 98, 186),
                 (894, 544, 153, 130), (698, 621, 131, 92)]),
  'criers-press': dict(floor=[(140, 330), (1060, 330), (1180, 740), (40, 740)],
      furniture=[(403, 330, 142, 144), (545, 300, 180, 125), (82, 420, 174, 212), (562, 442, 76, 158), (785, 403, 311, 219), (921, 327, 148, 126)]),
  'heralds-lodge': dict(floor=[(140, 375), (1010, 375), (1110, 773), (40, 773)],
      furniture=[(169, 330, 109, 89), (273, 381, 125, 109), (93, 436, 114, 163), (267, 485, 104, 103), (425, 473, 88, 126),
                 (191, 582, 212, 93), (605, 359, 218, 120), (665, 282, 82, 88), (965, 413, 158, 262)]),
  'carriers-depot': dict(floor=[(130, 320), (1000, 320), (1120, 790), (40, 790)],
      furniture=[(33, 300, 180, 474), (769, 104, 267, 223), (970, 191, 159, 371), (278, 360, 376, 169), (611, 380, 131, 78),
                 (758, 502, 262, 218), (938, 605, 125, 126)]),
}

def mask(draw_fn):
    img = Image.new('L', (W, H), 0); d = ImageDraw.Draw(img); draw_fn(d)
    return np.asarray(img) > 0

def main():
    exits = json.load(open(os.path.join(ROOT, 'tools/out/doors.json')))['rooms']
    os.makedirs(os.path.join(ROOT, 'tools/out'), exist_ok=True)
    for rid, r in ROOMS.items():
        floor = mask(lambda d: d.polygon([(x / CELL, y / CELL) for x, y in r['floor']], fill=255))
        furn = mask(lambda d: [d.rectangle([x / CELL, y / CELL, (x + w) / CELL - 1, (y + h) / CELL - 1], fill=255) for x, y, w, h in r['furniture']])
        ex, ey = exits[rid]['exit']
        door = mask(lambda d: d.rectangle([(ex - 48) / CELL, (ey - 60) / CELL, (ex + 48) / CELL, (ey + 70) / CELL], fill=255))
        walk = (floor & ~furn) | (door & ~furn)
        cover = furn | ~floor & ~door
        np.save(os.path.join(ROOT, f'tools/out/{rid}-walk.npy'), walk.astype(np.uint8))
        np.save(os.path.join(ROOT, f'tools/out/{rid}-cover.npy'), (cover & ~walk).astype(np.uint8) * 2)
        print(rid, round(walk.mean(), 3))

if __name__ == '__main__':
    main()

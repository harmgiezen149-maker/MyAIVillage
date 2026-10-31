"""Cuts a 2 x 2 seated sheet (toward the camera, facing right / facing left, facing away) into a strip of
four transparent frames: down, right, left, up. Each frame is 192 x 256 with the feet on line 244, and the
figure is scaled to SEATED of the standing figure height (236), so a seated person matches their walking size.
Usage: python3 tools/cut_seated.py <seated-sheet.png> <out.png> [--no-shadow] [--left-from-right] [--right-from-left]
(the AI sometimes draws both side views facing the same way: then mirror the good one)"""
import sys
from PIL import Image
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from cut_character import cut_frame

OUT_W, OUT_H, FOOT, FIGURE = 192, 256, 244, 236
SEATED = 0.92          # tallest seated frame vs the standing figure, so heads come out the same size as walking
ORDER = [(0, 0), (0, 1), (1, 0), (1, 1)]   # down, right, left, up

src, out = sys.argv[1], sys.argv[2]
sheet = Image.open(src).convert('RGB')
frames = [cut_frame(sheet, r, c, 2, 2, '--no-shadow' in sys.argv) for r, c in ORDER]
if '--left-from-right' in sys.argv: frames[2] = frames[1].transpose(Image.FLIP_LEFT_RIGHT)
if '--right-from-left' in sys.argv: frames[1] = frames[2].transpose(Image.FLIP_LEFT_RIGHT)
scale = FIGURE * SEATED / max(f.height for f in frames)
strip = Image.new('RGBA', (OUT_W * 4, OUT_H), (0, 0, 0, 0))
for i, f in enumerate(frames):
    g = f.resize((max(1, round(f.width * scale)), max(1, round(f.height * scale))), Image.LANCZOS)
    strip.paste(g, (i * OUT_W + (OUT_W - g.width) // 2, FOOT - g.height), g)
strip.save(out, optimize=True)
print('saved', out, strip.size)

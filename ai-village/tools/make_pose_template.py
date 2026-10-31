"""Draws the 4 x 3 walking pose guide (a plain mannequin) that every character sheet copies.
Rows: toward camera, right, left, away. Columns: left foot forward, standing, right foot forward."""
import math
from PIL import Image, ImageDraw

FW, FH = 597, 600            # frame size: the sheet is 1792 x 2400 (3:4)
W, H = FW * 3, FH * 4
BG = (255, 0, 255)
SKIN, SHIRT, PANTS, BOOT, HAIR, LINE = (232, 190, 150), (90, 120, 200), (70, 80, 110), (110, 70, 40), (60, 40, 30), (25, 20, 30)

img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)

def limb(p, q, w, color):
    d.line([p, q], fill=LINE, width=w + 8)
    d.line([p, q], fill=color, width=w)
    for pt in (p, q):
        r = w // 2 + 2
        d.ellipse([pt[0] - r, pt[1] - r, pt[0] + r, pt[1] + r], fill=color, outline=LINE, width=4)

def at(cx, top, dx, dy):
    return (cx + dx, top + dy)

def front(cx, top, step, back=False):
    # step: -1 left foot forward, 0 standing, +1 right foot forward (character's left = viewer's right when facing us)
    s = step if not back else -step
    hip_y, knee_y, foot_y = 250, 345, 440
    # legs: the leading foot comes lower and wider, the trailing foot lifts with a bent knee
    for side in (-1, 1):                      # viewer's left / right
        lead = (s == -1 and side == 1) or (s == 1 and side == -1)
        trail = s != 0 and not lead
        hip = at(cx, top, 22 * side, hip_y)
        knee = at(cx, top, 26 * side + (6 * side if lead else 0), knee_y + (14 if lead else -18 if trail else 0))
        foot = at(cx, top, 30 * side + (14 * side if lead else 0), foot_y + (30 if lead else -42 if trail else 0))
        limb(hip, knee, 34, PANTS)
        limb(knee, foot, 30, PANTS)
        fw = 30 if lead else 24
        d.ellipse([foot[0] - fw, foot[1] - 10, foot[0] + fw, foot[1] + 18], fill=BOOT, outline=LINE, width=4)
    # torso
    d.rounded_rectangle([cx - 62, top + 110, cx + 62, top + 262], 22, fill=SHIRT, outline=LINE, width=5)
    # arms swing opposite to the legs: the arm on the trailing-leg side swings forward (hand lower, toward center)
    for side in (-1, 1):
        lead_leg = (s == -1 and side == 1) or (s == 1 and side == -1)
        fwd = s != 0 and not lead_leg
        sh = at(cx, top, 64 * side, 128)
        el = at(cx, top, (70 - (14 if fwd else 0)) * side, 200 + (10 if fwd else -6 if s else 0))
        ha = at(cx, top, (58 - (26 if fwd else -8 if s else 0)) * side, 262 + (22 if fwd else -14 if s else 0))
        limb(sh, el, 24, SHIRT)
        limb(el, ha, 20, SKIN)
    # head
    d.ellipse([cx - 44, top + 14, cx + 44, top + 108], fill=HAIR if back else SKIN, outline=LINE, width=5)
    if not back:
        d.ellipse([cx - 22, top + 50, cx - 10, top + 62], fill=LINE)
        d.ellipse([cx + 10, top + 50, cx + 22, top + 62], fill=LINE)

def side(cx, top, step, facing):
    # facing +1 right, -1 left. step != 0: big stride (inverted V); 0: feet together, true profile.
    f = facing
    hip = at(cx, top, 0, 250)
    if step == 0:
        legs = [((-4, 345), (-2, 440)), ((6, 345), (8, 440))]
        arms = [((-4, 200), (-2, 262)), ((6, 200), (8, 262))]
    else:
        a = 1 if step == 1 else -1            # which leg leads alternates between the two step frames
        legs = [((40, 340), (95, 438)), ((-30, 345), (-92, 420))]
        arms = [((-30, 196), (-58, 250)), ((30, 196), (62, 246))]
        if a == -1:
            legs = legs[::-1]
            arms = arms[::-1]
    # far limbs first (darker), near limbs last
    for (k, ft), shade in zip(legs, (0.75, 1.0)):
        col = tuple(int(c * shade) for c in PANTS)
        knee = at(cx, top, k[0] * f, k[1]); foot = at(cx, top, ft[0] * f, ft[1])
        limb(hip, knee, 34, col); limb(knee, foot, 30, col)
        toe = 34 * f
        heel = foot[0] - 14 * f
        d.ellipse([min(heel, foot[0] + toe), foot[1] - 10, max(heel, foot[0] + toe), foot[1] + 18], fill=BOOT, outline=LINE, width=4)
    d.rounded_rectangle([cx - 40, top + 110, cx + 40, top + 262], 22, fill=SHIRT, outline=LINE, width=5)
    sh = at(cx, top, 0, 130)
    for (e, h), shade in zip(arms, (1.0, 0.8)):
        col = tuple(int(c * shade) for c in SHIRT)
        el = at(cx, top, e[0] * f, e[1]); ha = at(cx, top, h[0] * f, h[1])
        limb(sh, el, 24, col); limb(el, ha, 20, SKIN)
    d.ellipse([cx - 42, top + 14, cx + 42, top + 108], fill=SKIN, outline=LINE, width=5)
    d.pieslice([cx - 42, top + 14, cx + 42, top + 108], 90 if f == 1 else 270, 270 if f == 1 else 450, fill=HAIR)   # hair at the back of the head
    d.ellipse([cx + 22 * f - 6, top + 50, cx + 22 * f + 6, top + 62], fill=LINE)               # eye toward the facing side
    d.polygon([(cx + 40 * f, top + 60), (cx + 54 * f, top + 74), (cx + 38 * f, top + 80)], fill=SKIN, outline=LINE)  # nose

for col, step in enumerate((-1, 0, 1)):
    cx = col * FW + FW // 2
    front(cx, 0 * FH + 60, step)
    side(cx, 1 * FH + 60, step, 1)
    side(cx, 2 * FH + 60, step, -1)
    front(cx, 3 * FH + 60, step, back=True)

img.save('art/characters/pose-template.png')
img.resize((W // 2, H // 2)).save('art/characters/pose-template-preview.jpg', quality=88)
print('saved art/characters/pose-template.png', img.size)

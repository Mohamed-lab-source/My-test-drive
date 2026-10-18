"""Edit the printed card: "THEIR" -> "OUR" and 7:00 PM -> 6:00 PM, reusing the card's own glyphs.

usage: python3 edit_card.py IN.jpg OUT.jpg
"""
import sys

import numpy as np
from PIL import Image

src = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(float)
out = src.copy()
lum = lambda a: a @ np.array([0.299, 0.587, 0.114])


def clean_background(img, x0, x1, y0, y1, pad=3):
    """Background under a text box, interpolated from the rows just above and below it."""
    top = img[y0 - pad:y0, x0:x1].mean(axis=0)
    bot = img[y1 + 1:y1 + 1 + pad, x0:x1].mean(axis=0)
    # soften horizontally so sparkles/noise in the guide rows don't streak
    k = np.ones(9) / 9
    for arr in (top, bot):
        for c in range(3):
            arr[:, c] = np.convolve(np.pad(arr[:, c], 4, mode="edge"), k, mode="valid")
    t = np.linspace(0, 1, y1 - y0 + 1)[:, None, None]
    return top[None] * (1 - t) + bot[None] * t


def ink_patch(x0, x1, y0, y1, pad=2):
    """A cut from the original: its difference from the paper behind it, and a mask of where ink is."""
    xa, xb, ya, yb = x0 - pad, x1 + pad + 1, y0 - pad, y1 + pad + 1
    patch = src[ya:yb, xa:xb]
    bg = clean_background(src, xa, xb, ya, yb - 1)
    bl, pl = lum(bg), lum(patch)
    ink = np.percentile(pl, 2)
    alpha = np.clip((bl - pl) / np.maximum(bl - ink, 1), 0, 1)
    weight = np.clip(alpha * 5, 0, 1)
    return patch - bg, weight


def paste(dst, diff, weight, x, y):
    h, w = weight.shape
    dst[y:y + h, x:x + w] += diff * weight[..., None]


# ── 1. "THE BEGINNING OF THEIR FOREVER" -> "THE BEGINNING OF OUR FOREVER" ──
Y0, Y1 = 718, 732                          # cap height of the line
L2 = [(238, 250), (259, 271), (280, 290),  # T H E
      (311, 320), (329, 339), (347, 359), (370, 372), (382, 394), (404, 416), (426, 429), (439, 450), (460, 472),  # BEGINNING
      (493, 508), (517, 525),              # O F
      (546, 558), (567, 579), (589, 598), (608, 610), (620, 631),  # T H E I R
      (653, 661), (669, 684), (693, 703), (714, 723), (731, 744), (753, 763), (772, 783)]  # F O R E V E R
O_YOU, U_YOU, LINE1_Y = (444, 458), (467, 478), (684, 698)

head = (L2[0][0], L2[13][1])        # "THE BEGINNING OF"
tail = (L2[19][0], L2[25][1])       # "FOREVER"
WORD_GAP = L2[3][0] - L2[2][1] - 1  # spacing used on the card itself
LETTER_GAP = L2[16][0] - L2[15][1] - 1
blocks = [ink_patch(*head, Y0, Y1),
          ink_patch(*O_YOU, *LINE1_Y), ink_patch(*U_YOU, *LINE1_Y), ink_patch(*L2[18], Y0, Y1),
          ink_patch(*tail, Y0, Y1)]
gaps = [WORD_GAP, LETTER_GAP, LETTER_GAP, WORD_GAP, 0]
width = lambda wgt: wgt.shape[1] - 4
total = sum(width(w) + g for (_, w), g in zip(blocks, gaps))
centre = (L2[0][0] + L2[-1][1]) / 2
x = round(centre - total / 2)

ex0, ex1, ey0, ey1 = 228, 794, 714, 736
out[ey0:ey1 + 1, ex0:ex1] = clean_background(src, ex0, ex1, ey0, ey1)
for (d, w), g in zip(blocks, gaps):
    paste(out, d, w, x - 2, Y0 - 2)
    x += width(w) + g
print("gaps", WORD_GAP, LETTER_GAP)

# ── 2. "7:00 PM" -> "6:00 PM", using the 6 from "2026" scaled to the time's size ──
SEVEN = (404, 414)
ZERO = (423, 433)


def vbounds(x0, x1, y0=835, y1=885, th=150):
    rows = np.where((lum(src[y0:y1, x0:x1 + 1]) < th).any(axis=1))[0]
    return y0 + rows[0], y0 + rows[-1]


zy0, zy1 = vbounds(*ZERO)
six_box = (309, 323)
sy0, sy1 = vbounds(*six_box, y0=840, y1=900)
p6, a6 = ink_patch(six_box[0], six_box[1], sy0, sy1)
scale = (zy1 - zy0 + 1) / (sy1 - sy0 + 1)
nw, nh = max(1, round(p6.shape[1] * scale)), max(1, round(p6.shape[0] * scale))
p6 = np.stack([np.asarray(Image.fromarray(p6[..., c].astype(np.float32), 'F').resize((nw, nh), Image.LANCZOS)) for c in range(3)], -1)
a6 = np.asarray(Image.fromarray((a6 * 255).astype(np.uint8)).resize((nw, nh), Image.LANCZOS)).astype(float) / 255

sy_a, sy_b = vbounds(*SEVEN)
out[sy_a - 2:sy_b + 3, SEVEN[0] - 3:SEVEN[1] + 3] = clean_background(src, SEVEN[0] - 3, SEVEN[1] + 3, sy_a - 2, sy_b + 2)
# keep the 6 where the 7 sat: right edge 1px before the colon gap, baseline on the zeros
paste(out, p6, a6, int(round(SEVEN[0] + ((SEVEN[1] - SEVEN[0]) - (nw - 4 * scale)) / 2 - 2 * scale)), int(round(zy0 - 2 * scale)))

Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(sys.argv[2], quality=93)
print("scale for 6:", round(scale, 3), "zero rows", zy0, zy1, "six rows", sy0, sy1)

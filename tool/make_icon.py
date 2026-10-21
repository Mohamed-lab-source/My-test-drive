"""Draws the Khroga app icon (a white map pin with a sparkle on a warm
coral-to-magenta gradient, the app's default theme) and writes every size
Android needs.

Run:  pip install pillow && python3 tool/make_icon.py
Nothing here is downloaded; the icon is drawn from simple shapes.
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')

# Gradient stops, top-left to bottom-right (the Coral theme's colors).
STOPS = [(255, 138, 101), (226, 74, 52), (184, 23, 79)]  # #FF8A65 → #E24A34 → #B8174F
WHITE = (255, 255, 255, 255)
SPARKLE = (214, 52, 66, 255)

DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def gradient(size):
    img = Image.new('RGBA', (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            a, b, u = (STOPS[0], STOPS[1], t * 2) if t < 0.5 else (STOPS[1], STOPS[2], t * 2 - 1)
            px[x, y] = tuple(round(a[i] + (b[i] - a[i]) * u) for i in range(3)) + (255,)
    # A soft glow of light in the top-left corner.
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([-size * 0.35, -size * 0.35, size * 0.55, size * 0.55],
                                 fill=(255, 255, 255, 46))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(size * 0.2)))
    return img


def sparkle(draw, cx, cy, r, fill):
    """A four-pointed star."""
    pts = []
    for i in range(8):
        ang = math.pi / 4 * i - math.pi / 2
        rad = r if i % 2 == 0 else r * 0.32
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    draw.polygon(pts, fill=fill)


def pin_layer(size, scale, hole=False):
    """The pin, centred, `scale` = pin height as a share of the canvas."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    h = size * scale
    r = h / 2.75
    cx = size / 2
    cy = size / 2 - h / 2 + r
    tip = (cx, size / 2 + h / 2)
    dist = tip[1] - cy
    a = math.asin(r / dist)
    left = (cx - r * math.cos(a), cy + r * math.sin(a))
    right = (cx + r * math.cos(a), cy + r * math.sin(a))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)
    d.polygon([left, right, tip], fill=WHITE)
    star_fill = (0, 0, 0, 0) if hole else SPARKLE
    if hole:
        mask = Image.new('L', (size, size), 0)
        sparkle(ImageDraw.Draw(mask), cx, cy, r * 0.62, 255)
        img.putalpha(Image.composite(Image.new('L', (size, size), 0), img.getchannel('A'), mask))
    else:
        sparkle(d, cx, cy, r * 0.62, star_fill)
        # A tiny second sparkle for some magic.
        sparkle(d, cx + r * 0.55, cy - r * 0.55, r * 0.18, star_fill)
    return img


def with_shadow(layer, size):
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    alpha = layer.getchannel('A').point(lambda v: v * 0.28)
    shadow.putalpha(alpha)
    shadow = shadow.transform((size, size), Image.AFFINE, (1, 0, 0, 0, 1, -size * 0.012))
    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.015))
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.alpha_composite(shadow)
    out.alpha_composite(layer)
    return out


def rounded(img, radius_share):
    size = img.size[0]
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1],
                                           radius=size * radius_share, fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def save(img, path, px):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.resize((px, px), Image.LANCZOS).save(path, optimize=True)


def main():
    big = 1024
    bg = gradient(big)
    # Full icon (older phones, and the in-app logo).
    full = bg.copy()
    full.alpha_composite(with_shadow(pin_layer(big, 0.62), big))
    legacy = rounded(full, 0.22)
    round_icon = full.copy()
    m = Image.new('L', (big, big), 0)
    ImageDraw.Draw(m).ellipse([0, 0, big - 1, big - 1], fill=255)
    round_icon.putalpha(m)

    # Adaptive icon layers (Android 8+): 108dp canvas, keep the pin in the
    # 66dp safe zone so any mask shape (circle, squircle) looks right.
    fg = with_shadow(pin_layer(big, 0.47), big)
    mono = pin_layer(big, 0.47, hole=True)

    for name, k in DENSITIES.items():
        folder = os.path.join(RES, f'mipmap-{name}')
        save(legacy, os.path.join(folder, 'ic_launcher.png'), round(48 * k))
        save(round_icon, os.path.join(folder, 'ic_launcher_round.png'), round(48 * k))
        save(fg, os.path.join(folder, 'ic_launcher_foreground.png'), round(108 * k))
        save(bg, os.path.join(folder, 'ic_launcher_background.png'), round(108 * k))
        save(mono, os.path.join(folder, 'ic_launcher_monochrome.png'), round(108 * k))

    # Small white icon for outing reminders in the status bar (24dp).
    stat = pin_layer(big, 0.9, hole=True)
    for name, k in DENSITIES.items():
        save(stat, os.path.join(RES, f'drawable-{name}', 'ic_stat_khroga.png'), round(24 * k))

    save(legacy, os.path.join(ROOT, 'assets', 'icon', 'khroga.png'), 512)
    print('Icons written.')


if __name__ == '__main__':
    main()

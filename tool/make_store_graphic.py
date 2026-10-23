"""Draws the Google Play "feature graphic" (1024x500) and the 512px icon, in
the app's Mono look (black, white dots, one red signal dot).

Run:  pip install pillow && python3 tool/make_store_graphic.py
Writes store/feature-graphic.png and store/icon-512.png.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from make_icon import BLACK, SIGNAL, dot_pin, mono_bg  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'store')
FONTS = os.path.join(ROOT, 'assets', 'fonts')


def main():
    os.makedirs(OUT, exist_ok=True)
    w, h = 1024, 500
    img = Image.new('RGBA', (w, h), BLACK + (255,))
    # A faint dot grid, blended properly.
    dots = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dots)
    for y in range(10, h, 20):
        for x in range(10, w, 20):
            dd.ellipse([x - 1.2, y - 1.2, x + 1.2, y + 1.2], fill=(255, 255, 255, 28))
    img.alpha_composite(dots)
    pin = dot_pin(1024, 0.62).resize((300, 300), Image.LANCZOS)
    img.alpha_composite(pin, (60, 100))

    d = ImageDraw.Draw(img)
    word = ImageFont.truetype(os.path.join(FONTS, 'Doto_900Black.ttf'), 120)
    ar = ImageFont.truetype(os.path.join(FONTS, 'Alexandria_700Bold.ttf'), 58)
    small = ImageFont.truetype(os.path.join(FONTS, 'ReadexPro_500Medium.ttf'), 32)
    d.text((390, 95), 'KHROGA', font=word, fill='white')
    wx = 390 + d.textlength('KHROGA', font=word) + 10
    d.ellipse([wx, 190, wx + 18, 208], fill=SIGNAL)
    try:
        d.text((390, 235), 'خروجة', font=ar, fill='white', direction='rtl', language='ar')
    except (KeyError, ValueError):
        pass  # Arabic shaping needs libraqm; the English line is enough.
    d.text((390, 335), 'Real outings in Cairo, Giza', font=small, fill=(220, 220, 224))
    d.text((390, 378), 'and Alexandria. Free.', font=small, fill=(220, 220, 224))
    img.convert('RGB').save(os.path.join(OUT, 'feature-graphic.png'), optimize=True)

    # Play's icon: full square (Play rounds the corners itself).
    icon = mono_bg(1024)
    icon.alpha_composite(dot_pin(1024, 0.62))
    icon.resize((512, 512), Image.LANCZOS).convert('RGB').save(os.path.join(OUT, 'icon-512.png'), optimize=True)
    print('Store graphics written.')


if __name__ == '__main__':
    main()

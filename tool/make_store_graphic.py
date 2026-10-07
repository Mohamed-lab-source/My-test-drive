"""Draws the Google Play "feature graphic" (1024x500) and the 512px icon.

Run:  pip install pillow && python3 tool/make_store_graphic.py
Writes store/feature-graphic.png and store/icon-512.png.
"""
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'store')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def main():
    os.makedirs(OUT, exist_ok=True)
    w, h = 1024, 500
    img = Image.new('RGB', (w, h))
    px = img.load()
    top, bottom = (255, 138, 101), (201, 61, 27)
    for y in range(h):
        for x in range(w):
            t = (x / w * 0.6 + y / h * 0.4)
            px[x, y] = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    icon = Image.open(os.path.join(ROOT, 'assets', 'icon', 'khroga.png')).convert('RGBA').resize((260, 260))
    img.paste(icon, (70, 120), icon)
    d = ImageDraw.Draw(img)
    big = ImageFont.truetype(FONT, 96)
    ar = ImageFont.truetype(FONT, 64)
    small = ImageFont.truetype(FONT_REG, 34)
    d.text((380, 120), 'Khroga', font=big, fill='white')
    d.text((380, 235), 'خروجة', font=ar, fill='white', direction='rtl', language='ar')
    d.text((380, 330), 'Real outings in Cairo, Giza', font=small, fill='white')
    d.text((380, 375), 'and Alexandria. Free.', font=small, fill='white')
    img.save(os.path.join(OUT, 'feature-graphic.png'), optimize=True)
    Image.open(os.path.join(ROOT, 'assets', 'icon', 'khroga.png')).resize((512, 512), Image.LANCZOS).save(
        os.path.join(OUT, 'icon-512.png'), optimize=True)
    print('Store graphics written.')


if __name__ == '__main__':
    main()

# -*- coding: utf-8 -*-
"""
Promo banners for ArizaPro (Telegram channels / groups / Instagram).

Clean, modern "one-glance" creatives: a photographic background with a
brand duotone + dark gradient for legibility, a slightly tilted phone
mockup showing the real Mini App, a big headline and a free badge.
Minimal on-image text — the post caption carries the rest.

Reuses helpers from _make_video_pro.py (photo, glass, phone mockups).

Renders three ready-to-post sizes:
  ArizaPro_banner_square.png  1080x1080  Instagram feed / Telegram post
  ArizaPro_banner_story.png   1080x1920  Stories / Reels / status
  ArizaPro_banner_wide.png    1280x720   Telegram link preview / X / FB

Run:  python video/_make_banner.py            (all three)
      python video/_make_banner.py square     (one or more: square|story|wide)
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

import _make_video_pro as pro  # safe: that module only runs under __main__

HERE = Path(__file__).resolve().parent

font, rrect, wrap = pro.font, pro.rrect, pro.wrap
get_photo, frost, shadow, phone = pro.get_photo, pro.frost, pro.shadow, pro.phone
INK, SUB = pro.INK, pro.SUB
BLUE, VIOLET, SKY, EMER, AMBER, PINK = (
    pro.BLUE, pro.VIOLET, pro.SKY, pro.EMER, pro.AMBER, pro.PINK)

ACCENT = BLUE
PHOTO_ID = 1048   # architecture; swap for another Picsum id to restyle
WHITE = (255, 255, 255)


# ── background: photo + brand duotone + bottom-up dark gradient ──────
def hero_bg(size, accent):
    W, H = size
    im = ImageOps.fit(get_photo(PHOTO_ID), size, Image.LANCZOS).convert("RGBA")
    im = im.filter(ImageFilter.GaussianBlur(2))
    # brand color wash
    im = Image.alpha_composite(im, Image.new("RGBA", size, accent + (95,)))
    # vertical dark gradient (transparent top → dark bottom) for text room
    grad = Image.new("L", (1, H))
    for y in range(H):
        grad.putpixel((0, y), int(245 * ((y / H) ** 1.6)))
    dark = Image.merge("RGBA", [
        Image.new("L", size, 8), Image.new("L", size, 14),
        Image.new("L", size, 30), grad.resize((W, H))])
    im = Image.alpha_composite(im, dark)
    # subtle top darkening for the brand row legibility
    top = Image.new("L", (1, H))
    for y in range(H):
        top.putpixel((0, y), int(120 * max(0.0, 1 - y / (H * 0.28))))
    topdark = Image.merge("RGBA", [
        Image.new("L", size, 8), Image.new("L", size, 14),
        Image.new("L", size, 30), top.resize((W, H))])
    return Image.alpha_composite(im, topdark)


def tilted_phone(screen_fn, accent, scale, deg=-7):
    ph = phone(screen_fn, accent)
    pw, ph_h = int(pro.PW * scale), int(pro.PH * scale)
    ph = ph.resize((pw, ph_h), Image.LANCZOS)
    return ph.rotate(deg, expand=True, resample=Image.BICUBIC)


def soft_shadow(base, sprite, xy, blur=60, alpha=140, dy=28):
    """Drop a blurred shadow shaped like the sprite's alpha."""
    x, y = xy
    a = sprite.split()[-1].point(lambda v: int(v * alpha / 255))
    sh = Image.new("RGBA", sprite.size, (6, 12, 28, 255))
    sh.putalpha(a)
    lay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    lay.alpha_composite(sh, (x, y + dy))
    base.alpha_composite(lay.filter(ImageFilter.GaussianBlur(blur)))


def brand_row(d, x, y, fs=40):
    r = fs + 14
    d.ellipse([x, y, x + r, y + r], fill=ACCENT)
    d.text((x + (r - d.textlength("A", font=font(True, fs))) / 2, y + 4),
           "A", font=font(True, fs), fill=WHITE)
    d.text((x + r + 14, y + 2), "ArizaPro", font=font(True, fs), fill=WHITE)


def free_pill(d, x, y, fs=24, h=52):
    label = "BEPUL"
    w = d.textlength(label, font=font(True, fs))
    rrect(d, [x, y, x + w + 40, y + h], h // 2, EMER)
    d.text((x + 20, y + (h - fs) / 2 - 3), label, font=font(True, fs), fill=WHITE)


# ── square 1080x1080 ────────────────────────────────────────────────
def render_square(path):
    W = H = 1080
    img = hero_bg((W, H), ACCENT)
    ph = tilted_phone(pro.scr_home, ACCENT, 0.86)
    px, py = W - ph.width + 110, (H - ph.height) // 2 - 20
    soft_shadow(img, ph, (px, py))
    img.alpha_composite(ph, (px, py))
    d = ImageDraw.Draw(img, "RGBA")
    brand_row(d, 64, 70)
    free_pill(d, 64, 150)
    tf = font(True, 96); lines = wrap(d, "Sud hujjatlari\nbir daqiqada", tf, 760)
    y = H - 250 - len(lines) * 100
    for ln in lines:
        d.text((64, y), ln, font=tf, fill=WHITE); y += 100
    rrect(d, [68, y + 6, 68 + 110, y + 24], 9, ACCENT)
    d.text((64, H - 110), "Telegram bot va mini-ilova  —  bepul",
           font=font(False, 30), fill=(226, 232, 240))
    img.convert("RGB").save(path, quality=95)
    print(f"[OK] {path.name}  {W}x{H}")


# ── story 1080x1920 ─────────────────────────────────────────────────
def render_story(path):
    W, H = 1080, 1920
    img = hero_bg((W, H), ACCENT)
    cx = W // 2
    ph = tilted_phone(pro.scr_home, ACCENT, 1.15, deg=-5)
    px, py = (W - ph.width) // 2, 300
    soft_shadow(img, ph, (px, py), blur=70, dy=34)
    img.alpha_composite(ph, (px, py))
    d = ImageDraw.Draw(img, "RGBA")
    brand_row(d, cx - 150, 110, fs=52)
    free_pill(d, cx - 75, 210, fs=26, h=58)
    tf = font(True, 100); lines = wrap(d, "Sud hujjatlari\nbir daqiqada", tf, W - 140)
    y = H - 360 - len(lines) * 104
    for ln in lines:
        lw = d.textlength(ln, font=tf)
        d.text((cx - lw / 2, y), ln, font=tf, fill=WHITE); y += 104
    rrect(d, [cx - 60, y + 10, cx + 60, y + 30], 10, ACCENT)
    sub = "Telegram bot va mini-ilova  —  bepul"
    d.text((cx - d.textlength(sub, font=font(False, 34)) / 2, H - 150),
           sub, font=font(False, 34), fill=(226, 232, 240))
    img.convert("RGB").save(path, quality=95)
    print(f"[OK] {path.name}  {W}x{H}")


# ── wide 1280x720 ───────────────────────────────────────────────────
def render_wide(path):
    W, H = 1280, 720
    img = hero_bg((W, H), ACCENT)
    ph = tilted_phone(pro.scr_home, ACCENT, 0.62)
    px, py = W - ph.width - 70, (H - ph.height) // 2
    soft_shadow(img, ph, (px, py), blur=48, dy=22)
    img.alpha_composite(ph, (px, py))
    d = ImageDraw.Draw(img, "RGBA")
    brand_row(d, 64, 60, fs=38)
    free_pill(d, 64, 132, fs=22, h=48)
    tf = font(True, 78); lines = wrap(d, "Sud hujjatlari\nbir daqiqada", tf, px - 120)
    y = H - 200 - len(lines) * 82
    for ln in lines:
        d.text((64, y), ln, font=tf, fill=WHITE); y += 82
    rrect(d, [68, y + 4, 68 + 100, y + 20], 8, ACCENT)
    d.text((64, H - 96), "Telegram bot va mini-ilova  —  bepul",
           font=font(False, 27), fill=(226, 232, 240))
    img.convert("RGB").save(path, quality=95)
    print(f"[OK] {path.name}  {W}x{H}")


def main():
    get_photo(PHOTO_ID)
    which = sys.argv[1:] or ["square", "story", "wide"]
    if "square" in which:
        render_square(HERE / "ArizaPro_banner_square.png")
    if "story" in which:
        render_story(HERE / "ArizaPro_banner_story.png")
    if "wide" in which:
        render_wide(HERE / "ArizaPro_banner_wide.png")


if __name__ == "__main__":
    main()

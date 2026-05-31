# -*- coding: utf-8 -*-
"""
Promo banners for ArizaPro (Telegram channels / groups / Instagram).

Reuses the cinematic helpers from _make_video_pro.py (photographic
backgrounds + brand duotone, frosted glass, realistic phone mockups) and
lays them out as static marketing creatives with a bold headline, benefit
chips and a call-to-action.

Renders three ready-to-post sizes:
  ArizaPro_banner_square.png  1080x1080  Instagram feed / Telegram post
  ArizaPro_banner_story.png   1080x1920  Stories / Reels / status
  ArizaPro_banner_wide.png    1280x720   Telegram link preview / X / FB

Run:  python video/_make_banner.py            (all three)
      python video/_make_banner.py square     (one or more: square|story|wide)

Edit HANDLE below to your real bot username before posting.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

import _make_video_pro as pro  # safe: that module only runs under __main__

HERE = Path(__file__).resolve().parent

# ── EDIT ME ─────────────────────────────────────────────────────────
HANDLE = "@ArizaPro_bot"          # your real bot username
# --------------------------------------------------------------------

font, rrect, wrap = pro.font, pro.rrect, pro.wrap
photo_bg, frost, shadow, phone = pro.photo_bg, pro.frost, pro.shadow, pro.phone
INK, SUB = pro.INK, pro.SUB
BLUE, VIOLET, SKY, EMER, AMBER, PINK = (
    pro.BLUE, pro.VIOLET, pro.SKY, pro.EMER, pro.AMBER, pro.PINK)

ACCENT = BLUE
PHOTO_ID = 1048   # architecture; swap for another Picsum id to restyle


def chip(d, x, y, text, fg, bg, fs=22, pad=18, h=46):
    w = d.textlength(text, font=font(True, fs))
    rrect(d, [x, y, x + w + pad * 2, y + h], h // 2, bg)
    d.text((x + pad, y + (h - fs) / 2 - 3), text, font=font(True, fs), fill=fg)
    return x + w + pad * 2


def tint(color, k=0.84):
    return tuple(int(c + (255 - c) * k) for c in color)


def cta(d, box, label, accent):
    x0, y0, x1, y1 = box
    rrect(d, box, (y1 - y0) // 2, accent)
    fs = 30
    tw = d.textlength(label, font=font(True, fs))
    d.text(((x0 + x1) / 2 - tw / 2, (y0 + y1) / 2 - fs / 2 - 3),
           label, font=font(True, fs), fill=(255, 255, 255))


def free_badge(d, x, y):
    chip(d, x, y, "BEPUL", (255, 255, 255), EMER, fs=22, h=44)


# ── square 1080x1080 ────────────────────────────────────────────────
def render_square(path):
    W = H = 1080
    img = photo_bg(PHOTO_ID, (W, H), ACCENT)
    # phone on the right, slightly off the edge for energy
    scale = 0.92
    pw, ph = int(pro.PW * scale), int(pro.PH * scale)
    ph_img = phone(pro.scr_home, ACCENT).resize((pw, ph), Image.LANCZOS)
    px, py = W - pw + 70, (H - ph) // 2 + 10
    shadow(img, [px, py, px + pw, py + ph], 64)
    img.alpha_composite(ph_img, (px, py))

    panel = [56, 70, 660, 1010]
    frost(img, panel, white=152, radius=48)
    d = ImageDraw.Draw(img, "RGBA")
    lx = panel[0] + 50
    y = panel[1] + 56
    chip(d, lx, y, "ArizaPro", (255, 255, 255), ACCENT + (235,), fs=24, h=50)
    free_badge(d, lx + 168, y + 2)
    y += 96
    tf = font(True, 78)
    for ln in wrap(d, "Sud hujjatlari\nbir daqiqada", tf, panel[2] - lx - 24):
        d.text((lx, y), ln, font=tf, fill=INK); y += 90
    y += 8
    for ln in wrap(d, "Advokatsiz, mustaqil — Telegram bot va mini-ilova.",
                   font(False, 28), panel[2] - lx - 24):
        d.text((lx, y), ln, font=font(False, 28), fill=SUB); y += 40
    y += 30
    chips = [("PDF · Word", BLUE), ("3 tilda", VIOLET), ("Sud jadvali", EMER)]
    cx = lx
    for label, col in chips:
        cx = chip(d, cx, y, label, col, tint(col), fs=22, h=48) + 14
        if cx > panel[2] - 140:
            cx = lx; y += 60
    y += 78
    cta(d, [lx, y, panel[2] - 30, y + 78], f"Telegram'da oching  {HANDLE}", ACCENT)
    img.convert("RGB").save(path, quality=95)
    print(f"[OK] {path.name}  {W}x{H}")


# ── story 1080x1920 ─────────────────────────────────────────────────
def render_story(path):
    W, H = 1080, 1920
    img = photo_bg(PHOTO_ID, (W, H), ACCENT)
    cx = W // 2
    d0 = ImageDraw.Draw(img, "RGBA")
    # top brand row
    chip(d0, 70, 90, "ArizaPro", (255, 255, 255), ACCENT + (235,), fs=30, h=62)
    free_badge(d0, W - 70 - 110, 100)
    # phone centered
    scale = 1.16
    pw, ph = int(pro.PW * scale), int(pro.PH * scale)
    ph_img = phone(pro.scr_home, ACCENT).resize((pw, ph), Image.LANCZOS)
    px, py = (W - pw) // 2, 230
    shadow(img, [px, py, px + pw, py + ph], 80)
    img.alpha_composite(ph_img, (px, py))

    panel = [56, 1360, W - 56, 1850]
    frost(img, panel, white=152, radius=54)
    d = ImageDraw.Draw(img, "RGBA")
    y = panel[1] + 50
    tf = font(True, 84)
    for ln in wrap(d, "Sud hujjatlari bir daqiqada", tf, W - 200):
        lw = d.textlength(ln, font=tf)
        d.text((cx - lw / 2, y), ln, font=tf, fill=INK); y += 94
    y += 8
    sub = "PDF · Word · 3 tilda  —  bepul"
    d.text((cx - d.textlength(sub, font=font(False, 32)) / 2, y),
           sub, font=font(False, 32), fill=SUB)
    y += 78
    cta(d, [panel[0] + 40, y, panel[2] - 40, y + 92],
        f"Telegram'da oching  {HANDLE}", ACCENT)
    img.convert("RGB").save(path, quality=95)
    print(f"[OK] {path.name}  {W}x{H}")


# ── wide 1280x720 (link preview / X / FB) ───────────────────────────
def render_wide(path):
    W, H = 1280, 720
    img = photo_bg(PHOTO_ID, (W, H), ACCENT)
    scale = 0.64
    pw, ph = int(pro.PW * scale), int(pro.PH * scale)
    ph_img = phone(pro.scr_home, ACCENT).resize((pw, ph), Image.LANCZOS)
    px, py = W - pw - 90, (H - ph) // 2
    shadow(img, [px, py, px + pw, py + ph], 54)
    img.alpha_composite(ph_img, (px, py))

    panel = [56, 70, px - 60, 650]
    frost(img, panel, white=152, radius=44)
    d = ImageDraw.Draw(img, "RGBA")
    lx = panel[0] + 48
    y = panel[1] + 46
    chip(d, lx, y, "ArizaPro", (255, 255, 255), ACCENT + (235,), fs=24, h=50)
    free_badge(d, lx + 168, y + 2)
    y += 88
    tf = font(True, 64)
    for ln in wrap(d, "Sud hujjatlari\nbir daqiqada", tf, panel[2] - lx - 24):
        d.text((lx, y), ln, font=tf, fill=INK); y += 74
    y += 6
    for ln in wrap(d, "Advokatsiz, mustaqil — Telegram bot va mini-ilova.",
                   font(False, 26), panel[2] - lx - 24):
        d.text((lx, y), ln, font=font(False, 26), fill=SUB); y += 36
    y += 24
    cx = lx
    for label, col in [("PDF · Word", BLUE), ("3 tilda", VIOLET), ("Sud jadvali", EMER)]:
        cx = chip(d, cx, y, label, col, tint(col), fs=21, h=46) + 12
    y += 74
    cta(d, [lx, y, panel[2] - 28, y + 70], f"Telegram'da oching  {HANDLE}", ACCENT)
    img.convert("RGB").save(path, quality=95)
    print(f"[OK] {path.name}  {W}x{H}")


def main():
    pro.get_photo(PHOTO_ID)
    which = sys.argv[1:] or ["square", "story", "wide"]
    if "square" in which:
        render_square(HERE / "ArizaPro_banner_square.png")
    if "story" in which:
        render_story(HERE / "ArizaPro_banner_story.png")
    if "wide" in which:
        render_wide(HERE / "ArizaPro_banner_wide.png")


if __name__ == "__main__":
    main()

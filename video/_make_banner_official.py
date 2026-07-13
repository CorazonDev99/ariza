# -*- coding: utf-8 -*-
"""
Official / formal promo banner for ArizaPro.

Strict, government-document look: deep navy + gold, a scales-of-justice
emblem, an architectural photo dimmed under a heavy navy veil, a tracked
uppercase headline, gold value bullets and a CTA band. No flashy gradients.

Renders:
  ArizaPro_official_square.png  1080x1080  Telegram / Instagram post
  ArizaPro_official_wide.png    1280x720   link preview / X / FB

Run:  python video/_make_banner_official.py
"""
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

HERE = Path(__file__).resolve().parent
PHOTOS = HERE / "_photos"
PHOTOS.mkdir(exist_ok=True)
FB = "C:/Windows/Fonts"

PHOTO_ID = 1048          # architecture; swap for another Picsum id
HANDLE = "@ariza_pro_bot"  # ← put the real bot username

NAVY = (14, 30, 56)
NAVY_2 = (10, 22, 42)
GOLD = (201, 162, 75)
GOLD_L = (214, 179, 104)
WHITE = (241, 244, 248)
MUTE = (169, 182, 204)


def font(b, s):
    return ImageFont.truetype(f"{FB}/{'arialbd' if b else 'arial'}.ttf", s)


def get_photo(pid, size):
    fp = PHOTOS / f"hi{pid}.jpg"
    if not fp.exists():
        urllib.request.urlretrieve(
            f"https://picsum.photos/id/{pid}/1600/1600.jpg", fp)
    im = ImageOps.fit(Image.open(fp).convert("RGB"), size, Image.LANCZOS)
    return im


def bg(size):
    W, H = size
    im = get_photo(PHOTO_ID, size)
    im = ImageOps.grayscale(im).convert("RGB")
    im = im.filter(ImageFilter.GaussianBlur(3)).convert("RGBA")
    # heavy navy veil for an official, high-contrast look
    im = Image.alpha_composite(im, Image.new("RGBA", size, NAVY + (214,)))
    # bottom-up deepening
    grad = Image.new("L", (1, H))
    for y in range(H):
        grad.putpixel((0, y), int(150 * (y / H) ** 1.5))
    dark = Image.merge("RGBA", [Image.new("L", size, NAVY_2[0]),
                                Image.new("L", size, NAVY_2[1]),
                                Image.new("L", size, NAVY_2[2]),
                                grad.resize(size)])
    im = Image.alpha_composite(im, dark)
    # thin gold frame
    d = ImageDraw.Draw(im, "RGBA")
    m = int(min(W, H) * 0.035)
    d.rectangle([m, m, W - m, H - m], outline=GOLD + (150,), width=2)
    return im


def scales(d, cx, cy, r, color):
    """Draw a simple scales-of-justice emblem centered at (cx, cy)."""
    w = int(r * 2)
    lw = max(3, r // 12)
    top = cy - r
    d.line([(cx, top), (cx, cy + r)], fill=color, width=lw)          # post
    d.line([(cx - r, top + r // 3), (cx + r, top + r // 3)],
           fill=color, width=lw)                                     # beam
    d.line([(cx - int(r * 0.5), cy + r), (cx + int(r * 0.5), cy + r)],
           fill=color, width=lw)                                     # base
    for sx in (cx - r, cx + r):                                      # pans
        by = top + r // 3
        d.line([(sx, by), (sx - r // 2, by + int(r * 0.75))], fill=color, width=lw)
        d.line([(sx, by), (sx + r // 2, by + int(r * 0.75))], fill=color, width=lw)
        d.arc([sx - r // 2, by + int(r * 0.55), sx + r // 2, by + int(r * 0.95)],
              0, 180, fill=color, width=lw)
    d.ellipse([cx - lw, top - lw, cx + lw, top + lw], fill=color)    # finial
    _ = w


def emblem(d, cx, cy, R):
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=GOLD, width=3)
    scales(d, cx, cy + int(R * 0.05), int(R * 0.52), GOLD)


def tracked(d, xy, text, fnt, fill, ls):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=fnt, fill=fill)
        x += d.textlength(ch, font=fnt) + ls
    return x


def bullet(d, x, y, text, fs):
    s = fs // 3
    d.polygon([(x, y + fs // 2), (x + s, y + fs // 2 - s),
               (x + 2 * s, y + fs // 2), (x + s, y + fs // 2 + s)], fill=GOLD)
    d.text((x + 2 * s + 16, y), text, font=font(False, fs), fill=WHITE)


def wrap(d, text, fnt, maxw):
    out = []
    for raw in text.split("\n"):
        line = ""
        for w in raw.split(" "):
            t = (line + " " + w).strip()
            if d.textlength(t, font=fnt) <= maxw or not line:
                line = t
            else:
                out.append(line); line = w
        out.append(line)
    return out


def render(size, path, headline, sub, bullets, big):
    W, H = size
    img = bg(size)
    d = ImageDraw.Draw(img, "RGBA")
    cx = W // 2

    # ── header: emblem + wordmark ───────────────────────────────
    ey = int(H * (0.145 if big else 0.16))
    emblem(d, cx, ey, int(min(W, H) * (0.075 if big else 0.07)))
    wf = font(True, int(min(W, H) * (0.052 if big else 0.05)))
    tw = sum(d.textlength(c, font=wf) + 3 for c in "ARIZAPRO")
    tracked(d, (cx - tw / 2, ey + int(min(W, H) * 0.09)), "ARIZAPRO", wf, WHITE, 3)
    ef = font(False, int(min(W, H) * 0.019))
    et = "O‘ZBEKISTON  SUDLARI  UCHUN  RASMIY  YORDAMCHI"
    etw = sum(d.textlength(c, font=ef) + 2 for c in et)
    tracked(d, (cx - etw / 2, ey + int(min(W, H) * 0.155)), et, ef, GOLD_L, 2)

    # ── headline ────────────────────────────────────────────────
    hy = int(H * (0.4 if big else 0.36))
    hf = font(True, int(min(W, H) * (0.075 if big else 0.072)))
    lines = wrap(d, headline, hf, W - 2 * int(W * 0.12))
    for ln in lines:
        lw = d.textlength(ln, font=hf)
        d.text((cx - lw / 2, hy), ln, font=hf, fill=WHITE)
        hy += int(min(W, H) * (0.085 if big else 0.082))
    # gold rule
    d.rectangle([cx - 46, hy + 6, cx + 46, hy + 11], fill=GOLD)
    hy += int(min(W, H) * 0.05)
    sf = font(False, int(min(W, H) * 0.026))
    for ln in wrap(d, sub, sf, W - 2 * int(W * 0.14)):
        lw = d.textlength(ln, font=sf)
        d.text((cx - lw / 2, hy), ln, font=sf, fill=MUTE)
        hy += int(min(W, H) * 0.036)

    # ── bullets (left aligned within a centered block) ──────────
    if big:
        by = hy + int(H * 0.03)
        bx = int(W * 0.28)
        for b in bullets:
            bullet(d, bx, by, b, int(min(W, H) * 0.028))
            by += int(min(W, H) * 0.058)

    # ── CTA band ────────────────────────────────────────────────
    bh = int(H * 0.11)
    d.rectangle([0, H - bh, W, H], fill=GOLD)
    cf = font(True, int(bh * 0.34))
    ct = f"TELEGRAM   ·   {HANDLE}"
    ctw = sum(d.textlength(c, font=cf) + 2 for c in ct)
    tracked(d, (cx - ctw / 2, H - bh + (bh - int(bh * 0.34)) / 2 - 2),
            ct, cf, NAVY_2, 2)

    img.convert("RGB").save(path, quality=95)
    print(f"[OK] {path.name}  {W}x{H}")


def main():
    which = sys.argv[1:] or ["square", "wide"]
    headline = "SUD HUJJATLARI\nBIR DAQIQADA"
    sub = "Rasmiy arizalar — imzo va sanaga tayyor. Advokatsiz, mustaqil, bepul."
    bullets = [
        "Ariza PDF yoki Word — 3 tilda",
        "Sud majlislari jadvalini tekshirish",
        "Barcha sudlar ma'lumotnomasi",
    ]
    if "square" in which:
        render((1080, 1080), HERE / "ArizaPro_official_square.png",
               headline, sub, bullets, big=True)
    if "wide" in which:
        render((1280, 720), HERE / "ArizaPro_official_wide.png",
               headline.replace("\n", " "), sub, bullets, big=False)


if __name__ == "__main__":
    main()

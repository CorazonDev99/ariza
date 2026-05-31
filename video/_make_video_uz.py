# -*- coding: utf-8 -*-
"""
Modern, LIGHT, example-driven ~1-min Uzbek (latin) overview video for
ArizaPro. Renders realistic phone-mockup scenes (Telegram chat, Mini App
home, wizard, schedule, court card, ready document) on a bright aurora
background, adds Ken-Burns motion + crossfade transitions, and an Uzbek
voiceover (edge-tts). Stitched with the imageio-ffmpeg binary.

Run:  python video/_make_video_uz.py
Out:  video/ArizaPro_instruction_uz.mp4
"""
import asyncio
import math
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import edge_tts
import imageio_ffmpeg

HERE = Path(__file__).resolve().parent
WORK = HERE / "_work_uz"
WORK.mkdir(exist_ok=True)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

W, H = 1920, 1080
VOICE = "uz-UZ-SardorNeural"
FB = "C:/Windows/Fonts"

# ── palette (light / bright) ───────────────────────────────────────
INK = (15, 23, 42)        # slate-900
SUB = (100, 116, 139)     # slate-500
CARD = (255, 255, 255)
BLUE = (37, 99, 235)
VIOLET = (124, 58, 237)
SKY = (14, 165, 233)
EMER = (16, 185, 129)
AMBER = (245, 158, 11)
PINK = (219, 39, 119)


def font(bold, size):
    return ImageFont.truetype(f"{FB}/{'arialbd' if bold else 'arial'}.ttf", size)


def rrect(d, box, r, fill, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def shadow(base, box, r, blur=40, alpha=55, dy=18):
    """Soft drop shadow behind a rounded card."""
    lay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    x0, y0, x1, y1 = box
    ld.rounded_rectangle([x0, y0 + dy, x1, y1 + dy], radius=r, fill=(15, 23, 42, alpha))
    lay = lay.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(lay)


def wrap(d, text, fnt, maxw):
    out = []
    for raw in text.split("\n"):
        line = ""
        for w in raw.split(" "):
            t = (line + " " + w).strip()
            if d.textlength(t, font=fnt) <= maxw or not line:
                line = t
            else:
                out.append(line)
                line = w
        out.append(line)
    return out


def light_bg():
    """Bright background with soft colorful aurora blobs."""
    img = Image.new("RGBA", (W, H), (244, 247, 252, 255))
    blobs = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(blobs)
    spots = [
        (W * 0.82, H * 0.12, 560, BLUE, 70),
        (W * 0.92, H * 0.78, 520, VIOLET, 60),
        (W * 0.08, H * 0.85, 480, SKY, 55),
        (W * 0.05, H * 0.10, 420, EMER, 45),
    ]
    for cx, cy, rad, col, a in spots:
        bd.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=col + (a,))
    blobs = blobs.filter(ImageFilter.GaussianBlur(150))
    img.alpha_composite(blobs)
    return img


# ── phone mockup ───────────────────────────────────────────────────
PHONE_W, PHONE_H = 470, 950
SCREEN_PAD = 16
SCREEN_R = 46


def phone(screen_draw_fn, accent=BLUE):
    """Returns an RGBA phone image; screen_draw_fn(draw, x, y, w, h)."""
    img = Image.new("RGBA", (PHONE_W, PHONE_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # body
    rrect(d, [0, 0, PHONE_W, PHONE_H], 70, (17, 24, 39, 255))
    sx, sy = SCREEN_PAD, SCREEN_PAD
    sw, sh = PHONE_W - 2 * SCREEN_PAD, PHONE_H - 2 * SCREEN_PAD
    # screen base (light)
    scr = Image.new("RGBA", (sw, sh), (247, 248, 251, 255))
    sd = ImageDraw.Draw(scr)
    screen_draw_fn(sd, sw, sh, accent)
    # round the screen corners with a mask
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw, sh], radius=SCREEN_R, fill=255)
    img.paste(scr, (sx, sy), mask)
    # notch
    d.rounded_rectangle([PHONE_W / 2 - 70, 26, PHONE_W / 2 + 70, 52], radius=13,
                        fill=(17, 24, 39, 255))
    return img


def tg_header(sd, sw, title, sub, accent):
    sd.rectangle([0, 0, sw, 96], fill=accent)
    sd.ellipse([20, 26, 64, 70], fill=(255, 255, 255, 60))
    sd.text((34, 38), "A", font=font(True, 26), fill=(255, 255, 255))
    sd.text((80, 28), title, font=font(True, 25), fill=(255, 255, 255))
    sd.text((80, 60), sub, font=font(False, 18), fill=(255, 255, 255, 220))


def bubble(sd, x, y, w, text, fnt, mine, accent):
    lines = wrap(sd, text, fnt, w - 36)
    h = 22 + len(lines) * 30
    col = accent if mine else (255, 255, 255)
    tx = (255, 255, 255) if mine else INK
    bx = x if not mine else x
    rrect(sd, [bx, y, bx + w, y + h], 22, col)
    yy = y + 12
    for ln in lines:
        sd.text((bx + 18, yy), ln, font=fnt, fill=tx)
        yy += 30
    return y + h + 16


# ── screen renderers ───────────────────────────────────────────────

def scr_chat(sd, sw, sh, accent):
    tg_header(sd, sw, "ArizaPro", "bot  ·  online", accent)
    f = font(False, 19)
    y = 120
    y = bubble(sd, 24, y, 300, "Aliment undirish · ariza", f, False, accent)
    y = bubble(sd, 24, y, 320, "F.I.SH. ni kiriting:", f, False, accent)
    y = bubble(sd, sw - 24 - 280, y, 280, "Karimov Alisher Botirovich", f, True, accent)
    y = bubble(sd, 24, y, 320, "Telefon raqamini kiriting:", f, False, accent)
    y = bubble(sd, sw - 24 - 220, y, 220, "+998 90 123 45 67", f, True, accent)
    # quick-reply buttons
    for i, t in enumerate(["Orqaga", "Davom etish"]):
        bx = 24 + i * 195
        rrect(sd, [bx, y + 6, bx + 178, y + 56], 16, (236, 240, 247))
        tw = sd.textlength(t, font=font(True, 18))
        sd.text((bx + (178 - tw) / 2, y + 20), t, font=font(True, 18), fill=accent)


def tile(sd, x, y, w, h, color, icon, title):
    rrect(sd, [x, y, x + w, y + h], 22, (255, 255, 255))
    rrect(sd, [x + 16, y + 16, x + 16 + 52, y + 16 + 52], 16,
          tuple(int(c + (255 - c) * 0.84) for c in color))
    sd.text((x + 30, y + 24), icon, font=font(True, 30), fill=color)
    for i, ln in enumerate(wrap(sd, title, font(True, 19), w - 32)):
        sd.text((x + 16, y + 84 + i * 24), ln, font=font(True, 19), fill=INK)


def scr_home(sd, sw, sh, accent):
    # bright app header
    sd.text((26, 30), "ArizaPro", font=font(True, 34), fill=INK)
    sd.text((28, 76), "O'zbekiston sudlari uchun yordamchi", font=font(False, 16), fill=SUB)
    g = 18
    cw = (sw - 48 - g) // 2
    ch = 150
    x0, x1 = 24, 24 + cw + g
    y0 = 128
    tile(sd, x0, y0, cw, ch, BLUE, "+", "Ariza topshirish")
    tile(sd, x1, y0, cw, ch, EMER, "?", "Ishimni tekshirish")
    tile(sd, x0, y0 + ch + g, cw, ch, AMBER, "i", "Qo'llanma")
    tile(sd, x1, y0 + ch + g, cw, ch, SKY, "#", "Sudlar ma'lumoti")


def scr_wizard(sd, sw, sh, accent):
    tg_header(sd, sw, "Ariza", "3 / 9", accent)
    # progress
    rrect(sd, [24, 120, sw - 24, 132], 6, (230, 234, 242))
    rrect(sd, [24, 120, 24 + int((sw - 48) * 0.34), 132], 6, accent)
    sd.text((26, 154), "Manzil", font=font(True, 24), fill=INK)
    rrect(sd, [24, 196, sw - 24, 300], 18, (255, 255, 255), outline=(225, 230, 240), width=2)
    sd.text((40, 222), "Toshkent sh., Yunusobod t.,", font=font(False, 19), fill=INK)
    sd.text((40, 252), "Amir Temur ko'chasi, 12-uy", font=font(False, 19), fill=INK)
    rrect(sd, [24, sh - 110, sw - 24, sh - 44], 18, accent)
    t = "Hujjatni shakllantirish"
    sd.text(((sw - sd.textlength(t, font=font(True, 21))) / 2, sh - 92), t,
            font=font(True, 21), fill=(255, 255, 255))


def card(sd, x, y, w, h, r=18):
    rrect(sd, [x, y, x + w, y + h], r, (255, 255, 255), outline=(228, 232, 240), width=2)


def scr_schedule(sd, sw, sh, accent):
    tg_header(sd, sw, "Ishimni tekshirish", "Toshkent sh.", accent)
    items = [("09:30", "2-1701-2608/20479", "Fuqarolik"),
             ("10:15", "1-1801-2511/00342", "Jinoyat"),
             ("11:00", "4-1902-2604/01188", "Iqtisodiy")]
    y = 120
    for tm, num, cat in items:
        card(sd, 24, y, sw - 48, 132)
        rrect(sd, [40, y + 18, 40 + 96, y + 18 + 38], 19,
              tuple(int(c + (255 - c) * 0.84) for c in accent))
        sd.text((54, y + 24), tm, font=font(True, 22), fill=accent)
        sd.text((40, y + 70), num, font=font(False, 20), fill=INK)
        sd.text((sw - 48 - sd.textlength(cat, font=font(False, 17)) - 16, y + 24), cat,
                font=font(False, 17), fill=SUB)
        y += 150


def row(sd, x, y, w, label, value, accent):
    sd.text((x, y), label, font=font(False, 16), fill=SUB)
    for i, ln in enumerate(wrap(sd, value, font(True, 19), w)):
        sd.text((x, y + 24 + i * 26), ln, font=font(True, 19), fill=INK)


def scr_court(sd, sw, sh, accent):
    sd.text((26, 30), "Sud ma'lumoti", font=font(True, 28), fill=INK)
    card(sd, 24, 86, sw - 48, sh - 200, r=22)
    x, y = 48, 120
    sd.text((x, y), "Toshkent shahar fuqarolik sudi", font=font(True, 22), fill=INK)
    y += 56
    row(sd, x, y, sw - 96, "Manzil", "Toshkent sh., Navoiy ko'chasi, 24", accent); y += 86
    row(sd, x, y, sw - 96, "Telefon", "(71) 244-50-50", accent); y += 64
    row(sd, x, y, sw - 96, "E-pochta", "info@sud.uz", accent); y += 80
    rrect(sd, [x, y, sw - 48, y + 60], 16, accent)
    t = "Xaritada ochish"
    sd.text((x + (sw - 48 - x - sd.textlength(t, font=font(True, 20))) / 2, y + 16), t,
            font=font(True, 20), fill=(255, 255, 255))


def scr_done(sd, sw, sh, accent):
    cx = sw / 2
    sd.ellipse([cx - 70, 150, cx + 70, 290], fill=EMER)
    sd.line([(cx - 32, 222), (cx - 8, 248), (cx + 36, 196)], fill=(255, 255, 255), width=12,
            joint="curve")
    t1 = "Hujjat tayyor!"
    sd.text((cx - sd.textlength(t1, font=font(True, 30)) / 2, 320), t1,
            font=font(True, 30), fill=INK)
    # doc preview
    card(sd, 70, 400, sw - 140, sh - 520, r=16)
    for i in range(7):
        wln = (sw - 200) if i not in (0,) else (sw - 320)
        rrect(sd, [96, 440 + i * 40, 96 + (wln - (i * 17 % 90)), 440 + i * 40 + 16], 8,
              (232, 236, 243))
    # format chips
    for i, (lbl, col) in enumerate([("PDF", PINK), ("DOCX", BLUE)]):
        bx = 96 + i * 150
        rrect(sd, [bx, sh - 96, bx + 130, sh - 44], 16,
              tuple(int(c + (255 - c) * 0.84) for c in col))
        sd.text((bx + 28, sh - 84), lbl, font=font(True, 22), fill=col)


# ── scenes: (eyebrow, title, accent, screen_fn, narration) ─────────
SCENES = [
    ("ArizaPro", "Sud hujjatlari\nbir daqiqada", BLUE, scr_chat,
     "ArizaPro — O'zbekiston fuqarolari uchun sud hujjatlarini bir "
     "daqiqada tayyorlaydigan Telegram bot va mini-ilova."),
    ("Qanday ishlaydi", "Savol — javob —\ntayyor hujjat", VIOLET, scr_chat,
     "Bot oddiy savollar beradi va har bir javobni real vaqtda "
     "tekshiradi. Advokatsiz, mustaqil ravishda."),
    ("Mini App", "Zamonaviy\nmini-ilova", SKY, scr_home,
     "Xohlasangiz, zamonaviy mini-ilova orqali: ariza topshirish, ishni "
     "tekshirish, qo'llanma va sudlar ma'lumoti."),
    ("Hujjat", "PDF yoki Word,\nuch tilda", BLUE, scr_wizard,
     "Savol-javob asosida tayyor hujjat PDF yoki Word formatida, uch "
     "tilda — o'zbek va rus tillarida shakllanadi."),
    ("Ishimni tekshirish", "Sud majlislari\njadvali", EMER, scr_schedule,
     "Ishingizni tekshiring: sud majlislari jadvalini hudud va sud "
     "bo'yicha ko'ring, familiya yoki ish raqami orqali qidiring."),
    ("Sudlar ma'lumoti", "Barcha sudlar\nma'lumotnomasi", SKY, scr_court,
     "Barcha sudlar ma'lumotnomasi: manzil, telefon, elektron pochta va "
     "xaritadagi joylashuv."),
    ("Natija", "Hujjat\nsoniyalarda", PINK, scr_done,
     "Hujjat bir necha soniyada tayyor bo'ladi — uni yuklab oling yoki "
     "QR-kod orqali qayta oching."),
    ("ArizaPro", "Adolatga\nbir daqiqada", VIOLET, scr_home,
     "ArizaPro — adolatga bir daqiqada yo'l. Telegram'da hoziroq oching."),
]


def render_scene(i, sc, path):
    eyebrow, title, accent, screen_fn, _ = sc
    img = light_bg()
    d = ImageDraw.Draw(img, "RGBA")

    # right-side phone
    ph = phone(lambda sd, sw, sh, a: screen_fn(sd, sw, sh, a), accent=accent)
    px = int(W * 0.60)
    py = (H - PHONE_H) // 2
    shadow(img, [px, py, px + PHONE_W, py + PHONE_H], 70, blur=55, alpha=70, dy=26)
    img.alpha_composite(ph, (px, py))

    # left text column
    lx = 130
    # eyebrow chip
    ef = font(True, 30)
    cw = d.textlength(eyebrow.upper(), font=ef)
    rrect(d, [lx, 300, lx + cw + 56, 360], 30,
          tuple(int(c + (255 - c) * 0.86) for c in accent))
    d.text((lx + 28, 312), eyebrow.upper(), font=ef, fill=accent)
    # title
    tf = font(True, 92)
    y = 392
    for ln in wrap(d, title, tf, px - lx - 60):
        d.text((lx, y), ln, font=tf, fill=INK)
        y += 108
    # underline accent
    rrect(d, [lx, y + 8, lx + 96, y + 24], 8, accent)

    # footer
    d.text((lx, H - 96), "ArizaPro  ·  Telegram bot & Mini App",
           font=font(False, 26), fill=SUB)
    img.convert("RGB").save(path, quality=95)


async def tts(text, out):
    await edge_tts.Communicate(text, VOICE).save(str(out))


def ff(args):
    subprocess.run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", *args], check=True)


def duration(path):
    r = subprocess.run([FFMPEG, "-i", str(path)], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", r.stderr)
    h, mi, s = (float(x) for x in m.groups())
    return h * 3600 + mi * 60 + s


def main():
    pngs, mp3s, durs = [], [], []
    for i, sc in enumerate(SCENES):
        p = WORK / f"s{i}.jpg"
        render_scene(i, sc, p)
        pngs.append(p)
    print(f"Rendered {len(pngs)} scenes")

    have_audio = True
    try:
        for i, sc in enumerate(SCENES):
            m = WORK / f"v{i}.mp3"
            asyncio.run(tts(sc[4], m))
            if m.stat().st_size < 800:
                raise RuntimeError("empty tts")
            mp3s.append(m)
            durs.append(duration(m) + 0.7)
    except Exception as e:
        have_audio = False
        durs = [6.5] * len(SCENES)
        print(f"! TTS unavailable ({e}); silent fallback")
    else:
        print("Uzbek voiceover generated")

    # per-scene clip with Ken-Burns zoom
    XF = 0.5  # crossfade seconds
    segs = []
    for i, sc in enumerate(SCENES):
        seg = WORK / f"clip{i}.mp4"
        dur = durs[i]
        frames = max(1, int(round(dur * 30)))
        zoom = ("zoompan=z='min(zoom+0.0006,1.10)':"
                if i % 2 == 0 else
                "zoompan=z='if(eq(on,0),1.10,max(zoom-0.0006,1.0))':")
        vf = (f"[0:v]scale=1920:1080,{zoom}"
              f"d={frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
              f"s=1920x1080:fps=30,format=yuv420p[v]")
        args = ["-loop", "1", "-i", str(pngs[i])]
        if have_audio:
            args += ["-i", str(mp3s[i])]
        args += ["-filter_complex", vf, "-map", "[v]"]
        if have_audio:
            args += ["-map", "1:a", "-af", "apad=pad_dur=0.7",
                     "-c:a", "aac", "-b:a", "192k"]
        args += ["-t", f"{dur:.3f}", "-c:v", "libx264", "-r", "30",
                 "-pix_fmt", "yuv420p", str(seg)]
        ff(args)
        segs.append(seg)
    print("Built clips, now crossfading…")

    # pairwise xfade + acrossfade
    cur = segs[0]
    total = durs[0]
    for i in range(1, len(segs)):
        out = WORK / f"merge{i}.mp4"
        off = max(0.1, total - XF)
        if have_audio:
            fc = (f"[0:v][1:v]xfade=transition=fade:duration={XF}:offset={off:.3f}[v];"
                  f"[0:a][1:a]acrossfade=d={XF}[a]")
            maps = ["-map", "[v]", "-map", "[a]", "-c:a", "aac", "-b:a", "192k"]
        else:
            fc = f"[0:v][1:v]xfade=transition=fade:duration={XF}:offset={off:.3f}[v]"
            maps = ["-map", "[v]"]
        ff(["-i", str(cur), "-i", str(segs[i]), "-filter_complex", fc,
            *maps, "-c:v", "libx264", "-r", "30", "-pix_fmt", "yuv420p", str(out)])
        cur = out
        total = total + durs[i] - XF

    final = HERE / "ArizaPro_instruction_uz.mp4"
    ff(["-i", str(cur), "-c", "copy", str(final)])
    print(f"[OK] {final.name}  ~{total:.0f}s  ({final.stat().st_size // 1024} KB, audio={have_audio})")


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""
Cinematic ~60s Uzbek (latin) overview for ArizaPro.

Real photographic backgrounds (Picsum / Unsplash-sourced, free) with a
light brand duotone + frosted-glass panels and realistic phone mockups
(Telegram chat, Mini App, schedule, court card, ready doc). Female
voiceover (uz-UZ-Madina) + a synthesized soft ambient music bed. Renders
BOTH landscape 16:9 and vertical 9:16 (Stories/Reels). Ken-Burns zoom
(oversampled 3x for smooth motion) + crossfade transitions.

Run: python video/_make_video_pro.py
Out: video/ArizaPro_uz_16x9.mp4  and  video/ArizaPro_uz_9x16.mp4
"""
import asyncio
import re
import subprocess
import urllib.request
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
import edge_tts
import imageio_ffmpeg

HERE = Path(__file__).resolve().parent
WORK = HERE / "_work_pro"
PHOTOS = HERE / "_photos"
WORK.mkdir(exist_ok=True)
PHOTOS.mkdir(exist_ok=True)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
FB = "C:/Windows/Fonts"
VOICE = "uz-UZ-MadinaNeural"

INK = (15, 23, 42)
SUB = (90, 105, 130)
BLUE = (37, 99, 235); VIOLET = (124, 58, 237); SKY = (14, 165, 233)
EMER = (16, 185, 129); AMBER = (245, 158, 11); PINK = (219, 39, 119)


def font(b, s):
    return ImageFont.truetype(f"{FB}/{'arialbd' if b else 'arial'}.ttf", s)


def rrect(d, box, r, fill, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


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


def get_photo(pid):
    fp = PHOTOS / f"hi{pid}.jpg"
    if not fp.exists():
        urllib.request.urlretrieve(f"https://picsum.photos/id/{pid}/1600/1000.jpg", fp)
    return Image.open(fp).convert("RGB")


def photo_bg(pid, size, accent):
    im = ImageOps.fit(get_photo(pid), size, Image.LANCZOS)
    im = im.filter(ImageFilter.GaussianBlur(8)).convert("RGBA")
    im = Image.alpha_composite(im, Image.new("RGBA", size, (255, 255, 255, 104)))
    im = Image.alpha_composite(im, Image.new("RGBA", size, accent + (30,)))
    return im


def frost(base, box, blur=24, white=140, radius=44, border=True):
    x0, y0, x1, y1 = [int(v) for v in box]
    reg = base.crop((x0, y0, x1, y1)).filter(ImageFilter.GaussianBlur(blur)).convert("RGBA")
    reg = Image.alpha_composite(reg, Image.new("RGBA", reg.size, (255, 255, 255, white)))
    mask = Image.new("L", reg.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, x1 - x0, y1 - y0], radius=radius, fill=255)
    base.paste(reg, (x0, y0), mask)
    if border:
        ImageDraw.Draw(base, "RGBA").rounded_rectangle(
            [x0, y0, x1, y1], radius=radius, outline=(255, 255, 255, 200), width=2)


def shadow(base, box, r, blur=55, alpha=80, dy=26):
    lay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    x0, y0, x1, y1 = box
    ImageDraw.Draw(lay).rounded_rectangle([x0, y0 + dy, x1, y1 + dy], radius=r,
                                          fill=(15, 23, 42, alpha))
    base.alpha_composite(lay.filter(ImageFilter.GaussianBlur(blur)))


# ── phone mockup ───────────────────────────────────────────────────
PW, PH, PAD, SR = 470, 950, 16, 46


def phone(screen_fn, accent):
    img = Image.new("RGBA", (PW, PH), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rrect(d, [0, 0, PW, PH], 70, (17, 24, 39, 255))
    sw, sh = PW - 2 * PAD, PH - 2 * PAD
    scr = Image.new("RGBA", (sw, sh), (247, 248, 251, 255))
    screen_fn(ImageDraw.Draw(scr), sw, sh, accent)
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw, sh], radius=SR, fill=255)
    img.paste(scr, (PAD, PAD), mask)
    d.rounded_rectangle([PW / 2 - 70, 26, PW / 2 + 70, 52], radius=13, fill=(17, 24, 39, 255))
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
    rrect(sd, [x, y, x + w, y + h], 22, accent if mine else (255, 255, 255))
    yy = y + 12
    for ln in lines:
        sd.text((x + 18, yy), ln, font=fnt, fill=(255, 255, 255) if mine else INK)
        yy += 30
    return y + h + 16


def scr_chat(sd, sw, sh, accent):
    tg_header(sd, sw, "ArizaPro", "bot  ·  online", accent)
    f = font(False, 19); y = 120
    y = bubble(sd, 24, y, 300, "Aliment undirish · ariza", f, False, accent)
    y = bubble(sd, 24, y, 320, "F.I.SH. ni kiriting:", f, False, accent)
    y = bubble(sd, sw - 24 - 280, y, 280, "Karimov Alisher Botirovich", f, True, accent)
    y = bubble(sd, 24, y, 320, "Telefon raqamini kiriting:", f, False, accent)
    y = bubble(sd, sw - 24 - 220, y, 220, "+998 90 123 45 67", f, True, accent)
    for i, t in enumerate(["Orqaga", "Davom etish"]):
        bx = 24 + i * 195
        rrect(sd, [bx, y + 6, bx + 178, y + 56], 16, (236, 240, 247))
        tw = sd.textlength(t, font=font(True, 18))
        sd.text((bx + (178 - tw) / 2, y + 20), t, font=font(True, 18), fill=accent)


def tile(sd, x, y, w, h, color, icon, title):
    rrect(sd, [x, y, x + w, y + h], 22, (255, 255, 255))
    rrect(sd, [x + 16, y + 16, x + 68, y + 68], 16,
          tuple(int(c + (255 - c) * 0.84) for c in color))
    sd.text((x + 30, y + 24), icon, font=font(True, 30), fill=color)
    for i, ln in enumerate(wrap(sd, title, font(True, 19), w - 32)):
        sd.text((x + 16, y + 84 + i * 24), ln, font=font(True, 19), fill=INK)


def scr_home(sd, sw, sh, accent):
    sd.text((26, 30), "ArizaPro", font=font(True, 34), fill=INK)
    sd.text((28, 76), "O'zbekiston sudlari uchun yordamchi", font=font(False, 16), fill=SUB)
    g = 18; cw = (sw - 48 - g) // 2; ch = 150; x0, x1 = 24, 24 + cw + g; y0 = 128
    tile(sd, x0, y0, cw, ch, BLUE, "+", "Ariza topshirish")
    tile(sd, x1, y0, cw, ch, EMER, "?", "Ishimni tekshirish")
    tile(sd, x0, y0 + ch + g, cw, ch, AMBER, "i", "Qo'llanma")
    tile(sd, x1, y0 + ch + g, cw, ch, SKY, "#", "Sudlar ma'lumoti")


def scr_wizard(sd, sw, sh, accent):
    tg_header(sd, sw, "Ariza", "3 / 9", accent)
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
        rrect(sd, [40, y + 18, 136, y + 56], 19,
              tuple(int(c + (255 - c) * 0.84) for c in accent))
        sd.text((54, y + 24), tm, font=font(True, 22), fill=accent)
        sd.text((40, y + 70), num, font=font(False, 20), fill=INK)
        sd.text((sw - 64 - sd.textlength(cat, font=font(False, 17)), y + 24), cat,
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
    sd.text((x, y), "Toshkent shahar fuqarolik sudi", font=font(True, 22), fill=INK); y += 56
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
    sd.text((cx - sd.textlength(t1, font=font(True, 30)) / 2, 320), t1, font=font(True, 30), fill=INK)
    card(sd, 70, 400, sw - 140, sh - 520, r=16)
    for i in range(7):
        wln = (sw - 200) if i else (sw - 320)
        rrect(sd, [96, 440 + i * 40, 96 + wln - (i * 17 % 90), 456 + i * 40], 8, (232, 236, 243))
    for i, (lbl, col) in enumerate([("PDF", PINK), ("DOCX", BLUE)]):
        bx = 96 + i * 150
        rrect(sd, [bx, sh - 96, bx + 130, sh - 44], 16,
              tuple(int(c + (255 - c) * 0.84) for c in col))
        sd.text((bx + 28, sh - 84), lbl, font=font(True, 22), fill=col)


# ── scenes: eyebrow, title, accent, screen_fn, photo_id, narration ──
SCENES = [
    ("ArizaPro", "Sud hujjatlari\nbir daqiqada", BLUE, scr_chat, 1048,
     "ArizaPro — O'zbekiston fuqarolari uchun sud hujjatlarini bir daqiqada "
     "tayyorlaydigan Telegram bot va mini-ilova."),
    ("Qanday ishlaydi", "Savol — javob —\ntayyor hujjat", VIOLET, scr_chat, 160,
     "Bot oddiy savollar beradi va har bir javobni real vaqtda tekshiradi — "
     "advokatsiz, mustaqil ravishda."),
    ("Mini App", "Zamonaviy\nmini-ilova", SKY, scr_home, 60,
     "Xohlasangiz, zamonaviy mini-ilova orqali: ariza topshirish, ishni "
     "tekshirish, qo'llanma va sudlar ma'lumoti."),
    ("Hujjat", "PDF yoki Word,\nuch tilda", BLUE, scr_wizard, 180,
     "Savol-javob asosida tayyor hujjat PDF yoki Word formatida, uch tilda "
     "shakllanadi."),
    ("Ishimni tekshirish", "Sud majlislari\njadvali", EMER, scr_schedule, 0,
     "Ishingizni tekshiring: sud majlislari jadvalini hudud va sud bo'yicha "
     "ko'ring, familiya yoki ish raqami orqali qidiring."),
    ("Sudlar ma'lumoti", "Barcha sudlar\nma'lumotnomasi", SKY, scr_court, 8,
     "Barcha sudlar ma'lumotnomasi: manzil, telefon, elektron pochta va "
     "xaritadagi joylashuv."),
    ("Natija", "Hujjat\nsoniyalarda", PINK, scr_done, 201,
     "Hujjat bir necha soniyada tayyor bo'ladi — uni yuklab oling yoki "
     "QR-kod orqali qayta oching."),
    ("ArizaPro", "Adolatga\nbir daqiqada", VIOLET, scr_home, 48,
     "ArizaPro — adolatga bir daqiqada yo'l. Telegram'da hoziroq oching."),
]


def render_h(i, sc, dur_unused, path):
    eyebrow, title, accent, sfn, pid, _ = sc
    W, H = 1920, 1080
    img = photo_bg(pid, (W, H), accent)
    px, py = int(W * 0.605), (H - PH) // 2
    shadow(img, [px, py, px + PW, py + PH], 70)
    img.alpha_composite(phone(sfn, accent), (px, py))
    panel = [80, 140, px - 70, 940]
    frost(img, panel, white=150)
    d = ImageDraw.Draw(img, "RGBA")
    lx = panel[0] + 56
    maxw = panel[2] - lx - 30
    ef = font(True, 30); tf = font(True, 86)
    lines = wrap(d, title, tf, maxw)
    block = 60 + 30 + len(lines) * 100 + 32
    top = (panel[1] + panel[3]) / 2 - block / 2
    cw = d.textlength(eyebrow.upper(), font=ef)
    rrect(d, [lx, top, lx + cw + 56, top + 60], 30, accent + (235,))
    d.text((lx + 28, top + 13), eyebrow.upper(), font=ef, fill=(255, 255, 255))
    y = top + 92
    for ln in lines:
        d.text((lx, y), ln, font=tf, fill=INK); y += 100
    rrect(d, [lx, y + 8, lx + 96, y + 24], 8, accent)
    d.text((lx, panel[3] - 64), "ArizaPro  ·  Telegram bot & Mini App",
           font=font(False, 24), fill=SUB)
    img.convert("RGB").save(path, quality=95)


def render_v(i, sc, dur_unused, path):
    eyebrow, title, accent, sfn, pid, _ = sc
    W, H = 1080, 1920
    img = photo_bg(pid, (W, H), accent)
    scale = 1.18
    pw, ph = int(PW * scale), int(PH * scale)
    ph_img = phone(sfn, accent).resize((pw, ph), Image.LANCZOS)
    px, py = (W - pw) // 2, 150
    shadow(img, [px, py, px + pw, py + ph], 80)
    img.alpha_composite(ph_img, (px, py))
    panel = [56, 1330, W - 56, 1850]
    frost(img, panel, white=150, radius=52)
    d = ImageDraw.Draw(img, "RGBA")
    cx = W // 2
    ef = font(True, 34); cw = d.textlength(eyebrow.upper(), font=ef)
    rrect(d, [cx - cw / 2 - 30, panel[1] + 44, cx + cw / 2 + 30, panel[1] + 110], 33, accent + (235,))
    d.text((cx - cw / 2, panel[1] + 56), eyebrow.upper(), font=ef, fill=(255, 255, 255))
    tf = font(True, 78); y = panel[1] + 150
    for ln in wrap(d, title, tf, W - 200):
        lw = d.textlength(ln, font=tf)
        d.text((cx - lw / 2, y), ln, font=tf, fill=INK); y += 92
    rrect(d, [cx - 50, y + 14, cx + 50, y + 32], 9, accent)
    foot = "ArizaPro  ·  Telegram"
    d.text((cx - d.textlength(foot, font=font(False, 26)) / 2, panel[3] - 60), foot,
           font=font(False, 26), fill=SUB)
    img.convert("RGB").save(path, quality=95)


def synth_music(path, seconds=60, sr=44100):
    t = np.linspace(0, seconds, int(sr * seconds), endpoint=False)
    prog = [220.0, 174.61, 130.81, 196.0]
    clen = 4.0
    out = np.zeros_like(t)
    for k in range(int(np.ceil(seconds / clen))):
        root = prog[k % len(prog)]
        m = (t >= k * clen) & (t < (k + 1) * clen)
        tt = t[m] - k * clen
        env = np.clip(np.minimum(tt / 1.3, 1.0) * np.minimum((clen - tt) / 1.3, 1.0), 0, 1)
        seg = np.zeros_like(tt)
        for f, a in [(root, 1.0), (root * 5 / 4, 0.55), (root * 3 / 2, 0.65), (root * 2, 0.3)]:
            seg += a * (np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(2 * np.pi * f * 1.003 * tt))
        out[m] += env * seg
    out /= (np.max(np.abs(out)) + 1e-9)
    out *= 0.5
    fade = int(sr * 2)
    out[:fade] *= np.linspace(0, 1, fade); out[-fade:] *= np.linspace(1, 0, fade)
    pcm = (np.stack([out, out * 0.97], axis=1) * 32767).astype("<i2")
    with wave.open(str(path), "w") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm.tobytes())


async def tts(text, out):
    await edge_tts.Communicate(text, VOICE).save(str(out))


def ff(args):
    subprocess.run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", *args], check=True)


def dur_of(path):
    r = subprocess.run([FFMPEG, "-i", str(path)], capture_output=True, text=True)
    h, m, s = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", r.stderr).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def build(aspect, size, render_fn, mp3s, durs, music, out):
    XF = 0.6
    # 3x oversample so zoompan's integer crop steps become sub-pixel in
    # the output → smooth, jitter-free Ken-Burns motion.
    bw, bh = size[0] * 3, size[1] * 3
    segs = []
    for i, sc in enumerate(SCENES):
        png = WORK / f"{aspect}_s{i}.jpg"
        render_fn(i, sc, durs[i], png)
        seg = WORK / f"{aspect}_c{i}.mp4"
        frames = max(1, int(round(durs[i] * 30)))
        if i % 2 == 0:
            z = "min(zoom+0.0006,1.10)"
        else:
            z = "if(eq(on,0),1.10,max(zoom-0.0006,1.0))"
        vf = (f"[0:v]scale={bw}:{bh}:flags=lanczos,"
              f"zoompan=z='{z}':d={frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
              f"s={size[0]}x{size[1]}:fps=30,format=yuv420p[v]")
        ff(["-loop", "1", "-i", str(png), "-i", str(mp3s[i]),
            "-filter_complex", vf, "-map", "[v]", "-map", "1:a",
            "-af", "apad=pad_dur=0.7", "-t", f"{durs[i]:.3f}",
            "-c:v", "libx264", "-r", "30", "-c:a", "aac", "-b:a", "192k",
            "-pix_fmt", "yuv420p", str(seg)])
        segs.append(seg)
    cur = segs[0]; total = durs[0]
    for i in range(1, len(segs)):
        mout = WORK / f"{aspect}_m{i}.mp4"
        off = max(0.1, total - XF)
        fc = (f"[0:v][1:v]xfade=transition=fade:duration={XF}:offset={off:.3f}[v];"
              f"[0:a][1:a]acrossfade=d={XF}[a]")
        ff(["-i", str(cur), "-i", str(segs[i]), "-filter_complex", fc,
            "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-r", "30",
            "-c:a", "aac", "-b:a", "192k", "-pix_fmt", "yuv420p", str(mout)])
        cur = mout; total = total + durs[i] - XF
    fc = ("[1:a]volume=0.15,afade=t=in:st=0:d=2,afade=t=out:st=58:d=2[m];"
          "[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]")
    ff(["-i", str(cur), "-i", str(music), "-filter_complex", fc,
        "-map", "0:v", "-map", "[a]", "-t", "60",
        "-c:v", "libx264", "-r", "30", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", str(out)])
    print(f"[OK] {out.name}  {dur_of(out):.1f}s  {out.stat().st_size // 1024} KB")


def main():
    for sc in SCENES:
        get_photo(sc[4])
    print("Photos ready")
    mp3s, durs = [], []
    for i, sc in enumerate(SCENES):
        m = WORK / f"v{i}.mp3"
        asyncio.run(tts(sc[5], m))
        mp3s.append(m); durs.append(dur_of(m) + 0.7)
    print("Voiceover (Madina) ready")
    XF = 0.6
    total = sum(durs) - XF * (len(durs) - 1)
    deficit = 60.3 - total
    if deficit > 0:
        durs[-1] += deficit
    music = WORK / "music.wav"
    synth_music(music, 62)
    print("Music synthesized")
    import sys
    which = sys.argv[1:] or ["h", "v"]
    if "h" in which:
        build("h", (1920, 1080), render_h, mp3s, durs, music, HERE / "ArizaPro_uz_16x9.mp4")
    if "v" in which:
        build("v", (1080, 1920), render_v, mp3s, durs, music, HERE / "ArizaPro_uz_9x16.mp4")


if __name__ == "__main__":
    main()

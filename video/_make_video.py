# -*- coding: utf-8 -*-
"""
Builds a ~1-minute Russian instructional/overview video for ArizaPro:
branded gradient slides (Pillow) + Russian voiceover (edge-tts), stitched
with the ffmpeg binary bundled by imageio-ffmpeg.

Run:  python video/_make_video.py
Out:  video/ArizaPro_instruction_ru.mp4
"""
import asyncio
import os
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
import edge_tts
import imageio_ffmpeg

HERE = Path(__file__).resolve().parent
WORK = HERE / "_work"
WORK.mkdir(exist_ok=True)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

W, H = 1920, 1080
VOICE = "ru-RU-DmitryNeural"

FONTS = "C:/Windows/Fonts"
F_TITLE = f"{FONTS}/arialbd.ttf"
F_BODY = f"{FONTS}/arial.ttf"

# (number, title, [body lines], narration)
SCENES = [
    (
        "ArizaPro",
        "Судебные документы\nза одну минуту",
        ["Telegram-бот и мини-приложение для граждан Узбекистана"],
        "ArizaPro — это Telegram-бот и мини-приложение, которое за одну "
        "минуту составляет официальные судебные документы для граждан "
        "Узбекистана.",
    ),
    (
        "Проблема",
        "Без юриста\nи без затрат",
        ["Раньше нужно было идти к адвокату", "Теперь — самостоятельно, прямо в Telegram"],
        "Раньше, чтобы составить иск, жалобу или ходатайство, приходилось "
        "идти к юристу. ArizaPro позволяет сделать это самостоятельно и "
        "бесплатно, прямо в Telegram.",
    ),
    (
        "Как это работает",
        "Вопрос — ответ —\nготовый документ",
        ["Бот задаёт простые вопросы по очереди",
         "Проверяет каждый ответ",
         "Выдаёт готовый PDF или Word на трёх языках"],
        "Бот задаёт простые вопросы по очереди, проверяет каждый ответ и "
        "собирает готовый документ в формате PDF или Word, на трёх языках.",
    ),
    (
        "Виды дел",
        "4 типа суда,\n30+ шаблонов",
        ["Гражданские · Уголовные", "Административные · Экономические"],
        "Поддерживаются все четыре типа судов — гражданский, уголовный, "
        "административный и экономический, и более тридцати готовых шаблонов "
        "документов.",
    ),
    (
        "Проверка дела",
        "«Ишимни текшириш»",
        ["Расписание судебных заседаний", "Поиск по ФИО или номеру дела"],
        "Прямо в приложении можно проверить своё дело — расписание судебных "
        "заседаний по региону и суду, с поиском по фамилии или номеру дела.",
    ),
    (
        "Справочник судов",
        "Все суды страны",
        ["Адрес, телефон, электронная почта", "Расположение на карте"],
        "Есть справочник всех судов страны: адрес, телефон, электронная "
        "почта и расположение на карте.",
    ),
    (
        "Возможности",
        "Mini App и\nумные функции",
        ["Современное мини-приложение", "Голосовой ввод и обработка текста ИИ", "Приём онлайн-оплаты"],
        "Современное мини-приложение повторяет все функции бота. Есть "
        "голосовой ввод, умная обработка текста искусственным интеллектом и "
        "приём онлайн-оплаты.",
    ),
    (
        "ArizaPro",
        "Правосудие —\nдоступно каждому",
        ["Откройте бота в Telegram", "и составьте документ за минуту"],
        "ArizaPro — это доступ к правосудию за одну минуту. Просто откройте "
        "бота в Telegram.",
    ),
]


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient_bg(c1, c2):
    img = Image.new("RGB", (W, H), c1)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        d.line([(0, y), (W, y)], fill=lerp(c1, c2, t))
    return img


def wrap(draw, text, font, max_w):
    out = []
    for raw in text.split("\n"):
        words = raw.split(" ")
        line = ""
        for w in words:
            trial = (line + " " + w).strip()
            if draw.textlength(trial, font=font) <= max_w or not line:
                line = trial
            else:
                out.append(line)
                line = w
        out.append(line)
    return out


def render_slide(idx, scene, path):
    num_label = f"{idx + 1:02d} / {len(SCENES):02d}"
    eyebrow, title, lines, _ = scene
    # alternate gradient direction/hue per slide for variety
    palettes = [
        ((37, 99, 235), (124, 58, 237)),   # blue→violet
        ((14, 165, 233), (37, 99, 235)),   # sky→blue
        ((124, 58, 237), (219, 39, 119)),  # violet→pink
        ((16, 185, 129), (14, 165, 233)),  # emerald→sky
    ]
    c1, c2 = palettes[idx % len(palettes)]
    img = gradient_bg(c1, c2)
    d = ImageDraw.Draw(img, "RGBA")

    # soft dark vignette at the bottom for the footer
    d.rectangle([0, H - 120, W, H], fill=(0, 0, 0, 60))

    margin = 150
    title_font = ImageFont.truetype(F_TITLE, 110)
    eyebrow_font = ImageFont.truetype(F_TITLE, 40)
    body_font = ImageFont.truetype(F_BODY, 50)
    foot_font = ImageFont.truetype(F_BODY, 34)

    # eyebrow chip
    chip = eyebrow.upper()
    cw = d.textlength(chip, font=eyebrow_font)
    d.rounded_rectangle([margin, 200, margin + cw + 64, 270], radius=35,
                        fill=(255, 255, 255, 38))
    d.text((margin + 32, 213), chip, font=eyebrow_font, fill=(255, 255, 255, 235))

    # accent bar
    d.rounded_rectangle([margin, 320, margin + 110, 338], radius=9,
                        fill=(255, 255, 255, 230))

    # title
    y = 380
    for ln in wrap(d, title, title_font, W - 2 * margin):
        d.text((margin, y), ln, font=title_font, fill=(255, 255, 255))
        y += 130

    # body lines
    y += 30
    for ln in lines:
        d.ellipse([margin, y + 22, margin + 16, y + 38], fill=(255, 255, 255, 220))
        d.text((margin + 40, y), ln, font=body_font, fill=(255, 255, 255, 235))
        y += 78

    # footer
    d.text((margin, H - 82), "ArizaPro · Telegram", font=foot_font,
           fill=(255, 255, 255, 220))
    nl = d.textlength(num_label, font=foot_font)
    d.text((W - margin - nl, H - 82), num_label, font=foot_font,
           fill=(255, 255, 255, 200))

    img.save(path)


async def tts(text, out):
    await edge_tts.Communicate(text, VOICE).save(str(out))


def run_ffmpeg(args):
    subprocess.run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", *args],
                   check=True)


def main():
    # 1) slides
    pngs = []
    for i, sc in enumerate(SCENES):
        p = WORK / f"slide_{i}.png"
        render_slide(i, sc, p)
        pngs.append(p)
    print(f"Rendered {len(pngs)} slides")

    # 2) narration per scene
    have_audio = True
    mp3s = []
    try:
        for i, sc in enumerate(SCENES):
            m = WORK / f"voice_{i}.mp3"
            asyncio.run(tts(sc[3], m))
            if not m.exists() or m.stat().st_size < 800:
                raise RuntimeError("empty tts output")
            mp3s.append(m)
        print("Generated Russian voiceover (edge-tts)")
    except Exception as e:  # network blocked etc. → silent fallback
        have_audio = False
        print(f"! TTS unavailable ({e}); building silent captioned video")

    # 3) per-scene mp4
    segs = []
    for i in range(len(SCENES)):
        seg = WORK / f"seg_{i}.mp4"
        if have_audio:
            run_ffmpeg([
                "-loop", "1", "-i", str(pngs[i]),
                "-i", str(mp3s[i]),
                "-af", "apad=pad_dur=0.6",
                "-c:v", "libx264", "-tune", "stillimage", "-r", "30",
                "-c:a", "aac", "-b:a", "192k",
                "-pix_fmt", "yuv420p", "-shortest", str(seg),
            ])
        else:
            run_ffmpeg([
                "-loop", "1", "-t", "7", "-i", str(pngs[i]),
                "-c:v", "libx264", "-tune", "stillimage", "-r", "30",
                "-pix_fmt", "yuv420p", str(seg),
            ])
        segs.append(seg)
    print(f"Built {len(segs)} segments")

    # 4) concat
    lst = WORK / "concat.txt"
    lst.write_text("".join(f"file '{s.as_posix()}'\n" for s in segs), encoding="utf-8")
    out = HERE / "ArizaPro_instruction_ru.mp4"
    run_ffmpeg([
        "-f", "concat", "-safe", "0", "-i", str(lst),
        "-c:v", "libx264", "-r", "30", "-pix_fmt", "yuv420p",
        *(["-c:a", "aac", "-b:a", "192k"] if have_audio else []),
        str(out),
    ])
    print(f"\n[OK] Done: {out}  ({out.stat().st_size // 1024} KB, audio={have_audio})")


if __name__ == "__main__":
    main()

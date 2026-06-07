from pathlib import Path
import math
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output" / "imagegen" / "xiangqi-ink"
SIZE = 1024
FONT_CANDIDATES = [
    Path("C:/Windows/Fonts/simkai.ttf"),
    Path("C:/Windows/Fonts/STKAITI.TTF"),
    Path("C:/Windows/Fonts/STXINGKA.TTF"),
    Path("C:/Windows/Fonts/FZSTK.TTF"),
    Path("C:/Windows/Fonts/simsun.ttc"),
]


PIECES = [
    ("jiang_green", "將", (28, 112, 67), (42, 132, 82)),
    ("shuai_red", "帅", (178, 33, 33), (155, 28, 28)),
    ("che_mono", "車", (28, 28, 26), (34, 34, 32)),
    ("ma_mono", "馬", (28, 28, 26), (34, 34, 32)),
    ("pao_mono", "炮", (28, 28, 26), (34, 34, 32)),
    ("shi_mono", "士", (28, 28, 26), (34, 34, 32)),
    ("bing_mono", "兵", (28, 28, 26), (34, 34, 32)),
]


def font(size):
    for candidate in FONT_CANDIDATES:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default(size=size)


def paper_texture(rng):
    base = Image.new("RGB", (SIZE, SIZE), (236, 232, 217))
    pixels = base.load()
    for y in range(SIZE):
        for x in range(SIZE):
            fiber = int(7 * math.sin((x + y * 0.35) / 17.0) + rng.randint(-8, 8))
            r = max(0, min(255, 236 + fiber))
            g = max(0, min(255, 232 + fiber))
            b = max(0, min(255, 217 + fiber // 2))
            pixels[x, y] = (r, g, b)
    wash = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(wash)
    for _ in range(26):
        cx = rng.randint(70, SIZE - 70)
        cy = rng.randint(70, SIZE - 70)
        radius = rng.randint(50, 180)
        alpha = rng.randint(5, 15)
        draw.ellipse(
            (cx - radius, cy - radius, cx + radius, cy + radius),
            fill=(68, 61, 45, alpha),
        )
    return Image.alpha_composite(base.convert("RGBA"), wash.filter(ImageFilter.GaussianBlur(30)))


def draw_rough_ellipse(draw, box, color, width, rng, passes=5):
    x0, y0, x1, y1 = box
    for _ in range(passes):
        jitter = rng.randint(0, 7)
        local_box = (
            x0 + rng.randint(-jitter - 2, jitter + 2),
            y0 + rng.randint(-jitter - 2, jitter + 2),
            x1 + rng.randint(-jitter - 2, jitter + 2),
            y1 + rng.randint(-jitter - 2, jitter + 2),
        )
        local_width = max(1, width + rng.randint(-3, 3))
        draw.ellipse(local_box, outline=color, width=local_width)


def add_ink_specks(layer, color, rng, count):
    draw = ImageDraw.Draw(layer)
    for _ in range(count):
        x = rng.randint(120, SIZE - 120)
        y = rng.randint(120, SIZE - 120)
        r = rng.choice([1, 1, 2, 2, 3, 4])
        alpha = rng.randint(16, 80)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(*color, alpha))


def text_mask(ch):
    mask = Image.new("L", (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(mask)
    fnt = font(490)
    bbox = draw.textbbox((0, 0), ch, font=fnt)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (SIZE - w) / 2 - bbox[0]
    y = (SIZE - h) / 2 - bbox[1] - 8
    draw.text((x, y), ch, font=fnt, fill=255)
    return mask.filter(ImageFilter.GaussianBlur(0.45))


def make_piece(name, ch, glyph_color, ring_color):
    rng = random.Random(name)
    image = paper_texture(rng)

    shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.ellipse((122, 140, 902, 910), fill=(0, 0, 0, 36))
    image = Image.alpha_composite(image, shadow.filter(ImageFilter.GaussianBlur(24)))

    body = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    body_draw = ImageDraw.Draw(body)
    body_draw.ellipse((116, 104, 908, 896), fill=(242, 238, 222, 235))
    for _ in range(12):
        offset = rng.randint(-8, 8)
        alpha = rng.randint(10, 26)
        body_draw.ellipse(
            (142 + offset, 132 - offset, 882 + offset, 872 - offset),
            outline=(77, 69, 52, alpha),
            width=rng.randint(2, 6),
        )
    image = Image.alpha_composite(image, body)

    ink = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ink_draw = ImageDraw.Draw(ink)
    draw_rough_ellipse(ink_draw, (148, 136, 876, 864), (*ring_color, 195), 19, rng, passes=6)
    draw_rough_ellipse(ink_draw, (205, 194, 819, 808), (*ring_color, 118), 6, rng, passes=3)
    add_ink_specks(ink, glyph_color, rng, 145)
    image = Image.alpha_composite(image, ink.filter(ImageFilter.GaussianBlur(0.18)))

    mask = text_mask(ch)
    dry_brush = Image.new("L", (SIZE, SIZE), 0)
    dry_pixels = dry_brush.load()
    for y in range(SIZE):
        for x in range(SIZE):
            grain = rng.randint(0, 255)
            dry_pixels[x, y] = 255 if grain > 32 else rng.randint(95, 190)
    mask = Image.composite(mask, Image.new("L", (SIZE, SIZE), 0), dry_brush)

    glyph = Image.new("RGBA", (SIZE, SIZE), (*glyph_color, 0))
    glyph.putalpha(mask)
    bloom = Image.new("RGBA", (SIZE, SIZE), (*glyph_color, 0))
    bloom.putalpha(mask.filter(ImageFilter.GaussianBlur(4)).point(lambda a: int(a * 0.35)))
    image = Image.alpha_composite(image, bloom)
    image = Image.alpha_composite(image, glyph)

    vignette = Image.new("L", (SIZE, SIZE), 0)
    vdraw = ImageDraw.Draw(vignette)
    vdraw.ellipse((44, 34, 980, 970), fill=210)
    vignette = vignette.filter(ImageFilter.GaussianBlur(52))
    edge = Image.new("RGBA", (SIZE, SIZE), (42, 37, 29, 38))
    image = Image.composite(image, Image.alpha_composite(image, edge), vignette)

    out = image.convert("RGB")
    out.save(OUT_DIR / f"{name}.png", optimize=True)
    return out


def contact_sheet(images):
    thumb = 256
    sheet = Image.new("RGB", (thumb * 4, thumb * 2), (230, 226, 212))
    draw = ImageDraw.Draw(sheet)
    label_font = font(30)
    for idx, (name, ch, image) in enumerate(images):
        x = (idx % 4) * thumb
        y = (idx // 4) * thumb
        preview = image.resize((thumb, thumb), Image.Resampling.LANCZOS)
        sheet.paste(preview, (x, y))
        draw.rectangle((x, y + thumb - 44, x + thumb, y + thumb), fill=(236, 232, 217))
        draw.text((x + 14, y + thumb - 39), f"{ch}  {name}", fill=(32, 30, 26), font=label_font)
    sheet.save(OUT_DIR / "contact_sheet.png", optimize=True)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rendered = []
    for name, ch, glyph_color, ring_color in PIECES:
        image = make_piece(name, ch, glyph_color, ring_color)
        rendered.append((name, ch, image))
    contact_sheet(rendered)
    print(f"Generated {len(rendered)} pieces in {OUT_DIR}")


if __name__ == "__main__":
    main()

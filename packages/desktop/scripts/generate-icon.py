#!/usr/bin/env python3
"""
Generate a liquid glass macOS app icon for Codewright.
Uses the aurora palette from the design system with frosted glass effects.
"""

import math
import os
import struct
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS_DIR = os.path.join(BASE_DIR, "icons", "dev")

AURORA_COLORS = [
    (109, 211, 255),
    (162, 128, 255),
    (255, 122, 214),
    (125, 245, 193),
    (255, 212, 122),
]

PARTICLE_COLORS = [
    (125, 211, 255, 230),
    (162, 128, 255, 217),
    (255, 122, 214, 204),
    (125, 245, 193, 217),
    (255, 212, 122, 204),
]

def gradient_image(size, color1, color2, angle=135):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    rad = math.radians(angle)
    cos_a, sin_a = math.cos(rad), math.sin(rad)
    half = size / 2

    for y in range(size):
        for x in range(size):
            dx, dy = x - half, y - half
            proj = dx * cos_a + dy * sin_a
            t = max(0, min(1, (proj / (half * 1.414) + 1) / 2))
            r = int(color1[0] + (color2[0] - color1[0]) * t)
            g = int(color1[1] + (color2[1] - color1[1]) * t)
            b = int(color1[2] + (color2[2] - color1[2]) * t)
            img.putpixel((x, y), (r, g, b, 255))
    return img

def rounded_rect_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=radius, fill=255)
    return mask

def draw_glass_shine(draw, size, margin, radius):
    shine = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shine)
    half = size // 2

    for y in range(margin, half):
        alpha = int(80 * (1 - (y - margin) / (half - margin)) * 0.5)
        if alpha <= 0:
            continue
        sdraw.rounded_rectangle(
            [(margin, y), (size - margin - 1, y + 1)],
            radius=max(0, radius - (y - margin)),
            fill=(255, 255, 255, alpha),
        )
    return shine

def draw_particles(draw, size, margin, radius, seed=42):
    import random
    rng = random.Random(seed)
    particles = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pdraw = ImageDraw.Draw(particles)

    for _ in range(30):
        x = rng.randint(margin + 20, size - margin - 20)
        y = rng.randint(margin + 20, size - margin - 20)
        pr = rng.randint(2, 6)
        color = rng.choice(PARTICLE_COLORS)
        alpha = rng.randint(60, 160)
        pdraw.ellipse(
            [(x - pr, y - pr), (x + pr, y + pr)],
            fill=(color[0], color[1], color[2], alpha),
        )

    particles = particles.filter(ImageFilter.GaussianBlur(radius=1.5))
    return particles

def find_font(draw, text, max_width, max_height, font_paths, min_size=20):
    for fp in font_paths:
        if os.path.exists(fp):
            for size in range(min_size, 10, -1):
                try:
                    font = ImageFont.truetype(fp, size)
                    bbox = draw.textbbox((0, 0), text, font=font)
                    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
                    if tw <= max_width and th <= max_height:
                        return font, size
                except Exception:
                    continue
            for size in range(min_size, 200):
                try:
                    font = ImageFont.truetype(fp, size)
                    bbox = draw.textbbox((0, 0), text, font=font)
                    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
                    if tw > max_width or th > max_height:
                        if size > min_size:
                            return ImageFont.truetype(fp, size - 2), size - 2
                        return font, size
                except Exception:
                    continue
            return ImageFont.truetype(fp, min_size), min_size
    return None, 0

def make_icon(size=1024):
    margin = int(size * 0.08)
    radius = int(size * 0.225)

    bg = gradient_image(size, (20, 20, 40), (10, 10, 30), angle=135)

    center_glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(center_glow)
    cx, cy = size // 2, size // 2
    for r in range(int(size * 0.5), 0, -1):
        alpha = int(30 * (r / (size * 0.5)))
        gdraw.ellipse([(cx - r, cy - r), (cx + r, cy + r)], fill=(109, 211, 255, alpha))
    bg = Image.alpha_composite(bg, center_glow)

    margin2 = margin + int(size * 0.03)
    radius2 = int(radius * 0.85)
    inner = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    idraw = ImageDraw.Draw(inner)
    idraw.rounded_rectangle(
        [(margin2, margin2), (size - margin2 - 1, size - margin2 - 1)],
        radius=radius2,
        fill=(255, 255, 255, 12),
    )
    bg = Image.alpha_composite(bg, inner)

    particles = draw_particles(None, size, margin2, radius2)
    bg = Image.alpha_composite(bg, particles)

    shine = draw_glass_shine(None, size, margin2, radius2)
    bg = Image.alpha_composite(bg, shine)

    font_paths = [
        "/System/Library/Fonts/SF-Pro-Display-Bold.otf",
        "/System/Library/Fonts/SF-Pro-Text-Bold.otf",
        "/System/Library/Fonts/SF-Pro-Display-Heavy.otf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/System/Library/Fonts/SFNSDisplay-Bold.otf",
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ]

    text_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    tdraw = ImageDraw.Draw(text_layer)

    max_w = int(size * 0.58)
    max_h = int(size * 0.42)
    font, fsize = find_font(tdraw, "CW", max_w, max_h, font_paths, min_size=60)

    if font is None:
        font = ImageFont.load_default()
        fsize = 64

    bbox = tdraw.textbbox((0, 0), "CW", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (size - tw) // 2 - bbox[0]
    ty = (size - th) // 2 - bbox[1] - int(size * 0.01)

    tdraw.text((tx, ty), "CW", fill=(255, 255, 255, 230), font=font)

    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.text((tx + 2, ty + 2), "CW", fill=(0, 0, 0, 60), font=font)
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=3))

    text_layer = Image.alpha_composite(shadow, text_layer)

    gradient_fill = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gfill = ImageDraw.Draw(gradient_fill)
    for py in range(ty, ty + th):
        t = (py - ty) / th
        r = int(162 + (109 - 162) * t + (255 - 109) * math.sin(t * math.pi))
        g = int(128 + (211 - 128) * t + (212 - 211) * math.sin(t * math.pi))
        b = int(255 + (255 - 255) * t + (122 - 255) * math.sin(t * math.pi))
        alpha = 180
        gfill.rectangle([(tx, py), (tx + tw, py + 1)], fill=(r, g, b, alpha))

    text_gradient = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    text_gradient.paste(gradient_fill, (0, 0), text_layer)

    bg = Image.alpha_composite(bg, text_gradient)

    border = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bdraw = ImageDraw.Draw(border)
    bdraw.rounded_rectangle(
        [(margin, margin), (size - margin - 1, size - margin - 1)],
        radius=radius,
        outline=(255, 255, 255, 40),
        width=max(1, int(size * 0.005)),
    )
    bg = Image.alpha_composite(bg, border)

    mask = rounded_rect_mask(size, radius)
    bg.putalpha(mask)

    return bg


def make_iconset(base_size=1024):
    sizes = {
        "icon_512x512@2x": 1024,
        "icon_512x512": 512,
        "icon_256x256@2x": 512,
        "icon_256x256": 256,
        "icon_128x128@2x": 256,
        "icon_128x128": 128,
        "icon_32x32@2x": 64,
        "icon_32x32": 32,
        "icon_16x16@2x": 32,
        "icon_16x16": 16,
    }

    iconset = os.path.join(ICONS_DIR, "icon.iconset")
    os.makedirs(iconset, exist_ok=True)

    master = make_icon(base_size)
    master.save(os.path.join(ICONS_DIR, "icon.png"), "PNG")

    for name, sz in sizes.items():
        if sz == base_size:
            img = master.copy()
        else:
            img = master.resize((sz, sz), Image.LANCZOS)
        img.save(os.path.join(iconset, f"{name}.png"), "PNG")
        print(f"  {name}.png ({sz}x{sz})")

    flat_sizes = {
        "32x32.png": 32,
        "64x64.png": 64,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "dock.png": 256,
    }

    for name, sz in flat_sizes.items():
        img = master.resize((sz, sz), Image.LANCZOS)
        img.save(os.path.join(ICONS_DIR, name), "PNG")
        print(f"  {name} ({sz}x{sz})")

    return os.path.join(ICONS_DIR, "icon.png")


def make_icns(png_path):
    """Convert iconset to .icns using iconutil (macOS native)."""
    iconset = os.path.join(ICONS_DIR, "icon.iconset")
    icns_path = os.path.join(ICONS_DIR, "icon.icns")

    os.system(f"iconutil -c icns -o {icns_path} {iconset}")
    print(f"  icon.icns generated")

    return icns_path


if __name__ == "__main__":
    png_path = make_iconset(1024)
    make_icns(png_path)
    print("Done! Liquid glass icon generated.")
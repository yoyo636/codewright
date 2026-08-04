#!/usr/bin/env python3
"""
Generate a liquid glass style app icon for Codewright.
Produces a 1024x1024 PNG with rounded corners suitable for macOS .icns conversion.
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math
import os

SIZE = 1024
RADIUS = int(SIZE * 0.224)  # ~229px for Big Sur style
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "packages", "desktop", "icons", "dev")


def create_gradient(size, color1, color2, angle=135):
    """Create a diagonal gradient image."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    rad = math.radians(angle)
    cos_a = math.cos(rad)
    sin_a = math.sin(rad)
    half = size / 2

    for y in range(size):
        for x in range(size):
            dx = x - half
            dy = y - half
            proj = dx * cos_a + dy * sin_a
            t = (proj / (half * 1.414) + 1) / 2
            t = max(0, min(1, t))
            r = int(color1[0] + (color2[0] - color1[0]) * t)
            g = int(color1[1] + (color2[1] - color1[1]) * t)
            b = int(color1[2] + (color2[2] - color1[2]) * t)
            img.putpixel((x, y), (r, g, b, 255))
    return img


def rounded_rect_mask(size, radius):
    """Create a rounded rectangle mask."""
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    # Draw rounded rectangle by compositing circles and rectangles
    draw.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=radius, fill=255)
    return mask


def draw_glass_shine(draw, size, radius):
    """Draw a glass-like shine effect on top."""
    # Top-left corner highlight
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)

    # Main diagonal shine
    for i in range(size):
        for j in range(size):
            # Check if within rounded rect
            dx = i - size / 2
            dy = j - size / 2
            dist_from_center = math.sqrt(dx * dx + dy * dy)
            max_dist = size / 2 - radius * 0.3

            # Top-left shine
            shine = 0
            if i < size * 0.5 and j < size * 0.5:
                dist = math.sqrt(i * i + j * j)
                shine = max(0, 1 - dist / (size * 0.55)) * 80

            # Edge glow
            edge_dist = max_dist - dist_from_center
            if edge_dist < 30 and edge_dist > 0:
                edge_alpha = int((1 - edge_dist / 30) * 40)
                shine = max(shine, edge_alpha)

            if shine > 0:
                overlay.putpixel((i, j), (255, 255, 255, int(shine)))

    return overlay


def draw_particles(draw, size, radius):
    """Draw subtle particle effects."""
    particles = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pdraw = ImageDraw.Draw(particles)

    import random
    random.seed(42)

    center_x = size / 2
    center_y = size / 2
    margin = int(radius * 0.35)

    for _ in range(25):
        # Random position within the rounded rect
        angle = random.uniform(0, 2 * math.pi)
        dist = random.uniform(0, size / 2 - margin)
        x = int(center_x + dist * math.cos(angle))
        y = int(center_y + dist * math.sin(angle))

        # Ensure within bounds
        x = max(margin, min(size - margin, x))
        y = max(margin, min(size - margin, y))

        r = random.randint(2, 6)
        alpha = random.randint(20, 80)
        pdraw.ellipse([(x - r, y - r), (x + r, y + r)], fill=(255, 255, 255, alpha))

    # Add a few glowing particles
    for _ in range(8):
        angle = random.uniform(0, 2 * math.pi)
        dist = random.uniform(size * 0.1, size / 2 - margin)
        x = int(center_x + dist * math.cos(angle))
        y = int(center_y + dist * math.sin(angle))
        x = max(margin, min(size - margin, x))
        y = max(margin, min(size - margin, y))

        r = random.randint(3, 8)
        for layer in range(3):
            lr = r + layer * 3
            la = int(100 / (layer + 2))
            pdraw.ellipse(
                [(x - lr, y - lr), (x + lr, y + lr)],
                fill=(255, 255, 255, la),
            )

    return particles


def load_font(size):
    """Load a font at the given size."""
    paths = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSDisplay.ttf",
        "/System/Library/Fonts/SFCompactDisplay-Bold.otf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for path in paths:
        try:
            return ImageFont.truetype(path, size)
        except (IOError, OSError):
            continue
    return ImageFont.load_default()


def find_font_size(draw, text, max_width, max_height):
    """Find a font size that fits the text within max_width and max_height."""
    lo, hi = 10, 800
    best = lo
    while lo <= hi:
        mid = (lo + hi) // 2
        font = load_font(mid)
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        if w <= max_width and h <= max_height:
            best = mid
            lo = mid + 1
        else:
            hi = mid - 1
    return best


def create_icon():
    # 1. Create base gradient
    bg = create_gradient(SIZE, (49, 46, 129), (124, 58, 237), angle=135)  # indigo to violet

    # 2. Create rounded rect mask
    mask = rounded_rect_mask(SIZE, RADIUS)

    # 3. Apply gradient to rounded rect
    icon = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    for y in range(SIZE):
        for x in range(SIZE):
            if mask.getpixel((x, y)) > 0:
                icon.putpixel((x, y), bg.getpixel((x, y)))

    # 4. Add subtle inner shadow
    shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle(
        [(8, 8), (SIZE - 9, SIZE - 9)],
        radius=RADIUS - 8,
        outline=(0, 0, 0, 30),
        width=3,
    )
    icon = Image.alpha_composite(icon, shadow)

    # 5. Add glass shine
    draw = ImageDraw.Draw(icon)
    shine = draw_glass_shine(draw, SIZE, RADIUS)
    icon = Image.alpha_composite(icon, shine)

    # 6. Draw the "C" letter mark
    draw = ImageDraw.Draw(icon)
    max_w = int(SIZE * 0.48)
    max_h = int(SIZE * 0.55)
    font_size = find_font_size(draw, "C", max_w, max_h)
    font = load_font(font_size)

    bbox = draw.textbbox((0, 0), "C", font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (SIZE - tw) / 2 - bbox[0]
    ty = (SIZE - th) / 2 - bbox[1] - int(SIZE * 0.02)

    # Draw C with a subtle white gradient effect
    draw.text((tx, ty), "C", font=font, fill=(255, 255, 255, 240))

    # 7. Add subtle glow behind the C
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    for r in range(80, 120, 10):
        alpha = int(15 * (1 - (r - 80) / 40))
        gdraw.ellipse(
            [(SIZE / 2 - r, SIZE / 2 - r), (SIZE / 2 + r, SIZE / 2 + r)],
            fill=(255, 255, 255, alpha),
        )
    icon = Image.alpha_composite(icon, glow)

    # 8. Add particles
    particles = draw_particles(draw, SIZE, RADIUS)
    icon = Image.alpha_composite(icon, particles)

    # 9. Apply final mask (ensure rounded corners are clean)
    final = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    final.paste(icon, (0, 0), mask)

    return final


def main():
    icon = create_icon()

    # Save the 1024x1024 source
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    src_path = os.path.join(OUTPUT_DIR, "icon.png")
    icon.save(src_path, "PNG")
    print(f"Saved: {src_path} ({icon.size[0]}x{icon.size[1]})")

    # Also generate other sizes for macOS
    sizes = {
        "32x32.png": 32,
        "64x64.png": 64,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "Square30x30Logo.png": 30,
        "Square44x44Logo.png": 44,
        "Square71x71Logo.png": 71,
        "Square89x89Logo.png": 89,
        "Square107x107Logo.png": 107,
        "Square142x142Logo.png": 142,
        "Square150x150Logo.png": 150,
        "Square284x284Logo.png": 284,
        "Square310x310Logo.png": 310,
        "StoreLogo.png": 50,
        "dock.png": 512,
    }

    for name, size in sizes.items():
        resized = icon.resize((size, size), Image.LANCZOS)
        path = os.path.join(OUTPUT_DIR, name)
        resized.save(path, "PNG")
        print(f"Saved: {path} ({size}x{size})")

    # Generate .icns file using iconutil
    # Create a temporary iconset
    iconset = os.path.join(OUTPUT_DIR, "icon.iconset")
    os.makedirs(iconset, exist_ok=True)

    icns_sizes = {
        "icon_16x16.png": 16,
        "icon_16x16@2x.png": 32,
        "icon_32x32.png": 32,
        "icon_32x32@2x.png": 64,
        "icon_128x128.png": 128,
        "icon_128x128@2x.png": 256,
        "icon_256x256.png": 256,
        "icon_256x256@2x.png": 512,
        "icon_512x512.png": 512,
        "icon_512x512@2x.png": 1024,
    }

    for name, size in icns_sizes.items():
        resized = icon.resize((size, size), Image.LANCZOS)
        path = os.path.join(iconset, name)
        resized.save(path, "PNG")

    icns_path = os.path.join(OUTPUT_DIR, "icon.icns")
    import subprocess
    result = subprocess.run(
        ["iconutil", "-c", "icns", iconset, "-o", icns_path],
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        print(f"Saved: {icns_path}")
    else:
        print(f"ICNS generation failed: {result.stderr}")

    # Cleanup iconset
    import shutil
    shutil.rmtree(iconset, ignore_errors=True)


if __name__ == "__main__":
    main()
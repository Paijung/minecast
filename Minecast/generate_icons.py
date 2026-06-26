#!/usr/bin/env python3
"""
MineCast Icon Generator
Generates all required icon files for the application.
Run: python generate_icons.py
Requires: pip install Pillow
"""

import os
import struct
import zlib
from pathlib import Path

# Try to use Pillow if available, otherwise use pure Python PNG generator
try:
    from PIL import Image, ImageDraw, ImageFont
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False
    print("Pillow not found. Using built-in PNG generator.")


def create_png_bytes(width, height, pixels_rgba):
    """Create a minimal PNG file from raw RGBA pixel data."""
    def make_chunk(chunk_type, data):
        c = chunk_type + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)

    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)  # RGB
    # Actually use RGBA (bit depth=8, color=6)
    ihdr_data = struct.pack('>II', width, height) + bytes([8, 6, 0, 0, 0])

    # Image data - RGBA rows with filter byte
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # filter type = None
        for x in range(width):
            r, g, b, a = pixels_rgba[y * width + x]
            raw_data += bytes([r, g, b, a])

    compressed = zlib.compress(raw_data, 9)

    png = b'\x89PNG\r\n\x1a\n'
    png += make_chunk(b'IHDR', ihdr_data)
    png += make_chunk(b'IDAT', compressed)
    png += make_chunk(b'IEND', b'')
    return png


def draw_minecast_icon(size, bg_dark=True):
    """Draw MineCast icon pixels."""
    pixels = []
    cx, cy = size // 2, size // 2
    r = size // 2 - 1

    bg_r, bg_g, bg_b = (14, 31, 66) if bg_dark else (255, 255, 255)

    for y in range(size):
        for x in range(size):
            dx, dy = x - cx, y - cy
            dist = (dx*dx + dy*dy) ** 0.5

            # Background circle
            if dist <= r:
                # Gradient-like background
                t = dist / r
                if bg_dark:
                    br = int(14 + t * 20)
                    bg_ = int(31 + t * 40)
                    bb = int(66 + t * 60)
                else:
                    br, bg_, bb = 255, 255, 255
                alpha = 255
            else:
                # Anti-alias edge
                aa = max(0.0, r + 0.5 - dist)
                if aa < 0.01:
                    pixels.append((0, 0, 0, 0))
                    continue
                br, bg_, bb, alpha = bg_r, bg_g, bg_b, int(aa * 255)
                pixels.append((br, bg_, bb, alpha))
                continue

            # Draw pickaxe symbol simplified
            # Handle/shaft: diagonal line from lower-left to upper-right
            shaft_dist = abs((y - cy * 0.4) - (x - cx * 0.4) * 0.9) / (size * 0.1)
            in_shaft = (shaft_dist < 0.6 and
                        x > cx * 0.3 and x < cx * 1.7 and
                        y > cy * 0.3 and y < cy * 1.7)

            # Pickaxe head: horizontal bar at top
            head_y = cy * 0.45
            head_w = size * 0.38
            in_head = (abs(y - head_y) < size * 0.08 and abs(x - cx) < head_w)

            # Left spike of pickaxe
            lspike_dist = ((x - cx * 0.2)**2 + (y - cy * 0.4)**2) ** 0.5
            in_lspike = (lspike_dist < size * 0.09 and x < cx)

            # Right spike
            rspike_dist = ((x - cx * 1.8)**2 + (y - cy * 0.4)**2) ** 0.5
            in_rspike = (rspike_dist < size * 0.09 and x > cx)

            # Lightning bolt/coal indicator at bottom
            # Simple M-shape "M"
            coal_y = cy * 1.4
            in_coal_dot = abs(x - cx) < size * 0.12 and abs(y - coal_y) < size * 0.09

            is_symbol = in_shaft or in_head or in_lspike or in_rspike or in_coal_dot

            if is_symbol:
                # Bright white/cyan for symbol
                sr, sg, sb = 100, 220, 255
                pixels.append((sr, sg, sb, alpha))
            else:
                pixels.append((br, bg_, bb, alpha))

    return pixels


def generate_icon_pillow(size):
    """Generate icon using Pillow with proper rendering."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background circle with gradient effect
    margin = max(1, size // 20)
    r = size // 2 - margin

    # Draw multiple circles for gradient effect
    steps = 20
    for i in range(steps, 0, -1):
        t = i / steps
        cr = int(14 + t * 30)
        cg = int(31 + t * 50)
        cb = int(66 + t * 80)
        rm = int(r * t)
        draw.ellipse([size//2 - rm, size//2 - rm, size//2 + rm, size//2 + rm],
                     fill=(cr, cg, cb, 255))

    # Outer ring with accent color
    draw.ellipse([margin, margin, size - margin - 1, size - margin - 1],
                 outline=(14, 165, 233, 200), width=max(1, size // 20))

    # Draw pickaxe icon in white
    s = size
    c = s // 2

    # Pickaxe handle - diagonal line
    handle_width = max(2, s // 14)
    draw.line([
        (int(c * 0.4), int(c * 1.6)),
        (int(c * 1.7), int(c * 0.35))
    ], fill=(255, 255, 255, 220), width=handle_width)

    # Pickaxe head - horizontal curved top
    head_y = int(c * 0.42)
    head_h = max(3, s // 10)
    head_w = int(s * 0.38)
    draw.rectangle([c - head_w, head_y - head_h//2, c + head_w, head_y + head_h//2],
                   fill=(14, 200, 255, 230))

    # Left spike
    draw.polygon([
        (c - head_w, head_y - head_h//2),
        (c - head_w - int(s*0.08), head_y - int(s*0.1)),
        (c - head_w, head_y + head_h//2),
    ], fill=(14, 200, 255, 230))

    # Right spike
    draw.polygon([
        (c + head_w, head_y - head_h//2),
        (c + head_w + int(s*0.08), head_y + int(s*0.08)),
        (c + head_w, head_y + head_h//2),
    ], fill=(14, 200, 255, 230))

    # Small coal dot
    dot_r = max(2, s // 12)
    draw.ellipse([c - dot_r, int(c * 1.35) - dot_r, c + dot_r, int(c * 1.35) + dot_r],
                 fill=(255, 200, 50, 200))

    # Apply circular mask
    mask = Image.new('L', (s, s), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse([margin, margin, s - margin - 1, s - margin - 1], fill=255)
    img.putalpha(mask)

    return img


def create_ico(images_dict, output_path):
    """Create Windows .ico file with multiple sizes."""
    sizes = sorted(images_dict.keys())
    num_images = len(sizes)

    # ICO header
    ico_header = struct.pack('<HHH', 0, 1, num_images)  # reserved, type=1(ico), count

    # Directory entries and image data
    dir_entries = b''
    image_data_list = []
    offset = 6 + num_images * 16  # header + directory

    for size in sizes:
        img_bytes = images_dict[size]
        width = size if size < 256 else 0
        height = size if size < 256 else 0
        dir_entry = struct.pack('<BBBBHHII',
            width, height,  # width, height (0=256)
            0,              # color count (0=no palette)
            0,              # reserved
            1,              # planes
            32,             # bit count
            len(img_bytes), # size of image data
            offset          # offset to image data
        )
        dir_entries += dir_entry
        image_data_list.append(img_bytes)
        offset += len(img_bytes)

    with open(output_path, 'wb') as f:
        f.write(ico_header)
        f.write(dir_entries)
        for img_bytes in image_data_list:
            f.write(img_bytes)


def main():
    icons_dir = Path('src-tauri/icons')
    icons_dir.mkdir(parents=True, exist_ok=True)

    sizes = [16, 32, 48, 64, 128, 256]
    png_files = {}

    print("Generating MineCast icons...")

    for size in sizes:
        print(f"  Generating {size}x{size}...")
        output_path = icons_dir / f'{size}x{size}.png'

        if HAS_PILLOW:
            img = generate_icon_pillow(size)
            img.save(str(output_path), 'PNG')
            # Save bytes for ICO
            import io
            buf = io.BytesIO()
            img.save(buf, 'PNG')
            png_files[size] = buf.getvalue()
        else:
            pixels = draw_minecast_icon(size)
            png_bytes = create_png_bytes(size, size, pixels)
            with open(output_path, 'wb') as f:
                f.write(png_bytes)
            png_files[size] = png_bytes

    # Generate 128x128@2x (same as 256)
    large_path = icons_dir / '128x128@2x.png'
    import shutil
    shutil.copy(str(icons_dir / '256x256.png' if (icons_dir / '256x256.png').exists() else icons_dir / '128x128.png'),
                str(large_path))
    print("  Generated 128x128@2x.png")

    # Generate .ico with multiple sizes
    ico_sizes = {k: v for k, v in png_files.items() if k in [16, 32, 48, 64, 128, 256]}
    create_ico(ico_sizes, str(icons_dir / 'icon.ico'))
    print("  Generated icon.ico")

    # Copy 32x32 as the primary square icon
    shutil.copy(str(icons_dir / '32x32.png'), str(icons_dir / 'icon.png'))
    print("  Generated icon.png")

    print(f"\nIcons generated successfully in: {icons_dir}/")
    print("\nFiles created:")
    for f in sorted(icons_dir.iterdir()):
        print(f"  {f.name}")


if __name__ == '__main__':
    main()

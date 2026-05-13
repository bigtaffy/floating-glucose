#!/usr/bin/env python3
"""Apply rounded corners to source icon and regenerate all sizes.

Usage:
  python3 scripts/round_icons.py
"""
import os
import shutil
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "build" / "icon-source.png"
BUILD = ROOT / "build"
ASSETS = ROOT / "assets"

APP_RADIUS_RATIO = 0.22   # macOS Big Sur style
TRAY_RADIUS_RATIO = 0.20  # slightly tighter for tiny tray icons


def rounded_square(src_img: Image.Image, size: int, radius_ratio: float) -> Image.Image:
    """Return src_img resized to size×size with rounded corners on transparent bg."""
    img = src_img.convert("RGBA").resize((size, size), Image.LANCZOS)
    radius = int(size * radius_ratio)

    # Anti-aliased mask via 4x supersampling
    SS = 4
    mask = Image.new("L", (size * SS, size * SS), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle(
        (0, 0, size * SS - 1, size * SS - 1),
        radius=radius * SS,
        fill=255,
    )
    mask = mask.resize((size, size), Image.LANCZOS)

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask=mask)
    return out


def main():
    if not SRC.exists():
        raise SystemExit(f"Source not found: {SRC}")

    src = Image.open(SRC)
    print(f"Source: {SRC.name} ({src.size[0]}x{src.size[1]})")

    # 1) Master app icon (1024x1024) with Big Sur radius
    icon_png = BUILD / "icon.png"
    rounded_square(src, 1024, APP_RADIUS_RATIO).save(icon_png)
    print(f"  -> {icon_png.relative_to(ROOT)}")

    # 2) Full iconset for .icns
    iconset = BUILD / "icon.iconset"
    if iconset.exists():
        shutil.rmtree(iconset)
    iconset.mkdir(parents=True)
    sizes = [
        ("icon_16x16.png", 16),
        ("icon_16x16@2x.png", 32),
        ("icon_32x32.png", 32),
        ("icon_32x32@2x.png", 64),
        ("icon_128x128.png", 128),
        ("icon_128x128@2x.png", 256),
        ("icon_256x256.png", 256),
        ("icon_256x256@2x.png", 512),
        ("icon_512x512.png", 512),
        ("icon_512x512@2x.png", 1024),
    ]
    for name, size in sizes:
        rounded_square(src, size, APP_RADIUS_RATIO).save(iconset / name)
    print(f"  -> {iconset.relative_to(ROOT)}/  ({len(sizes)} files)")

    # 3) .icns
    icns = BUILD / "icon.icns"
    subprocess.run(
        ["iconutil", "-c", "icns", str(iconset), "-o", str(icns)],
        check=True,
    )
    print(f"  -> {icns.relative_to(ROOT)}")

    # 4) Tray icons (macOS + Windows, with retina variants)
    tray_specs = [
        ("tray.png", 22),
        ("tray@2x.png", 44),
        ("tray-win.png", 16),
        ("tray-win@2x.png", 32),
    ]
    for name, size in tray_specs:
        out = ASSETS / name
        rounded_square(src, size, TRAY_RADIUS_RATIO).save(out)
        print(f"  -> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

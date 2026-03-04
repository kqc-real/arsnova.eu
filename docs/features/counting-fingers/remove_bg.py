#!/usr/bin/env python3
"""
Entfernt den Hintergrund aus den Countdown-Einzelbildern (countdown_poster_clean_*.png).
Nutzt die Ecken-Farbe als Hintergrund und macht alle ähnlichen Pixel transparent.
Ausgabe: optimiert/transparent/countdown_poster_clean_*.png
"""
from pathlib import Path
from PIL import Image
import sys

OPTIMIERT = Path(__file__).resolve().parent / "optimiert"
OUT = OPTIMIERT / "transparent"
TOLERANCE_DEFAULT = 48
# Frame 0: Ränder und versprengte gelbe Pixel weg
# Frame 1: minimale Ränder weg
# Frame 2, 3, 5: gut mit Default/62
# Frame 4: nur Standard
TOLERANCE_PER_FRAME = {0: 58, 1: 54, 2: 62}


def get_background_color(img: Image.Image) -> tuple[int, int, int]:
    """Hintergrund aus allen Randpixeln (Mittelwert) – robuster als nur Ecken."""
    w, h = img.size
    pixels = []
    for x in range(0, w, max(1, w // 15)):
        for y in [0, h - 1]:
            p = img.getpixel((x, y))
            pixels.append(p[:3] if len(p) == 4 else p)
    for y in range(0, h, max(1, h // 15)):
        for x in [0, w - 1]:
            p = img.getpixel((x, y))
            pixels.append(p[:3] if len(p) == 4 else p)
    r = int(round(sum(p[0] for p in pixels) / len(pixels)))
    g = int(round(sum(p[1] for p in pixels) / len(pixels)))
    b = int(round(sum(p[2] for p in pixels) / len(pixels)))
    return (r, g, b)


def color_distance(c1: tuple, c2: tuple) -> float:
    """Euklidischer Abstand in RGB."""
    return sum((a - b) ** 2 for a, b in zip(c1[:3], c2[:3])) ** 0.5


def remove_background(src: Path, dest: Path, frame_index: int) -> None:
    img = Image.open(src).convert("RGBA")
    bg = get_background_color(img)
    tol = TOLERANCE_PER_FRAME.get(frame_index, TOLERANCE_DEFAULT)
    data = list(img.getdata())
    new_data = []
    for item in data:
        rgb = item[:3]
        if color_distance(rgb, bg) <= tol:
            new_data.append((*rgb, 0))
        else:
            new_data.append(item)
    img.putdata(new_data)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "PNG")
    print(f"  {src.name} (Tol={tol}) -> {dest.relative_to(OPTIMIERT)}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for i in range(6):
        src = OPTIMIERT / f"countdown_poster_clean_{i}.png"
        if not src.exists():
            print(f"Fehlt: {src}", file=sys.stderr)
            continue
        dest = OUT / src.name
        remove_background(src, dest, i)
    print("Fertig. Transparente Bilder in:", OUT)


if __name__ == "__main__":
    main()

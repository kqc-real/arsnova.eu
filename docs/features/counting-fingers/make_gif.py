#!/usr/bin/env python3
"""
Erstellt aus den 6 transparenten Countdown-PNGs ein GIF.
Länge: exakt 6 Sekunden, 1 Sekunde pro Bild (1000 ms pro Frame).
"""
from pathlib import Path
from PIL import Image

SCRIPT_DIR = Path(__file__).resolve().parent
TRANSPARENT_DIR = SCRIPT_DIR / "optimiert" / "transparent"
GIF_PATH = TRANSPARENT_DIR / "countdown_6s_transparent.gif"
DURATION_MS = 1000  # 1 Sekunde pro Frame → 6 s gesamt


def main():
    frames = []
    for i in range(6):
        path = TRANSPARENT_DIR / f"countdown_poster_clean_{i}.png"
        if not path.exists():
            raise FileNotFoundError(f"Frame fehlt: {path}")
        img = Image.open(path).convert("RGBA")
        frames.append(img)

    # GIF speichern: duration in ms pro Frame, loop=0 = Endlosschleife
    frames[0].save(
        GIF_PATH,
        save_all=True,
        append_images=frames[1:],
        duration=DURATION_MS,
        loop=0,
        disposal=2,  # 2 = vor nächstem Frame Hintergrund wiederherstellen (für Transparenz)
        transparency=0,
    )
    print(f"GIF erstellt: {GIF_PATH}")
    print(f"  {len(frames)} Frames × {DURATION_MS} ms = {len(frames) * DURATION_MS / 1000:.1f} s")


if __name__ == "__main__":
    main()

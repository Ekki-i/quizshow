"""Erzeugt aus dem Show-Bild der Teampulte eine leere Version (ohne Personen)
und die Umrisse der Bogen-Innenflächen für die austauschbaren 3D-Avatare.

Aufruf: python3 scripts/build-podiums.py <Originalbild (938 × 336)>
Ergebnis: assets/img/studio-teams-empty.webp und assets/js/podium-data.js
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
src = Image.open(sys.argv[1]).convert("RGB")
W, H = src.size
px = src.load()

# Bogen-Innenfläche je Pult: linke/rechte Kante, Oberkante, Pultkante (alles in Bildpixeln).
PODS = [(15, 135, 59, 173), (163, 277, 52, 162), (296, 404, 47, 150),
        (511, 621, 45, 157), (645, 755, 52, 162), (784, 900, 60, 173)]
# Mitte des Punktefelds (schwarzes Feld am Pult) und Bogenspitze für die Teamnamen.
SCORES = [(68, 180, 87, 216), (214, 167, 234, 202), (340, 155, 360, 191),
          (556, 156, 576, 192), (692, 166, 711, 202), (832, 180, 852, 216)]


def outline(l, r, t, desk, grow=0.0):
    rx = (r - l) / 2 + grow
    cx = (l + r) / 2
    ry = (r - l) / 2 * 0.9 + grow
    cy = t + (r - l) / 2 * 0.9
    pts = [(l - grow, desk)]
    for k in range(0, 181, 5):
        a = math.radians(180 + k)
        pts.append((cx + rx * math.cos(a), cy + ry * math.sin(a)))
    pts.append((r + grow, desk))
    return pts


def vivid_color(box):
    """Mittel der kräftigsten Farbtöne (oberstes Viertel nach Sättigung × Helligkeit)."""
    x0, y0, x1, y1 = box
    cols = [px[x, y] for y in range(y0, y1) for x in range(x0, x1)]
    cols.sort(key=lambda c: (max(c) - min(c)) * max(c), reverse=True)
    top = cols[: max(1, len(cols) // 4)]
    return tuple(sum(c[i] for c in top) / len(top) for i in range(3))


out = src.copy()
shapes = []
for i, (l, r, t, desk) in enumerate(PODS):
    # Farbe der Rückwand links/rechts oben (dort stehen keine Personen).
    # Eine Grundfarbe je Pult aus der ganzen oberen Rückwand (Personen stehen tiefer).
    base_col = vivid_color((l + 4, t + 8, r - 4, t + 30))
    cl = cr = base_col
    fill = Image.new("RGB", (W, H))
    fp = fill.load()
    for y in range(t - 4, desk + 1):
        v = (y - t) / max(1, desk - t)
        for x in range(l - 4, r + 5):
            u = (x - l) / max(1, r - l)
            base = [(1 - u) * a + u * b for a, b in zip(cl, cr)]
            # Leuchtende Rückwand: Mitte und unterer Rand heller, Seiten etwas dunkler.
            light = 0.92 + 0.2 * (1 - abs(2 * u - 1)) + 0.18 * v - 0.1 * abs(2 * u - 1) ** 3
            whiten = 0.18 * max(0, v - 0.7) / 0.3
            c = [min(255, ch * light * (1 - whiten) + 255 * whiten) for ch in base]
            fp[x, y] = tuple(int(ch) for ch in c)
    # Neonringe wie im Original: Mittelpunkt unten rechts, Bögen nach oben links.
    rings = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(rings)
    span = r - l
    cx, cy = r + span * 0.12, desk + span * 0.08
    for k in (0.42, 0.66, 0.9, 1.14, 1.38):
        R = span * k
        d.ellipse((cx - R, cy - R, cx + R, cy + R), outline=(255, 255, 255, 170), width=2)
    glow = rings.filter(ImageFilter.GaussianBlur(2.2))
    fill = Image.alpha_composite(fill.convert("RGBA"), glow)
    fill = Image.alpha_composite(fill, rings.filter(ImageFilter.GaussianBlur(0.6)))
    # Maske: Bogenform, leicht vergrößert, damit keine Reste der Personen bleiben.
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).polygon(outline(l, r, t, desk, grow=1.5), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.7))
    # Innenschatten an der Bogenkante (Tiefe wie im Original).
    inner = mask.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.GaussianBlur(3))
    edge = ImageChops.subtract(mask, inner)
    dark = Image.new("RGB", (W, H), (10, 6, 18))
    fill = fill.convert("RGB")
    fill.paste(dark, (0, 0), edge.point(lambda a: int(a * 0.55)))
    out.paste(fill, (0, 0), mask)
    # Schatten an der Pultkante, damit der Übergang natürlich wirkt.
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shade).rectangle((l, desk - 3, r, desk), fill=(0, 0, 0, 70))
    out = Image.alpha_composite(out.convert("RGBA"), shade.filter(ImageFilter.GaussianBlur(1.5))).convert("RGB")
    shapes.append({
        "clip": " ".join(f"{x:.1f},{y:.1f}" for x, y in outline(l, r, t, desk)),
        "box": [l, t, r, desk],
        "score": list(SCORES[i]),
    })

out.save(ROOT / "assets/img/studio-teams-empty.webp", "WEBP", quality=90, method=6)
data = {"width": W, "height": H, "podiums": shapes}
(ROOT / "assets/js/podium-data.js").write_text(
    "// Automatisch erzeugt von scripts/build-podiums.py – nicht von Hand ändern.\n"
    f"export const PODIUM_DATA = {json.dumps(data)};\n"
)
print("ok")

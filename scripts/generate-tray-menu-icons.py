"""Generate the high-DPI icon family used by the Windows tray menu."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / 'resources' / 'menu-icons'
LOGICAL_SIZE = 64
SCALE = 4
CANVAS_SIZE = LOGICAL_SIZE * SCALE
STROKE = 5

NEUTRAL = (190, 203, 217, 255)
DANGER = (242, 113, 103, 255)

# The reference glyphs have different native proportions. These scales keep their
# visible strokes aligned with the rest of the 16 logical-pixel menu icon family.
REFERENCE_ICON_STYLE = {
    'refresh.png': (NEUTRAL, 0.75),
    'settings.png': (NEUTRAL, 1.0),
    'quit.png': (DANGER, 0.8),
}


def point(x: float, y: float) -> tuple[int, int]:
    return round(x * SCALE), round(y * SCALE)


def bounds(values: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    return tuple(round(value * SCALE) for value in values)  # type: ignore[return-value]


def line(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], color=NEUTRAL, width=STROKE) -> None:
    draw.line([point(x, y) for x, y in points], fill=color, width=width * SCALE, joint='curve')


def rounded_rect(draw: ImageDraw.ImageDraw, rect, radius: float, *, color=NEUTRAL, fill=None, width=STROKE) -> None:
    draw.rounded_rectangle(
        bounds(rect),
        radius=round(radius * SCALE),
        outline=color if fill is None else None,
        fill=fill,
        width=width * SCALE,
    )


def ellipse(draw: ImageDraw.ImageDraw, rect, *, color=NEUTRAL, fill=None, width=STROKE) -> None:
    draw.ellipse(bounds(rect), outline=color if fill is None else None, fill=fill, width=width * SCALE)


def arc(draw: ImageDraw.ImageDraw, rect, start: float, end: float, *, color=NEUTRAL, width=STROKE) -> None:
    draw.arc(bounds(rect), start=start, end=end, fill=color, width=width * SCALE)


def polygon(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], *, color=NEUTRAL) -> None:
    draw.polygon([point(x, y) for x, y in points], fill=color)


def canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new('RGBA', (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    return image, ImageDraw.Draw(image)


def save(image: Image.Image, filename: str) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    image.resize((LOGICAL_SIZE, LOGICAL_SIZE), Image.Resampling.LANCZOS).save(OUTPUT_DIR / filename, 'PNG')


def normalize_reference_icon(filename: str, color: tuple[int, int, int, int], scale: float) -> None:
    """Keep a reference glyph's silhouette while fitting it to the shared icon grid."""
    path = OUTPUT_DIR / filename
    source = Image.open(path).convert('RGBA')
    if source.size != (LOGICAL_SIZE, LOGICAL_SIZE):
        scaled_size = round(LOGICAL_SIZE * scale)
        source = source.resize((scaled_size, scaled_size), Image.Resampling.LANCZOS)
        canvas_image = Image.new('RGBA', (LOGICAL_SIZE, LOGICAL_SIZE), (0, 0, 0, 0))
        offset = (LOGICAL_SIZE - scaled_size) // 2
        canvas_image.alpha_composite(source, (offset, offset))
        source = canvas_image
    image = Image.new('RGBA', source.size, color)
    image.putalpha(source.getchannel('A'))
    image.save(path, 'PNG')


def draw_show_hide() -> None:
    image, draw = canvas()
    rounded_rect(draw, (10, 12, 54, 52), 5)
    line(draw, [(10, 23), (54, 23)])
    save(image, 'show-hide.png')


def draw_pause() -> None:
    image, draw = canvas()
    rounded_rect(draw, (19, 12, 28, 52), 3, fill=NEUTRAL)
    rounded_rect(draw, (36, 12, 45, 52), 3, fill=NEUTRAL)
    save(image, 'pause.png')


def draw_play() -> None:
    image, draw = canvas()
    polygon(draw, [(22, 13), (50, 32), (22, 51)])
    save(image, 'play-green.png')


def draw_recent_articles() -> None:
    image, draw = canvas()
    rounded_rect(draw, (10, 10, 54, 54), 5)
    line(draw, [(10, 22), (54, 22)])
    line(draw, [(20, 32), (45, 32)])
    line(draw, [(20, 42), (39, 42)])
    save(image, 'recent-articles.png')


def draw_notifications() -> None:
    image, draw = canvas()
    arc(draw, (18, 11, 46, 39), 180, 360)
    line(draw, [(18, 25), (18, 38), (12, 47), (52, 47), (46, 38), (46, 25)])
    arc(draw, (26, 43, 38, 55), 20, 160)
    save(image, 'notifications.png')


def draw_help() -> None:
    image, draw = canvas()
    ellipse(draw, (9, 9, 55, 55))
    arc(draw, (22, 18, 42, 38), 205, 40)
    line(draw, [(42, 28), (35, 35), (35, 40)])
    ellipse(draw, (32, 45, 38, 51), fill=NEUTRAL)
    save(image, 'help.png')


def draw_faq() -> None:
    image, draw = canvas()
    rounded_rect(draw, (9, 11, 55, 46), 5)
    polygon(draw, [(20, 46), (20, 55), (30, 46)])
    arc(draw, (23, 19, 42, 37), 205, 40)
    line(draw, [(42, 28), (35, 34), (35, 38)])
    ellipse(draw, (32, 41, 38, 47), fill=NEUTRAL)
    save(image, 'faq.png')


def draw_changelog() -> None:
    image, draw = canvas()
    rounded_rect(draw, (15, 8, 48, 56), 4)
    line(draw, [(36, 8), (48, 20), (36, 20), (36, 8)])
    line(draw, [(23, 30), (41, 30)])
    line(draw, [(23, 41), (41, 41)])
    save(image, 'changelog.png')


def draw_homepage() -> None:
    image, draw = canvas()
    line(draw, [(9, 30), (32, 11), (55, 30), (55, 53), (9, 53), (9, 30)])
    line(draw, [(25, 53), (25, 39), (39, 39), (39, 53)])
    save(image, 'homepage.png')


def draw_donate() -> None:
    image, draw = canvas()
    arc(draw, (11, 12, 33, 35), 180, 360)
    arc(draw, (31, 12, 53, 35), 180, 360)
    line(draw, [(11, 24), (32, 52), (53, 24)])
    save(image, 'donate.png')


def draw_about() -> None:
    image, draw = canvas()
    ellipse(draw, (9, 9, 55, 55))
    line(draw, [(32, 29), (32, 44)])
    ellipse(draw, (29, 18, 35, 24), fill=NEUTRAL)
    save(image, 'about.png')


def draw_update() -> None:
    image, draw = canvas()
    line(draw, [(32, 10), (32, 40)])
    line(draw, [(21, 29), (32, 40), (43, 29)])
    line(draw, [(13, 53), (51, 53)])
    save(image, 'update.png')


def draw_suite() -> None:
    image, draw = canvas()
    for left, top in [(11, 11), (35, 11), (11, 35), (35, 35)]:
        rounded_rect(draw, (left, top, left + 18, top + 18), 3)
    save(image, 'suite.png')


if __name__ == '__main__':
    for reference_icon, (color, scale) in REFERENCE_ICON_STYLE.items():
        normalize_reference_icon(reference_icon, color, scale)
    draw_show_hide()
    draw_pause()
    draw_play()
    draw_recent_articles()
    draw_notifications()
    draw_help()
    draw_faq()
    draw_changelog()
    draw_homepage()
    draw_donate()
    draw_about()
    draw_update()
    draw_suite()

"""Generate the shared CyberGems NSIS sidebar with the CyberFeeds app icon."""
import math
import os

from PIL import Image, ImageDraw


WIDTH = 164
HEIGHT = 314
ICON_SIZE = 92
ICON_CENTER = (WIDTH // 2, 118)


def mix(start: int, end: int, amount: float) -> int:
    return round(start + (end - start) * amount)


def make_background() -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(image)

    start = (255, 255, 255)
    end = (232, 241, 252)
    for y in range(HEIGHT):
        amount = y / (HEIGHT - 1)
        draw.line(
            (0, y, WIDTH, y),
            fill=tuple(mix(a, b, amount) for a, b in zip(start, end)),
        )

    arc_center = (WIDTH * 1.30, HEIGHT * 0.50)
    outer_radius = WIDTH * 1.05
    for radius, thickness in ((outer_radius, 3), (outer_radius - 14, 2)):
        bounds = (
            arc_center[0] - radius,
            arc_center[1] - radius,
            arc_center[0] + radius,
            arc_center[1] + radius,
        )
        draw.ellipse(bounds, outline="#dae8f9", width=thickness)

    dots = []
    for index in range(26):
        angle = math.radians((index * 137.5) % 360)
        radius = 0.30 + 0.22 * ((index % 5) / 4)
        x = WIDTH * 0.78 + math.cos(angle) * WIDTH * radius * 0.62
        y = HEIGHT * 0.52 + math.sin(angle) * HEIGHT * radius * 0.42
        if 0 <= x <= WIDTH and 0 <= y <= HEIGHT:
            dots.append((x, y, 2 if index % 4 == 0 else 1))

    for index, dot in enumerate(dots):
        for neighbor in dots[index + 1:index + 3]:
            if math.hypot(dot[0] - neighbor[0], dot[1] - neighbor[1]) < 34:
                draw.line(
                    (dot[0], dot[1], neighbor[0], neighbor[1]),
                    fill="#deebfa",
                    width=1,
                )

    for x, y, radius in dots:
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill="#c9dcf0")

    glow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    pixels = glow.load()
    for y in range(HEIGHT):
        for x in range(WIDTH):
            distance = math.hypot(x - ICON_CENTER[0], y - ICON_CENTER[1]) / 68
            if distance > 1:
                continue
            if distance <= 0.55:
                alpha = 0.22 - (0.22 - 0.08) * (distance / 0.55)
            else:
                alpha = 0.08 * (1 - (distance - 0.55) / 0.45)
            pixels[x, y] = (34, 211, 238, round(alpha * 255))

    return Image.alpha_composite(image.convert("RGBA"), glow)


def main() -> None:
    build_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "build")
    icon_path = os.path.join(build_dir, "icon.png")
    if not os.path.exists(icon_path):
        raise SystemExit(f"App icon not found: {icon_path}")

    sidebar = make_background()
    icon = Image.open(icon_path).convert("RGBA")
    icon = icon.resize((ICON_SIZE, ICON_SIZE), Image.Resampling.LANCZOS)
    sidebar.alpha_composite(
        icon,
        (ICON_CENTER[0] - ICON_SIZE // 2, ICON_CENTER[1] - ICON_SIZE // 2),
    )
    sidebar = sidebar.convert("RGB")

    png_path = os.path.join(build_dir, "installerSidebar.png")
    bmp_path = os.path.join(build_dir, "installerSidebar.bmp")
    sidebar.save(png_path, optimize=True)
    sidebar.save(bmp_path, format="BMP")
    print(f"Saved suite-styled installer sidebar ({WIDTH}x{HEIGHT}) to {png_path} and {bmp_path}")


if __name__ == "__main__":
    main()

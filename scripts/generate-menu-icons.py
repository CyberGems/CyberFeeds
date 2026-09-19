import os
from PIL import Image, ImageDraw

MENU_ICONS_DIR = os.path.join(os.path.dirname(__file__), '..', 'resources', 'menu-icons')
os.makedirs(MENU_ICONS_DIR, exist_ok=True)

# Standard icon color matching existing theme (light slate cyan-gray)
COLOR = (185, 200, 215, 255)
ACCENT = (0, 216, 241, 255)

def make_canvas():
    # Render at 64x64 (4x supersampling) and downsample with LANCZOS to 16x16
    return Image.new('RGBA', (64, 64), (0, 0, 0, 0))

def save_icon(img, filename):
    out = img.resize((16, 16), Image.Resampling.LANCZOS)
    target_path = os.path.join(MENU_ICONS_DIR, filename)
    out.save(target_path, 'PNG')
    print(f"Generated {filename}")

# 1. copy.png - Two overlapping sheets
def draw_copy():
    img = make_canvas()
    d = ImageDraw.Draw(img)
    # Back sheet
    d.rounded_rectangle([18, 6, 56, 44], radius=6, outline=COLOR, width=5)
    # Front sheet (solid bg to occlude back sheet)
    d.rounded_rectangle([8, 18, 46, 56], radius=6, fill=(15, 20, 28, 255), outline=COLOR, width=5)
    save_icon(img, 'copy.png')

# 2. copy-title.png - Document with bold title bar
def draw_copy_title():
    img = make_canvas()
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([10, 6, 54, 58], radius=6, outline=COLOR, width=5)
    # Title bar (accent color)
    d.rounded_rectangle([18, 16, 46, 24], radius=3, fill=ACCENT)
    # Content lines
    d.rounded_rectangle([18, 32, 46, 36], radius=2, fill=COLOR)
    d.rounded_rectangle([18, 42, 36, 46], radius=2, fill=COLOR)
    save_icon(img, 'copy-title.png')

# 3. open-link.png - Box with arrow exiting top-right
def draw_open_link():
    img = make_canvas()
    d = ImageDraw.Draw(img)
    # Window box with missing top-right corner
    d.line([(34, 10), (12, 10), (12, 52), (52, 52), (52, 30)], fill=COLOR, width=5, joint='round')
    # Arrow diagonal
    d.line([(26, 38), (52, 12)], fill=COLOR, width=6)
    # Arrow head
    d.polygon([(36, 10), (54, 10), (54, 28)], fill=COLOR)
    save_icon(img, 'open-link.png')

# 4. copy-link.png - Chain links
def draw_copy_link():
    img = make_canvas()
    d = ImageDraw.Draw(img)
    # Two rounded link loops connected diagonally
    d.rounded_rectangle([10, 22, 36, 46], radius=10, outline=COLOR, width=5)
    d.rounded_rectangle([28, 14, 54, 38], radius=10, outline=COLOR, width=5)
    d.line([(24, 32), (40, 26)], fill=COLOR, width=6)
    save_icon(img, 'copy-link.png')

# 5. search-google.png - Magnifying glass
def draw_search():
    img = make_canvas()
    d = ImageDraw.Draw(img)
    # Lens circle
    d.ellipse([10, 10, 42, 42], outline=COLOR, width=6)
    # Handle
    d.line([(35, 35), (54, 54)], fill=COLOR, width=7)
    save_icon(img, 'search-google.png')

# 6. copy-image.png - Photo frame with mountain & sun
def draw_image():
    img = make_canvas()
    d = ImageDraw.Draw(img)
    # Photo frame
    d.rounded_rectangle([8, 10, 56, 54], radius=6, outline=COLOR, width=5)
    # Sun
    d.ellipse([18, 18, 26, 26], fill=ACCENT)
    # Mountain peaks
    d.polygon([(14, 46), (28, 30), (38, 42), (48, 26), (52, 46)], fill=COLOR)
    save_icon(img, 'copy-image.png')

# 7. select-all.png - Document with all text highlighted / checkmark
def draw_select_all():
    img = make_canvas()
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([8, 8, 56, 56], radius=6, outline=COLOR, width=4)
    # Three selected lines with highlight fill
    d.rounded_rectangle([16, 16, 48, 24], radius=3, fill=ACCENT)
    d.rounded_rectangle([16, 28, 48, 36], radius=3, fill=ACCENT)
    d.rounded_rectangle([16, 40, 48, 48], radius=3, fill=ACCENT)
    save_icon(img, 'select-all.png')

# 8. cut.png - Scissors
def draw_cut():
    img = make_canvas()
    d = ImageDraw.Draw(img)
    # Rings
    d.ellipse([8, 38, 24, 54], outline=COLOR, width=5)
    d.ellipse([40, 38, 56, 54], outline=COLOR, width=5)
    # Crossed blades
    d.line([(18, 40), (48, 10)], fill=COLOR, width=5)
    d.line([(46, 40), (16, 10)], fill=COLOR, width=5)
    # Pivot screw
    d.ellipse([(30, 26), (34, 30)], fill=ACCENT)
    save_icon(img, 'cut.png')

# 9. paste.png - Clipboard
def draw_paste():
    img = make_canvas()
    d = ImageDraw.Draw(img)
    # Board
    d.rounded_rectangle([12, 14, 52, 58], radius=5, outline=COLOR, width=5)
    # Top clip
    d.rounded_rectangle([22, 6, 42, 18], radius=3, fill=COLOR)
    # Document lines
    d.rounded_rectangle([20, 26, 44, 30], radius=2, fill=COLOR)
    d.rounded_rectangle([20, 36, 44, 40], radius=2, fill=COLOR)
    d.rounded_rectangle([20, 46, 36, 50], radius=2, fill=COLOR)
    save_icon(img, 'paste.png')

# 10. delete.png - Trash can
def draw_delete():
    img = make_canvas()
    d = ImageDraw.Draw(img)
    # Lid handle
    d.rounded_rectangle([24, 8, 40, 14], radius=2, outline=COLOR, width=4)
    # Lid
    d.line([(10, 16), (54, 16)], fill=COLOR, width=5)
    # Bin body
    d.polygon([(16, 20), (48, 20), (44, 56), (20, 56)], outline=COLOR)
    # Slits
    d.line([(26, 26), (26, 50)], fill=COLOR, width=4)
    d.line([(38, 26), (38, 50)], fill=COLOR, width=4)
    save_icon(img, 'delete.png')

if __name__ == '__main__':
    draw_copy()
    draw_copy_title()
    draw_open_link()
    draw_copy_link()
    draw_search()
    draw_image()
    draw_select_all()
    draw_cut()
    draw_paste()
    draw_delete()
    print("All menu icons generated successfully.")

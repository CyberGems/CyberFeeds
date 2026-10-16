import os
from PIL import Image, ImageDraw

def generate_graphics():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    build_dir = os.path.join(root_dir, 'build')

    source_path = os.path.join(build_dir, 'installerSidebarSource.png')
    if not os.path.exists(source_path):
        source_path = os.path.join(build_dir, 'installerSidebar.png')

    print('Generating installer sidebar (164x314)...')
    im = Image.open(source_path)
    sidebar = im.resize((164, 314), Image.Resampling.LANCZOS).convert('RGB')
    
    sidebar_bmp_path = os.path.join(build_dir, 'installerSidebar.bmp')
    sidebar_png_path = os.path.join(build_dir, 'installerSidebar.png')
    sidebar.save(sidebar_bmp_path, format='BMP')
    sidebar.save(sidebar_png_path)
    print(f'Saved {sidebar_bmp_path} ({os.path.getsize(sidebar_bmp_path)} bytes) and {sidebar_png_path}')

    print('Generating installer header (150x57)...')
    width, height = 150, 57
    header = Image.new('RGB', (width, height), '#FFFFFF')
    draw = ImageDraw.Draw(header)

    # Soft tech gradient from white to pale ice-cyan
    for x in range(width):
        t = x / width
        r = int(255 * (1 - t) + 232 * t)
        g = int(255 * (1 - t) + 246 * t)
        b = int(255 * (1 - t) + 252 * t)
        draw.line([(x, 0), (x, height)], fill=(r, g, b))

    # Subtle decorative concentric circles in cyan
    circle_overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    cdraw = ImageDraw.Draw(circle_overlay)
    cdraw.ellipse([(126 - 24, 28 - 24), (126 + 24, 28 + 24)], fill=(0, 216, 241, 20))
    cdraw.ellipse([(126 - 16, 28 - 16), (126 + 16, 28 + 16)], fill=(56, 189, 248, 15))

    header = Image.alpha_composite(header.convert('RGBA'), circle_overlay)

    # Add CyberFeeds logo on the right
    logo_path = os.path.join(build_dir, 'icon.png')
    if os.path.exists(logo_path):
        logo = Image.open(logo_path).convert('RGBA')
        logo = logo.resize((44, 44), Image.Resampling.LANCZOS)
        header.paste(logo, (98, 6), logo)

    final_header = header.convert('RGB')
    header_bmp_path = os.path.join(build_dir, 'installerHeader.bmp')
    header_png_path = os.path.join(build_dir, 'installerHeader.png')
    final_header.save(header_bmp_path, format='BMP')
    final_header.save(header_png_path)
    print(f'Saved {header_bmp_path} ({os.path.getsize(header_bmp_path)} bytes) and {header_png_path}')

if __name__ == '__main__':
    generate_graphics()

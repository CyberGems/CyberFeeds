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

if __name__ == '__main__':
    generate_graphics()

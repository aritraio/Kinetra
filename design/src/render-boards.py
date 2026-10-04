"""Build review boards from rendered mockups. Requires Pillow; no image editing model."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
screens = json.loads((root / 'screen-manifest.json').read_text())
try:
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 16)
    title_font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 30)
    small_font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 12)
except OSError:
    font = title_font = small_font = ImageFont.load_default()
for platform in ['web', 'android']:
    for theme in ['light', 'dark']:
        width, height = (300, 220) if platform == 'web' else (184, 440)
        cols = 5 if platform == 'web' else 7
        rows = (len(screens) + cols - 1) // cols
        board = Image.new('RGB', (cols * (width + 20) + 20, rows * (height + 54) + 125), '#e9eae6')
        d = ImageDraw.Draw(board)
        d.text((25, 20), 'KINETRA / SCREEN ATLAS', font=title_font, fill='#20241f')
        d.text((25, 64), f'{platform.upper()} / {theme.upper()} / {len(screens)} SCREEN CONCEPTS / SYNTHETIC DATA', font=font, fill='#525c50')
        for i, screen in enumerate(screens):
            img = Image.open(root / 'mockups' / platform / theme / f"{screen['id']}.png").convert('RGB')
            x, y = 20 + (i % cols) * (width + 20), 110 + (i // cols) * (height + 54)
            if platform == 'web':
                # Crop top of long desktop pages for a consistent index preview.
                img = img.crop((0, 0, img.width, min(img.height, 1040)))
            img.thumbnail((width, height), Image.Resampling.LANCZOS)
            board.paste(img, (x, y))
            d.text((x, y + height + 8), f"{i+1:02} / {screen['id']}", font=small_font, fill='#20241f')
        board.save(root / f'overview-{platform}-{theme}.jpg', quality=88)

# Compact direction board with both desktop themes and both phone themes.
board = Image.new('RGB', (1880, 1190), '#e9eae6')
d = ImageDraw.Draw(board)
d.text((40, 28), 'KINETRA / QUIET ATHLETIC PRECISION', font=title_font, fill='#20241f')
d.text((40, 76), 'MONOCHROME 01 / WEB + FUTURE ANDROID / EDITABLE CONCEPTS', font=font, fill='#525c50')
for theme, y in [('light', 132), ('dark', 648)]:
    img = Image.open(root / 'mockups' / 'web' / theme / 'today.png').convert('RGB').crop((0, 0, 1440, 1000))
    img = img.resize((710, 493), Image.Resampling.LANCZOS)
    board.paste(img, (40, y))
    d.text((770, y + 20), f'WEB / {theme.upper()}', font=font, fill='#20241f')
for theme, x in [('light', 1010), ('dark', 1435)]:
    img = Image.open(root / 'mockups' / 'android' / theme / 'today.png').convert('RGB')
    img = img.resize((390, 866), Image.Resampling.LANCZOS)
    board.paste(img, (x, 190))
    d.text((x, 145), f'ANDROID / {theme.upper()}', font=font, fill='#20241f')
d.text((1010, 1112), 'SYNTHETIC DATA / DESIGN PROPOSAL', font=font, fill='#525c50')
board.save(root / 'direction-board.png')
print('Created four full contact sheets and the direction board.')

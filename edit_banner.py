from PIL import Image, ImageDraw, ImageFont
import numpy as np

img = Image.open('/Users/kwoneren/.openclaw/media/inbound/file_1024---7c73a24d-fa09-41e6-87ad-2a6cbe121b96.jpg')
pixels = np.array(img)

font_path = '/System/Library/Fonts/AppleSDGothicNeo.ttc'

def font(size, index=0):
    return ImageFont.truetype(font_path, size, index=index)

# The person starts around x~680 at the top, wider at bottom
# Strategy: sample background colors and paint gradients to blend

# Sample bg colors at various y-levels from the left edge (x=10)
def sample_col(y, x=10):
    return tuple(pixels[y, x])

# Cover title area row by row with sampled bg color for smooth blend
# Title text spans roughly y:80 to y:285, extends to about x:750
for y in range(75, 290):
    # Person boundary: roughly x = 680 at top, shifts left as we go down
    # Actually the person's jacket starts around x=700 at y=200
    person_x = 720  # safe boundary
    col = sample_col(y, 15)
    for x in range(25, min(person_x, 1200)):
        # Only overwrite if pixel looks like text (bright yellow/white on dark bg)
        r, g, b = pixels[y, x]
        brightness = (r + g + b) / 3
        # Original bg is very dark (<60), text is bright (>150)
        if brightness > 50 or r > 80 or g > 100:
            pixels[y, x] = col

# Cover date line area y:295-395
for y in range(295, 400):
    person_x = 680
    col = sample_col(y, 15)
    for x in range(25, min(person_x, 1200)):
        r, g, b = pixels[y, x]
        brightness = (r + g + b) / 3
        if brightness > 50 or r > 80 or g > 100:
            pixels[y, x] = col

# Cover bottom text area y:530-635
for y in range(525, 640):
    person_x = 650
    col = sample_col(y, 15)
    for x in range(25, min(person_x, 1200)):
        r, g, b = pixels[y, x]
        brightness = (r + g + b) / 3
        if brightness > 50 or r > 80 or g > 100:
            pixels[y, x] = col

img2 = Image.fromarray(pixels)
draw = ImageDraw.Draw(img2)

# === New text ===
try:
    f_title1 = font(52, index=6)
    f_title2 = font(82, index=6)
    f_label = font(26, index=6)
    f_date = font(32, index=4)
    f_bottom = font(28, index=4)
except:
    f_title1 = font(52)
    f_title2 = font(82)
    f_label = font(26)
    f_date = font(32)
    f_bottom = font(28)

# Title
draw.text((42, 100), "리스크없는 소자본", fill='white', font=f_title1)
draw.text((42, 170), "위탁판매", fill=(255, 255, 0), font=f_title2)

# Date
draw.rounded_rectangle([42, 318, 148, 370], radius=8, fill=(255, 230, 0))
draw.text((55, 328), "첫강의", fill=(18, 12, 30), font=f_label)
draw.text((160, 326), "05.24(토) 바로 시작!", fill='white', font=f_date)

# Bottom
draw.text((42, 562), "⚡ 이커머스 마케팅 전문가 에렌", fill=(170, 180, 255), font=f_bottom)

out = '/Users/kwoneren/.openclaw/workspace/banner_edited.png'
img2.save(out, 'PNG')
print(f'Saved: {out}')

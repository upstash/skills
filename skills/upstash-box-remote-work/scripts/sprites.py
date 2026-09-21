#!/usr/bin/env python3
# Cursor, press and ripple sprites for the editor. Small, thin, anti-aliased (4x supersampled).
from PIL import Image, ImageDraw, ImageFilter
import os
S = 4
def arrow(h_px, out):
    H = h_px * S; W = int(h_px * 0.62) * S
    pts = [(0,0),(0,H*0.80),(H*0.19,H*0.63),(H*0.32,H*0.95),(H*0.42,H*0.90),(H*0.30,H*0.60),(H*0.54,H*0.58)]
    img = Image.new('RGBA', (W + 8*S, H + 8*S), (0,0,0,0))
    sh = Image.new('RGBA', img.size, (0,0,0,0))
    ImageDraw.Draw(sh).polygon([(x+3*S+1.5*S, y+3*S+2*S) for x,y in pts], fill=(0,0,0,110))
    sh = sh.filter(ImageFilter.GaussianBlur(1.6*S))
    img.alpha_composite(sh)
    d = ImageDraw.Draw(img)
    d.polygon([(x+3*S, y+3*S) for x,y in pts], fill=(255,255,255,255), outline=(20,20,20,255), width=int(1.1*S))
    img = img.resize((img.width//S, img.height//S), Image.LANCZOS)
    img.save(out)
    return img.size
print('cursor', arrow(25, 'cursor.png'))
print('press', arrow(22, 'cursor-press.png'))
os.makedirs('ripple', exist_ok=True)
N = 14; SZ = 72
for i in range(N):
    t = i/(N-1)
    r = (6 + 26*t) * S; a = int(200*(1-t)**1.5); w = max(1, int((2.2 - 1.4*t)*S))
    im = Image.new('RGBA', (SZ*S, SZ*S), (0,0,0,0))
    c = SZ*S/2
    ImageDraw.Draw(im).ellipse([c-r, c-r, c+r, c+r], outline=(255,255,255,a), width=w)
    im = im.resize((SZ, SZ), Image.LANCZOS)
    im.save(f'ripple/r{i:02d}.png')
print('ripple frames', N)

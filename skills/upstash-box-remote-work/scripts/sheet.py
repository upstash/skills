#!/usr/bin/env python3
# Contact sheet: sheet.py <video> <out.png> t1 t2 ...  (stills at the given seconds, 3 per row, with timestamps)
import subprocess, sys, tempfile, os
from PIL import Image, ImageDraw
video, out, *ts = sys.argv[1:]
ts = [float(t) for t in ts]
tiles = []
with tempfile.TemporaryDirectory() as d:
    for i, t in enumerate(ts):
        p = os.path.join(d, f'{i}.png')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', video, '-frames:v', '1', p], check=True)
        im = Image.open(p).convert('RGB'); im.thumbnail((640, 400)); ImageDraw.Draw(im).text((8, 8), f'{t:.2f}s', fill=(255, 80, 80)); tiles.append(im)
cols = 3; rows = (len(tiles) + cols - 1) // cols
w, h = tiles[0].size
sheet = Image.new('RGB', (cols * w, rows * h), (30, 30, 30))
for i, im in enumerate(tiles): sheet.paste(im, ((i % cols) * w, (i // cols) * h))
sheet.save(out); print(out, sheet.size)

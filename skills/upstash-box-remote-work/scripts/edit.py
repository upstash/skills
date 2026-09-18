#!/usr/bin/env python3
"""Cut a take into the short clip: prompt at 1x, work as a round-factor timelapse with a badge and
tool captions, final answer with a cursor that clicks the link, then the outcome with a URL pill.
Usage: edit.py <name> [--factor N] [--work 8.5]   -> full/<name>-final.mp4
Inputs: full/<name>.json, full/<name>-export.json, full/<name>.mp4, full/<name>-outcome.{json,mp4}
"""
import json, sys, subprocess, math, argparse
from datetime import datetime
ap = argparse.ArgumentParser(); ap.add_argument('name'); ap.add_argument('--factor', type=int); ap.add_argument('--work', type=float, default=8.5)
ap.add_argument('--outcome', type=float, default=3.6); ap.add_argument('--answer', type=float, default=2.75)
A = ap.parse_args(); name = A.name
W, H, FPS = 1280, 800, 30
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'; MONO = '/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Bold.ttf'
meta = json.load(open(f'full/{name}.json')); exp = json.load(open(f'full/{name}-export.json')); oc = json.load(open(f'full/{name}-outcome.json'))

def ev(events, key): return next(e['t'] for e in events if e['event'] == key)
def dur(path): return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).decode().strip())
def started(rec, events, stopkey):
    """Wall-clock ms of the recording's first frame. The recorder's startedAt is ~2 s early (capture
    begins after start() returns), so anchor on the end: endedAt (or the stop event) minus the file's duration."""
    end = (rec or {}).get('endedAt') or ev(events, stopkey)
    if isinstance(end, str): end = datetime.fromisoformat(end.replace('Z', '+00:00')).timestamp() * 1000
    if end < 1e12: end *= 1000
    return end - dur(rec_path) * 1000, 'end-minus-duration'

rec_path = f'full/{name}.mp4'; rec0, how = started(meta['recording'], meta['events'], 'rec_stop_request')
v = lambda t: (t - rec0) / 1000
rec_path = f'full/{name}-outcome.mp4'; orec0, ohow = started(oc['recording'], oc['events'], 'rec_stopped')
o = lambda t: (t - orec0) / 1000
print(f'take rec0 via {how}, outcome rec0 via {ohow}')

msgs = exp['messages']; last = msgs[-1]
completed = last['info']['time']['completed']
tA = max(0.0, v(ev(meta['events'], 'type_start')) - 0.35)
tB = v(ev(meta['events'], 'submit')) + 0.15
tC = v(completed) + 0.4
take_len = dur(f'full/{name}.mp4')
tD = min(tC + A.answer, take_len - 0.05)
work = tC - tB
F = A.factor or min([10, 20, 30, 40, 50], key=lambda f: abs(work / f - A.work))
print(f'segments: prompt {tA:.2f}-{tB:.2f}  work {tB:.2f}-{tC:.2f} ({work:.1f}s @ {F}x = {work/F:.1f}s)  answer {tC:.2f}-{tD:.2f}  take {take_len:.1f}s')

# captions: one per tool call, at its start, held until the next one (0.7-2.0 s), thinned when they crowd
tools = []
for m in msgs:
    for p in m.get('parts', []):
        if p.get('type') == 'tool' and (p.get('state') or {}).get('time', {}).get('start'):
            label = p['tool'].replace('upstash_', ''); act = (p['state'].get('input') or {}).get('action')
            if act: label += f' · {act}'
            tools.append(((v(p['state']['time']['start']) - tB) / F, label))
tools.sort(); caps = []
for rel, label in tools:
    if rel < 0 or rel > work / F: continue
    if caps and (rel - caps[-1][0] < 0.7 or caps[-1][1] == label): continue
    caps.append([rel, label])
for i, c in enumerate(caps): c.append(min(caps[i + 1][0] if i + 1 < len(caps) else work / F, c[0] + 2.0))
print('captions:', [(round(a, 2), l) for a, l, _ in caps])

def esc(s): return s.replace('\\', '\\\\').replace("'", "\\'").replace(':', '\\:').replace('%', '%%')
def dt(text, **kw): return 'drawtext=' + ':'.join([f"text='{esc(text)}'"] + [f'{k}={v}' for k, v in kw.items()])
scale = f'scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p'
badge = dt(f'{F}x', fontfile=MONO, fontsize=28, fontcolor='0x062b1f', x='w-tw-30', y=26, box=1, boxcolor='0x00d48a@0.95', boxborderw=10)
cap_f = [dt(l, fontfile=SANS, fontsize=24, fontcolor='0xe6edf3', x=32, y='h-72', box=1, boxcolor='0x0b0f14@0.75', boxborderw=12, enable=f"'between(t\\,{a:.3f}\\,{b:.3f})'") for a, l, b in caps]

url = oc['url']; tE = o(ev(oc['events'], 'loaded')) + 0.25; out_len = min(A.outcome, dur(f'full/{name}-outcome.mp4') - tE - 0.05)
pill = dt(url, fontfile=MONO, fontsize=22, fontcolor='white', x='(w-tw)/2', y=28, box=1, boxcolor='0x0b0f14@0.7', boxborderw=12)

# cursor: rests bottom-right, eased curved move to the link, press + ripple, short hold
S3 = (tB - tA) + work / F; S4 = S3 + (tD - tC)
link = meta.get('linkXY') or {}; X1, Y1 = float(link.get('x', 640)), float(link.get('y', 400))
X0, Y0 = 1120.0, 700.0; Tm0, Tm1 = S3 + 1.05, S3 + 1.95; Tc = S3 + 2.2
XC, YC = (X0 + X1) / 2 + 70, (Y0 + Y1) / 2 - 90
def bez(a0, ac, a1):
    u = f'clip((t-{Tm0:.3f})/{Tm1-Tm0:.3f},0,1)'; s = f'({u}^3*({u}*(6*{u}-15)+10))'
    return f'((1-{s})^2*{a0:.1f}+2*(1-{s})*{s}*{ac:.1f}+{s}^2*{a1:.1f}+if(lt(t,{Tm0:.3f}),2*sin(t*1.7),0))'
xe, ye = bez(X0, XC, X1) + '-3', bez(Y0, YC, Y1) + '-3'
q = lambda e: "'" + e.replace(',', '\\,') + "'"
lines = [
  f'[0:v]trim=start={tA:.3f}:end={tB:.3f},setpts=PTS-STARTPTS,fps={FPS},{scale}[s1];',
  f'[0:v]trim=start={tB:.3f}:end={tC:.3f},setpts=(PTS-STARTPTS)/{F},fps={FPS},{scale},' + ','.join([badge] + cap_f) + '[s2];',
  f'[0:v]trim=start={tC:.3f}:end={tD:.3f},setpts=PTS-STARTPTS,fps={FPS},{scale}[s3];',
  f'[1:v]trim=start={tE:.3f}:end={tE+out_len:.3f},setpts=PTS-STARTPTS,fps={FPS},{scale},{pill}[s4];',
  '[s1][s2][s3][s4]concat=n=4:v=1:a=0[base];',
  f'[2:v]format=rgba,tpad=start_duration={Tc:.3f}:color=0x00000000[rp];',
  f'[base][rp]overlay=x={X1-36:.0f}:y={Y1-36:.0f}:eof_action=pass[b1];',
  f"[b1][3:v]overlay=eval=frame:shortest=1:enable={q(f'between(t,{S3:.3f},{S4:.3f})*not(between(t,{Tc:.3f},{Tc+0.15:.3f}))')}:x={q(xe)}:y={q(ye)}[b2];",
  f"[b2][4:v]overlay=eval=frame:shortest=1:enable={q(f'between(t,{Tc:.3f},{Tc+0.15:.3f})')}:x={q(xe)}:y={q(ye)}[v]",
]
open(f'full/{name}-filter.txt', 'w').write('\n'.join(lines) + '\n')
cmd = ['ffmpeg', '-v', 'error', '-y', '-i', f'full/{name}.mp4', '-i', f'full/{name}-outcome.mp4', '-framerate', str(FPS), '-i', 'ripple/r%02d.png', '-loop', '1', '-i', 'cursor.png', '-loop', '1', '-i', 'cursor-press.png',
       '-filter_complex_script', f'full/{name}-filter.txt', '-map', '[v]', '-r', str(FPS), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', '-an', f'full/{name}-final.mp4']
subprocess.run(cmd, check=True)
print(f'final: full/{name}-final.mp4 {dur(f"full/{name}-final.mp4"):.2f}s  (click at {Tc:.2f}s, outcome from {S4:.2f}s)')

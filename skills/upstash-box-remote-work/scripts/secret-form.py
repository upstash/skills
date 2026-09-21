#!/usr/bin/env python3
"""One-shot secrets form. Usage: secret-form.py PORT VAR1 [VAR2 ...]
Prints the random path token; serve it through a plain box preview and share
https://<preview-host>/<token>. Accepts one POST, appends VAR=value lines to
/workspace/home/recorder/.env (mode 600), then exits."""
import http.server, os, re, secrets, sys, threading, urllib.parse
ENV = "/workspace/home/recorder/.env"
port, names = int(sys.argv[1]), sys.argv[2:]
token = secrets.token_urlsafe(24)
done = False
def form():
    rows = "".join(f'<label>{n}<br><input name="{n}" type="password" autocomplete="off" style="width:100%" required></label><br><br>' for n in names)
    return f'<!doctype html><meta charset=utf-8><title>Recorder .env</title><body style="font-family:sans-serif;max-width:520px;margin:3em auto"><h2>Recorder secrets</h2><p>Appended to <code>{ENV}</code>. One submission, then this page shuts down.</p><form method=post>{rows}<button>Save to .env</button></form></body>'.encode()
class H(http.server.BaseHTTPRequestHandler):
    def _send(self, code, body):
        self.send_response(code); self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        if self.path.rstrip("/") != "/" + token: return self._send(404, b"Not found")
        self._send(200, form() if not done else b"<p>Already saved.</p>")
    def do_POST(self):
        global done
        if self.path.rstrip("/") != "/" + token: return self._send(404, b"Not found")
        if done: return self._send(410, b"<p>Already saved.</p>")
        data = urllib.parse.parse_qs(self.rfile.read(int(self.headers.get("Content-Length", "0"))).decode())
        vals = {n: data.get(n, [""])[0].strip() for n in names}
        if any(not re.fullmatch(r"[A-Za-z0-9_./:\-]+", v) for v in vals.values()):
            return self._send(400, b"<p>Rejected: values must be non-empty and contain no spaces or quotes. Go back and retry.</p>")
        old = os.umask(0o077)
        try:
            with open(ENV, "a") as f: f.write("".join(f"{n}={v}\n" for n, v in vals.items()))
            os.chmod(ENV, 0o600)
        finally: os.umask(old)
        done = True
        self._send(200, b"<p><b>Saved.</b> You can close this tab.</p>")
        threading.Timer(1.5, lambda: os._exit(0)).start()
    def log_message(self, *a): pass
print(token, flush=True)
http.server.ThreadingHTTPServer(("0.0.0.0", port), H).serve_forever()

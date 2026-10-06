"""Run the specialist demand dashboard on this PC.

    python app.py            # builds data if needed, serves http://127.0.0.1:8765 and opens the browser
    python app.py --rebuild  # recompute scores first (after re-running sirs_scrape.py)

Listens on 127.0.0.1 only, so nothing is reachable from other machines.
"""
import csv
import json
import os
import sys
import time
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import build_dashboard
import kmk_match

HERE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(HERE, "dashboard")
SPOT_CSV = os.path.join(HERE, "data", "spot_check.csv")
SPOT_FIELDS = ("verified_count", "verdict", "source_url", "note")
HOST, PORT = "127.0.0.1", 8765
build_lock = threading.Lock()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC, **kwargs)

    def log_message(self, fmt, *args):
        pass  # keep the console quiet; errors still surface as responses

    def do_GET(self):
        # The page calls this to know it can save; on GitHub Pages it fails and the page goes read-only.
        if self.path == "/api/ping":
            return self.reply(200, {"ok": True})
        return super().do_GET()

    def end_headers(self):
        # Always serve the latest data.json after a rebuild.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        if self.path not in ("/api/match", "/api/spotcheck"):
            self.send_error(404)
            return
        try:
            req = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            with build_lock:
                if self.path == "/api/match":
                    kmk_match.save_confirmed(str(req["kmk_key"]), str(req.get("sirs_kode") or ""))
                else:
                    save_spot_check(req)
                build_dashboard.main()
            self.reply(200, {"ok": True})
        except Exception as e:  # report the failure to the page instead of dropping the connection
            self.reply(500, {"ok": False, "error": str(e)})

    def reply(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def save_spot_check(req):
    with open(SPOT_CSV, encoding="utf8") as f:
        reader = csv.DictReader(f)
        fields, rows = reader.fieldnames, list(reader)
    hit = [r for r in rows if r["hospital_id"] == str(req["hospital_id"]) and r["specialty"] == str(req["specialty"])]
    if not hit:
        raise ValueError("That hospital and specialty are not in the spot-check sheet")
    for k in SPOT_FIELDS:
        hit[0][k] = str(req.get(k, "")).strip()
    hit[0]["checked_on"] = time.strftime("%Y-%m-%d")
    with open(SPOT_CSV, "w", newline="", encoding="utf8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


def main():
    if "--rebuild" in sys.argv or not os.path.exists(os.path.join(STATIC, "data.json")):
        build_dashboard.main()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    url = f"http://{HOST}:{PORT}/"
    print(f"Dashboard running at {url}  (Ctrl+C to stop)")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopped.")


if __name__ == "__main__":
    main()

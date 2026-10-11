"""JalDrishti Dashboard Server
Serves the web dashboard and analytical results for JalDrishti.
Uses Python standard library http.server (zero external dependencies).
"""

import http.server
import socketserver
import os
import sys
from pathlib import Path

PORT = int(os.environ.get("PORT", 8080))
BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"
DATA_DIR = BASE_DIR / "data_output"

class JalDrishtiHandler(http.server.SimpleHTTPRequestHandler):
    """Serves web/ as the site root (so every page's relative links work) plus a JSON API."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def do_GET(self):
        route = self.path.split("?", 1)[0]
        if route in ("/api/results", "/api/analysis"):
            body = (DATA_DIR / "analysis_results.json").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

def run_server(port=PORT):
    handler = JalDrishtiHandler
    # Allow address reuse
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"JalDrishti Dashboard serving at http://localhost:{port}/")
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    p = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    run_server(p)

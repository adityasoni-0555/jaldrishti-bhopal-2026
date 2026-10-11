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
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_GET(self):
        # Route root requests to /web/index.html
        if self.path == "/" or self.path == "":
            self.path = "/web/index.html"
        elif self.path == "/api/results" or self.path == "/api/analysis":
            self.path = "/data_output/analysis_results.json"
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

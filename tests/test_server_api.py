"""Smoke and Integration Tests for JalDrishti Dashboard & API Server
Bhopal Impact Lab 2026 - Track 2: Visarjan Ghat Watch
"""

import json
import socketserver
import threading
import unittest
import urllib.request
from pathlib import Path

from server import JalDrishtiHandler

BASE_DIR = Path(__file__).resolve().parent.parent


class TestDashboardAssetsAndBundle(unittest.TestCase):
    """Verify that all required frontend assets and standalone bundles exist."""

    def test_frontend_assets_exist(self):
        index_file = BASE_DIR / "web" / "index.html"
        style_file = BASE_DIR / "web" / "style.css"
        app_file = BASE_DIR / "web" / "app.js"
        data_file = BASE_DIR / "web" / "data.js"
        json_file = BASE_DIR / "data_output" / "analysis_results.json"

        self.assertTrue(index_file.is_file(), "web/index.html must exist")
        self.assertTrue(style_file.is_file(), "web/style.css must exist")
        self.assertTrue(app_file.is_file(), "web/app.js must exist")
        self.assertTrue(data_file.is_file(), "web/data.js must exist")
        self.assertTrue(json_file.is_file(), "data_output/analysis_results.json must exist")

    def test_web_data_js_sync_with_json(self):
        json_file = BASE_DIR / "data_output" / "analysis_results.json"
        data_file = BASE_DIR / "web" / "data.js"

        with open(json_file, encoding="utf-8") as f:
            json_data = json.load(f)

        with open(data_file, encoding="utf-8") as f:
            js_content = f.read().strip()

        prefix = "window.__ANALYSIS_DATA__ = "
        self.assertTrue(js_content.startswith(prefix))
        raw_json_str = js_content[len(prefix):].rstrip(";")
        bundle_data = json.loads(raw_json_str)

        self.assertEqual(json_data["total_records"], bundle_data["total_records"])
        self.assertEqual(len(json_data["ranked_sites"]), len(bundle_data["ranked_sites"]))
        for s1, s2 in zip(json_data["ranked_sites"], bundle_data["ranked_sites"]):
            self.assertEqual(s1["rank"], s2["rank"])
            self.assertEqual(s1["site_name"], s2["site_name"])
            self.assertEqual(s1["composite_risk_index"], s2["composite_risk_index"])


class TestServerEndpoints(unittest.TestCase):
    """Verify ephemeral HTTP server responds with correct status and content."""

    @classmethod
    def setUpClass(cls):
        # Bind to port 0 to get an ephemeral free port
        cls.httpd = socketserver.TCPServer(("127.0.0.1", 0), JalDrishtiHandler)
        cls.port = cls.httpd.server_address[1]
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def test_root_serves_index_html(self):
        url = f"http://127.0.0.1:{self.port}/"
        with urllib.request.urlopen(url) as response:
            self.assertEqual(response.status, 200)
            content = response.read().decode("utf-8")
            self.assertIn("JalDrishti", content)
            self.assertIn("PROVISIONAL OPERATIONAL SCORING", content)

    def test_api_results_endpoint(self):
        url = f"http://127.0.0.1:{self.port}/api/results"
        with urllib.request.urlopen(url) as response:
            self.assertEqual(response.status, 200)
            data = json.loads(response.read().decode("utf-8"))
            self.assertEqual(data["total_records"], 1524)
            self.assertEqual(len(data["ranked_sites"]), 7)
            self.assertEqual(data["ranked_sites"][0]["site_name"], "Bairagarh (Sant Hirdaram) kund")


if __name__ == "__main__":
    unittest.main()

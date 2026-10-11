"""Static bundle checks for the deployable JalDrishti site (web/ and its Netlify copy docs/)."""

import filecmp
import re
import unittest
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
WEB = BASE_DIR / "web"
DOCS = BASE_DIR / "docs"


def _all_files(root):
    return sorted(p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file())


class TestDocsMirrorsWeb(unittest.TestCase):
    def test_docs_is_identical_copy_of_web(self):
        self.assertEqual(_all_files(WEB), _all_files(DOCS), "web/ and docs/ must contain the same files")
        for rel in _all_files(WEB):
            self.assertTrue(filecmp.cmp(WEB / rel, DOCS / rel, shallow=False), f"{rel} differs between web/ and docs/")


class TestIndexReferences(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (WEB / "index.html").read_text(encoding="utf-8")

    def test_local_assets_exist(self):
        refs = re.findall(r'(?:src|href)="([^"#:?]+)"', self.html)
        self.assertTrue(refs)
        for ref in refs:
            self.assertTrue((WEB / ref).is_file(), f"index.html references missing file: {ref}")

    def test_css_font_urls_exist(self):
        css = (WEB / "style.css").read_text(encoding="utf-8")
        for ref in re.findall(r'url\("(assets/[^"]+)"\)', css):
            self.assertTrue((WEB / ref).is_file(), f"style.css references missing file: {ref}")

    def test_emergency_numbers_are_clickable(self):
        for number in ("112", "108", "101"):
            self.assertIn(f'href="tel:{number}"', self.html)
        self.assertIn("does not dispatch emergency services", self.html)

    def test_historical_warning_and_demo_labels_present(self):
        self.assertIn("cannot guarantee present-day water safety", self.html)
        self.assertIn("Local demo records", self.html)
        self.assertIn("not sent to BMC or any authority", self.html)

    def test_photo_attributions_present(self):
        self.assertIn("File:Upper_lake,_bhopal_02.jpg", self.html)
        self.assertIn("File:Devotee_Offering_Arghya_during_Chhath_Celebrations.jpg", self.html)
        self.assertGreaterEqual(self.html.count("creativecommons.org/licenses/by-sa/4.0/"), 2)


class TestDemoToolsKeepAnalysisSeparate(unittest.TestCase):
    def test_ghat_ops_never_writes_analysis_data(self):
        js = (WEB / "ghat-ops.js").read_text(encoding="utf-8")
        self.assertNotRegex(js, r"__ANALYSIS_DATA__\s*(=|\.\w+\s*=|\[)")
        self.assertNotIn("composite_risk_index", js)
        self.assertNotIn("fetch(", js, "Demo tools must not claim to send data anywhere")


PAGES = ["index.html", "dashboard.html", "analysis.html", "safety.html", "about.html"]


class TestMultiPageSite(unittest.TestCase):
    """Every page shares the header, footer and emergency strip, and every local link resolves."""

    @classmethod
    def setUpClass(cls):
        cls.html = {p: (WEB / p).read_text(encoding="utf-8") for p in PAGES}

    def test_all_pages_exist_in_web_and_docs(self):
        for page in PAGES:
            self.assertTrue((WEB / page).is_file(), f"web/{page} missing")
            self.assertTrue((DOCS / page).is_file(), f"docs/{page} missing")

    def test_local_links_and_assets_resolve_on_every_page(self):
        for page, html in self.html.items():
            for ref in re.findall(r'(?:src|href)="([^"#:?]+)(?:#[^"]*)?"', html):
                self.assertTrue((WEB / ref).is_file(), f"{page} references missing file: {ref}")

    def test_in_page_anchors_exist(self):
        for page, html in self.html.items():
            for target_page, anchor in re.findall(r'href="([a-z]+\.html)?#([A-Za-z][\w-]*)"', html):
                target = target_page or page
                self.assertIn(f'id="{anchor}"', self.html[target], f"{page} links to missing #{anchor} on {target}")

    def test_shared_navigation_with_single_active_page(self):
        for page, html in self.html.items():
            nav = html[html.index('<ul class="nav-links">'):html.index("</ul>", html.index('<ul class="nav-links">'))]
            for target in PAGES:
                self.assertIn(f'href="{target}"', nav, f"{page} navigation lacks a link to {target}")
            active = re.findall(r'<a href="([a-z]+\.html)" class="is-active" aria-current="page">', nav)
            self.assertEqual(active, [page], f"{page} must mark only itself as the current page")

    def test_shared_footer_and_emergency_strip_on_every_page(self):
        for page, html in self.html.items():
            self.assertIn('class="site-footer"', html, page)
            self.assertIn("does not dispatch emergency services", html, page)
            for number in ("112", "108", "101"):
                self.assertIn(f'href="tel:{number}"', html, f"{page} lacks tel:{number}")
            self.assertIn("historical MPPCB readings from 2023–2025", html, f"{page} footer lacks the historical-data note")

    def test_scripts_loaded_where_features_live(self):
        self.assertIn('src="app.js"', self.html["dashboard.html"])
        self.assertIn('src="dashboard-charts.js"', self.html["dashboard.html"])
        self.assertLess(self.html["dashboard.html"].index('src="app.js"'), self.html["dashboard.html"].index('src="dashboard-charts.js"'))
        self.assertIn('src="analysis.js"', self.html["analysis.html"])
        self.assertIn('src="ghat-ops.js"', self.html["safety.html"])
        for page, html in self.html.items():
            self.assertIn('src="site.js"', html, page)
            if 'src="app.js"' in html or 'src="analysis.js"' in html or 'src="ghat-ops.js"' in html:
                self.assertLess(html.index('src="site.js"'), html.index('src="data.js"'), f"{page}: site.js must load first")

    def test_landing_figures_match_engine_output(self):
        import json
        data = json.loads((BASE_DIR / "data_output" / "analysis_results.json").read_text(encoding="utf-8"))
        landing = self.html["index.html"]
        self.assertIn(f'{data["total_records"]:,}', landing)
        self.assertIn(f'{data["basin_compliance"]["bod"]["violation_rate_pct"]}%', landing)
        self.assertEqual(len(data["ranked_sites"]), 7)


class TestAnalysisSourceData(unittest.TestCase):
    """The analysis page groups cited readings by year; the citations must cover every valid reading."""

    def test_citations_cover_all_valid_readings(self):
        import json
        data = json.loads((BASE_DIR / "data_output" / "analysis_results.json").read_text(encoding="utf-8"))
        for site, profile in data["detailed_profiles"].items():
            for name in ("Dissolved oxygen", "BOD"):
                param = profile["parameters"][name]
                numeric = [c for c in param["citations"] if isinstance(c["value"], (int, float))]
                self.assertEqual(len(numeric), param["valid_count"], f"{site} {name}")
                self.assertEqual({c["year"] for c in numeric} - {"2023", "2024", "2025"}, set(), f"{site} {name}")


if __name__ == "__main__":
    unittest.main()

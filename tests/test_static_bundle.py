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


if __name__ == "__main__":
    unittest.main()

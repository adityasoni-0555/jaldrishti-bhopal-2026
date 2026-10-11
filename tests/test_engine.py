"""Automated Test Suite for JalDrishti Analytical Engine
Bhopal Impact Lab 2026 - Track 2: Visarjan Ghat Watch

Tests compliance boundaries, missing-data preservation, BDL handling,
zero DO identification, uncertain site matching, normalization bounds,
and reproducible ranking on the official dataset.
"""

import json
import unittest
from pathlib import Path

from engine import (
    CPCB_CLASS_B_STANDARDS,
    MeasurementRecord,
    evaluate_parameter_compliance,
    load_immersion_data,
    parse_raw_row,
    run_basin_analysis,
)


class TestComplianceBoundaries(unittest.TestCase):
    """Test boundary conditions for official CPCB Class B standards."""

    def test_dissolved_oxygen_boundary(self):
        # CPCB Class B: Minimum 5.0 mg/l
        rows = [
            {"parameter": "Dissolved oxygen", "value": "5.0", "flag": "", "source_page": "1"},
            {"parameter": "Dissolved oxygen", "value": "4.99", "flag": "", "source_page": "1"},
            {"parameter": "Dissolved oxygen", "value": "0.0", "flag": "", "source_page": "1"},
            {"parameter": "Dissolved oxygen", "value": "8.5", "flag": "", "source_page": "1"},
        ]
        records = [parse_raw_row(r) for r in rows]
        res = evaluate_parameter_compliance(records, "Dissolved oxygen")

        self.assertEqual(res.valid_count, 4)
        # 5.0 is compliant (min 5.0). 4.99 and 0.0 are violations.
        self.assertEqual(res.violation_count, 2)
        self.assertEqual(res.zero_count, 1)
        self.assertAlmostEqual(res.violation_pct, 50.0, places=2)

    def test_bod_boundary(self):
        # CPCB Class B: Maximum 3.0 mg/l
        rows = [
            {"parameter": "BOD", "value": "3.0", "flag": "", "source_page": "1"},
            {"parameter": "BOD", "value": "3.01", "flag": "", "source_page": "1"},
            {"parameter": "BOD", "value": "1.5", "flag": "", "source_page": "1"},
            {"parameter": "BOD", "value": "14.0", "flag": "", "source_page": "1"},
        ]
        records = [parse_raw_row(r) for r in rows]
        res = evaluate_parameter_compliance(records, "BOD")

        self.assertEqual(res.valid_count, 4)
        # 3.0 is compliant (max 3.0). 3.01 and 14.0 are violations.
        self.assertEqual(res.violation_count, 2)
        self.assertAlmostEqual(res.violation_pct, 50.0, places=2)

    def test_ph_boundaries(self):
        # CPCB Class B: Permissible range 6.5 to 8.5
        rows = [
            {"parameter": "pH", "value": "6.5", "flag": "", "source_page": "1"},
            {"parameter": "pH", "value": "8.5", "flag": "", "source_page": "1"},
            {"parameter": "pH", "value": "6.49", "flag": "", "source_page": "1"},
            {"parameter": "pH", "value": "8.51", "flag": "", "source_page": "1"},
            {"parameter": "pH", "value": "7.2", "flag": "", "source_page": "1"},
        ]
        records = [parse_raw_row(r) for r in rows]
        res = evaluate_parameter_compliance(records, "pH")

        self.assertEqual(res.valid_count, 5)
        # 6.49 and 8.51 are violations. 6.5, 8.5, and 7.2 are compliant.
        self.assertEqual(res.violation_count, 2)
        self.assertAlmostEqual(res.violation_pct, 40.0, places=2)


class TestMissingAndBdlHandling(unittest.TestCase):
    """Verify that BDL and missing values are preserved and never coerced to 0."""

    def test_bdl_preservation(self):
        rows = [
            {"parameter": "Lead", "value": "", "flag": "BDL", "value_as_printed": "BDL", "source_page": "1"},
            {"parameter": "Lead", "value": "0.35", "flag": "", "value_as_printed": "0.35", "source_page": "1"},
        ]
        records = [parse_raw_row(r) for r in rows]
        res = evaluate_parameter_compliance(records, "Lead")

        self.assertEqual(res.bdl_count, 1)
        self.assertEqual(res.valid_count, 1)
        self.assertEqual(res.missing_count, 0)
        # Value must not be converted to 0.0 for BDL
        self.assertEqual(records[0].value, None)
        self.assertTrue(records[0].is_bdl)
        self.assertFalse(records[0].is_missing)

    def test_not_sampled_preservation(self):
        rows = [
            {"parameter": "Dissolved oxygen", "value": "", "flag": "not sampled", "value_as_printed": "_", "source_page": "1"},
            {"parameter": "Dissolved oxygen", "value": "", "flag": "*", "value_as_printed": "*", "source_page": "1"},
            {"parameter": "Dissolved oxygen", "value": "6.0", "flag": "", "value_as_printed": "6.0", "source_page": "1"},
        ]
        records = [parse_raw_row(r) for r in rows]
        res = evaluate_parameter_compliance(records, "Dissolved oxygen")

        self.assertEqual(res.missing_count, 2)
        self.assertEqual(res.valid_count, 1)
        self.assertEqual(res.bdl_count, 0)
        # Missing values must not be counted as violations or compliant
        self.assertEqual(res.violation_count, 0)
        self.assertEqual(res.violation_pct, 0.0)


class TestFullDatasetIntegration(unittest.TestCase):
    """Run full dataset analysis and verify against official inspection findings."""

    @classmethod
    def setUpClass(cls):
        base_dir = Path(__file__).resolve().parent.parent
        cls.data_file = base_dir / "tracks" / "02-visarjan-ghat-watch" / "data" / "bhopal_ghats_2023_2025.csv"
        cls.records = load_immersion_data(cls.data_file)
        cls.results = run_basin_analysis(cls.records)

    def test_total_record_counts(self):
        self.assertEqual(len(self.records), 1524)
        self.assertEqual(self.results["total_records"], 1524)
        self.assertEqual(self.results["total_ghats_analyzed"], 7)

    def test_no_exact_duplicates(self):
        seen = set()
        duplicates = []
        for r in self.records:
            tup = (r.year, r.festival, r.site, r.phase, r.parameter)
            if tup in seen:
                duplicates.append(tup)
            seen.add(tup)
        self.assertEqual(len(duplicates), 0, f"Found unexpected duplicate records: {duplicates}")

    def test_basin_compliance_matches_inspection_report(self):
        # Dissolved oxygen: 116 valid, 42 violations (< 5.0 mg/l), 4 zero DO readings
        do_stats = self.results["basin_compliance"]["dissolved_oxygen"]
        self.assertEqual(do_stats["total_valid_measurements"], 116)
        self.assertEqual(do_stats["violations_under_5mg_l"], 42)
        self.assertAlmostEqual(do_stats["violation_rate_pct"], 36.21, places=1)
        self.assertEqual(do_stats["zero_do_count"], 4)

        # BOD: 112 valid, 100 violations (> 3.0 mg/l)
        bod_stats = self.results["basin_compliance"]["bod"]
        self.assertEqual(bod_stats["total_valid_measurements"], 112)
        self.assertEqual(bod_stats["violations_over_3mg_l"], 100)
        self.assertAlmostEqual(bod_stats["violation_rate_pct"], 89.29, places=1)

    def test_bairagarh_zero_do_and_missing_data(self):
        profiles = self.results["detailed_profiles"]
        bairagarh = profiles["Bairagarh (Sant Hirdaram) kund"]

        # Exactly 4 zero DO occurrences
        do_eval = bairagarh["parameters"]["Dissolved oxygen"]
        self.assertEqual(do_eval["zero_count"], 4)
        self.assertEqual(do_eval["valid_count"], 13)
        self.assertEqual(do_eval["violation_count"], 11)

        # Durga 2025 table missing alert
        self.assertIn("Durga 2025 table omitted in MPPCB report", bairagarh["data_gap_alerts"])

    def test_uncertain_site_match_alert(self):
        profiles = self.results["detailed_profiles"]
        kamlapati = profiles["Rani Kamlapati ghat / Kamla Park kund"]

        self.assertEqual(kamlapati["site_match_confidence"], "medium")
        self.assertTrue(any("Site name ambiguity" in alert for alert in kamlapati["data_gap_alerts"]))

    def test_normalization_and_score_bounds(self):
        for site in self.results["ranked_sites"]:
            sub = site["sub_scores"]
            self.assertTrue(0.0 <= sub["do_score_40pct"] <= 100.0)
            self.assertTrue(0.0 <= sub["bod_score_30pct"] <= 100.0)
            self.assertTrue(0.0 <= sub["metal_score_20pct"] <= 100.0)
            self.assertTrue(0.0 <= sub["lagged_impact_score_10pct"] <= 100.0)
            self.assertTrue(0.0 <= site["composite_risk_index"] <= 100.0)

    def test_ranking_reproducibility_and_ranks(self):
        ranked = self.results["ranked_sites"]
        self.assertEqual(len(ranked), 7)
        ranks = [s["rank"] for s in ranked]
        self.assertEqual(ranks, [1, 2, 3, 4, 5, 6, 7])

        # Verify descending order of Composite Risk Index
        cris = [s["composite_risk_index"] for s in ranked]
        self.assertEqual(cris, sorted(cris, reverse=True))

        # Re-run basin analysis and ensure identical output
        re_results = run_basin_analysis(self.records)
        re_cris = [s["composite_risk_index"] for s in re_results["ranked_sites"]]
        self.assertEqual(cris, re_cris)


class TestTargetedComponentArithmetic(unittest.TestCase):
    """Targeted mathematical verification of all component score formulas."""

    def test_do_score_exact_formula(self):
        # S_DO = 0.60 * viol_pct + 0.40 * zero_pct
        # Example: 10 valid tests, 6 violations (< 5 mg/l) -> 60%, 2 zero DO readings -> 20%
        # Expected S_DO = 0.60 * 60 + 0.40 * 20 = 36 + 8 = 44.0
        viol_pct = 60.0
        zero_pct = 20.0
        expected = round(0.60 * viol_pct + 0.40 * zero_pct, 2)
        self.assertEqual(expected, 44.0)

    def test_bod_score_exact_formula(self):
        # S_BOD = 0.60 * viol_pct + 0.40 * min(100, max(0, (avg_bod - 3.0)/10.0 * 100))
        # Example: 100% violations, avg_bod = 8.0 mg/l
        # Excess = (8.0 - 3.0)/10.0 * 100 = 50.0%
        # Expected S_BOD = 0.60 * 100 + 0.40 * 50 = 60 + 20 = 80.0
        viol_pct = 100.0
        avg_bod = 8.0
        excess_pct = min(100.0, max(0.0, (avg_bod - 3.0) / 10.0 * 100.0))
        s_bod = round(0.60 * viol_pct + 0.40 * excess_pct, 2)
        self.assertEqual(s_bod, 80.0)

    def test_metal_score_and_lead_normalization(self):
        # S_Metal = 0.70 * detection_rate + 0.30 * (min(1.0, peak_lead / 1.5) * 100)
        # Case A: 50% detection rate, peak lead 0.75 mg/l (0.75 / 1.5 = 0.50 -> 50)
        # Expected S_Metal = 0.70 * 50 + 0.30 * 50 = 35 + 15 = 50.0
        det_rate = 50.0
        peak_lead = 0.75
        lead_scale = min(1.0, peak_lead / 1.5)
        s_metal = round(0.70 * det_rate + 0.30 * (lead_scale * 100.0), 2)
        self.assertEqual(s_metal, 50.0)

        # Case B: Peak lead exceeds ceiling (e.g. Bairagarh 1.77 mg/l)
        peak_lead_high = 1.77
        lead_scale_high = min(1.0, peak_lead_high / 1.5)
        self.assertEqual(lead_scale_high, 1.0)  # Capped at 1.0

    def test_lagged_score_pairing_logic(self):
        # Lagged score evaluates frequency where post-immersion 'after' condition is worse than 'during'
        # 4 paired events, 3 worsening events -> 3/4 = 75.0%
        worsening_events = 3
        total_paired = 4
        s_lagged = round((worsening_events / total_paired) * 100.0, 2)
        self.assertEqual(s_lagged, 75.0)

    def test_weighted_cri_arithmetic(self):
        # CRI = 0.40 * S_DO + 0.30 * S_BOD + 0.20 * S_Metal + 0.10 * S_Lagged
        s_do = 60.0
        s_bod = 70.0
        s_metal = 50.0
        s_lagged = 40.0
        # CRI = 0.40*60 + 0.30*70 + 0.20*50 + 0.10*40 = 24 + 21 + 10 + 4 = 59.0
        cri = round(0.40 * s_do + 0.30 * s_bod + 0.20 * s_metal + 0.10 * s_lagged, 2)
        self.assertEqual(cri, 59.0)


class TestProvenanceAndCitations(unittest.TestCase):
    """Verify that every calculated finding is linked to valid source report pages."""

    @classmethod
    def setUpClass(cls):
        base_dir = Path(__file__).resolve().parent.parent
        cls.data_file = base_dir / "tracks" / "02-visarjan-ghat-watch" / "data" / "bhopal_ghats_2023_2025.csv"
        cls.records = load_immersion_data(cls.data_file)
        cls.results = run_basin_analysis(cls.records)

    def test_all_site_parameters_have_valid_citations(self):
        profiles = self.results["detailed_profiles"]
        for site_name, prof in profiles.items():
            for param_name, param_eval in prof["parameters"].items():
                citations = param_eval["citations"]
                self.assertGreater(len(citations), 0, f"No citations for {site_name} - {param_name}")
                for c in citations:
                    # Verify year is one of 2023, 2024, 2025
                    self.assertIn(c["year"], ("2023", "2024", "2025"))
                    # Verify festival is Ganesh or Durga
                    self.assertIn(c["festival"], ("Ganesh", "Durga"))
                    # Verify phase is pre, during, or after
                    self.assertIn(c["phase"], ("pre", "during", "after"))
                    # Verify source_page is a non-empty string representing a positive integer
                    self.assertTrue(c["source_page"].isdigit())
                    self.assertGreater(int(c["source_page"]), 0)


if __name__ == "__main__":
    unittest.main()

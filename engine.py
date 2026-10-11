"""JalDrishti - Analytical Engine for Bhopal Visarjan Ghat Watch (Track 2)
Bhopal Impact Lab 2026

Deterministic analytical module for evaluating water quality measurements across 7 Bhopal
immersion ghats (2023-2025) against official Central Pollution Control Board (CPCB) standards.

Regulatory Basis:
- Primary Standard: CPCB Class B (Outdoor Bathing - Organised)
  - Dissolved Oxygen (DO): >= 5.0 mg/l (min)
  - Biochemical Oxygen Demand (BOD): <= 3.0 mg/l (max)
  - pH: 6.5 - 8.5 (permissible range)
- Reference: CPCB Water Quality Criteria (cpcb_water_quality_criteria.csv)

Methodology Notice:
- Regulatory thresholds (DO >= 5, BOD <= 3, pH 6.5-8.5) are mandatory CPCB standards.
- The Composite Risk Index (CRI), component weights, and risk tiers are our transparent,
  documented methodology developed for Bhopal Municipal Corporation (BMC) operational planning.
- No site is classified as an 'ecological emergency' or declared 'safe' based solely on this
  historical dataset. Findings reflect measured historical compliance against Class B criteria.
"""

from __future__ import annotations

import csv
import json
import math
import statistics
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class SourceCitation:
    """Exact source reference linking a finding to official MPPCB reports."""
    year: str
    festival: str
    phase: str
    source_page: str
    value_as_printed: str
    flag: str

    def to_citation_string(self) -> str:
        pdf_name = f"MPPCB Visarjan Report {self.year}"
        return f"{pdf_name}, Page {self.source_page} ({self.festival} Visarjan, {self.phase}-immersion)"


@dataclass
class MeasurementRecord:
    """Typed record representing a single row from bhopal_ghats_2023_2025.csv."""
    year: str
    festival: str
    site: str
    water_body: str
    phase: str
    parameter: str
    value: Optional[float]
    unit_assumed: str
    flag: str
    value_as_printed: str
    parameter_as_printed: str
    site_as_printed: str
    site_match_confidence: str
    source_page: str

    @property
    def is_bdl(self) -> bool:
        """True if reading was below analytical detection limit."""
        return self.flag == "BDL"

    @property
    def is_missing(self) -> bool:
        """True if reading was not sampled or blank (not BDL)."""
        return self.flag in ("not sampled", "*", "**") or (self.value is None and not self.is_bdl)

    @property
    def is_valid_numeric(self) -> bool:
        """True if measurement contains a parsed numeric float."""
        return self.value is not None


@dataclass
class ParameterEvaluation:
    """Statistical and regulatory compliance summary for a single parameter at a site."""
    parameter: str
    total_records: int
    valid_count: int
    missing_count: int
    bdl_count: int
    unit: str
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    avg_value: Optional[float] = None
    median_value: Optional[float] = None
    # CPCB Criteria fields
    cpcb_class: str = "B"
    cpcb_limit_type: Optional[str] = None
    cpcb_limit_value: Optional[str] = None
    violation_count: int = 0
    violation_pct: float = 0.0
    zero_count: int = 0  # Specifically tracked for Dissolved Oxygen anoxia
    citations: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class PhaseProgression:
    """Tracks parameter trajectory across pre -> during -> after phases."""
    parameter: str
    year: str
    festival: str
    pre_value: Optional[float]
    during_value: Optional[float]
    after_value: Optional[float]
    has_lagged_worsening: bool  # True if 'after' is worse than 'during'
    citations: Dict[str, Dict[str, Any]] = field(default_factory=dict)


@dataclass
class SiteProfile:
    """Comprehensive analysis profile for a single Bhopal ghat."""
    site_name: str
    water_bodies: List[str]
    site_match_confidence: str
    total_records: int
    total_missing_records: int
    total_bdl_records: int
    missing_data_rate: float
    data_gap_alerts: List[str]
    parameters: Dict[str, ParameterEvaluation]
    phase_progressions: List[PhaseProgression]
    
    # Composite Risk Scores (Our documented methodology)
    do_score: float = 0.0
    bod_score: float = 0.0
    metal_score: float = 0.0
    lagged_impact_score: float = 0.0
    composite_risk_index: float = 0.0
    risk_rank: int = 0
    risk_tier: str = ""
    operational_justification: str = ""
    recommended_interventions: List[str] = field(default_factory=list)


# Official CPCB Class B Standards (from cpcb_water_quality_criteria.csv)
CPCB_CLASS_B_STANDARDS = {
    "Dissolved oxygen": {
        "limit_type": "min",
        "threshold": 5.0,
        "unit": "mg/l",
        "description": "Outdoor bathing standard: Minimum 5.0 mg/l required to prevent hypoxia."
    },
    "BOD": {
        "limit_type": "max",
        "threshold": 3.0,
        "unit": "mg/l",
        "description": "Outdoor bathing standard: Maximum 3.0 mg/l organic waste load."
    },
    "pH": {
        "limit_type": "range",
        "threshold_min": 6.5,
        "threshold_max": 8.5,
        "unit": "pH units",
        "description": "Outdoor bathing standard: Permissible range 6.5 to 8.5."
    }
}

HEAVY_METALS = ("Chromium", "Lead", "Zinc", "Copper")


def parse_raw_row(raw: Dict[str, str]) -> MeasurementRecord:
    """Parse raw CSV dictionary into strongly typed MeasurementRecord."""
    val_str = raw.get("value", "").strip()
    flag_str = raw.get("flag", "").strip()
    val_printed = raw.get("value_as_printed", "").strip()
    
    num_val: Optional[float] = None
    if val_str:
        try:
            num_val = float(val_str)
        except ValueError:
            num_val = None

    # Handle explicit BDL flags vs not sampled
    if flag_str == "" and val_printed == "BDL":
        flag_str = "BDL"
    elif flag_str == "" and val_printed in ("_", "-", "") and num_val is None:
        flag_str = "not sampled"

    return MeasurementRecord(
        year=raw.get("year", "").strip(),
        festival=raw.get("festival", "").strip(),
        site=raw.get("site", "").strip(),
        water_body=raw.get("water_body", "").strip(),
        phase=raw.get("phase", "").strip(),
        parameter=raw.get("parameter", "").strip(),
        value=num_val,
        unit_assumed=raw.get("unit_assumed", "").strip(),
        flag=flag_str,
        value_as_printed=val_printed,
        parameter_as_printed=raw.get("parameter_as_printed", "").strip(),
        site_as_printed=raw.get("site_as_printed", "").strip(),
        site_match_confidence=raw.get("site_match_confidence", "high").strip(),
        source_page=raw.get("source_page", "").strip()
    )


def load_immersion_data(filepath: Path | str) -> List[MeasurementRecord]:
    """Load and parse all rows from the Bhopal immersion CSV file."""
    path = Path(filepath)
    if not path.is_file():
        raise FileNotFoundError(f"Dataset file not found at: {path}")

    records: List[MeasurementRecord] = []
    with open(path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append(parse_raw_row(row))
    return records


def evaluate_parameter_compliance(records: List[MeasurementRecord], param_name: str) -> ParameterEvaluation:
    """
    Calculate statistical distribution and CPCB Class B compliance for a specific parameter.
    
    Preserves BDL and missing values; never coerces missing or BDL to numeric 0.
    """
    param_records = [r for r in records if r.parameter == param_name]
    total_records = len(param_records)
    
    valid_values: List[float] = []
    missing_count = 0
    bdl_count = 0
    zero_count = 0
    violation_count = 0
    citations: List[Dict[str, Any]] = []
    unit = ""

    cpcb_spec = CPCB_CLASS_B_STANDARDS.get(param_name)
    limit_type = cpcb_spec["limit_type"] if cpcb_spec else None
    limit_val_str = (
        f"{cpcb_spec['threshold']} {cpcb_spec['unit']}"
        if cpcb_spec and "threshold" in cpcb_spec
        else f"{cpcb_spec.get('threshold_min')}-{cpcb_spec.get('threshold_max')}"
        if cpcb_spec and "threshold_min" in cpcb_spec
        else None
    )

    for r in param_records:
        if not unit and r.unit_assumed:
            unit = r.unit_assumed
            
        citation = {
            "year": r.year,
            "festival": r.festival,
            "phase": r.phase,
            "source_page": r.source_page,
            "value_as_printed": r.value_as_printed,
            "flag": r.flag,
            "value": r.value
        }

        if r.is_bdl:
            bdl_count += 1
            citation["is_violation"] = False
            citations.append(citation)
        elif r.is_missing:
            missing_count += 1
            citation["is_violation"] = None  # Missing is not evaluated as clean or violation
            citations.append(citation)
        elif r.value is not None:
            val = r.value
            valid_values.append(val)
            is_viol = False

            if param_name == "Dissolved oxygen":
                if val == 0.0:
                    zero_count += 1
                if val < 5.0:
                    is_viol = True
            elif param_name == "BOD":
                if val > 3.0:
                    is_viol = True
            elif param_name == "pH":
                if val < 6.5 or val > 8.5:
                    is_viol = True

            if is_viol:
                violation_count += 1
            citation["is_violation"] = is_viol
            citations.append(citation)

    valid_cnt = len(valid_values)
    min_val = min(valid_values) if valid_cnt > 0 else None
    max_val = max(valid_values) if valid_cnt > 0 else None
    avg_val = round(sum(valid_values) / valid_cnt, 3) if valid_cnt > 0 else None
    med_val = round(statistics.median(valid_values), 3) if valid_cnt > 0 else None
    viol_pct = round((violation_count / valid_cnt * 100), 2) if valid_cnt > 0 else 0.0

    return ParameterEvaluation(
        parameter=param_name,
        total_records=total_records,
        valid_count=valid_cnt,
        missing_count=missing_count,
        bdl_count=bdl_count,
        unit=unit,
        min_value=min_val,
        max_value=max_val,
        avg_value=avg_val,
        median_value=med_val,
        cpcb_class="B",
        cpcb_limit_type=limit_type,
        cpcb_limit_value=limit_val_str,
        violation_count=violation_count,
        violation_pct=viol_pct,
        zero_count=zero_count,
        citations=citations
    )


def analyze_phase_progressions(records: List[MeasurementRecord]) -> List[PhaseProgression]:
    """
    Examine trajectory across pre -> during -> after phases for paired series.
    
    Verifies lagged worsening (e.g. BOD increasing post-immersion due to decay).
    Does not assume 'after' is exactly one week later without citing official notes.
    """
    series_map: Dict[Tuple[str, str, str], Dict[str, MeasurementRecord]] = {}
    for r in records:
        if r.parameter in ("Dissolved oxygen", "BOD"):
            key = (r.year, r.festival, r.parameter)
            if key not in series_map:
                series_map[key] = {}
            series_map[key][r.phase] = r

    progressions: List[PhaseProgression] = []
    for (year, festival, param), phases in sorted(series_map.items()):
        pre_rec = phases.get("pre")
        dur_rec = phases.get("during")
        aft_rec = phases.get("after")

        pre_val = pre_rec.value if pre_rec and pre_rec.value is not None else None
        dur_val = dur_rec.value if dur_rec and dur_rec.value is not None else None
        aft_val = aft_rec.value if aft_rec and aft_rec.value is not None else None

        # Check if 'after' phase shows worse condition than 'during'
        lagged = False
        if dur_val is not None and aft_val is not None:
            if param == "Dissolved oxygen" and aft_val < dur_val:
                lagged = True
            elif param == "BOD" and aft_val > dur_val:
                lagged = True

        cite_map = {}
        for ph_name, r_item in (("pre", pre_rec), ("during", dur_rec), ("after", aft_rec)):
            if r_item:
                cite_map[ph_name] = {
                    "source_page": r_item.source_page,
                    "value_as_printed": r_item.value_as_printed,
                    "flag": r_item.flag,
                    "value": r_item.value
                }

        progressions.append(PhaseProgression(
            parameter=param,
            year=year,
            festival=festival,
            pre_value=pre_val,
            during_value=dur_val,
            after_value=aft_val,
            has_lagged_worsening=lagged,
            citations=cite_map
        ))

    return progressions


def calculate_site_composite_risk(profile: SiteProfile) -> SiteProfile:
    """
    Calculate deterministic Composite Risk Index (CRI) for a ghat profile.
    
    METHODOLOGY & REGULATORY DISTINCTION:
    --------------------------------------
    1. STATUTORY STANDARDS (Official CPCB Class B - Outdoor Bathing Organised):
       - Dissolved Oxygen (DO): Minimum >= 5.0 mg/l (mandatory threshold)
       - BOD (5 days 20°C): Maximum <= 3.0 mg/l (mandatory threshold)
       - pH: Permissible range 6.5 to 8.5 (mandatory threshold)
       - Source: cpcb_water_quality_criteria.csv & CPCB Water Quality Criteria (Class B).
    
    2. PROVISIONAL OPERATIONAL SCORING METHODOLOGY (Our Documented Design Choice):
       CPCB does not publish a composite scoring formula combining these into a single integer.
       The Composite Risk Index (CRI) is our transparent, reproducible model formulated for
       Bhopal Municipal Corporation planning. All components are normalized to [0, 100]:

       Component 1: Dissolved Oxygen Depletion Score (S_DO, Weight = 40%)
         S_DO = 0.60 * (DO Violation Rate %) + 0.40 * (Zero DO Anoxia Rate %)
         - DO Violation Rate = (valid readings < 5.0 mg/l) / (total valid DO readings) * 100
         - Zero DO Rate = (readings with DO == 0.0 mg/l) / (total valid DO readings) * 100
         - Justification: DO < 5.0 violates Class B; DO = 0.0 represents complete biological anoxia.

       Component 2: Organic Pollution Score (S_BOD, Weight = 30%)
         S_BOD = 0.60 * (BOD Violation Rate %) + 0.40 * min(100.0, max(0.0, (avg_bod - 3.0) / 10.0 * 100.0))
         - BOD Violation Rate = (valid readings > 3.0 mg/l) / (total valid BOD readings) * 100
         - Excess BOD Scaling Constant (10.0 mg/l):
           At avg_bod = 3.0 mg/l, excess score is 0.
           At avg_bod = 13.0 mg/l (excess of 10.0 mg/l), excess score reaches 100.
           Justification: Observed historical site average BOD values in Bhopal range from 3.56 mg/l
           (Prempura) to 8.25 mg/l (Bairagarh). A 10.0 mg/l excess scale comfortably bounds the entire
           basin's multi-year site averages while providing linear resolution between 3.0 and 13.0 mg/l.

       Component 3: Heavy Metal Detection Score (S_Metal, Weight = 20%)
         S_Metal = 0.70 * (Metal Detection Rate %) + 0.30 * (min(1.0, peak_lead / 1.5) * 100.0)
         - Total Metal Tests Denominator = Valid Numeric Measurements + BDL Records
           (Missing / not sampled tests are strictly excluded from the denominator).
         - Metal Detection Rate = (Valid Numeric Tests > BDL) / (Total Metal Tests) * 100.
         - Peak Lead Normalization Constant (1.5 mg/l):
           Official CPCB Class B does NOT prescribe heavy metal limits.
           However, Bureau of Indian Standards IS 10500:2012 sets the Lead limit at 0.01 mg/l,
           and CPCB General Environmental Discharge Standards (Schedule VI, Inland Surface Water)
           sets the industrial discharge ceiling at 0.1 mg/l.
           Observed dataset peak Lead is 1.77 mg/l (Bairagarh) and 1.27 mg/l (Khatlapura).
           The 1.5 mg/l constant represents an empirical normalization ceiling where a concentration
           of 1.5 mg/l reflects a severe 15-fold exceedance over CPCB surface water discharge limits
           and 150-fold exceedance over drinking water baselines.

       Component 4: Lagged Post-Immersion Stagnation Score (S_Lagged, Weight = 10%)
         S_Lagged = (Lagged Worsening Events) / (Total Paired Phase Events) * 100
         - Paired Events: Series with both 'during' and 'after' measurements for (year, festival, parameter).
         - Worsening Condition: Post-immersion ('after') BOD exceeds 'during' BOD, or 'after' DO drops below 'during' DO.
         - Justification: Biological decomposition of submerged idols/offerings often peaks days after immersion.
           Note: We do not claim an exact 7-day interval because exact calendar sampling dates are not in the CSV.

       Composite Formula:
         CRI = 0.40 * S_DO + 0.30 * S_BOD + 0.20 * S_Metal + 0.10 * S_Lagged
    """
    do_eval = profile.parameters.get("Dissolved oxygen")
    bod_eval = profile.parameters.get("BOD")

    # 1. S_DO Calculation
    if do_eval and do_eval.valid_count > 0:
        viol_pct = do_eval.violation_pct
        zero_pct = (do_eval.zero_count / do_eval.valid_count) * 100.0
        s_do = round(0.60 * viol_pct + 0.40 * zero_pct, 2)
    else:
        s_do = 50.0  # Neutral prior if no valid measurements

    # 2. S_BOD Calculation
    if bod_eval and bod_eval.valid_count > 0:
        viol_pct = bod_eval.violation_pct
        avg_bod = bod_eval.avg_value or 0.0
        # Normalize severity above 3.0 mg/l (3.0 -> 0 score, 13.0 -> 100 score)
        severity_pct = min(100.0, max(0.0, (avg_bod - 3.0) / 10.0 * 100.0))
        s_bod = round(0.60 * viol_pct + 0.40 * severity_pct, 2)
    else:
        s_bod = 50.0

    # 3. S_Metal Calculation
    total_metal_tests = 0
    detected_metal_tests = 0
    peak_lead = 0.0
    for metal in HEAVY_METALS:
        m_eval = profile.parameters.get(metal)
        if m_eval:
            total_metal_tests += (m_eval.valid_count + m_eval.bdl_count)
            detected_metal_tests += m_eval.valid_count
            if metal == "Lead" and m_eval.max_value:
                peak_lead = m_eval.max_value

    if total_metal_tests > 0:
        det_rate = (detected_metal_tests / total_metal_tests) * 100.0
        # Lead >= 1.5 mg/l represents extreme accumulation ceiling (15x CPCB discharge standard)
        lead_scale = min(1.0, peak_lead / 1.5)
        s_metal = round(0.70 * det_rate + 0.30 * (lead_scale * 100.0), 2)
    else:
        s_metal = 0.0

    # 4. S_Lagged Calculation
    paired_events = [p for p in profile.phase_progressions if p.during_value is not None and p.after_value is not None]
    if paired_events:
        lagged_count = sum(1 for p in paired_events if p.has_lagged_worsening)
        s_lagged = round((lagged_count / len(paired_events)) * 100.0, 2)
    else:
        s_lagged = 50.0

    # Composite formula
    cri = round(0.40 * s_do + 0.30 * s_bod + 0.20 * s_metal + 0.10 * s_lagged, 2)

    profile.do_score = s_do
    profile.bod_score = s_bod
    profile.metal_score = s_metal
    profile.lagged_impact_score = s_lagged
    profile.composite_risk_index = cri

    # Assign objective risk tier based strictly on CRI score bands
    if cri >= 70.0:
        profile.risk_tier = "Tier 1: Critical Non-Compliance (Highest Operational Priority)"
    elif cri >= 55.0:
        profile.risk_tier = "Tier 2: High Non-Compliance"
    elif cri >= 40.0:
        profile.risk_tier = "Tier 3: Moderate Non-Compliance"
    else:
        profile.risk_tier = "Tier 4: Low Relative Non-Compliance"

    # Generate plain-language operational justification
    justifications = []
    interventions = []

    if do_eval and do_eval.zero_count > 0:
        justifications.append(f"Recorded severe anoxia (DO = 0.0 mg/l) across {do_eval.zero_count} monitoring events.")
        interventions.append("Deploy high-capacity artificial surface aeration cascades 48h before immersion.")
    elif do_eval and do_eval.violation_pct > 50.0:
        justifications.append(f"Chronic oxygen deficit: {do_eval.violation_pct}% of DO readings fail CPCB Class B (min 5 mg/l).")
        interventions.append("Install mobile oxygen diffusers and restrict organic flower offerings in main basin.")

    if bod_eval and (bod_eval.avg_value or 0) > 6.0:
        justifications.append(f"High organic decomposition load (mean BOD {bod_eval.avg_value} mg/l vs 3.0 limit).")
        interventions.append("Mandate 24/7 floating trash skimmers and rapid post-immersion dredging.")

    if peak_lead > 0.50:
        justifications.append(f"Severe heavy metal accumulation: Peak Lead reached {peak_lead} mg/l from painted idols.")
        interventions.append("Enforce diversion to lined artificial kunds; prohibit unbaked/chemical idols.")

    if profile.data_gap_alerts:
        justifications.append(f"Monitoring gaps: {'; '.join(profile.data_gap_alerts)}.")
        interventions.append("Pre-position mobile laboratory for mandatory 2026 pre-immersion testing.")

    profile.operational_justification = " ".join(justifications)
    profile.recommended_interventions = interventions

    return profile


def analyze_ghat_site(site_name: str, records: List[MeasurementRecord]) -> SiteProfile:
    """Run complete parameter and progression analysis for a single site."""
    site_records = [r for r in records if r.site == site_name]
    if not site_records:
        raise ValueError(f"No records found for site: {site_name}")

    water_bodies = sorted(list({r.water_body for r in site_records}))
    conf_set = {r.site_match_confidence for r in site_records}
    confidence = "medium" if "medium" in conf_set else "high"

    total_records = len(site_records)
    total_missing = sum(1 for r in site_records if r.is_missing)
    total_bdl = sum(1 for r in site_records if r.is_bdl)
    missing_rate = round(total_missing / total_records, 4)

    # Detect known data gap patterns
    years_present = {r.year for r in site_records}
    festivals_present = {(r.year, r.festival) for r in site_records}
    data_gap_alerts = []

    if ("2025", "Durga") not in festivals_present:
        data_gap_alerts.append("Durga 2025 table omitted in MPPCB report")
    if confidence == "medium":
        data_gap_alerts.append("Site name ambiguity: Ganesh tables list 'Kamla Park kund', Durga tables list 'Lower Lake ghat'")

    # Evaluate all 13 parameters
    distinct_params = sorted(list({r.parameter for r in site_records}))
    param_evals: Dict[str, ParameterEvaluation] = {}
    for param in distinct_params:
        param_evals[param] = evaluate_parameter_compliance(site_records, param)

    # Analyze progressions
    progressions = analyze_phase_progressions(site_records)

    profile = SiteProfile(
        site_name=site_name,
        water_bodies=water_bodies,
        site_match_confidence=confidence,
        total_records=total_records,
        total_missing_records=total_missing,
        total_bdl_records=total_bdl,
        missing_data_rate=missing_rate,
        data_gap_alerts=data_gap_alerts,
        parameters=param_evals,
        phase_progressions=progressions
    )

    return calculate_site_composite_risk(profile)


def run_basin_analysis(records: List[MeasurementRecord]) -> Dict[str, Any]:
    """
    Run complete deterministic analysis across all Bhopal ghats,
    rank sites by Composite Risk Index, and package results.
    """
    sites = sorted(list({r.site for r in records}))
    site_profiles: List[SiteProfile] = []

    for s in sites:
        prof = analyze_ghat_site(s, records)
        site_profiles.append(prof)

    # Sort deterministically by Composite Risk Index descending (tie-break by DO score, then BOD score)
    site_profiles.sort(key=lambda x: (x.composite_risk_index, x.do_score, x.bod_score), reverse=True)

    # Assign risk ranks (1 to 7)
    for rank_idx, prof in enumerate(site_profiles, start=1):
        prof.risk_rank = rank_idx

    # Overall basin metrics
    total_records = len(records)
    do_all = [r.value for r in records if r.parameter == "Dissolved oxygen" and r.value is not None]
    bod_all = [r.value for r in records if r.parameter == "BOD" and r.value is not None]
    ph_all = [r.value for r in records if r.parameter == "pH" and r.value is not None]

    do_under_5 = sum(1 for v in do_all if v < 5.0)
    bod_over_3 = sum(1 for v in bod_all if v > 3.0)
    ph_viol = sum(1 for v in ph_all if v < 6.5 or v > 8.5)

    basin_summary = {
        "dataset": "bhopal_ghats_2023_2025.csv",
        "total_records": total_records,
        "total_ghats_analyzed": len(site_profiles),
        "monitoring_years": sorted(list({r.year for r in records})),
        "standards_used": "CPCB Water Quality Criteria Class B (Outdoor Bathing Organised)",
        "methodology_status": "PROVISIONAL OPERATIONAL SCORING METHODOLOGY UNDER REVIEW",
        "regulatory_distinction": "CPCB Class B defines statutory limits for DO (>=5), BOD (<=3), and pH (6.5-8.5). Composite Risk Index (CRI), sub-score weights, and scaling constants (Lead 1.5 mg/l, BOD excess 10.0 mg/l) are proposed operational planning choices.",
        "basin_compliance": {
            "dissolved_oxygen": {
                "total_valid_measurements": len(do_all),
                "violations_under_5mg_l": do_under_5,
                "violation_rate_pct": round(do_under_5 / len(do_all) * 100.0, 2) if do_all else 0.0,
                "zero_do_count": sum(1 for v in do_all if v == 0.0)
            },
            "bod": {
                "total_valid_measurements": len(bod_all),
                "violations_over_3mg_l": bod_over_3,
                "violation_rate_pct": round(bod_over_3 / len(bod_all) * 100.0, 2) if bod_all else 0.0,
                "mean_bod_mg_l": round(sum(bod_all) / len(bod_all), 2) if bod_all else 0.0
            },
            "ph": {
                "total_valid_measurements": len(ph_all),
                "violations_outside_range": ph_viol,
                "violation_rate_pct": round(ph_viol / len(ph_all) * 100.0, 2) if ph_all else 0.0
            }
        },
        "ranked_sites": [
            {
                "rank": prof.risk_rank,
                "site_name": prof.site_name,
                "water_bodies": prof.water_bodies,
                "confidence": prof.site_match_confidence,
                "composite_risk_index": prof.composite_risk_index,
                "risk_tier": prof.risk_tier,
                "sub_scores": {
                    "do_score_40pct": prof.do_score,
                    "bod_score_30pct": prof.bod_score,
                    "metal_score_20pct": prof.metal_score,
                    "lagged_impact_score_10pct": prof.lagged_impact_score
                },
                "data_gap_alerts": prof.data_gap_alerts,
                "operational_justification": prof.operational_justification,
                "recommended_interventions": prof.recommended_interventions
            }
            for prof in site_profiles
        ],
        "detailed_profiles": {prof.site_name: asdict(prof) for prof in site_profiles}
    }

    return basin_summary


def export_analysis_json(output_path: Path | str, analysis_data: Dict[str, Any]) -> None:
    """Save machine-readable analysis results in a documented JSON format and web bundle."""
    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, mode="w", encoding="utf-8") as f:
        json.dump(analysis_data, f, indent=2, ensure_ascii=False)

    # Also export web/data.js for standalone static deployment
    web_data_file = out_file.parent.parent / "web" / "data.js"
    web_data_file.parent.mkdir(parents=True, exist_ok=True)
    with open(web_data_file, mode="w", encoding="utf-8") as f:
        f.write("window.__ANALYSIS_DATA__ = ")
        json.dump(analysis_data, f, indent=2, ensure_ascii=False)
        f.write(";\n")


if __name__ == "__main__":
    import sys
    base_dir = Path(__file__).resolve().parent
    data_file = base_dir / "tracks" / "02-visarjan-ghat-watch" / "data" / "bhopal_ghats_2023_2025.csv"
    out_json = base_dir / "data_output" / "analysis_results.json"

    print(f"Loading data from: {data_file}")
    records = load_immersion_data(data_file)
    print(f"Loaded {len(records)} records.")

    print("Running deterministic basin analysis...")
    results = run_basin_analysis(records)
    print("Analysis complete.")

    export_analysis_json(out_json, results)
    print(f"Exported machine-readable results to: {out_json} and web/data.js")

    print("\n=== DETERMINISTIC RANKING SUMMARY ===")
    for s in results["ranked_sites"]:
        print(f"Rank {s['rank']}: {s['site_name']} | CRI: {s['composite_risk_index']} | {s['risk_tier']}")
        print(f"  Alerts: {s['data_gap_alerts']}")
        print(f"  Justification: {s['operational_justification'][:110]}...")

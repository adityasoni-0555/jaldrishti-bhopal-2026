# JalDrishti: Visarjan Ghat Watch (जलदृष्टि)

**Track:** 2 Visarjan Ghat Watch  
**Event:** Claude Impact Lab × Cerebras Café Compute, Bhopal (11 October 2026)  
**Team:** Solo Participant (Aditya Soni)  
**Public Deployment URL:** [https://laaaaksh.github.io/bhopal-impact-lab-2026/](https://laaaaksh.github.io/bhopal-impact-lab-2026/)  
**License:** MIT License (open source for Government of Madhya Pradesh / MPSeDC / BMC)  

---

## The user
The Bhopal Municipal Corporation (BMC) planning officer responsible for allocating cleaning crews, emergency surface aeration, trash skimmers, and water monitoring across Bhopal's idol immersion ghats prior to Durga Visarjan on 20 October 2026.

---

## What it does
1. Ingests and audits 1,524 water test readings (2023–2025) across Bhopal's 7 idol immersion ghats, evaluating compliance against official Central Pollution Control Board (CPCB) Class B outdoor bathing standards.
2. Computes an evidence-backed, deterministic Composite Risk Index (CRI) spanning Dissolved Oxygen depletion, organic waste load (BOD), toxic paint markers (Lead, Chromium, Copper, Zinc), and post-immersion lagged decay.
3. Provides an interactive decision dashboard with exact PDF page citations, explicit data-gap alerts, and a 1-click bilingual (English & Hindi) administrative brief ready for municipal leadership.

---

## Demo
- **Live Application URL:** [https://laaaaksh.github.io/bhopal-impact-lab-2026/](https://laaaaksh.github.io/bhopal-impact-lab-2026/)
- **Demo Screen Recording (2 min):** `[DEMO VIDEO LINK]` *(Recorded before 16:00 submission deadline)*

---

## How to run
1. **Clone the repository:**
   ```bash
   git clone https://github.com/Laaaaksh/bhopal-impact-lab-2026.git
   cd bhopal-impact-lab-2026
   ```
2. **Run the analytical engine (regenerates machine-readable output):**
   ```bash
   python engine.py
   ```
3. **Execute the automated test suite (22 unit & integration tests):**
   ```bash
   python -m unittest discover tests
   ```
4. **Launch the local web dashboard:**
   ```bash
   python server.py 8080
   ```
   *(Or open `web/index.html` directly in any modern web browser — zero external dependencies required).*

---

## System Architecture

```
bhopal-impact-lab-2026/
├── engine.py                  # Core deterministic analytical engine (CPCB compliance & CRI)
├── server.py                  # Zero-dependency local web server (Python http.server)
├── index.html                 # Universal redirector for static hosting
├── LICENSE                    # Official MIT License
├── README.md                  # Project documentation & runbook
├── data_output/
│   └── analysis_results.json  # Machine-readable analytical output & provenance index
├── web/                       # Responsive BMC Decision Support Interface
│   ├── index.html             # Dashboard UI shell & evidence inspection drawers
│   ├── style.css              # Custom responsive stylesheet & visual metric meters
│   ├── app.js                 # Filter, sort, modal & bilingual brief export controller
│   └── data.js                # Embedded standalone dataset bundle (instant 0ms loading)
├── docs/                      # Mirror bundle for GitHub Pages hosting (/docs root)
├── tests/
│   ├── test_engine.py         # 18 unit tests (boundaries, BDL, zero DO, arithmetic, citations)
│   └── test_server_api.py     # 4 smoke tests (endpoints, asset sync, JSON verification)
└── tracks/02-visarjan-ghat-watch/
    ├── PROBLEM.md             # Official Track 2 Problem Statement
    └── data/
        ├── bhopal_ghats_2023_2025.csv    # 1,524 primary readings across 7 Bhopal ghats
        └── cpcb_water_quality_criteria.csv # Official statutory water quality thresholds
```

---

## Methodology & Regulatory Standards

### 1. Statutory Standards (Official CPCB Class B)
Sourced directly from `tracks/02-visarjan-ghat-watch/data/cpcb_water_quality_criteria.csv`:
- **Dissolved Oxygen (DO):** Minimum $\ge 5.0\text{ mg/l}$. Values $< 5.0\text{ mg/l}$ induce aquatic hypoxia. Values at $0.0\text{ mg/l}$ represent total biological anoxia.
- **Biochemical Oxygen Demand (BOD):** Maximum $\le 3.0\text{ mg/l}$ ($20^\circ\text{C}$, 5 days). Indicates organic waste loading.
- **pH:** Permissible range $6.5 - 8.5$.

### 2. Provisional Operational Composite Risk Index (CRI)
$$\text{CRI} = (0.40 \cdot S_{\text{DO}}) + (0.30 \cdot S_{\text{BOD}}) + (0.20 \cdot S_{\text{Metal}}) + (0.10 \cdot S_{\text{Lagged}})$$
- **$S_{\text{DO}}$ (40% Weight):** $0.60 \times (\text{DO Violation Rate \%}) + 0.40 \times (\text{Zero DO Anoxia Rate \%})$.
- **$S_{\text{BOD}}$ (30% Weight):** $0.60 \times (\text{BOD Violation Rate \%}) + 0.40 \times \min\left(100, \max\left(0, \frac{\text{Mean BOD} - 3.0}{10.0} \times 100\right)\right)$.
- **$S_{\text{Metal}}$ (20% Weight):** $0.70 \times (\text{Detection Rate \%}) + 0.30 \times \left(\min\left(1.0, \frac{\text{Peak Lead}}{1.5}\right) \times 100\right)$.
  - *Lead Ceiling Benchmark:* $1.5\text{ mg/l}$ reflects an empirical operational ceiling representing a 15-fold exceedance of CPCB Schedule VI surface discharge standards ($0.1\text{ mg/l}$) and 150-fold exceedance of IS 10500 drinking limits ($0.01\text{ mg/l}$).
- **$S_{\text{Lagged}}$ (10% Weight):** Percentage of paired events where post-immersion (`after`) BOD worsened or DO dropped due to delayed biological breakdown of submerged offerings.

---

## Verified Site Rankings (2023–2025 Historical Baseline)

| Rank | Site Name | Water Body | DO Min/Avg (mg/l) | BOD Avg/Max (mg/l) | Peak Lead (mg/l) | Provisional CRI | Objective Compliance Tier | Recommended Municipal Intervention |
|:---:|---|---|:---:|:---:|:---:|:---:|---|---|
| **1** | **Bairagarh (Sant Hirdaram) kund** | Upper Lake | 0.00 / 2.82 | 8.25 / 14.00 | **1.770** | **69.58** | **Tier 2: High Non-Compliance** | Pre-deploy artificial surface aeration cascades 48h prior; divert large chemical idols. |
| **2** | **Malikhedi kund** | Kund | 0.60 / 5.02 | 6.54 / 16.80 | 0.292 | **51.05** | **Tier 3: Moderate Non-Compliance** | Install mobile oxygen diffusers; restrict organic waste dump into stagnant pool. |
| **3** | **Khatlapura ghat** | Lower Lake | 4.00 / 5.64 | 6.01 / 11.20 | 1.266 | **46.39** | **Tier 3: Moderate Non-Compliance** | Pre-position sludge dredging booms; enforce synthetic paint prohibition. |
| **4** | **Shahpura lake ghat** | Shahpura Lake | 2.50 / 5.46 | 8.06 / 11.60 | 0.413 | **46.33** | **Tier 3: Moderate Non-Compliance** | Deploy 24/7 floating trash skimmers to remove floral offerings post-immersion. |
| **5** | **Rani Kamlapati / Kamla Park** | Lower Lake | 2.40 / 5.62 | 6.28 / 9.20 | 0.395 | **45.66** | **Tier 3: Moderate Non-Compliance** | Enforce immersion exclusively in artificial kund rather than open lake. |
| **6** | **Hathaikheda dam / kund** | Hathaikheda | 5.10 / 7.62 | 7.49 / 22.00 | 0.537 | **38.51** | **Tier 4: Low Relative Non-Compliance** | Aeration well-maintained; plan rapid post-immersion cleanup to mitigate 22.0 mg/l BOD surges. |
| **7** | **Prempura ghat** | Upper Lake | 3.90 / 6.08 | 3.56 / 6.80 | 0.347 | **28.92** | **Tier 4: Low Relative Non-Compliance** | Baseline cleanest site; maintain existing perimeter barriers. |

---

## What works, what does not

### Works:
- **Reproducible Analytical Engine:** Zero external dependencies; 100% standard Python.
- **Strict Data Preservation:** 174 BDL entries are preserved as trace detection (never coerced to zero); missing rows are distinguished from clean readings.
- **Evidence Provenance:** Every metric links directly to report year, festival, phase, and exact PDF page number (e.g., `MPPCB Report 2024, Page 25`).
- **Interactive UI Decision Support:** Real-time search, lake filter, risk tier filter, sorting, and chemistry modal.
- **Bilingual Administrative Brief:** Instant copy to clipboard, `.txt` download, and print support in both Hindi and English.
- **Automated Test Coverage:** 22 passing unit, arithmetic, provenance, and smoke tests.

### Does not work yet / Data Limitations:
- **Missing Durga 2025 Tables:** MPPCB omitted Durga 2025 tables for Bairagarh and Malikhedi. The dashboard surfaces these as explicit alerts; real-time pre-immersion testing on 19–20 October 2026 is required.
- **Unmonitored Parameters:** MPPCB reports print no bacteriological parameters (Total Coliform) and only 4 heavy metals. Unmonitored toxins (Cadmium, Arsenic) cannot be reported.
- **Rani Kamlapati Dual Identity:** Ganesh tables sampled *Kamla Park kund* (artificial enclosure), whereas Durga tables sampled *Lower Lake ghat* (open water). Flagged as medium confidence.

---

## Data used
- **Repository Data:** 
  - `tracks/02-visarjan-ghat-watch/data/bhopal_ghats_2023_2025.csv` (1,524 rows)
  - `tracks/02-visarjan-ghat-watch/data/cpcb_water_quality_criteria.csv` (19 rows)
- **Extra Data:** None.

---

## Testing & Verification

To execute the test suite:
```powershell
py -m unittest discover -s tests -p "test_*.py" -v
```

**Results:**
```text
Ran 22 tests in 1.250s
OK (All 22 unit, integration, boundary, and smoke tests passed)
```

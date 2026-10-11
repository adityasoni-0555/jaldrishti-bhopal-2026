# JalDrishti (जलदृष्टि): Visarjan Ghat Watch

Evidence-based water-quality risk support for Bhopal's idol-immersion ghats, built from the official MPPCB monitoring reports for 2023–2025.

| | |
|---|---|
| **Event** | Claude Impact Lab Bhopal 2026 (11 October 2026) |
| **Track** | 2 · Visarjan Ghat Watch |
| **Team** | Solo participant: Aditya Soni |
| **Live demo** | https://jaldrishti-bhopal-2026.netlify.app |
| **Repository** | https://github.com/adityasoni-0555/jaldrishti-bhopal-2026 |
| **License** | MIT (see [`LICENSE`](LICENSE)) |

> **Historical data only.** Every water-quality figure in JalDrishti comes from MPPCB readings taken in 2023–2025. It cannot establish whether the water is safe today. Real-time pre-immersion testing is still required.

---

## The user

A Bhopal Municipal Corporation (BMC) planning officer deciding where to send aeration equipment, trash skimmers, cleaning crews and sampling teams across Bhopal's immersion ghats before Durga Visarjan on 20 October 2026.

## The problem

Every Ganesh and Durga festival, the MP Pollution Control Board (MPPCB) tests the water at Bhopal's immersion ghats before, during and after immersion. The results are spread across reports of 87 to 118 pages. Nobody lines them up against the legal limits or compares sites and years, so officers cannot easily see which ghats need resources first. The full brief is in [`tracks/02-visarjan-ghat-watch/PROBLEM.md`](tracks/02-visarjan-ghat-watch/PROBLEM.md).

## The solution

1. **A deterministic analytical engine** ([`engine.py`](engine.py)) reads the 1,524 cleaned readings for 7 Bhopal ghats and checks them against CPCB Class B (outdoor bathing) limits. It keeps "below detection limit" values separate from missing data, and ranks the ghats with a provisional Composite Risk Index (CRI).
2. **A five-page static website** ([`web/`](web/), mirrored in [`docs/`](docs/) for deployment) shows the ranking, the evidence behind every number with PDF page citations, detailed comparisons, and a bilingual English/Hindi brief for municipal leadership.
3. **Ghat-side safety tools** for Chhath Puja and immersion days: a readiness checklist, extra ghats, an incident log and verified emergency numbers. Records stay in the user's own browser and are clearly labelled as local demo data.

---

## Implemented features

### Analytical engine (`engine.py`, Python standard library only)
- CPCB Class B compliance checks: DO ≥ 5.0 mg/l, BOD ≤ 3.0 mg/l, pH 6.5–8.5.
- `BDL` (below detection limit) readings are kept as trace detections, never turned into zero. `not sampled` readings are left out of compliance counts and reported as data gaps.
- Provisional CRI from four sub-scores: oxygen deficit, organic load, metal hazard and lagged post-immersion impact.
- Pre → during → after comparisons that flag "lagged worsening" after immersion.
- A source citation (report year, festival, phase, PDF page) for every parameter.
- Data-gap and site-confidence alerts, for example the missing Durga 2025 tables and the Rani Kamlapati / Kamla Park naming ambiguity.
- Writes [`data_output/analysis_results.json`](data_output/analysis_results.json) and the embedded bundle `web/data.js`.

### Website pages

| Page | Contents | Scripts |
|---|---|---|
| `index.html` (Home, entry point) | Hero, project purpose, key benefits, data coverage, historical-vs-current explanation, limitations, links to every page | `site.js` |
| `dashboard.html` | The analysis dashboard described below: metrics, CRI chart, search, filters, sorting, ghat cards, evidence and methodology dialogs, bilingual brief, print report | `site.js`, `data.js`, `app.js` |
| `analysis.html` | Basin compliance, ghat comparison table, year-by-year mean DO and BOD (2023–2025, with reading counts), post-immersion impact, CRI method, data sources, limitations | `site.js`, `data.js`, `analysis.js` |
| `safety.html` | Emergency numbers, general precautions (not an official advisory), public contacts, Chhath readiness tools | `site.js`, `data.js`, `ghat-ops.js` |
| `about.html` | Mission, system overview, methodology summary, project details and GitHub link | `site.js` |

Every page shares the same header with an active-page marker, a mobile menu, an emergency strip (112 / 108 / 101) and a footer with the historical-data note, GitHub link and image credits. The year-by-year tables are computed in the browser from the engine's cited readings; they do not re-score anything.

### Dashboard (`web/dashboard.html`, `web/app.js`, `web/style.css`)
- **Basin overview metrics:** records analysed, DO and BOD non-compliance, heavy-metal tests.
- **CRI chart:** a stacked bar for each ghat showing its four weighted components, with a hover/focus tooltip and a table view.
- **Search:** by ghat name in English or Hindi, water body, or words in the justification text, with a clear button.
- **Filters and sorting:** filter by water body and risk tier. Sort by CRI, measured DO non-compliance %, mean BOD, peak lead, or name. Reset clears everything.
- **Seven ghat cards:** measured values, sub-score meters, data-gap alerts, recommended interventions, and an evidence button.
- **Evidence dialog:** all 13 measured parameters with min/max/mean, CPCB limit, violation counts and a sample PDF citation, plus the pre/during/after table with citations.
- **Methodology dialog:** separates the statutory CPCB limits from the provisional CRI choices.
- **Bilingual administrative brief:** English and हिंदी tabs, marked as a draft for official review. Can be copied to the clipboard or downloaded as `.txt`.
- **Print report:** a print layout with the warning, metrics, both brief languages, the chart and all seven cards.
- **Public contacts with sources** (on `safety.html`): emergency numbers 112, 108 and 101, plus BMC, the MPPCB Bhopal Regional Office and CM Helpline 181. All are clickable `tel:` links.
- **Accessibility and robustness:** responsive layout, keyboard-accessible dialogs, respect for reduced-motion settings, image fallbacks, and a self-hosted Source Sans 3 font.

### Chhath Puja ghat readiness (`web/safety.html`, `web/ghat-ops.js`, local demo records)
- **Readiness checklist:** 8 items per ghat, each Pending, In progress or Verified. Items: lighting, barriers, slippery steps, water-depth warnings, crowd management, first aid, sanitation, waste clearance.
- **Add a ghat:** validated form with edit and delete. It rejects duplicates, including alternative and Hindi names of the 7 historical ghats. Added ghats get **no water-quality score and no rank**.
- **Incident log:** validated form (type, time not in the future, description, optional Indian mobile number). It is **not sent to any authority**.
- **Resource directory:** volunteers, workers, first-aid points, divers and rescue teams. It shows an honest empty state, because no verified roster has been published.
- All of this is stored only in the browser's `localStorage`, labelled "Local demo", and kept separate from the historical dataset.

### Local server (`server.py`)
- Serves `web/` as the site root (Home at `/`, every page and asset by relative path) and the analysis JSON at `/api/results`, using only the Python standard library.

---

## Verified site ranking (2023–2025 historical baseline)

Values are taken from `data_output/analysis_results.json`.

| Rank | Ghat | Water body | DO min / mean (mg/l) | BOD mean / max (mg/l) | Peak lead (mg/l) | Provisional CRI | Tier |
|:---:|---|---|:---:|:---:|:---:|:---:|---|
| 1 | Bairagarh (Sant Hirdaram) kund | Upper Lake | 0.0 / 2.82 | 8.25 / 14.0 | 1.77 | **69.58** | Tier 2: High Non-Compliance |
| 2 | Malikhedi kund | Kund | 0.6 / 5.02 | 6.54 / 16.8 | 0.292 | **51.05** | Tier 3: Moderate Non-Compliance |
| 3 | Khatlapura ghat | Lower Lake | 4.0 / 5.64 | 6.01 / 11.2 | 1.266 | **46.39** | Tier 3: Moderate Non-Compliance |
| 4 | Shahpura lake ghat | Shahpura Lake | 2.5 / 5.46 | 8.06 / 11.6 | 0.413 | **46.33** | Tier 3: Moderate Non-Compliance |
| 5 | Rani Kamlapati ghat / Kamla Park kund | Lower Lake (as printed in Durga tables) | 2.4 / 5.62 | 6.28 / 9.2 | 0.395 | **45.66** | Tier 3: Moderate Non-Compliance (medium site-match confidence) |
| 6 | Hathaikheda dam / kund | Hathaikheda dam | 5.1 / 7.62 | 7.49 / 22.0 | 0.537 | **38.51** | Tier 4: Low Relative Non-Compliance |
| 7 | Prempura ghat | Upper Lake | 3.9 / 6.08 | 3.56 / 6.8 | 0.347 | **28.92** | Tier 4: Low Relative Non-Compliance |

**Basin totals:**
- DO below 5.0 mg/l in **42 of 116** tests (36.21%), including 4 readings of zero.
- BOD above 3.0 mg/l in **100 of 112** tests (89.29%). Mean BOD is 6.61 mg/l.
- pH outside 6.5–8.5 in **6 of 115** tests (5.22%).

---

## Technology stack

| Layer | Technology |
|---|---|
| Analysis | Python 3 standard library (`csv`, `json`, `statistics`, `math`, `dataclasses`), with no third-party packages |
| Tests | Python `unittest` |
| Local server | Python `http.server` / `socketserver` |
| Front end | Plain HTML, CSS and JavaScript, with no framework, build step or external API |
| Font | Source Sans 3, self-hosted under the SIL Open Font License (`web/assets/fonts/OFL-SourceSans3.txt`) |
| Hosting | Netlify static hosting, publishing the `docs/` folder |

---

## Repository structure

```text
bhopal-impact-lab-2026/
├── engine.py                    # Analytical engine: CPCB compliance, CRI, ranking, citations
├── server.py                    # Local server: serves web/ at "/", JSON at "/api/results"
├── index.html                   # Root redirect to web/index.html (for hosts that publish the repo root)
├── data_output/
│   └── analysis_results.json    # Engine output (rankings, profiles, citations)
├── web/                         # Website source (five pages)
│   ├── index.html               # Home / landing page (entry point)
│   ├── dashboard.html           # Ranking, indicators, search, filters, chart, evidence, brief, print
│   ├── analysis.html            # Comparisons, year-by-year readings, CRI method, sources, limitations
│   ├── safety.html              # Emergency numbers, precautions, contacts, Chhath readiness tools
│   ├── about.html               # Mission, system overview, project details
│   ├── style.css                # Shared stylesheet
│   ├── site.js                  # Shared: navigation menu, reveal animation, Hindi ghat names
│   ├── app.js                   # Dashboard controller
│   ├── analysis.js              # Analysis-page tables (grouping of cited readings)
│   ├── ghat-ops.js              # Chhath readiness tools (local demo records only)
│   ├── data.js                  # Embedded copy of analysis_results.json (generated by engine.py)
│   └── assets/                  # Photographs and self-hosted font files
├── docs/                        # Identical copy of web/, published to Netlify
├── tests/
│   ├── test_engine.py           # 18 tests: boundaries, BDL, missing data, CRI arithmetic, citations
│   ├── test_server_api.py       # 4 tests: assets, data.js sync, "/" and "/api/results"
│   └── test_static_bundle.py    # 15 tests: docs/ mirrors web/, every page's links and assets, shared nav/footer, labels
├── tools/                       # Scripts used to extract the CSVs from the MPPCB PDFs (see tools/README.md)
├── tracks/
│   ├── 01-bhumi-vikas-sahayak/  # Track 1 materials from the organisers (not used by this project)
│   └── 02-visarjan-ghat-watch/
│       ├── PROBLEM.md
│       ├── data/                # Cleaned CSVs and DATA_DICTIONARY.md
│       └── resources/           # Original MPPCB / CPCB PDF reports
├── JUDGING.md, SUBMISSION.md    # Organiser guidance
└── LICENSE                      # MIT
```

---

## Setup and run on Windows

**Requirements:** Python 3 and Git. No `pip install` is needed. Tested with Python 3.14 using the `py` launcher.

1. **Clone the repository**
   ```powershell
   git clone https://github.com/adityasoni-0555/jaldrishti-bhopal-2026.git
   cd jaldrishti-bhopal-2026
   ```
2. **(Optional) Regenerate the analysis.** This rewrites `data_output/analysis_results.json` and `web/data.js`.
   ```powershell
   py engine.py
   ```
3. **Start the local dashboard**
   ```powershell
   py server.py 8080
   ```
   Open http://localhost:8080/ (Home) and use the navigation to reach the Dashboard, Analysis, Safety and About pages. The raw results are at http://localhost:8080/api/results.
   You can also open `web\index.html` directly in a browser, because the data is embedded in `web/data.js` and all links are relative.
4. **If you regenerated the analysis or edited `web/`, copy the changes into `docs/`.** The deployed site and `tests/test_static_bundle.py` both expect the two folders to match.
   ```powershell
   Copy-Item -Path web\* -Destination docs -Recurse -Force
   ```

## Running the tests

```powershell
py -m unittest discover -s tests -p "test_*.py" -v
```

Current result: **37 tests, all passing** (18 engine, 4 server/API, 15 static bundle).

---

## Live demo and deployment

- **Live demo:** https://jaldrishti-bhopal-2026.netlify.app
- **Deploy command**, run from the repository root and publishing the `docs/` folder:
  ```powershell
  npx.cmd netlify deploy --dir=docs --prod
  ```
  This needs Node.js and a Netlify account that has access to the site. If you're setting up on a new machine, run `npx.cmd netlify login` and `npx.cmd netlify link` first.
- **Screenshots and demo recording:** neither is committed to this repository. The live demo is the reference.

---

## Data sources

**Data used by the engine:**
- `tracks/02-visarjan-ghat-watch/data/bhopal_ghats_2023_2025.csv`: 1,524 readings for 7 Bhopal ghats, with a source page for every row.
- `tracks/02-visarjan-ghat-watch/data/cpcb_water_quality_criteria.csv`: the CPCB water-quality criteria.

**Original reports.** Copies are in `tracks/02-visarjan-ghat-watch/resources/`, and the column meanings and site mappings are in `data/DATA_DICTIONARY.md`.
- MPPCB Ganesh and Durga Visarjan Report 2025: https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2025.pdf
- MPPCB Ganesh and Durga Visarjan Report 2024: https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2024.pdf
- MPPCB Idol Immersion Report 2023 (CPCB format): https://www.mppcb.mp.gov.in/proc/mon/Idol_immer._Report_23_CPCB.pdf
- CPCB water quality criteria: https://cpcb.gov.in/water-quality-criteria/

**Public contact sources shown in the dashboard:**
- Dial 112, Madhya Pradesh Police: https://dial112.mppolice.gov.in/
- Ambulance 108, Fire 101 and CM Helpline 181, District Bhopal: https://bhopal.nic.in/en/helpline/
- Bhopal Municipal Corporation: https://bhopal.nic.in/en/public-utility/bhopal-municipal-corporation/
- MPPCB office list, for the Regional Office Bhopal: https://www.mppcb.mp.gov.in/pdf/PCBADDTEL14.pdf

**Photographs**, both from Wikimedia Commons under CC BY-SA 4.0 and used for illustration only:
- [Upper lake, bhopal 02](https://commons.wikimedia.org/wiki/File:Upper_lake,_bhopal_02.jpg) by Darkknight7213.
- [Devotee Offering Arghya during Chhath Celebrations](https://commons.wikimedia.org/wiki/File:Devotee_Offering_Arghya_during_Chhath_Celebrations.jpg) by Goutam1962. This was taken at Yamuna Ghat, Delhi, not in Bhopal.

**Extra data:** none beyond the files above.

---

## Provisional methodology

**Statutory limits (official, CPCB Class B, outdoor bathing):**
- DO ≥ 5.0 mg/l
- BOD ≤ 3.0 mg/l
- pH 6.5–8.5

**Composite Risk Index:** a planning aid designed for this project. CPCB does not publish a composite index. The weights and ceilings are provisional and under review.

```text
CRI     = 0.40 × S_DO + 0.30 × S_BOD + 0.20 × S_Metal + 0.10 × S_Lagged

S_DO     = 0.60 × DO violation rate % + 0.40 × zero-DO rate %
S_BOD    = 0.60 × BOD violation rate % + 0.40 × min(100, max(0, (mean BOD − 3.0) / 10.0 × 100))
S_Metal  = 0.70 × metal detection rate % + 0.30 × min(1.0, peak lead / 1.5) × 100
S_Lagged = % of paired festival events where "after" readings worsened vs "during"
```

Each sub-score formula and the weighted CRI arithmetic are covered by `tests/test_engine.py`. The dashboard's Methodology dialog shows the same definitions.

## Limitations

- **Historical, not live.** The data covers 2023–2025. JalDrishti does no real-time monitoring and cannot say whether water is safe on any given day.
- **Missing records:**
  - The MPPCB 2025 report has no Durga tables for Bairagarh or Malikhedi. The dashboard flags this, and missing data is never treated as clean.
  - The reports have no bacteriological parameters and only four heavy metals (Pb, Cr, Cu, Zn). Nothing else is estimated.
- **Site ambiguity.** For Rani Kamlapati / Kamla Park, the Ganesh tables sampled an artificial kund and the Durga tables sampled open lake water. This site is marked medium confidence.
- **The CRI is provisional.** Its weights and scaling constants are planning choices, not regulatory standards.
- **The readiness tools are local demo records.** Checklists, added ghats and incidents stay in one browser. There is no backend, no sharing and no verification, and nothing is sent to BMC or any authority.
- **The resource directory is empty** until BMC or the district administration publishes verified rosters.
- **Not official.** JalDrishti is an independent prototype. It is not a publication of, or endorsed by, BMC, MPPCB, CPCB or the Government of Madhya Pradesh. The bilingual brief is a draft for official review, not an issued order.
- **Contact details may change.** The MPPCB office list is an older PDF, and its numbers are reproduced exactly as published.

## Emergency disclaimer

**JalDrishti does not dispatch emergency services**, track ambulances or confirm that rescue teams are available. In an emergency, call the public services directly:

| Number | Service |
|---|---|
| **112** | Emergency response (MP Police Dial 112) |
| **108** | Ambulance |
| **101** | Fire service |

The incident log in the dashboard does **not** alert anyone.

---

## Future scope (not implemented)

- A secure backend with BMC sign-in, so readiness checklists and incident reports can be shared and verified.
- Loading the 2026 pre-immersion sampling results as soon as MPPCB publishes them.
- A map of the ghats and the new BMC immersion sites.
- A verified resource roster (divers, first aid, rescue teams), filled only from official sources.
- Rerunning `tools/parse_visarjan.py` on future MPPCB reports to extend the dataset year by year.

## License

Released under the [MIT License](LICENSE). Copyright (c) 2026 Claude Impact Lab Bhopal - Team JalDrishti.

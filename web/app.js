// JalDrishti: Visarjan Ghat Watch Controller (Phase 3 UI)
// Bhopal Municipal Corporation Decision Support System
// Loaded on dashboard.html only. Requires site.js (navigation, HINDI_NAMES) and data.js.

let globalAnalysisData = null;
let currentGhatList = [];
let activeBriefLang = "en";
let lastFocusedBeforeModal = null;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// CRI components: weight, sub-score key and chart colour class (see style.css)
const CRI_COMPONENTS = [
  { key: "do_score_40pct", label: "Oxygen deficit", weight: 0.40, cls: "do" },
  { key: "bod_score_30pct", label: "Organic load", weight: 0.30, cls: "bod" },
  { key: "metal_score_20pct", label: "Metal hazard", weight: 0.20, cls: "metal" },
  { key: "lagged_impact_score_10pct", label: "Lagged impact", weight: 0.10, cls: "lagged" }
];

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

// Initialize Dashboard
async function initDashboard() {
  if (!document.getElementById("ghatsList")) return;
  initChartTooltip();

  try {
    // 1. Check for embedded data bundle (instant 0ms loading, works on static/offline hosts)
    if (window.__ANALYSIS_DATA__) {
      globalAnalysisData = window.__ANALYSIS_DATA__;
    } else {
      // 2. Fetch from API or static relative path
      const paths = ["/api/results", "../data_output/analysis_results.json", "data_output/analysis_results.json"];
      let fetched = false;
      for (const p of paths) {
        try {
          const res = await fetch(p);
          if (res.ok) {
            globalAnalysisData = await res.json();
            fetched = true;
            break;
          }
        } catch (_) {}
      }
      if (!fetched) {
        throw new Error("Unable to locate analysis_results.json");
      }
    }

    renderBasinMetrics(globalAnalysisData);
    renderChartTable(globalAnalysisData.ranked_sites);
    currentGhatList = [...globalAnalysisData.ranked_sites];
    handleFilterChange();
  } catch (err) {
    console.error("Dashboard initialization error:", err);
    document.getElementById("ghatsList").innerHTML = `
      <div class="error-state" role="alert">
        <strong>Data Load Error:</strong> ${esc(err.message)}. Please verify <code>data_output/analysis_results.json</code> exists.
      </div>
    `;
  }
}

// Render KPI Metrics
function renderBasinMetrics(data) {
  const comp = data.basin_compliance;
  document.getElementById("valTotalRecords").textContent = Number(data.total_records).toLocaleString("en-IN");
  document.getElementById("valDoViol").textContent = comp.dissolved_oxygen.violation_rate_pct + "%";
  document.getElementById("valBodViol").textContent = comp.bod.violation_rate_pct + "%";
}

// Measured values used for sorting and card stats (from detailed_profiles)
function getParam(site, name) {
  const prof = globalAnalysisData.detailed_profiles[site.site_name];
  return prof && prof.parameters ? prof.parameters[name] : null;
}

function measured(site) {
  const doP = getParam(site, "Dissolved oxygen");
  const bodP = getParam(site, "BOD");
  const pbP = getParam(site, "Lead");
  return {
    doViolPct: doP ? doP.violation_pct : null,
    bodMean: bodP ? bodP.avg_value : null,
    leadPeak: pbP ? pbP.max_value : null
  };
}

function numOrNegInf(v) {
  return (v === null || v === undefined) ? -Infinity : v;
}

// Search, Filter & Sort Logic
function handleFilterChange() {
  const searchEl = document.getElementById("searchInput");
  document.getElementById("searchClear").hidden = !searchEl.value;

  if (!globalAnalysisData) return;

  const query = (searchEl.value || "").trim().toLowerCase();
  const waterbody = document.getElementById("waterbodyFilter").value;
  const tier = document.getElementById("tierFilter").value;
  const sortBy = document.getElementById("sortSelect").value;

  let filtered = globalAnalysisData.ranked_sites.filter(site => {
    // Text search (English name, Hindi name, water body, justification text)
    const matchesText = !query ||
      site.site_name.toLowerCase().includes(query) ||
      (HINDI_NAMES[site.site_name] || "").includes(query) ||
      site.water_bodies.some(wb => wb.toLowerCase().includes(query)) ||
      site.operational_justification.toLowerCase().includes(query);

    // Waterbody filter
    const matchesWb = (waterbody === "ALL") ||
      site.water_bodies.some(wb => wb.toLowerCase().includes(waterbody.toLowerCase()));

    // Tier filter
    const matchesTier = (tier === "ALL") || site.risk_tier.includes(tier);

    return matchesText && matchesWb && matchesTier;
  });

  // Sorting (ties fall back to engine rank so order is stable)
  filtered.sort((a, b) => {
    let diff = 0;
    if (sortBy === "CRI_DESC") {
      diff = b.composite_risk_index - a.composite_risk_index;
    } else if (sortBy === "DO_VIOL_DESC") {
      diff = numOrNegInf(measured(b).doViolPct) - numOrNegInf(measured(a).doViolPct);
    } else if (sortBy === "BOD_AVG_DESC") {
      diff = numOrNegInf(measured(b).bodMean) - numOrNegInf(measured(a).bodMean);
    } else if (sortBy === "LEAD_PEAK_DESC") {
      diff = numOrNegInf(measured(b).leadPeak) - numOrNegInf(measured(a).leadPeak);
    } else if (sortBy === "NAME_ASC") {
      diff = a.site_name.localeCompare(b.site_name);
    }
    return diff || (a.rank - b.rank);
  });

  // Update counter
  document.getElementById("resultsCount").textContent = `Showing ${filtered.length} of ${globalAnalysisData.ranked_sites.length} ghats`;

  const sortLabels = {
    "CRI_DESC": "Ordered by Composite Risk Index (CRI)",
    "DO_VIOL_DESC": "Ordered by measured DO non-compliance (% of tests < 5.0 mg/l)",
    "BOD_AVG_DESC": "Ordered by measured mean BOD (mg/l)",
    "LEAD_PEAK_DESC": "Ordered by measured peak Lead (mg/l)",
    "NAME_ASC": "Ordered Alphabetically (A to Z)"
  };
  document.getElementById("sortLabel").textContent = sortLabels[sortBy] || "";

  currentGhatList = filtered;
  renderGhatCards(filtered);
  renderCriChart(filtered);
}

function clearSearch() {
  const input = document.getElementById("searchInput");
  input.value = "";
  handleFilterChange();
  input.focus();
}

function resetFilters() {
  document.getElementById("searchInput").value = "";
  document.getElementById("waterbodyFilter").value = "ALL";
  document.getElementById("tierFilter").value = "ALL";
  document.getElementById("sortSelect").value = "CRI_DESC";
  handleFilterChange();
}

function tierClass(site) {
  if (site.risk_tier.includes("Tier 1")) return "tier-critical";
  if (site.risk_tier.includes("Tier 2")) return "tier-high";
  if (site.risk_tier.includes("Tier 3")) return "tier-mod";
  return "tier-low";
}

function fmt(v, digits) {
  if (v === null || v === undefined) return "—";
  return digits === undefined ? String(v) : Number(v).toFixed(digits);
}

// Render Ghat Cards
function renderGhatCards(sites) {
  const container = document.getElementById("ghatsList");
  container.innerHTML = "";

  if (sites.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No ghats match the selected filter criteria.</p>
        <button class="btn btn-teal btn-sm" type="button" onclick="resetFilters()">Reset filters</button>
      </div>
    `;
    return;
  }

  sites.forEach((site, i) => {
    const card = document.createElement("article");
    card.className = `ghat-card rank-${site.rank} ${tierClass(site)}`;
    card.style.setProperty("--i", i);
    card.setAttribute("aria-labelledby", `ghat-name-${site.rank}`);

    const alertsHtml = (site.data_gap_alerts && site.data_gap_alerts.length > 0)
      ? `<ul class="alert-pill-list" aria-label="Data gap alerts">
          ${site.data_gap_alerts.map(a => `<li class="alert-pill"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20z M12 10v5 M12 18h.01"/></svg>${esc(a)}</li>`).join("")}
         </ul>`
      : "";

    const interventionsHtml = (site.recommended_interventions && site.recommended_interventions.length > 0)
      ? `<ul class="interventions-tags" aria-label="Recommended interventions">
          ${site.recommended_interventions.map(t => `<li class="intervention-tag">${esc(t)}</li>`).join("")}
         </ul>`
      : "";

    const sub = site.sub_scores;
    const confClass = site.confidence === "high" ? "conf-high" : "conf-medium";
    const m = measured(site);
    const hindi = HINDI_NAMES[site.site_name];

    const meters = CRI_COMPONENTS.map(c => `
      <div class="score-item">
        <span class="score-item-label">
          <span>${c.label} (${Math.round(c.weight * 100)}%)</span>
          <strong>${sub[c.key]}</strong>
        </span>
        <div class="meter-track" role="img" aria-label="${c.label} sub-score ${sub[c.key]} of 100">
          <div class="meter-fill fill-${c.cls}" style="--w: ${Math.min(100, sub[c.key])}%;"></div>
        </div>
      </div>`).join("");

    card.innerHTML = `
      <div class="ghat-header">
        <div class="ghat-title-area">
          <div class="rank-badge" aria-label="Rank ${site.rank}"><span class="rank-hash">#</span>${site.rank}</div>
          <div>
            <h3 class="ghat-name" id="ghat-name-${site.rank}">${esc(site.site_name)}</h3>
            ${hindi ? `<div class="ghat-name-hi" lang="hi">${esc(hindi)}</div>` : ""}
            <div class="ghat-waterbody">
              <span>${esc(site.water_bodies.join(", "))}</span>
              <span class="confidence-pill ${confClass}">${esc(site.confidence)} confidence</span>
            </div>
          </div>
        </div>
        <div class="cri-badge-container">
          <div class="cri-score-box">
            <div class="cri-score-label">Provisional CRI</div>
            <div class="cri-score-val">${site.composite_risk_index.toFixed(2)}</div>
          </div>
          <span class="tier-pill">${esc(site.risk_tier.split(":")[0])}<span class="tier-pill-desc">${esc((site.risk_tier.split(":")[1] || "").trim())}</span></span>
        </div>
      </div>

      ${alertsHtml}

      <dl class="key-stats" aria-label="Measured 2023–2025 values">
        <div><dt>DO non-compliance</dt><dd>${m.doViolPct === null ? "—" : fmt(m.doViolPct, 1) + "%"}</dd></div>
        <div><dt>Mean BOD</dt><dd>${fmt(m.bodMean, 2)} <small>mg/l</small></dd></div>
        <div><dt>Peak Lead</dt><dd>${fmt(m.leadPeak)} <small>mg/l</small></dd></div>
      </dl>

      <div class="scores-breakdown">${meters}</div>

      <p class="justification-text">
        <strong>Operational Reason:</strong> ${esc(site.operational_justification)}
      </p>

      <div class="actions-row">
        ${interventionsHtml}
        <button class="btn btn-sm btn-teal" type="button" onclick="openGhatDetail('${encodeURIComponent(site.site_name)}')">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6 M10 3v6L4 19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2L14 9V3"/></svg>
          View Complete Chemistry & Evidence (PDF Citations)
        </button>
      </div>
    `;

    container.appendChild(card);
  });

  // Animate meters in from zero (CSS handles reduced-motion)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => container.classList.add("meters-ready"));
  });
  container.classList.remove("meters-ready");
}

// CRI composition chart (HTML stacked bars, no dependencies)
function renderCriChart(sites) {
  const chart = document.getElementById("criChart");
  chart.innerHTML = "";
  chart.classList.remove("is-drawn");

  if (sites.length === 0) {
    chart.innerHTML = `<p class="chart-empty">No ghats match the current filters.</p>`;
    return;
  }

  sites.forEach(site => {
    const cri = site.composite_risk_index;
    const parts = CRI_COMPONENTS.map(c => ({ ...c, sub: site.sub_scores[c.key], contrib: c.weight * site.sub_scores[c.key] }));
    const row = document.createElement("div");
    row.className = "cri-row";
    row.setAttribute("role", "listitem");
    row.tabIndex = 0;
    row.dataset.site = site.site_name;
    row.setAttribute("aria-label",
      `Rank ${site.rank}, ${site.site_name}: CRI ${cri.toFixed(2)}. ` +
      parts.map(p => `${p.label} contributes ${p.contrib.toFixed(1)}`).join(", ") +
      ". Press Enter for source evidence.");

    row.innerHTML = `
      <div class="cri-row-label"><span class="cri-rank">${site.rank}</span><span class="cri-name">${esc(site.site_name)}</span></div>
      <div class="cri-track">
        <div class="cri-bar" style="--w: ${Math.min(100, cri)}%;">
          ${parts.filter(p => p.contrib > 0).map(p => `<span class="cri-seg seg-${p.cls}" data-key="${p.key}" style="flex-grow: ${p.contrib};"></span>`).join("")}
        </div>
      </div>
      <div class="cri-row-value">${cri.toFixed(2)}</div>
    `;
    row.addEventListener("click", () => openGhatDetail(encodeURIComponent(site.site_name)));
    row.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openGhatDetail(encodeURIComponent(site.site_name));
      }
    });
    chart.appendChild(row);
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => chart.classList.add("is-drawn"));
  });
}

function renderChartTable(sites) {
  document.getElementById("chartTableBody").innerHTML = sites.map(s => `
    <tr>
      <td>${s.rank}</td>
      <td>${esc(s.site_name)}</td>
      ${CRI_COMPONENTS.map(c => `<td>${s.sub_scores[c.key]}</td>`).join("")}
      <td><strong>${s.composite_risk_index.toFixed(2)}</strong></td>
    </tr>`).join("");
}

function initChartTooltip() {
  const chart = document.getElementById("criChart");
  const tip = document.getElementById("chartTooltip");
  const panel = document.getElementById("composition");

  function show(row, activeKey, clientX, clientY) {
    const site = globalAnalysisData && globalAnalysisData.ranked_sites.find(s => s.site_name === row.dataset.site);
    if (!site) return;
    tip.innerHTML = `
      <div class="tip-title">#${site.rank} ${esc(site.site_name)}</div>
      <table class="tip-table">
        ${CRI_COMPONENTS.map(c => `
          <tr class="${c.key === activeKey ? "is-active" : ""}">
            <td><span class="swatch swatch-${c.cls}"></span>${c.label}</td>
            <td>${site.sub_scores[c.key]} &times; ${c.weight.toFixed(2)}</td>
            <td><strong>${(site.sub_scores[c.key] * c.weight).toFixed(2)}</strong></td>
          </tr>`).join("")}
        <tr class="tip-total"><td>Provisional CRI</td><td></td><td><strong>${site.composite_risk_index.toFixed(2)}</strong></td></tr>
      </table>`;
    tip.hidden = false;

    const pr = panel.getBoundingClientRect();
    let x, y;
    if (clientX !== undefined) {
      x = clientX - pr.left + 14;
      y = clientY - pr.top + 14;
    } else {
      const rr = row.getBoundingClientRect();
      x = rr.left - pr.left + rr.width * 0.35;
      y = rr.bottom - pr.top + 6;
    }
    const maxX = panel.clientWidth - tip.offsetWidth - 8;
    tip.style.left = Math.max(8, Math.min(x, maxX)) + "px";
    tip.style.top = y + "px";
  }

  function hide() { tip.hidden = true; }

  chart.addEventListener("mousemove", e => {
    const row = e.target.closest(".cri-row");
    if (!row) return hide();
    const seg = e.target.closest(".cri-seg");
    show(row, seg ? seg.dataset.key : null, e.clientX, e.clientY);
  });
  chart.addEventListener("mouseleave", hide);
  chart.addEventListener("focusin", e => {
    const row = e.target.closest(".cri-row");
    if (row) show(row, null);
  });
  chart.addEventListener("focusout", hide);
  document.addEventListener("keydown", e => { if (e.key === "Escape") hide(); });
}

// Open Evidence Modal
function openGhatDetail(encodedName) {
  const siteName = decodeURIComponent(encodedName);
  if (!globalAnalysisData || !globalAnalysisData.detailed_profiles[siteName]) return;

  const prof = globalAnalysisData.detailed_profiles[siteName];
  document.getElementById("modalGhatTitle").textContent = `${prof.site_name} (Rank ${prof.risk_rank} | CRI: ${prof.composite_risk_index})`;
  document.getElementById("modalGhatSub").textContent = `Water Body: ${prof.water_bodies.join(", ")} · Confidence: ${prof.site_match_confidence} · Total Tests: ${prof.total_records} (Missing/Not Sampled: ${prof.total_missing_records}, BDL: ${prof.total_bdl_records})`;

  const alertContainer = document.getElementById("modalAlerts");
  alertContainer.innerHTML = (prof.data_gap_alerts && prof.data_gap_alerts.length > 0)
    ? prof.data_gap_alerts.map(a => `<div class="alert-pill"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20z M12 10v5 M12 18h.01"/></svg>${esc(a)}</div>`).join("")
    : "";

  // 1. Render All 13 Parameters
  const tbody = document.getElementById("modalParamBody");
  tbody.innerHTML = "";

  Object.values(prof.parameters).forEach(p => {
    const tr = document.createElement("tr");
    const stdText = p.cpcb_limit_value ? `Class B: ${p.cpcb_limit_type} ${p.cpcb_limit_value}` : "None set (Class B)";
    const minMaxText = (p.min_value !== null && p.max_value !== null) ? `${p.min_value} / ${p.max_value}` : "—";

    let avgText = "—";
    if (p.avg_value !== null) {
      avgText = p.avg_value;
      if (p.bdl_count > 0) avgText += ` (${p.bdl_count} BDL)`;
    } else if (p.bdl_count > 0) {
      avgText = `${p.bdl_count} BDL`;
    }

    let violText = "—";
    let violClass = "";
    if (p.cpcb_limit_value) {
      violText = `${p.violation_count} of ${p.valid_count} (${p.violation_pct}%)`;
      violClass = p.violation_count > 0 ? "violation-cell" : "compliant-cell";
      if (p.parameter === "Dissolved oxygen" && p.zero_count > 0) {
        violText += ` [${p.zero_count}x Zero DO]`;
      }
    }

    const sampleCite = (p.citations && p.citations.length > 0)
      ? `Report ${p.citations[0].year}, p. ${p.citations[0].source_page} (${p.citations[0].festival} ${p.citations[0].phase})`
      : "—";

    tr.innerHTML = `
      <th scope="row">${esc(p.parameter)}</th>
      <td>${esc(p.unit || "—")}</td>
      <td>${p.valid_count}</td>
      <td>${esc(minMaxText)}</td>
      <td>${esc(avgText)}</td>
      <td>${esc(stdText)}</td>
      <td class="${violClass}">${esc(violText)}</td>
      <td class="cite-cell">${esc(sampleCite)}</td>
    `;
    tbody.appendChild(tr);
  });

  // 2. Render Phase Trajectory Progressions
  const progBody = document.getElementById("modalProgressionBody");
  progBody.innerHTML = "";

  if (prof.phase_progressions && prof.phase_progressions.length > 0) {
    prof.phase_progressions.forEach(prog => {
      const tr = document.createElement("tr");
      const pre = prog.pre_value !== null ? prog.pre_value : "Not sampled";
      const dur = prog.during_value !== null ? prog.during_value : "Not sampled";
      const aft = prog.after_value !== null ? prog.after_value : "Not sampled";

      let badge = `<span class="trajectory-recovered">Normal Pattern</span>`;
      if (prog.has_lagged_worsening) {
        badge = `<span class="trajectory-worsened">Lagged Worsening (Post-Immersion Decay)</span>`;
      }

      const cites = Object.entries(prog.citations).map(([ph, c]) => `${ph}: p.${c.source_page}`).join(", ");

      tr.innerHTML = `
        <td>${esc(prog.year)}</td>
        <td>${esc(prog.festival)}</td>
        <td><strong>${esc(prog.parameter)}</strong></td>
        <td>${esc(pre)}</td>
        <td>${esc(dur)}</td>
        <td><strong>${esc(aft)}</strong></td>
        <td>${badge}</td>
        <td class="cite-cell">${esc(cites)}</td>
      `;
      progBody.appendChild(tr);
    });
  } else {
    progBody.innerHTML = `<tr><td colspan="8" class="empty-cell">No paired progression data available.</td></tr>`;
  }

  openOverlay("detailModal");
}

// Generic modal helpers (focus management + background scroll lock)
function openOverlay(id) {
  const overlay = document.getElementById(id);
  if (!overlay.hidden) return;
  lastFocusedBeforeModal = document.activeElement;
  overlay.hidden = false;
  overlay.scrollTop = 0;
  document.body.classList.add("modal-open");
  const closeBtn = overlay.querySelector(".modal-close");
  if (closeBtn) closeBtn.focus();
}

function closeOverlay(id) {
  const overlay = document.getElementById(id);
  if (overlay.hidden) return;
  overlay.hidden = true;
  if (!document.querySelector(".modal-overlay:not([hidden])")) {
    document.body.classList.remove("modal-open");
  }
  if (lastFocusedBeforeModal && document.contains(lastFocusedBeforeModal)) {
    lastFocusedBeforeModal.focus();
  }
}

function closeModal() {
  closeOverlay("detailModal");
}

// Methodology Modal
function openMethodologyModal() {
  closeNavMenu();
  openOverlay("methodologyModal");
}
function closeMethodologyModal() {
  closeOverlay("methodologyModal");
}

// Bilingual Brief Controls
function setBriefVisible(visible) {
  const sec = document.getElementById("briefSection");
  sec.style.display = visible ? "block" : "none";
  document.getElementById("briefToggleBtn").setAttribute("aria-expanded", String(visible));
}

function toggleBilingualBrief() {
  closeNavMenu();
  const sec = document.getElementById("briefSection");
  const show = sec.style.display === "none";
  setBriefVisible(show);
  if (show) {
    sec.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
  }
}
function closeBriefSection() {
  setBriefVisible(false);
}

function switchBriefTab(lang) {
  activeBriefLang = lang;
  const en = lang === "en";
  document.getElementById("tabEnBtn").classList.toggle("active", en);
  document.getElementById("tabHiBtn").classList.toggle("active", !en);
  document.getElementById("tabEnBtn").setAttribute("aria-selected", String(en));
  document.getElementById("tabHiBtn").setAttribute("aria-selected", String(!en));
  document.getElementById("briefContentEn").style.display = en ? "block" : "none";
  document.getElementById("briefContentHi").style.display = en ? "none" : "block";
}

function setBriefStatus(msg) {
  const el = document.getElementById("briefStatus");
  el.textContent = msg;
  clearTimeout(setBriefStatus._t);
  setBriefStatus._t = setTimeout(() => { el.textContent = ""; }, 4000);
}

function copyBriefText() {
  const panel = activeBriefLang === "en" ? document.getElementById("briefContentEn") : document.getElementById("briefContentHi");
  const text = panel.innerText;
  const label = activeBriefLang === "en" ? "English" : "Hindi";

  const fallbackCopy = () => {
    // Works on file:// and other non-secure contexts where navigator.clipboard is unavailable
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (_) {}
    document.body.removeChild(ta);
    setBriefStatus(ok ? `Brief copied to clipboard in ${label}.` : "Copy failed. Please select the text and copy manually.");
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(() => setBriefStatus(`Brief copied to clipboard in ${label}.`))
      .catch(err => {
        console.error("Clipboard copy failed:", err);
        fallbackCopy();
      });
  } else {
    fallbackCopy();
  }
}

function downloadBriefFile() {
  const panel = activeBriefLang === "en" ? document.getElementById("briefContentEn") : document.getElementById("briefContentHi");
  const text = panel.innerText;
  const filename = `JalDrishti_BMC_Brief_${activeBriefLang.toUpperCase()}.txt`;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setBriefStatus(`Downloaded ${filename}.`);
}

// Print Report: the print stylesheet lays out brief, chart and all ranking cards
function printReport() {
  closeNavMenu();
  window.print();
}

// Window Event Listeners for Modal Escaping and Backdrop Click
window.onclick = function(event) {
  const detailModal = document.getElementById("detailModal");
  const methModal = document.getElementById("methodologyModal");
  if (event.target === detailModal) closeModal();
  if (event.target === methModal) closeMethodologyModal();
};

window.onkeydown = function(event) {
  if (event.key === "Escape") {
    closeModal();
    closeMethodologyModal();
    closeNavMenu();
  }
  // Keep keyboard focus inside an open modal
  if (event.key === "Tab") {
    const open = document.querySelector(".modal-overlay:not([hidden])");
    if (!open) return;
    const focusables = open.querySelectorAll("button, a[href], summary, [tabindex]:not([tabindex='-1'])");
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
};

// Print should include every ghat regardless of on-screen filters
window.addEventListener("beforeprint", () => {
  window.__printSnapshot = {
    q: document.getElementById("searchInput").value,
    wb: document.getElementById("waterbodyFilter").value,
    tier: document.getElementById("tierFilter").value,
    sort: document.getElementById("sortSelect").value
  };
  resetFilters();
});
window.addEventListener("afterprint", () => {
  const s = window.__printSnapshot;
  if (!s) return;
  document.getElementById("searchInput").value = s.q;
  document.getElementById("waterbodyFilter").value = s.wb;
  document.getElementById("tierFilter").value = s.tier;
  document.getElementById("sortSelect").value = s.sort;
  handleFilterChange();
  window.__printSnapshot = null;
});

document.addEventListener("DOMContentLoaded", initDashboard);

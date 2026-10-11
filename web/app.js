// JalDrishti: Visarjan Ghat Watch Controller (Phase 2)
// Bhopal Municipal Corporation Decision Support System

let globalAnalysisData = null;
let currentGhatList = [];
let activeBriefLang = "en";

// Initialize Dashboard
async function initDashboard() {
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
    currentGhatList = [...globalAnalysisData.ranked_sites];
    handleFilterChange();
  } catch (err) {
    console.error("Dashboard initialization error:", err);
    document.getElementById("ghatsList").innerHTML = `
      <div style="background:#fee2e2; color:#991b1b; padding:18px; border-radius:6px; font-size:13px;">
        <strong>Data Load Error:</strong> ${err.message}. Please verify <code>data_output/analysis_results.json</code> exists.
      </div>
    `;
  }
}

// Render KPI Metrics
function renderBasinMetrics(data) {
  const comp = data.basin_compliance;
  document.getElementById("valTotalRecords").textContent = Number(data.total_records).toLocaleString();
  document.getElementById("valDoViol").textContent = comp.dissolved_oxygen.violation_rate_pct + "%";
  document.getElementById("valBodViol").textContent = comp.bod.violation_rate_pct + "%";
}

// Search, Filter & Sort Logic
function handleFilterChange() {
  if (!globalAnalysisData) return;

  const query = (document.getElementById("searchInput").value || "").trim().toLowerCase();
  const waterbody = document.getElementById("waterbodyFilter").value;
  const tier = document.getElementById("tierFilter").value;
  const sortBy = document.getElementById("sortSelect").value;

  let filtered = globalAnalysisData.ranked_sites.filter(site => {
    // Text search
    const matchesText = !query || 
      site.site_name.toLowerCase().includes(query) || 
      site.water_bodies.some(wb => wb.toLowerCase().includes(query)) ||
      site.operational_justification.toLowerCase().includes(query);

    // Waterbody filter
    const matchesWb = (waterbody === "ALL") || 
      site.water_bodies.some(wb => wb.toLowerCase().includes(waterbody.toLowerCase()));

    // Tier filter
    const matchesTier = (tier === "ALL") || site.risk_tier.includes(tier);

    return matchesText && matchesWb && matchesTier;
  });

  // Sorting
  filtered.sort((a, b) => {
    if (sortBy === "CRI_DESC") {
      return b.composite_risk_index - a.composite_risk_index;
    } else if (sortBy === "DO_VIOL_DESC") {
      return b.sub_scores.do_score_40pct - a.sub_scores.do_score_40pct;
    } else if (sortBy === "BOD_AVG_DESC") {
      return b.sub_scores.bod_score_30pct - a.sub_scores.bod_score_30pct;
    } else if (sortBy === "LEAD_PEAK_DESC") {
      return b.sub_scores.metal_score_20pct - a.sub_scores.metal_score_20pct;
    } else if (sortBy === "NAME_ASC") {
      return a.site_name.localeCompare(b.site_name);
    }
    return 0;
  });

  // Update counter
  document.getElementById("resultsCount").textContent = `Showing ${filtered.length} of ${globalAnalysisData.ranked_sites.length} ghats`;
  
  const sortLabels = {
    "CRI_DESC": "Ordered by Composite Risk Index (CRI)",
    "DO_VIOL_DESC": "Ordered by Oxygen Deficit Severity",
    "BOD_AVG_DESC": "Ordered by BOD Organic Load",
    "LEAD_PEAK_DESC": "Ordered by Heavy Metal Intensity",
    "NAME_ASC": "Ordered Alphabetically (A to Z)"
  };
  document.getElementById("sortLabel").textContent = sortLabels[sortBy] || "";

  renderGhatCards(filtered);
}

function resetFilters() {
  document.getElementById("searchInput").value = "";
  document.getElementById("waterbodyFilter").value = "ALL";
  document.getElementById("tierFilter").value = "ALL";
  document.getElementById("sortSelect").value = "CRI_DESC";
  handleFilterChange();
}

// Render Ghat Cards
function renderGhatCards(sites) {
  const container = document.getElementById("ghatsList");
  container.innerHTML = "";

  if (sites.length === 0) {
    container.innerHTML = `
      <div style="background:white; border:1px solid var(--border); border-radius:8px; padding:30px; text-align:center; color:var(--text-muted);">
        No ghats match the selected filter criteria. Try resetting filters.
      </div>
    `;
    return;
  }

  sites.forEach(site => {
    const card = document.createElement("div");
    card.className = `ghat-card rank-${site.rank}`;

    const alertsHtml = (site.data_gap_alerts && site.data_gap_alerts.length > 0)
      ? `<div class="alert-pill-list">
          ${site.data_gap_alerts.map(a => `<span class="alert-pill">⚠️ ${a}</span>`).join("")}
         </div>`
      : "";

    const interventionsHtml = (site.recommended_interventions && site.recommended_interventions.length > 0)
      ? `<div class="interventions-tags">
          ${site.recommended_interventions.map(i => `<span class="intervention-tag">✓ ${i}</span>`).join("")}
         </div>`
      : "";

    const sub = site.sub_scores;
    const confClass = site.confidence === "high" ? "conf-high" : "conf-medium";

    card.innerHTML = `
      <div class="ghat-header">
        <div class="ghat-title-area">
          <div class="rank-badge">${site.rank}</div>
          <div>
            <div class="ghat-name">${site.site_name}</div>
            <div class="ghat-waterbody">
              ${site.water_bodies.join(", ")} &middot; 
              <span class="confidence-pill ${confClass}">${site.confidence} confidence</span>
            </div>
          </div>
        </div>
        <div class="cri-badge-container">
          <div class="cri-score-box">
            <div class="cri-score-label">Provisional CRI</div>
            <div class="cri-score-val">${site.composite_risk_index.toFixed(2)}</div>
          </div>
          <span class="tier-pill tier-${site.rank === 1 ? '1' : site.composite_risk_index >= 55 ? '2' : site.composite_risk_index >= 40 ? '3' : '4'}">
            ${site.risk_tier.split(':')[0]}
          </span>
        </div>
      </div>

      ${alertsHtml}

      <div class="scores-breakdown">
        <div class="score-item">
          <span class="score-item-label">
            <span>Oxygen Deficit (40%)</span>
            <strong>${sub.do_score_40pct}</strong>
          </span>
          <div class="meter-track">
            <div class="meter-fill fill-do" style="width: ${Math.min(100, sub.do_score_40pct)}%;"></div>
          </div>
        </div>
        <div class="score-item">
          <span class="score-item-label">
            <span>Organic Load (30%)</span>
            <strong>${sub.bod_score_30pct}</strong>
          </span>
          <div class="meter-track">
            <div class="meter-fill fill-bod" style="width: ${Math.min(100, sub.bod_score_30pct)}%;"></div>
          </div>
        </div>
        <div class="score-item">
          <span class="score-item-label">
            <span>Metal Hazard (20%)</span>
            <strong>${sub.metal_score_20pct}</strong>
          </span>
          <div class="meter-track">
            <div class="meter-fill fill-metal" style="width: ${Math.min(100, sub.metal_score_20pct)}%;"></div>
          </div>
        </div>
        <div class="score-item">
          <span class="score-item-label">
            <span>Lagged Impact (10%)</span>
            <strong>${sub.lagged_impact_score_10pct}</strong>
          </span>
          <div class="meter-track">
            <div class="meter-fill fill-lagged" style="width: ${Math.min(100, sub.lagged_impact_score_10pct)}%;"></div>
          </div>
        </div>
      </div>

      <div class="justification-text">
        <strong>Operational Reason:</strong> ${site.operational_justification}
      </div>

      <div class="actions-row">
        ${interventionsHtml}
        <button class="btn btn-sm btn-primary" onclick="openGhatDetail('${encodeURIComponent(site.site_name)}')">
          🔬 View Complete Chemistry & Evidence (PDF Citations)
        </button>
      </div>
    `;

    container.appendChild(card);
  });
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
    ? prof.data_gap_alerts.map(a => `<div class="alert-pill" style="display:inline-block; margin-right:6px; margin-bottom:6px;">⚠️ ${a}</div>`).join("")
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
      <td><strong>${p.parameter}</strong></td>
      <td>${p.unit || '—'}</td>
      <td>${p.valid_count}</td>
      <td>${minMaxText}</td>
      <td>${avgText}</td>
      <td>${stdText}</td>
      <td class="${violClass}">${violText}</td>
      <td style="font-size:11px; color:#475569;">${sampleCite}</td>
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
        <td>${prog.year}</td>
        <td>${prog.festival}</td>
        <td><strong>${prog.parameter}</strong></td>
        <td>${pre}</td>
        <td>${dur}</td>
        <td><strong>${aft}</strong></td>
        <td>${badge}</td>
        <td style="font-size:11px; color:#475569;">${cites}</td>
      `;
      progBody.appendChild(tr);
    });
  } else {
    progBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">No paired progression data available.</td></tr>`;
  }

  document.getElementById("detailModal").style.display = "block";
}

function closeModal() {
  document.getElementById("detailModal").style.display = "none";
}

// Methodology Modal
function openMethodologyModal() {
  document.getElementById("methodologyModal").style.display = "block";
}
function closeMethodologyModal() {
  document.getElementById("methodologyModal").style.display = "none";
}

// Bilingual Brief Controls
function toggleBilingualBrief() {
  const sec = document.getElementById("briefSection");
  sec.style.display = (sec.style.display === "none") ? "block" : "none";
  if (sec.style.display === "block") {
    sec.scrollIntoView({ behavior: "smooth" });
  }
}
function closeBriefSection() {
  document.getElementById("briefSection").style.display = "none";
}

function switchBriefTab(lang) {
  activeBriefLang = lang;
  document.getElementById("tabEnBtn").classList.toggle("active", lang === "en");
  document.getElementById("tabHiBtn").classList.toggle("active", lang === "hi");
  document.getElementById("briefContentEn").style.display = lang === "en" ? "block" : "none";
  document.getElementById("briefContentHi").style.display = lang === "hi" ? "block" : "none";
}

function copyBriefText() {
  const panel = activeBriefLang === "en" ? document.getElementById("briefContentEn") : document.getElementById("briefContentHi");
  const text = panel.innerText;
  navigator.clipboard.writeText(text).then(() => {
    alert(`Brief copied to clipboard in ${activeBriefLang === "en" ? "English" : "Hindi"}!`);
  }).catch(err => {
    console.error("Clipboard copy failed:", err);
  });
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
  }
};

document.addEventListener("DOMContentLoaded", initDashboard);

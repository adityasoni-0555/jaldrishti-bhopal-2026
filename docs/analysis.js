// JalDrishti: analysis page (analysis.html)
// Builds comparison and year-by-year tables directly from the engine output embedded in data.js.
// Nothing here changes or re-scores the data: it only groups the cited readings.

(function () {
  "use strict";

  const YEARS = ["2023", "2024", "2025"];
  const LIMITS = { "Dissolved oxygen": { type: "min", value: 5.0 }, "BOD": { type: "max", value: 3.0 } };
  const h = siteEsc;

  function data() {
    return window.__ANALYSIS_DATA__ || null;
  }

  function fmt(v, d) {
    return v === null || v === undefined || Number.isNaN(v) ? "—" : Number(v).toFixed(d);
  }

  function nameCell(site) {
    const hi = HINDI_NAMES[site.site_name];
    return `<th scope="row"><span class="row-name">${h(site.site_name)}</span>${hi ? `<span class="row-name-hi" lang="hi">${h(hi)}</span>` : ""}</th>`;
  }

  // Mean of numeric readings for one parameter and year (BDL / not sampled excluded, as in the engine)
  function yearStats(param, year) {
    if (!param || !Array.isArray(param.citations)) return { mean: null, n: 0 };
    const vals = param.citations.filter(c => c.year === year && typeof c.value === "number").map(c => c.value);
    if (!vals.length) return { mean: null, n: 0 };
    return { mean: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length };
  }

  function breaches(paramName, mean) {
    const lim = LIMITS[paramName];
    if (!lim || mean === null) return false;
    return lim.type === "min" ? mean < lim.value : mean > lim.value;
  }

  function renderComparison(d) {
    const body = document.getElementById("comparisonBody");
    if (!body) return;
    body.innerHTML = d.ranked_sites.map(site => {
      const p = d.detailed_profiles[site.site_name].parameters;
      const s = site.sub_scores;
      const doP = p["Dissolved oxygen"], bodP = p["BOD"], pbP = p["Lead"];
      return `<tr>
        <td class="num"><span class="rank-chip">${site.rank}</span></td>
        ${nameCell(site)}
        <td class="num"><strong>${site.composite_risk_index.toFixed(2)}</strong></td>
        <td class="num">${s.do_score_40pct}</td>
        <td class="num">${s.bod_score_30pct}</td>
        <td class="num">${s.metal_score_20pct}</td>
        <td class="num">${s.lagged_impact_score_10pct}</td>
        <td class="num">${doP ? doP.violation_count + "/" + doP.valid_count : "—"}</td>
        <td class="num">${bodP ? fmt(bodP.avg_value, 2) : "—"}</td>
        <td class="num">${pbP ? h(pbP.max_value) : "—"}</td>
      </tr>`;
    }).join("");
  }

  function renderTrends(d) {
    const body = document.getElementById("trendBody");
    if (!body) return;
    body.innerHTML = d.ranked_sites.map(site => {
      const p = d.detailed_profiles[site.site_name].parameters;
      const cells = ["Dissolved oxygen", "BOD"].map(name =>
        YEARS.map(y => {
          const st = yearStats(p[name], y);
          if (!st.n) return `<td class="num trend-cell trend-gap" title="No numeric ${name} reading in ${y}">no data</td>`;
          const bad = breaches(name, st.mean);
          return `<td class="num trend-cell${bad ? " trend-breach" : ""}">${fmt(st.mean, 2)}<small> n=${st.n}</small>${bad ? '<span class="visually-hidden"> (outside CPCB Class B limit)</span>' : ""}</td>`;
        }).join("")
      ).join("");
      return `<tr>${nameCell(site)}${cells}</tr>`;
    }).join("");
  }

  function renderLagged(d) {
    const body = document.getElementById("laggedBody");
    if (!body) return;
    body.innerHTML = d.ranked_sites.map(site => {
      const prog = d.detailed_profiles[site.site_name].phase_progressions || [];
      // Same definition as engine.py: a pair needs both a "during" and an "after" reading
      const pairs = prog.filter(x => x.during_value !== null && x.after_value !== null);
      const worse = pairs.filter(x => x.has_lagged_worsening);
      const examples = worse.slice(0, 2)
        .map(x => `${h(x.festival)} ${h(x.year)} ${h(x.parameter)}: ${h(x.during_value)} → ${h(x.after_value)}`).join("; ");
      const score = site.sub_scores.lagged_impact_score_10pct;
      return `<tr>
        ${nameCell(site)}
        <td class="num">${pairs.length}</td>
        <td class="num">${worse.length}</td>
        <td class="num">${score}${pairs.length ? "" : " <small>(no pairs: neutral default)</small>"}</td>
        <td>${examples || "—"}</td>
      </tr>`;
    }).join("");
  }

  function renderBasin(d) {
    const c = d.basin_compliance;
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set("anDo", `${c.dissolved_oxygen.violations_under_5mg_l} of ${c.dissolved_oxygen.total_valid_measurements} (${c.dissolved_oxygen.violation_rate_pct}%)`);
    set("anBod", `${c.bod.violations_over_3mg_l} of ${c.bod.total_valid_measurements} (${c.bod.violation_rate_pct}%)`);
    set("anPh", `${c.ph.violations_outside_range} of ${c.ph.total_valid_measurements} (${c.ph.violation_rate_pct}%)`);
    set("anZero", String(c.dissolved_oxygen.zero_do_count));
  }

  function init() {
    const d = data();
    if (!d) {
      const box = document.getElementById("analysisError");
      if (box) box.hidden = false;
      return;
    }
    renderBasin(d);
    renderComparison(d);
    renderTrends(d);
    renderLagged(d);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

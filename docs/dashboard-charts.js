// JalDrishti: dashboard charts (dashboard.html)
// Donut charts for basin compliance and simple bar charts per ghat, drawn from the engine output in data.js.
// Requires site.js, data.js and app.js (measured(), openGhatDetail()). Nothing is re-scored here.

(function () {
  "use strict";

  const h = siteEsc;
  const TIER_CLASS = { "Tier 1": "tc-2", "Tier 2": "tc-2", "Tier 3": "tc-3", "Tier 4": "tc-4" };
  let donutsDrawn = false;

  function tierKey(site) {
    return site.risk_tier.split(":")[0].trim();
  }

  // ---------- Donuts (two-part shares: outside vs within the CPCB limit) ----------
  function drawDonut(id, outside, total, label, limitText) {
    const host = document.getElementById(id);
    if (!host) return;
    const within = total - outside;
    const pct = total ? (outside / total) * 100 : 0;
    const r = 48;
    const c = 2 * Math.PI * r;
    const ring = host.querySelector(".donut-value");
    if (ring) {
      ring.setAttribute("stroke-dasharray", `${(pct / 100) * c} ${c}`);
    }
    host.setAttribute("aria-label", `${label}: ${outside} of ${total} tests outside the CPCB Class B limit (${pct.toFixed(2)}%); ${within} within the limit. ${limitText}.`);
    const legend = document.querySelector(`[data-legend-for="${id}"]`);
    if (legend) {
      legend.innerHTML =
        `<li><span class="key key-out" aria-hidden="true"></span>Outside limit: <strong>${outside}</strong></li>` +
        `<li><span class="key key-in" aria-hidden="true"></span>Within limit: <strong>${within}</strong></li>`;
    }
  }

  function drawDonuts() {
    const d = window.__ANALYSIS_DATA__;
    if (!d || donutsDrawn) return;
    const c = d.basin_compliance;
    drawDonut("donutDo", c.dissolved_oxygen.violations_under_5mg_l, c.dissolved_oxygen.total_valid_measurements, "Dissolved oxygen", "Limit: at least 5.0 mg/l");
    drawDonut("donutBod", c.bod.violations_over_3mg_l, c.bod.total_valid_measurements, "BOD", "Limit: at most 3.0 mg/l");
    drawDonut("donutPh", c.ph.violations_outside_range, c.ph.total_valid_measurements, "pH", "Limit: 6.5 to 8.5");
    const ph = document.getElementById("valPhViol");
    if (ph) ph.textContent = c.ph.violation_rate_pct + "%";
    donutsDrawn = true;
  }

  // ---------- Horizontal bar charts ----------
  function barRow(site, valueText, widthPct, opts = {}) {
    const name = site.site_name;
    const hi = HINDI_NAMES[name];
    const marker = opts.markerPct !== undefined
      ? `<span class="hbar-marker" style="left:${opts.markerPct}%" aria-hidden="true"></span>`
      : "";
    return `
      <li>
        <button class="hbar-row" type="button" data-site="${encodeURIComponent(name)}"
                aria-label="${h(opts.aria || `${name}: ${valueText}`)}. Open evidence.">
          <span class="hbar-label"><span class="hbar-rank">${site.rank}</span><span class="hbar-name" title="${h(name)}${hi ? " · " + h(hi) : ""}">${h(name)}</span></span>
          <span class="hbar-track">
            <span class="hbar-fill ${opts.fillClass || ""}" style="--w:${Math.max(0, Math.min(100, widthPct))}%"></span>${marker}
          </span>
          <span class="hbar-value">${h(valueText)}</span>
        </button>
      </li>`;
  }

  function animate(container) {
    container.classList.remove("is-drawn");
    requestAnimationFrame(() => requestAnimationFrame(() => container.classList.add("is-drawn")));
  }

  function renderList(id, sites, rowFn, emptyText) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = sites.length ? sites.map(rowFn).join("") : `<li class="hbar-empty">${h(emptyText)}</li>`;
    animate(el);
  }

  function renderRisk(sites) {
    renderList("riskChart", sites, site => {
      const t = tierKey(site);
      return barRow(site, site.composite_risk_index.toFixed(2), site.composite_risk_index, {
        fillClass: TIER_CLASS[t] || "tc-4",
        aria: `Rank ${site.rank}, ${site.site_name}: provisional CRI ${site.composite_risk_index.toFixed(2)}, ${site.risk_tier}`
      }).replace('<span class="hbar-value">', `<span class="hbar-value"><span class="hbar-tier">${h(t)}</span> `);
    }, "No ghats match the current search or filters.");
  }

  function renderIndicators(sites) {
    const rows = sites.map(site => ({ site, m: measured(site) }));

    renderList("chartDo", rows.map(r => r.site), site => {
      const v = measured(site).doViolPct;
      return barRow(site, v === null ? "no data" : v.toFixed(1) + "%", v || 0, {
        fillClass: "fill-indicator",
        aria: `${site.site_name}: ${v === null ? "no data" : v.toFixed(1) + "% of dissolved-oxygen tests below 5.0 mg/l"}`
      });
    }, "No ghats to show.");

    const bodMax = Math.max(10, Math.ceil(Math.max(0, ...rows.map(r => r.m.bodMean || 0))));
    renderList("chartBod", rows.map(r => r.site), site => {
      const v = measured(site).bodMean;
      return barRow(site, v === null ? "no data" : v.toFixed(2), v === null ? 0 : (v / bodMax) * 100, {
        fillClass: "fill-indicator",
        markerPct: (3 / bodMax) * 100,
        aria: `${site.site_name}: mean BOD ${v === null ? "no data" : v.toFixed(2) + " mg/l"}; CPCB Class B limit is 3.0 mg/l`
      });
    }, "No ghats to show.");
    const bodAxis = document.getElementById("bodAxisMax");
    if (bodAxis) bodAxis.textContent = bodMax;
    const bodLimit = document.getElementById("bodLimitLabel");
    if (bodLimit) bodLimit.style.left = `${(3 / bodMax) * 100}%`;

    const pbMax = Math.max(2, Math.ceil(Math.max(0, ...rows.map(r => Number(r.m.leadPeak) || 0)) * 2) / 2);
    renderList("chartPb", rows.map(r => r.site), site => {
      const v = measured(site).leadPeak;
      return barRow(site, v === null || v === undefined ? "no data" : String(v), v ? (Number(v) / pbMax) * 100 : 0, {
        fillClass: "fill-indicator",
        aria: `${site.site_name}: peak lead ${v === null || v === undefined ? "no data" : v + " mg/l"}`
      });
    }, "No ghats to show.");
    const pbAxis = document.getElementById("pbAxisMax");
    if (pbAxis) pbAxis.textContent = pbMax;
  }

  // Called by app.js after every search / filter / sort change
  window.onDashboardFilter = function (filtered) {
    drawDonuts();
    renderRisk(filtered);
    renderIndicators(filtered);
    const note = document.getElementById("chartFilterNote");
    const total = (window.__ANALYSIS_DATA__ || { ranked_sites: [] }).ranked_sites.length;
    if (note) note.textContent = filtered.length === total ? "Showing all 7 ghats." : `Filtered: showing ${filtered.length} of ${total} ghats.`;
  };

  // Bars open the existing evidence dialog
  document.addEventListener("click", e => {
    const row = e.target.closest(".hbar-row");
    if (row && typeof openGhatDetail === "function") openGhatDetail(row.dataset.site);
  });

  // Searching or filtering opens the detailed cards so results are visible
  document.addEventListener("DOMContentLoaded", () => {
    const fold = document.getElementById("cardsFold");
    const open = () => { if (fold) fold.open = true; };
    ["searchInput", "waterbodyFilter", "tierFilter", "sortSelect"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(id === "searchInput" ? "input" : "change", open);
    });
  });

  // Printed report: expand collapsed sections, then restore
  let openedForPrint = [];
  window.addEventListener("beforeprint", () => {
    openedForPrint = [...document.querySelectorAll("details.fold:not([open])")];
    openedForPrint.forEach(d => { d.open = true; });
  });
  window.addEventListener("afterprint", () => {
    openedForPrint.forEach(d => { d.open = false; });
    openedForPrint = [];
  });
})();

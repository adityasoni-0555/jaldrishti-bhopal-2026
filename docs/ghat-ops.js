// JalDrishti: Chhath Puja ghat readiness tools (local demo records only)
// Kept separate from app.js so the historical water-quality analysis is never modified.
// Nothing here is sent to a server: records live in this browser's localStorage.

(function () {
  "use strict";

  const STORE_KEYS = {
    ghats: "jaldrishti.addedGhats.v1",
    readiness: "jaldrishti.readiness.v1",
    incidents: "jaldrishti.incidents.v1"
  };

  const CHECKLIST_ITEMS = [
    { key: "lighting", en: "Lighting", hi: "प्रकाश व्यवस्था", hint: "Working lights on steps, approach paths and the water's edge." },
    { key: "barriers", en: "Barriers", hi: "बैरिकेडिंग", hint: "Barricades or ropes marking the safe bathing limit." },
    { key: "steps", en: "Slippery steps", hi: "फिसलन भरी सीढ़ियाँ", hint: "Steps cleaned of algae and mud; anti-slip measures in place." },
    { key: "depth", en: "Water-depth warnings", hi: "गहरे पानी की चेतावनी", hint: "Visible signs where depth drops; no-entry zones marked." },
    { key: "crowd", en: "Crowd management", hi: "भीड़ प्रबंधन", hint: "Entry/exit routes, queueing and staff on duty." },
    { key: "firstaid", en: "First aid", hi: "प्राथमिक चिकित्सा", hint: "First-aid point identified and stocked." },
    { key: "sanitation", en: "Sanitation", hi: "स्वच्छता", hint: "Toilets and drinking water available nearby." },
    { key: "waste", en: "Waste clearance", hi: "कचरा निस्तारण", hint: "Bins placed and a post-ritual clearance plan in place." }
  ];

  const STATUSES = [
    { key: "pending", label: "Pending" },
    { key: "progress", label: "In progress" },
    { key: "verified", label: "Verified" }
  ];

  // Only entries with an official source may be added here. None are published yet.
  const RESOURCE_DIRECTORY = [
    { key: "volunteers", en: "Volunteers", hi: "स्वयंसेवक", entries: [] },
    { key: "workers", en: "Municipal / sanitation workers", hi: "नगर निगम / सफ़ाई कर्मी", entries: [] },
    { key: "firstaid", en: "First-aid points", hi: "प्राथमिक चिकित्सा केंद्र", entries: [] },
    { key: "divers", en: "Divers", hi: "गोताखोर", entries: [] },
    { key: "rescue", en: "Rescue teams (SDERF / Home Guard)", hi: "बचाव दल", entries: [] }
  ];

  // ---------- Storage (falls back to memory if localStorage is blocked) ----------
  const memoryStore = {};
  let persistent = true;
  try {
    const probe = "__jd_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
  } catch (_) {
    persistent = false;
  }

  function load(key, fallback) {
    try {
      const raw = persistent ? window.localStorage.getItem(key) : memoryStore[key];
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function save(key, value) {
    const raw = JSON.stringify(value);
    if (persistent) {
      try {
        window.localStorage.setItem(key, raw);
        return;
      } catch (_) {
        persistent = false;
        updateStorageStatus();
      }
    }
    memoryStore[key] = raw;
  }

  // ---------- Helpers ----------
  const $ = id => document.getElementById(id);

  function h(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  // Name normalisation for duplicate detection
  const GENERIC_WORDS = /\b(ghat|ghaat|kund|kunda|lake|talab|talaab|tank|the|and)\b/g;
  function normalise(name) {
    return String(name || "")
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[()\/,.\-–—'’"]/g, " ")
      .replace(GENERIC_WORDS, " ")
      .replace(/(घाट|कुंड|तालाब|झील)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function historicalSites() {
    const data = window.__ANALYSIS_DATA__;
    return data && Array.isArray(data.ranked_sites) ? data.ranked_sites : [];
  }

  // Each historical site contributes several aliases ("Rani Kamlapati ghat / Kamla Park kund" -> both parts)
  function historicalAliases() {
    const aliases = [];
    const hindi = typeof HINDI_NAMES !== "undefined" ? HINDI_NAMES : {};
    historicalSites().forEach(site => {
      const parts = [site.site_name];
      site.site_name.split("/").forEach(p => parts.push(p));
      const paren = site.site_name.match(/\(([^)]+)\)/);
      if (paren) {
        parts.push(paren[1]);
        parts.push(site.site_name.replace(/\([^)]*\)/, ""));
      }
      if (hindi[site.site_name]) {
        parts.push(hindi[site.site_name]);
        hindi[site.site_name].split("/").forEach(p => parts.push(p));
      }
      parts.forEach(p => {
        const n = normalise(p);
        if (n.length >= 3) aliases.push({ norm: n, label: site.site_name });
      });
    });
    return aliases;
  }

  // ---------- State ----------
  let addedGhats = load(STORE_KEYS.ghats, []);
  let readiness = load(STORE_KEYS.readiness, {});
  let incidents = load(STORE_KEYS.incidents, []);
  if (!Array.isArray(addedGhats)) addedGhats = [];
  if (!Array.isArray(incidents)) incidents = [];
  if (typeof readiness !== "object" || readiness === null) readiness = {};

  function allGhatOptions() {
    const hist = historicalSites().map(s => ({ id: "h:" + s.site_name, name: s.site_name, group: "historical", rank: s.rank }));
    const added = addedGhats.map(g => ({ id: "a:" + g.id, name: g.name, group: "added" }));
    return hist.concat(added);
  }

  function ghatName(id) {
    const opt = allGhatOptions().find(o => o.id === id);
    return opt ? opt.name : null;
  }

  function fillGhatSelect(select, { placeholder } = {}) {
    const current = select.value;
    const opts = allGhatOptions();
    const hist = opts.filter(o => o.group === "historical");
    const added = opts.filter(o => o.group === "added");
    let html = placeholder ? `<option value="">${h(placeholder)}</option>` : "";
    html += `<optgroup label="Historical dataset (2023–2025)">` +
      hist.map(o => `<option value="${h(o.id)}">#${o.rank} ${h(o.name)}</option>`).join("") + `</optgroup>`;
    if (added.length) {
      html += `<optgroup label="Added ghats (local demo, no water data)">` +
        added.map(o => `<option value="${h(o.id)}">${h(o.name)}</option>`).join("") + `</optgroup>`;
    }
    select.innerHTML = html;
    if (opts.some(o => o.id === current)) select.value = current;
  }

  function updateStorageStatus() {
    const el = $("storageStatus");
    if (!el) return;
    el.textContent = persistent
      ? ""
      : "This browser is blocking local storage, so records will be lost when you close or reload the page.";
    el.classList.toggle("is-warning", !persistent);
  }

  // ---------- Readiness checklist ----------
  function renderChecklist() {
    const select = $("checklistGhat");
    const list = $("checklistList");
    const id = select.value;
    const state = readiness[id] || {};
    const name = ghatName(id) || "";

    list.innerHTML = CHECKLIST_ITEMS.map(item => {
      const entry = state[item.key] || { status: "pending" };
      const groupName = `chk-${item.key}`;
      return `
        <li class="check-item status-${h(entry.status)}">
          <fieldset>
            <legend class="check-label">
              <span class="check-en">${h(item.en)}</span>
              <span class="check-hi" lang="hi">${h(item.hi)}</span>
            </legend>
            <p class="check-hint">${h(item.hint)}</p>
            <div class="segmented" role="radiogroup" aria-label="${h(item.en)} status for ${h(name)}">
              ${STATUSES.map(s => `
                <label class="seg seg-${s.key}">
                  <input type="radio" name="${groupName}" value="${s.key}" data-item="${item.key}" ${entry.status === s.key ? "checked" : ""}>
                  <span>${s.label}</span>
                </label>`).join("")}
            </div>
            <p class="check-meta">${entry.updatedAt ? "Updated " + h(fmtDate(entry.updatedAt)) + " · local demo record" : "Not yet updated"}</p>
          </fieldset>
        </li>`;
    }).join("");

    const counts = { pending: 0, progress: 0, verified: 0 };
    CHECKLIST_ITEMS.forEach(item => { counts[(state[item.key] || {}).status || "pending"]++; });
    $("checklistSummary").innerHTML =
      `<strong>${h(name)}</strong>: ${counts.verified} of ${CHECKLIST_ITEMS.length} verified · ${counts.progress} in progress · ${counts.pending} pending ` +
      `<span class="demo-chip">Local demo · self-reported</span>`;
  }

  function onChecklistChange(e) {
    const input = e.target;
    if (!input.matches('input[type="radio"][data-item]')) return;
    const id = $("checklistGhat").value;
    if (!id) return;
    readiness[id] = readiness[id] || {};
    readiness[id][input.dataset.item] = { status: input.value, updatedAt: new Date().toISOString() };
    save(STORE_KEYS.readiness, readiness);
    const focusedKey = input.dataset.item;
    renderChecklist();
    const again = document.querySelector(`input[data-item="${focusedKey}"][value="${input.value}"]`);
    if (again) again.focus();
  }

  function resetChecklist() {
    const id = $("checklistGhat").value;
    if (!id || !readiness[id]) return;
    if (!window.confirm(`Reset all checklist items for ${ghatName(id)} to Pending?`)) return;
    delete readiness[id];
    save(STORE_KEYS.readiness, readiness);
    renderChecklist();
  }

  // ---------- Add / edit / delete ghats ----------
  function setError(fieldId, msg) {
    const input = $(fieldId);
    const err = $(fieldId + "Err");
    if (err) err.textContent = msg || "";
    if (input) {
      if (msg) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
    return !msg;
  }

  function findDuplicate(name, excludeId) {
    const norm = normalise(name);
    if (!norm) return null;
    const hist = historicalAliases().find(a => a.norm === norm);
    if (hist) return `“${hist.label}” is already in the historical dataset.`;
    const dup = addedGhats.find(g => g.id !== excludeId && normalise(g.name) === norm);
    if (dup) return `“${dup.name}” has already been added.`;
    return null;
  }

  function validateGhatForm() {
    const editId = $("ghatEditId").value || null;
    const name = $("ghatName").value.trim().replace(/\s+/g, " ");
    const water = $("ghatWater").value;
    const footfallRaw = $("ghatFootfall").value.trim();
    let ok = true;

    if (name.length < 3) ok = setError("ghatName", "Enter a ghat name of at least 3 characters.") && ok;
    else if (name.length > 80) ok = setError("ghatName", "Keep the name under 80 characters.") && ok;
    else if (!/[A-Za-zऀ-ॿ]/.test(name)) ok = setError("ghatName", "The name must contain letters.") && ok;
    else {
      const dup = findDuplicate(name, editId);
      ok = setError("ghatName", dup ? "Duplicate: " + dup : "") && ok;
    }

    ok = setError("ghatWater", water ? "" : "Choose a water body.") && ok;

    if (footfallRaw !== "") {
      const n = Number(footfallRaw);
      const bad = !Number.isInteger(n) || n < 0 || n > 1000000;
      ok = setError("ghatFootfall", bad ? "Enter a whole number between 0 and 1,000,000." : "") && ok;
    } else {
      setError("ghatFootfall", "");
    }

    return ok ? {
      name,
      water,
      area: $("ghatArea").value.trim().slice(0, 80),
      footfall: footfallRaw === "" ? null : Number(footfallRaw),
      notes: $("ghatNotes").value.trim().slice(0, 300)
    } : null;
  }

  function resetGhatForm() {
    $("ghatForm").reset();
    $("ghatEditId").value = "";
    $("ghatSubmit").textContent = "Add ghat";
    $("ghatCancel").hidden = true;
    ["ghatName", "ghatWater", "ghatFootfall"].forEach(f => setError(f, ""));
  }

  function onGhatSubmit(e) {
    e.preventDefault();
    const status = $("ghatStatus");
    const values = validateGhatForm();
    if (!values) {
      status.textContent = "Please fix the highlighted fields.";
      status.className = "form-status is-error";
      const firstBad = $("ghatForm").querySelector('[aria-invalid="true"]');
      if (firstBad) firstBad.focus();
      return;
    }
    const editId = $("ghatEditId").value;
    const now = new Date().toISOString();
    if (editId) {
      const g = addedGhats.find(x => x.id === editId);
      if (g) Object.assign(g, values, { updatedAt: now });
      status.textContent = `Saved changes to “${values.name}”.`;
    } else {
      addedGhats.push(Object.assign({ id: newId(), createdAt: now, updatedAt: now }, values));
      status.textContent = `Added “${values.name}” (local demo record, no water-quality data).`;
    }
    status.className = "form-status is-ok";
    save(STORE_KEYS.ghats, addedGhats);
    resetGhatForm();
    refreshGhatViews();
  }

  function startEdit(id) {
    const g = addedGhats.find(x => x.id === id);
    if (!g) return;
    $("ghatEditId").value = g.id;
    $("ghatName").value = g.name;
    $("ghatWater").value = g.water;
    $("ghatArea").value = g.area || "";
    $("ghatFootfall").value = g.footfall ?? "";
    $("ghatNotes").value = g.notes || "";
    $("ghatSubmit").textContent = "Save changes";
    $("ghatCancel").hidden = false;
    $("ghatStatus").textContent = `Editing “${g.name}”.`;
    $("ghatStatus").className = "form-status";
    $("ghatName").focus();
  }

  function deleteGhat(id) {
    const g = addedGhats.find(x => x.id === id);
    if (!g) return;
    if (!window.confirm(`Delete “${g.name}” and its readiness checklist from this browser?`)) return;
    addedGhats = addedGhats.filter(x => x.id !== id);
    delete readiness["a:" + id];
    save(STORE_KEYS.ghats, addedGhats);
    save(STORE_KEYS.readiness, readiness);
    if ($("ghatEditId").value === id) resetGhatForm();
    $("ghatStatus").textContent = `Deleted “${g.name}”.`;
    $("ghatStatus").className = "form-status is-ok";
    refreshGhatViews();
  }

  function renderGhatList() {
    const list = $("ghatList");
    if (!addedGhats.length) {
      list.innerHTML = `<li class="empty-note">No ghats added yet. The seven historical ghats are listed in the ranking above.</li>`;
      return;
    }
    list.innerHTML = addedGhats.map(g => `
      <li class="record">
        <div class="record-main">
          <strong class="record-title">${h(g.name)}</strong>
          <span class="record-meta">${h(g.water)}${g.area ? " · " + h(g.area) : ""}${g.footfall !== null && g.footfall !== undefined ? " · ~" + Number(g.footfall).toLocaleString("en-IN") + " people expected" : ""}</span>
          ${g.notes ? `<span class="record-notes">${h(g.notes)}</span>` : ""}
          <span class="record-chips">
            <span class="demo-chip">Local demo</span>
            <span class="nodata-chip">No water-quality data · not ranked</span>
          </span>
        </div>
        <div class="record-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-edit="${h(g.id)}" aria-label="Edit ${h(g.name)}">Edit</button>
          <button class="btn btn-ghost btn-sm btn-danger" type="button" data-delete="${h(g.id)}" aria-label="Delete ${h(g.name)}">Delete</button>
        </div>
      </li>`).join("");
  }

  // ---------- Incident log ----------
  function toLocalInputValue(d) {
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function validateIncident() {
    let ok = true;
    const ghat = $("incGhat").value;
    const type = $("incType").value;
    const timeRaw = $("incTime").value;
    const desc = $("incDesc").value.trim();
    const contactRaw = $("incContact").value.trim();

    ok = setError("incGhat", ghat ? "" : "Choose the ghat.") && ok;
    ok = setError("incType", type ? "" : "Choose the incident type.") && ok;

    const t = timeRaw ? new Date(timeRaw) : null;
    if (!t || isNaN(t)) ok = setError("incTime", "Enter when you observed it.") && ok;
    else if (t.getTime() > Date.now() + 5 * 60 * 1000) ok = setError("incTime", "The time cannot be in the future.") && ok;
    else setError("incTime", "");

    if (desc.length < 10) ok = setError("incDesc", "Describe what happened in at least 10 characters.") && ok;
    else if (desc.length > 500) ok = setError("incDesc", "Keep the description under 500 characters.") && ok;
    else setError("incDesc", "");

    let contact = "";
    if (contactRaw) {
      const digits = contactRaw.replace(/[\s-]/g, "").replace(/^(\+91|0091|0)/, "");
      if (!/^[6-9]\d{9}$/.test(digits)) ok = setError("incContact", "Enter a 10-digit Indian mobile number, or leave it blank.") && ok;
      else { contact = digits; setError("incContact", ""); }
    } else {
      setError("incContact", "");
    }

    return ok ? { ghatId: ghat, ghatName: ghatName(ghat), type, observedAt: t.toISOString(), desc, contact } : null;
  }

  function onIncidentSubmit(e) {
    e.preventDefault();
    const status = $("incStatus");
    const values = validateIncident();
    if (!values) {
      status.textContent = "Please fix the highlighted fields.";
      status.className = "form-status is-error";
      const firstBad = $("incidentForm").querySelector('[aria-invalid="true"]');
      if (firstBad) firstBad.focus();
      return;
    }
    incidents.unshift(Object.assign({ id: newId(), loggedAt: new Date().toISOString() }, values));
    save(STORE_KEYS.incidents, incidents);
    $("incidentForm").reset();
    $("incTime").value = toLocalInputValue(new Date());
    fillGhatSelect($("incGhat"), { placeholder: "Select…" });
    status.textContent = "Saved to this browser only. It has NOT been sent to any authority. For an emergency, call 112.";
    status.className = "form-status is-ok";
    renderIncidents();
  }

  function deleteIncident(id) {
    const inc = incidents.find(x => x.id === id);
    if (!inc) return;
    if (!window.confirm("Delete this incident from the local log?")) return;
    incidents = incidents.filter(x => x.id !== id);
    save(STORE_KEYS.incidents, incidents);
    renderIncidents();
  }

  function renderIncidents() {
    const list = $("incidentList");
    if (!incidents.length) {
      list.innerHTML = `<li class="empty-note">No incidents logged in this browser.</li>`;
      return;
    }
    list.innerHTML = incidents.map(i => `
      <li class="record">
        <div class="record-main">
          <strong class="record-title">${h(i.type)}: ${h(i.ghatName || "Unknown ghat")}</strong>
          <span class="record-meta">Observed ${h(fmtDate(i.observedAt))}${i.contact ? " · contact on file" : ""}</span>
          <span class="record-notes">${h(i.desc)}</span>
          <span class="record-chips"><span class="demo-chip">Local only · not sent</span></span>
        </div>
        <div class="record-actions">
          <button class="btn btn-ghost btn-sm btn-danger" type="button" data-delete-incident="${h(i.id)}" aria-label="Delete incident: ${h(i.type)}">Delete</button>
        </div>
      </li>`).join("");
  }

  // ---------- Resource directory ----------
  function renderResources() {
    $("resourceGrid").innerHTML = RESOURCE_DIRECTORY.map(cat => `
      <li class="resource-card">
        <h4 class="resource-title">${h(cat.en)} <span lang="hi">${h(cat.hi)}</span></h4>
        ${cat.entries.length
          ? `<ul>${cat.entries.map(e => `<li>${h(e.name)}: <a href="tel:${h(e.tel)}">${h(e.tel)}</a> <a href="${h(e.source)}" target="_blank" rel="noopener">source</a></li>`).join("")}</ul>`
          : `<p class="empty-note">No verified entries yet. Entries will appear only once BMC or the district administration publishes them with a source.</p>`}
      </li>`).join("");
  }

  // ---------- Wiring ----------
  function refreshGhatViews() {
    renderGhatList();
    fillGhatSelect($("checklistGhat"));
    fillGhatSelect($("incGhat"), { placeholder: "Select…" });
    renderChecklist();
    renderIncidents();
  }

  function init() {
    if (!$("chhath")) return;
    updateStorageStatus();

    fillGhatSelect($("checklistGhat"));
    fillGhatSelect($("incGhat"), { placeholder: "Select…" });
    $("incTime").value = toLocalInputValue(new Date());

    $("checklistGhat").addEventListener("change", renderChecklist);
    $("checklistList").addEventListener("change", onChecklistChange);
    $("checklistReset").addEventListener("click", resetChecklist);

    $("ghatForm").addEventListener("submit", onGhatSubmit);
    $("ghatCancel").addEventListener("click", () => {
      resetGhatForm();
      $("ghatStatus").textContent = "Edit cancelled.";
      $("ghatStatus").className = "form-status";
    });
    $("ghatList").addEventListener("click", e => {
      const edit = e.target.closest("[data-edit]");
      const del = e.target.closest("[data-delete]");
      if (edit) startEdit(edit.dataset.edit);
      if (del) deleteGhat(del.dataset.delete);
    });

    $("incidentForm").addEventListener("submit", onIncidentSubmit);
    $("incidentList").addEventListener("click", e => {
      const del = e.target.closest("[data-delete-incident]");
      if (del) deleteIncident(del.dataset.deleteIncident);
    });

    renderGhatList();
    renderChecklist();
    renderIncidents();
    renderResources();
  }

  // Exposed for automated checks only
  window.JalDrishtiOps = { normalise, findDuplicate, STORE_KEYS, CHECKLIST_ITEMS };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

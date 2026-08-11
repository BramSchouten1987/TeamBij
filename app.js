// ---------------------------------------------------------------------------
// Holiday 2026 app — core logic
// ---------------------------------------------------------------------------

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const appEl = () => $("#app");

// ---------- date helpers ----------
function toDate(str) { return new Date(str + "T00:00:00"); }
function fmtISO(d) { return d.toISOString().slice(0, 10); }
function addDays(dateStr, n) {
  const d = toDate(dateStr);
  d.setDate(d.getDate() + n);
  return fmtISO(d);
}
function allTripDays() {
  const days = [];
  let cur = TRIP.start;
  while (cur < TRIP.end) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}
function stayForDay(dateStr) {
  return STAYS.find((s) => dateStr >= s.checkIn && dateStr < s.checkOut);
}
function dow(dateStr) {
  return toDate(dateStr).toLocaleDateString(undefined, { weekday: "short" });
}
function dom(dateStr) {
  return toDate(dateStr).getDate();
}
function prettyDate(dateStr) {
  return toDate(dateStr).toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long",
  });
}

// ---------------------------------------------------------------------------
// Local state / persistence
// ---------------------------------------------------------------------------

const LS_KEYS = {
  days: "holiday26_days",       // { [date]: { answers, chosenId, note, updatedAt, updatedBy } }
  profile: "holiday26_profile", // { name }
  supa: "holiday26_supabase",   // { url, key }
};

function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function writeLS(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

let dayState = readLS(LS_KEYS.days, {});
let profile = readLS(LS_KEYS.profile, { name: "" });
let supaConfig = readLS(LS_KEYS.supa, null);

// ---------------------------------------------------------------------------
// Sync layer — Supabase if configured, always mirrored to localStorage
// ---------------------------------------------------------------------------

let supaClient = null;
let supaChannel = null;

function isConnected() { return !!supaClient; }

function initSupabase() {
  if (!supaConfig || !supaConfig.url || !supaConfig.key) return;
  try {
    supaClient = window.supabase.createClient(supaConfig.url, supaConfig.key);
    subscribeRealtime();
    pullAllFromSupabase();
  } catch (e) {
    console.error("Supabase init failed", e);
    supaClient = null;
  }
}

async function pullAllFromSupabase() {
  if (!supaClient) return;
  const { data, error } = await supaClient.from("itinerary_days").select("*");
  if (error) { console.error(error); return; }
  data.forEach((row) => {
    dayState[row.date] = {
      answers: row.answers || {},
      chosenId: row.chosen_id || null,
      note: row.note || "",
      updatedAt: row.updated_at,
      updatedBy: row.updated_by || "",
    };
  });
  writeLS(LS_KEYS.days, dayState);
  renderRoute();
  updateSyncPill();
}

function subscribeRealtime() {
  if (!supaClient) return;
  supaChannel = supaClient
    .channel("itinerary-days-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "itinerary_days" }, (payload) => {
      const row = payload.new;
      if (!row) return;
      dayState[row.date] = {
        answers: row.answers || {},
        chosenId: row.chosen_id || null,
        note: row.note || "",
        updatedAt: row.updated_at,
        updatedBy: row.updated_by || "",
      };
      writeLS(LS_KEYS.days, dayState);
      renderRoute();
    })
    .subscribe((status) => { updateSyncPill(status); });
}

async function saveDay(date, patch) {
  const prev = dayState[date] || { answers: {}, chosenId: null, note: "" };
  const next = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy: profile.name || "Someone",
  };
  dayState[date] = next;
  writeLS(LS_KEYS.days, dayState);

  if (supaClient) {
    const { error } = await supaClient.from("itinerary_days").upsert({
      date,
      answers: next.answers,
      chosen_id: next.chosenId,
      note: next.note,
      updated_by: next.updatedBy,
      updated_at: next.updatedAt,
    });
    if (error) {
      console.error(error);
      toast("Saved on this device only — sync failed");
    }
  }
}

function updateSyncPill(status) {
  const pill = $("#syncPill");
  if (!pill) return;
  if (isConnected()) {
    pill.classList.add("on");
    pill.innerHTML = `<span class="dot"></span> Synced with ${profile.name ? "partner" : "trip"}`;
  } else {
    pill.classList.remove("on");
    pill.innerHTML = `<span class="dot"></span> This device only — connect in Settings`;
  }
}

// ---------------------------------------------------------------------------
// Recommendation engine
// ---------------------------------------------------------------------------

function scoreOption(opt, answers) {
  if (answers.toddler === true && !opt.toddler) return -Infinity;
  let score = 0;
  if (answers.mood && opt.category === answers.mood) score += 3;
  if (answers.energy && opt.effort === answers.energy) score += 2;
  if (answers.weather) {
    if (opt.weather === answers.weather) score += 2;
    else if (opt.weather === "any") score += 1;
  }
  return score;
}

function topChoicesFor(region, answers, n = 3) {
  const pool = OPTIONS[region] || [];
  return pool
    .map((o) => ({ ...o, _score: scoreOption(o, answers) }))
    .filter((o) => o._score > -Infinity)
    .sort((a, b) => b._score - a._score)
    .slice(0, n);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/").filter(Boolean);
  if (parts[0] === "day" && parts[1]) return { view: "day", date: parts[1] };
  if (parts[0] === "settings") return { view: "settings" };
  return { view: "home" };
}

function renderRoute() {
  const r = route();
  if (r.view === "day") renderDay(r.date);
  else if (r.view === "settings") renderSettings();
  else renderHome();
}

window.addEventListener("hashchange", renderRoute);

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

function shell(title, backHref, bodyHtml) {
  appEl().innerHTML = `
    <header class="topbar">
      ${backHref ? `<a class="icon-btn" href="#${backHref}">←</a>` : `<span style="width:38px"></span>`}
      <h1>${title}</h1>
      <a class="icon-btn" href="#/settings">⚙︎</a>
    </header>
    <div class="sync-pill" id="syncPill"><span class="dot"></span> …</div>
    <main>${bodyHtml}</main>
  `;
  updateSyncPill();
}

function renderHome() {
  const days = allTripDays();
  let html = "";
  let lastStayId = null;

  days.forEach((date) => {
    const stay = stayForDay(date);
    if (!stay) return;
    if (stay.id !== lastStayId) {
      if (lastStayId !== null) html += `</div>`; // close previous group
      html += `
        <div class="stay-group">
          <div class="stay-head">
            <div>
              <h2>${stay.name}</h2>
              <div class="place">${stay.place}</div>
            </div>
            ${!stay.confirmed ? `<span class="badge unconfirmed">not booked</span>` : ""}
          </div>
      `;
      lastStayId = stay.id;
    }

    const rec = dayState[date];
    const isTravel = stay.region === "travel";
    let chosenTitle = "Tap to plan this day";
    let sub = isTravel ? "Travel day" : "No plan yet";

    if (rec && rec.chosenId) {
      const pool = OPTIONS[stay.region] || [];
      const opt = pool.find((o) => o.id === rec.chosenId);
      if (opt) {
        chosenTitle = opt.title;
        sub = rec.updatedBy ? `Chosen by ${rec.updatedBy}` : "Chosen";
      }
    }

    html += `
      <div class="day-card" onclick="location.hash='#/day/${date}'">
        <div class="date-block">
          <div class="dow">${dow(date)}</div>
          <div class="dom">${dom(date)}</div>
        </div>
        <div class="mid">
          <div class="chosen">${chosenTitle}</div>
          <div class="sub">${isTravel ? '<span class="travel-tag">✈ Travel day</span> · ' : ""}${sub}</div>
        </div>
        <div class="chevron">›</div>
      </div>
    `;
  });
  if (lastStayId !== null) html += `</div>`;

  shell(TRIP.name, null, html || `<div class="empty-hint">No days in range.</div>`);
}

function renderDay(date) {
  const stay = stayForDay(date);
  if (!stay) { shell("Not found", "/", `<div class="empty-hint">That day isn't in the trip.</div>`); return; }

  if (stay.region === "travel") {
    renderTravelDay(date, stay);
    return;
  }

  const state = dayState[date] || { answers: {}, chosenId: null, note: "" };
  const pool = OPTIONS[stay.region] || [];
  const chosen = state.chosenId ? pool.find((o) => o.id === state.chosenId) : null;

  let body = `<div class="section-title">${stay.place}</div>`;

  if (chosen) {
    body += `
      <div class="chosen-banner">
        <div class="label">Today's plan</div>
        <h3>${chosen.title}</h3>
        <p>${chosen.desc}</p>
        <div class="meta">${state.updatedBy ? `Chosen by ${state.updatedBy} · ` : ""}${new Date(state.updatedAt).toLocaleString()}</div>
      </div>
      <button class="btn secondary" id="rePlanBtn">Re-answer the questions</button>
      ${notesBlock(date, state)}
    `;
    shell(prettyDate(date), "/", body);
    $("#rePlanBtn").onclick = () => { saveDay(date, { chosenId: null }).then(() => renderDay(date)); };
    wireNotes(date);
    return;
  }

  // question flow
  const answers = state.answers || {};
  QUESTIONS.forEach((q) => {
    body += `
      <div class="q-block" data-q="${q.id}">
        <div class="q-text">${q.text}</div>
        <div class="choices">
          ${q.choices.map((c) => `
            <button class="choice-btn ${answers[q.id] === c.value ? "selected" : ""}" data-value="${String(c.value)}">${c.label}</button>
          `).join("")}
        </div>
      </div>
    `;
  });
  body += `<button class="btn" id="revealBtn">Show top choices</button>`;

  shell(prettyDate(date), "/", body);

  $$(".q-block").forEach((block) => {
    const qid = block.dataset.q;
    $$(".choice-btn", block).forEach((btn) => {
      btn.onclick = () => {
        $$(".choice-btn", block).forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        let val = btn.dataset.value;
        if (val === "true") val = true;
        if (val === "false") val = false;
        answers[qid] = val;
        saveDay(date, { answers });
      };
    });
  });

  $("#revealBtn").onclick = () => {
    const missing = QUESTIONS.filter((q) => answers[q.id] === undefined);
    if (missing.length) { toast(`Answer "${missing[0].text}" first`); return; }
    renderChoices(date, stay, answers);
  };
}

function renderChoices(date, stay, answers) {
  const top = topChoicesFor(stay.region, answers, 3);
  let body = `<div class="section-title">Top choices for ${prettyDate(date)}</div>`;

  if (!top.length) {
    body += `<div class="empty-hint">Nothing matches all your answers — try "flexible" on toddler-friendly or a different mood.</div>
      <button class="btn secondary" id="backToQ">← Adjust answers</button>`;
  } else {
    top.forEach((opt, i) => {
      body += `
        <div class="option-card ${i === 0 ? "top" : ""}">
          <div class="rank">${i === 0 ? "★ Top pick" : `#${i + 1}`}</div>
          <h3>${opt.title}</h3>
          <p>${opt.desc}</p>
          <div class="tags">
            <span class="tag-chip">${opt.category}</span>
            <span class="tag-chip">${opt.effort} effort</span>
            <span class="tag-chip">${opt.toddler ? "toddler-ok" : "adults-friendlier"}</span>
          </div>
          <button class="btn small choose-btn" data-id="${opt.id}">Pick this</button>
        </div>
      `;
    });
    body += `<button class="btn secondary" id="backToQ">← Adjust answers</button>`;
  }

  shell(prettyDate(date), "/", body);
  $("#backToQ").onclick = () => renderDay(date);
  $$(".choose-btn").forEach((btn) => {
    btn.onclick = () => {
      saveDay(date, { chosenId: btn.dataset.id }).then(() => renderDay(date));
    };
  });
}

function renderTravelDay(date, stay) {
  const state = dayState[date] || { answers: {}, chosenId: null, note: "" };
  const chosen = state.chosenId ? OPTIONS.travel.find((o) => o.id === state.chosenId) : null;

  let body = `
    <div class="section-title">Travel day</div>
    <div class="stopover-card">
      <p>${stay.notes}</p>
    </div>
    <div class="section-title">Suggested overnight stop</div>
  `;
  OPTIONS.travel.forEach((opt) => {
    const picked = state.chosenId === opt.id;
    body += `
      <div class="stopover-card" style="${picked ? "border-color:var(--accent)" : ""}">
        <h3>${opt.title} ${picked ? "✓" : ""}</h3>
        <p>${opt.desc}</p>
        <button class="btn small choose-btn" data-id="${opt.id}" style="margin-top:8px;">${picked ? "Selected" : "Pick this"}</button>
      </div>
    `;
  });
  body += notesBlock(date, state);

  shell(prettyDate(date), "/", body);
  $$(".choose-btn").forEach((btn) => {
    btn.onclick = () => saveDay(date, { chosenId: btn.dataset.id }).then(() => renderTravelDay(date, stay));
  });
  wireNotes(date);
}

function notesBlock(date, state) {
  return `
    <div class="section-title">Notes</div>
    <textarea class="notes-field" id="notesField" placeholder="Booking refs, ideas, reminders…">${state.note || ""}</textarea>
  `;
}
function wireNotes(date) {
  const field = $("#notesField");
  if (!field) return;
  let t;
  field.oninput = () => {
    clearTimeout(t);
    t = setTimeout(() => saveDay(date, { note: field.value }), 500);
  };
}

function renderSettings() {
  const body = `
    <div class="section-title">Your name</div>
    <div class="field">
      <label>Shown next to choices you make</label>
      <input id="nameField" type="text" value="${profile.name || ""}" placeholder="Bram" />
    </div>

    <div class="section-title">Shared trip sync</div>
    <p style="font-size:13px;color:var(--text-dim);margin-top:-6px;">
      Connect a free Supabase project so you and your partner see the same plan live.
      ${isConnected() ? "Currently connected." : "Not connected yet — everything is saved on this device only."}
    </p>
    <div class="field">
      <label>Supabase Project URL</label>
      <input id="supaUrl" type="text" value="${supaConfig?.url || ""}" placeholder="https://xxxx.supabase.co" />
    </div>
    <div class="field">
      <label>Supabase anon public key</label>
      <input id="supaKey" type="text" value="${supaConfig?.key || ""}" placeholder="eyJhbGciOi..." />
    </div>
    <button class="btn" id="connectBtn">Save & connect</button>
    ${isConnected() ? `<button class="btn secondary" id="shareBtn" style="margin-top:10px;">Copy share link for partner</button>` : ""}

    <div class="section-title">About this trip</div>
    ${STAYS.map((s) => `
      <div class="stopover-card">
        <h3>${s.name} ${!s.confirmed ? '<span class="badge unconfirmed">not booked</span>' : ""}</h3>
        <p>${s.place}<br>${s.checkIn} → ${s.checkOut}<br>${s.notes || ""}</p>
      </div>
    `).join("")}
  `;
  shell("Settings", "/", body);

  $("#connectBtn").onclick = () => {
    const url = $("#supaUrl").value.trim();
    const key = $("#supaKey").value.trim();
    profile.name = $("#nameField").value.trim();
    writeLS(LS_KEYS.profile, profile);
    if (url && key) {
      supaConfig = { url, key };
      writeLS(LS_KEYS.supa, supaConfig);
      initSupabase();
      toast("Connected");
    } else {
      writeLS(LS_KEYS.profile, profile);
      toast("Name saved");
    }
    renderSettings();
  };

  const shareBtn = $("#shareBtn");
  if (shareBtn) {
    shareBtn.onclick = () => {
      const payload = btoa(JSON.stringify(supaConfig));
      const link = `${location.origin}${location.pathname}#/settings?c=${payload}`;
      navigator.clipboard?.writeText(link);
      toast("Link copied — send it to your partner");
    };
  }
}

// auto-import shared config from a link like #/settings?c=BASE64
function maybeImportSharedConfig() {
  const hash = location.hash;
  const m = hash.match(/\?c=([A-Za-z0-9+/=]+)/);
  if (!m) return;
  try {
    const cfg = JSON.parse(atob(decodeURIComponent(m[1])));
    if (cfg.url && cfg.key) {
      supaConfig = cfg;
      writeLS(LS_KEYS.supa, supaConfig);
      initSupabase();
      toast("Connected to shared trip!");
    }
  } catch (e) { console.error(e); }
  history.replaceState(null, "", location.pathname + "#/settings");
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

let toastTimer;
function toast(msg) {
  let el = $(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = "none"; }, 2200);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot() {
  maybeImportSharedConfig();
  if (supaConfig) initSupabase();
  renderRoute();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

boot();

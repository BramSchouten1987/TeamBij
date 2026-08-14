// ---------------------------------------------------------------------------
// Holiday 2026 app — core logic
// ---------------------------------------------------------------------------

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const appEl = () => $("#app");

// ---------- date helpers ----------
// Trip days are calendar dates with no time-of-day meaning, so every helper
// here operates in UTC to stay consistent regardless of the browser's local
// timezone (mixing local-time parsing with UTC-based formatting previously
// made addDays() a no-op — and any loop walking trip days infinite — for
// anyone in a timezone ahead of UTC).
function toDate(str) { return new Date(str + "T00:00:00Z"); }
function fmtISO(d) { return d.toISOString().slice(0, 10); }
function addDays(dateStr, n) {
  const d = toDate(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return fmtISO(d);
}
function stayForDay(dateStr) {
  return STAYS.find((s) => dateStr >= s.checkIn && dateStr < s.checkOut);
}
function prettyDate(dateStr) {
  return toDate(dateStr).toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
}
function shortDate(dateStr) {
  return toDate(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}
// "Today" as the device's own local calendar date — deliberately NOT run
// through the UTC helpers above, which are for trip-day arithmetic only.
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Local state / persistence
// ---------------------------------------------------------------------------

const LS_KEYS = {
  days: "holiday26_days",       // { [date]: { answers, chosenId, note, updatedAt, updatedBy } }
  profile: "holiday26_profile", // { name }
  supa: "holiday26_supabase",   // { url, key }
  gmaps: "holiday26_gmaps",     // API key string
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

// Restricted to https://bramschouten1987.github.io/* in Google Cloud Console —
// safe to ship in client-side code, same as any Google Maps embed key.
const DEFAULT_GMAPS_KEY = "AIzaSyB2B1zTXE6_MkYWgqaNVeA1_JI-atH4JMU";
let gmapsKey = readLS(LS_KEYS.gmaps, "") || DEFAULT_GMAPS_KEY;

// ---------------------------------------------------------------------------
// Sync layer — Supabase if configured, always mirrored to localStorage
// ---------------------------------------------------------------------------

let supaClient = null;
let supaChannel = null;

function isConnected() { return !!supaClient; }

let supabaseLibPromise = null;
function loadSupabaseLib() {
  if (window.supabase) return Promise.resolve();
  if (supabaseLibPromise) return supabaseLibPromise;
  supabaseLibPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Supabase library timed out")), 8000);
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); reject(new Error("Supabase library failed to load")); };
    document.head.appendChild(script);
  });
  return supabaseLibPromise;
}

async function initSupabase() {
  if (!supaConfig || !supaConfig.url || !supaConfig.key) return;
  try {
    await loadSupabaseLib();
    supaClient = window.supabase.createClient(supaConfig.url, supaConfig.key);
    subscribeRealtime();
    pullAllFromSupabase();
  } catch (e) {
    console.error("Supabase init failed", e);
    supaClient = null;
    updateSyncPill();
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
// Maps links (work with zero setup — no API key required)
// ---------------------------------------------------------------------------

function mapsSearchUrl(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
function mapsDirectionsUrl(originQuery, destQuery) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originQuery)}&destination=${encodeURIComponent(destQuery)}&travelmode=driving`;
}
function placeLinksHtml(opt, originQuery) {
  if (!opt.mapsQuery) return "";
  const links = [
    `<a class="link-chip" href="${mapsSearchUrl(opt.mapsQuery)}" target="_blank" rel="noopener">📍 Google Maps</a>`,
  ];
  if (originQuery) {
    links.push(`<a class="link-chip" href="${mapsDirectionsUrl(originQuery, opt.mapsQuery)}" target="_blank" rel="noopener">🧭 Directions</a>`);
  }
  return `<div class="place-links" data-website-slot="${opt.id}">${links.join("")}</div>`;
}
function placeMetaHtml(opt) {
  if (!opt.mapsQuery) return "";
  return `<div class="place-meta" id="place-meta-${opt.id}"></div>`;
}
function photoGalleryHtml(opt) {
  if (!opt.mapsQuery) return "";
  return `<div class="photo-gallery" id="photos-${opt.id}"></div>`;
}

const EFFORT_LABELS = { low: "Relaxed", medium: "Medium", high: "Strenuous" };
function effortLabel(effort) { return EFFORT_LABELS[effort] || effort; }

const ACTIVITY_TYPE_BADGES = { hiking: "🥾 Hiking", biking: "🚴 Biking", swimming: "🏊 Swimming" };
function activityBadgeHtml(opt) {
  const label = ACTIVITY_TYPE_BADGES[opt.activityType];
  return label ? `<span class="activity-badge">${label}</span>` : "";
}
function distanceLineHtml(opt) {
  return opt.distanceLabel ? `<div class="distance-line">📏 ${opt.distanceLabel}</div>` : "";
}
const KID_FIT_LABELS = { easy: "kid-walkable", carrier: "carrier-ok", none: "adults only" };
function tagsHtml(opt) {
  return `
    <div class="tags">
      ${activityBadgeHtml(opt)}
      <span class="tag-chip">${opt.category}</span>
      <span class="tag-chip">${effortLabel(opt.effort)}</span>
      <span class="tag-chip ${opt.kidFit === "none" ? "adults-only" : ""}">${KID_FIT_LABELS[opt.kidFit] || opt.kidFit}</span>
    </div>
    ${distanceLineHtml(opt)}
  `;
}

// ---------------------------------------------------------------------------
// Live place data (rating, reviews, website, distance) — only runs if a
// Google Maps API key is configured in Settings. Everything above this
// (search/directions links) already works with zero setup.
// ---------------------------------------------------------------------------

const PLACE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — ratings don't need to be live-live

let gmapsLibPromise = null;
function loadGoogleMapsLib() {
  if (!gmapsKey) return Promise.reject(new Error("No Google Maps API key configured"));
  if (gmapsLibPromise) return gmapsLibPromise;
  gmapsLibPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Google Maps library timed out")), 10000);
    window.__onGmapsLoaded = () => { clearTimeout(timer); resolve(); };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(gmapsKey)}&v=weekly&loading=async&callback=__onGmapsLoaded`;
    script.async = true;
    script.onerror = () => { clearTimeout(timer); reject(new Error("Google Maps library failed to load")); };
    document.head.appendChild(script);
  });
  return gmapsLibPromise;
}

function readCache(key) { return readLS(key, {}); }
function cacheGet(cacheKey, entryKey, ttlMs = PLACE_CACHE_TTL_MS) {
  const entry = readCache(cacheKey)[entryKey];
  if (!entry || Date.now() - entry.fetchedAt > ttlMs) return undefined;
  return entry.data;
}
function cacheSet(cacheKey, entryKey, data) {
  const cache = readCache(cacheKey);
  cache[entryKey] = { data, fetchedAt: Date.now() };
  writeLS(cacheKey, cache);
}

async function resolvePlace(query) {
  const cached = cacheGet("holiday26_place_cache", query);
  if (cached !== undefined) return cached;

  await loadGoogleMapsLib();
  const { Place } = await google.maps.importLibrary("places");
  const { places } = await Place.searchByText({
    textQuery: query,
    fields: ["rating", "userRatingCount", "googleMapsURI", "websiteURI", "location", "photos"],
    maxResultCount: 1,
  });
  const place = places && places[0];
  const data = place ? {
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    googleMapsURI: place.googleMapsURI || null,
    websiteURI: place.websiteURI || null,
    lat: place.location ? place.location.lat() : null,
    lng: place.location ? place.location.lng() : null,
    photoURIs: (place.photos || []).slice(0, 6).map((p) => p.getURI({ maxWidth: 640 })),
  } : null;

  cacheSet("holiday26_place_cache", query, data);
  return data;
}

async function getDistance(originAddress, destLat, destLng) {
  const entryKey = `${originAddress}|${destLat},${destLng}`;
  const cached = cacheGet("holiday26_distance_cache", entryKey);
  if (cached !== undefined) return cached;

  await loadGoogleMapsLib();
  const { DistanceMatrixService } = await google.maps.importLibrary("routes");
  const service = new DistanceMatrixService();
  const response = await service.getDistanceMatrix({
    origins: [originAddress],
    destinations: [{ lat: destLat, lng: destLng }],
    travelMode: "DRIVING",
  });
  const el = response?.rows?.[0]?.elements?.[0];
  const data = (el && el.status === "OK")
    ? { distanceText: el.distance.text, distanceMeters: el.distance.value, durationText: el.duration.text }
    : null;

  cacheSet("holiday26_distance_cache", entryKey, data);
  return data;
}

// Fills in live rating/review-count/distance for the given options, once a
// Google Maps API key is configured. Silently does nothing otherwise —
// the static Maps/Directions links above already work without it.
async function enrichPlaceCards(options, originAddress) {
  if (!gmapsKey) return;
  for (const opt of options) {
    if (!opt.mapsQuery) continue;
    const metaEl = document.getElementById(`place-meta-${opt.id}`);
    if (!metaEl) continue;
    try {
      const place = await resolvePlace(opt.mapsQuery);
      if (!place) continue;

      const parts = [];
      if (place.rating != null) {
        parts.push(`<span class="stars">★ ${place.rating.toFixed(1)}</span>${place.userRatingCount != null ? ` (${place.userRatingCount.toLocaleString()})` : ""}`);
      }

      if (originAddress && place.lat != null && place.lng != null) {
        const dist = await getDistance(originAddress, place.lat, place.lng);
        if (dist) parts.push(`🚗 ${dist.distanceText} · ${dist.durationText}`);
      }

      if (parts.length) metaEl.innerHTML = parts.join(`<span class="sep">·</span>`);

      if (place.websiteURI) {
        const linksEl = document.querySelector(`[data-website-slot="${opt.id}"]`);
        if (linksEl && !linksEl.querySelector(".website-link")) {
          linksEl.insertAdjacentHTML("beforeend",
            `<a class="link-chip website-link" href="${place.websiteURI}" target="_blank" rel="noopener">🌐 Website</a>`);
        }
      }

      const galleryEl = document.getElementById(`photos-${opt.id}`);
      if (galleryEl && place.photoURIs && place.photoURIs.length) {
        galleryEl.innerHTML = place.photoURIs
          .map((uri) => `<img src="${uri}" alt="${opt.title}" loading="lazy" />`)
          .join("");
      }
    } catch (e) {
      console.error(`Place lookup failed for "${opt.mapsQuery}"`, e);
    }
  }
}

// ---------------------------------------------------------------------------
// Weather forecast (Open-Meteo — free, no API key, ~16 day horizon)
// ---------------------------------------------------------------------------

const WEATHER_ICONS = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌦️",
  56: "🌧️", 57: "🌧️",
  61: "🌧️", 63: "🌧️", 65: "🌧️",
  66: "🌧️", 67: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "🌨️", 77: "🌨️",
  80: "🌦️", 81: "🌦️", 82: "⛈️",
  85: "🌨️", 86: "🌨️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};
function weatherIcon(code) { return WEATHER_ICONS[code] || "🌡️"; }
const WEATHER_CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours — forecasts update through the day

// Returns { [isoDate]: { max, min, code } } for the ~16 days Open-Meteo covers,
// or null if the location can't be resolved / the request fails.
async function getForecast(lat, lon) {
  const entryKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = cacheGet("holiday26_weather_cache", entryKey, WEATHER_CACHE_TTL_MS);
  if (cached !== undefined) return cached;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=16`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API ${res.status}`);
    const json = await res.json();
    const byDate = {};
    json.daily.time.forEach((date, i) => {
      byDate[date] = {
        max: Math.round(json.daily.temperature_2m_max[i]),
        min: Math.round(json.daily.temperature_2m_min[i]),
        code: json.daily.weather_code[i],
      };
    });
    cacheSet("holiday26_weather_cache", entryKey, byDate);
    return byDate;
  } catch (e) {
    console.error("Weather fetch failed", e);
    return null;
  }
}

// Fills in a forecast chip per stay on the landing page, for whichever of its
// days fall within the ~16-day forecast horizon. Silently leaves the chip
// empty for stays too far out, or without a fixed address (the travel leg).
async function enrichStayWeather(stays) {
  if (!gmapsKey) return;
  for (const stay of stays) {
    const chipEl = document.getElementById(`weather-${stay.id}`);
    if (!chipEl || !stay.address) continue;
    try {
      const place = await resolvePlace(stay.address);
      if (!place || place.lat == null) continue;
      const forecast = await getForecast(place.lat, place.lng);
      if (!forecast) continue;

      let day = stay.checkIn;
      let hit = null;
      while (day < stay.checkOut) {
        if (forecast[day]) { hit = forecast[day]; break; }
        day = addDays(day, 1);
      }
      if (hit) {
        chipEl.innerHTML = `${weatherIcon(hit.code)} <span class="temp-high">${hit.max}°</span>/${hit.min}° <span class="wx-date">${shortDate(day)}</span>`;
      }
    } catch (e) {
      console.error(`Weather lookup failed for "${stay.address}"`, e);
    }
  }
}

// ---------------------------------------------------------------------------
// Recommendation engine
// ---------------------------------------------------------------------------

function scoreOption(opt, answers) {
  // Kids with you: hard-filter to what's actually suitable. Adults-only
  // (kidFit "none") is excluded whenever kids are along, and if the little
  // one is walking/biking themselves rather than riding in a carrier, only
  // "easy" (self-mobilizable) options qualify. No kids = everything's fair
  // game, including the adults-only/challenging stuff.
  if (answers.kids === true) {
    if (opt.kidFit === "none") return -Infinity;
    if (answers.kidsMobility === "walk" && opt.kidFit !== "easy") return -Infinity;
  }

  let score = 0;
  if (answers.mood && opt.category === answers.mood) score += 3;
  if (answers.activityType && answers.activityType !== "none" && opt.activityType === answers.activityType) score += 3;
  if (answers.energy && opt.effort === answers.energy) score += 2;
  if (answers.weather) {
    if (opt.weather === answers.weather) score += 2;
    else if (opt.weather === "any") score += 1;
  }
  return score;
}

function topChoicesFor(region, answers, n = 3, excludeIds = []) {
  const pool = OPTIONS[region] || [];
  return pool
    .filter((o) => !excludeIds.includes(o.id))
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
  const lastTripDay = addDays(TRIP.end, -1);

  const overviewHtml = STAYS.map((s) => `
    <div class="location-box" onclick="location.hash='#/day/${s.checkIn}'">
      <h3>${s.name}</h3>
      <div class="place">${s.place}</div>
      <div class="dates">${shortDate(s.checkIn)} – ${shortDate(s.checkOut)}</div>
      ${!s.confirmed ? `<span class="badge unconfirmed">not booked</span>` : ""}
      <div class="weather-chip" id="weather-${s.id}"></div>
    </div>
  `).join("");

  const today = todayISO();
  const tomorrow = addDays(today, 1);

  function quickActionHtml(id, icon, label, date) {
    const inRange = date >= TRIP.start && date < TRIP.end;
    const stay = inRange ? stayForDay(date) : null;
    const sub = stay ? stay.place
      : date < TRIP.start ? `Trip starts ${shortDate(TRIP.start)}`
      : "Trip's already over";
    return `
      <button class="quick-action-btn" id="${id}" ${inRange ? "" : "disabled"}>
        <span class="qa-icon">${icon}</span>
        <span class="qa-text">
          <span class="qa-label">${label}</span>
          <span class="qa-sub">${sub}</span>
        </span>
        <span class="qa-chevron">${inRange ? "›" : ""}</span>
      </button>
    `;
  }

  const body = `
    <div class="section-title">Your trip</div>
    <div class="overview-grid">${overviewHtml}</div>

    <div class="section-title">Quick plan</div>
    <div class="quick-actions">
      ${quickActionHtml("planTodayBtn", "☀️", "Plan for today", today)}
      ${quickActionHtml("planTomorrowBtn", "🌤️", "Plan for tomorrow", tomorrow)}
      <button class="quick-action-btn" id="planOtherBtn">
        <span class="qa-icon">🔀</span>
        <span class="qa-text"><span class="qa-label">Plan for another date</span></span>
        <span class="qa-chevron">›</span>
      </button>
    </div>
    <div class="date-picker-inline" id="otherDatePicker" style="display:none;">
      <input type="date" id="otherDateInput" min="${TRIP.start}" max="${lastTripDay}"
        value="${today >= TRIP.start && today <= lastTripDay ? today : TRIP.start}" />
      <button class="btn small" id="goToDateBtn">Go</button>
    </div>
  `;

  shell(TRIP.name, null, body);

  if (today >= TRIP.start && today < TRIP.end) {
    $("#planTodayBtn").onclick = () => { location.hash = `#/day/${today}`; };
  }
  if (tomorrow >= TRIP.start && tomorrow < TRIP.end) {
    $("#planTomorrowBtn").onclick = () => { location.hash = `#/day/${tomorrow}`; };
  }
  $("#planOtherBtn").onclick = () => {
    const picker = $("#otherDatePicker");
    picker.style.display = picker.style.display === "none" ? "flex" : "none";
  };
  $("#goToDateBtn").onclick = () => {
    const val = $("#otherDateInput").value;
    if (val) location.hash = `#/day/${val}`;
  };

  enrichStayWeather(STAYS.filter((s) => s.region !== "travel"));
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
        ${photoGalleryHtml(chosen)}
        ${placeMetaHtml(chosen)}
        ${placeLinksHtml(chosen, stay.address)}
        <div class="meta">${state.updatedBy ? `Chosen by ${state.updatedBy} · ` : ""}${new Date(state.updatedAt).toLocaleString()}</div>
      </div>
      <button class="btn secondary" id="rePlanBtn">Re-answer the questions</button>
      ${notesBlock(date, state)}
    `;
    shell(prettyDate(date), "/", body);
    $("#rePlanBtn").onclick = () => { saveDay(date, { chosenId: null }).then(() => renderDay(date)); };
    wireNotes(date);
    enrichPlaceCards([chosen], stay.address);
    return;
  }

  // question flow — some questions (kidsMobility) only appear once their
  // showIf condition is met, so a full re-render on every answer keeps the
  // visible set correct rather than trying to patch the DOM incrementally.
  const answers = state.answers || {};
  const visibleQuestions = QUESTIONS.filter((q) => !q.showIf || q.showIf(answers));
  visibleQuestions.forEach((q) => {
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
        let val = btn.dataset.value;
        if (val === "true") val = true;
        if (val === "false") val = false;
        answers[qid] = val;
        const scrollY = window.scrollY;
        saveDay(date, { answers }).then(() => {
          renderDay(date);
          window.scrollTo(0, scrollY);
        });
      };
    });
  });

  $("#revealBtn").onclick = () => {
    const missing = visibleQuestions.filter((q) => answers[q.id] === undefined);
    if (missing.length) { toast(`Answer "${missing[0].text}" first`); return; }
    renderChoices(date, stay, answers);
  };
}

function renderChoices(date, stay, answers, excludeIds = []) {
  const top = topChoicesFor(stay.region, answers, 3, excludeIds);
  const seenIds = excludeIds.concat(top.map((o) => o.id));
  const label = excludeIds.length ? "Other choices" : "Top choices";
  let body = `<div class="section-title">${label} for ${prettyDate(date)}</div>`;

  if (!top.length) {
    body += `<div class="empty-hint">${excludeIds.length ? "That's everything that fits your answers." : "Nothing matches all your answers — try a carrier instead of walking, or a different mood."}</div>
      <button class="btn secondary" id="backToQ">← Adjust answers</button>`;
  } else {
    top.forEach((opt, i) => {
      body += `
        <div class="option-card ${i === 0 && !excludeIds.length ? "top" : ""}">
          <div class="rank">${i === 0 && !excludeIds.length ? "★ Top pick" : `#${i + 1}`}</div>
          <h3>${opt.title}</h3>
          <p>${opt.desc}</p>
          ${photoGalleryHtml(opt)}
          ${tagsHtml(opt)}
          ${placeMetaHtml(opt)}
          ${placeLinksHtml(opt, stay.address)}
          <button class="btn small choose-btn" data-id="${opt.id}">Pick this</button>
        </div>
      `;
    });
    body += `
      <button class="btn secondary" id="refineBtn">None of these — refine ›</button>
      <button class="btn secondary" id="backToQ" style="margin-top:8px;">← Adjust answers</button>
    `;
  }

  shell(prettyDate(date), "/", body);
  $("#backToQ").onclick = () => renderDay(date);
  const refineBtn = $("#refineBtn");
  if (refineBtn) refineBtn.onclick = () => renderRefine(date, stay, answers, seenIds);
  $$(".choose-btn").forEach((btn) => {
    btn.onclick = () => {
      saveDay(date, { chosenId: btn.dataset.id }).then(() => renderDay(date));
    };
  });
  if (top.length) enrichPlaceCards(top, stay.address);
}

function renderRefine(date, stay, answers, excludeIds) {
  const body = `
    <div class="section-title">What's not working?</div>
    <button class="btn secondary refine-chip" data-refine="mood" style="margin-bottom:8px;">🎯 Different mood entirely</button>
    <button class="btn secondary refine-chip" data-refine="effort" style="margin-bottom:8px;">😴 Lower the effort</button>
    ${gmapsKey ? `<button class="btn secondary refine-chip" data-refine="distance" style="margin-bottom:8px;">📍 Whatever's closest to the stay</button>` : ""}
    <button class="btn secondary refine-chip" data-refine="more" style="margin-bottom:8px;">🔀 Just show me different ones</button>
    <button class="btn secondary" id="backToChoices" style="margin-top:8px;">← Back</button>
  `;
  shell(prettyDate(date), "/", body);
  $("#backToChoices").onclick = () => renderChoices(date, stay, answers, excludeIds);

  $$(".refine-chip").forEach((btn) => {
    btn.onclick = () => {
      const kind = btn.dataset.refine;
      if (kind === "effort") {
        answers.energy = "low";
        saveDay(date, { answers });
        renderChoices(date, stay, answers, excludeIds);
      } else if (kind === "mood") {
        renderMoodRefine(date, stay, answers, excludeIds);
      } else if (kind === "distance") {
        renderByDistance(date, stay, answers, excludeIds);
      } else {
        renderChoices(date, stay, answers, excludeIds);
      }
    };
  });
}

function renderMoodRefine(date, stay, answers, excludeIds) {
  const moodQ = QUESTIONS.find((q) => q.id === "mood");
  const body = `
    <div class="section-title">What are you in the mood for instead?</div>
    <div class="choices">
      ${moodQ.choices.map((c) => `
        <button class="choice-btn ${answers.mood === c.value ? "selected" : ""}" data-value="${c.value}">${c.label}</button>
      `).join("")}
    </div>
    <button class="btn secondary" id="backToRefine" style="margin-top:16px;">← Back</button>
  `;
  shell(prettyDate(date), "/", body);
  $("#backToRefine").onclick = () => renderRefine(date, stay, answers, excludeIds);
  $$(".choice-btn").forEach((btn) => {
    btn.onclick = () => {
      answers.mood = btn.dataset.value;
      saveDay(date, { answers });
      renderChoices(date, stay, answers, excludeIds);
    };
  });
}

async function renderByDistance(date, stay, answers, excludeIds) {
  shell(prettyDate(date), "/", `<div class="empty-hint">Finding what's closest…</div>`);

  const pool = (OPTIONS[stay.region] || []).filter(
    (o) => !excludeIds.includes(o.id) && scoreOption(o, answers) > -Infinity
  );

  const withDistance = await Promise.all(pool.map(async (opt) => {
    if (!opt.mapsQuery) return { ...opt, _distanceMeters: Infinity };
    try {
      const place = await resolvePlace(opt.mapsQuery);
      if (!place || place.lat == null) return { ...opt, _distanceMeters: Infinity };
      const dist = await getDistance(stay.address, place.lat, place.lng);
      return { ...opt, _distanceMeters: dist ? dist.distanceMeters : Infinity };
    } catch {
      return { ...opt, _distanceMeters: Infinity };
    }
  }));

  const top = withDistance.sort((a, b) => a._distanceMeters - b._distanceMeters).slice(0, 3);
  const seenIds = excludeIds.concat(top.map((o) => o.id));

  let body = `<div class="section-title">Closest to ${stay.name}</div>`;
  if (!top.length) {
    body += `<div class="empty-hint">Nothing left that fits your answers.</div>`;
  } else {
    top.forEach((opt, i) => {
      body += `
        <div class="option-card">
          <div class="rank">#${i + 1} closest</div>
          <h3>${opt.title}</h3>
          <p>${opt.desc}</p>
          ${photoGalleryHtml(opt)}
          ${tagsHtml(opt)}
          ${placeMetaHtml(opt)}
          ${placeLinksHtml(opt, stay.address)}
          <button class="btn small choose-btn" data-id="${opt.id}">Pick this</button>
        </div>
      `;
    });
  }
  body += `<button class="btn secondary" id="backToQ" style="margin-top:8px;">← Adjust answers</button>`;

  shell(prettyDate(date), "/", body);
  $("#backToQ").onclick = () => renderDay(date);
  $$(".choose-btn").forEach((btn) => {
    btn.onclick = () => {
      saveDay(date, { chosenId: btn.dataset.id }).then(() => renderDay(date));
    };
  });
  if (top.length) enrichPlaceCards(top, stay.address);
}

function renderTravelDay(date, stay) {
  const state = dayState[date] || { answers: {}, chosenId: null, note: "" };
  const chosen = state.chosenId ? OPTIONS.travel.find((o) => o.id === state.chosenId) : null;

  const fromStay = STAYS.find((s) => s.checkOut === stay.checkIn);

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
        ${placeMetaHtml(opt)}
        ${placeLinksHtml(opt, fromStay && fromStay.address)}
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
  enrichPlaceCards(OPTIONS.travel, fromStay && fromStay.address);
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

    <div class="section-title">Live Google ratings & travel time</div>
    <p style="font-size:13px;color:var(--text-dim);margin-top:-6px;">
      Star ratings, review counts, and drive time are on by default. Only
      touch this if you want to use your own Google Maps API key instead of
      the built-in one — see SETUP.md.
    </p>
    <div class="field">
      <label>Google Maps API key (optional override)</label>
      <input id="gmapsKeyField" type="text" value="${readLS(LS_KEYS.gmaps, "") || ""}" placeholder="AIza... (leave blank to use the default)" />
    </div>

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

    const gmapsOverride = $("#gmapsKeyField").value.trim();
    writeLS(LS_KEYS.gmaps, gmapsOverride);
    gmapsKey = gmapsOverride || DEFAULT_GMAPS_KEY;
    gmapsLibPromise = null; // force a reload if the key just changed

    if (url && key) {
      supaConfig = { url, key };
      writeLS(LS_KEYS.supa, supaConfig);
      initSupabase();
      toast("Connected");
    } else {
      writeLS(LS_KEYS.profile, profile);
      toast("Saved");
    }
    renderSettings();
  };

  const shareBtn = $("#shareBtn");
  if (shareBtn) {
    shareBtn.onclick = () => {
      const gmapsOverride = readLS(LS_KEYS.gmaps, "");
      const payload = btoa(JSON.stringify({ ...supaConfig, ...(gmapsOverride ? { gmapsKey: gmapsOverride } : {}) }));
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
      supaConfig = { url: cfg.url, key: cfg.key };
      writeLS(LS_KEYS.supa, supaConfig);
      initSupabase();
      toast("Connected to shared trip!");
    }
    if (cfg.gmapsKey) {
      gmapsKey = cfg.gmapsKey;
      writeLS(LS_KEYS.gmaps, gmapsKey);
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
    // When a newer service worker takes over (i.e. a fresh deploy landed),
    // reload once so the page picks up the new code immediately instead of
    // silently staying on the version that was loaded initially.
    let reloadedForUpdate = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadedForUpdate) return;
      reloadedForUpdate = true;
      location.reload();
    });
  }
}

boot();

const twitch = window.Twitch?.ext;

const statusEl = document.getElementById("status");
const emptyEl = document.getElementById("empty");
const listEl = document.getElementById("list");
const refreshBtn = document.getElementById("refreshBtn");

// === SETTINGS ===
const PROXY_BASE = "https://twitch-extensions.alittlepastnein.workers.dev/atc";
const AUTO_REFRESH_MS = 12 * 60 * 60 * 1000; // 12 hours
const CACHE_KEY = "vatsim_atc_cache_v2";

let currentCid = null;
let currentLimit = 5;

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { return null; }
}
function saveCache(obj) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(obj)); } catch {}
}
function cacheIsValid(cache) {
  return cache &&
    cache.cid === currentCid &&
    cache.limit === currentLimit &&
    typeof cache.ts === "number" &&
    (Date.now() - cache.ts) < AUTO_REFRESH_MS &&
    Array.isArray(cache.items);
}

async function fetchSessions(cid, limit) {
  const url = `${PROXY_BASE}?cid=${encodeURIComponent(cid)}&limit=${limit}`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`Proxy HTTP ${r.status}`);
  return await r.json();
}

function render(items) {
  listEl.innerHTML = "";

  if (!items || items.length === 0) {
    emptyEl.classList.remove("hidden");
    emptyEl.textContent = "No recent ATC sessions found.";
    return;
  }
  emptyEl.classList.add("hidden");

  for (const it of items) {
    const c = it.connection_id || {};

    const callsign = c.callsign || "—";
    const dur = formatDuration(c.start, c.end);
    const date = formatDateDMY(c.start); // date of session start

    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div class="itemTop">
        <div class="callsign">${callsign}</div>
        <div class="metaInline">${dur} · ${date}</div>
      </div>
    `;
    listEl.appendChild(li);
  }
}

async function refresh({ force = false } = {}) {
  if (!currentCid) {
    setStatus("Not configured");
    emptyEl.classList.remove("hidden");
    emptyEl.textContent = "Configure a VATSIM CID in the extension settings.";
    listEl.innerHTML = "";
    return;
  }

  const cache = loadCache();
  if (!force && cacheIsValid(cache)) {
    setStatus("Last Updated: ${formatNowZ()}");
    render(cache.items);
    return;
  }

  setStatus("Fetching…");
  try {
    const data = await fetchSessions(currentCid, currentLimit);
    const items = Array.isArray(data?.items) ? data.items.slice(0, currentLimit) : [];

    saveCache({ ts: Date.now(), cid: currentCid, limit: currentLimit, items });

    render(items);
    setStatus("Last Updated: ${formatNowZ()}");
  } catch (e) {
    console.error("Fetch failed:", e);
    setStatus("Error");
    emptyEl.classList.remove("hidden");
    emptyEl.textContent = "Could not load sessions.";
    listEl.innerHTML = "";
  }
}

function onConfigChanged() {
  const content = twitch.configuration?.broadcaster?.content || "";
  const cfg = safeJsonParse(content, {});
  currentCid = cfg?.vatsimCid || null;
  currentLimit = Number(cfg?.limit) === 10 ? 10 : 5;
  refresh({ force: false });
}

twitch.onAuthorized(() => {
  twitch.configuration.onChanged(onConfigChanged);
  onConfigChanged(); // run once on load
  setInterval(() => refresh({ force: false }), AUTO_REFRESH_MS);
});

refreshBtn.addEventListener("click", () => refresh({ force: true }));


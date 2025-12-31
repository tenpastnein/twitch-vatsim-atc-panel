const twitch = window.Twitch?.ext;

const cidInput = document.getElementById("cidInput");
const limitSelect = document.getElementById("limitSelect");
const saveBtn = document.getElementById("saveBtn");
const saveStatus = document.getElementById("saveStatus");

const CFG_VERSION = "1.0";

function setStatus(msg) {
  saveStatus.textContent = msg;
}

function readCfg() {
  const content = twitch.configuration?.broadcaster?.content || "";
  return safeJsonParse(content, {});
}

function refreshUiFromStored() {
  const cfg = readCfg();
  if (cfg?.vatsimCid) cidInput.value = cfg.vatsimCid;
  if (cfg?.limit) limitSelect.value = String(cfg.limit);
  setStatus(`Loaded: CID=${cfg?.vatsimCid || "(none)"} · limit=${cfg?.limit || 5}`);
}

function saveConfig() {
  const vatsimCid = (cidInput.value || "").trim();
  const limit = Number(limitSelect.value) === 10 ? 10 : 5;

  if (!/^\d{1,8}$/.test(vatsimCid)) {
    setStatus("Enter a numeric CID (1–8 digits).");
    return;
  }

  if (twitch.viewer?.role !== "broadcaster") {
    setStatus(`Not broadcaster (role=${twitch.viewer?.role}). Open config as channel owner.`);
    return;
  }

  const payload = JSON.stringify({ vatsimCid, limit });

  twitch.configuration.set("broadcaster", CFG_VERSION, payload);
  setStatus(`Saved ✓ CID=${vatsimCid} · limit=${limit}. Refresh channel/panel to apply.`);
}

twitch.onAuthorized(() => {
  twitch.configuration.onChanged(refreshUiFromStored);
  refreshUiFromStored();
});


saveBtn.addEventListener("click", saveConfig);

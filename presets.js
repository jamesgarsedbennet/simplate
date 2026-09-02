/* Loads presets.json and fills the form from one dropdown. */
const PRESET_FALLBACK = { presets: [{ id: "custom", brand: "", name: "Custom", holes: "custom" }] };

let PRESETS = [];
let applyingPreset = false;
let fitMode = "same";

function fillPresetSelect(list) {
  const sel = $("preset");
  if (!sel) return;
  sel.innerHTML = "";
  const groups = new Map();
  for (const p of list) {
    const g = p.brand || "Custom";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  }
  for (const [brand, items] of groups) {
    const og = document.createElement("optgroup");
    og.label = brand;
    for (const p of items) {
      const opt = document.createElement("option");
      opt.value = p.id;
      const tag = p.holes === "size-only" ? " · size only" : p.holes === "known" ? " · holes known" : "";
      opt.textContent = p.name + tag;
      og.appendChild(opt);
    }
    sel.appendChild(og);
  }
}

function setFitHint(spec) {
  const el = $("fitHint");
  const row = $("fitRow");
  if (!el || !row) return;
  const custom = !spec || spec.id === "custom";
  row.hidden = custom;
  el.hidden = custom;
  if (custom) { el.textContent = ""; return; }
  const who = (spec.brand ? spec.brand + " " : "") + spec.name;
  if (fitMode === "width") {
    el.textContent = "Width locked to " + who + ". Type the height for a strip above or below.";
  } else if (fitMode === "height") {
    el.textContent = "Height locked to " + who + ". Type the width for a strip beside it.";
  } else {
    el.textContent = spec.holes === "known"
      ? "Same size as " + who + ", screw positions included."
      : "Same size as " + who + ". Measure the screws.";
  }
}

function applyPreset(id) {
  const spec = PRESETS.find((p) => p.id === id);
  const row = $("fitRow");
  if (row) row.hidden = !spec || spec.id === "custom";
  if (!spec || spec.id === "custom") {
    setFitHint(null);
    return;
  }
  applyingPreset = true;
  const set = (fid, v) => { const el = $(fid); if (el && v != null) el.value = String(v); };
  if ($("dzusOn")) {
    $("dzusOn").checked = !!spec.dzus;
    if (typeof applyDzus === "function") applyDzus();
  }
  if (spec.twoHoles != null && $("twoHoles")) {
    $("twoHoles").checked = !!spec.twoHoles;
    if (typeof syncTwoHoles === "function") syncTwoHoles();
  }
  if (fitMode !== "height") set("width", spec.width);
  if (fitMode !== "width") set("height", spec.height);
  set("thickness", spec.thickness);
  if (fitMode === "same" && spec.holes === "known") {
    set("holeDia", spec.holeDia);
    set("offsetX", spec.offsetX);
    set("offsetTop", spec.offsetTop);
    set("offsetBottom", spec.offsetBottom);
  }
  if (spec.pocketDist != null) set("pocketDist", spec.pocketDist);
  if (spec.pocketDepth != null) set("pocketDepth", spec.pocketDepth);
  setFitHint(spec);
  applyingPreset = false;
  if (typeof refresh === "function") refresh();
}

function markCustom(ev) {
  if (applyingPreset) return;
  const sel = $("preset");
  if (!sel || sel.value === "custom") return;
  const src = ev && ev.target && ev.target.id;
  if (fitMode === "width" && src === "height") return;
  if (fitMode === "height" && src === "width") return;
  sel.value = "custom";
  setFitHint(null);
}

async function bootPresets() {
  try {
    const res = await fetch("presets.json", { cache: "no-store" });
    const data = await res.json();
    PRESETS = data.presets || [];
  } catch (e) {
    PRESETS = PRESET_FALLBACK.presets;
  }
  if (!PRESETS.some((p) => p.id === "custom")) {
    PRESETS.unshift({ id: "custom", brand: "", name: "Custom" });
  }
  fillPresetSelect(PRESETS);
  const sel = $("preset");
  if (!sel) return;
  sel.addEventListener("change", () => applyPreset(sel.value));
  for (const btn of document.querySelectorAll(".fit")) {
    btn.addEventListener("click", () => {
      fitMode = btn.getAttribute("data-fit") || "same";
      for (const b of document.querySelectorAll(".fit")) b.classList.toggle("on", b === btn);
      applyPreset(sel.value);
    });
  }
  for (const id of [
    "width", "height", "thickness", "holeDia", "offsetX", "offsetTop", "offsetBottom",
    "twoHoles", "dzusOn", "dzusN", "dzusW",
  ]) {
    const el = $(id);
    if (!el) continue;
    el.addEventListener("input", markCustom);
    el.addEventListener("change", markCustom);
  }
}

document.addEventListener("DOMContentLoaded", bootPresets);

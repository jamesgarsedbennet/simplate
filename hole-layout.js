/* Hole layout: four | pair | opposite corners | none. Loaded after rim.js. */
const _paramsLayout = params;
params = function () {
  const p = _paramsLayout();
  p.holeLayout = ($("holeLayout") && $("holeLayout").value) || "four";
  p.twoHoles = p.holeLayout === "pair";
  if (p.holeLayout === "none") {
    p.pocketDepth = 0;
    p.pocketDist = 0;
  }
  return p;
};

const _holeSpecsLayout = holeSpecs;
holeSpecs = function (p) {
  if (p.holeLayout === "none") return [];
  const rHole = p.holeD / 2;
  const rPocket = rHole + Math.max(0, p.pocketDist);
  if (p.holeLayout === "opposite") {
    const toBottom = p.oBot <= rPocket + 0.05;
    const toTop = p.oTop <= rPocket + 0.05;
    return [
      { x: p.ox, y: p.h - p.oTop, openX: "left", openY: toTop ? "top" : null, rHole, rPocket },
      { x: p.w - p.ox, y: p.oBot, openX: "right", openY: toBottom ? "bottom" : null, rHole, rPocket },
    ];
  }
  return _holeSpecsLayout(p);
};

const _topLoopLayout = topLoop;
topLoop = function (p, holes) {
  if (!holes || !holes.length) {
    const w = p.w, h = p.h;
    return [[0, 0], [w / 2, 0], [w, 0], [w, h / 2], [w, h], [w / 2, h], [0, h], [0, h / 2]];
  }
  return _topLoopLayout(p, holes);
};

const _validateLayout = validate;
validate = function (p) {
  if (p.holeLayout === "none") {
    const issues = [];
    if (!(p.w >= 20 && p.w <= 600)) issues.push("Width should be 20–600 mm.");
    if (!(p.h >= 20 && p.h <= 600)) issues.push("Height should be 20–600 mm.");
    if (!(p.t >= 1.5 && p.t <= 20)) issues.push("Thickness should be 1.5–20 mm.");
    if (p.grainOn && p.grainW < 0.2) issues.push("Edge emboss width should be at least 0.2 mm.");
    if (p.grainOn && p.grainW * 2 >= Math.min(p.w, p.h)) issues.push("Edge emboss is too wide for this plate.");
    return issues;
  }
  return _validateLayout(p);
};

const _updateMetaLayout = updateMeta;
updateMeta = function (p, extra) {
  _updateMetaLayout(p, extra);
  if (!$("metaHoles")) return;
  if (p.holeLayout === "none") $("metaHoles").textContent = "None";
  else if (p.holeLayout === "opposite") $("metaHoles").textContent = `2 opposite · Ø ${fmt(p.holeD)} · side ${fmt(p.ox)} · top ${fmt(p.oTop)} · bot ${fmt(p.oBot)}`;
};

const _filenameLayout = filename;
filename = function (p) {
  if (p.holeLayout === "none") {
    return `simplate-${fmt(p.w)}x${fmt(p.h)}x${fmt(p.t)}-noholes.stl`;
  }
  if (p.holeLayout === "opposite") {
    return `simplate-${fmt(p.w)}x${fmt(p.h)}x${fmt(p.t)}-2opp-s${fmt(p.ox)}-t${fmt(p.oTop)}-b${fmt(p.oBot)}-h${fmt(p.holeD)}.stl`;
  }
  return _filenameLayout(p);
};

function syncHoleLayout() {
  const layout = ($("holeLayout") && $("holeLayout").value) || "four";
  const none = layout === "none";
  if ($("twoHoles")) $("twoHoles").checked = layout === "pair";
  const pair = layout === "pair";
  const row = $("bottomPairRow");
  if (row) row.style.display = none || pair ? "none" : "";
  const offsetRow = $("holeOffsetRow");
  if (offsetRow) offsetRow.style.display = none ? "none" : "";
  const checks = document.querySelector(".checks");
  if (checks) checks.style.display = none ? "none" : "";
  const pocket = $("pocketBlock");
  if (pocket) pocket.style.display = none ? "none" : "";
  if (none && $("dzusOn") && $("dzusOn").checked) {
    $("dzusOn").checked = false;
    if ($("dzusRow")) $("dzusRow").style.display = "none";
  }
  const lab = $("offsetTopLabel");
  if (lab) {
    const text = pair ? "From top mm" : "Top pair from top mm";
    const input = lab.querySelector("input");
    lab.textContent = "";
    lab.appendChild(document.createTextNode(text));
    if (input) lab.appendChild(input);
  }
  const hint = $("holeHint");
  if (hint) {
    hint.textContent = none
      ? "Blank plate. No screw holes and no pocket. Cutouts and edge emboss still work."
      : layout === "opposite"
      ? "Top left and bottom right. Side is left/right. Top and bottom offsets move each hole on its own."
      : pair
      ? "One pair: a hole on the left and one on the right. From top moves both together. Slim filler plates use this."
      : "Four holes in two pairs. From side is left and right. Top pair from top only moves the upper two. Bottom pair from bottom only moves the lower two.";
  }
  if (typeof refresh === "function") refresh();
}

document.addEventListener("DOMContentLoaded", () => {
  const layout = $("holeLayout");
  if (layout) {
    layout.addEventListener("change", syncHoleLayout);
    syncHoleLayout();
  }
});

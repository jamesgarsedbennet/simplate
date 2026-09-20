/* Hole layout: four | pair | opposite corners. Loaded after rim.js. */
const _paramsLayout = params;
params = function () {
  const p = _paramsLayout();
  p.holeLayout = ($("holeLayout") && $("holeLayout").value) || "four";
  p.twoHoles = p.holeLayout === "pair";
  return p;
};

const _holeSpecsLayout = holeSpecs;
holeSpecs = function (p) {
  const rHole = p.holeD / 2;
  const rPocket = rHole + Math.max(0, p.pocketDist);
  if (p.holeLayout === "opposite") {
    const toBottom = p.oBot <= rPocket + 0.05;
    const toTop = p.oTop <= rPocket + 0.05;
    return [
      { x: p.ox, y: p.oBot, openX: "left", openY: toBottom ? "bottom" : null, rHole, rPocket },
      { x: p.w - p.ox, y: p.h - p.oTop, openX: "right", openY: toTop ? "top" : null, rHole, rPocket },
    ];
  }
  return _holeSpecsLayout(p);
};

const _updateMetaLayout = updateMeta;
updateMeta = function (p, extra) {
  _updateMetaLayout(p, extra);
  if (p.holeLayout === "opposite" && $("metaHoles")) {
    $("metaHoles").textContent = `2 opposite · Ø ${fmt(p.holeD)} · side ${fmt(p.ox)} · top ${fmt(p.oTop)} · bot ${fmt(p.oBot)}`;
  }
};

const _filenameLayout = filename;
filename = function (p) {
  if (p.holeLayout === "opposite") {
    return `simplate-${fmt(p.w)}x${fmt(p.h)}x${fmt(p.t)}-2opp-s${fmt(p.ox)}-t${fmt(p.oTop)}-b${fmt(p.oBot)}-h${fmt(p.holeD)}.stl`;
  }
  return _filenameLayout(p);
};

function syncHoleLayout() {
  const layout = ($("holeLayout") && $("holeLayout").value) || "four";
  if ($("twoHoles")) $("twoHoles").checked = layout === "pair";
  const pair = layout === "pair";
  const row = $("bottomPairRow");
  if (row) row.style.display = pair ? "none" : "";
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
    hint.textContent = layout === "opposite"
      ? "Bottom left and top right. Side is left/right. Top and bottom offsets move each hole on its own."
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

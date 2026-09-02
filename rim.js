/* Overrides loaded after panel.js. */
function addRim(mesh, p, holes) {
  const bw = Math.max(0.2, p.grainW);
  const d = p.grainD;
  if (d <= 0) return;
  const outer = topLoop(p, holes);
  if (outer.length < 8) return;
  const n = outer.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = outer[i], b = outer[j];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const len = Math.hypot(ex, ey);
    if (len < 1e-6) continue;
    const nx = (-ey / len) * bw;
    const ny = (ex / len) * bw;
    const hh = holes.find((h) => {
      const ra = Math.hypot(a[0] - h.x, a[1] - h.y);
      const rb = Math.hypot(b[0] - h.x, b[1] - h.y);
      return Math.abs(ra - h.rPocket) < 0.5 && Math.abs(rb - h.rPocket) < 0.5;
    });
    let c, dpt;
    if (hh) {
      const aa = Math.atan2(a[1] - hh.y, a[0] - hh.x);
      const ba = Math.atan2(b[1] - hh.y, b[0] - hh.x);
      dpt = [hh.x + Math.cos(aa) * (hh.rPocket + bw), hh.y + Math.sin(aa) * (hh.rPocket + bw)];
      c = [hh.x + Math.cos(ba) * (hh.rPocket + bw), hh.y + Math.sin(ba) * (hh.rPocket + bw)];
    } else {
      dpt = [a[0] + nx, a[1] + ny];
      c = [b[0] + nx, b[1] + ny];
    }
    extrudeProfile(mesh, [a, b, c, dpt], [], p.t, p.t + d);
  }
}

function params() {
  return {
    w: val("width"),
    h: val("height"),
    t: val("thickness"),
    holeD: val("holeDia"),
    ox: val("offsetX"),
    oTop: val("offsetTop"),
    oBot: val("offsetBottom"),
    pocketDist: val("pocketDist"),
    pocketDepth: val("pocketDepth"),
    grainW: val("grainW"),
    grainD: val("grainD"),
    grainOn: $("grainOn").checked,
    twoHoles: !!( $("twoHoles") && $("twoHoles").checked ),
  };
}

function validate(p) {
  const issues = [];
  const hr = p.holeD / 2;
  if (!(p.w >= 20 && p.w <= 600)) issues.push("Width should be 20–600 mm.");
  if (!(p.h >= 20 && p.h <= 600)) issues.push("Height should be 20–600 mm.");
  if (!(p.t >= 1.5 && p.t <= 20)) issues.push("Thickness should be 1.5–20 mm.");
  if (!(p.holeD >= 2 && p.holeD <= 12)) issues.push("Hole diameter should be 2–12 mm.");
  if (p.ox < hr + 0.4) issues.push("Offset from the side must keep the hole on the plate.");
  if (p.oTop < hr + 0.4) issues.push("Offset from the top must keep the hole on the plate.");
  if (p.ox * 2 >= p.w) issues.push("Side offset is too large for this width.");
  if (p.twoHoles) {
    if (p.oTop > p.h - hr - 0.4) issues.push("Offset from the top must keep the hole on the plate.");
  } else {
    if (p.oBot < hr + 0.4) issues.push("Offset from the bottom must keep the hole on the plate.");
    if (p.oTop + p.oBot >= p.h) issues.push("Top + bottom offsets leave no room between the holes.");
  }
  if (p.pocketDepth < 0) issues.push("Pocket depth cannot be negative.");
  if (p.pocketDepth >= p.t - 0.6) issues.push("Pocket depth must leave at least 0.6 mm under the screw.");
  if (p.grainOn && p.grainW < 0.2) issues.push("Edge emboss width should be at least 0.2 mm.");
  if (p.grainOn && p.grainW * 2 >= Math.min(p.w, p.h)) issues.push("Edge emboss is too wide for this plate.");
  return issues;
}

function holeSpecs(p) {
  const rHole = p.holeD / 2;
  const rPocket = rHole + Math.max(0, p.pocketDist);
  if (p.twoHoles) {
    const y = p.h - p.oTop;
    const toBottom = y <= rPocket + 0.05;
    const toTop = p.oTop <= rPocket + 0.05;
    const openY = toTop ? "top" : toBottom ? "bottom" : null;
    return [
      { x: p.ox, y, openX: "left", openY, rHole, rPocket },
      { x: p.w - p.ox, y, openX: "right", openY, rHole, rPocket },
    ];
  }
  const toBottom = p.oBot <= rPocket + 0.05;
  const toTop = p.oTop <= rPocket + 0.05;
  return [
    { x: p.ox, y: p.oBot, openX: "left", openY: toBottom ? "bottom" : null, rHole, rPocket },
    { x: p.w - p.ox, y: p.oBot, openX: "right", openY: toBottom ? "bottom" : null, rHole, rPocket },
    { x: p.w - p.ox, y: p.h - p.oTop, openX: "right", openY: toTop ? "top" : null, rHole, rPocket },
    { x: p.ox, y: p.h - p.oTop, openX: "left", openY: toTop ? "top" : null, rHole, rPocket },
  ];
}

function topLoopTwo(p, holes) {
  const L = holes.find((h) => h.openX === "left") || holes[0];
  const R = holes.find((h) => h.openX === "right") || holes[1];
  const w = p.w, h = p.h;
  const loop = [];
  const push = (pt) => {
    const last = loop[loop.length - 1];
    if (!last || Math.hypot(last[0] - pt[0], last[1] - pt[1]) > 1e-6) loop.push(pt);
  };
  const pushAll = (arr) => arr.forEach(push);

  if (L.openY === "bottom") push([L.x + L.rPocket, 0]);
  else push([0, 0]);

  if (R.openY === "bottom") {
    push([R.x - R.rPocket, 0]);
    pushAll(arcPts(R, Math.PI, Math.PI / 2, false));
    push([w, R.y + R.rPocket]);
  } else {
    push([w, 0]);
    if (!R.openY) {
      push([w, R.y - R.rPocket]);
      push([R.x, R.y - R.rPocket]);
      pushAll(arcPts(R, Math.PI / 2, (3 * Math.PI) / 2, true));
      push([w, R.y + R.rPocket]);
    }
  }

  if (R.openY === "top") {
    push([w, R.y - R.rPocket]);
    push([R.x, R.y - R.rPocket]);
    pushAll(arcPts(R, (3 * Math.PI) / 2, Math.PI, false));
    push([R.x - R.rPocket, h]);
  } else {
    push([w, h]);
  }

  if (L.openY === "top") {
    push([L.x + L.rPocket, h]);
    pushAll(arcPts(L, 0, -Math.PI / 2, false));
    push([0, L.y - L.rPocket]);
  } else {
    push([0, h]);
    if (!L.openY) {
      push([0, L.y + L.rPocket]);
      push([L.x, L.y + L.rPocket]);
      pushAll(arcPts(L, Math.PI / 2, -Math.PI / 2, false));
      push([0, L.y - L.rPocket]);
    }
  }

  if (L.openY === "bottom") {
    push([0, L.y + L.rPocket]);
    pushAll(arcPts(L, Math.PI / 2, 0, false));
  } else {
    push([0, 0]);
  }
  return loop;
}

function topLoop(p, holes) {
  if (holes.length === 2) return topLoopTwo(p, holes);
  const [bl, br, tr, tl] = holes;
  const w = p.w, h = p.h;
  const loop = [];
  const push = (pt) => {
    const last = loop[loop.length - 1];
    if (!last || Math.hypot(last[0] - pt[0], last[1] - pt[1]) > 1e-6) loop.push(pt);
  };
  const pushAll = (arr) => arr.forEach(push);

  if (bl.openY === "bottom") push([bl.x + bl.rPocket, 0]);
  else push([0, 0]);

  if (br.openY === "bottom") {
    push([br.x - br.rPocket, 0]);
    pushAll(arcPts(br, Math.PI, Math.PI / 2, false));
    push([w, br.y + br.rPocket]);
  } else {
    push([w, 0]);
  }

  if (!br.openY) {
    push([w, br.y - br.rPocket]);
    push([br.x, br.y - br.rPocket]);
    pushAll(arcPts(br, Math.PI / 2, (3 * Math.PI) / 2, true));
    push([w, br.y + br.rPocket]);
  }

  if (tr.openY === "top") {
    push([w, tr.y - tr.rPocket]);
    push([tr.x, tr.y - tr.rPocket]);
    pushAll(arcPts(tr, (3 * Math.PI) / 2, Math.PI, false));
    push([tr.x - tr.rPocket, h]);
  } else {
    push([w, tr.y - tr.rPocket]);
    push([tr.x, tr.y - tr.rPocket]);
    pushAll(arcPts(tr, Math.PI / 2, (3 * Math.PI) / 2, true));
    push([w, tr.y + tr.rPocket]);
    push([w, h]);
  }

  if (tl.openY === "top") {
    push([tl.x + tl.rPocket, h]);
    pushAll(arcPts(tl, 0, -Math.PI / 2, false));
    push([0, tl.y - tl.rPocket]);
  } else {
    push([0, h]);
  }

  if (!tl.openY) {
    push([0, tl.y + tl.rPocket]);
    push([tl.x, tl.y + tl.rPocket]);
    pushAll(arcPts(tl, Math.PI / 2, -Math.PI / 2, false));
    push([0, tl.y - tl.rPocket]);
  }

  if (bl.openY === "bottom") {
    push([0, bl.y + bl.rPocket]);
    pushAll(arcPts(bl, Math.PI / 2, 0, false));
  } else {
    push([0, bl.y + bl.rPocket]);
    push([bl.x, bl.y + bl.rPocket]);
    pushAll(arcPts(bl, Math.PI / 2, -Math.PI / 2, false));
    push([0, bl.y - bl.rPocket]);
    push([0, 0]);
  }
  return loop;
}

function updateMeta(p, extra = {}) {
  $("metaSize").textContent = `${fmt(p.w)} × ${fmt(p.h)} × ${fmt(p.t)} mm`;
  $("metaHoles").textContent = p.twoHoles
    ? `2 holes · Ø ${fmt(p.holeD)} · side ${fmt(p.ox)} · from top ${fmt(p.oTop)}`
    : `Ø ${fmt(p.holeD)} · side ${fmt(p.ox)} · top ${fmt(p.oTop)} · bot ${fmt(p.oBot)}`;
  $("metaFile").textContent = extra.file || "—";
}

function filename(p) {
  if (p.twoHoles) {
    return `simplate-${fmt(p.w)}x${fmt(p.h)}x${fmt(p.t)}-2h-s${fmt(p.ox)}-t${fmt(p.oTop)}-h${fmt(p.holeD)}.stl`;
  }
  return `simplate-${fmt(p.w)}x${fmt(p.h)}x${fmt(p.t)}-s${fmt(p.ox)}-t${fmt(p.oTop)}-b${fmt(p.oBot)}-h${fmt(p.holeD)}.stl`;
}

function capPocketDepth() {
  const tEl = $("thickness");
  const dEl = $("pocketDepth");
  if (!tEl || !dEl) return;
  const t = parseFloat(tEl.value);
  if (!isFinite(t)) return;
  const max = Math.max(0, Math.round((t - 0.6) * 10) / 10);
  dEl.max = String(max);
  const cur = parseFloat(dEl.value);
  if (isFinite(cur) && cur > max) dEl.value = String(max);
}

function syncTwoHoles() {
  const on = !!( $("twoHoles") && $("twoHoles").checked );
  const row = $("bottomPairRow");
  if (row) row.style.display = on ? "none" : "";
  const lab = $("offsetTopLabel");
  if (lab) {
    const text = on ? "From top mm" : "Top pair from top mm";
    const input = lab.querySelector("input");
    lab.textContent = "";
    lab.appendChild(document.createTextNode(text));
    if (input) lab.appendChild(input);
  }
  const hint = $("holeHint");
  if (hint) {
    hint.textContent = on
      ? "One pair: a hole on the left and one on the right. From top moves both together. Slim filler plates use this."
      : "Four holes in two pairs. From side is left and right. Top pair from top only moves the upper two. Bottom pair from bottom only moves the lower two.";
  }
  if (typeof refresh === "function") refresh();
}

function loadExample() {
  /* sample button removed */
}

function fy(p, y) {
  return (p.h - y).toFixed(3);
}

function svgPath(p, pts, close) {
  if (!pts || pts.length < 2) return "";
  let d = `M ${pts[0][0].toFixed(3)} ${fy(p, pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0].toFixed(3)} ${fy(p, pts[i][1])}`;
  if (close) d += " Z";
  return d;
}

function buildSvg(p) {
  const holes = holeSpecs(p);
  const loop = topLoop(p, holes);
  const parts = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}mm" height="${p.h}mm" viewBox="0 0 ${p.w} ${p.h}">`);
  parts.push(`  <title>SimPlate ${p.w}x${p.h}x${p.t} mm</title>`);
  parts.push(`  <g id="cut-outline" fill="none" stroke="#1a1a1a" stroke-width="0.2">`);
  parts.push(`    <rect x="0" y="0" width="${p.w}" height="${p.h}"/>`);
  parts.push(`  </g>`);
  parts.push(`  <g id="cut-holes" fill="none" stroke="#1a1a1a" stroke-width="0.2">`);
  for (const hh of holes) {
    parts.push(`    <circle cx="${hh.x.toFixed(3)}" cy="${fy(p, hh.y)}" r="${hh.rHole.toFixed(3)}"/>`);
  }
  parts.push(`  </g>`);
  if (p.pocketDepth > 0.001 && p.pocketDist > 0.001 && loop.length > 3) {
    parts.push(`  <g id="engrave-pockets" fill="none" stroke="#4a90c8" stroke-width="0.15">`);
    parts.push(`    <path d="${svgPath(p, loop, true)}"/>`);
    parts.push(`  </g>`);
  }
  if (p.grainOn && p.grainD > 0 && loop.length > 3) {
    parts.push(`  <g id="engrave-rim" fill="none" stroke="#c9a227" stroke-width="${Math.max(0.2, p.grainW).toFixed(2)}">`);
    parts.push(`    <path d="${svgPath(p, loop, true)}"/>`);
    parts.push(`  </g>`);
  }
  parts.push(`</svg>`);
  return parts.join("\n");
}

function downloadSvg() {
  const p = params();
  const issues = validate(p);
  const blocking = issues.filter((s) => !s.includes("huge files"));
  if (blocking.length) {
    $("warn").textContent = blocking[0];
    return;
  }
  const svg = buildSvg(p);
  const name = filename(p).replace(/\.stl$/i, ".svg");
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  updateMeta(p, { file: name });
}

document.addEventListener("DOMContentLoaded", () => {
  capPocketDepth();
  for (const id of ["thickness", "pocketDepth"]) {
    const el = $(id);
    if (!el) continue;
    el.addEventListener("input", capPocketDepth);
    el.addEventListener("change", capPocketDepth);
  }
  const two = $("twoHoles");
  if (two) {
    two.addEventListener("change", syncTwoHoles);
    syncTwoHoles();
  }
  const svgBtn = $("btnSvg");
  if (svgBtn) svgBtn.addEventListener("click", downloadSvg);
});

/* Rounded-rectangle cutout groups. Session only. */
const CUT_PRESETS = {
  blank: { name: "Window", cols: 1, rows: 1, cellW: 17, cellH: 17, gap: 2.6, radius: 2.5, left: 10, top: 10, through: true, depth: 2 },
  mini: { name: "Stream Deck Mini", cols: 3, rows: 2, cellW: 17, cellH: 17, gap: 2.6, radius: 2.5, left: 10, top: 10, through: true, depth: 2 },
  sd: { name: "Stream Deck", cols: 5, rows: 3, cellW: 17, cellH: 17, gap: 2.6, radius: 2.5, left: 10, top: 10, through: true, depth: 2 },
  xl: { name: "Stream Deck XL", cols: 8, rows: 4, cellW: 17, cellH: 17, gap: 2.6, radius: 2.5, left: 10, top: 10, through: true, depth: 2 },
};

let CUTOUTS = [];
let cutId = 1;

function roundedRectRing(x, y, w, h, r, n = 6) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const pts = [];
  const corner = (cx, cy, a0, a1) => {
    if (r < 0.05) {
      pts.push([cx + Math.cos(a1) * r, cy + Math.sin(a1) * r]);
      return;
    }
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2, 0);
  corner(x + w - r, y + h - r, 0, Math.PI / 2);
  corner(x + r, y + h - r, Math.PI / 2, Math.PI);
  corner(x + r, y + r, Math.PI, (3 * Math.PI) / 2);
  return pts;
}

function cutoutCells(p) {
  const cells = [];
  for (const g of CUTOUTS) {
    const cols = Math.max(1, Math.round(g.cols));
    const rows = Math.max(1, Math.round(g.rows));
    const cw = Math.max(0.5, g.cellW);
    const ch = Math.max(0.5, g.cellH);
    const gap = Math.max(0, g.gap);
    const r = Math.max(0, g.radius);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = g.left + col * (cw + gap);
        const yTop = g.top + row * (ch + gap);
        const y = p.h - yTop - ch;
        cells.push({
          x, y, w: cw, h: ch, r,
          through: !!g.through,
          depth: g.through ? p.t : Math.max(0, g.depth),
        });
      }
    }
  }
  return cells;
}

function cutoutRings(p, throughOnly) {
  return cutoutCells(p)
    .filter((c) => throughOnly ? c.through : !c.through)
    .filter((c) => c.w > 0.2 && c.h > 0.2)
    .map((c) => roundedRectRing(c.x, c.y, c.w, c.h, c.r));
}

function drawCutouts(ctx, p) {
  for (const c of cutoutCells(p)) {
    ctx.beginPath();
    const r = Math.min(c.r, c.w / 2, c.h / 2);
    ctx.moveTo(c.x + r, c.y);
    ctx.arcTo(c.x + c.w, c.y, c.x + c.w, c.y + c.h, r);
    ctx.arcTo(c.x + c.w, c.y + c.h, c.x, c.y + c.h, r);
    ctx.arcTo(c.x, c.y + c.h, c.x, c.y, r);
    ctx.arcTo(c.x, c.y, c.x + c.w, c.y, r);
    ctx.closePath();
    ctx.fillStyle = c.through ? "#071018" : "#152230";
    ctx.fill();
    ctx.strokeStyle = c.through ? "#7ec8ff" : "#c9a227";
    ctx.lineWidth = 0.25;
    ctx.stroke();
  }
}

function cutoutCount() {
  return CUTOUTS.reduce((n, g) => n + Math.max(1, g.cols) * Math.max(1, g.rows), 0);
}

function syncCutButton() {
  const btn = $("btnCuts");
  if (!btn) return;
  const n = cutoutCount();
  btn.textContent = n ? "Edit cutouts · " + n : "Edit cutouts";
}

function addCut(kind) {
  const src = CUT_PRESETS[kind] || CUT_PRESETS.blank;
  CUTOUTS.push(Object.assign({ id: cutId++ }, src));
  renderCutList();
  if (typeof refresh === "function") refresh();
}

function removeCut(id) {
  CUTOUTS = CUTOUTS.filter((g) => g.id !== id);
  renderCutList();
  if (typeof refresh === "function") refresh();
}

function bindCutFields(item, g) {
  const num = (name, fn) => {
    const el = item.querySelector("[data-f=" + name + "]");
    if (!el) return;
    el.addEventListener("input", () => {
      g[fn] = name === "through" ? el.checked : parseFloat(el.value);
      if (typeof refresh === "function") refresh();
      item.querySelector(".cut-item-head span").textContent = cutLabel(g);
    });
  };
  num("left", "left"); num("top", "top");
  num("cols", "cols"); num("rows", "rows");
  num("cellW", "cellW"); num("cellH", "cellH");
  num("gap", "gap"); num("radius", "radius");
  num("depth", "depth");
  const th = item.querySelector("[data-f=through]");
  if (th) th.addEventListener("change", () => {
    g.through = th.checked;
    if (typeof refresh === "function") refresh();
    item.querySelector(".cut-item-head span").textContent = cutLabel(g);
  });
}

function cutLabel(g) {
  return g.cols + "×" + g.rows + " · " + g.name + (g.through ? " · through" : " · Indent");
}

function renderCutList() {
  const box = $("cutList");
  if (!box) return;
  box.innerHTML = "";
  if (!CUTOUTS.length) {
    box.innerHTML = "<p class='hint'>No cutouts yet.</p>";
    syncCutButton();
    return;
  }
  for (const g of CUTOUTS) {
    const item = document.createElement("div");
    item.className = "cut-item";
    item.innerHTML = `
      <div class="cut-item-head"><span>${cutLabel(g)}</span>
        <button type="button" class="ghost small" data-del="${g.id}">Remove</button></div>
      <div class="row row-2">
        <label>From left mm<input data-f="left" type="number" min="0" step="0.1" value="${g.left}"></label>
        <label>From top mm<input data-f="top" type="number" min="0" step="0.1" value="${g.top}"></label>
      </div>
      <div class="row row-2">
        <label>Columns<input data-f="cols" type="number" min="1" max="16" step="1" value="${g.cols}"></label>
        <label>Rows<input data-f="rows" type="number" min="1" max="16" step="1" value="${g.rows}"></label>
      </div>
      <div class="row row-2">
        <label>Cell W mm<input data-f="cellW" type="number" min="0.5" step="0.1" value="${g.cellW}"></label>
        <label>Cell H mm<input data-f="cellH" type="number" min="0.5" step="0.1" value="${g.cellH}"></label>
      </div>
      <div class="row row-2">
        <label>Gap mm<input data-f="gap" type="number" min="0" step="0.1" value="${g.gap}"></label>
        <label>Corner R mm<input data-f="radius" type="number" min="0" step="0.1" value="${g.radius}"></label>
      </div>
      <div class="row row-2">
        <label>Indent depth mm<input data-f="depth" type="number" min="0" step="0.1" value="${g.depth}"></label>
        <label></label>
      </div>
      <label class="check"><input data-f="through" type="checkbox" ${g.through ? "checked" : ""}> Through the plate</label>`;
    box.appendChild(item);
    bindCutFields(item, g);
    item.querySelector("[data-del]").addEventListener("click", () => removeCut(g.id));
  }
  syncCutButton();
}

function openCuts() {
  $("cutModal").hidden = false;
  renderCutList();
}
function closeCuts() {
  $("cutModal").hidden = true;
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = $("btnCuts");
  if (btn) btn.addEventListener("click", openCuts);
  const close = $("btnCutClose");
  if (close) close.addEventListener("click", closeCuts);
  const modal = $("cutModal");
  if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) closeCuts(); });
  document.querySelectorAll("[data-cut]").forEach((b) => {
    b.addEventListener("click", () => addCut(b.getAttribute("data-cut")));
  });
});

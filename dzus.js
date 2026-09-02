/* Loaded after rim.js. DZUS rail snap + preview grid. */
const DZUS = {
  pitch: 9.525,
  rail: 136.525,
  fromEnd: 14.27,
  holeD: 6.5,
};

const _paramsDzus = params;
params = function () {
  const p = _paramsDzus();
  p.dzus = !!( $("dzusOn") && $("dzusOn").checked );
  return p;
};

function dzusWidth() {
  const el = $("dzusW");
  const w = el ? parseFloat(el.value) : 145.65;
  return isFinite(w) ? w : 145.65;
}

function dzusUnits() {
  const el = $("dzusN");
  let n = el ? parseInt(el.value, 10) : 7;
  if (!isFinite(n) || n < 2) n = 2;
  if (n > 30) n = 30;
  return n;
}

function applyDzus() {
  const on = !!( $("dzusOn") && $("dzusOn").checked );
  const row = $("dzusRow");
  if (row) row.style.display = on ? "" : "none";
  if (!on) {
    if (typeof refresh === "function") refresh();
    return;
  }
  const n = dzusUnits();
  const w = dzusWidth();
  const h = Math.round(n * DZUS.pitch * 1000) / 1000;
  const ox = Math.round(((w - DZUS.rail) / 2) * 100) / 100;
  const fromEnd = DZUS.fromEnd;
  $("width").value = String(w);
  $("height").value = String(h);
  $("offsetX").value = String(ox);
  $("offsetTop").value = String(fromEnd);
  $("offsetBottom").value = String(fromEnd);
  $("holeDia").value = String(DZUS.holeD);
  if (n < 4 && $("twoHoles") && !$("twoHoles").checked) {
    $("twoHoles").checked = true;
    if (typeof syncTwoHoles === "function") syncTwoHoles();
  }
  if (typeof refresh === "function") refresh();
}

function drawDzusGrid(p) {
  const canvas = $("view");
  if (!canvas || !p.dzus) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const pad = 36;
  const scale = Math.min((cssW - pad * 2) / p.w, (cssH - pad * 2) / p.h);
  const ox = (cssW - p.w * scale) / 2;
  const oy = (cssH - p.h * scale) / 2;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(ox, oy + p.h * scale);
  ctx.scale(scale, -scale);
  const xL = (p.w - DZUS.rail) / 2;
  const xR = xL + DZUS.rail;
  ctx.strokeStyle = "rgba(224,184,78,0.35)";
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.moveTo(xL, 0); ctx.lineTo(xL, p.h);
  ctx.moveTo(xR, 0); ctx.lineTo(xR, p.h);
  ctx.stroke();
  ctx.strokeStyle = "rgba(224,184,78,0.18)";
  ctx.lineWidth = 0.12;
  const y0 = DZUS.fromEnd;
  for (let y = y0; y <= p.h - y0 + 0.2; y += DZUS.pitch) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(p.w, y);
    ctx.stroke();
    for (const x of [xL, xR]) {
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(224,184,78,0.55)";
      ctx.fill();
    }
  }
  ctx.restore();
}

const _drawPreviewDzus = drawPreview;
drawPreview = function (p) {
  _drawPreviewDzus(p);
  if (p && p.dzus) drawDzusGrid(p);
};

document.addEventListener("DOMContentLoaded", () => {
  const dz = $("dzusOn");
  if (!dz) return;
  dz.addEventListener("change", applyDzus);
  const nEl = $("dzusN");
  if (nEl) {
    nEl.addEventListener("input", applyDzus);
    nEl.addEventListener("change", applyDzus);
  }
  const wEl = $("dzusW");
  if (wEl) wEl.addEventListener("change", applyDzus);
  applyDzus();
});

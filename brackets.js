/* Solid rail. Inserts through the top. 3 mm holes through the side into the wood. */
function numInput(id, fallback) {
  const v = parseFloat((document.getElementById(id) || {}).value);
  return isFinite(v) ? v : fallback;
}
function bracketHoleD(p) {
  const v = numInput("bracketHole", NaN);
  return isFinite(v) && v >= 2 ? v : (p.holeD || 4.3);
}
function bracketWidth(p) {
  const hole = bracketHoleD(p);
  const ox = numInput("offsetX", p.ox || 5);
  return Math.max(hole + 6, ox + hole / 2 + 3.2, 10);
}
function bracketParams(p) {
  p.bracketOn = !!(document.getElementById("bracketOn") || {}).checked;
  p.bracketPair = ((document.getElementById("bracketPair") || {}).value) || "lr";
  p.bracketDepth = Math.max(8, numInput("bracketDepth", 12));
  p.bracketHole = bracketHoleD(p);
  p.ox = numInput("offsetX", p.ox || 5);
  return p;
}
function mountYs(len, avoid, rH) {
  const raw = len > 70 ? [len * 0.2, len * 0.5, len * 0.8] : [len * 0.28, len * 0.72];
  return raw.map((y0) => {
    let y = y0;
    for (let n = 0; n < 10; n++) {
      let hit = false;
      for (const a of avoid) {
        const need = a.r + rH + 2.2;
        if (Math.abs(y - a.y) < need) { hit = true; y = a.y + (y >= a.y ? need : -need); }
      }
      if (!hit) break;
    }
    return Math.max(rH + 1.6, Math.min(len - rH - 1.6, y));
  });
}
function ring2(cx, cy, r, n) {
  return circlePts(cx, cy, r, n, 0, Math.PI * 2).slice(0, n);
}
function normRing(ring, hole) {
  const r = [];
  for (const p of ring) {
    const last = r[r.length - 1];
    if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 1e-8) r.push([p[0], p[1]]);
  }
  if (r.length > 2 && Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) < 1e-8) r.pop();
  if (r.length > 2) {
    const pos = signedArea(r) > 0;
    if (hole ? pos : !pos) r.reverse();
  }
  return r;
}
function addRailBox(mesh, x0, y0, w, h, t, inserts, sideAxis, sidePos, sideR, coneAt) {
  const rCone = 3.5;
  const coneH = Math.min(1.9, (sideAxis === "x" ? w : h) * 0.4);
  const top = normRing([[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]], false);
  const ins = (inserts || []).map((hh) => normRing(ring2(hh.x, hh.y, hh.r, SEG), true));
  const faces = earcutTris(top, ins);
  for (const [A, B, C] of faces) {
    mesh.add([A[0], A[1], t], [B[0], B[1], t], [C[0], C[1], t]);
    mesh.add([A[0], A[1], 0], [C[0], C[1], 0], [B[0], B[1], 0]);
  }
  for (const hole of ins) wallStrip(mesh, closeRing(hole), 0, t, false);
  mesh.quad([x0, y0, 0], [x0 + w, y0, 0], [x0 + w, y0, t], [x0, y0, t]);
  mesh.quad([x0, y0 + h, 0], [x0, y0 + h, t], [x0 + w, y0 + h, t], [x0 + w, y0 + h, 0]);
  const midZ = t / 2;
  if (sideAxis === "x") {
    const yz = normRing([[y0, 0], [y0 + h, 0], [y0 + h, t], [y0, t]], false);
    const small = (sidePos || []).map((y) => normRing(ring2(y, midZ, sideR, 20), true));
    const big = (sidePos || []).map((y) => normRing(ring2(y, midZ, rCone, 20), true));
    const xLo = x0, xHi = x0 + w;
    const xCone = coneAt === "low" ? xLo : xHi;
    const xFar = coneAt === "low" ? xHi : xLo;
    const xMid = xCone + Math.sign(xFar - xCone) * coneH;
    const yfBig = earcutTris(yz, big);
    const yfSmall = earcutTris(yz, small);
    for (const [A, B, C] of yfBig) {
      mesh.add([xCone, A[0], A[1]], [xCone, C[0], C[1]], [xCone, B[0], B[1]]);
    }
    for (const [A, B, C] of yfSmall) {
      mesh.add([xFar, A[0], A[1]], [xFar, B[0], B[1]], [xFar, C[0], C[1]]);
    }
    for (let i = 0; i < (sidePos || []).length; i++) {
      const aR = closeRing(small[i]);
      const bR = closeRing(big[i]);
      for (let k = 0; k < aR.length - 1; k++) {
        const a0 = aR[k], a1 = aR[k + 1], b0 = bR[k], b1 = bR[k + 1];
        mesh.quad([xCone, b0[0], b0[1]], [xCone, b1[0], b1[1]], [xMid, a1[0], a1[1]], [xMid, a0[0], a0[1]]);
        mesh.quad([xMid, a0[0], a0[1]], [xMid, a1[0], a1[1]], [xFar, a1[0], a1[1]], [xFar, a0[0], a0[1]]);
      }
    }
  } else {
    const xz = normRing([[x0, 0], [x0 + w, 0], [x0 + w, t], [x0, t]], false);
    const small = (sidePos || []).map((x) => normRing(ring2(x, midZ, sideR, 20), true));
    const big = (sidePos || []).map((x) => normRing(ring2(x, midZ, rCone, 20), true));
    const yLo = y0, yHi = y0 + h;
    const yCone = coneAt === "low" ? yLo : yHi;
    const yFar = coneAt === "low" ? yHi : yLo;
    const yMid = yCone + Math.sign(yFar - yCone) * coneH;
    const xfBig = earcutTris(xz, big);
    const xfSmall = earcutTris(xz, small);
    for (const [A, B, C] of xfBig) {
      mesh.add([A[0], yCone, A[1]], [C[0], yCone, C[1]], [B[0], yCone, B[1]]);
    }
    for (const [A, B, C] of xfSmall) {
      mesh.add([A[0], yFar, A[1]], [B[0], yFar, B[1]], [C[0], yFar, C[1]]);
    }
    for (let i = 0; i < (sidePos || []).length; i++) {
      const aR = closeRing(small[i]);
      const bR = closeRing(big[i]);
      for (let k = 0; k < aR.length - 1; k++) {
        const a0 = aR[k], a1 = aR[k + 1], b0 = bR[k], b1 = bR[k + 1];
        mesh.quad([b0[0], yCone, b0[1]], [b1[0], yCone, b1[1]], [a1[0], yMid, a1[1]], [a0[0], yMid, a0[1]]);
        mesh.quad([a0[0], yMid, a0[1]], [a1[0], yMid, a1[1]], [a1[0], yFar, a1[1]], [a0[0], yFar, a0[1]]);
      }
    }
  }
}
function stripWarnings(p) {
  const issues = [];
  const rIns = p.bracketHole / 2;
  const rSide = 3.5;
  const w = bracketWidth(p);
  if (p.ox + rIns + 0.6 > w) issues.push("Insert hole runs off the bracket.");
  if (p.bracketDepth < 8) issues.push("Depth must be at least 8 mm so the 7 mm cone fits on the side.");
  if (p.bracketHole > 12) issues.push("Bracket hole should be 12 mm or less.");
  const len = p.bracketPair === "tb" ? p.w : p.h;
  if (len < 25) issues.push("That edge is too short for a bracket.");
  const holes = typeof holeSpecs === "function" ? holeSpecs(p) : [];
  const avoid = p.bracketPair === "tb" ? holes.map((h) => ({ y: h.x, r: rIns })) : holes.map((h) => ({ y: h.y, r: rIns }));
  for (const y of mountYs(len, avoid, rSide)) {
    for (const a of avoid) {
      if (Math.abs(y - a.y) < a.r + rSide + 1.2)
        issues.push("A wood-screw hole would line up with a panel hole. Move the panel holes or use a longer edge.");
    }
  }
  if ((p.holeLayout || "four") === "pair" && p.bracketPair === "tb")
    issues.push("Top/bottom brackets with two holes on the same end leaves one rail with no panel holes.");
  return [...new Set(issues)];
}
function buildRailLR(p, side) {
  const mesh = new Mesh();
  const w = bracketWidth(p);
  const t = p.bracketDepth;
  const holes = (typeof holeSpecs === "function" ? holeSpecs(p) : []).filter((h) =>
    side === "left" ? h.x <= p.w / 2 : h.x > p.w / 2
  );
  const hx = side === "left" ? p.ox : w - p.ox;
  const mains = holes.map((h) => ({ x: hx, y: h.y, r: p.bracketHole / 2 }));
  const ys = mountYs(p.h, mains, 1.5);
  addRailBox(mesh, 0, 0, w, p.h, t, mains, "x", ys, 1.5, side === "left" ? "high" : "low");
  return mesh;
}
function buildRailTB(p, side) {
  const mesh = new Mesh();
  const w = bracketWidth(p);
  const t = p.bracketDepth;
  const holes = (typeof holeSpecs === "function" ? holeSpecs(p) : []).filter((h) =>
    side === "bot" ? h.y <= p.h / 2 : h.y > p.h / 2
  );
  const hy = side === "bot" ? p.oBot : w - p.oTop;
  const mains = holes.map((h) => ({ x: h.x, y: hy, r: p.bracketHole / 2 }));
  const xs = mountYs(p.w, mains.map((m) => ({ y: m.x, r: m.r })), 1.5);
  addRailBox(mesh, 0, 0, p.w, w, t, mains, "y", xs, 1.5, side === "bot" ? "high" : "low");
  return mesh;
}
function drawBrackets(ctx, p) {
  if (!p.bracketOn) return;
  const band = bracketWidth(p);
  const r = p.bracketHole / 2;
  const holes = typeof holeSpecs === "function" ? holeSpecs(p) : [];
  ctx.save();
  ctx.setLineDash([2.2, 1.4]);
  ctx.strokeStyle = "#ff4d4d";
  ctx.lineWidth = 0.4;
  ctx.fillStyle = "rgba(255,60,60,0.10)";
  const boxes = p.bracketPair === "tb"
    ? [[0, 0, p.w, band], [0, p.h - band, p.w, band]]
    : [[0, 0, band, p.h], [p.w - band, 0, band, p.h]];
  for (const [x, y, bw, bh] of boxes) {
    ctx.beginPath(); ctx.rect(x, y, bw, bh); ctx.fill(); ctx.stroke();
  }
  ctx.setLineDash([1.4, 1.1]);
  for (const h of holes) {
    ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
function syncBracketUi() {
  const on = !!(document.getElementById("bracketOn") || {}).checked;
  const row = document.getElementById("bracketRow");
  if (row) row.hidden = !on;
  const p = typeof params === "function" ? params() : { ox: 5, holeD: 4.3, w: 188, h: 145 };
  bracketParams(p);
  const hint = document.getElementById("bracketHint");
  if (hint && on) {
    const n = (p.bracketPair === "tb" ? p.w : p.h) > 70 ? 3 : 2;
    hint.textContent = "Block " + bracketWidth(p).toFixed(1) + " × " + p.bracketDepth.toFixed(1) + " mm. Inserts through the TOP. " + n + " × 3 mm wood holes through the SIDE with a 7 mm cone on the inner face. 3 STLs.";
  }
  const warn = document.getElementById("warn");
  if (warn && on) {
    const issues = stripWarnings(p);
    if (issues.length) warn.textContent = issues[0];
  }
}
function saveStlFile(mesh, name) {
  const blob = meshToStl(mesh, name);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 8000);
}
function downloadWithBrackets() {
  const { p, issues } = refresh();
  const plateBlock = issues.filter((s) => !s.includes("huge files"));
  if (plateBlock.length) {
    document.getElementById("warn").textContent = plateBlock[0];
    return;
  }
  const extra = p.bracketOn ? stripWarnings(p) : [];
  if (extra.length) document.getElementById("warn").textContent = extra[0];
  if (!p.bracketOn) {
    saveStlFile(buildMesh(p), filename(p));
    if (typeof bumpCounter === "function") bumpCounter();
    if (typeof updateMeta === "function") updateMeta(p, { file: filename(p) });
    return;
  }
  const base = filename(p).replace(/-brk(LR|TB)?/i, "").replace(/\.stl$/i, "");
  saveStlFile(buildMesh(p), base + ".stl");
  if (p.bracketPair === "tb") {
    saveStlFile(buildRailTB(p, "bot"), base + "-bracket-bottom.stl");
    saveStlFile(buildRailTB(p, "top"), base + "-bracket-top.stl");
  } else {
    saveStlFile(buildRailLR(p, "left"), base + "-bracket-left.stl");
    saveStlFile(buildRailLR(p, "right"), base + "-bracket-right.stl");
  }
  if (typeof bumpCounter === "function") bumpCounter();
  if (typeof updateMeta === "function") updateMeta(p, { file: base + " + 2 brackets" });
}

(function hookBrackets() {
  if (typeof params === "function" && !params._brk) {
    const orig = params;
    params = function () { return bracketParams(orig()); };
    params._brk = true;
  }
  if (typeof drawPreview === "function" && !drawPreview._brk) {
    const orig = drawPreview;
    drawPreview = function (p) {
      orig(p);
      const canvas = document.getElementById("view");
      if (!canvas || !p.bracketOn) return;
      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
      const pad = 36;
      const scale = Math.min((cssW - pad * 2) / p.w, (cssH - pad * 2) / p.h);
      const ox = (cssW - p.w * scale) / 2;
      const oy = (cssH - p.h * scale) / 2;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(ox, oy + p.h * scale);
      ctx.scale(scale, -scale);
      drawBrackets(ctx, p);
      ctx.restore();
    };
    drawPreview._brk = true;
  }
  if (typeof refresh === "function" && !refresh._brk) {
    const origR = refresh;
    refresh = function () { const out = origR(); syncBracketUi(); return out; };
    refresh._brk = true;
  }
  const bind = () => {
    const btn = document.getElementById("btnGo");
    if (btn && !btn._brk) {
      btn._brk = true;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        downloadWithBrackets();
      }, true);
    }
    ["bracketOn", "bracketPair", "bracketDepth", "bracketHole"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el._brk) return;
      el._brk = true;
      el.addEventListener(el.tagName === "SELECT" || el.type === "checkbox" ? "change" : "input", () => {
        syncBracketUi();
        if (typeof refresh === "function") refresh();
      });
    });
    syncBracketUi();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();

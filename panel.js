/* SimPlate — browser STL generator for blank flight-sim panels */

const SEG = 48;
const COUNTER_KEY = "simplate-simjim-panels-created";

const $ = (id) => document.getElementById(id);
const val = (id) => parseFloat($(id).value);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

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
  if (p.oBot < hr + 0.4) issues.push("Offset from the bottom must keep the hole on the plate.");
  if (p.ox * 2 >= p.w) issues.push("Side offset is too large for this width.");
  if (p.oTop + p.oBot >= p.h) issues.push("Top + bottom offsets leave no room between the holes.");
  if (p.pocketDepth < 0) issues.push("Pocket depth cannot be negative.");
  if (p.pocketDepth >= p.t - 0.6) issues.push("Pocket depth must leave at least 0.6 mm under the screw.");
  if (p.grainOn && p.grainW < 0.2) issues.push("Edge emboss width should be at least 0.2 mm.");
  if (p.grainOn && p.grainW * 2 >= Math.min(p.w, p.h)) issues.push("Edge emboss is too wide for this plate.");
  return issues;
}

function holeSpecs(p) {
  const rHole = p.holeD / 2;
  const rPocket = rHole + Math.max(0, p.pocketDist);
  const toBottom = p.oBot <= rPocket + 0.05;
  const toTop = p.oTop <= rPocket + 0.05;
  return [
    { x: p.ox, y: p.oBot, openX: "left", openY: toBottom ? "bottom" : null, rHole, rPocket },
    { x: p.w - p.ox, y: p.oBot, openX: "right", openY: toBottom ? "bottom" : null, rHole, rPocket },
    { x: p.w - p.ox, y: p.h - p.oTop, openX: "right", openY: toTop ? "top" : null, rHole, rPocket },
    { x: p.ox, y: p.h - p.oTop, openX: "left", openY: toTop ? "top" : null, rHole, rPocket },
  ];
}

class Mesh {
  constructor() {
    this.tris = [];
  }
  add(a, b, c) {
    this.tris.push([a, b, c]);
  }
  quad(a, b, c, d) {
    this.add(a, b, c);
    this.add(a, c, d);
  }
}

function circlePts(cx, cy, r, n, a0, a1) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
  }
  return pts;
}

function tube(mesh, cx, cy, r, z0, z1, invert = false) {
  const ring = circlePts(cx, cy, r, SEG, 0, Math.PI * 2).slice(0, SEG);
  for (let i = 0; i < SEG; i++) {
    const j = (i + 1) % SEG;
    const a = [ring[i][0], ring[i][1], z0];
    const b = [ring[j][0], ring[j][1], z0];
    const c = [ring[j][0], ring[j][1], z1];
    const d = [ring[i][0], ring[i][1], z1];
    if (invert) mesh.quad(a, d, c, b);
    else mesh.quad(a, b, c, d);
  }
}

function fanCap(mesh, ring, z, up) {
  capPolygon(mesh, ring, z, up);
}

function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  return a / 2;
}

function orient(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function pointInTri(p, a, b, c) {
  const o1 = orient(a, b, p);
  const o2 = orient(b, c, p);
  const o3 = orient(c, a, p);
  return !(o1 < -1e-12 && (o2 > 1e-12 || o3 > 1e-12) || o1 > 1e-12 && (o2 < -1e-12 || o3 < -1e-12) ||
    o2 < -1e-12 && o3 > 1e-12 || o2 > 1e-12 && o3 < -1e-12);
}

function isEar(pts, i) {
  const n = pts.length;
  const a = pts[(i + n - 1) % n], b = pts[i], c = pts[(i + 1) % n];
  const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (cross <= 1e-10) return false;
  for (let k = 0; k < n; k++) {
    if (k === (i + n - 1) % n || k === i || k === (i + 1) % n) continue;
    if (pointInTri(pts[k], a, b, c)) return false;
  }
  return true;
}

function capPolygon(mesh, ring, z, up) {
  const raw = [];
  for (const p of ring) {
    const last = raw[raw.length - 1];
    if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 1e-7) raw.push([p[0], p[1]]);
  }
  if (raw.length > 2 && Math.hypot(raw[0][0] - raw[raw.length - 1][0], raw[0][1] - raw[raw.length - 1][1]) < 1e-7) raw.pop();
  if (raw.length < 3) return;
  if (signedArea(raw) < 0) raw.reverse();
  const poly = raw;
  let guard = 0;
  while (poly.length > 3 && guard++ < 8000) {
    let cut = false;
    for (let i = 0; i < poly.length; i++) {
      if (!isEar(poly, i)) continue;
      const n = poly.length;
      const A = poly[(i + n - 1) % n], B = poly[i], C = poly[(i + 1) % n];
      const a = [A[0], A[1], z], b = [B[0], B[1], z], c = [C[0], C[1], z];
      if (up) mesh.add(a, b, c);
      else mesh.add(a, c, b);
      poly.splice(i, 1);
      cut = true;
      break;
    }
    if (!cut) break;
  }
  if (poly.length === 3) {
    const a = [poly[0][0], poly[0][1], z];
    const b = [poly[1][0], poly[1][1], z];
    const c = [poly[2][0], poly[2][1], z];
    if (up) mesh.add(a, b, c);
    else mesh.add(a, c, b);
  }
}

function centroid(ring) {
  let x = 0, y = 0;
  for (const p of ring) {
    x += p[0];
    y += p[1];
  }
  return [x / ring.length, y / ring.length];
}

function wallStrip(mesh, ring, z0, z1, invert = false) {
  for (let i = 0; i < ring.length - 1; i++) {
    const a = [ring[i][0], ring[i][1], z0];
    const b = [ring[i + 1][0], ring[i + 1][1], z0];
    const c = [ring[i + 1][0], ring[i + 1][1], z1];
    const d = [ring[i][0], ring[i][1], z1];
    if (invert) mesh.quad(a, d, c, b);
    else mesh.quad(a, b, c, d);
  }
}

/* Open inner arc of the pocket, CCW, in radians. */
function interiorArc(hh) {
  if (!hh.openY) {
    if (hh.openX === "left") return [-Math.PI / 2, Math.PI / 2];
    return [Math.PI / 2, (3 * Math.PI) / 2];
  }
  if (hh.openX === "left" && hh.openY === "bottom") return [0, Math.PI / 2];
  if (hh.openX === "right" && hh.openY === "bottom") return [Math.PI / 2, Math.PI];
  if (hh.openX === "right" && hh.openY === "top") return [Math.PI, (3 * Math.PI) / 2];
  return [(3 * Math.PI) / 2, Math.PI * 2];
}

function normAngle(a) {
  let t = a % (Math.PI * 2);
  if (t < 0) t += Math.PI * 2;
  return t;
}

function inArc(theta, a0, a1) {
  const t = normAngle(theta);
  const s = normAngle(a0);
  const e = normAngle(a1);
  if (s <= e) return t >= s - 1e-9 && t <= e + 1e-9;
  return t >= s - 1e-9 || t <= e + 1e-9;
}

function pocketRay(hh, theta, plateW, plateH) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const [a0, a1] = interiorArc(hh);
  if (inArc(theta, a0, a1)) return hh.rPocket;

  let tMax = 1e6;
  if (c > 1e-9) tMax = Math.min(tMax, (plateW - hh.x) / c);
  if (c < -1e-9) tMax = Math.min(tMax, (0 - hh.x) / c);
  if (s > 1e-9) tMax = Math.min(tMax, (plateH - hh.y) / s);
  if (s < -1e-9) tMax = Math.min(tMax, (0 - hh.y) / s);
  if (!isFinite(tMax) || tMax <= hh.rHole) return hh.rPocket;

  let lo = hh.rHole;
  let hi = tMax;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const x = hh.x + c * mid;
    const y = hh.y + s * mid;
    if (inPocket(hh, x, y, plateW, plateH)) lo = mid;
    else hi = mid;
  }
  return Math.max(hh.rHole + 0.05, lo);
}

function inPocket(hh, x, y, plateW, plateH) {
  if (x < -1e-6 || y < -1e-6 || x > plateW + 1e-6 || y > plateH + 1e-6) return false;
  if (Math.hypot(x - hh.x, y - hh.y) <= hh.rPocket + 1e-6) return true;
  const edgeX = hh.openX === "left" ? 0 : plateW;
  const xLo = Math.min(edgeX, hh.x);
  const xHi = Math.max(edgeX, hh.x);
  if (hh.openY) {
    const edgeY = hh.openY === "bottom" ? 0 : plateH;
    if (x >= xLo - 1e-6 && x <= xHi + 1e-6 && y >= Math.min(edgeY, hh.y) - 1e-6 && y <= Math.max(edgeY, hh.y) + 1e-6) return true;
    const yArm = hh.y + (hh.openY === "bottom" ? hh.rPocket : -hh.rPocket);
    if (x >= xLo - 1e-6 && x <= xHi + 1e-6 && y >= Math.min(hh.y, yArm) - 1e-6 && y <= Math.max(hh.y, yArm) + 1e-6) return true;
    const xArm = hh.x + (hh.openX === "left" ? hh.rPocket : -hh.rPocket);
    if (x >= Math.min(hh.x, xArm) - 1e-6 && x <= Math.max(hh.x, xArm) + 1e-6 && y >= Math.min(edgeY, hh.y) - 1e-6 && y <= Math.max(edgeY, hh.y) + 1e-6) return true;
    return false;
  }
  return x >= xLo - 1e-6 && x <= xHi + 1e-6 && y >= hh.y - hh.rPocket - 1e-6 && y <= hh.y + hh.rPocket + 1e-6;
}

function interiorChain(hh) {
  const [a0, a1] = interiorArc(hh);
  const R = hh.rPocket;
  const n = hh.openY ? Math.max(8, Math.round(SEG / 4)) : Math.max(12, Math.round(SEG / 2));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    pts.push([hh.x + Math.cos(t) * R, hh.y + Math.sin(t) * R]);
  }
  return pts;
}

function arcPts(hh, a0, a1, reverse = false) {
  const n = Math.max(8, Math.round(SEG / 4));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    pts.push([hh.x + Math.cos(t) * hh.rPocket, hh.y + Math.sin(t) * hh.rPocket]);
  }
  return reverse ? pts.reverse() : pts;
}

function topLoop(p, holes) {
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

function earcutFn() {
  if (typeof earcut === "function") return earcut;
  if (typeof require === "function") return require("./earcut.min.js");
  throw new Error("earcut missing");
}

function flattenPoly(outer, holes) {
  const coords = [];
  const holeIdx = [];
  for (const p of outer) coords.push(p[0], p[1]);
  let offset = outer.length;
  for (const hole of holes) {
    holeIdx.push(offset);
    for (const p of hole) coords.push(p[0], p[1]);
    offset += hole.length;
  }
  return { coords, holeIdx };
}

function earcutTris(outer, holes) {
  const { coords, holeIdx } = flattenPoly(outer, holes);
  const idx = earcutFn()(coords, holeIdx, 2);
  const tris = [];
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    tris.push([
      [coords[a * 2], coords[a * 2 + 1]],
      [coords[b * 2], coords[b * 2 + 1]],
      [coords[c * 2], coords[c * 2 + 1]],
    ]);
  }
  return tris;
}

function closeRing(ring) {
  if (!ring.length) return ring;
  const a = ring[0], b = ring[ring.length - 1];
  if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9) return ring;
  return ring.concat([a]);
}

function extrudeProfile(mesh, outer, holes, z0, z1) {
  const o = [];
  for (const p of outer) {
    const last = o[o.length - 1];
    if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 1e-8) o.push([p[0], p[1]]);
  }
  if (o.length > 2 && Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) < 1e-8) o.pop();
  if (o.length < 3) return;
  if (signedArea(o) < 0) o.reverse();
  const hs = (holes || []).map((hole) => {
    const r = [];
    for (const p of hole) {
      const last = r[r.length - 1];
      if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 1e-8) r.push([p[0], p[1]]);
    }
    if (r.length > 2 && Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) < 1e-8) r.pop();
    if (r.length > 2 && signedArea(r) > 0) r.reverse();
    return r;
  });
  const faces = earcutTris(o, hs);
  for (const [A, B, C] of faces) {
    mesh.add([A[0], A[1], z1], [B[0], B[1], z1], [C[0], C[1], z1]);
    mesh.add([A[0], A[1], z0], [C[0], C[1], z0], [B[0], B[1], z0]);
  }
  wallStrip(mesh, closeRing(o), z0, z1, false);
  for (const h of hs) wallStrip(mesh, closeRing(h), z0, z1, false);
}

function buildMesh(p) {
  const mesh = new Mesh();
  const holes = holeSpecs(p);
  const hasPocket = p.pocketDepth > 0.001 && p.pocketDist > 0.001;
  const zFloor = hasPocket ? Math.max(0.6, p.t - p.pocketDepth) : p.t;
  const rect = [[0, 0], [p.w, 0], [p.w, p.h], [0, p.h]];
  const rings = holes.map((hh) => holeRing(hh));

  extrudeProfile(mesh, rect, rings, 0, zFloor);
  if (hasPocket) extrudeProfile(mesh, topLoop(p, holes), [], zFloor, p.t);
  else extrudeProfile(mesh, rect, rings, zFloor, p.t);
  if (p.grainOn && p.grainD > 0) addRim(mesh, p, holes);
  return mesh;
}

function holeRing(hh) {
  return circlePts(hh.x, hh.y, hh.rHole, SEG, 0, Math.PI * 2).slice(0, SEG);
}

function stitchHoles(outer, holes) {
  let poly = outer.map((p) => [p[0], p[1]]);
  for (const hole of holes) {
    let best = Infinity, oi = 0, hi = 0;
    for (let i = 0; i < poly.length; i++) {
      for (let j = 0; j < hole.length; j++) {
        const d = Math.hypot(poly[i][0] - hole[j][0], poly[i][1] - hole[j][1]);
        if (d < best) { best = d; oi = i; hi = j; }
      }
    }
    const rot = hole.slice(hi).concat(hole.slice(0, hi));
    const bridge = poly[oi];
    poly = poly.slice(0, oi + 1).concat(rot).concat([rot[0], [bridge[0], bridge[1]]]).concat(poly.slice(oi + 1));
  }
  return poly;
}

function bottomFace(mesh, p, holes, z, up = false) {
  const xs = [0];
  const ys = [0];
  for (const hh of holes) {
    xs.push(clamp(hh.x - hh.rHole, 0, p.w), clamp(hh.x + hh.rHole, 0, p.w));
    ys.push(clamp(hh.y - hh.rHole, 0, p.h), clamp(hh.y + hh.rHole, 0, p.h));
  }
  xs.push(p.w);
  ys.push(p.h);
  const X = [...new Set(xs.map((v) => +v.toFixed(5)))].sort((a, b) => a - b);
  const Y = [...new Set(ys.map((v) => +v.toFixed(5)))].sort((a, b) => a - b);
  for (let i = 0; i < X.length - 1; i++) {
    for (let j = 0; j < Y.length - 1; j++) {
      const x0 = X[i], x1 = X[i + 1], y0 = Y[j], y1 = Y[j + 1];
      if (x1 - x0 < 1e-6 || y1 - y0 < 1e-6) continue;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const hit = holes.find((hh) => Math.hypot(cx - hh.x, cy - hh.y) < hh.rHole + 0.02);
      const a = [x0, y0, z], b = [x1, y0, z], c = [x1, y1, z], d = [x0, y1, z];
      if (!hit) {
        if (up) mesh.quad(a, b, c, d);
        else mesh.quad(a, d, c, b);
      } else {
        fillCellMinusCircle(mesh, x0, y0, x1, y1, z, hit.x, hit.y, hit.rHole, up);
      }
    }
  }
}

function fillCellMinusCircle(mesh, x0, y0, x1, y1, z, cx, cy, r, up) {
  const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const kept = corners.filter((p) => Math.hypot(p[0] - cx, p[1] - cy) >= r - 1e-7);
  const hits = [];
  for (const [ax, ay, bx, by] of [
    [x0, y0, x1, y0],
    [x1, y0, x1, y1],
    [x1, y1, x0, y1],
    [x0, y1, x0, y0],
  ]) {
    hits.push(...circleSegHits(cx, cy, r, ax, ay, bx, by));
  }
  const circ = [];
  for (let i = 0; i < SEG; i++) {
    const t = (i / SEG) * Math.PI * 2;
    const x = cx + Math.cos(t) * r;
    const y = cy + Math.sin(t) * r;
    if (x >= x0 - 1e-6 && x <= x1 + 1e-6 && y >= y0 - 1e-6 && y <= y1 + 1e-6) circ.push([x, y]);
  }
  let seed = [(x0 + x1) / 2, (y0 + y1) / 2];
  if (Math.hypot(seed[0] - cx, seed[1] - cy) < r + 0.2) {
    let best = corners[0], bd = -1;
    for (const q of corners) {
      const d = Math.hypot(q[0] - cx, q[1] - cy);
      if (d > bd) {
        bd = d;
        best = q;
      }
    }
    seed = best;
  }
  const uniq = [];
  for (const pt of [...kept, ...hits, ...circ]) {
    if (!uniq.some((q) => Math.hypot(q[0] - pt[0], q[1] - pt[1]) < 1e-4)) uniq.push(pt);
  }
  uniq.sort(
    (a, b) => Math.atan2(a[1] - seed[1], a[0] - seed[0]) - Math.atan2(b[1] - seed[1], b[0] - seed[0])
  );
  if (uniq.length < 3) return;
  for (let i = 0; i < uniq.length; i++) {
    const j = (i + 1) % uniq.length;
    const A = [seed[0], seed[1], z], B = [uniq[i][0], uniq[i][1], z], C = [uniq[j][0], uniq[j][1], z];
    const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    if (Math.abs(area) < 1e-10) continue;
    if (up) {
      if (area > 0) mesh.add(A, B, C);
      else mesh.add(A, C, B);
    } else if (area > 0) mesh.add(A, C, B);
    else mesh.add(A, B, C);
  }
}

function circleSegHits(cx, cy, r, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const fx = x1 - cx, fy = y1 - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  const out = [];
  if (disc < 0 || a === 0) return out;
  const s = Math.sqrt(disc);
  for (const t of [(-b - s) / (2 * a), (-b + s) / (2 * a)]) {
    if (t >= -1e-6 && t <= 1 + 1e-6) out.push([x1 + t * dx, y1 + t * dy]);
  }
  return out;
}

function pocketFloor(mesh, hh, w, h, z) {
  const n = SEG;
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * Math.PI * 2;
    const t1 = ((i + 1) / n) * Math.PI * 2;
    const r0 = pocketRay(hh, t0, w, h);
    const r1 = pocketRay(hh, t1, w, h);
    const i0 = [
      hh.x + Math.cos(t0) * hh.rHole,
      hh.y + Math.sin(t0) * hh.rHole,
      z,
    ];
    const i1 = [
      hh.x + Math.cos(t1) * hh.rHole,
      hh.y + Math.sin(t1) * hh.rHole,
      z,
    ];
    const o0 = [
      clamp(hh.x + Math.cos(t0) * r0, 0, w),
      clamp(hh.y + Math.sin(t0) * r0, 0, h),
      z,
    ];
    const o1 = [
      clamp(hh.x + Math.cos(t1) * r1, 0, w),
      clamp(hh.y + Math.sin(t1) * r1, 0, h),
      z,
    ];
    mesh.quad(i0, o0, o1, i1);
  }
}

function pocketInnerWall(mesh, hh, w, h, z0, z1) {
  /* Wall along the interior chain only — the edge-breakout sides are open. */
  const chain = interiorChain(hh);
  wallStrip(mesh, chain, z0, z1, true);
}

function addBox(mesh, x0, y0, x1, y1, z0, z1) {
  if (x1 - x0 < 1e-6 || y1 - y0 < 1e-6) return;
  const a = [x0, y0, z1], b = [x1, y0, z1], c = [x1, y1, z1], d = [x0, y1, z1];
  mesh.quad(a, b, c, d);
  mesh.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]);
  mesh.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  mesh.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
  mesh.quad([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]);
  mesh.quad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]);
}

function blockedIntervals(holes, edge, plateW, plateH) {
  const out = [];
  for (const hh of holes) {
    const R = hh.rPocket;
    if (edge === "left" && hh.openX === "left") {
      out.push(hh.openY === "bottom" ? [0, hh.y + R] : hh.openY === "top" ? [hh.y - R, plateH] : [hh.y - R, hh.y + R]);
    }
    if (edge === "right" && hh.openX === "right") {
      out.push(hh.openY === "bottom" ? [0, hh.y + R] : hh.openY === "top" ? [hh.y - R, plateH] : [hh.y - R, hh.y + R]);
    }
    if (edge === "bottom" && hh.openY === "bottom") out.push(hh.openX === "left" ? [0, hh.x + R] : [hh.x - R, plateW]);
    if (edge === "top" && hh.openY === "top") out.push(hh.openX === "left" ? [0, hh.x + R] : [hh.x - R, plateW]);
  }
  return mergeSpans(out);
}

function mergeSpans(spans) {
  const s = spans.map(([a, b]) => [Math.min(a, b), Math.max(a, b)]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [a, b] of s) {
    if (!out.length || a > out[out.length - 1][1] + 1e-6) out.push([a, b]);
    else out[out.length - 1][1] = Math.max(out[out.length - 1][1], b);
  }
  return out;
}

function freeSpans(start, end, blocked) {
  const out = [];
  let cur = start;
  for (const [a, b] of blocked) {
    if (b <= start || a >= end) continue;
    const lo = Math.max(start, a);
    const hi = Math.min(end, b);
    if (lo - cur > 1e-4) out.push([cur, lo]);
    cur = Math.max(cur, hi);
  }
  if (end - cur > 1e-4) out.push([cur, end]);
  return out;
}

function insetLoop(pts, dist) {
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i + n - 1) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    let e1x = curr[0] - prev[0], e1y = curr[1] - prev[1];
    let e2x = next[0] - curr[0], e2y = next[1] - curr[1];
    const l1 = Math.hypot(e1x, e1y) || 1;
    const l2 = Math.hypot(e2x, e2y) || 1;
    e1x /= l1; e1y /= l1; e2x /= l2; e2y /= l2;
    const n1x = -e1y, n1y = e1x;
    const n2x = -e2y, n2y = e2x;
    let nx = n1x + n2x, ny = n1y + n2y;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    const miter = 1 / Math.max(0.35, nx * n1x + ny * n1y);
    out.push([curr[0] + nx * dist * miter, curr[1] + ny * dist * miter]);
  }
  return out;
}

function addRim(mesh, p, holes) {
  const bw = Math.max(0.2, p.grainW);
  const d = p.grainD;
  if (d <= 0) return;
  const z0 = p.t;
  const z1 = p.t + d;
  const w = p.w, h = p.h;
  for (const [x0, x1] of freeSpans(0, w, blockedIntervals(holes, "bottom", w, h))) {
    addBox(mesh, x0, 0, x1, Math.min(bw, h), z0, z1);
  }
  for (const [x0, x1] of freeSpans(0, w, blockedIntervals(holes, "top", w, h))) {
    addBox(mesh, x0, Math.max(0, h - bw), x1, h, z0, z1);
  }
  for (const [y0, y1] of freeSpans(bw, h - bw, blockedIntervals(holes, "left", w, h))) {
    addBox(mesh, 0, y0, Math.min(bw, w), y1, z0, z1);
  }
  for (const [y0, y1] of freeSpans(bw, h - bw, blockedIntervals(holes, "right", w, h))) {
    addBox(mesh, Math.max(0, w - bw), y0, w, y1, z0, z1);
  }
}

function meshToStl(mesh, name) {
  const n = mesh.tris.length;
  const buf = new ArrayBuffer(84 + n * 50);
  const view = new DataView(buf);
  const hdr = new TextEncoder().encode(("SimPlate " + name).slice(0, 80));
  for (let i = 0; i < hdr.length; i++) view.setUint8(i, hdr[i]);
  view.setUint32(80, n, true);
  let o = 84;
  for (const [a, b, c] of mesh.tris) {
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const len = Math.hypot(nx, ny, nz) || 1;
    view.setFloat32(o, nx / len, true);
    view.setFloat32(o + 4, ny / len, true);
    view.setFloat32(o + 8, nz / len, true);
    for (let k = 0; k < 3; k++) {
      const v = [a, b, c][k];
      view.setFloat32(o + 12 + k * 12, v[0], true);
      view.setFloat32(o + 16 + k * 12, v[1], true);
      view.setFloat32(o + 20 + k * 12, v[2], true);
    }
    view.setUint16(o + 48, 0, true);
    o += 50;
  }
  return new Blob([buf], { type: "model/stl" });
}

function drawPocket(ctx, hh, p) {
  const R = hh.rPocket;
  const edgeX = hh.openX === "left" ? 0 : p.w;
  ctx.beginPath();
  if (!hh.openY) {
    ctx.moveTo(edgeX, hh.y - R);
    ctx.lineTo(hh.x, hh.y - R);
    if (hh.openX === "left") ctx.arc(hh.x, hh.y, R, -Math.PI / 2, Math.PI / 2, false);
    else ctx.arc(hh.x, hh.y, R, -Math.PI / 2, Math.PI / 2, true);
    ctx.lineTo(edgeX, hh.y + R);
    ctx.closePath();
  } else {
    const edgeY = hh.openY === "bottom" ? 0 : p.h;
    const xInner = hh.x + (hh.openX === "left" ? R : -R);
    const yInner = hh.y + (hh.openY === "bottom" ? R : -R);
    ctx.moveTo(edgeX, edgeY);
    ctx.lineTo(xInner, edgeY);
    ctx.lineTo(xInner, hh.y);
    if (hh.openX === "left" && hh.openY === "bottom") ctx.arc(hh.x, hh.y, R, 0, Math.PI / 2, false);
    else if (hh.openX === "right" && hh.openY === "bottom") ctx.arc(hh.x, hh.y, R, Math.PI, Math.PI / 2, true);
    else if (hh.openX === "right" && hh.openY === "top") ctx.arc(hh.x, hh.y, R, Math.PI, (3 * Math.PI) / 2, false);
    else ctx.arc(hh.x, hh.y, R, 0, (3 * Math.PI) / 2, true);
    ctx.lineTo(edgeX, yInner);
    ctx.closePath();
  }
  ctx.fillStyle = "#1a2834";
  ctx.fill();
}

function drawPreview(p) {
  const canvas = $("view");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const g = ctx.createLinearGradient(0, 0, 0, cssH);
  g.addColorStop(0, "#16344c");
  g.addColorStop(1, "#0b1d2b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cssW, cssH);

  const pad = 36;
  const scale = Math.min((cssW - pad * 2) / p.w, (cssH - pad * 2) / p.h);
  const ox = (cssW - p.w * scale) / 2;
  const oy = (cssH - p.h * scale) / 2;

  ctx.save();
  ctx.translate(ox, oy + p.h * scale);
  ctx.scale(scale, -scale);

  ctx.fillStyle = "#2a3f52";
  roundRect(ctx, 0, 0, p.w, p.h, 1.2);
  ctx.fill();

  if (p.grainOn && p.grainD > 0) {
    const bw = Math.max(0.2, p.grainW);
    ctx.fillStyle = "rgba(200, 220, 235, 0.28)";
    ctx.fillRect(0, 0, p.w, bw);
    ctx.fillRect(0, p.h - bw, p.w, bw);
    ctx.fillRect(0, bw, bw, p.h - 2 * bw);
    ctx.fillRect(p.w - bw, bw, bw, p.h - 2 * bw);
  }

  const holes = holeSpecs(p);
  if (p.pocketDepth > 0 && p.pocketDist > 0) {
    for (const hh of holes) drawPocket(ctx, hh, p);
  }
  for (const hh of holes) {
    ctx.beginPath();
    ctx.arc(hh.x, hh.y, hh.rHole, 0, Math.PI * 2);
    ctx.fillStyle = "#071018";
    ctx.fill();
    ctx.strokeStyle = "#6aa7c9";
    ctx.lineWidth = 0.25;
    ctx.stroke();
  }

  ctx.lineWidth = 0.45;
  ctx.strokeStyle = "#8ec6e6";
  roundRect(ctx, 0, 0, p.w, p.h, 1.2);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(200,220,235,0.85)";
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.fillText(`${fmt(p.w)} × ${fmt(p.h)} × ${fmt(p.t)} mm`, 14, cssH - 14);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fmt(n) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function updateMeta(p, extra = {}) {
  $("metaSize").textContent = `${fmt(p.w)} × ${fmt(p.h)} × ${fmt(p.t)} mm`;
  $("metaHoles").textContent = `Ø ${fmt(p.holeD)} · side ${fmt(p.ox)} · top ${fmt(p.oTop)} · bot ${fmt(p.oBot)}`;
  $("metaFile").textContent = extra.file || "—";
}

function filename(p) {
  return `simplate-${fmt(p.w)}x${fmt(p.h)}x${fmt(p.t)}-s${fmt(p.ox)}-t${fmt(p.oTop)}-b${fmt(p.oBot)}-h${fmt(p.holeD)}.stl`;
}

function refresh() {
  const p = params();
  const issues = validate(p);
  $("warn").textContent = issues[0] || "";
  drawPreview(p);
  updateMeta(p);
  return { p, issues };
}

function downloadStl() {
  const { p, issues } = refresh();
  const blocking = issues.filter((s) => !s.includes("huge files"));
  if (blocking.length) {
    $("warn").textContent = blocking[0];
    return;
  }
  const mesh = buildMesh(p);
  const name = filename(p);
  const blob = meshToStl(mesh, name);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  updateMeta(p, { file: `${name} · ${(blob.size / 1024).toFixed(1)} KB` });
  bumpCounter();
}

function loadExample() {
  $("width").value = 188;
  $("height").value = 145;
  $("thickness").value = 5;
  $("holeDia").value = 4.3;
  $("offsetX").value = 5;
  $("offsetTop").value = 5;
  $("offsetBottom").value = 5;
  $("pocketDist").value = 2.9;
  $("pocketDepth").value = 3.0;
  $("grainOn").checked = false;
  $("grainW").value = 1.2;
  $("grainD").value = 0.2;
  refresh();
}

async function bumpCounter() {
  const el = $("countNum");
  try {
    const res = await fetch("https://countapi.mileshilliard.com/api/v1/hit/" + COUNTER_KEY);
    const data = await res.json();
    const n = Number(data.value ?? data.count ?? data);
    if (!Number.isNaN(n)) {
      el.textContent = n.toLocaleString();
      localStorage.setItem(COUNTER_KEY, String(n));
      return;
    }
  } catch (e) { /* fall through */ }
  const local = Number(localStorage.getItem(COUNTER_KEY) || "0") + 1;
  localStorage.setItem(COUNTER_KEY, String(local));
  el.textContent = local.toLocaleString() + "*";
}

async function readCounter() {
  const el = $("countNum");
  const cached = localStorage.getItem(COUNTER_KEY);
  if (cached) el.textContent = Number(cached).toLocaleString();
  try {
    const res = await fetch("https://countapi.mileshilliard.com/api/v1/get/" + COUNTER_KEY);
    const data = await res.json();
    const n = Number(data.value ?? data.count ?? data);
    if (!Number.isNaN(n)) {
      el.textContent = n.toLocaleString();
      localStorage.setItem(COUNTER_KEY, String(n));
    }
  } catch (e) {
    if (!cached) el.textContent = "0";
  }
}

function bind() {
  for (const id of [
    "width", "height", "thickness", "holeDia", "offsetX", "offsetTop", "offsetBottom",
    "pocketDist", "pocketDepth", "grainW", "grainD", "grainOn",
  ]) {
    $(id).addEventListener("input", refresh);
    $(id).addEventListener("change", refresh);
  }
  $("btnGo").addEventListener("click", downloadStl);
  $("btnExample").addEventListener("click", loadExample);
  $("btnCopyIron").addEventListener("click", () => {
    const text = [
      "Bambu Studio ironing — SimPlate",
      "Ironing Type: Top surfaces",
      "Ironing Pattern: Rectilinear",
      "Ironing speed: 150 mm/s",
      "Ironing flow: 35 %",
      "Ironing line spacing: 0.15 mm",
      "Ironing inset: 0.21 mm",
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      $("btnCopyIron").textContent = "Copied";
      setTimeout(() => { $("btnCopyIron").textContent = "Copy settings"; }, 1500);
    });
  });
  window.addEventListener("resize", refresh);
  refresh();
  readCounter();
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", bind);
}
if (typeof module !== "undefined") {
  module.exports = { buildMesh, meshToStl, validate, filename, holeSpecs, topLoop, pocketRay, inPocket, capPolygon, stitchHoles, Mesh };
}

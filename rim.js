/* Overrides addRim so the lip follows each pocket U. Loaded after panel.js. */
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

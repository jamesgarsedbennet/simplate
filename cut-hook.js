/* Wire cutouts into preview, STL and SVG after the other scripts load. */
document.addEventListener("DOMContentLoaded", () => {
  if (typeof buildMesh === "function" && !buildMesh._cuts) {
    buildMesh = function (p) {
      const mesh = new Mesh();
      const holes = holeSpecs(p);
      const hasPocket = p.pocketDepth > 0.001 && p.pocketDist > 0.001;
      const zFloor = hasPocket ? Math.max(0.6, p.t - p.pocketDepth) : p.t;
      const rect = [[0, 0], [p.w, 0], [p.w, p.h], [0, p.h]];
      const through = typeof cutoutRings === "function" ? cutoutRings(p, true) : [];
      const dents = typeof cutoutRings === "function" ? cutoutRings(p, false) : [];
      const rings = holes.map((hh) => holeRing(hh)).concat(through);
      extrudeProfile(mesh, rect, rings, 0, zFloor);
      if (hasPocket) extrudeProfile(mesh, topLoop(p, holes), through.concat(dents), zFloor, p.t);
      else extrudeProfile(mesh, rect, rings.concat(dents), zFloor, p.t);
      if (p.grainOn && p.grainD > 0 && typeof addRim === "function") addRim(mesh, p, holes);
      return mesh;
    };
    buildMesh._cuts = true;
  }

  if (typeof drawPreview === "function" && !drawPreview._cuts) {
    const origDraw = drawPreview;
    drawPreview = function (p) {
      origDraw(p);
      if (typeof drawCutouts !== "function") return;
      const canvas = $("view");
      if (!canvas) return;
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
      drawCutouts(ctx, p);
      ctx.restore();
    };
    drawPreview._cuts = true;
  }

  if (typeof buildSvg === "function" && !buildSvg._cuts) {
    const origSvg = buildSvg;
    buildSvg = function (p) {
      let svg = origSvg(p);
      if (typeof cutoutCells !== "function") return svg;
      const cells = cutoutCells(p);
      if (!cells.length) return svg;
      const extra = ["  <g id=\"cut-windows\" fill=\"none\" stroke=\"#1a1a1a\" stroke-width=\"0.2\">"];
      for (const c of cells) {
        const rr = Math.min(c.r, c.w / 2, c.h / 2).toFixed(3);
        const y = (p.h - c.y - c.h).toFixed(3);
        extra.push("    <rect x=\"" + c.x.toFixed(3) + "\" y=\"" + y + "\" width=\"" + c.w.toFixed(3) + "\" height=\"" + c.h.toFixed(3) + "\" rx=\"" + rr + "\" ry=\"" + rr + "\"/>");
      }
      extra.push("  </g>");
      return svg.replace("</svg>", extra.join("\n") + "\n</svg>");
    };
    buildSvg._cuts = true;
  }
});

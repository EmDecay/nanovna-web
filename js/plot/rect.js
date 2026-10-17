// rect.js — rectangular views: |S11|, |S21|, SWR, phase.
// SPDX-License-Identifier: GPL-2.0-only
import { db, swr, phaseDeg, clamp, niceStep, fmtAxis, nearestIndex } from '../rf.js';
import { drawMarkerGlyph, cssVar } from './common.js';

export const VIEWS = {
  s11db: { label: '|S11| (dB)',    y: (sw, i) => db(sw.s11[2 * i], sw.s11[2 * i + 1]),       range: [-60, 0],    trace: 's11', autoscale: true },
  s21db: { label: '|S21| (dB)',    y: (sw, i) => db(sw.s21[2 * i], sw.s21[2 * i + 1]),       range: [-80, 10],   trace: 's21', autoscale: true },
  swr:   { label: 'SWR',           y: (sw, i) => swr(sw.s11[2 * i], sw.s11[2 * i + 1]),      range: [1, 10],     trace: 's11' },
  phase: { label: 'S11 phase (°)', y: (sw, i) => phaseDeg(sw.s11[2 * i], sw.s11[2 * i + 1]), range: [-180, 180], trace: 's11' },
};

/** Draw one rectangular view. Returns a geometry object for hit-testing. */
export function renderRect(ctx, W, H, view, sweep, held, markers, hover) {
  const V = VIEWS[view];
  const pad = { l: 58, r: 16, t: 14, b: 40 }, pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
  let [y0, y1] = V.range;
  if (V.autoscale) {
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < sweep.pts; i++) { const y = V.y(sweep, i); if (y > -200) { mn = Math.min(mn, y); mx = Math.max(mx, y); } }
    if (Number.isFinite(mn)) { y0 = Math.min(y0, Math.floor(mn / 10) * 10); y1 = Math.max(y1, Math.ceil(mx / 10) * 10); }
  }
  const sx = f => pad.l + (f - sweep.start) / (sweep.stop - sweep.start) * pw;
  const sy = y => pad.t + ph - (clamp(y, y0, y1) - y0) / (y1 - y0) * ph;
  const geom = { sx, sy, pad, pw, ph, fx: x => sweep.start + (x - pad.l) / pw * (sweep.stop - sweep.start), yOf: i => V.y(sweep, i) };

  ctx.font = '12px ' + cssVar('--font'); ctx.lineWidth = 1;
  ctx.strokeStyle = cssVar('--grid'); ctx.fillStyle = cssVar('--ink-2');
  const fs = niceStep(sweep.stop - sweep.start, 8);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let f = Math.ceil(sweep.start / fs) * fs; f <= sweep.stop + 1; f += fs) { const x = sx(f); ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke(); ctx.fillText(fmtAxis(f), x, pad.t + ph + 6); }
  const ys = niceStep(y1 - y0, 6);
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let y = Math.ceil(y0 / ys) * ys; y <= y1 + 1e-9; y += ys) { const yy = sy(y); ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(pad.l + pw, yy); ctx.stroke(); ctx.fillText(+y.toFixed(2), pad.l - 8, yy); }
  ctx.strokeStyle = cssVar('--axis'); ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + ph); ctx.lineTo(pad.l + pw, pad.t + ph); ctx.stroke();
  ctx.save(); ctx.translate(14, pad.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(V.label, 0, 0); ctx.restore();

  const trace = (s, col, dash) => {
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(dash); ctx.beginPath();
    for (let i = 0; i < s.pts; i++) { const x = sx(s.f[i]), y = sy(V.y(s, i)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]);
  };
  if (held && held.start === sweep.start && held.stop === sweep.stop) trace(held, cssVar('--held'), [5, 4]);
  trace(sweep, cssVar('--' + V.trace), []);

  markers.forEach((mf, k) => { const i = nearestIndex(sweep.f, mf); drawMarkerGlyph(ctx, sx(sweep.f[i]), sy(V.y(sweep, i)), k + 1); });
  if (hover != null) { const x = sx(sweep.f[hover]); ctx.strokeStyle = cssVar('--ink-3'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke(); ctx.setLineDash([]); }
  return geom;
}

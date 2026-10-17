// smith.js — Smith chart view of S11.
// SPDX-License-Identifier: GPL-2.0-only
import { nearestIndex } from '../rf.js';
import { drawMarkerGlyph, cssVar } from './common.js';

export function renderSmith(ctx, W, H, sweep, held, markers, hover, z0, overlay) {
  const R = Math.min(W, H) / 2 - 26, cx = W / 2, cy = H / 2;
  const gx = (re, im) => [cx + re * R, cy - im * R];
  ctx.font = '12px ' + cssVar('--font'); ctx.lineWidth = 1; ctx.strokeStyle = cssVar('--grid');
  for (const r of [0.2, 0.5, 1, 2, 5]) { const c = r / (1 + r), rad = 1 / (1 + r); ctx.beginPath(); ctx.arc(cx + c * R, cy, rad * R, 0, 2 * Math.PI); ctx.stroke(); }
  for (const x of [0.2, 0.5, 1, 2, 5]) for (const s of [1, -1]) {
    const rad = 1 / x; ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.clip();
    ctx.beginPath(); ctx.arc(cx + R, cy - s * rad * R, rad * R, 0, 2 * Math.PI); ctx.stroke(); ctx.restore();
  }
  ctx.strokeStyle = cssVar('--axis'); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
  ctx.fillStyle = cssVar('--ink-2'); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const r of [0, 0.2, 0.5, 1, 2, 5]) { const g = (r - 1) / (r + 1); ctx.fillText(String(+(r * z0).toFixed(1)), cx + g * R, cy + 4); }
  ctx.textAlign = 'left'; ctx.fillText('Ω', cx + R + 6, cy + 4);

  const trace = (s, col, dash) => {
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(dash); ctx.beginPath();
    for (let i = 0; i < s.pts; i++) { const [x, y] = gx(s.s11[2 * i], s.s11[2 * i + 1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]);
  };
  if (overlay) trace(overlay, cssVar('--overlay'), [2, 3]);
  if (held) trace(held, cssVar('--held'), [5, 4]);
  trace(sweep, cssVar('--s11'), []);
  const [x0, y0] = gx(sweep.s11[0], sweep.s11[1]);
  ctx.fillStyle = cssVar('--s11'); ctx.beginPath(); ctx.arc(x0, y0, 4, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = cssVar('--ink-2'); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('start', x0 + 7, y0 - 4);
  markers.forEach((mf, k) => { const i = nearestIndex(sweep.f, mf); const [x, y] = gx(sweep.s11[2 * i], sweep.s11[2 * i + 1]); drawMarkerGlyph(ctx, x, y, k + 1); });
  if (hover != null) { const [x, y] = gx(sweep.s11[2 * hover], sweep.s11[2 * hover + 1]); ctx.strokeStyle = cssVar('--marker'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 7, 0, 2 * Math.PI); ctx.stroke(); }
  return { smith: true, gx };
}

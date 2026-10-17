// export.js — CSV, Touchstone, PNG, device screenshot.
// SPDX-License-Identifier: GPL-2.0-only
import { db, phaseDeg, swr, gammaToZ } from '../rf.js';

export function download(name, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

/** Columns match nvnapython's save_scan_csv.py plus SWR / R / X. */
export function csvBlob(sw, z0) {
  const rows = [['freq_hz', 's11_re', 's11_im', 's11_db', 's11_phase_deg', 'swr', 'r_ohm', 'x_ohm', 's21_re', 's21_im', 's21_db', 's21_phase_deg']];
  for (let i = 0; i < sw.pts; i++) {
    const a = sw.s11[2 * i], b = sw.s11[2 * i + 1], c = sw.s21[2 * i], d = sw.s21[2 * i + 1], z = gammaToZ(a, b, z0);
    rows.push([sw.f[i], a.toFixed(6), b.toFixed(6), db(a, b).toFixed(3), phaseDeg(a, b).toFixed(3), swr(a, b).toFixed(4), z.r.toFixed(3), z.x.toFixed(3), c.toFixed(6), d.toFixed(6), db(c, d).toFixed(3), phaseDeg(c, d).toFixed(3)]);
  }
  return new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
}

export function touchstoneBlob(sw, z0, ports, comment) {
  const L = [`! nanoVNA Web ${stamp()} — ${comment}`];
  if (ports === 2) L.push('! Measured: S11, S21. S12 is a copy of S21 (reciprocal assumption) and S22 a copy of S11 (symmetric assumption); the NanoVNA does not measure them.');
  L.push(`# Hz S RI R ${z0}`);
  for (let i = 0; i < sw.pts; i++) {
    const a = sw.s11[2 * i].toFixed(6), b = sw.s11[2 * i + 1].toFixed(6), c = sw.s21[2 * i].toFixed(6), d = sw.s21[2 * i + 1].toFixed(6);
    L.push(ports === 1 ? `${sw.f[i]} ${a} ${b}` : `${sw.f[i]} ${a} ${b} ${c} ${d} ${c} ${d} ${a} ${b}`);
  }
  return new Blob([L.join('\n') + '\n'], { type: 'text/plain' });
}

export function canvasPng(canvas, name) { canvas.toBlob(b => download(name, b), 'image/png'); }

export function rgbaToPngDownload({ width, height, rgba }, name) {
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(width, height); img.data.set(rgba); ctx.putImageData(img, 0, 0);
  canvasPng(c, name);
}

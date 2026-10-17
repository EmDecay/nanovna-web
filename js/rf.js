// rf.js — pure RF math and formatting. No DOM, no state.
// SPDX-License-Identifier: GPL-2.0-only

export const clamp = (v, a, b) => Math.min(b, Math.max(a, Number.isFinite(v) ? v : a));

/** 20·log10|Γ|; -240 for a true zero (keeps the frequency axis aligned, as in nvnapython). */
export const db = (re, im) => { const m = Math.hypot(re, im); return m > 0 ? 20 * Math.log10(m) : -240; };
export const phaseDeg = (re, im) => Math.atan2(im, re) * 180 / Math.PI;
export const swr = (re, im) => { const m = Math.min(0.999999, Math.hypot(re, im)); return (1 + m) / (1 - m); };

/** Γ → Z = Z0 (1+Γ)/(1−Γ). Returns { r, x } in ohms. */
export function gammaToZ(re, im, z0 = 50) {
  const dre = 1 - re, dim = -im, d = dre * dre + dim * dim;
  const nre = 1 + re, nim = im;
  return { r: z0 * (nre * dre + nim * dim) / d, x: z0 * (nim * dre - nre * dim) / d };
}

export function fmtHz(f, digits = 3) {
  if (!Number.isFinite(f)) return '—';
  if (f >= 1e9) return (f / 1e9).toFixed(digits) + ' GHz';
  if (f >= 1e6) return (f / 1e6).toFixed(digits) + ' MHz';
  if (f >= 1e3) return (f / 1e3).toFixed(1) + ' kHz';
  return f.toFixed(0) + ' Hz';
}
/** Short axis label: drop trailing zeros ("1.5 GHz", "200 MHz"). */
export const fmtAxis = f => fmtHz(f).replace(/\.?0+ (\w)/, ' $1');
export const fmtZ = ({ r, x }) => `${r.toFixed(1)} ${x >= 0 ? '+' : '−'} j${Math.abs(x).toFixed(1)} Ω`;

export function nearestIndex(freqs, fHz) {
  let b = 0, bd = Infinity;
  for (let i = 0; i < freqs.length; i++) { const d = Math.abs(freqs[i] - fHz); if (d < bd) { bd = d; b = i; } }
  return b;
}
export function minSwrIndex(sweep) {
  let b = 0, bv = Infinity;
  for (let i = 0; i < sweep.pts; i++) { const v = swr(sweep.s11[2 * i], sweep.s11[2 * i + 1]); if (v < bv) { bv = v; b = i; } }
  return b;
}
export function niceStep(range, target) {
  const raw = range / target, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

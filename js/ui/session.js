// session.js — save/load the page state as JSON; load a Touchstone file as an overlay.
// SPDX-License-Identifier: GPL-2.0-only

const pack = sw => sw && { pts: sw.pts, start: sw.start, stop: sw.stop, t: sw.t, ms: sw.ms, f: Array.from(sw.f), s11: Array.from(sw.s11), s21: Array.from(sw.s21) };
const unpack = o => o && { ...o, f: Float64Array.from(o.f), s11: Float64Array.from(o.s11), s21: Float64Array.from(o.s21) };

export function sessionBlob({ sweep, held, overlay, markers, settings, model, ident, appVersion }) {
  const data = { tool: 'nanovna-web', version: appVersion, when: new Date().toISOString(), model, ident, markers, settings, sweep: pack(sweep), held: pack(held), overlay: overlay && { name: overlay.name, sweep: pack(overlay.sweep) } };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}
export function parseSession(text) {
  const d = JSON.parse(text);
  if (d.tool !== 'nanovna-web') throw new Error('not a nanoVNA Web session file');
  return { ...d, sweep: unpack(d.sweep), held: unpack(d.held), overlay: d.overlay && { name: d.overlay.name, sweep: unpack(d.overlay.sweep) } };
}

/**
 * Minimal Touchstone v1 reader (.s1p / .s2p): handles RI / MA / DB formats and
 * Hz/kHz/MHz/GHz. Returns a sweep-shaped object with s21 zero for .s1p.
 */
export function parseTouchstone(text, name = 'overlay') {
  let unit = 1e9, fmt = 'MA', z0 = 50;
  const f = [], s11 = [], s21 = [];
  for (let raw of text.split(/\r?\n/)) {
    const line = raw.replace(/!.*$/, '').trim(); if (!line) continue;
    if (line.startsWith('#')) {
      const t = line.slice(1).trim().split(/\s+/).map(x => x.toUpperCase());
      for (let i = 0; i < t.length; i++) { if (['HZ', 'KHZ', 'MHZ', 'GHZ'].includes(t[i])) unit = { HZ: 1, KHZ: 1e3, MHZ: 1e6, GHZ: 1e9 }[t[i]]; if (['RI', 'MA', 'DB'].includes(t[i])) fmt = t[i]; if (t[i] === 'R' && t[i + 1]) z0 = parseFloat(t[i + 1]); }
      continue;
    }
    const v = line.split(/\s+/).map(Number); if (v.length < 3 || v.some(x => !Number.isFinite(x))) continue;
    const toRI = (a, b) => fmt === 'RI' ? [a, b] : fmt === 'MA' ? [a * Math.cos(b * Math.PI / 180), a * Math.sin(b * Math.PI / 180)] : [Math.pow(10, a / 20) * Math.cos(b * Math.PI / 180), Math.pow(10, a / 20) * Math.sin(b * Math.PI / 180)];
    f.push(v[0] * unit); s11.push(...toRI(v[1], v[2])); s21.push(...(v.length >= 5 ? toRI(v[3], v[4]) : [0, 0]));
  }
  if (!f.length) throw new Error('no data lines found');
  return { name, z0, sweep: { pts: f.length, start: f[0], stop: f[f.length - 1], t: Date.now(), ms: 0, f: Float64Array.from(f), s11: Float64Array.from(s11), s21: Float64Array.from(s21) } };
}

export function pickFile(accept) {
  return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => res(i.files[0] || null); i.click(); });
}

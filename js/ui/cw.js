// cw.js — single-frequency meter: big-number readout, updates continuously.
// SPDX-License-Identifier: GPL-2.0-only
import { db, swr, gammaToZ, fmtHz } from '../rf.js';

export function initCw(root, getVna, getZ0, con) {
  const freq = root.querySelector('#cwFreq'), runBtn = root.querySelector('#cwRun');
  const out = { s11: root.querySelector('#cwS11'), swr: root.querySelector('#cwSwr'), z: root.querySelector('#cwZ'), s21: root.querySelector('#cwS21'), f: root.querySelector('#cwF'), rate: root.querySelector('#cwRate') };
  const st = { running: false, last: null };

  async function loop() {
    while (st.running) {
      const vna = getVna(); if (!vna) break;
      try {
        const hz = parseFloat(freq.value) * 1e6;
        const m = await vna.measureAt(hz);
        st.last = m;
        const [re, im] = m.s11, z = gammaToZ(re, im, getZ0());
        out.f.textContent = fmtHz(hz); out.s11.textContent = db(re, im).toFixed(2); out.swr.textContent = swr(re, im).toFixed(3);
        out.z.textContent = `${z.r.toFixed(1)} ${z.x >= 0 ? '+' : '−'} j${Math.abs(z.x).toFixed(1)}`;
        out.s21.textContent = db(m.s21[0], m.s21[1]).toFixed(2); out.rate.textContent = `${m.ms.toFixed(0)} ms per reading`;
      } catch (e) { con.err('CW read failed: ' + e.message); await new Promise(r => setTimeout(r, 500)); }
    }
    runBtn.textContent = 'Start'; runBtn.classList.remove('running'); runBtn.setAttribute('aria-pressed', 'false');
  }
  runBtn.addEventListener('click', async () => {
    st.running = !st.running;
    if (st.running) {
      runBtn.textContent = 'Stop'; runBtn.classList.add('running'); runBtn.setAttribute('aria-pressed', 'true');
      const vna = getVna(); if (vna) { try { await vna.cwfreq(parseFloat(freq.value) * 1e6); } catch {} }   // mirror on the device's own screen
      loop();
    } else { st.running = false; }
  });
  return { stop: () => { st.running = false; }, state: st, setEnabled: on => { runBtn.disabled = !on; if (!on) st.running = false; } };
}

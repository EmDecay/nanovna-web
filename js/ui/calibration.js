// calibration.js — device-side SOLT calibration, slots, edelay. Mirrors
// nvnapython's solt_calibration.py as a step-through panel.
// SPDX-License-Identifier: GPL-2.0-only

const STEPS = [
  { key: 'open',  label: 'Open',  prompt: 'Connect the OPEN standard to port 1, then click.' },
  { key: 'short', label: 'Short', prompt: 'Connect the SHORT standard to port 1, then click.' },
  { key: 'load',  label: 'Load',  prompt: 'Connect the LOAD (50 Ω) standard to port 1, then click.' },
  { key: 'thru',  label: 'Thru',  prompt: 'Connect port 1 to port 2 with the THRU, then click. Skip for S11-only work.' },
];

export function initCalibration(root, getVna, con, hooks = {}) {
  const badge = root.querySelector('#calBadge'), prompt = root.querySelector('#calPrompt');
  const stepBtns = Object.fromEntries(STEPS.map(s => [s.key, root.querySelector(`[data-cal="${s.key}"]`)]));
  const done = {};
  const state = { on: null };       // null = unknown until the page sends something

  function setBadge() {
    badge.textContent = state.on === null ? 'cal: unknown' : state.on ? 'cal: ON (sent by page)' : 'cal: OFF (sent by page)';
    badge.className = 'badge ' + (state.on === null ? '' : state.on ? 'ok' : 'warn');
  }
  function setEnabled(on) { root.querySelectorAll('button, input, select').forEach(e => e.disabled = !on); }
  async function run(fn, label) {
    const vna = getVna(); if (!vna) return;
    setEnabled(false);
    try { await fn(vna); } catch (e) { con.err(`${label} failed: ${e.message}`); }
    finally { setEnabled(true); }
  }

  const rangeEl = root.querySelector('#calRange');
  async function showRange(vna) { if (hooks.currentSweep && rangeEl) rangeEl.textContent = 'Calibrating on the device sweep: ' + await hooks.currentSweep(vna) + '. Measure with the same range and point count.'; }
  for (const s of STEPS) {
    stepBtns[s.key].addEventListener('click', () => run(async vna => {
      if (hooks.beforeStep) await hooks.beforeStep(vna);
      if (!done.open && !done.short && !done.load && !done.thru) await showRange(vna);
      prompt.textContent = `Measuring ${s.label}…`;
      await vna.cal(s.key); done[s.key] = true; stepBtns[s.key].classList.add('done');
      const next = STEPS.find(x => !done[x.key]);
      prompt.textContent = next ? next.prompt : 'All standards measured. Click Done to apply.';
    }, `cal ${s.key}`));
  }
  root.querySelector('[data-cal="done"]').addEventListener('click', () => run(async vna => {
    if (hooks.beforeStep) await hooks.beforeStep(vna);
    await vna.cal('done'); state.on = true; setBadge(); prompt.textContent = 'Calibration applied. Save it to a slot to keep it after power-off.';
  }, 'cal done'));
  root.querySelector('[data-cal="reset"]').addEventListener('click', () => run(async vna => {
    await vna.cal('reset'); state.on = false; for (const k in done) delete done[k]; STEPS.forEach(s => stepBtns[s.key].classList.remove('done'));
    setBadge(); prompt.textContent = STEPS[0].prompt;
  }, 'cal reset'));
  root.querySelector('[data-cal="on"]').addEventListener('click', () => run(async vna => { await vna.cal('on'); state.on = true; setBadge(); }, 'cal on'));
  root.querySelector('[data-cal="off"]').addEventListener('click', () => run(async vna => { await vna.cal('off'); state.on = false; setBadge(); }, 'cal off'));
  root.querySelector('#calSave').addEventListener('click', () => run(async vna => {
    const slot = +root.querySelector('#calSlot').value;
    const risky = vna.model === 'NANOVNA_F_V3';
    const msg = risky
      ? `On the NanoVNA-F V3 (fw 0.5.8) "save" over USB has been seen to freeze the device until it is power-cycled. The safer way is the device's own menu: CAL → SAVE ${slot}.\n\nSend "save ${slot}" anyway?`
      : `Send "save ${slot}"? This command returns no prompt on the F V2; the page will probe the console afterwards.`;
    if (!confirm(msg)) return;
    prompt.textContent = `Saving to slot ${slot}…`;
    const r = await vna.save(slot);
    if (r.alive) { prompt.textContent = `Saved to slot ${slot}. Console still responding.`; con.dim(`save ${slot}: console alive`); }
    else { prompt.textContent = `Device stopped responding after save ${slot}. Power-cycle it, then Connect again and check CAL → RECALL ${slot} on the device.`; if (hooks.onWedged) hooks.onWedged(); }
  }, 'save'));
  root.querySelector('#calRecall').addEventListener('click', () => run(async vna => {
    const slot = +root.querySelector('#calSlot').value; await vna.recall(slot); state.on = true; setBadge(); prompt.textContent = `Recalled slot ${slot}.`;
  }, 'recall'));
  root.querySelector('#edelayGet').addEventListener('click', () => run(async vna => { root.querySelector('#edelay').value = await vna.edelay(); }, 'edelay'));
  root.querySelector('#edelaySet').addEventListener('click', () => run(async vna => { await vna.edelay(root.querySelector('#edelay').value.trim()); }, 'edelay'));

  prompt.textContent = STEPS[0].prompt; setBadge(); setEnabled(false);
  return { setEnabled, state, reset() { for (const k in done) delete done[k]; STEPS.forEach(s => stepBtns[s.key].classList.remove('done')); state.on = null; setBadge(); prompt.textContent = STEPS[0].prompt; } };
}

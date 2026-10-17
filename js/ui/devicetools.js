// devicetools.js — maintenance commands that need you at the device: touch
// calibration, touch test, resolution readback.
// SPDX-License-Identifier: GPL-2.0-only

export function initDeviceTools(root, getVna, con) {
  const status = root.querySelector('#toolsStatus');
  const buttons = root.querySelectorAll('button');
  async function run(label, fn) {
    const vna = getVna(); if (!vna) return;
    buttons.forEach(b => b.disabled = true); status.textContent = `${label}… watch the device screen.`;
    try { const r = await fn(vna); status.textContent = `${label}: done.` + (typeof r === 'string' && r ? ` ${r}` : ''); }
    catch (e) { status.textContent = `${label} failed: ${e.message}`; con.err(e.message); }
    finally { buttons.forEach(b => b.disabled = false); }
  }
  root.querySelector('#touchCal').addEventListener('click', () => { if (confirm('Touch calibration runs on the device screen and asks you to tap targets. Continue?')) run('Touch calibration', v => v.touchCal()); });
  root.querySelector('#touchTest').addEventListener('click', () => run('Touch test', v => v.touchTest()));
  root.querySelector('#resRead').addEventListener('click', () => run('Resolution', async v => await v.resolution()));
  return { setEnabled: on => buttons.forEach(b => b.disabled = !on) };
}

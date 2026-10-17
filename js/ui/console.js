// console.js — the device console drawer: log, collapsing long replies,
// command input with history, resize handle, copy/clear.
// SPDX-License-Identifier: GPL-2.0-only

const COLLAPSE_AFTER = 12;
const MAX_ENTRIES = 600;

export function initConsole({ log, form, input, handle, drawer, clearBtn, copyBtn }, onSend) {
  const history = []; let hIdx = -1;
  const entries = [];

  function scroll() { log.scrollTop = log.scrollHeight; }
  function trim() { while (log.childElementCount > MAX_ENTRIES) log.firstChild.remove(); }

  function line(text, cls) {
    const el = document.createElement('div'); if (cls) el.className = cls; el.textContent = text;
    log.appendChild(el); entries.push(text); trim(); scroll();
  }
  /** A multi-line reply: shows the first N lines with a toggle for the rest. */
  function reply(body, meta) {
    const lines = body.split('\n').filter(l => l.length);
    const wrap = document.createElement('div'); wrap.className = 'reply';
    if (lines.length <= COLLAPSE_AFTER) { wrap.textContent = lines.join('\n'); }
    else {
      const head = document.createElement('div'); head.textContent = lines.slice(0, COLLAPSE_AFTER).join('\n');
      const rest = document.createElement('div'); rest.textContent = lines.slice(COLLAPSE_AFTER).join('\n'); rest.hidden = true;
      const tog = document.createElement('button'); tog.type = 'button'; tog.className = 'toggle';
      tog.textContent = `… show all ${lines.length} lines`;
      tog.addEventListener('click', () => { rest.hidden = !rest.hidden; tog.textContent = rest.hidden ? `… show all ${lines.length} lines` : 'show less'; });
      wrap.append(head, tog, rest);
    }
    if (meta && meta.ms != null) { const m = document.createElement('span'); m.className = 'dim'; m.textContent = `  (${meta.ms.toFixed(0)} ms, ${lines.length} line${lines.length === 1 ? '' : 's'})`; wrap.appendChild(m); }
    log.appendChild(wrap); entries.push(body); trim(); scroll();
  }

  form.addEventListener('submit', e => {
    e.preventDefault(); const cmd = input.value.trim(); if (!cmd) return;
    history.unshift(cmd); if (history.length > 50) history.pop(); hIdx = -1; input.value = '';
    onSend(cmd);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') { e.preventDefault(); if (hIdx < history.length - 1) { hIdx++; input.value = history[hIdx]; } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (hIdx > 0) { hIdx--; input.value = history[hIdx]; } else { hIdx = -1; input.value = ''; } }
  });
  clearBtn.addEventListener('click', () => { log.innerHTML = ''; entries.length = 0; });
  copyBtn.addEventListener('click', async () => { try { await navigator.clipboard.writeText(log.innerText); copyBtn.textContent = 'Copied'; setTimeout(() => copyBtn.textContent = 'Copy', 1200); } catch { line('clipboard unavailable', 'err'); } });

  // drag to resize
  let dragging = false, startY = 0, startH = 0;
  const saved = parseInt(localStorage.getItem('nanovna-web.consoleH') || '', 10);
  if (saved > 120) log.style.height = saved + 'px';
  handle.addEventListener('pointerdown', e => { dragging = true; startY = e.clientY; startH = log.getBoundingClientRect().height; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointermove', e => { if (!dragging) return; const h = Math.max(120, Math.min(800, startH + (e.clientY - startY))); log.style.height = h + 'px'; });
  handle.addEventListener('pointerup', () => { dragging = false; try { localStorage.setItem('nanovna-web.consoleH', String(Math.round(log.getBoundingClientRect().height))); } catch {} });

  return { line, reply, tx: cmd => line('> ' + cmd, 'tx'), err: t => line(t, 'err'), dim: t => line(t, 'dim'), focus: () => input.focus(), setEnabled: on => { input.disabled = !on; form.querySelector('button[type=submit]').disabled = !on; } };
}

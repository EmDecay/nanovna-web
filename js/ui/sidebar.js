// sidebar.js — accordion sections; one open at a time, remembered.
// SPDX-License-Identifier: GPL-2.0-only

export function initSidebar(root) {
  const sections = [...root.querySelectorAll('section[data-section]')];
  const KEY = 'nanovna-web.section';
  let current = localStorage.getItem(KEY) || sections[0].dataset.section;
  function open(name) {
    current = name;
    for (const s of sections) { const on = s.dataset.section === name; s.classList.toggle('open', on); s.querySelector('h2 button').setAttribute('aria-expanded', String(on)); }
    try { localStorage.setItem(KEY, name || ''); } catch {}
  }
  // clicking the open section's header collapses it (the "−")
  for (const s of sections) s.querySelector('h2 button').addEventListener('click', () => open(current === s.dataset.section ? null : s.dataset.section));
  open(sections.some(s => s.dataset.section === current) ? current : sections[0].dataset.section);
  return { open };
}

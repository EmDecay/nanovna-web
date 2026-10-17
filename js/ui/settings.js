// settings.js — persisted user settings (localStorage) and the Settings panel.
// SPDX-License-Identifier: GPL-2.0-only
import { PALETTES, DEFAULT_PALETTE, cssGradient } from '../plot/palettes.js';

const KEY = 'nanovna-web.settings';
const DEFAULTS = {
  theme: 'dark',          // 'dark' | 'light'
  traces: 'instrument',   // 'instrument' (yellow/cyan) | 'blueamber'
  palette: DEFAULT_PALETTE,
  wfFloor: -40,           // waterfall colour floor, dB
  z0: 50,
  rawBytes: false,        // echo every received chunk in the console
  maxMarkers: 6,
};

export const settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
settings.maxMarkers = DEFAULTS.maxMarkers;   // not user-editable yet

export function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {} }

/** Apply theme + trace scheme to the document. */
export function applyTheme() {
  const root = document.documentElement;
  root.setAttribute('data-theme', settings.theme);
  root.setAttribute('data-traces', settings.traces);
}

/** Wire the settings form. onChange(key) is called after any change. */
export function initSettingsPanel(form, onChange) {
  const sel = form.querySelector('[name=palette]');
  sel.innerHTML = Object.entries(PALETTES).map(([k, p]) => `<option value="${k}">${p.name}</option>`).join('');
  const swatch = form.querySelector('.palette-swatch');
  const refresh = () => {
    form.querySelector(`[name=theme][value=${settings.theme}]`).checked = true;
    form.querySelector(`[name=traces][value=${settings.traces}]`).checked = true;
    sel.value = settings.palette; swatch.style.background = cssGradient(settings.palette);
    form.querySelector('[name=wfFloor]').value = String(settings.wfFloor);
    form.querySelector('[name=z0]').value = settings.z0;
    form.querySelector('[name=rawBytes]').checked = settings.rawBytes;
  };
  refresh();
  form.addEventListener('change', e => {
    const el = e.target, n = el.name; if (!n) return;
    if (el.type === 'checkbox') settings[n] = el.checked;
    else if (n === 'wfFloor') settings[n] = parseInt(el.value, 10);
    else if (n === 'z0') settings[n] = Math.max(1, parseFloat(el.value) || 50);
    else settings[n] = el.value;
    save(); applyTheme(); swatch.style.background = cssGradient(settings.palette); onChange(n);
  });
  form.addEventListener('submit', e => e.preventDefault());
}

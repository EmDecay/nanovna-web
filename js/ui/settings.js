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
  beepDone: false,        // device beep after every sweep
  beepSwr: false,         // device beep when min SWR drops below threshold
  swrThreshold: 1.5,
  beepBrowser: true,      // also play a tone in the browser (demo has no speaker)
  brightness: 1.0,        // pwm 0..1, sent on connect and on change
  mirrorTrace: false,     // set device trace 0 to match the page view
  overlayShow: true,      // draw the loaded .s1p overlay
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
    for (const k of ['beepDone', 'beepSwr', 'beepBrowser', 'mirrorTrace', 'overlayShow']) form.querySelector(`[name=${k}]`).checked = settings[k];
    form.querySelector('[name=swrThreshold]').value = settings.swrThreshold;
    form.querySelector('[name=brightness]').value = settings.brightness;
  };
  refresh();
  form.addEventListener('change', e => {
    const el = e.target, n = el.name; if (!n) return;
    if (el.type === 'checkbox') settings[n] = el.checked;
    else if (n === 'wfFloor') settings[n] = parseInt(el.value, 10);
    else if (n === 'z0') settings[n] = Math.max(1, parseFloat(el.value) || 50);
    else if (n === 'swrThreshold') settings[n] = Math.max(1, parseFloat(el.value) || 1.5);
    else if (n === 'brightness') settings[n] = Math.min(1, Math.max(0, parseFloat(el.value)));
    else settings[n] = el.value;
    save(); applyTheme(); swatch.style.background = cssGradient(settings.palette); onChange(n);
  });
  form.addEventListener('submit', e => e.preventDefault());
}

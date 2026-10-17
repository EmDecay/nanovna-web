// main.js — application state and wiring. Everything else is a module.
// SPDX-License-Identifier: GPL-2.0-only
import { NanoVNA } from './device/nanovna.js';
import { SerialLink, hasWebSerial } from './device/serial-link.js';
import { DemoLink } from './device/demo-link.js';
import { MODELS, DEFAULT_MODEL, detectModel } from './device/models.js';
import { db, swr, gammaToZ, fmtHz, fmtZ, nearestIndex, minSwrIndex } from './rf.js';
import { renderRect, VIEWS } from './plot/rect.js';
import { renderSmith } from './plot/smith.js';
import { renderWaterfall, WATERFALL_ROWS } from './plot/waterfall.js';
import { buildLut, cssGradient } from './plot/palettes.js';
import { cssVar } from './plot/common.js';
import { settings, applyTheme, initSettingsPanel } from './ui/settings.js';
import { initConsole } from './ui/console.js';
import { initSidebar } from './ui/sidebar.js';
import { collectDiagnostics } from './ui/diagnostics.js';
import { download, stamp, csvBlob, touchstoneBlob, canvasPng, rgbaToPngDownload } from './ui/export.js';

const APP_VERSION = '0.2.0';
const $ = id => document.getElementById(id);

// ---------------------------------------------------------------- state
const state = {
  vna: null, demo: false,
  sweep: null, held: null, history: [], markers: [],
  view: 's11db', continuous: false, busy: false, diag: null,
  lut: buildLut(settings.palette),
};
const chart = { dirty: true, hover: null, geom: null };

applyTheme();
const sidebar = initSidebar($('sidebar'));
const con = initConsole({ log: $('log'), form: $('sendForm'), input: $('sendInput'), handle: $('conHandle'), drawer: $('console'), clearBtn: $('conClear'), copyBtn: $('conCopy') }, sendManual);

// ---------------------------------------------------------------- model / status
function setStatus(text, cls) { $('statusText').textContent = text; $('status').className = 'status ' + (cls || ''); }
function applyModel(key) {
  const m = MODELS[key]; if (!m) return;
  if (state.vna) state.vna.model = key;
  $('ptsMaxLabel').textContent = m.maxPts; $('ptsQuickLabel').textContent = m.quick;
  $('ptsCustom').min = m.minPts; $('ptsCustom').max = m.maxPts; if (+$('ptsCustom').value > m.maxPts) $('ptsCustom').value = m.maxPts;
  $('devRange').textContent = `${fmtHz(m.minHz)} – ${fmtHz(m.maxHz)}, ${m.minPts}–${m.maxPts} pts`;
}
function currentModel() { return state.vna ? state.vna.model : ($('modelSel').value === 'auto' ? DEFAULT_MODEL : $('modelSel').value); }
function setEnabled(on) {
  ['singleBtn', 'contBtn', 'diagBtn', 'shotBtn'].forEach(id => $(id).disabled = !on);
  con.setEnabled(on);
  $('demoBtn').disabled = on && !state.demo;
  $('connectBtn').textContent = on ? 'Disconnect' : 'Connect to NanoVNA';
}

// ---------------------------------------------------------------- connect
async function connect(demo) {
  if (state.vna) return;
  const link = demo ? new DemoLink() : new SerialLink();
  link.onTx = cmd => con.tx(cmd);
  link.onRx = (body, meta) => con.reply(body, meta);
  link.onRaw = bytes => { if (settings.rawBytes) con.dim('rx ' + bytes.length + ' B: ' + JSON.stringify(new TextDecoder().decode(bytes)).slice(0, 200)); };
  if (!demo) link.onDrop = e => { con.err('port error: ' + e.message); disconnect(true); };
  const vna = new NanoVNA(link);
  try {
    await link.open();
    if (demo) con.dim('demo NanoVNA-F V3 ready (no hardware)');
    const override = $('modelSel').value === 'auto' ? null : $('modelSel').value;
    await vna.identify(override);
    state.vna = vna; state.demo = demo;
    applyModel(vna.model);
    await vna.pause().catch(() => {});
    setStatus(`${demo ? 'Demo' : 'Connected'} · ${vna.ident.version.split('\n')[0]} · as ${vna.env.name}`, demo ? 'demo' : 'ok');
    setEnabled(true); chart.dirty = true;
  } catch (e) {
    con.err('connect failed: ' + e.message); setStatus('Connection failed — ' + e.message, 'err');
    try { await link.close(); } catch {}
  }
}
async function disconnect(silent) {
  if (!state.vna) return;
  const vna = state.vna; state.continuous = false; $('contBtn').setAttribute('aria-pressed', 'false');
  try { if (!silent) await vna.resume(); } catch {}
  await vna.link.close(); state.vna = null; state.demo = false;
  setEnabled(false); setStatus('Not connected', ''); chart.dirty = true;
}

// ---------------------------------------------------------------- sweep
function sweepParams() {
  const m = MODELS[currentModel()];
  const mode = document.querySelector('input[name=pts]:checked').value;
  const pts = mode === 'max' ? m.maxPts : mode === 'quick' ? m.quick : Math.round(+$('ptsCustom').value || m.maxPts);
  return { start: parseFloat($('fStart').value) * 1e6, stop: parseFloat($('fStop').value) * 1e6, pts: Math.min(Math.max(pts, m.minPts), m.maxPts) };
}
async function doSweep() {
  if (!state.vna || state.busy) return null;
  const { start, stop, pts } = sweepParams();
  state.busy = true; $('singleBtn').disabled = true;
  try {
    const sw = await state.vna.scan(start, stop, pts);
    state.sweep = sw;
    $('sweepTime').textContent = `${(sw.ms / 1000).toFixed(2)} s · ${sw.pts} pts`;
    const row = new Float32Array(sw.pts); for (let i = 0; i < sw.pts; i++) row[i] = db(sw.s11[2 * i], sw.s11[2 * i + 1]);
    if (state.history.length && state.history[0].length !== sw.pts) state.history = [];
    state.history.unshift(row); if (state.history.length > WATERFALL_ROWS) state.history.pop();
    ['csvBtn', 's1pBtn', 's2pBtn', 'pngBtn', 'clearBtn', 'minSwrBtn', 'clearMarkersBtn'].forEach(id => $(id).disabled = false);
    chart.dirty = true; renderMarkers();
    return sw;
  } catch (e) { con.err('sweep failed: ' + e.message); return null; }
  finally { state.busy = false; $('singleBtn').disabled = !state.vna; }
}
async function continuousLoop() {
  while (state.continuous && state.vna) { const s = await doSweep(); await new Promise(r => setTimeout(r, s ? 30 : 500)); }
}

// ---------------------------------------------------------------- chart
const canvas = $('plot'), tip = $('tip');
function renderChart() {
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
  if (canvas.width !== W * dpr || canvas.height !== H * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  const sw = state.sweep;
  if (!sw) { ctx.font = '13px ' + cssVar('--font'); ctx.fillStyle = cssVar('--ink-3'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(state.vna ? 'Run a sweep.' : 'Connect a NanoVNA or try the demo.', W / 2, H / 2); chart.geom = null; return; }
  if (state.view === 'smith') chart.geom = renderSmith(ctx, W, H, sw, state.held, state.markers, chart.hover, settings.z0);
  else if (state.view === 'waterfall') chart.geom = renderWaterfall(ctx, W, H, sw, state.history, state.markers, chart.hover, state.lut, settings.wfFloor);
  else chart.geom = renderRect(ctx, W, H, state.view, sw, state.held, state.markers, chart.hover);
}
function tick() { if (chart.dirty) { chart.dirty = false; renderChart(); } requestAnimationFrame(tick); }
new ResizeObserver(() => chart.dirty = true).observe(canvas);

function pointAt(e) {
  const sw = state.sweep, g = chart.geom; if (!sw || !g) return null;
  const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  if (g.smith) { let b = null, bd = 18 * 18; for (let i = 0; i < sw.pts; i++) { const [x, y] = g.gx(sw.s11[2 * i], sw.s11[2 * i + 1]); const d = (x - mx) ** 2 + (y - my) ** 2; if (d < bd) { bd = d; b = i; } } return b; }
  if (mx < g.pad.l || mx > g.pad.l + g.pw) return null;
  return nearestIndex(sw.f, g.fx(mx));
}
canvas.addEventListener('pointermove', e => {
  const i = pointAt(e); if (i !== chart.hover) { chart.hover = i; chart.dirty = true; }
  if (i == null) { tip.style.display = 'none'; return; }
  const sw = state.sweep, re = sw.s11[2 * i], im = sw.s11[2 * i + 1], g = chart.geom;
  let x, y; if (g.smith) [x, y] = g.gx(re, im); else { x = g.sx(sw.f[i]); y = g.sy(g.yOf(i)); }
  tip.style.display = 'block'; tip.style.left = x + 'px'; tip.style.top = y + 'px';
  tip.textContent = `${fmtHz(sw.f[i])}  ${db(re, im).toFixed(2)} dB  SWR ${swr(re, im).toFixed(2)}  ${fmtZ(gammaToZ(re, im, settings.z0))}`;
});
canvas.addEventListener('pointerleave', () => { chart.hover = null; chart.dirty = true; tip.style.display = 'none'; });
canvas.addEventListener('click', e => { const i = pointAt(e); if (i == null) return; addMarker(state.sweep.f[i]); });

function addMarker(f) { if (state.markers.length >= settings.maxMarkers) state.markers.shift(); state.markers.push(f); renderMarkers(); chart.dirty = true; sidebar.open('markers'); }
function renderMarkers() {
  const body = $('markerBody'); body.innerHTML = ''; const sw = state.sweep; if (!sw) return;
  state.markers.forEach((mf, k) => {
    const i = nearestIndex(sw.f, mf), re = sw.s11[2 * i], im = sw.s11[2 * i + 1], z = gammaToZ(re, im, settings.z0);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${k + 1}</td><td>${fmtHz(sw.f[i])}</td><td>${db(re, im).toFixed(2)}</td><td>${swr(re, im).toFixed(2)}</td><td>${z.r.toFixed(1)}</td><td>${(z.x >= 0 ? '+' : '−') + Math.abs(z.x).toFixed(1)}</td><td>${db(sw.s21[2 * i], sw.s21[2 * i + 1]).toFixed(2)}</td><td><button type="button" title="Remove marker" data-k="${k}">×</button></td>`;
    body.appendChild(tr);
  });
  $('markerEmpty').hidden = state.markers.length > 0;
}
function buildLegend() {
  const v = state.view; let items = [];
  if (v === 's21db') items = [['--s21', '|S21|']];
  else if (v === 'waterfall') items = [['--s11', '|S11| now'], [`background:${cssGradient(settings.palette)}`, `0 dB → ${settings.wfFloor} dB`]];
  else items = [['--s11', v === 'swr' ? 'SWR from S11' : v === 'phase' ? 'S11 phase' : v === 'smith' ? 'S11 on the Smith chart' : '|S11|']];
  if (state.held && v !== 'waterfall') items.push(['--held', 'held trace']);
  $('legend').innerHTML = items.map(([c, l]) => `<span><i style="${c.startsWith('--') ? 'background:' + cssVar(c) : c}"></i>${l}</span>`).join('');
}

// ---------------------------------------------------------------- manual console
async function sendManual(cmd) {
  if (!state.vna) { con.err('not connected'); return; }
  if (state.busy) { con.err('busy — stop the sweep first'); return; }
  try { await state.vna.raw(cmd); } catch (e) { con.err(e.message); }
}

// ---------------------------------------------------------------- wiring
if (!hasWebSerial()) { $('noSerial').hidden = false; $('connectBtn').disabled = true; }
$('connectBtn').addEventListener('click', () => state.vna ? disconnect() : connect(false));
$('demoBtn').addEventListener('click', () => state.vna ? disconnect() : connect(true));
$('modelSel').addEventListener('change', () => { const v = $('modelSel').value; applyModel(v === 'auto' ? (state.vna ? detectModel(state.vna.ident.version, state.vna.ident.info) : DEFAULT_MODEL) : v); });
$('singleBtn').addEventListener('click', () => doSweep());
$('contBtn').addEventListener('click', () => { state.continuous = !state.continuous; $('contBtn').setAttribute('aria-pressed', String(state.continuous)); if (state.continuous) continuousLoop(); });
document.querySelectorAll('.views button').forEach(b => b.addEventListener('click', () => { state.view = b.dataset.view; document.querySelectorAll('.views button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); buildLegend(); chart.dirty = true; }));
$('holdBtn').addEventListener('click', () => { if (state.held) state.held = null; else if (state.sweep) state.held = { ...state.sweep, f: state.sweep.f.slice(), s11: state.sweep.s11.slice(), s21: state.sweep.s21.slice() }; $('holdBtn').setAttribute('aria-pressed', String(!!state.held)); buildLegend(); chart.dirty = true; });
$('clearBtn').addEventListener('click', () => { state.sweep = null; state.held = null; state.history = []; state.markers = []; $('holdBtn').setAttribute('aria-pressed', 'false'); renderMarkers(); buildLegend(); chart.dirty = true; ['csvBtn', 's1pBtn', 's2pBtn', 'pngBtn', 'clearBtn', 'minSwrBtn', 'clearMarkersBtn'].forEach(id => $(id).disabled = true); });
$('minSwrBtn').addEventListener('click', () => { if (state.sweep) addMarker(state.sweep.f[minSwrIndex(state.sweep)]); });
$('clearMarkersBtn').addEventListener('click', () => { state.markers = []; renderMarkers(); chart.dirty = true; });
$('markerBody').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; state.markers.splice(+b.dataset.k, 1); renderMarkers(); chart.dirty = true; });
$('csvBtn').addEventListener('click', () => download(`nanovna-${stamp()}.csv`, csvBlob(state.sweep, settings.z0)));
$('s1pBtn').addEventListener('click', () => download(`nanovna-${stamp()}.s1p`, touchstoneBlob(state.sweep, settings.z0, 1, `${state.vna?.env.name || ''} — ${state.vna?.ident.version.split('\n')[0] || ''}`)));
$('s2pBtn').addEventListener('click', () => download(`nanovna-${stamp()}.s2p`, touchstoneBlob(state.sweep, settings.z0, 2, `${state.vna?.env.name || ''} — ${state.vna?.ident.version.split('\n')[0] || ''}`)));
$('pngBtn').addEventListener('click', () => canvasPng(canvas, `nanovna-${state.view}-${stamp()}.png`));
$('shotBtn').addEventListener('click', async () => { if (!state.vna || state.busy) return; state.busy = true; try { const img = await state.vna.capture(); rgbaToPngDownload(img, `nanovna-screen-${stamp()}.png`); con.dim(`capture: ${img.width}×${img.height} in ${img.ms.toFixed(0)} ms`); } catch (e) { con.err('screenshot failed: ' + e.message); } finally { state.busy = false; } });
$('diagBtn').addEventListener('click', async () => { if (!state.vna || state.busy) return; state.busy = true; $('diagBtn').disabled = true; $('diagOut').hidden = false; $('diagOut').textContent = 'collecting…'; try { state.diag = await collectDiagnostics(state.vna, sweepParams(), t => $('diagOut').textContent = t); $('diagDlBtn').disabled = false; } catch (e) { $('diagOut').textContent += '\nfailed: ' + e.message; } finally { state.busy = false; $('diagBtn').disabled = false; } });
$('diagDlBtn').addEventListener('click', () => state.diag && download(`nanovna-diag-${stamp()}.json`, new Blob([JSON.stringify(state.diag, null, 2)], { type: 'application/json' })));
$('ptsCustom').addEventListener('focus', () => { document.querySelector('input[name=pts][value=custom]').checked = true; });
initSettingsPanel($('settingsForm'), key => { if (key === 'palette') state.lut = buildLut(settings.palette); if (key === 'z0') renderMarkers(); buildLegend(); chart.dirty = true; });
window.addEventListener('beforeunload', () => { if (state.vna && !state.demo) state.vna.link.writeSync('resume\r\n'); });
if (hasWebSerial()) navigator.serial.addEventListener('disconnect', () => { if (state.vna && !state.demo) disconnect(true); });

$('appVersion').textContent = 'v' + APP_VERSION;
applyModel(DEFAULT_MODEL); buildLegend(); renderMarkers(); tick();

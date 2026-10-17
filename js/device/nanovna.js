// nanovna.js — the NanoVNA API. Method names mirror the nvnapython library.
// SPDX-License-Identifier: GPL-2.0-only
//
// This is the layer another tool would reuse. Callers never see "ch>" — they
// get strings and typed arrays. One ShellLink (serial or demo) underneath.
import { MODELS, DEFAULT_MODEL, detectModel } from './models.js';
import { PROMPT } from './shell-link.js';

/** The console never signals errors; it prints a usage line or a complaint and then the prompt. */
export function looksLikeError(body) {
  const t = (body || '').trim().toLowerCase();
  return /^usage:|^\S+\?$|invalid|unknown|error|out of range|bad /.test(t);
}
/** Throw if the reply reads as a rejection. */
function check(r, what) { if (looksLikeError(r.body)) { const e = new Error(`${what}: device replied "${r.body.trim().split('\n')[0]}"`); e.reply = r.body; throw e; } return r; }

export class NanoVNA {
  constructor(link) {
    this.link = link;
    this.model = DEFAULT_MODEL;
    this.ident = { version: '', info: '', modelName: '', label: '' };
    this.cwUnit = 1e3; this.deviceSweep = null;
  }
  get env() { return MODELS[this.model]; }

  // ---- identity / system -------------------------------------------------
  async version() { return (await this.link.command('version', { timeoutMs: 3000 })).body.trim(); }
  async info()    { return (await this.link.command('info',    { timeoutMs: 3000 })).body.trim(); }
  async serialNumber() { return (await this.link.command('SN', { timeoutMs: 3000 })).body.trim(); }
  async help()    { return (await this.link.command('help', { timeoutMs: 3000 })).body; }

  /** version + info; throws if the port doesn't answer like a NanoVNA console. */
  async identify(modelOverride) {
    const v = await this.link.command('version', { timeoutMs: 3000 });
    const i = await this.link.command('info', { timeoutMs: 3000 });
    if (!v.raw.includes(PROMPT)) throw new Error('that port did not answer like a NanoVNA console');
    this.ident = { version: v.body.trim(), info: i.body.trim() };
    this.model = modelOverride && MODELS[modelOverride] ? modelOverride : detectModel(this.ident.version, this.ident.info);
    // F V3 firmware 0.5.8 answers `version` with just "0.5.8"; the model name is in `info`.
    const m = /Model:\s*(\S+)/i.exec(this.ident.info);
    this.ident.modelName = m ? m[1] : this.ident.version.split('\n')[0];
    this.ident.label = `${this.ident.modelName} v${this.ident.version.split('\n')[0].replace(/^v/i, '')}`;
    // The console's own help text says which unit cwfreq takes (Hz on the F V3, kHz on older firmware).
    this.cwUnit = this.model === 'NANOVNA_F_V3' ? 1 : 1e3;
    try { const h = (await this.link.command('help', { timeoutMs: 4000, quiet: true })).body; const u = /cwfreq[^\n]*frequency\((k?hz)\)/i.exec(h); if (u) this.cwUnit = u[1].toLowerCase() === 'hz' ? 1 : 1e3; this.ident.help = h; } catch {}
    // Remember the device's own sweep so it can be restored on disconnect (scan rewrites it).
    try { this.deviceSweep = await this.sweep(); } catch { this.deviceSweep = null; }
    return this.ident;
  }
  /** Put the device back on the sweep it had when we connected. */
  async restoreDeviceSweep() { const d = this.deviceSweep; if (d && Number.isFinite(d.start) && Number.isFinite(d.stop) && d.pts) await this.sweep(d.start, d.stop, d.pts); }

  // ---- sweep control -----------------------------------------------------
  async pause()  { return this.link.command('pause',  { timeoutMs: 2000 }); }
  async resume() { return this.link.command('resume', { timeoutMs: 2000 }); }
  /** Read or set the device's own sweep: sweep() -> {start, stop, pts}; sweep(a,b,n) sets. */
  async sweep(start, stop, pts) {
    if (start == null) { const b = (await this.link.command('sweep')).body.trim().split(/\s+/).map(Number); return { start: b[0], stop: b[1], pts: b[2] }; }
    return this.link.command(`sweep ${Math.round(start)} ${Math.round(stop)}${pts ? ' ' + pts : ''}`);
  }
  async frequencies() { return (await this.link.command('frequencies')).body.split('\n').map(Number).filter(Number.isFinite); }

  // ---- acquisition -------------------------------------------------------
  /** data(0|1): re/im pairs of the device's current sweep. Returns Float64Array [re,im,re,im…]. */
  async data(ch = 0) {
    const body = (await this.link.command(`data ${ch}`)).body;
    const out = [];
    for (const line of body.split('\n')) { const v = line.trim().split(/\s+/).map(Number); if (v.length >= 2 && v.every(Number.isFinite)) out.push(v[0], v[1]); }
    return Float64Array.from(out);
  }

  /**
   * scan(start, stop, pts): one sweep with outmask 7 (freq + S11 + S21).
   * Validates the point count; retries once; returns null if the device
   * never produced a complete reply (the robust-acquisition-loop pattern).
   */
  async scan(start, stop, pts, { retries = 1, quiet = false } = {}) {
    const m = this.env;
    start = Math.round(Math.min(Math.max(start, m.minHz), m.maxHz));
    stop = Math.round(Math.min(Math.max(stop, m.minHz), m.maxHz));
    if (!(start < stop)) stop = Math.min(m.maxHz, start + 1e6);
    pts = Math.min(Math.max(Math.round(pts), m.minPts), m.maxPts);
    const cmd = `scan ${start} ${stop} ${pts} 7`;
    let last = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const r = await this.link.command(cmd, { timeoutMs: 8000 + pts * 25, quiet });
      const parsed = NanoVNA.parseScan(r.body, pts);
      if (parsed) return { ...parsed, pts, start, stop, t: Date.now(), ms: r.ms, cmd };
      last = { lines: r.body.split('\n').filter(Boolean).length, expected: pts, attempt };
    }
    const err = new Error(`scan returned ${last.lines} usable lines, expected ${last.expected}`);
    err.detail = last; throw err;
  }
  static parseScan(body, pts) {
    const f = new Float64Array(pts), s11 = new Float64Array(pts * 2), s21 = new Float64Array(pts * 2);
    let n = 0;
    for (const line of body.split('\n')) {
      const v = line.trim().split(/\s+/); if (v.length < 5 || n >= pts) continue;
      const nums = v.map(Number); if (nums.some(x => !Number.isFinite(x))) continue;
      f[n] = nums[0]; s11[2 * n] = nums[1]; s11[2 * n + 1] = nums[2]; s21[2 * n] = nums[3]; s21[2 * n + 1] = nums[4]; n++;
    }
    return n === pts ? { f, s11, s21 } : null;
  }

  // ---- calibration (device-side) ----------------------------------------
  /** cal('open'|'short'|'load'|'thru'|'done'|'reset'|'on'|'off') */
  async cal(action) { return check(await this.link.command(`cal ${action}`, { timeoutMs: 8000 }), `cal ${action}`); }
  async recall(slot) { return check(await this.link.command(`recall ${slot}`, { timeoutMs: 5000 }), `recall ${slot}`); }
  /** save never returns a prompt on the F V2 (confirmed in nvnapython). */
  async save(slot) { return this.link.commandNoPrompt(`save ${slot}`, 1500); }

  // ---- single frequency ----------------------------------------------------
  /** cwfreq {kHz}: put the device in CW at one frequency (its own screen). */
  async cwfreq(hz) { return check(await this.link.command(`cwfreq ${Math.round(hz / (this.cwUnit || 1))}`, { timeoutMs: 3000 }), 'cwfreq'); }
  /** One-point measurement for the CW meter: a tiny 11-point scan, averaged. */
  async measureAt(hz) {
    const pts = 11, span = 1e3;
    const sw = await this.scan(hz, hz + span, pts, { retries: 0, quiet: true });
    const avg = arr => { let re = 0, im = 0; for (let i = 0; i < pts; i++) { re += arr[2 * i]; im += arr[2 * i + 1]; } return [re / pts, im / pts]; };
    return { f: hz, s11: avg(sw.s11), s21: avg(sw.s21), ms: sw.ms };
  }

  // ---- markers / traces on the device -------------------------------------
  /** marker N idx — move device marker N (1-4) to sweep point idx; marker N off. */
  async marker(n, idxOrOff) { return check(await this.link.command(`marker ${n} ${idxOrOff}`, { timeoutMs: 3000 }), `marker ${n}`); }
  /** trace N fmt — set a device trace's display format (logmag, smith, swr, phase, …). */
  async trace(n, fmt) { return check(await this.link.command(`trace ${n} ${fmt}`, { timeoutMs: 3000 }), `trace ${n}`); }

  /**
   * Put the page's markers on the device. Device marker indices refer to the
   * DEVICE's sweep, so the device sweep is set to match first. Stops at the
   * first rejection. Returns { sent, skipped, error }.
   */
  async syncMarkers(sweep, markerFreqs) {
    const n = this.env.markers || 4;
    const result = { sent: 0, skipped: Math.max(0, markerFreqs.length - n), error: null };
    try {
      await this.sweep(sweep.start, sweep.stop, sweep.pts);
      for (let k = 1; k <= n; k++) {
        const mf = markerFreqs[k - 1];
        if (mf == null) { await this.marker(k, 'off'); continue; }
        let best = 0, bd = Infinity; for (let i = 0; i < sweep.pts; i++) { const d = Math.abs(sweep.f[i] - mf); if (d < bd) { bd = d; best = i; } }
        await this.marker(k, best); result.sent++;
      }
    } catch (e) { result.error = e.message; }
    return result;
  }

  // ---- calibration extras ---------------------------------------------------
  /** edelay [value]: get or set electrical delay. Value is passed straight through. */
  async edelay(v) { const r = check(await this.link.command(v == null ? 'edelay' : `edelay ${v}`, { timeoutMs: 3000 }), 'edelay'); return r.body.trim(); }

  // ---- display / UI -----------------------------------------------------------
  /** beep on|off — nvnapython beep_time() does on, wait, off. */
  async beep(on) { return this.link.command(`beep ${on ? 'on' : 'off'}`, { timeoutMs: 2000 }); }
  async beepFor(ms = 80) { await this.beep(true); await new Promise(r => setTimeout(r, ms)); await this.beep(false); }
  /** pwm 0.0–1.0 — screen brightness. */
  async pwm(v) { return check(await this.link.command(`pwm ${Math.min(1, Math.max(0, v)).toFixed(2)}`, { timeoutMs: 2000 }), 'pwm'); }
  async resolution() { const r = await this.link.command('resolution', { timeoutMs: 3000 }); return r.body.trim(); }
  /** touchcal / touchtest — need the user at the device screen. */
  async touchCal() { return this.link.command('touchcal', { timeoutMs: 60000 }); }
  async touchTest() { return this.link.command('touchtest', { timeoutMs: 60000 }); }

  // ---- screen -------------------------------------------------------------
  /** Grab the framebuffer. Returns { width, height, rgba: Uint8ClampedArray, ms }. */
  async capture() {
    const [W, H] = this.env.screen;
    const { payload, ms } = await this.link.commandBinary('capture', W * H * 2);
    const rgba = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const v = payload[2 * i] | (payload[2 * i + 1] << 8);            // little-endian RGB565
      const r = (v >> 11) & 31, g = (v >> 5) & 63, b = v & 31;
      // nvnapython screen_capture.py: F-series byte order has R and B swapped
      rgba[4 * i] = (b << 3) | (b >> 2); rgba[4 * i + 1] = (g << 2) | (g >> 4); rgba[4 * i + 2] = (r << 3) | (r >> 2); rgba[4 * i + 3] = 255;
    }
    return { width: W, height: H, rgba, ms };
  }

  // ---- raw -----------------------------------------------------------------
  /** Anything else, for the console box. */
  async raw(cmd, timeoutMs = 8000) { return this.link.command(cmd, { timeoutMs }); }
}

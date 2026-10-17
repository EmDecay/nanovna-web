// about.js — About page: what nanoVNA Web does, what it supports, what is next.
// Opened from the top-bar "About" link (or #about in the URL); it stands in for
// the plot and markers while open, the console stays. Hardware rows come from
// models.js so the list stays true as envelopes are added.
// SPDX-License-Identifier: GPL-2.0-only
import { MODELS } from '../device/models.js';
import { fmtHz } from '../rf.js';

// tiny element builder: h('p.hint', { title: 'x' }, 'text', child, ...)
function h(sel, attrs = {}, ...kids) {
  const [tag, ...cls] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...kids.flat().filter(k => k != null));
  return el;
}
const li = (...c) => h('li', {}, ...c);
const code = s => h('code', {}, s);

/**
 * @param {HTMLElement} root     the #about section
 * @param {HTMLElement} link     the top-bar link that toggles it
 * @param {HTMLElement[]} swap   elements hidden while the page is open
 * @param {{ version: string, untested?: string[] }} opts
 */
export function initAbout(root, link, swap, opts) {
  render(root, opts);
  let open = false;
  function show(on) {
    open = on;
    root.hidden = !on;
    for (const el of swap) el.hidden = on;
    link.setAttribute('aria-current', on ? 'page' : 'false');
    link.textContent = on ? 'Back to plots' : 'About';
    if (on) root.scrollIntoView({ block: 'start' });
  }
  link.addEventListener('click', e => { e.preventDefault(); show(!open); history.replaceState(null, '', open ? '#about' : location.pathname + location.search); });
  root.querySelector('#aboutClose').addEventListener('click', () => { show(false); history.replaceState(null, '', location.pathname + location.search); });
  window.addEventListener('hashchange', () => show(location.hash === '#about'));
  if (location.hash === '#about') show(true);
  return { show, get open() { return open; } };
}

function render(root, { version, untested = ['NANOVNA_H4', 'NANOVNA_GENERIC'] }) {
  const badge = (text, cls) => h('span.badge' + (cls ? '.' + cls : ''), {}, text);
  root.replaceChildren(
    h('div.head', {},
      h('h2', {}, 'About nanoVNA Web'),
      h('p.lede', {}, 'What this page does, what it supports today, and where it is going.'),
      h('button.btn.small', { id: 'aboutClose', type: 'button' }, 'Back to plots')),

    h('div.cols', {},
      h('div.card', {}, h('h3', {}, 'What it is'),
        h('p', {}, 'A browser front end for the NanoVNA-F V2 and F V3. Plug the analyzer in over USB, open the page in Chrome or Edge, click Connect: S11/S21 traces, SWR, Smith chart, a live waterfall, markers with an R + jX readout, and CSV / Touchstone export. Nothing to install.'),
        h('p', {}, 'It is the browser companion to the ', h('a', { href: 'https://github.com/LC-Linkous/nanoVNA_python' }, 'nanoVNA_python'), ' library: the same console commands, the same model envelopes, the same quirks list, no Python needed. The NanoVNA does not know which one it is talking to; files (', code('.csv'), ', ', code('.s1p'), '/', code('.s2p'), ', JSON) move between the two.'),
        h('p', {}, h('i', {}, 'Try without hardware'), ' runs a simulated F V3 that answers with the same byte stream a real one does, so the page can be previewed anywhere.')),
      h('div.card', {}, h('h3', {}, 'The flow'),
        h('ol.steps', {},
          li(h('b', {}, 'Connect'), ' (or start the demo). The page asks the device ', code('version'), ' and ', code('info'), ', picks the model envelope, and records the instrument\'s own sweep so it can be put back at disconnect.'),
          li(h('b', {}, 'Sweep'), ': start/stop in MHz, points by model maximum / quick / custom, single or continuous. Views: |S11|, |S21|, SWR, phase, Smith, waterfall, or the CW meter for trimming one frequency.'),
          li(h('b', {}, 'Markers'), ': click the plot to place up to six; min-SWR and |S11|-peak finders; the first four can be written to the device\'s own markers.'),
          li(h('b', {}, 'Calibration'), ': step-through SOLT, on/off, slots and electrical delay. Calibration lives on the device; the page only sends the commands, so run a page sweep first so the ranges match.'),
          li(h('b', {}, 'Record / export'), ': log every sweep and CW reading with timestamps; save CSV, Touchstone, plot PNG, a device screenshot, or the whole session as JSON.')))),

    h('div.cols', {},
      h('div.card', {}, h('h3', {}, 'Supported hardware ', badge(`${Object.keys(MODELS).length} envelopes`)),
        h('table.grid', {},
          h('thead', {}, h('tr', {}, h('th', {}, 'Model'), h('th', {}, 'Range'), h('th', {}, 'Points'), h('th', {}, ''))),
          h('tbody', {}, Object.entries(MODELS).map(([key, m]) => h('tr', {},
            h('td', {}, m.name),
            h('td.mono', {}, `${fmtHz(m.minHz, 1)} – ${fmtHz(m.maxHz, 1)}`),
            h('td.mono', {}, `${m.minPts}–${m.maxPts}`),
            h('td', {}, untested.includes(key) ? badge('untested', 'warn') : badge('tested', 'ok')))))),
        h('dl.kv', {},
          h('dt', {}, 'Transport'), h('dd', {}, 'Web Serial → NanoVNA text console (USB CDC, ch> prompt)'),
          h('dt', {}, 'Browsers'), h('dd', {}, 'Chrome, Edge (Web Serial); demo works anywhere')),
        h('p.hint', {}, 'Built for the F V2 and F V3 (what the maintainer owns). The H4 and a generic envelope are selectable but unverified. Devices that use a binary protocol (NanoVNA V2 / SAA-2 family) will not work. See ', h('a', { href: 'PROTOCOL.md' }, 'PROTOCOL.md'), ' for what has been confirmed on hardware.')),
      h('div.card', {}, h('h3', {}, 'Honest limits'),
        h('ul', { style: 'margin:0;padding-left:1.2em' },
          li('Firefox and Safari can run the demo but cannot open serial ports.'),
          li('The page cannot read the device\'s calibration state; the badge shows what the page last sent.'),
          li(code('save N'), ' over USB has been seen to freeze an F V3 (fw 0.5.8) until power-cycled. The page confirms first and recommends the device\'s own CAL → SAVE menu.'),
          li('Only one program can hold the serial port: close the page\'s connection before starting a Python script, and vice versa.'),
          li('No group delay or TDR yet.')))),

    h('div.cols', {},
      h('div.card', {}, h('h3', {}, 'Next'),
        h('ul', { style: 'margin:0;padding-left:1.2em' },
          li('Group delay and TDR views (planned as their own release).'),
          li('Validation on the H4 and other console-protocol NanoVNAs; the Diagnostics section exists so a sample from hardware the page has not seen can be attached to an issue.'),
          li('Keeping ', code('js/device/'), ' and the Python library\'s device layer in step as the protocol notes grow.'))),
      h('div.card', {}, h('h3', {}, 'Help validate it'),
        h('p', {}, 'Connect, run a single sweep. If the plot looks wrong or the sweep fails, open ', h('i', {}, 'Diagnostics'), ' → ', h('b', {}, 'Collect sample'), ' and attach the JSON to an issue using the ', h('i', {}, 'Scan problem'), ' template. Then compare the page\'s trace with the device\'s screen (', h('i', {}, 'Export → Device screenshot'), ' pulls that over USB too) and open an exported ', code('.s1p'), ' in anything that reads Touchstone.'),
        h('p.hint', {}, 'See ', h('a', { href: 'https://github.com/LC-Linkous/nanovna-web/blob/main/CONTRIBUTING.md' }, 'CONTRIBUTING.md'), ' and the short ', h('a', { href: 'https://github.com/LC-Linkous/nanovna-web/blob/main/CODE_OF_CONDUCT.md' }, 'code of conduct'), '.'))),

    h('p.hint', {}, 'nanoVNA Web ', h('span.mono', {}, 'v' + version), ' · GPL-2.0 · ',
      h('a', { href: 'PROTOCOL.md' }, 'console protocol'), ' · ',
      h('a', { href: 'CHANGELOG.md' }, 'changelog'), ' · ',
      h('a', { href: 'https://github.com/LC-Linkous/nanovna-web' }, 'source'), ' · ',
      h('a', { href: 'https://github.com/LC-Linkous/nanoVNA_python' }, 'nanoVNA_python'),
      '. Not affiliated with any NanoVNA manufacturer.'));
}

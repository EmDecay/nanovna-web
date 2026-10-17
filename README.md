# nanoVNA Web

A browser front end for the NanoVNA-F V2 and F V3. Plug the analyzer in over
USB, open the page in Chrome or Edge, click Connect: S11/S21 traces, SWR, Smith
chart, a live waterfall, markers with an R + jX readout, and CSV / Touchstone
export. Nothing to install.

**Use it:** https://interactive-hardware-interfacing.github.io/nanovna-web/

The page has a *Try without hardware* mode with a simulated F V3, so it can be
previewed anywhere.

<p align="center"><img src="media/screenshot.png" alt="nanoVNA Web in demo mode: docked sidebar with sweep controls on the left, |S11| trace with markers on the dark plot surface, device console below" width="900"></p>

This is the browser companion to the
[nanoVNA_python](https://github.com/LC-Linkous/nanoVNA_python) library: same
command set, same model envelopes, same quirks list, no Python needed.

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ nanoVNA Web      [Connect] [Demo]  Model ▾   ● status         │
├────────────┬─────────────────────────────────────────────────┤
│ Sweep      │  |S11| |S21| SWR Phase Smith Waterfall  Hold Clr│
│  start/stop│                                                 │
│  points    │                    plot                         │
│  [Single]  │                                                 │
│  [Contin.] │                                                 │
│ ────────── │                                                 │
│ Markers    ├─────────────────────────────────────────────────┤
│  table     │  markers table                                  │
│ ────────── ├─────────────────────────────────────────────────┤
│ Export     │  Console ▲ (drag to resize)        [clear] [⤓]  │
│ ────────── │  > version                                      │
│ Diagnostics│  NanoVNA-F_V3 v1.0.6                            │
│ ────────── │  > scan 50000000 1500000000 801 7               │
│ Settings   │  … 801 lines (1273 ms)                          │
│  theme     │  ┌──────────────────────────────────┐ [Send]    │
│  palette   │  │ type a command                   │           │
└────────────┴─────────────────────────────────────────────────┘
```

The sidebar is an accordion — one section open at a time, remembered between
visits. The markers table lives in the Markers section rather than under the
plot. On narrow screens the sidebar stacks above the plot.

## What it does (v0.2)

- **Sweep** — start/stop in MHz, points by model maximum / quick / custom,
  single or continuous.
- **Views** — |S11| dB, |S21| dB, SWR, S11 phase, Smith chart, waterfall
  (rolling |S11| history). *Hold* keeps a trace for comparison.
- **Markers** — click to place up to six; each shows frequency, |S11|, SWR,
  R, X and |S21|. *Mark minimum SWR* finds the best match in the sweep.
- **Export** — CSV with derived columns, `.s1p`, `.s2p`, plot PNG, and a
  screenshot of the device's own screen.
- **Diagnostics** — one button runs a fixed set of commands, records raw
  replies and timings, and downloads a JSON to attach to an issue. This is
  how the page gets validated against hardware it hasn't seen yet.
- **Console** — the raw serial exchange with a resizable drawer, command
  history (↑ ↓), long replies collapsed, copy button.
- **Settings** — dark (default) or light theme; trace colours as the
  instrument convention (S11 yellow, S21 cyan) or blue/amber; waterfall
  palette (Viridis, Inferno, Turbo, Classic SDR, Grey) and colour floor;
  reference impedance Z₀ (default 50 Ω); raw-byte echo for debugging framing.
  All remembered in the browser.

Not yet: calibration from the page (planned), group delay, TDR.

## Supported hardware

Built for the NanoVNA-F V2 and F V3 (what the maintainer owns). The H4 and a
generic envelope are selectable from the Model dropdown but untested. Devices
that use a binary protocol (NanoVNA V2 / SAA-2 family) will not work.

Chrome or Edge is required for the USB link — they implement
[Web Serial](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API).
Firefox and Safari can only use the demo.

## Code layout

No build step; native ES modules.

```
index.html                 markup only
css/
  theme.css                colour tokens: dark/light themes, trace colour schemes
  layout.css               top bar, docked sidebar, plot, console drawer
  components.css           buttons, inputs, tables
js/
  main.js                  app state + wiring
  rf.js                    pure math: dB, SWR, Γ→Z, formatting
  device/                  ← the reusable "library" layer
    shell-link.js          NanoVNA console framing (ch> prompt, echo, binary)
    serial-link.js         Web Serial transport
    demo-link.js           simulated F V3, same byte stream
    models.js              per-model envelopes, detectModel()
    nanovna.js             NanoVNA class — method names mirror nvnapython
  plot/
    rect.js  smith.js  waterfall.js  palettes.js  common.js
  ui/
    sidebar.js  console.js  settings.js  diagnostics.js  export.js
```

`js/device/` is the part another tool would reuse: `main.js` calls
`vna.scan(start, stop, pts)` and gets typed arrays back; it never sees `ch>`.

## Running locally

Module scripts don't load from `file://` in Chrome, so serve the folder:

```sh
python -m http.server 8000
# then open http://localhost:8000/
```

Web Serial works on `localhost`, so a real device can be used this way.

## Validating against a real device

1. Connect, run a single sweep. If the plot looks wrong or the sweep fails,
   open *Diagnostics* → **Collect sample** and attach the JSON to an issue
   using the *Scan problem* template.
2. Compare the page's trace with the device's screen (*Export → Device
   screenshot* pulls that over USB too).
3. Export a `.s1p` and open it in anything that reads Touchstone.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the issue templates. Please read
the short [code of conduct](CODE_OF_CONDUCT.md).

## License

GPL-2.0 — see [LICENSE](LICENSE). Same as the nanoVNA_python library.

nanoVNA Web is not affiliated with or endorsed by any NanoVNA manufacturer.
Refer to the manufacturer's documentation for anything about the device itself.

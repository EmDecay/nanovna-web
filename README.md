# nanoVNA Web

A browser front end for the NanoVNA-F V2 and F V3. Plug the analyzer in over
USB, open the page in Chrome or Edge, click Connect: S11/S21 traces, SWR, Smith
chart, a live waterfall, markers with an R + jX readout, and CSV / Touchstone
export. Nothing to install.

**Use it:** https://interactive-hardware-interfacing.github.io/nanovna-web/

The page has a *Try without hardware* mode with a simulated F V3, so it can be
previewed anywhere.

<p align="center"><img src="media/screenshot.png" alt="nanoVNA Web in demo mode: sweep panel on the left, S11 trace with a minimum-SWR marker on the right" width="900"></p>

This is the browser companion to the
[nanoVNA_python](https://github.com/LC-Linkous/nanoVNA_python) library: same
command set, same model envelopes, same quirks list, no Python needed.

## What it does (v0.1)

- **Sweep** — start/stop in MHz, points by model maximum / quick / custom,
  single or continuous.
- **Views** — |S11| dB, |S21| dB, SWR, S11 phase, Smith chart, waterfall
  (rolling |S11| history, dark = good match). *Hold* keeps a trace for
  comparison.
- **Markers** — click to place up to four; each shows frequency, |S11|, SWR,
  R, X and |S21|. *Mark minimum SWR* finds the best match in the sweep.
- **Reference impedance** — Z₀ is an input (default 50 Ω) and feeds SWR, the
  Smith chart, the R + jX readout and the Touchstone header.
- **Export** — CSV with derived columns, `.s1p`, `.s2p`, plot PNG, and a
  screenshot of the device's own screen.
- **Diagnostics** — one button runs a fixed set of commands, records raw
  replies and timings, and downloads a JSON you can attach to an issue. This
  is how the page gets validated against hardware it hasn't seen yet.
- **Console** — the raw serial exchange, with a box to type commands.

Not yet: calibration from the page (planned, v0.3), group delay, TDR.

## Supported hardware

Built for the NanoVNA-F V2 and F V3 (what the maintainer owns). The H4 and a
generic envelope are selectable from the Model dropdown but untested. Devices
that use a binary protocol (NanoVNA V2 / SAA-2 family) will not work.

Chrome or Edge is required for the USB link — they implement
[Web Serial](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API).
Firefox and Safari can only use the demo.

## Repo

| Path | What it is |
|---|---|
| `index.html` | The whole tool. One self-contained file. |
| `PROTOCOL.md` | The device console as the page uses it, with quirks and the not-yet-verified list. |
| `.github/workflows/pages.yml` | Publishes the page to GitHub Pages and stamps the footer date. |
| `.github/` | Issue forms, PR template. |

## Validating against a real device

1. Connect, run a single sweep. If the plot looks wrong or the sweep fails,
   click **Collect diagnostic sample** and attach the JSON to an issue using the
   *Scan problem* template.
2. Compare the page's trace with the device's screen (the *Device screenshot*
   button pulls that over USB too).
3. Export a `.s1p` and open it in anything that reads Touchstone.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the issue templates. Please read
the short [code of conduct](CODE_OF_CONDUCT.md).

## License

GPL-2.0 — see [LICENSE](LICENSE). Same as the nanoVNA_python library.

nanoVNA Web is not affiliated with or endorsed by any NanoVNA manufacturer.
Refer to the manufacturer's documentation for anything about the device itself.

# Changelog

## v0.3.0 — front panel

- Fixes: accordion headers collapse on second click; demo mode is obvious
  (highlighted button, "Demo mode (click to leave)"); Single / Continuous show
  a running state (Continuous becomes an amber "Stop" with a pulse); markers
  table moved under the plot at full width; console log download with
  commands-only or commands+replies modes.
- Calibration section: SOLT step-through, done/reset/on/off, save/recall
  slots, edelay; cal badge in the top bar.
- Sweep: "Use device sweep" and "Read device data" readback.
- CW meter view with big-number |S11| / SWR / R + jX / |S21|.
- Markers: peak finder, phase column, "Send to device".
- Beep rules (after sweep, below SWR threshold) with optional browser tone.
- Settings: device screen brightness, mirror view to device trace 0, overlay
  toggle.
- Session save/load (JSON) and Touchstone overlay (.s1p/.s2p, RI/MA/DB).
- Device tools: touch calibration, touch test, resolution.
- Continuous and CW readings log a one-line summary instead of the full dump.

## v0.2.0 — workability

- Split the single file into ES modules: `js/device/` (reusable NanoVNA
  API mirroring nvnapython), `js/plot/`, `js/ui/`, `css/`.
- New layout: docked accordion sidebar, plot on a dark "screen" surface,
  full-width resizable console drawer with command history and collapsed
  long replies.
- Own theme: dark bench-instrument default, light option.
- Settings section: theme, trace colour scheme (instrument yellow/cyan or
  blue/amber), waterfall palette (Viridis default, Inferno, Turbo, Classic
  SDR, Grey), waterfall colour floor, Z₀, raw-byte echo. Persisted.
- Markers raised to six; the table moved into the sidebar.
- Diagnostics summary reformatted for the sidebar width.
- Local development now needs an http server (module scripts); documented.

## v0.1.0 — first release

- Web Serial driver for the NanoVNA console: `ch>` framing with doubled-prompt
  handling, echo stripping, no-prompt and binary paths. Rules ported from
  nanoVNA_python.
- Model envelopes for F V2, F V3, H4, generic; detection from `version`/`info`
  with manual override.
- Single and continuous `scan` with validate-and-retry.
- Views: |S11|, |S21|, SWR, phase, Smith chart, waterfall. Hold trace.
- Up to four markers with |S11|, SWR, R, X, |S21|; minimum-SWR finder.
- Z₀ input.
- Exports: CSV (derived columns), .s1p, .s2p, plot PNG, device screenshot.
- Diagnostics sample → JSON.
- Demo device (simulated F V3) that produces the real byte framing.

Built against the demo device only. See *Not yet verified on hardware* in
PROTOCOL.md.

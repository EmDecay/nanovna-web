# Changelog

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

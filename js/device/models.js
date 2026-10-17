// models.js — per-model operating envelopes, ported from nvnapython/constants.py.
// SPDX-License-Identifier: GPL-2.0-only
//
// These are the page's *checking* envelope (what it will let you ask for),
// not live device state. Add a model here and a pattern in detectModel().

export const MODELS = {
  NANOVNA_F_V2:    { name: 'NanoVNA-F V2', minHz: 50e3, maxHz: 3e9,   minPts: 11, maxPts: 201, quick: 101, screen: [800, 480] },
  NANOVNA_F_V3:    { name: 'NanoVNA-F V3', minHz: 50e3, maxHz: 6e9,   minPts: 51, maxPts: 801, quick: 101, screen: [800, 480] },
  NANOVNA_H4:      { name: 'NanoVNA-H4',   minHz: 10e3, maxHz: 1.5e9, minPts: 11, maxPts: 101, quick: 51,  screen: [320, 480] },
  NANOVNA_GENERIC: { name: 'Generic',      minHz: 10e3, maxHz: 1.5e9, minPts: 11, maxPts: 101, quick: 51,  screen: [320, 240] },
};
export const DEFAULT_MODEL = 'NANOVNA_F_V2';

/** Guess the model key from the `version` and `info` replies. */
export function detectModel(version, info) {
  const t = `${version}\n${info}`.toLowerCase();
  if (/f[ _-]?v3|nanovna-f_v3/.test(t)) return 'NANOVNA_F_V3';
  if (/f[ _-]?v2|nanovna-f_v2|nanovna-f\b/.test(t)) return 'NANOVNA_F_V2';
  if (/-h4|\bh4\b/.test(t)) return 'NANOVNA_H4';
  return 'NANOVNA_GENERIC';
}

# NanoVNA console protocol, as used by nanoVNA Web

Unlike the LED I–V Lab, this page does not own the firmware. The NanoVNA-F V2
and V3 ship with a text console over USB serial, and the page speaks that. This
document is the subset the page uses and the quirks it has to handle. It was
written from the `nvnapython` library (whose rules were confirmed on an F V2
and an F V3) and from the page's own behaviour; where the page relies on
something not yet verified on hardware, it says so.

The console lineage is ttrftech/NanoVNA; the F-series firmware (SYSJOINT /
Chelegance) keeps the same command style.

## Transport and framing

- USB CDC serial. The device enumerates as an STM32 virtual COM port,
  VID `0483` PID `5740`. **The tinySA uses the same IDs**, so the page filters
  the port chooser to that pair but identifies the device by asking it.
- Baud rate is irrelevant on native USB; the page opens at 115200.
- Commands are ASCII, terminated by `\r\n`. The device **echoes the command
  line**, then prints the reply, then the prompt `ch>`.
- The prompt is usually **doubled**: `ch> \r\nch> ` with a trailing space.
  Reply detection: the accumulated buffer, right-trimmed, ends with `ch>`.
  Then wait a short settle (40 ms) for the second prompt and drain everything.
- Reply bodies are plain lines. Numeric lines are space-separated.

The page's `ShellLink.command()` implements exactly that, and `ShellLink.strip()`
removes the echo line and the prompt(s). `commandNoPrompt()` exists for the
one command known not to answer with a prompt (see *Quirks*).

## Commands the page sends

| Command | Reply | Used for |
|---|---|---|
| `version` | one line, e.g. `NanoVNA-F_V3 v1.0.6` | Identify; shown in the status line; model detection |
| `info` | several lines of board/firmware text | Model detection (F V2 vs F V3); diagnostics |
| `SN` | serial number | Diagnostics only |
| `help` | command list | Diagnostics only |
| `pause` / `resume` | — | *Freeze device screen* toggle only. Not sent at connect since v0.3.3: `scan` works while the device sweeps, and calibration needs it sweeping. `resume` is sent on disconnect if the page paused it. |
| `scan <start> <stop> <pts> 7` | `pts` lines of `freq s11re s11im s21re s21im` | **Every sweep.** Outmask 7 = frequency + S11 + S21 |
| `sweep` | `start stop pts` | Diagnostics only (read back device sweep) |
| `frequencies` | one frequency per line | Diagnostics only |
| `data 0` / `data 1` | `re im` per line for S11 / S21 of the device's current sweep | Diagnostics only |
| `capture` | binary: width × height × 2 bytes, RGB565 | *Device screenshot* button |
| `cal open` / `short` / `load` / `thru` / `done` / `reset` / `on` / `off` | — | Calibration section |
| `save N` (0–4) | **no prompt** on the F V2; **hangs the device** on the F V3 fw 0.5.8 | Calibration → Save, behind a confirm; the page probes `version` afterwards |
| `recall N` (0–6) | — | Calibration → Recall |
| `edelay [value]` | current value when no argument | Calibration → electrical delay; value passed through unchanged |
| `cwfreq <kHz>` | — | CW meter: puts the device's own screen at that frequency. The page's readings come from an 11-point `scan` over 1 kHz, averaged |
| `marker N <idx>` / `marker N off` | — | Markers → Send to device (first four) |
| `trace 0 <fmt>` | — | Settings → mirror view (`logmag`, `swr`, `phase`, `smith`) |
| `beep on` / `beep off` | — | Beep rules in Settings; the page sends on, waits, off (`beepFor`) |
| `pwm <0.0–1.0>` | — | Settings → screen brightness; also sent on connect if below 1 |
| `resolution` | `W,H` | Device tools |
| `touchcal` / `touchtest` | runs on the device screen | Device tools |

Outmask bits for `scan`: 1 = frequency, 2 = S11, 4 = S21. The page always uses
7 so one command fetches everything; the diagnostics sample also runs outmask 3
to show the difference.

Reply values are reflection/transmission coefficients as real/imaginary pairs,
already corrected by the device's active calibration (if `cal on`). The page does
no calibration of its own in v0.1.

## Model envelopes

Ported from `nvnapython/constants.py`. These are the page's *checking*
envelope — what it will let you type — not live device state.

| Model | Frequency | Points | Screen |
|---|---|---|---|
| NanoVNA-F V2 | 50 kHz – 3 GHz | 11 – 201 | 800 × 480 |
| NanoVNA-F V3 | 50 kHz – 6 GHz (firmware says 6.3; samples above ~6 GHz are zero) | 51 – 801 | 800 × 480 |
| NanoVNA-H4 | 10 kHz – 1.5 GHz | 101 | 320 × 480 |
| Generic | 10 kHz – 1.5 GHz | 101 | 320 × 240 |

Detection: the page looks for `F V3` / `F_V3` then `F V2` / `F_V2` / `NanoVNA-F`
then `H4` in the `version` + `info` text, else *Generic*. The Model dropdown
overrides it.

## Quirks the page handles

0. **No error signalling.** A rejected command prints a usage line or a
   complaint (`marker: invalid …`) followed by the normal prompt, so a
   transport-level "success" can still be a failure. `nanovna.js` runs
   replies through `looksLikeError()` for the commands where that matters.
   `marker N idx` indexes the **device's** current sweep, so the page sets the
   device sweep to match before sending markers.

1. **Doubled prompt with trailing space** — see framing above.
2. **`save N` returns no prompt** on the F V2 (echo only, even after 30 s). Not
   used in v0.1, but `commandNoPrompt()` is there for the calibration panel.
3. **Shared VID/PID with the tinySA** — identification is by reply, not by USB ID.
4. **Short lines / partial replies** — a `scan` reply is validated against the
   requested point count; on mismatch the page retries once, then skips the
   sweep and logs it (the `robust_acquisition_loop.py` pattern).
5. **F V3 above 6 GHz** — the envelope caps at 6 GHz so the page never asks.

## Verified on hardware — NanoVNA-F V3, firmware 0.5.8 (2026-10-17)

From the page's own diagnostic sample (Chrome/Edge on Windows):

- Echo + doubled prompt `ch> \r\nch> ` on every command, exactly as nvnapython
  documents. `version` answers with the bare `0.5.8`; the model name is in
  `info` (`Model:        NanoVNA-F_V3`).
- `scan a b n 7` returns `n` lines of `freq s11re s11im s21re s21im ` with a
  **trailing space**, integer Hz, no header or footer. 801 points parsed OK.
- **`scan` rewrites the device's own sweep.** After `scan … 11 7`, `sweep`
  and `data 0` reflect 11 points. The page records the device sweep at
  connect and restores it on disconnect.
- Timing: 11 pts ≈ 0.38 s, 801 pts ≈ 4.8 s (≈ 5.5 ms/point + ~0.3 s).
  `frequencies` at 801 pts ≈ 0.33 s. `sweep` (read) ≈ 0.8 s. The scan
  timeout scales with points.
- **`cwfreq` takes Hz** on this firmware (`help`: `cwfreq {frequency(Hz)}`),
  not kHz as on older units. The page reads the unit from `help` at connect.
- `help` lists: reset cwfreq saveconfig clearconfig data frequencies scan
  sweep touchcal touchtest pause resume cal save recall trace marker edelay
  pwm beep lcd capture version info SN resolution LCD_ID rtc. Rejections are
  reported as `usage: …` lines, which `looksLikeError()` catches.
- `marker [1|2|3|4] [on|off|{index}]`, `trace [0|1|2|3|all] [{format}|scale|
  refpos|channel|off] [{value}]`, `edelay {value}`, `pwm {0.0-1.0}`,
  `beep on/off` — syntax as the page sends it.
- `cal open/short/load/thru/done/on/off/reset` all reply with a prompt in
  45–400 ms while the device is sweeping (console log, 07:02–07:05).
- **`save 0` hung the device.** Echo only, then no reply to anything —
  not even command echoes — for 90+ s; the screen froze too. Recovery is a
  power cycle. The page now warns before sending `save` on an F V3 and
  probes with `version` afterwards. Prefer the device menu (CAL → SAVE).

## Not yet verified on hardware

- `capture` byte order (page assumes little-endian RGB565, B/R swapped).
- `cal …` sequence and whether `scan` output is corrected when cal is on.
  Working assumption (edy555 lineage): standards are measured from the
  **live** sweep, so the device must not be paused and must be on the range
  you will measure with; `cal done` applies the correction.
- `edelay` units and reply format.
- `marker`/`trace` effect while paused; exact trace format names accepted.
- `beep` latency; whether `cwfreq` disturbs a following `scan`.

- `edelay` units and reply format (the page shows the reply as-is).
- Whether `marker N idx` and `trace 0 fmt` take effect while the sweep is
  paused, and the exact format names the F V3 accepts.
- `beep on`/`off` latency — the page holds it 60–150 ms.
- Whether `cwfreq` disturbs a subsequent `scan`.

The **Collect diagnostic sample** button on the page records the raw bytes and
timings for all of these in one JSON file.

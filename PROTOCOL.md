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
| `pause` | — | Sent once after connecting so the device's own sweep doesn't contend with ours (robust-loop pattern from `nvnapython`) |
| `resume` | — | Sent on disconnect and on page close |
| `scan <start> <stop> <pts> 7` | `pts` lines of `freq s11re s11im s21re s21im` | **Every sweep.** Outmask 7 = frequency + S11 + S21 |
| `sweep` | `start stop pts` | Diagnostics only (read back device sweep) |
| `frequencies` | one frequency per line | Diagnostics only |
| `data 0` / `data 1` | `re im` per line for S11 / S21 of the device's current sweep | Diagnostics only |
| `capture` | binary: width × height × 2 bytes, RGB565 | *Device screenshot* button |

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

1. **Doubled prompt with trailing space** — see framing above.
2. **`save N` returns no prompt** on the F V2 (echo only, even after 30 s). Not
   used in v0.1, but `commandNoPrompt()` is there for the calibration panel.
3. **Shared VID/PID with the tinySA** — identification is by reply, not by USB ID.
4. **Short lines / partial replies** — a `scan` reply is validated against the
   requested point count; on mismatch the page retries once, then skips the
   sweep and logs it (the `robust_acquisition_loop.py` pattern).
5. **F V3 above 6 GHz** — the envelope caps at 6 GHz so the page never asks.

## Not yet verified on hardware

The page was built against the demo device and the library's notes. First
things to check with a real unit, in the order they'd break:

- `scan … 7` line format on the F V3 at 801 points (field count, integer
  frequencies, any header/footer lines).
- Whether `capture` echoes the command before the pixel data, and the byte
  order (the page assumes little-endian RGB565 with the F-series B/R swap,
  per `screen_capture.py`).
- Real sweep time at full points, which decides whether *Continuous* needs
  a throttle.
- Whether `pause` is needed at all for `scan` to return clean data.

The **Collect diagnostic sample** button on the page records the raw bytes and
timings for all of these in one JSON file.

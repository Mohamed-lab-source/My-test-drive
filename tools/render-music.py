"""Render Pachelbel's Canon in D for grand piano, violin and cello from real samples.

usage: python3 -I render.py SAMPLES_DIR OUT_WAV
"""
import math
import os
import random
import subprocess
import sys
import wave

import numpy as np

SR = 44100
SAMPLES, OUT = sys.argv[1], sys.argv[2]
random.seed(7)

NAMES = {"C": 0, "C#": 1, "Cs": 1, "D": 2, "D#": 3, "Ds": 3, "E": 4, "F": 5, "F#": 6, "Fs": 6,
         "G": 7, "G#": 8, "Gs": 8, "A": 9, "A#": 10, "As": 10, "B": 11}


def midi_of(name):
    for k in sorted(NAMES, key=len, reverse=True):
        if name.startswith(k) and name[len(k):].lstrip("-").isdigit():
            return 12 * (int(name[len(k):]) + 1) + NAMES[k]
    return None


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def load_bank(folder, suffix=""):
    bank = {}
    for f in os.listdir(folder):
        if not f.endswith(".mp3") or " " in f:
            continue
        stem = f[:-4]
        if suffix and stem.endswith(suffix):
            stem = stem[: -len(suffix)]
        m = midi_of(stem)
        if m is not None:
            bank[m] = os.path.join(folder, f)
    return bank


class Instrument:
    def __init__(self, bank, attack=0.004, max_shift=4):
        self.bank, self.cache, self.attack, self.max_shift = bank, {}, attack, max_shift

    def sample(self, m):
        if m not in self.cache:
            d = decode(self.bank[m])
            rms = np.sqrt((d ** 2).mean(axis=0)) + 1e-9
            self.cache[m] = d * (rms.mean() / rms)  # even out left/right in the source recording
        return self.cache[m]

    def render(self, midi, dur, release):
        src = min(self.bank, key=lambda k: abs(k - midi))
        data = self.sample(src)
        ratio = 2 ** ((midi - src) / 12)
        n = int((dur + release) * SR)
        idx = np.arange(n) * ratio
        idx = idx[idx < len(data) - 1]
        out = np.empty((len(idx), 2), dtype=np.float32)
        for c in range(2):
            out[:, c] = np.interp(idx, np.arange(len(data)), data[:, c])
        env = np.ones(len(out), dtype=np.float32)
        a = int(self.attack * SR)
        if a:
            env[:a] = np.linspace(0, 1, a)
        hold = int(dur * SR)
        if hold < len(out):
            tail = len(out) - hold
            env[hold:] *= np.cos(np.linspace(0, math.pi / 2, tail)) ** 2
        return out * env[:, None]


piano_soft = Instrument(load_bank(os.path.join(SAMPLES, "pianov8/package/audio"), "v8"))
piano_bright = Instrument(load_bank(os.path.join(SAMPLES, "pianov12/package/audio"), "v12"))
violin = Instrument(load_bank(os.path.join(SAMPLES, "violin/package")), attack=0.18)
cello = Instrument(load_bank(os.path.join(SAMPLES, "cello/package")), attack=0.12)

BPM = 64
BEAT = 60 / BPM
CYCLE = 16 * BEAT  # eight chords, two beats each
TOTAL = 7 * CYCLE + 7.0
mix = np.zeros((int(TOTAL * SR) + SR * 12, 2), dtype=np.float32)


def place(audio, t, gain, pan=0.0):
    t += random.uniform(-0.006, 0.006)
    i = max(0, int(t * SR))
    l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
    seg = audio[: len(mix) - i]
    mix[i:i + len(seg), 0] += seg[:, 0] * gain * l * 1.41
    mix[i:i + len(seg), 1] += seg[:, 1] * gain * r * 1.41


def note(inst, midi, t, dur, gain, pan=0.0, release=0.6):
    place(inst.render(midi, dur, release), t, gain * random.uniform(0.92, 1.05), pan)


# D  A  Bm  F#m  G  D  G  A
BASS = [38, 33, 35, 30, 31, 26, 31, 33]          # D2 A1 B1 F#1 G1 D1 G1 A1
THIRD = [4, 4, 3, 3, 4, 4, 4, 4]
V1 = [78, 76, 74, 73, 71, 69, 71, 73]             # F#5 E5 D5 C#5 B4 A4 B4 C#5 (halves)
V2 = [74, 73, 71, 69, 67, 66, 67, 64]             # D5 C#5 B4 A4 G4 F#4 G4 E4 (halves)
V3 = [74, 78, 81, 79, 78, 74, 78, 76, 74, 71, 74, 81, 79, 83, 81, 79]  # quarters


def arpeggio(t0, chord, kind, gain):
    root = BASS[chord] + 24          # D4 region
    if root > 64:
        root -= 12
    third = root + THIRD[chord]
    fifth = root + 7
    if kind == "eighths":
        notes, step = [root, fifth, root + 12, third + 12], BEAT / 2
    else:
        notes, step = [root, fifth, root + 12, third + 12, root + 19, third + 12, root + 12, fifth], BEAT / 4
    for k, m in enumerate(notes):
        note(piano_soft, m, t0 + k * step, 2 * BEAT - k * step + 0.2, gain * (1.0 if k == 0 else 0.85), pan=-0.05 + 0.05 * (k % 3))


def bass(t0, chord, gain, octave=True):
    note(piano_soft, BASS[chord] + 12, t0, 2 * BEAT + 0.3, gain * 0.8, pan=0.0, release=0.8)
    if octave:
        note(piano_soft, BASS[chord], t0, 2 * BEAT + 0.3, gain * 0.42, pan=0.0, release=0.8)


def cycle(n, t0, *, arp, arp_gain, bass_gain, cello_line=False, piano_mel=None, vln1=None, vln2=None, vln_gain=0.32):
    for c in range(8):
        t = t0 + c * 2 * BEAT
        if arp:
            arpeggio(t, c, arp, arp_gain)
        bass(t, c, bass_gain)
        if cello_line:
            note(cello, BASS[c] + 12, t, 2 * BEAT - 0.05, 0.38, pan=-0.15, release=0.35)
        if piano_mel:
            note(piano_bright, piano_mel[c], t, 2 * BEAT, 0.42, pan=0.1, release=0.9)
        if vln1 is V3:
            for q in range(2):
                note(violin, V3[2 * c + q], t + q * BEAT, BEAT - 0.04, vln_gain, pan=0.15, release=0.3)
        elif vln1:
            note(violin, vln1[c], t, 2 * BEAT - 0.06, vln_gain, pan=0.15, release=0.4)
        if vln2:
            note(violin, vln2[c], t, 2 * BEAT - 0.06, vln_gain * 0.75, pan=-0.1, release=0.4)


t = 0.6
cycle(1, t, arp="eighths", arp_gain=0.46, bass_gain=0.55); t += CYCLE
cycle(2, t, arp="eighths", arp_gain=0.42, bass_gain=0.5, piano_mel=V1); t += CYCLE
cycle(3, t, arp="sixteenths", arp_gain=0.24, bass_gain=0.36, cello_line=True, vln1=V1); t += CYCLE
cycle(4, t, arp="sixteenths", arp_gain=0.24, bass_gain=0.36, cello_line=True, vln1=V3, piano_mel=V2); t += CYCLE
cycle(5, t, arp="sixteenths", arp_gain=0.26, bass_gain=0.38, cello_line=True, vln1=V1, vln2=V2, vln_gain=0.36); t += CYCLE
cycle(6, t, arp="sixteenths", arp_gain=0.26, bass_gain=0.38, cello_line=True, vln1=V3, piano_mel=V1, vln_gain=0.36); t += CYCLE
cycle(7, t, arp="eighths", arp_gain=0.26, bass_gain=0.36, cello_line=True, piano_mel=V2, vln1=V1, vln_gain=0.30); t += CYCLE

# final D major chord, held
for m, g in [(26, 0.4), (38, 0.45), (50, 0.35), (57, 0.3), (62, 0.3), (66, 0.3), (74, 0.38)]:
    note(piano_bright if m >= 62 else piano_soft, m, t, 5.5, g, release=1.5)
note(cello, 38, t, 4.0, 0.4, pan=-0.45, release=1.2)
note(violin, 78, t + 0.1, 4.0, 0.3, pan=0.35, release=1.2)

end = int((t + 7.5) * SR)
dry = mix[:end]

# convolution reverb (synthetic hall impulse)
ir_len = int(2.8 * SR)
ir = np.random.default_rng(3).standard_normal((ir_len, 2)).astype(np.float32)
decay = np.exp(-np.linspace(0, 7.5, ir_len))[:, None]
ir *= decay
ir[: int(0.012 * SR)] = 0
ir /= np.sqrt((ir ** 2).sum(axis=0))
N = 1 << int(math.ceil(math.log2(len(dry) + ir_len)))
wet = np.zeros_like(dry)
for c in range(2):
    full = np.fft.irfft(np.fft.rfft(dry[:, c], N) * np.fft.rfft(ir[:, c], N), N)
    wet[:, c] = full[: len(dry)]
out = dry * 0.82 + wet * 0.38

# even out the overall left/right balance
rms = np.sqrt((out ** 2).mean(axis=0)) + 1e-9
out = out * (rms.mean() / rms)

# fades and normalise
fi = int(0.5 * SR)
out[:fi] *= np.linspace(0, 1, fi)[:, None]
fo = int(5.5 * SR)
out[-fo:] *= np.cos(np.linspace(0, math.pi / 2, fo))[:, None] ** 2
out /= np.abs(out).max() / 0.89

pcm = (np.clip(out, -1, 1) * 32767).astype("<i2")
with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"rendered {len(out) / SR:.1f}s to {OUT}")

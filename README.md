# Online Wedding Invitation

Ahmed & Lamia's wedding — Wednesday 11 • 11 • 2026, 7–11 PM at Talinda Hall, Amira Valley (Giza).

A wax-sealed envelope that opens on tap to reveal the invitation card, an arch-framed
invitation in ivory / dusty blue / gold, a live countdown, "add to calendar", a venue
photo gallery with directions, and an optional RSVP form. Venue photos and the printed
card live in `assets/`.

## Customize

Edit **`config.js`** — names, date, venue, schedule, wording and RSVP settings all live there.

Set `music: false` to turn the background music off.

RSVP is hidden until one of these is set in `rsvp`:
- `whatsapp` — replies open WhatsApp to that number with the message pre-filled.
- `email` — replies open the guest's email app pre-filled.
- `formEndpoint` — a free [Formspree](https://formspree.io) endpoint to collect replies online.

Colors and fonts are CSS variables at the top of `styles.css`.

## Preview & publish

Open `index.html` in a browser. To share a link, enable **GitHub Pages**
(Settings → Pages → deploy from branch) — no build step needed.

## Music

`assets/music.mp3` is Pachelbel's Canon in D (public domain) arranged for grand piano,
violin and cello, rendered by `tools/render-music.py` from recorded instrument samples:
Salamander Grand Piano by Alexander Holm (`@audio-samples/piano-mp3-*` on npm) and the
violin and cello from nbrosowsky's tonejs-instruments (`tonejs-instrument-*-mp3` on npm).
To re-render, download those packages and run
`python3 tools/render-music.py SAMPLES_DIR out.wav`, then encode to MP3 with ffmpeg.

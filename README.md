# Online Wedding Invitation

A Pinterest-style digital wedding invitation: a wax-sealed envelope that opens on tap,
a floral hero with the couple's names, a live countdown, "add to calendar", the day's
schedule, venue & dress code cards, and an RSVP form.

## Customize

Edit **`config.js`** — names, date, venue, schedule, wording and RSVP settings all live there.

RSVP replies:
- **Online:** create a free form at [formspree.io](https://formspree.io) and paste its endpoint into `rsvp.formEndpoint`.
- **Email (default):** leave `formEndpoint` empty and set `rsvp.email`; the form opens the guest's email app pre-filled.

Colors and fonts are CSS variables at the top of `styles.css`.

## Preview & publish

Open `index.html` in a browser. To share a link, enable **GitHub Pages**
(Settings → Pages → deploy from branch) — no build step needed.

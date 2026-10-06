(() => {
  const W = window.WEDDING;
  const get = (path) => path.split(".").reduce((o, k) => (o ? o[k] : undefined), W);
  const first = (name) => name.split(" ")[0];

  // ── Fill text from config ──
  const derived = {
    partner1: W.couple.partner1,
    partner2: W.couple.partner2,
    first1: first(W.couple.partner1),
    first2: first(W.couple.partner2),
    initials: `${W.couple.partner1[0]}&${W.couple.partner2[0]}`,
  };
  document.querySelectorAll("[data-bind]").forEach((el) => {
    const key = el.dataset.bind;
    const value = key in derived ? derived[key] : get(key);
    if (value) el.textContent = value;
    else el.hidden = true;
  });
  document.title = `${derived.first1} & ${derived.first2} — Wedding Invitation`;
  document.getElementById("map-link").href = W.venue.mapUrl;

  // ── Venue gallery + lightbox ──
  const gallery = document.getElementById("gallery");
  gallery.innerHTML = W.venue.photos
    .map((src, i) => `<button><img src="${src}" alt="${W.venue.name} photo ${i + 1}" loading="lazy" /></button>`)
    .join("");
  const lightbox = document.getElementById("lightbox");
  gallery.addEventListener("click", (e) => {
    const img = e.target.closest("button")?.querySelector("img");
    if (!img) return;
    lightbox.querySelector("img").src = img.src;
    lightbox.showModal();
  });
  lightbox.addEventListener("click", () => lightbox.close());

  // ── Envelope ──
  const envelope = document.getElementById("envelope");
  const screen = document.getElementById("envelope-screen");
  const open = () => {
    envelope.classList.add("open");
    screen.classList.add("opened");
    setTimeout(() => document.body.classList.remove("locked"), 2000);
  };
  envelope.addEventListener("click", open);

  // Sparkles on the envelope screen
  const sparkles = screen.querySelector(".sparkles");
  for (let i = 0; i < 28; i++) {
    const s = document.createElement("i");
    s.style.left = `${Math.random() * 100}%`;
    s.style.top = `${Math.random() * 100}%`;
    s.style.animationDelay = `${Math.random() * 4}s`;
    s.style.scale = 0.5 + Math.random();
    sparkles.appendChild(s);
  }

  // ── Reveal on scroll ──
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.15 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  // ── Countdown ──
  const target = new Date(W.start).getTime();
  const els = ["days", "hours", "mins", "secs"].map((id) => document.getElementById(`cd-${id}`));
  const tick = () => {
    const diff = Math.max(0, target - Date.now());
    const parts = [
      Math.floor(diff / 864e5),
      Math.floor(diff / 36e5) % 24,
      Math.floor(diff / 6e4) % 60,
      Math.floor(diff / 1e3) % 60,
    ];
    parts.forEach((v, i) => (els[i].textContent = i === 0 ? v : String(v).padStart(2, "0")));
  };
  tick();
  setInterval(tick, 1000);

  // ── Add to calendar (Google Calendar link) ──
  const gcal = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  document.getElementById("add-calendar").href =
    "https://calendar.google.com/calendar/render?" +
    new URLSearchParams({
      action: "TEMPLATE",
      text: `Wedding of ${W.couple.partner1} & ${W.couple.partner2}`,
      dates: `${gcal(W.start)}/${gcal(W.end)}`,
      location: `${W.venue.name}, ${W.venue.address}`,
      details: `Directions: ${W.venue.mapUrl}`,
    });

  // ── RSVP ──
  const { rsvp } = W;
  if (!(rsvp.whatsapp || rsvp.email || rsvp.formEndpoint)) return;
  const section = document.getElementById("rsvp");
  section.hidden = false;

  const form = document.getElementById("rsvp-form");
  const status = document.getElementById("form-status");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.name || !data.attending) {
      status.textContent = "Please add your name and let us know if you can come.";
      return;
    }
    const text = `RSVP — ${data.name}\nAttendance: ${data.attending}\nGuests: ${data.guests}${
      data.message ? `\n\n${data.message}` : ""
    }`;

    if (rsvp.formEndpoint) {
      status.textContent = "Sending…";
      try {
        const res = await fetch(rsvp.formEndpoint, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(res.statusText);
        form.reset();
        status.textContent = data.attending.startsWith("Joyfully")
          ? "Thank you! We can't wait to celebrate with you ♡"
          : "Thank you for letting us know — you'll be missed ♡";
      } catch {
        status.textContent = "Something went wrong — please try again.";
      }
    } else if (rsvp.whatsapp) {
      window.open(`https://wa.me/${rsvp.whatsapp}?text=${encodeURIComponent(text)}`, "_blank");
      status.textContent = "Opening WhatsApp…";
    } else {
      window.location.href = `mailto:${rsvp.email}?subject=${encodeURIComponent(
        `RSVP — ${data.name}`
      )}&body=${encodeURIComponent(text)}`;
      status.textContent = "Opening your email app…";
    }
  });
})();

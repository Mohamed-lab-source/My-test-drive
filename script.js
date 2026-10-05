(() => {
  const W = window.WEDDING;
  const get = (path) => path.split(".").reduce((o, k) => (o ? o[k] : undefined), W);

  // ── Fill text from config ──
  const derived = {
    partner1: W.couple.partner1,
    partner2: W.couple.partner2,
    initials: `${W.couple.partner1[0]}&${W.couple.partner2[0]}`,
  };
  document.querySelectorAll("[data-bind]").forEach((el) => {
    const key = el.dataset.bind;
    const value = key in derived ? derived[key] : get(key);
    if (value != null) el.textContent = value;
  });
  document.title = `${W.couple.partner1} & ${W.couple.partner2} — Wedding Invitation`;
  document.getElementById("map-link").href = W.venue.mapUrl;

  // ── Schedule ──
  document.getElementById("timeline").innerHTML = W.schedule
    .map(
      (s) => `<li class="reveal">
        <span class="t-time">${s.time}</span>
        <div class="t-body"><h3>${s.title}</h3><p>${s.note || ""}</p></div>
      </li>`
    )
    .join("");

  // ── Envelope ──
  const envelope = document.getElementById("envelope");
  const screen = document.getElementById("envelope-screen");
  const open = () => {
    envelope.classList.add("open");
    screen.classList.add("opened");
    setTimeout(() => document.body.classList.remove("locked"), 1400);
  };
  document.getElementById("open-btn").addEventListener("click", open);
  envelope.addEventListener("click", open);

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
  const target = new Date(W.date).getTime();
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

  // ── Add to calendar (.ics download) ──
  document.getElementById("add-calendar").addEventListener("click", () => {
    const start = new Date(W.date);
    const end = new Date(start.getTime() + 6 * 36e5);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Wedding Invitation//EN",
      "BEGIN:VEVENT",
      `UID:${fmt(start)}-wedding@invite`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:Wedding of ${W.couple.partner1} & ${W.couple.partner2}`,
      `LOCATION:${W.venue.name}\\, ${W.venue.address.replace(/,/g, "\\,")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "wedding.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ── RSVP ──
  const form = document.getElementById("rsvp-form");
  const status = document.getElementById("form-status");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.name || !data.attending) {
      status.textContent = "Please add your name and let us know if you can come.";
      return;
    }

    if (W.rsvp.formEndpoint) {
      status.textContent = "Sending…";
      try {
        const res = await fetch(W.rsvp.formEndpoint, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(res.statusText);
        form.reset();
        status.textContent =
          data.attending.startsWith("Joyfully") ? "Thank you! We can't wait to celebrate with you ♡" : "Thank you for letting us know — you'll be missed ♡";
      } catch {
        status.textContent = "Something went wrong — please try again.";
      }
      return;
    }

    const body = `Name: ${data.name}\nAttendance: ${data.attending}\nGuests: ${data.guests}\n\n${data.message || ""}`;
    window.location.href = `mailto:${W.rsvp.email}?subject=${encodeURIComponent(
      `RSVP — ${data.name}`
    )}&body=${encodeURIComponent(body)}`;
    status.textContent = "Opening your email app…";
  });
})();

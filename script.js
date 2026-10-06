(() => {
  const W = window.WEDDING;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const get = (path) => path.split(".").reduce((o, k) => (o ? o[k] : undefined), W);
  const first = (name) => name.split(" ")[0];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Fill text from config ──
  const derived = {
    partner1: W.couple.partner1,
    partner2: W.couple.partner2,
    first1: first(W.couple.partner1),
    first2: first(W.couple.partner2),
    namesShort: `${first(W.couple.partner1)} & ${first(W.couple.partner2)}`,
    initials: `${W.couple.partner1[0]}&${W.couple.partner2[0]}`,
  };
  $$("[data-bind]").forEach((el) => {
    const key = el.dataset.bind;
    const value = key in derived ? derived[key] : get(key);
    if (value) el.textContent = value;
    else el.hidden = true;
  });
  document.title = `${derived.namesShort} — Wedding Invitation`;
  $("#map-link").href = W.venue.mapUrl;

  // ── Split text into letters for the entrance animation ──
  const splitLetters = (el, start, step) => {
    const text = el.textContent;
    el.setAttribute("aria-label", text);
    el.textContent = "";
    let i = 0;
    text.split(" ").forEach((word, wi, words) => {
      const w = document.createElement("span");
      w.className = "w";
      w.setAttribute("aria-hidden", "true");
      for (const c of word) {
        const ch = document.createElement("span");
        ch.className = "ch";
        ch.textContent = c;
        ch.style.setProperty("--d", (start + i++ * step).toFixed(3));
        w.appendChild(ch);
      }
      el.appendChild(w);
      if (wi < words.length - 1) el.appendChild(document.createTextNode(" "));
      i++;
    });
    return text;
  };
  const [tag1, tag2] = $$(".tagline.split");
  const [name1, name2] = $$(".name-text");
  const names = [name1, name2].map((el) => el.textContent);
  if (!reduceMotion) {
    splitLetters(tag1, 1.0, 0.022);
    splitLetters(name1, 1.7, 0.07);
    splitLetters(name2, 2.6, 0.07);
    splitLetters(tag2, 3.3, 0.014);
  }
  const settleNames = () => {
    [name1, name2].forEach((el, i) => {
      el.textContent = names[i];
      el.removeAttribute("aria-label");
      el.classList.add("shine");
    });
  };

  // ── Ornamental flourishes (inline copies so each can animate on its own) ──
  const flourish = $("#flourish");
  $$(".flourish svg").forEach((svg) => {
    const g = flourish.cloneNode(true);
    g.removeAttribute("id");
    svg.replaceChildren(g);
  });

  // ── Venue gallery, carousel dots and lightbox ──
  const gallery = $("#gallery");
  gallery.innerHTML = W.venue.photos
    .map(
      (src, i) =>
        `<button style="--i:${i}" aria-label="View photo ${i + 1} of ${W.venue.name}"><img src="${src}" alt="${W.venue.name} photo ${i + 1}" loading="lazy" /></button>`
    )
    .join("");
  const slides = $$("button", gallery);
  const dots = $("#dots");
  dots.innerHTML = slides.map(() => "<i></i>").join("");
  const dotEls = $$("i", dots);
  const setCurrent = (n) => {
    slides.forEach((s, i) => s.classList.toggle("current", i === n));
    dotEls.forEach((d, i) => d.classList.toggle("on", i === n));
  };
  setCurrent(0);
  gallery.addEventListener(
    "scroll",
    () => {
      const n = Math.round(gallery.scrollLeft / (slides[0].offsetWidth + 8));
      setCurrent(Math.min(slides.length - 1, Math.max(0, n)));
    },
    { passive: true }
  );
  // Gentle auto-advance on phones until the guest touches the carousel
  let autoplay = true;
  ["pointerdown", "touchstart", "wheel"].forEach((ev) =>
    gallery.addEventListener(ev, () => (autoplay = false), { passive: true })
  );
  let galleryVisible = false;
  setInterval(() => {
    if (!autoplay || !galleryVisible || reduceMotion || getComputedStyle(gallery).overflowX !== "auto") return;
    const cur = dotEls.findIndex((d) => d.classList.contains("on"));
    const next = (cur + 1) % slides.length;
    gallery.scrollTo({ left: slides[next].offsetLeft - 16, behavior: "smooth" });
  }, 3800);

  const lightbox = $("#lightbox");
  gallery.addEventListener("click", (e) => {
    const img = e.target.closest("button")?.querySelector("img");
    if (!img) return;
    $("img", lightbox).src = img.src;
    lightbox.showModal();
  });
  lightbox.addEventListener("click", () => lightbox.close());

  // ── Reveal on scroll ──
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.target === gallery) {
          galleryVisible = e.isIntersecting;
          return;
        }
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.15 }
  );
  $$(".reveal, .gallery button").forEach((el) => io.observe(el));
  io.observe(gallery);

  // ── Floating hearts in the footer ──
  const hearts = $(".hearts");
  for (let i = 0; i < 14; i++) {
    const h = document.createElement("i");
    h.textContent = i % 3 ? "♡" : "❀";
    h.style.left = `${Math.random() * 100}%`;
    h.style.fontSize = `${12 + Math.random() * 16}px`;
    h.style.animationDuration = `${7 + Math.random() * 6}s`;
    h.style.animationDelay = `${-Math.random() * 12}s`;
    if (i % 2) h.style.color = "var(--gold-soft)";
    hearts.appendChild(h);
  }

  // ── Parallax on the hero background ──
  const heroBg = $(".hero-bg");
  let ticking = false;
  addEventListener(
    "scroll",
    () => {
      if (ticking || reduceMotion) return;
      ticking = true;
      requestAnimationFrame(() => {
        heroBg.style.transform = `translateY(${scrollY * 0.3}px)`;
        ticking = false;
      });
    },
    { passive: true }
  );

  // ── Effects canvas: drifting petals, twinkles and gold bursts ──
  const fx = (() => {
    const canvas = $("#fx");
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, dpr = 1;
    const petals = [];
    const sparks = [];
    const twinkles = [];
    const PETAL_COLORS = ["#c9d8ea", "#a9bfd9", "#ffffff", "#e8eef6", "#f3e3bd"];
    const GOLD = ["#b8955a", "#d9c39a", "#f3e3bd", "#fff6dc", "#c9a76a"];

    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = innerWidth;
      h = innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    addEventListener("resize", resize);

    const newPetal = (y) => ({
      x: Math.random() * w,
      y: y ?? -20 - Math.random() * h,
      r: 5 + Math.random() * 7,
      vy: 0.35 + Math.random() * 0.6,
      sway: 0.6 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.03,
      flip: Math.random() * Math.PI * 2,
      color: PETAL_COLORS[(Math.random() * PETAL_COLORS.length) | 0],
    });
    const petalCount = () => Math.round(Math.min(28, Math.max(12, w / 22)));
    for (let i = 0; i < petalCount(); i++) petals.push(newPetal(Math.random() * h));
    for (let i = 0; i < 18; i++)
      twinkles.push({ x: Math.random(), y: Math.random(), p: Math.random() * Math.PI * 2, s: 0.6 + Math.random() * 1.4 });

    const burst = (x, y, n = 40, power = 6) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = power * (0.3 + Math.random());
        sparks.push({
          x, y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - power * 0.4,
          life: 1,
          decay: 0.008 + Math.random() * 0.014,
          size: 2 + Math.random() * 4,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          shape: Math.random() < 0.45 ? "star" : "confetti",
          color: GOLD[(Math.random() * GOLD.length) | 0],
        });
      }
    };

    const star = (x, y, r) => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const rad = i % 2 ? r * 0.28 : r;
        const a = (i * Math.PI) / 4;
        ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
    };

    let t = 0;
    const frame = () => {
      t += 1;
      ctx.clearRect(0, 0, w, h);

      // twinkling gold specks
      for (const s of twinkles) {
        const a = (Math.sin(t * 0.03 * s.s + s.p) + 1) / 2;
        if (a < 0.15) continue;
        ctx.globalAlpha = a * 0.7;
        ctx.fillStyle = "#e6cf9c";
        star(s.x * w, s.y * h, 2 + a * 3);
      }

      // petals
      for (const p of petals) {
        p.y += p.vy;
        p.x += Math.sin(t * 0.012 * p.sway + p.phase) * 0.6;
        p.rot += p.vr;
        p.flip += 0.03;
        if (p.y > h + 20) Object.assign(p, newPetal(-20));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.abs(Math.cos(p.flip)) * 0.8 + 0.2);
        ctx.globalAlpha = 0.85;
        const g = ctx.createRadialGradient(-p.r * 0.3, -p.r * 0.2, 0, 0, 0, p.r);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(1, p.color);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -p.r);
        ctx.bezierCurveTo(p.r * 0.9, -p.r * 0.6, p.r * 0.7, p.r * 0.7, 0, p.r);
        ctx.bezierCurveTo(-p.r * 0.7, p.r * 0.7, -p.r * 0.9, -p.r * 0.6, 0, -p.r);
        ctx.fill();
        ctx.restore();
      }

      // bursts
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.97;
        s.vy = s.vy * 0.97 + 0.12;
        s.rot += s.vr;
        s.life -= s.decay;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.min(1, s.life * 1.5);
        ctx.fillStyle = s.color;
        if (s.shape === "star") star(s.x, s.y, s.size * 1.4);
        else {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(s.rot);
          ctx.fillRect(-s.size / 2, -s.size, s.size, s.size * 2);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    };
    if (!reduceMotion) requestAnimationFrame(frame);
    return { burst: reduceMotion ? () => {} : burst };
  })();

  // A little sparkle wherever a guest taps
  addEventListener("pointerdown", (e) => {
    if (e.target.closest("dialog")) return;
    fx.burst(e.clientX, e.clientY, 12, 3);
  });

  // ── Envelope ──
  const envelope = $("#envelope");
  const screen = $("#envelope-screen");
  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    const r = $(".seal").getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    envelope.classList.add("open");
    screen.classList.add("opened");
    navigator.vibrate?.(30);
    fx.burst(cx, cy, 70, 7);
    setTimeout(() => fx.burst(cx, cy - 120, 90, 9), 1300);
    setTimeout(() => document.body.classList.add("revealed"), reduceMotion ? 0 : 2300);
    setTimeout(() => document.body.classList.remove("locked"), reduceMotion ? 0 : 3000);
    setTimeout(settleNames, reduceMotion ? 0 : 2300 + 4300);
  };
  envelope.addEventListener("click", open);

  // ── Countdown with flipping digits ──
  const target = new Date(W.start).getTime();
  const els = ["days", "hours", "mins", "secs"].map((id) => $(`#cd-${id}`));
  const tick = () => {
    const diff = Math.max(0, target - Date.now());
    const parts = [
      Math.floor(diff / 864e5),
      Math.floor(diff / 36e5) % 24,
      Math.floor(diff / 6e4) % 60,
      Math.floor(diff / 1e3) % 60,
    ];
    parts.forEach((v, i) => {
      const text = i === 0 ? String(v) : String(v).padStart(2, "0");
      const el = els[i];
      if (el.textContent === text) return;
      el.textContent = text;
      el.classList.remove("flip");
      void el.offsetWidth;
      el.classList.add("flip");
    });
  };
  tick();
  setInterval(tick, 1000);

  // ── Add to calendar (Google Calendar link) ──
  const gcal = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  $("#add-calendar").href =
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
  $("#rsvp").hidden = false;

  const form = $("#rsvp-form");
  const status = $("#form-status");
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
        const r = status.getBoundingClientRect();
        fx.burst(r.left + r.width / 2, r.top, 60, 6);
        status.textContent = data.attending.startsWith("Joyfully")
          ? "Thank you! We can't wait to celebrate with you ♡"
          : "Thank you for letting us know — you'll be missed ♡";
      } catch {
        status.textContent = "Something went wrong — please try again.";
      }
    } else if (rsvp.whatsapp) {
      location.href = `https://wa.me/${rsvp.whatsapp}?text=${encodeURIComponent(text)}`;
    } else {
      location.href = `mailto:${rsvp.email}?subject=${encodeURIComponent(`RSVP — ${data.name}`)}&body=${encodeURIComponent(text)}`;
      status.textContent = "Opening your email app…";
    }
  });
})();

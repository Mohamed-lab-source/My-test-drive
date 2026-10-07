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
          if (e.target.classList.contains("signature")) setTimeout(() => fx.show(4), 2400);
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

    // Fireworks: a rocket climbs, then bursts into a ring of gold, blue and white
    const rockets = [];
    const SHELL = [GOLD, ["#a9bfd9", "#e8eef6", "#ffffff", "#6f8fb5"], ["#ffffff", "#f3e3bd", "#a9bfd9"]];
    const firework = (x, y) => rockets.push({ x, y: h + 10, ty: y, vy: -(h - y) / 48, palette: SHELL[(Math.random() * SHELL.length) | 0] });
    const explode = (r) => {
      const n = 70;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const v = 3.2 + Math.random() * 1.6;
        sparks.push({
          x: r.x, y: r.y,
          vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          life: 1, decay: 0.009 + Math.random() * 0.008,
          size: 1.6 + Math.random() * 2, rot: 0, vr: 0,
          shape: "dot", glow: true,
          color: r.palette[(Math.random() * r.palette.length) | 0],
        });
      }
      burst(r.x, r.y, 18, 2.5);
    };
    const trail = (x, y) => {
      sparks.push({
        x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 0.6, vy: -Math.random() * 0.6,
        life: 0.9, decay: 0.03, size: 1.5 + Math.random() * 2.5, rot: 0, vr: 0,
        shape: "star", color: GOLD[(Math.random() * GOLD.length) | 0],
      });
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

      // rockets
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.y += r.vy;
        r.vy *= 0.985;
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#fff3d6";
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        if (t % 2 === 0) sparks.push({ x: r.x, y: r.y + 4, vx: (Math.random() - 0.5) * 0.4, vy: 0.6, life: 0.6, decay: 0.04, size: 1.5, rot: 0, vr: 0, shape: "dot", color: "#e6cf9c" });
        if (r.y <= r.ty || r.vy > -1.2) {
          rockets.splice(i, 1);
          explode(r);
        }
      }

      // bursts
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.97;
        s.vy = s.vy * 0.97 + (s.glow ? 0.045 : 0.12);
        s.rot += s.vr;
        s.life -= s.decay;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.min(1, s.life * 1.5);
        ctx.fillStyle = s.color;
        if (s.shape === "star") star(s.x, s.y, s.size * 1.4);
        else if (s.shape === "dot") {
          if (s.glow) {
            ctx.globalAlpha *= 0.35;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size * 2.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = Math.min(1, s.life * 1.5);
          }
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
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
    const none = () => {};
    const show = (count = 3) => {
      for (let i = 0; i < count; i++)
        setTimeout(() => firework(w * (0.2 + Math.random() * 0.6), h * (0.18 + Math.random() * 0.25)), i * 420);
    };
    return reduceMotion ? { burst: none, trail: none, show: none } : { burst, trail, show };
  })();

  // A trail of gold dust follows the finger or mouse
  let lastTrail = 0;
  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse" && !e.buttons) return;
      const now = performance.now();
      if (now - lastTrail < 24) return;
      lastTrail = now;
      fx.trail(e.clientX, e.clientY);
    },
    { passive: true }
  );

  // A little sparkle wherever a guest taps
  addEventListener("pointerdown", (e) => {
    if (e.target.closest("dialog")) return;
    fx.burst(e.clientX, e.clientY, 12, 3);
  });

  // ── Background music: Pachelbel's Canon for piano, violin and cello ──
  const music = (() => {
    const audio = $("#bg-music");
    const button = $("#music");
    if (!W.music || !audio) return { start() {} };
    let wanted = false;
    let fade = 0;
    const setUI = () => {
      const on = !audio.paused;
      button.setAttribute("aria-pressed", String(on));
      button.setAttribute("aria-label", on ? "Pause music" : "Play music");
    };
    // Gentle fade in/out (iPhones ignore volume changes, so there it simply starts and stops)
    const rampTo = (target, ms, done) => {
      cancelAnimationFrame(fade);
      const from = audio.volume, t0 = performance.now();
      const step = (now) => {
        const k = Math.max(0, Math.min(1, (now - t0) / ms));
        audio.volume = Math.max(0, Math.min(1, from + (target - from) * k));
        if (k < 1) fade = requestAnimationFrame(step);
        else done?.();
      };
      fade = requestAnimationFrame(step);
    };
    const play = () => {
      wanted = true;
      audio.volume = 0;
      const p = audio.play();
      p?.catch(() => {
        wanted = false;
        setUI();
      });
      rampTo(0.85, 2500);
    };
    const pause = (remember = true) => {
      if (remember) wanted = false;
      rampTo(0, 500, () => audio.pause());
    };
    audio.addEventListener("play", setUI);
    audio.addEventListener("pause", setUI);
    button.addEventListener("click", () => (audio.paused || !wanted ? play() : pause()));
    document.addEventListener("visibilitychange", () => {
      // background tabs don't run animation frames, so stop at once rather than fading
      if (document.hidden) {
        cancelAnimationFrame(fade);
        audio.pause();
      } else if (wanted && audio.paused) play();
    });
    return {
      start() {
        button.hidden = false;
        play();
      },
    };
  })();

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
    music.start();
    navigator.vibrate?.(30);
    fx.burst(cx, cy, 70, 7);
    setTimeout(() => fx.burst(cx, cy - 120, 90, 9), 1300);
    // start the invitation once its fonts are in, so the names never swap typeface mid-animation
    const fontsReady = Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 2500))]);
    setTimeout(() => fontsReady.then(() => document.body.classList.add("revealed")), reduceMotion ? 0 : 2300);
    setTimeout(() => document.body.classList.remove("locked"), reduceMotion ? 0 : 3000);
  };
  envelope.addEventListener("click", open);

  // ── Floating lights ──
  $$(".bokeh").forEach((box) => {
    for (let i = 0; i < 12; i++) {
      const b = document.createElement("i");
      const size = 18 + Math.random() * 70;
      if (i % 3 === 0) b.className = "blue";
      b.style.width = b.style.height = `${size}px`;
      b.style.left = `${Math.random() * 100}%`;
      b.style.top = `${30 + Math.random() * 70}%`;
      b.style.animationDuration = `${9 + Math.random() * 8}s`;
      b.style.animationDelay = `${-Math.random() * 15}s`;
      b.style.setProperty("--dx", `${(Math.random() - 0.5) * 120}px`);
      box.appendChild(b);
    }
  });

  // ── The arch tilts toward the pointer (or with the phone on Android) ──
  if (!reduceMotion) {
    const tilt = $("#tilt");
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const apply = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      tilt.style.transform = `perspective(1000px) rotateX(${cy.toFixed(2)}deg) rotateY(${cx.toFixed(2)}deg)`;
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.01 ? requestAnimationFrame(apply) : 0;
    };
    const aim = (x, y) => {
      tx = Math.max(-1, Math.min(1, x)) * 7;
      ty = Math.max(-1, Math.min(1, y)) * -5;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    $(".hero").addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      aim((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    });
    $(".hero").addEventListener("pointerleave", () => aim(0, 0));
    addEventListener("deviceorientation", (e) => {
      if (e.gamma == null) return;
      aim(e.gamma / 25, (e.beta - 45) / 30);
    });
  }

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

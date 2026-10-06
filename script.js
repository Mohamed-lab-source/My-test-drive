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

  // ── Music box: Pachelbel's Canon, synthesised in the browser ──
  const music = (() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!W.music || !AC) return { start() {} };
    const button = $("#music");
    let ac, master, playing = false, timer, nextTime = 0, step = 0;
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const ROOTS = [50, 45, 47, 42, 43, 38, 43, 45]; // D A Bm F#m G D G A
    const MINOR = [false, false, true, true, false, false, false, false];
    const MELODY = [
      [78, 76, 74, 73, 71, 69, 71, 73],
      [74, 73, 71, 69, 67, 66, 67, 64],
      [78, 81, 79, 78, 76, 74, 76, 73],
    ];
    const EIGHTH = 60 / 66 / 2;

    const bell = (midi, time, vel, dur = 1.6) => {
      const f = mtof(midi);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(vel, time + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      g.connect(master);
      [[1, 1], [2.01, 0.25], [4.02, 0.08]].forEach(([mult, amp]) => {
        const o = ac.createOscillator();
        const og = ac.createGain();
        o.type = "sine";
        o.frequency.value = f * mult;
        og.gain.value = amp;
        o.connect(og).connect(g);
        o.start(time);
        o.stop(time + dur + 0.05);
      });
    };

    const schedule = () => {
      while (nextTime < ac.currentTime + 0.5) {
        const chord = Math.floor(step / 4) % 8;
        const loop = Math.floor(step / 32);
        const pos = step % 4;
        const base = ROOTS[chord] + 12;
        const third = MINOR[chord] ? 3 : 4;
        const arp = [base, base + 7, base + 12, base + 12 + third][pos];
        bell(arp, nextTime, 0.09, 1.4);
        if (pos === 0) {
          bell(ROOTS[chord], nextTime, 0.07, 2.2);
          if (loop > 0) bell(MELODY[(loop - 1) % MELODY.length][chord], nextTime, 0.16, 2.4);
        }
        nextTime += EIGHTH;
        step++;
      }
    };

    const setUI = () => {
      button.setAttribute("aria-pressed", String(playing));
      button.setAttribute("aria-label", playing ? "Pause music" : "Play music");
    };
    const play = () => {
      if (!ac) {
        ac = new AC();
        master = ac.createGain();
        master.gain.value = 0.0001;
        // a little room reverb
        const verb = ac.createConvolver();
        const len = ac.sampleRate * 2.4;
        const ir = ac.createBuffer(2, len, ac.sampleRate);
        for (let c = 0; c < 2; c++) {
          const d = ir.getChannelData(c);
          for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
        }
        verb.buffer = ir;
        const wet = ac.createGain();
        wet.gain.value = 0.35;
        master.connect(ac.destination);
        master.connect(verb).connect(wet).connect(ac.destination);
      }
      ac.resume();
      nextTime = Math.max(nextTime, ac.currentTime + 0.1);
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), ac.currentTime);
      master.gain.exponentialRampToValueAtTime(0.9, ac.currentTime + 1.5);
      clearInterval(timer);
      timer = setInterval(schedule, 120);
      schedule();
      playing = true;
      setUI();
    };
    const pause = () => {
      if (!ac) return;
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setValueAtTime(master.gain.value, ac.currentTime);
      master.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.4);
      clearInterval(timer);
      setTimeout(() => !playing && ac.suspend(), 500);
      playing = false;
      setUI();
    };
    button.addEventListener("click", () => (playing ? pause() : play()));
    let wasPlaying = false;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        wasPlaying = playing;
        if (playing) pause();
      } else if (wasPlaying) play();
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
    setTimeout(() => document.body.classList.add("revealed"), reduceMotion ? 0 : 2300);
    setTimeout(() => document.body.classList.remove("locked"), reduceMotion ? 0 : 3000);
    setTimeout(settleNames, reduceMotion ? 0 : 2300 + 4300);
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

  // ── Scratch-off hearts ──
  (() => {
    const section = $("#save-the-date");
    const hearts = $$(".scratch-heart", section);
    let done = 0;
    const finish = () => {
      section.classList.add("done");
      fx.show(3);
    };
    const clearHeart = (heart) => {
      if (heart.classList.contains("cleared")) return;
      heart.classList.add("cleared");
      const r = heart.getBoundingClientRect();
      fx.burst(r.left + r.width / 2, r.top + r.height / 2, 34, 5);
      if (++done === hearts.length) setTimeout(finish, 500);
    };

    const paint = (canvas) => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = canvas.offsetWidth, h = canvas.offsetHeight;
      if (!w) return false;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const c = canvas.getContext("2d");
      c.scale(dpr, dpr);
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#c9a46a");
      g.addColorStop(0.35, "#f3e1b0");
      g.addColorStop(0.55, "#b8955a");
      g.addColorStop(0.8, "#ecd49c");
      g.addColorStop(1, "#a9874f");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      // foil grain
      for (let i = 0; i < w * h * 0.06; i++) {
        c.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,.35)" : "rgba(120,90,40,.18)";
        c.fillRect(Math.random() * w, Math.random() * h, 1, 1);
      }
      c.fillStyle = "rgba(255,255,255,.9)";
      c.font = `${Math.round(w * 0.2)}px "Great Vibes", cursive`;
      c.textAlign = "center";
      c.fillText("✦", w / 2, h * 0.5);
      return true;
    };

    hearts.forEach((heart) => {
      const canvas = $("canvas", heart);
      let ready = false, drawing = false, moves = 0, last = null;
      const ensure = () => (ready = ready || paint(canvas));
      const pos = (e) => {
        const r = canvas.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
      };
      const scratch = (x, y) => {
        const c = canvas.getContext("2d");
        c.globalCompositeOperation = "destination-out";
        c.lineCap = c.lineJoin = "round";
        c.lineWidth = canvas.offsetWidth * 0.22;
        c.beginPath();
        c.moveTo(...(last || [x, y]));
        c.lineTo(x, y);
        c.stroke();
        last = [x, y];
        if (++moves % 6 === 0) check();
      };
      const check = () => {
        const { width, height } = canvas;
        const data = canvas.getContext("2d").getImageData(0, 0, width, height).data;
        let clear = 0, total = 0;
        for (let i = 3; i < data.length; i += 4 * 24) {
          total++;
          if (data[i] < 40) clear++;
        }
        if (clear / total > 0.45) clearHeart(heart);
      };
      canvas.addEventListener("pointerdown", (e) => {
        if (!ensure()) return;
        drawing = true;
        last = null;
        canvas.setPointerCapture(e.pointerId);
        scratch(...pos(e));
      });
      canvas.addEventListener("pointermove", (e) => drawing && scratch(...pos(e)));
      ["pointerup", "pointercancel"].forEach((ev) => canvas.addEventListener(ev, () => (drawing = false)));
      // paint once visible and once fonts have loaded
      requestAnimationFrame(ensure);
      document.fonts?.ready.then(() => !heart.classList.contains("cleared") && (ready = paint(canvas)));
      addEventListener("resize", () => !heart.classList.contains("cleared") && (ready = paint(canvas)));
    });

    $("#reveal-all").addEventListener("click", () => hearts.forEach((h, i) => setTimeout(() => clearHeart(h), i * 250)));
    if (reduceMotion) {
      hearts.forEach((h) => h.classList.add("cleared"));
      section.classList.add("done");
    }
  })();

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

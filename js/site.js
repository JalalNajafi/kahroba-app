/* Kahroba landing — local motion only. No trackers, no third-party scripts. */
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var tilt = { x: 0, y: 0 };
  var targetTilt = { x: 0, y: 0 };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function initNav() {
    var header = document.querySelector(".site-header");
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.getElementById("nav");
    if (!header || !toggle || !nav) return;

    function setOpen(open) {
      header.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }

    toggle.addEventListener("click", function () {
      setOpen(!header.classList.contains("is-open"));
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  }

  function initReveal() {
    var nodes = document.querySelectorAll(".reveal");
    if (!nodes.length) return;
    if (reduce || !("IntersectionObserver" in window)) {
      nodes.forEach(function (n) { n.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });
    nodes.forEach(function (n) { io.observe(n); });
  }

  function initTilt() {
    var stage = document.querySelector(".hero-stage");
    var phone = document.querySelector(".phone-tilt");
    if (!stage || !phone || reduce) return;

    var rect = null;
    function measure() { rect = stage.getBoundingClientRect(); }

    measure();
    window.addEventListener("resize", measure, { passive: true });

    stage.addEventListener("pointermove", function (e) {
      if (!rect) measure();
      var x = (e.clientX - rect.left) / Math.max(1, rect.width);
      var y = (e.clientY - rect.top) / Math.max(1, rect.height);
      targetTilt.x = clamp((x - 0.5) * 2, -1, 1);
      targetTilt.y = clamp((y - 0.5) * 2, -1, 1);
    });

    stage.addEventListener("pointerleave", function () {
      targetTilt.x = 0;
      targetTilt.y = 0;
    });

    var ticking = false;
    function tick() {
      tilt.x += (targetTilt.x - tilt.x) * 0.08;
      tilt.y += (targetTilt.y - tilt.y) * 0.08;
      var scroll = clamp(window.scrollY / 700, 0, 1);
      var ry = -16 + tilt.x * 10 + scroll * 8;
      var rx = 7 - tilt.y * 7 + scroll * 4;
      phone.style.transform = "rotateY(" + ry.toFixed(2) + "deg) rotateX(" + rx.toFixed(2) + "deg)";
      ticking = false;
    }

    function requestTick() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(tick);
    }

    window.addEventListener("scroll", requestTick, { passive: true });
    (function loop() {
      requestTick();
      requestAnimationFrame(loop);
    })();
  }

  function project(x, y, z, ax, ay, f) {
    var cy = Math.cos(ax), sy = Math.sin(ax);
    var y1 = y * cy - z * sy, z1 = y * sy + z * cy;
    var cx = Math.cos(ay), sx = Math.sin(ay);
    var x2 = x * cx + z1 * sx, z2 = -x * sx + z1 * cx;
    var d = f / (f + z2);
    return [x2 * d, y1 * d, z2, d];
  }

  function teardrop(ctx, r) {
    ctx.moveTo(0, -r * 1.15);
    ctx.bezierCurveTo(r * 0.15, -r * 0.35, r * 0.92, r * 0.05, r * 0.92, r * 0.55);
    ctx.arc(0, r * 0.55, r * 0.92, 0, Math.PI, false);
    ctx.bezierCurveTo(-r * 0.92, r * 0.05, -r * 0.15, -r * 0.35, 0, -r * 1.15);
  }

  function initAperture() {
    var canvas = document.getElementById("aperture");
    if (!canvas) return;
    var ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    var visible = true;
    var start = performance.now();
    var raf = 0;

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
      }, { threshold: 0.01 });
      io.observe(canvas);
    }

    function resize() {
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var rect = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.round(rect.width * dpr));
      var h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      return { w: w, h: h, dpr: dpr };
    }

    function bladePoints(i, n, outerR, innerR, spin) {
      var step = (Math.PI * 2) / n;
      var mid = i * step + spin;
      var overlap = step * 0.42;
      var a0 = mid - step / 2 - overlap;
      var a1 = mid + step / 2 + overlap;
      var pts = [];
      var steps = 7;
      var s;
      for (s = 0; s <= steps; s++) {
        var a = a0 + (a1 - a0) * (s / steps);
        pts.push([Math.cos(a) * outerR, Math.sin(a) * outerR, 0]);
      }
      // Inner edge bows toward a hexagonal opening
      var hex = mid;
      var tipR = innerR * 0.72;
      pts.push([Math.cos(a1 - overlap * 0.3) * innerR, Math.sin(a1 - overlap * 0.3) * innerR, 8]);
      pts.push([Math.cos(hex) * tipR, Math.sin(hex) * tipR, 14]);
      pts.push([Math.cos(a0 + overlap * 0.3) * innerR, Math.sin(a0 + overlap * 0.3) * innerR, 8]);
      return pts;
    }

    function draw(now) {
      var size = resize();
      var w = size.w, h = size.h;
      ctx.clearRect(0, 0, w, h);

      var t = (now - start) / 1000;
      var open = reduce ? 0.46 : 0.34 + 0.16 * (0.5 + 0.5 * Math.sin(t * 0.65));
      var spin = reduce ? -0.22 : t * 0.10;
      var ax = 0.42 + tilt.y * 0.22;
      var ay = -0.38 + tilt.x * 0.32;
      var s = Math.min(w, h);
      var R = s * 0.36;
      var innerR = R * (0.22 + open * 0.28);
      var f = s * 1.35;
      var n = 6;
      var i, k;

      ctx.save();
      ctx.translate(w * 0.52, h * 0.50);

      var glow = ctx.createRadialGradient(0, 0, R * 0.08, 0, 0, R * 1.75);
      glow.addColorStop(0, "rgba(243, 209, 154, 0.32)");
      glow.addColorStop(0.35, "rgba(232, 185, 121, 0.12)");
      glow.addColorStop(1, "rgba(14, 14, 16, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.75, 0, Math.PI * 2);
      ctx.fill();

      function P(p) { return project(p[0], p[1], p[2], ax, ay, f); }

      // Soft orbiting motes
      if (!reduce) {
        for (i = 0; i < 18; i++) {
          var ang = t * 0.22 + i * 0.7;
          var rr = R * (0.7 + (i % 5) * 0.18);
          var p = P([Math.cos(ang) * rr, Math.sin(ang * 0.85) * rr * 0.55, Math.sin(ang) * 30]);
          ctx.fillStyle = "rgba(232, 185, 121," + (0.08 + (i % 3) * 0.05) + ")";
          ctx.beginPath();
          ctx.arc(p[0], p[1], Math.max(0.8, s * 0.0035 * p[3]), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Outer ring
      ctx.lineWidth = Math.max(2, s * 0.012);
      var ring = [];
      for (i = 0; i <= 64; i++) {
        var ra = (i / 64) * Math.PI * 2;
        ring.push(P([Math.cos(ra) * R * 1.02, Math.sin(ra) * R * 1.02, -6]));
      }
      ctx.beginPath();
      for (i = 0; i < ring.length; i++) {
        if (i === 0) ctx.moveTo(ring[i][0], ring[i][1]);
        else ctx.lineTo(ring[i][0], ring[i][1]);
      }
      ctx.closePath();
      ctx.strokeStyle = "rgba(243, 209, 154, 0.55)";
      ctx.stroke();

      var palettes = [
        ["#f3d19a", "#d9a85a", "#8a4e16"],
        ["#e8b979", "#b86a24", "#6d3a12"]
      ];

      var blades = [];
      for (i = 0; i < n; i++) {
        var pts = bladePoints(i, n, R * 0.99, innerR, spin);
        var proj = pts.map(P);
        var z = 0;
        for (k = 0; k < proj.length; k++) z += proj[k][2];
        blades.push({ i: i, proj: proj, z: z / proj.length });
      }
      blades.sort(function (a, b) { return b.z - a.z; });

      for (i = 0; i < blades.length; i++) {
        var b = blades[i];
        var pal = palettes[b.i % 2];
        var pr = b.proj;
        ctx.beginPath();
        for (k = 0; k < pr.length; k++) {
          if (k === 0) ctx.moveTo(pr[k][0], pr[k][1]);
          else ctx.lineTo(pr[k][0], pr[k][1]);
        }
        ctx.closePath();
        var gx0 = pr[0][0], gy0 = pr[0][1];
        var gx1 = pr[Math.floor(pr.length / 2)][0], gy1 = pr[Math.floor(pr.length / 2)][1];
        var lg = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
        lg.addColorStop(0, pal[0]);
        lg.addColorStop(0.5, pal[1]);
        lg.addColorStop(1, pal[2]);
        ctx.fillStyle = lg;
        ctx.fill();
        ctx.strokeStyle = "rgba(14, 14, 16, 0.28)";
        ctx.lineWidth = Math.max(1, s * 0.003);
        ctx.stroke();
      }

      // Hexagon well
      ctx.beginPath();
      for (i = 0; i < 6; i++) {
        var ha = -Math.PI / 2 + i * (Math.PI / 3);
        var hp = P([Math.cos(ha) * innerR * 0.92, Math.sin(ha) * innerR * 0.92, 18]);
        if (i === 0) ctx.moveTo(hp[0], hp[1]);
        else ctx.lineTo(hp[0], hp[1]);
      }
      ctx.closePath();
      ctx.fillStyle = "#0b0b0d";
      ctx.fill();
      ctx.strokeStyle = "rgba(232, 185, 121, 0.35)";
      ctx.lineWidth = Math.max(1, s * 0.004);
      ctx.stroke();

      // Droplet
      var dropR = innerR * 0.28;
      ctx.save();
      // Approximate 3D by projecting a 2D drop at z=22
      var origin = P([0, 0, 22]);
      var scale = origin[3];
      ctx.translate(origin[0], origin[1]);
      ctx.scale(scale, scale);
      ctx.beginPath();
      teardrop(ctx, dropR);
      var dg = ctx.createLinearGradient(0, -dropR, 0, dropR);
      dg.addColorStop(0, "#fff3d2");
      dg.addColorStop(0.45, "#f3d19a");
      dg.addColorStop(1, "#e8b979");
      ctx.fillStyle = dg;
      ctx.fill();
      ctx.restore();

      ctx.restore();

      if (!reduce) raf = requestAnimationFrame(draw);
    }

    draw(performance.now());
    if (reduce) return;

    function loop(now) {
      if (visible) draw(now);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
  }


  function finishIntro() {
    var root = document.documentElement;
    root.classList.add("intro-done");
    root.classList.remove("intro-playing");
    try { sessionStorage.setItem("kahroba-intro", "1"); } catch (e) {}
    var node = document.getElementById("intro");
    if (node) node.setAttribute("aria-hidden", "true");
  }

  function initIntro() {
    var root = document.documentElement;
    var intro = document.getElementById("intro");
    if (!intro || root.classList.contains("intro-skip") || root.classList.contains("intro-done")) return;
    if (reduce) {
      root.classList.add("intro-skip");
      return;
    }

    var skipBtn = document.getElementById("intro-skip");
    var finished = false;

    function skip() {
      if (finished) return;
      finished = true;
      finishIntro();
    }

    if (skipBtn) skipBtn.addEventListener("click", skip);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") skip();
    });

    var canvas = document.getElementById("intro-fx");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    var start = performance.now();
    var impactAt = 700;
    var spawned = false;
    var ripples = [];
    var droplets = [];
    var stopped = false;
    var lastW = 0, lastH = 0, dpr = 1;

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = intro.clientWidth || window.innerWidth;
      var h = intro.clientHeight || window.innerHeight;
      if (w === lastW && h === lastH && canvas.width === Math.round(w * dpr)) return;
      lastW = w;
      lastH = h;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(cx, cy) {
      ripples = [
        { delay: 0, speed: 0.46, width: 2.6, alpha: 0.95, life: 920 },
        { delay: 80, speed: 0.4, width: 1.7, alpha: 0.72, life: 1040 },
        { delay: 180, speed: 0.34, width: 1.2, alpha: 0.5, life: 1160 },
        { delay: 300, speed: 0.28, width: 0.9, alpha: 0.32, life: 980 }
      ];
      droplets = [];
      var n = lastW < 500 ? 11 : 16;
      var i;
      for (i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.28;
        var out = 90 + Math.random() * 210;
        var up = 160 + Math.random() * 200;
        droplets.push({
          x: cx + Math.cos(a) * 4,
          y: cy + 2,
          vx: Math.cos(a) * out,
          vy: Math.sin(a) * out * 0.28 - up,
          r: 1.8 + Math.random() * 3.1,
          life: 520 + Math.random() * 320
        });
      }
    }

    function drawDrop(x, y, r, rot, stretch, alpha) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(1 / stretch, stretch);
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.25);
      ctx.bezierCurveTo(r * 0.18, -r * 0.3, r, r * 0.05, r, r * 0.42);
      ctx.arc(0, r * 0.42, r, 0, Math.PI, false);
      ctx.bezierCurveTo(-r, r * 0.05, -r * 0.18, -r * 0.3, 0, -r * 1.25);
      ctx.fillStyle = "rgba(243, 209, 154," + alpha + ")";
      ctx.fill();
      ctx.restore();
    }

    function frame(now) {
      if (stopped || finished) return;
      var t = now - start;
      resize();
      var w = lastW, h = lastH;
      var cx = w * 0.5, cy = h * 0.48;
      ctx.clearRect(0, 0, w, h);

      if (!spawned && t >= impactAt) {
        spawn(cx, cy);
        spawned = true;
        root.classList.add("intro-fx-on");
      }

      if (spawned) {
        var dt = t - impactAt;
        var flash = Math.max(0, 1 - dt / 200);
        if (flash > 0) {
          var glowR = 90 + dt * 0.55;
          var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
          g.addColorStop(0, "rgba(255, 247, 222," + (0.6 * flash) + ")");
          g.addColorStop(0.28, "rgba(232, 185, 121," + (0.32 * flash) + ")");
          g.addColorStop(1, "rgba(184, 106, 36, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
          ctx.fill();
        }

        var i;
        for (i = 0; i < ripples.length; i++) {
          var rp = ripples[i];
          var age = dt - rp.delay;
          if (age < 0 || age > rp.life) continue;
          var p = age / rp.life;
          var fade = (1 - p) * (1 - p);
          var rad = 10 + age * rp.speed;
          ctx.beginPath();
          ctx.arc(cx, cy, rad, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(243, 209, 154," + (rp.alpha * fade) + ")";
          ctx.lineWidth = rp.width * (1 - p * 0.55);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(0, rad - 5), 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(184, 106, 36," + (rp.alpha * 0.4 * fade) + ")";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        for (i = 0; i < droplets.length; i++) {
          var d = droplets[i];
          if (dt > d.life) continue;
          var s = dt / 1000;
          var x = d.x + d.vx * s;
          var y = d.y + d.vy * s + 0.5 * 1450 * s * s;
          var vx = d.vx;
          var vy = d.vy + 1450 * s;
          var fade = 1 - dt / d.life;
          var stretch = 1 + Math.min(0.85, Math.hypot(vx, vy) / 520);
          var rot = Math.atan2(vy, vx) + Math.PI / 2;
          drawDrop(x, y, d.r * (0.75 + fade * 0.35), rot, stretch, 0.92 * fade);
        }
      }

      if (t < 2000) requestAnimationFrame(frame);
      else stopped = true;
    }

    resize();
    requestAnimationFrame(frame);
    window.addEventListener("resize", resize, { passive: true });
  }

  initNav();
  initReveal();
  initTilt();
  initAperture();
  initIntro();
})();

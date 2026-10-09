// The room: a city's paintings rise out of its mark into frames, each with a wall label.
// Frames are drawn to one scale (px per cm) across every city, so The Lacemaker really is
// small next to The Art of Painting.
(function () {
  var room = document.getElementById('room');
  var scrim = document.getElementById('roomScrim');
  var inner = document.getElementById('roomInner');
  var titleEl = document.getElementById('roomTitle');
  var subEl = document.getElementById('roomSub');
  var worksEl = document.getElementById('roomWorks');
  var closeBtn = document.getElementById('roomClose');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
  var current = null; // { names, origin, anims, closing }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function cm(v) { return String(v).replace(/\.0$/, ''); }
  function joinAnd(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function nPaintings(n) { return (WORDS[n] || n) + (n === 1 ? ' painting' : ' paintings'); }

  /* ---------- mouldings ---------- */
  // Each frame is drawn as one SVG: a moulding profile laid out in "side" coordinates
  // (x runs along the side, y runs from the outer edge in to the picture), then repeated
  // on all four sides with mitred clips. Light comes from the upper left, so the top and
  // left sides are lit and the bottom and right fall into shadow.
  var SVGNS = 'http://www.w3.org/2000/svg';
  var frameSeq = 0;

  function f(v) { return Math.round(v * 100) / 100; }

  // A tiny seeded random so a frame's wear marks stay put between visits.
  function rng(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  }

  // Bands across the moulding, outer edge (0) to sight edge (1).
  function ebonyProfile(id, t, len) {
    var wl = Math.max(5, t * 0.42), g = Math.max(1.3, t * 0.055), rib = Math.max(1.5, t * 0.07);
    var defs =
      // The ripple: ridges that run along the side and undulate, the Dutch golf-lijst.
      '<pattern id="' + id + 'w" patternUnits="userSpaceOnUse" width="' + f(wl) + '" height="' + f(g) + '">' +
        '<rect width="' + f(wl) + '" height="' + f(g) + '" fill="#0e0b09"/>' +
        '<path d="M0,' + f(g * 0.5) + ' C' + f(wl * 0.25) + ',' + f(g * 0.05) + ' ' + f(wl * 0.25) + ',' + f(g * 0.05) + ' ' + f(wl * 0.5) + ',' + f(g * 0.5) +
          ' S' + f(wl * 0.75) + ',' + f(g * 0.95) + ' ' + f(wl) + ',' + f(g * 0.5) + '" fill="none" stroke="#6a5f52" stroke-width="' + f(g * 0.34) + '"/>' +
      '</pattern>' +
      // A cross-ripple: short ribs set across the moulding, like a row of teeth.
      '<pattern id="' + id + 'r" patternUnits="userSpaceOnUse" width="' + f(rib) + '" height="' + f(t) + '">' +
        '<rect width="' + f(rib) + '" height="' + f(t) + '" fill="#0c0a08"/>' +
        '<rect width="' + f(rib * 0.42) + '" height="' + f(t) + '" fill="#564b40"/>' +
      '</pattern>' +
      '<linearGradient id="' + id + 'c" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".45" stop-color="#fff" stop-opacity=".07"/>' +
        '<stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>' +
      '<linearGradient id="' + id + 'p" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#231d18"/><stop offset=".3" stop-color="#0f0c0a"/>' +
        '<stop offset=".6" stop-color="#4d443a"/><stop offset=".68" stop-color="#14100d"/><stop offset="1" stop-color="#0a0807"/></linearGradient>' +
      '<linearGradient id="' + id + 'b" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#0d0b09"/><stop offset=".4" stop-color="#4a4036"/><stop offset="1" stop-color="#0d0b09"/></linearGradient>';
    function band(a, b, fill, shade) {
      var y = f(a * t), h = f((b - a) * t);
      return '<rect x="0" y="' + y + '" width="' + f(len) + '" height="' + h + '" fill="' + fill + '"/>' +
        (shade ? '<rect x="0" y="' + y + '" width="' + f(len) + '" height="' + h + '" fill="url(#' + id + 'c)"/>' : '');
    }
    var body =
      band(0, 0.07, '#0e0c0a') +
      band(0.07, 0.36, 'url(#' + id + 'w)', true) +
      band(0.36, 0.40, '#5a5046') +
      band(0.40, 0.70, 'url(#' + id + 'p)') +          // the flat, polished ebony plate
      band(0.70, 0.73, '#0e0c0a') +
      band(0.73, 0.90, 'url(#' + id + 'r)', true) +
      band(0.90, 1, 'url(#' + id + 'b)');              // a small bead at the sight edge
    return { defs: defs, body: body };
  }

  function giltProfile(id, t, len, rand) {
    var leafW = Math.max(6, t * 0.6), torusH = t * 0.42, beadH = t * 0.17, gad = Math.max(2, t * 0.12);
    var defs =
      '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#7d5a1d"/><stop offset=".3" stop-color="#e9cd84"/><stop offset=".55" stop-color="#c39a45"/>' +
        '<stop offset="1" stop-color="#6b4b16"/></linearGradient>' +
      '<linearGradient id="' + id + 'h" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#5e4212"/><stop offset=".7" stop-color="#a87f34"/><stop offset="1" stop-color="#d7b66a"/></linearGradient>' +
      '<radialGradient id="' + id + 'l" cx=".38" cy=".3" r=".75">' +
        '<stop offset="0" stop-color="#f6e2a2"/><stop offset=".45" stop-color="#cfa752"/><stop offset="1" stop-color="#7a561a"/></radialGradient>' +
      // Gadrooning on the outer edge.
      '<pattern id="' + id + 'd" patternUnits="userSpaceOnUse" width="' + f(gad) + '" height="' + f(t) + '">' +
        '<rect width="' + f(gad) + '" height="' + f(t) + '" fill="#8f6a28"/>' +
        '<ellipse cx="' + f(gad / 2) + '" cy="' + f(t * 0.15) + '" rx="' + f(gad * 0.36) + '" ry="' + f(t * 0.09) + '" fill="url(#' + id + 'l)"/>' +
      '</pattern>' +
      // The carved leaf torus: overlapping leaves with a central vein, and a dart between each.
      '<pattern id="' + id + 'f" patternUnits="userSpaceOnUse" width="' + f(leafW) + '" height="' + f(t) + '" y="' + f(t * 0.22) + '">' +
        '<rect width="' + f(leafW) + '" height="' + f(torusH) + '" fill="url(#' + id + 'g)"/>' +
        '<path d="M' + f(leafW * 0.04) + ',' + f(torusH * 0.5) + ' C' + f(leafW * 0.3) + ',' + f(torusH * -0.02) + ' ' + f(leafW * 0.78) + ',' + f(torusH * 0.08) + ' ' + f(leafW * 0.98) + ',' + f(torusH * 0.5) +
          ' C' + f(leafW * 0.78) + ',' + f(torusH * 0.92) + ' ' + f(leafW * 0.3) + ',' + f(torusH * 1.02) + ' ' + f(leafW * 0.04) + ',' + f(torusH * 0.5) + 'Z" fill="url(#' + id + 'l)" stroke="#5a3f10" stroke-opacity=".55" stroke-width="' + f(Math.max(0.5, t * 0.025)) + '"/>' +
        '<path d="M' + f(leafW * 0.12) + ',' + f(torusH * 0.5) + ' Q' + f(leafW * 0.5) + ',' + f(torusH * 0.4) + ' ' + f(leafW * 0.9) + ',' + f(torusH * 0.5) + '" fill="none" stroke="#6e4e17" stroke-opacity=".6" stroke-width="' + f(Math.max(0.4, t * 0.018)) + '"/>' +
      '</pattern>' +
      // Bead and reel at the sight edge.
      '<pattern id="' + id + 'k" patternUnits="userSpaceOnUse" width="' + f(beadH * 1.7) + '" height="' + f(t) + '" y="' + f(t * 0.83) + '">' +
        '<rect width="' + f(beadH * 1.7) + '" height="' + f(beadH) + '" fill="#6b4b16"/>' +
        '<circle cx="' + f(beadH * 0.55) + '" cy="' + f(beadH * 0.5) + '" r="' + f(beadH * 0.42) + '" fill="url(#' + id + 'l)"/>' +
        '<ellipse cx="' + f(beadH * 1.32) + '" cy="' + f(beadH * 0.5) + '" rx="' + f(beadH * 0.18) + '" ry="' + f(beadH * 0.32) + '" fill="url(#' + id + 'l)"/>' +
      '</pattern>';
    function band(a, b, fill) {
      return '<rect x="0" y="' + f(a * t) + '" width="' + f(len) + '" height="' + f((b - a) * t) + '" fill="' + fill + '"/>';
    }
    // Where the gold has rubbed through to the red bole beneath, on the high points.
    var wear = '';
    var n = Math.round(len / Math.max(8, t * 0.8));
    for (var i = 0; i < n; i++) {
      wear += '<ellipse cx="' + f(rand() * len) + '" cy="' + f(t * (0.26 + rand() * 0.1)) + '" rx="' + f(t * (0.03 + rand() * 0.06)) +
        '" ry="' + f(t * (0.015 + rand() * 0.02)) + '" fill="#8a3a22" fill-opacity="' + f(0.25 + rand() * 0.3) + '"/>';
    }
    var body =
      band(0, 0.05, '#5e4212') +
      band(0.05, 0.22, 'url(#' + id + 'd)') +
      band(0.22, 0.64, 'url(#' + id + 'f)') +
      band(0.64, 0.83, 'url(#' + id + 'h)') +          // the shadowed hollow
      band(0.83, 1, 'url(#' + id + 'k)') +
      wear;
    return { defs: defs, body: body };
  }

  // A carved rosette over each mitre of a gilt frame.
  function cartouche(id, cx, cy, t) {
    var r = t * 0.36, out = '';
    for (var i = 0; i < 4; i++) {
      var a = i * Math.PI / 2 + Math.PI / 4;
      out += '<ellipse cx="' + f(cx + Math.cos(a) * r * 0.62) + '" cy="' + f(cy + Math.sin(a) * r * 0.62) + '" rx="' + f(r * 0.55) + '" ry="' + f(r * 0.32) +
        '" transform="rotate(' + f(a * 180 / Math.PI) + ' ' + f(cx + Math.cos(a) * r * 0.62) + ' ' + f(cy + Math.sin(a) * r * 0.62) + ')" fill="url(#' + id + 'l)" stroke="#5a3f10" stroke-opacity=".5" stroke-width=".6"/>';
    }
    return out + '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r * 0.34) + '" fill="url(#' + id + 'l)" stroke="#5a3f10" stroke-opacity=".6" stroke-width=".6"/>';
  }

  function frameSVG(W, H, t, kind, key) {
    var id = 'fr' + (++frameSeq);
    var rand = rng(key);
    var sides = [
      // [length, transform from side coordinates, light]
      { len: W, m: '1 0 0 1 0 0', light: 'rgba(255,248,225,.16)' },        // top
      { len: H, m: '0 1 1 0 0 0', light: 'rgba(255,248,225,.07)' },        // left
      { len: H, m: '0 1 -1 0 ' + W + ' 0', light: 'rgba(0,0,0,.28)' },     // right
      { len: W, m: '1 0 0 -1 0 ' + H, light: 'rgba(0,0,0,.4)' }            // bottom
    ];
    var defs = '', body = '';
    sides.forEach(function (sd, i) {
      var p = kind === 'gilt' ? giltProfile(id + 's' + i, t, sd.len, rand) : ebonyProfile(id + 's' + i, t, sd.len);
      defs += p.defs +
        '<clipPath id="' + id + 'm' + i + '"><path d="M0,0 L' + f(sd.len) + ',0 L' + f(sd.len - t) + ',' + f(t) + ' L' + f(t) + ',' + f(t) + 'Z"/></clipPath>';
      body += '<g transform="matrix(' + sd.m + ')"><g clip-path="url(#' + id + 'm' + i + ')">' + p.body +
        '<rect width="' + f(sd.len) + '" height="' + f(t) + '" fill="' + sd.light + '"/></g></g>';
    });
    // Hairline mitre joints.
    var mitre = 'M0,0L' + f(t) + ',' + f(t) + 'M' + f(W) + ',0L' + f(W - t) + ',' + f(t) +
      'M0,' + f(H) + 'L' + f(t) + ',' + f(H - t) + 'M' + f(W) + ',' + f(H) + 'L' + f(W - t) + ',' + f(H - t);
    body += '<path d="' + mitre + '" stroke="#000" stroke-opacity=".35" stroke-width=".6"/>';
    if (kind === 'gilt') {
      var c = t * 0.43, g = id + 's0';
      [[c, c], [W - c, c], [c, H - c], [W - c, H - c]].forEach(function (pt) { body += cartouche(g, pt[0], pt[1], t); });
    }
    // The outer edge catches the window light along the top and left.
    body += '<path d="M0.5,' + f(H) + 'L0.5,0.5L' + f(W) + ',0.5" fill="none" stroke="rgba(255,245,215,.18)" stroke-width="1"/>';
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'frame-svg');
    svg.setAttribute('viewBox', '0 0 ' + f(W) + ' ' + f(H));
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<defs>' + defs + '</defs>' + body;
    return svg;
  }

  function cord() {
    var c = el('div', 'cord');
    c.setAttribute('aria-hidden', 'true');
    c.innerHTML = '<svg viewBox="0 0 100 44" preserveAspectRatio="none">' +
      '<line class="cord-shadow" x1="51.5" y1="3" x2="25" y2="46"/><line class="cord-shadow" x1="51.5" y1="3" x2="78" y2="46"/>' +
      '<line x1="50" y1="1" x2="23" y2="44"/><line x1="50" y1="1" x2="77" y2="44"/></svg><span class="nail"></span>';
    return c;
  }

  function allWorks() {
    var c = window.VermeerMap.cities, out = [];
    Object.keys(c).forEach(function (k) { out = out.concat(c[k].works); });
    return out;
  }

  // One scale for the whole collection: the largest canvas fills the room, nothing more.
  function pxPerCm() {
    var works = allWorks();
    var maxH = Math.max.apply(null, works.map(function (w) { return w.heightCm; }));
    var maxW = Math.max.apply(null, works.map(function (w) { return w.widthCm; }));
    var mobile = window.innerWidth <= 768;
    var availH = mobile ? Math.min(window.innerHeight * 0.55, 440) : Math.min(window.innerHeight * 0.62, 560);
    var availW = (mobile ? window.innerWidth - 40 : Math.min(window.innerWidth, 1240) - 64) - 2 * 46;
    return Math.min(availH / maxH, availW / maxW);
  }

  function buildWork(w, S) {
    var mobile = window.innerWidth <= 768;
    var h = w.heightCm * S, wd = w.widthCm * S;
    // Keep the smallest pictures legible; past that floor, size stays proportional.
    var floor = mobile ? 120 : 84;
    if (h < floor) { wd *= floor / h; h = floor; }
    // Period frames are deep: a Dutch ebony moulding often ran to a fifth of the picture's width.
    var t = Math.round(Math.min(46, Math.max(15, 5 + 0.15 * Math.max(h, wd))));

    var work = el('figure', 'work');
    var hanger = el('div', 'work-hanger');
    var frame = el('div', 'frame ' + (w.frame || 'ebony') + (w.stolen ? ' empty' : ''));
    frame.style.setProperty('--t', t + 'px');
    var canvas = el('div', 'canvas');
    var cw = Math.round(wd), ch = Math.round(h);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    frame.appendChild(cord());
    frame.appendChild(frameSVG(cw + 2 * t, ch + 2 * t, t, w.frame || 'ebony', w.id));
    if (w.stolen) {
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'An empty frame where ' + w.title + ' once hung');
    } else {
      var img = new Image();
      img.src = w.image;
      img.alt = w.title + ', ' + w.year;
      img.decoding = 'async';
      canvas.appendChild(img);
    }
    frame.appendChild(canvas);
    hanger.appendChild(frame);
    work.appendChild(hanger);

    var label = el('figcaption', 'wall-label');
    label.appendChild(el('div', 't', w.title));
    label.appendChild(el('div', 'y', w.year));
    label.appendChild(el('div', 'm', w.museum));
    label.appendChild(el('div', 'c', w.city + ', ' + w.country));
    label.appendChild(el('div', 'd', cm(w.heightCm) + ' × ' + cm(w.widthCm) + ' cm'));
    if (w.note) label.appendChild(el('div', 'note', w.note));
    if (w.seen) {
      // A sticky note on the label's edge, in my own hand.
      label.classList.add('has-seen');
      var note = el('div', 'postit');
      // Stuck on by hand, so each sits at its own slight angle (fixed per painting).
      note.style.setProperty('--tilt', (rng(w.id)() * 8 - 2.5).toFixed(1) + 'deg');
      note.appendChild(el('span', null, 'seen'));
      if (w.seen !== true) note.appendChild(el('span', null, String(w.seen)));
      label.appendChild(note);
    }
    work.appendChild(label);
    work._frameH = h + 2 * t;
    return work;
  }

  function build(names) {
    var cities = names.map(function (n) { return window.VermeerMap.cities[n]; });
    var works = [];
    cities.forEach(function (c) { works = works.concat(c.works); });
    var museums = [];
    works.forEach(function (w) { if (museums.indexOf(w.museum) < 0) museums.push(w.museum); });
    var countries = [];
    cities.forEach(function (c) { if (countries.indexOf(c.country) < 0) countries.push(c.country); });

    titleEl.textContent = joinAnd(names);
    subEl.textContent = museums.length === 1
      ? nPaintings(works.length) + ' at the ' + museums[0].replace(/^The /, '') + ', ' + countries.join(', ') + '.'
      : nPaintings(works.length) + ' in ' + (WORDS[museums.length] || museums.length).toLowerCase() +
        ' collections, ' + joinAnd(countries) + '.';

    worksEl.textContent = '';
    var S = pxPerCm();
    museums.forEach(function (m) {
      if (museums.length > 1) worksEl.appendChild(el('p', 'museum-name', m));
      var hang = el('div', 'hang');
      var rowH = 0;
      works.filter(function (w) { return w.museum === m; }).forEach(function (w) {
        var node = buildWork(w, S);
        rowH = Math.max(rowH, node._frameH);
        hang.appendChild(node);
      });
      hang.style.setProperty('--row-h', Math.ceil(rowH) + 'px');
      worksEl.appendChild(hang);
    });
  }

  function originPoint(origin) {
    var target = origin && origin.isConnected ? (origin.querySelector('.mark') || origin) : null;
    if (!target && current) {
      var m = window.VermeerMap.markerFor(current.names[0]);
      target = m && (m.querySelector('.mark') || m);
    }
    if (!target) return { x: window.innerWidth / 2, y: window.innerHeight / 2, size: 16 };
    var r = target.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, size: Math.max(12, r.height) };
  }

  function fromPearl(node, o) {
    var r = node.getBoundingClientRect();
    var dx = o.x - (r.left + r.width / 2), dy = o.y - (r.top + r.height / 2);
    var s = Math.max(0.02, o.size / Math.max(r.width, r.height));
    return 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';
  }

  function lockScroll(on) {
    var de = document.documentElement;
    if (on) {
      var sb = window.innerWidth - de.clientWidth;
      de.style.overflow = 'hidden';
      if (sb) document.body.style.paddingRight = sb + 'px';
    } else {
      de.style.overflow = '';
      document.body.style.paddingRight = '';
    }
  }

  function open(names, origin) {
    if (current) return;
    build(names);
    current = { names: names, origin: origin, anims: [] };
    room.classList.add('open');
    room.scrollTop = 0;
    lockScroll(true);
    window.VermeerMap.setExpanded(names, true);
    closeBtn.focus({ preventScroll: true });

    var quiet = Array.prototype.slice.call(room.querySelectorAll('.room-head, .room-sub, .museum-name, .room-close'));
    var works = Array.prototype.slice.call(worksEl.querySelectorAll('.work'));
    var A = current.anims;

    if (document.hidden) {
      [scrim].concat(quiet).forEach(function (n) { n.style.opacity = 1; });
      return;
    }
    if (reduceMotion.matches) {
      [scrim].concat(quiet, works).forEach(function (n) {
        A.push(n.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'both' }));
      });
      return;
    }
    var o = originPoint(origin);
    A.push(scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out', fill: 'both' }));
    quiet.forEach(function (n, i) {
      A.push(n.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 420, delay: 180 + i * 50, easing: 'ease-out', fill: 'both' }));
    });
    works.forEach(function (n, i) {
      A.push(n.animate([
        { transform: fromPearl(n, o), opacity: 0 },
        { opacity: 1, offset: 0.22 },
        { transform: 'none', opacity: 1 }
      ], { duration: 780, delay: 90 + i * 60, easing: 'cubic-bezier(.2, 1.08, .36, 1)', fill: 'both' }));
    });
  }

  function close() {
    if (!current || current.closing) return;
    current.closing = true;
    var cur = current;
    var works = Array.prototype.slice.call(worksEl.querySelectorAll('.work'));
    var quiet = Array.prototype.slice.call(room.querySelectorAll('.room-head, .room-sub, .museum-name, .room-close'));
    cur.anims.forEach(function (a) { a.finish(); });
    var outs = [];

    if (document.hidden) {
      // No animation frames run in a hidden tab; tear down at once.
    } else if (reduceMotion.matches) {
      outs.push(room.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }));
    } else {
      var o = originPoint(cur.origin);
      // Only animate frames on screen back into the mark; the rest just fade with the room.
      var vh = window.innerHeight;
      var visible = works.filter(function (n) { var r = n.getBoundingClientRect(); return r.bottom > 0 && r.top < vh; });
      visible.reverse().forEach(function (n, i) {
        outs.push(n.animate([{ transform: 'none', opacity: 1 }, { opacity: 1, offset: 0.7 }, { transform: fromPearl(n, o), opacity: 0 }],
          { duration: 460, delay: i * 35, easing: 'cubic-bezier(.55, 0, .7, .4)', fill: 'forwards' }));
      });
      works.forEach(function (n) { if (visible.indexOf(n) < 0) outs.push(n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' })); });
      quiet.forEach(function (n) { outs.push(n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' })); });
      outs.push(scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 200 + visible.length * 35, fill: 'forwards' }));
    }

    Promise.all(outs.map(function (a) { return a.finished; })).then(function () {
      room.classList.remove('open');
      [scrim].concat(quiet).forEach(function (n) { n.style.opacity = ''; });
      outs.concat(cur.anims).forEach(function (a) { a.cancel(); });
      worksEl.textContent = '';
      lockScroll(false);
      window.VermeerMap.setExpanded(cur.names, false);
      var back = cur.origin && cur.origin.isConnected ? cur.origin : window.VermeerMap.markerFor(cur.names[0]);
      if (back) back.focus({ preventScroll: true });
      current = null;
    });
  }

  closeBtn.addEventListener('click', close);
  room.addEventListener('click', function (e) {
    // Anywhere on the bare wall closes the room; the pictures, their labels and the
    // heading don't.
    if (!e.target.closest('.frame, .wall-label, .room-head, .room-sub, .museum-name, .room-close')) close();
  });
  document.addEventListener('keydown', function (e) {
    if (!current) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    // The close control is the room's only stop, so Tab stays on it.
    else if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); }
  });

  window.VermeerRoom = { open: open, close: close };
})();

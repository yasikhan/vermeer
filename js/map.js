// World map: town-sign marks, clustering, pan and zoom by viewBox. No library.
// The coastline is baked into index.html by scripts/build_map.py; the projection
// constants on the <svg> (data-k/tx/ty) let us place markers on that same projection.
(function () {
  var svg = document.getElementById('mapSvg');
  var vp = document.getElementById('mapViewport');
  var markersEl = document.getElementById('markers');
  var worldBtn = document.getElementById('worldBtn');
  var list = document.getElementById('cityList');

  var K = +svg.dataset.k, TX = +svg.dataset.tx, TY = +svg.dataset.ty;
  var vb0 = svg.viewBox.baseVal;
  var FULL = { x: 0, y: 0, w: vb0.width, h: vb0.height };
  var MAX_ZOOM = 64;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Which side a city's name sits on, so neighbours don't write over each other.
  var LABEL_SIDE = { 'The Hague': 'left', 'Dublin': 'left', 'London': 'left', 'Frankfurt': 'left',
    'New York': 'left', 'Washington, D.C.': 'left', 'Braunschweig': 'below' };

  function project(lon, lat) {
    var l = lon * Math.PI / 180, p = lat * Math.PI / 180;
    var p2 = p * p, p4 = p2 * p2;
    var x = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)));
    var y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
    return { x: TX + K * x, y: TY - K * y };
  }

  var cities = [];      // { name, country, x, y, works[] }
  var byName = {};
  var groups = [];      // current clusters: { key, members[], x, y, el }
  var vb = Object.assign({}, FULL);
  var home = Object.assign({}, FULL);
  var tween = null;

  /* ---------- viewBox ---------- */
  function aspect() { return vp.clientWidth / vp.clientHeight || FULL.w / FULL.h; }
  function minW() { return FULL.w / MAX_ZOOM; }

  function clampVB(v) {
    var a = aspect();
    var maxW = Math.min(FULL.w, FULL.h * a);
    var w = Math.max(minW(), Math.min(maxW, v.w));
    var h = w / a;
    var x = Math.max(FULL.x, Math.min(FULL.x + FULL.w - w, v.x));
    var y = Math.max(FULL.y, Math.min(FULL.y + FULL.h - h, v.y));
    return { x: x, y: y, w: w, h: h };
  }

  // The widest view that fits the viewport, centred on where the paintings are.
  function computeHome() {
    var a = aspect();
    var w = Math.min(FULL.w, FULL.h * a), h = w / a;
    var xs = cities.map(function (c) { return c.x; });
    var cx = cities.length ? (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2 : FULL.w / 2;
    return clampVB({ x: cx - w / 2, y: (FULL.h - h) / 2, w: w, h: h });
  }

  function isHome() { return vb.w >= home.w * 0.98; }

  function applyVB(v) {
    vb = v;
    svg.setAttribute('viewBox', v.x.toFixed(3) + ' ' + v.y.toFixed(3) + ' ' + v.w.toFixed(3) + ' ' + v.h.toFixed(3));
    // One screen pixel in map units; the CSS scales stroke widths by it.
    svg.style.setProperty('--u', (v.w / (vp.clientWidth || FULL.w)).toFixed(5));
    var zoomed = !isHome();
    vp.classList.toggle('zoomed', zoomed);
    worldBtn.hidden = !zoomed;
    positionMarkers();
  }

  function setVB(v) { applyVB(clampVB(v)); }

  function animateTo(target, done) {
    target = clampVB(target);
    if (tween) cancelAnimationFrame(tween.raf);
    // Hidden tabs get no animation frames, so jump straight there.
    if (reduceMotion.matches || document.hidden) { applyVB(target); recluster(); if (done) done(); return; }
    var from = Object.assign({}, vb), t0 = performance.now(), dur = 750;
    // Interpolate width geometrically so zooming feels even at every scale.
    tween = { raf: 0 };
    (function step(now) {
      var t = Math.min(1, (now - t0) / dur);
      var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      var w = from.w * Math.pow(target.w / from.w, e);
      var k = (from.w === target.w) ? e : (w - from.w) / (target.w - from.w);
      applyVB({
        x: from.x + (target.x - from.x) * k,
        y: from.y + (target.y - from.y) * k,
        w: w, h: w / aspect()
      });
      if (t < 1) tween.raf = requestAnimationFrame(step);
      else { tween = null; recluster(); if (done) done(); }
    })(t0);
  }

  function zoomAt(factor, sx, sy) {
    var cw = vp.clientWidth, ch = vp.clientHeight;
    if (sx == null) { sx = cw / 2; sy = ch / 2; }
    var px = vb.x + sx / cw * vb.w, py = vb.y + sy / ch * vb.h;
    var w = Math.max(minW(), Math.min(home.w, vb.w / factor));
    var h = w / aspect();
    setVB({ x: px - sx / cw * w, y: py - sy / ch * h, w: w, h: h });
  }

  /* ---------- markers ---------- */
  function toScreen(x, y) {
    return { x: (x - vb.x) / vb.w * vp.clientWidth, y: (y - vb.y) / vb.h * vp.clientHeight };
  }

  function clusterRadius() { return vp.clientWidth < 600 ? 26 : 32; }

  function recluster() {
    var R = clusterRadius();
    var next = [];
    cities.slice().sort(function (a, b) { return b.works.length - a.works.length; }).forEach(function (c) {
      var p = toScreen(c.x, c.y), hit = null;
      for (var i = 0; i < next.length; i++) {
        var q = toScreen(next[i].x, next[i].y);
        if (Math.hypot(p.x - q.x, p.y - q.y) < R) { hit = next[i]; break; }
      }
      if (hit) {
        hit.members.push(c);
        hit.x = mean(hit.members, 'x'); hit.y = mean(hit.members, 'y');
      } else {
        next.push({ members: [c], x: c.x, y: c.y });
      }
    });
    // Merging can pull two centres within reach of each other; settle that too.
    for (var merged = true; merged;) {
      merged = false;
      outer: for (var i = 0; i < next.length; i++) for (var j = i + 1; j < next.length; j++) {
        var a = toScreen(next[i].x, next[i].y), b = toScreen(next[j].x, next[j].y);
        if (Math.hypot(a.x - b.x, a.y - b.y) < R) {
          next[i].members = next[i].members.concat(next[j].members);
          next[i].x = mean(next[i].members, 'x'); next[i].y = mean(next[i].members, 'y');
          next.splice(j, 1); merged = true; break outer;
        }
      }
    }
    next.forEach(function (g) {
      g.key = g.members.map(function (c) { return c.name; }).sort().join('|');
    });

    var old = {};
    groups.forEach(function (g) { old[g.key] = g; });
    var keep = {};
    next.forEach(function (g) {
      if (old[g.key]) { g.el = old[g.key].el; keep[g.key] = 1; }
      else {
        g.el = buildMarker(g);
        if (!document.hidden) g.el.classList.add('entering');
        markersEl.appendChild(g.el);
      }
    });
    groups.forEach(function (g) { if (!keep[g.key]) g.el.remove(); });
    groups = next;
    positionMarkers();
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      groups.forEach(function (g) { g.el.classList.remove('entering'); });
    }); });
  }

  function mean(arr, k) { return arr.reduce(function (s, c) { return s + c[k]; }, 0) / arr.length; }
  function count(members) { return members.reduce(function (s, c) { return s + c.works.length; }, 0); }
  function paintings(n) { return n + (n === 1 ? ' painting' : ' paintings'); }
  // A tiny seeded random, so each city's mark is drawn the same way on every visit.
  function rng(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  }
  function n2(v) { return v.toFixed(2); }

  // A circle drawn by hand: the radius drifts a little around the ring, and the pen
  // runs slightly past where it started.
  function penCircle(r, rad, over) {
    var a0 = r() * Math.PI * 2, p1 = r() * 6, p2 = r() * 6, d = '', n = 28;
    for (var k = 0; k <= n; k++) {
      var t = k / n, ang = a0 + t * Math.PI * 2 * (1 + over);
      var rr = rad * (1 + 0.035 * Math.sin(t * 6.28 * 2 + p1) + 0.025 * Math.sin(t * 6.28 * 3 + p2));
      d += (k ? 'L' : 'M') + n2(Math.cos(ang) * rr) + ',' + n2(Math.sin(ang) * rr);
    }
    return d;
  }

  // The town sign of a 17th-century map: a small ring with a dot at its centre. A cluster
  // is drawn as a double ring. The paper fill knocks the coastline out from behind it.
  function markSVG(key, n) {
    var r = rng(key), one = n === 1;
    var ring = penCircle(r, one ? 5.6 : 5.2, 0);
    var outer = one ? '' : '<path class="ink" stroke-width="1.1" d="' + penCircle(r, 8.4, 0.06) + '"/>';
    return '<svg viewBox="-10 -10 20 20" aria-hidden="true">' +
      outer +
      '<path class="sign" stroke-width="' + (one ? 1.7 : 1.2) + '" d="' + ring + 'Z"/>' +
      '<circle class="dot" cx="' + n2((r() - 0.5) * 0.5) + '" cy="' + n2((r() - 0.5) * 0.5) + '" r="' + (one ? 1.9 : 1.6) + '"/></svg>';
  }

  function allSeen(members) {
    return members.every(function (c) { return c.works.every(function (w) { return w.seen; }); });
  }

  function buildMarker(g) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'mark-btn';
    if (allSeen(g.members)) b.classList.add('seen-all');
    var n = count(g.members);
    if (g.members.length === 1) {
      var c = g.members[0];
      b.dataset.side = LABEL_SIDE[c.name] || 'right';
      b.innerHTML = '<span class="mark">' + markSVG(c.name, 1) + '</span><span class="mark-text"><span class="mark-name"></span><span class="mark-count"></span></span>';
      b.querySelector('.mark-name').textContent = c.name;
      b.querySelector('.mark-count').textContent = n;
      b.setAttribute('aria-label', c.name + ', ' + paintings(n));
      b.setAttribute('aria-haspopup', 'dialog');
      b.setAttribute('aria-expanded', 'false');
    } else {
      b.classList.add('cluster');
      b.dataset.side = 'right';
      b.innerHTML = '<span class="mark">' + markSVG(g.key, g.members.length) + '</span><span class="mark-text"><span class="mark-count"></span></span>';
      b.querySelector('.mark-count').textContent = n;
      b.setAttribute('aria-label', g.members.length + ' cities, ' + paintings(n) + ': ' +
        g.members.map(function (c) { return c.name; }).join(', ') + '. Zoom in');
    }
    b.addEventListener('click', function (e) {
      if (suppressClick) { e.preventDefault(); return; }
      var grp = groups.find(function (x) { return x.el === b; });
      if (!grp) return;
      if (grp.members.length === 1) openCities([grp.members[0].name], b);
      else zoomToGroup(grp);
    });
    return b;
  }

  function positionMarkers() {
    var cw = vp.clientWidth;
    groups.forEach(function (g) {
      var p = toScreen(g.x, g.y);
      g.el.style.left = p.x.toFixed(1) + 'px';
      g.el.style.top = p.y.toFixed(1) + 'px';
      // Flip a name to the other side rather than let the map edge cut it off.
      var side = g.el.dataset.side;
      if (side === 'right' && p.x > cw - 110) side = 'left';
      else if (side === 'left' && p.x < 110) side = 'right';
      g.el.classList.toggle('label-right', side === 'right');
      g.el.classList.toggle('label-left', side === 'left');
      g.el.classList.toggle('label-below', side === 'below');
    });
  }

  function zoomToGroup(g) {
    var xs = g.members.map(function (c) { return c.x; }), ys = g.members.map(function (c) { return c.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var a = aspect();
    // Zoom only as far as it takes for the closest two marks to sit well apart,
    // but always far enough out to keep every member (and its name) in view.
    var closest = Infinity;
    g.members.forEach(function (m, i) {
      g.members.slice(i + 1).forEach(function (n) { closest = Math.min(closest, Math.hypot(m.x - n.x, m.y - n.y)); });
    });
    var apart = closest * vp.clientWidth / (2.6 * clusterRadius());
    var w = Math.max((x1 - x0) * 1.5, (y1 - y0) * 1.8 * a, Math.min(apart, home.w), minW());
    if (vb.w <= minW() * 1.01) {
      // Already as close as the map goes: show these cities together.
      openCities(g.members.map(function (c) { return c.name; }), g.el);
      return;
    }
    animateTo({ x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - w / a / 2, w: w, h: w / a }, function () {
      var still = groups.find(function (x) { return x.key === g.key; });
      var first = groups.find(function (x) { return x.members.indexOf(g.members[0]) > -1; });
      if (still) openCities(g.members.map(function (c) { return c.name; }), still.el);
      else if (first && document.activeElement === document.body) first.el.focus({ preventScroll: true });
    });
  }

  function openCities(names, originEl) {
    if (window.VermeerRoom) window.VermeerRoom.open(names, originEl);
  }

  /* ---------- gestures ---------- */
  var pointers = new Map();
  var drag = null, suppressClick = false;

  vp.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.map-control')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    suppressClick = false;
    drag = { startVB: Object.assign({}, vb), sx: e.clientX, sy: e.clientY, moved: false, pinch: null };
    if (pointers.size === 2) drag.pinch = pinchState();
  });

  function pinchState() {
    var pts = Array.from(pointers.values());
    var r = vp.getBoundingClientRect();
    return {
      d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
      mx: (pts[0].x + pts[1].x) / 2 - r.left, my: (pts[0].y + pts[1].y) / 2 - r.top,
      vb: Object.assign({}, vb)
    };
  }

  vp.addEventListener('pointermove', function (e) {
    if (!drag || !pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && drag.pinch) {
      var pts = Array.from(pointers.values());
      var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      var p = drag.pinch, cw = vp.clientWidth, ch = vp.clientHeight;
      var px = p.vb.x + p.mx / cw * p.vb.w, py = p.vb.y + p.my / ch * p.vb.h;
      var w = p.vb.w * p.d / Math.max(d, 1);
      setVB({ x: px - p.mx / cw * w, y: py - p.my / ch * (w / aspect()), w: w, h: w / aspect() });
      drag.moved = suppressClick = true;
      return;
    }
    var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (isHome() && e.pointerType !== 'mouse') return; // let the page scroll
    if (!drag.moved) {
      drag.moved = suppressClick = true;
      vp.classList.add('dragging');
      try { vp.setPointerCapture(e.pointerId); } catch (_) {}
    }
    var s = drag.startVB;
    setVB({ x: s.x - dx / vp.clientWidth * s.w, y: s.y - dy / vp.clientHeight * s.h, w: s.w, h: s.h });
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 1 && drag) {
      // Pinch became a one-finger drag: restart from here.
      var p = pointers.values().next().value;
      drag = { startVB: Object.assign({}, vb), sx: p.x, sy: p.y, moved: true, pinch: null };
      return;
    }
    if (pointers.size === 0 && drag) {
      var moved = drag.moved;
      drag = null;
      vp.classList.remove('dragging');
      if (moved) recluster();
      setTimeout(function () { suppressClick = false; }, 0);
    }
  }
  vp.addEventListener('pointerup', endPointer);
  vp.addEventListener('pointercancel', endPointer);

  var wheelTimer;
  vp.addEventListener('wheel', function (e) {
    // Plain scrolling moves the page; trackpad pinch (ctrlKey) or ctrl/⌘ + wheel zooms the map.
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    var r = vp.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
    clearTimeout(wheelTimer); wheelTimer = setTimeout(recluster, 120);
  }, { passive: false });

  vp.addEventListener('dblclick', function (e) {
    if (e.target.closest('button')) return;
    var r = vp.getBoundingClientRect();
    var cw = vp.clientWidth, ch = vp.clientHeight;
    var sx = e.clientX - r.left, sy = e.clientY - r.top;
    var px = vb.x + sx / cw * vb.w, py = vb.y + sy / ch * vb.h, w = vb.w / 2.5;
    animateTo({ x: px - w / 2, y: py - w / aspect() / 2, w: w, h: w / aspect() });
  });

  function zoomButton(f) {
    var w = vb.w / f, cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
    animateTo({ x: cx - w / 2, y: cy - w / aspect() / 2, w: w, h: w / aspect() });
  }
  document.getElementById('zoomIn').addEventListener('click', function () { zoomButton(2); });
  document.getElementById('zoomOut').addEventListener('click', function () { zoomButton(0.5); });
  worldBtn.addEventListener('click', function () { animateTo(home); });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var wasHome = isHome();
      home = computeHome();
      setVB(wasHome ? home : { x: vb.x, y: vb.y, w: vb.w, h: vb.w / aspect() });
      recluster();
    }, 100);
  });

  /* ---------- city list ---------- */
  function sortKey(name) { return name.replace(/^The /, ''); }

  // Cities grouped by continent, the continent with the most paintings first.
  function buildList() {
    var byContinent = {};
    cities.forEach(function (c) {
      var k = c.works[0].continent;
      (byContinent[k] = byContinent[k] || []).push(c);
    });
    Object.keys(byContinent).sort(function (a, b) {
      return count(byContinent[b]) - count(byContinent[a]) || a.localeCompare(b);
    }).forEach(function (k) {
      var section = document.createElement('section');
      section.className = 'continent';
      var h = document.createElement('h3');
      h.textContent = k;
      var ul = document.createElement('ul');
      ul.className = 'city-list';
      section.appendChild(h); section.appendChild(ul);
      byContinent[k].sort(function (a, b) { return sortKey(a.name).localeCompare(sortKey(b.name)); })
        .forEach(function (c) { ul.appendChild(cityItem(c)); });
      list.appendChild(section);
    });
  }

  function cityItem(c) {
    var li = document.createElement('li');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'city-link';
    b.setAttribute('aria-haspopup', 'dialog');
    b.innerHTML = '<span class="c"></span><span class="n"><span class="ticks" aria-hidden="true"></span><span class="nt"></span></span>';
    b.querySelector('.c').textContent = c.name;
    b.querySelector('.nt').textContent = paintings(c.works.length);
    var ticks = b.querySelector('.ticks');
    // Seen paintings first, so the row fills up from the left.
    c.works.slice().sort(function (x, y) { return !!y.seen - !!x.seen; }).forEach(function (w) {
      var t = document.createElement('span');
      t.className = 'tick' + (w.seen ? ' seen' : '');
      ticks.appendChild(t);
    });
    var seen = c.works.filter(function (w) { return w.seen; }).length;
    if (seen) b.setAttribute('aria-label', c.name + ', ' + paintings(c.works.length) + ', ' + seen + ' seen');
    b.addEventListener('click', function () { openCities([c.name], b); });
    li.appendChild(b);
    return li;
  }

  /* ---------- public ---------- */
  window.VermeerMap = {
    cities: byName,
    // The marker currently standing for this city (its own mark or its cluster), if any.
    markerFor: function (name) {
      var g = groups.find(function (x) { return x.members.some(function (c) { return c.name === name; }); });
      return g ? g.el : null;
    },
    setExpanded: function (names, on) {
      groups.forEach(function (g) {
        if (g.members.length === 1 && names.indexOf(g.members[0].name) > -1) g.el.setAttribute('aria-expanded', on ? 'true' : 'false');
      });
    }
  };

  /* ---------- load ---------- */
  fetch('data/paintings.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (works) {
      works.forEach(function (w) {
        var c = byName[w.city];
        if (!c) {
          var p = project(w.lon, w.lat);
          c = byName[w.city] = { name: w.city, country: w.country, x: p.x, y: p.y, works: [] };
          cities.push(c);
        }
        c.works.push(w);
      });
      var seen = works.filter(function (w) { return w.seen; }).length;
      var tally = document.getElementById('tally');
      tally.textContent = seen + '/' + works.length;
      tally.setAttribute('aria-label', seen + ' of ' + works.length + ' seen');
      home = computeHome();
      applyVB(home);
      recluster();
      buildList();
    })
    .catch(function () {
      document.getElementById('loadError').hidden = false;
    });
})();

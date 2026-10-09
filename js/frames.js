// The room: a city's paintings rise out of its pearl into frames, each with a wall label.
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
    var availW = (mobile ? window.innerWidth - 40 : Math.min(window.innerWidth, 1240) - 64) - 2 * 26;
    return Math.min(availH / maxH, availW / maxW);
  }

  function buildWork(w, S) {
    var mobile = window.innerWidth <= 768;
    var h = w.heightCm * S, wd = w.widthCm * S;
    // Keep the smallest pictures legible; past that floor, size stays proportional.
    var floor = mobile ? 120 : 84;
    if (h < floor) { wd *= floor / h; h = floor; }
    var t = Math.round(Math.min(26, Math.max(10, 6 + 0.045 * Math.max(h, wd))));

    var work = el('figure', 'work');
    var hanger = el('div', 'work-hanger');
    var frame = el('div', 'frame ' + (w.frame || 'ebony') + (w.stolen ? ' empty' : ''));
    frame.style.setProperty('--t', t + 'px');
    var canvas = el('div', 'canvas');
    canvas.style.width = Math.round(wd) + 'px';
    canvas.style.height = Math.round(h) + 'px';
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
    var target = origin && origin.isConnected ? (origin.querySelector('.pearl') || origin) : null;
    if (!target && current) {
      var m = window.VermeerMap.markerFor(current.names[0]);
      target = m && (m.querySelector('.pearl') || m);
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

    var quiet = Array.prototype.slice.call(room.querySelectorAll('.room-head, .room-sub, .museum-name'));
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
    var quiet = Array.prototype.slice.call(room.querySelectorAll('.room-head, .room-sub, .museum-name'));
    cur.anims.forEach(function (a) { a.finish(); });
    var outs = [];

    if (document.hidden) {
      // No animation frames run in a hidden tab; tear down at once.
    } else if (reduceMotion.matches) {
      outs.push(room.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }));
    } else {
      var o = originPoint(cur.origin);
      // Only animate frames on screen back into the pearl; the rest just fade with the room.
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
    var t = e.target;
    if (t === room || t === scrim || t === inner || t === worksEl || t.classList.contains('hang')) close();
  });
  document.addEventListener('keydown', function (e) {
    if (!current) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    // The close control is the room's only stop, so Tab stays on it.
    else if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); }
  });

  window.VermeerRoom = { open: open, close: close };
})();

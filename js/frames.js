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

  // A thin wax seal in lead-tin: a narrow raised rim around a sunken field, with the year I saw
  // the painting cut into it in Roman numerals. Only the spread of the wax and the angle vary.
  function roman(n) {
    var out = '', v = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1],
      sym = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
    for (var i = 0; i < v.length; i++) while (n >= v[i]) { out += sym[i]; n -= v[i]; }
    return out;
  }

  function sealSVG(w) {
    var r = rng('seal:' + w.id), id = 'seal-' + w.id;
    var p1 = r() * 6.3, p2 = r() * 6.3;
    var pts = [], N = 36;
    for (var i = 0; i < N; i++) {
      var a = i / N * Math.PI * 2;
      var rad = 44 * (1 + 0.03 * Math.sin(2 * a + p1) + 0.022 * Math.sin(3 * a + p2));
      pts.push([rad * Math.cos(a), rad * Math.sin(a)]);
    }
    // Closed Catmull-Rom through the points, as cubic Béziers.
    var f = function (n) { return n.toFixed(1); };
    var path = 'M' + f(pts[0][0]) + ' ' + f(pts[0][1]);
    for (var j = 0; j < N; j++) {
      var p0 = pts[(j + N - 1) % N], q1 = pts[j], q2 = pts[(j + 1) % N], q3 = pts[(j + 2) % N];
      path += 'C' + f(q1[0] + (q2[0] - p0[0]) / 6) + ' ' + f(q1[1] + (q2[1] - p0[1]) / 6) + ' ' +
        f(q2[0] - (q3[0] - q1[0]) / 6) + ' ' + f(q2[1] - (q3[1] - q1[1]) / 6) + ' ' + f(q2[0]) + ' ' + f(q2[1]);
    }
    path += 'Z';
    var word = w.seen === true ? 'seen' : roman(w.seen);
    // Cut in by the die, so each letter's lower-right edge catches the light.
    var year = '<text class="seal-hi" x="0.5" y="5.4" font-size="13">' + word + '</text>' +
      '<text class="seal-lo" x="0" y="4.9" font-size="13">' + word + '</text>';
    return '<svg viewBox="-50 -50 100 100" aria-hidden="true"><defs>' +
      '<linearGradient id="' + id + '-mound" x1="0.15" y1="0.1" x2="0.85" y2="0.95">' +
        '<stop offset="0" stop-color="#FFF4D2" stop-opacity="0.4"/><stop offset="0.45" stop-color="#FFF4D2" stop-opacity="0"/>' +
        '<stop offset="0.6" stop-color="#4A3200" stop-opacity="0"/><stop offset="1" stop-color="#4A3200" stop-opacity="0.22"/></linearGradient>' +
      '<linearGradient id="' + id + '-wall" x1="0.15" y1="0.1" x2="0.85" y2="0.95">' +
        '<stop offset="0" stop-color="#4A3200" stop-opacity="0.4"/><stop offset="0.5" stop-color="#4A3200" stop-opacity="0"/>' +
        '<stop offset="1" stop-color="#FFF4D2" stop-opacity="0.6"/></linearGradient>' +
      '<filter id="' + id + '-soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0.7"/></filter>' +
      '</defs>' +
      '<path class="seal-wax" d="' + path + '"/>' +
      '<path d="' + path + '" fill="url(#' + id + '-mound)"/>' +
      '<circle class="seal-field" r="37"/>' +
      '<circle r="37" fill="none" stroke="url(#' + id + '-wall)" stroke-width="1.8" filter="url(#' + id + '-soft)"/>' +
      year + '</svg>';
  }

  // A moulding is a stack of bands from the outer edge (0) in to the sight edge (1), each
  // filled with a material: a gradient, a ripple pattern, gold, or wood grain. Every kind of
  // frame below is just a different stack, matched to how that painting is framed today.
  function moulding(id, t, len) {
    var defs = '', body = '', n = 0;
    var m = {
      t: t, len: len,
      defs: function (d) { defs += d; },
      // A gradient across the band (top of the band to bottom).
      grad: function (stops) {
        var gid = id + 'g' + (n++);
        defs += '<linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' + stops.map(function (s) {
          return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>';
        }).join('') + '</linearGradient>';
        return 'url(#' + gid + ')';
      },
      // Ridges that run along the side and undulate: the Dutch golf-lijst.
      wave: function (base, hi) {
        var pid = id + 'w' + (n++), wl = Math.max(5, t * 0.42), g = Math.max(1.3, t * 0.055);
        defs += '<pattern id="' + pid + '" patternUnits="userSpaceOnUse" width="' + f(wl) + '" height="' + f(g) + '">' +
          '<rect width="' + f(wl) + '" height="' + f(g) + '" fill="' + base + '"/>' +
          '<path d="M0,' + f(g * 0.5) + ' C' + f(wl * 0.25) + ',' + f(g * 0.05) + ' ' + f(wl * 0.25) + ',' + f(g * 0.05) + ' ' + f(wl * 0.5) + ',' + f(g * 0.5) +
            ' S' + f(wl * 0.75) + ',' + f(g * 0.95) + ' ' + f(wl) + ',' + f(g * 0.5) + '" fill="none" stroke="' + hi + '" stroke-width="' + f(g * 0.34) + '"/></pattern>';
        return 'url(#' + pid + ')';
      },
      // Short ribs set across the moulding, like a row of teeth.
      rib: function (base, hi) {
        var pid = id + 'r' + (n++), w = Math.max(1.5, t * 0.07);
        defs += '<pattern id="' + pid + '" patternUnits="userSpaceOnUse" width="' + f(w) + '" height="' + f(t) + '">' +
          '<rect width="' + f(w) + '" height="' + f(t) + '" fill="' + base + '"/><rect width="' + f(w * 0.42) + '" height="' + f(t) + '" fill="' + hi + '"/></pattern>';
        return 'url(#' + pid + ')';
      },
      // Figured wood (burl walnut, tortoiseshell, plain walnut): turbulence mapped between a
      // dark and a light colour, stretched along the side so the grain follows the moulding.
      grain: function (dark, light, fx, fy, seed) {
        var fid = id + 'n' + (n++);
        function ch(i) { return [dark[i], light[i]]; }
        var rows = [0, 1, 2].map(function (i) {
          var d = ch(i)[0], l = ch(i)[1], k = (l - d) / 0.4;
          return f(k) + ' 0 0 0 ' + f(d - k * 0.3);
        });
        defs += '<filter id="' + fid + '" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">' +
          '<feTurbulence type="fractalNoise" baseFrequency="' + fx + ' ' + fy + '" numOctaves="4" seed="' + seed + '"/>' +
          '<feColorMatrix type="matrix" values="' + rows.join(' ') + ' 0 0 0 0 1"/></filter>';
        return fid;
      },
      // Bead and reel, in gold.
      beads: function (a, b) {
        var pid = id + 'k' + (n++), h = (b - a) * t;
        defs += '<pattern id="' + pid + '" patternUnits="userSpaceOnUse" width="' + f(h * 1.7) + '" height="' + f(t) + '" y="' + f(a * t) + '">' +
          '<rect width="' + f(h * 1.7) + '" height="' + f(h) + '" fill="#6b4b16"/>' +
          '<circle cx="' + f(h * 0.55) + '" cy="' + f(h * 0.5) + '" r="' + f(h * 0.42) + '" fill="url(#' + id + 'L)"/>' +
          '<ellipse cx="' + f(h * 1.32) + '" cy="' + f(h * 0.5) + '" rx="' + f(h * 0.18) + '" ry="' + f(h * 0.32) + '" fill="url(#' + id + 'L)"/></pattern>';
        return 'url(#' + pid + ')';
      },
      band: function (a, b, fill, filter) {
        body += '<rect x="0" y="' + f(a * t) + '" width="' + f(len) + '" height="' + f((b - a) * t) + '"' +
          (filter ? ' filter="url(#' + filter + ')"' : ' fill="' + fill + '"') + '/>';
      },
      // A cushion of light over a band: dark at both edges, a soft sheen on the crown.
      shade: function (a, b, sheen) {
        m.band(a, b, m.grad([[0, '#000', 0.45], [0.42, '#fff', sheen == null ? 0.07 : sheen], [1, '#000', 0.5]]));
      },
      raw: function (svg) { body += svg; },
      out: function () { return { defs: defs, body: body }; }
    };
    // A shared gold for beads and carving.
    defs += '<radialGradient id="' + id + 'L" cx=".38" cy=".3" r=".75"><stop offset="0" stop-color="#e6cd8a"/>' +
      '<stop offset=".45" stop-color="#a98538"/><stop offset="1" stop-color="#4e3610"/></radialGradient>';
    return m;
  }

  var EBONY = { base: '#0e0b09', hi: '#6a5f52', step: '#5a5046',
    plate: [[0, '#231d18'], [0.3, '#0f0c0a'], [0.6, '#4d443a'], [0.68, '#14100d'], [1, '#0a0807']] };
  var ROSEWOOD = { base: '#1c0b06', hi: '#7a4434', step: '#5e3424',
    plate: [[0, '#3a1a10'], [0.3, '#22100a'], [0.6, '#6a3626'], [0.68, '#2a130c'], [1, '#160805']] };
  var GOLD_SIGHT = [[0, '#5e4212'], [0.4, '#e9cd84'], [0.7, '#b48a3c'], [1, '#5e4212']];
  var EBONY_SIGHT = [[0, '#0d0b09'], [0.4, '#4a4036'], [1, '#0d0b09']];

  // Ebony (or rosewood) with ripple and cross-ripple bands around a polished flat plate.
  // `plate: 'tortoise'` gives the mottled flat of A Lady Writing.
  function rippleFrame(m, o) {
    var w = o.wood || EBONY, t = m.t;
    m.band(0, 0.07, '#0e0c0a');
    m.band(0.07, 0.36, m.wave(w.base, w.hi)); m.shade(0.07, 0.36);
    m.band(0.36, 0.40, w.step);
    if (o.plate === 'tortoise') {
      m.band(0.40, 0.70, null, m.grain([0.09, 0.04, 0.02], [0.42, 0.22, 0.08], 0.1, 0.25, 3));
      m.shade(0.40, 0.70, 0.12);
    } else m.band(0.40, 0.70, m.grad(w.plate));
    m.band(0.70, 0.73, '#0e0c0a');
    m.band(0.73, 0.90, m.rib(w.base, w.hi)); m.shade(0.73, 0.90);
    m.band(0.90, 1, m.grad(o.gilt ? GOLD_SIGHT : EBONY_SIGHT));
  }

  // Plain black ebony with stepped profiles and no ripple: a cushion, a hollow, an ogee.
  // `gilt` adds the gilded inner slip some museums use (Edinburgh, Dublin, the Royal Collection).
  function plainFrame(m, o) {
    m.band(0, 0.05, '#0b0908');
    m.band(0.05, 0.32, m.grad([[0, '#0c0a08'], [0.4, '#3d362e'], [1, '#0a0807']]));
    m.band(0.32, 0.36, '#4a4138');
    m.band(0.36, 0.62, m.grad([[0, '#060504'], [0.5, '#161310'], [1, '#2c261f']]));
    m.band(0.62, 0.65, '#4a4138');
    if (o.gilt) {
      m.band(0.65, 0.80, m.grad([[0, '#2a241e'], [0.5, '#0d0b09'], [1, '#2a241e']]));
      m.band(0.80, 1, m.grad([[0, '#5e4212'], [0.25, '#b48a3c'], [0.5, '#ecd28c'], [0.8, '#a87f34'], [1, '#5e4212']]));
    } else {
      m.band(0.65, 0.88, m.grad([[0, '#2a241e'], [0.5, '#0d0b09'], [1, '#3a332b']]));
      m.band(0.88, 1, m.grad(EBONY_SIGHT));
    }
  }

  // Carved and gilded (French or Italian, 17th century): gadrooned edge, a leaf torus,
  // a shadowed hollow and bead and reel, with the red bole showing where it's rubbed.
  function carvedFrame(m, o, rand) {
    var t = m.t, len = m.len, id = m.id;
    var L = Math.max(10, t * 1.1), h = t * 0.42, gad = Math.max(2, t * 0.12);
    var sw = f(Math.max(0.5, t * 0.022));
    // One curled acanthus leaf from the vine at (x0,y0) out to its tip (x1,y1), turning back
    // on itself at the end. `dir` flips it for the leaves below the vine.
    function leaf(x0, y0, x1, y1, dir) {
      var mx = (x0 + x1) / 2, my = (y0 + y1) / 2, w = h * 0.42 * dir;
      return '<path d="M' + f(x0) + ',' + f(y0) +
        ' Q' + f(mx - w) + ',' + f(my - w * 1.4) + ' ' + f(x1) + ',' + f(y1) +
        ' q' + f(L * 0.09) + ',' + f(h * 0.1 * dir) + ' ' + f(L * 0.02) + ',' + f(h * 0.22 * dir) +
        ' Q' + f(mx + w * 1.6) + ',' + f(my + w * 0.6) + ' ' + f(x0) + ',' + f(y0) + 'Z" fill="url(#' + m.lid + ')" stroke="#2a1c06" stroke-opacity=".7" stroke-width="' + sw + '"/>' +
        '<path d="M' + f(x0) + ',' + f(y0) + ' Q' + f(mx) + ',' + f(my) + ' ' + f(x1 - L * 0.02) + ',' + f(y1 + h * 0.06 * dir) + '" fill="none" stroke="#3a2808" stroke-opacity=".6" stroke-width="' + sw + '"/>';
    }
    var pid = 'p' + Math.floor(rand() * 1e9);
    m.defs('<pattern id="' + pid + 'd" patternUnits="userSpaceOnUse" width="' + f(gad) + '" height="' + f(t) + '">' +
        '<rect width="' + f(gad) + '" height="' + f(t) + '" fill="#6a4e1c"/>' +
        '<ellipse cx="' + f(gad / 2) + '" cy="' + f(t * 0.15) + '" rx="' + f(gad * 0.36) + '" ry="' + f(t * 0.09) + '" fill="url(#' + m.lid + ')"/></pattern>' +
      // Scrolling foliage: a vine running along the side, throwing off curled acanthus leaves
      // above and below, carved out of a dark recess so the gold stands proud.
      '<pattern id="' + pid + 'f" patternUnits="userSpaceOnUse" width="' + f(L) + '" height="' + f(t) + '" y="' + f(t * 0.22) + '">' +
        '<rect width="' + f(L) + '" height="' + f(h) + '" fill="#4a3410"/>' +
        leaf(L * 0.04, h * 0.52, L * 0.42, h * 0.04, 1) + leaf(L * 0.54, h * 0.48, L * 0.92, h * 0.96, -1) +
        leaf(L * 0.3, h * 0.3, L * 0.5, h * 0.62, -1) + leaf(L * 0.8, h * 0.7, L * 1.0, h * 0.38, 1) +
        '<path d="M0,' + f(h * 0.5) + ' C' + f(L * 0.25) + ',' + f(h * 0.12) + ' ' + f(L * 0.25) + ',' + f(h * 0.12) + ' ' + f(L * 0.5) + ',' + f(h * 0.5) +
          ' S' + f(L * 0.75) + ',' + f(h * 0.88) + ' ' + f(L) + ',' + f(h * 0.5) + '" fill="none" stroke="url(#' + m.lid + ')" stroke-width="' + f(h * 0.17) + '" stroke-linecap="round"/>' +
        '<circle cx="' + f(L * 0.5) + '" cy="' + f(h * 0.2) + '" r="' + f(h * 0.08) + '" fill="url(#' + m.lid + ')"/>' +
        '<circle cx="' + f(L * 0.02) + '" cy="' + f(h * 0.82) + '" r="' + f(h * 0.08) + '" fill="url(#' + m.lid + ')"/>' +
        '<circle cx="' + f(L * 1.02) + '" cy="' + f(h * 0.82) + '" r="' + f(h * 0.08) + '" fill="url(#' + m.lid + ')"/>' +
      '</pattern>');
    m.band(0, 0.05, '#5e4212');
    m.band(0.05, 0.22, 'url(#' + pid + 'd)');
    m.band(0.22, 0.64, 'url(#' + pid + 'f)');
    m.shade(0.22, 0.64, 0.05);
    m.band(0.64, 0.83, m.grad([[0, '#3a280a'], [0.7, '#86662a'], [1, '#b8984e']]));
    m.band(0.83, 1, m.beads(0.83, 1));
    var wear = '', k = Math.round(len / Math.max(8, t * 0.8));
    for (var i = 0; i < k; i++) {
      wear += '<ellipse cx="' + f(rand() * len) + '" cy="' + f(t * (0.26 + rand() * 0.1)) + '" rx="' + f(t * (0.03 + rand() * 0.06)) +
        '" ry="' + f(t * (0.015 + rand() * 0.02)) + '" fill="#8a3a22" fill-opacity="' + f(0.25 + rand() * 0.3) + '"/>';
    }
    m.raw(wear);
  }

  // A plainer gilt frame (Dresden's gallery frames): a broad gilded flat between beads.
  function giltFrame(m) {
    m.band(0, 0.07, m.grad([[0, '#5e4212'], [0.5, '#c39a45'], [1, '#6b4b16']]));
    m.band(0.07, 0.17, m.beads(0.07, 0.17));
    m.band(0.17, 0.60, m.grad([[0, '#a07a32'], [0.35, '#dcc07a'], [0.7, '#c29a4a'], [1, '#8f6a28']]));
    m.band(0.60, 0.64, '#6b4b16');
    m.band(0.64, 0.84, m.grad([[0, '#7d5a1d'], [0.35, '#ecd28c'], [0.6, '#c39a45'], [1, '#6b4b16']]));
    m.band(0.84, 1, m.beads(0.84, 1));
  }

  // Burl walnut veneer on broad cushions. The Milkmaid's frame adds ripple bands at both edges.
  function burlFrame(m, o) {
    var dark = [0.14, 0.07, 0.03], light = [0.62, 0.36, 0.15];
    if (o.ripple) {
      m.band(0, 0.10, m.wave(ROSEWOOD.base, ROSEWOOD.hi)); m.shade(0, 0.10);
      m.band(0.10, 0.72, null, m.grain(dark, light, 0.09, 0.24, 7)); m.shade(0.10, 0.72, 0.16);
      m.band(0.72, 0.78, m.grad([[0, '#1c0b06'], [0.5, '#5e3424'], [1, '#1c0b06']]));
      m.band(0.78, 0.92, m.wave(ROSEWOOD.base, ROSEWOOD.hi)); m.shade(0.78, 0.92);
      m.band(0.92, 1, m.grad([[0, '#160805'], [0.4, '#4a2416'], [1, '#160805']]));
    } else {
      m.band(0, 0.04, '#1a0d06');
      m.band(0.04, 0.60, null, m.grain(dark, light, 0.08, 0.2, 11)); m.shade(0.04, 0.60, 0.18);
      m.band(0.60, 0.65, '#1a0d06');
      m.band(0.65, 0.92, null, m.grain(dark, light, 0.09, 0.22, 13)); m.shade(0.65, 0.92, 0.14);
      m.band(0.92, 1, m.grad(EBONY_SIGHT));
    }
  }

  // The Lacemaker's frame: a broad walnut flat with floral marquetry, around an ebony inner frame.
  function marquetryFrame(m, o, rand) {
    var t = m.t, len = m.len, a = 0.05, b = 0.58, h = (b - a) * t;
    m.band(0, a, '#120a05');
    m.band(a, b, null, m.grain([0.4, 0.23, 0.08], [0.74, 0.48, 0.2], 0.012, 0.3, 17));
    m.shade(a, b, 0.1);
    // Inlaid flowers and leaves along the flat.
    var step = h * 1.5, out = '';
    for (var x = step * 0.5; x < len; x += step) {
      var cx = x + (rand() - 0.5) * h * 0.2, cy = (a * t + b * t) / 2 + (rand() - 0.5) * h * 0.15, r = h * 0.17;
      for (var p = 0; p < 5; p++) {
        var ang = p * 72 + rand() * 20;
        out += '<ellipse cx="' + f(cx + Math.cos(ang * Math.PI / 180) * r) + '" cy="' + f(cy + Math.sin(ang * Math.PI / 180) * r) + '" rx="' + f(r * 0.75) +
          '" ry="' + f(r * 0.42) + '" transform="rotate(' + f(ang) + ' ' + f(cx + Math.cos(ang * Math.PI / 180) * r) + ' ' + f(cy + Math.sin(ang * Math.PI / 180) * r) + ')" fill="#3a1d0a" fill-opacity=".72"/>';
      }
      out += '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r * 0.45) + '" fill="#e7bf7a" fill-opacity=".8"/>';
      out += '<path d="M' + f(cx + r * 1.4) + ',' + f(cy) + ' q' + f(r * 1.2) + ',' + f(-r * 1.1) + ' ' + f(r * 2.6) + ',' + f(-r * 0.3) +
        ' q' + f(-r * 1.2) + ',' + f(r * 1.1) + ' ' + f(-r * 2.6) + ',' + f(r * 0.3) + 'Z" fill="#3a1d0a" fill-opacity=".55"/>';
    }
    m.raw(out);
    m.band(b, b + 0.04, '#0b0908');
    m.band(b + 0.04, 0.80, m.grad([[0, '#0c0a08'], [0.4, '#3d362e'], [1, '#0a0807']]));
    m.band(0.80, 0.84, '#4a4138');
    m.band(0.84, 0.95, m.grad([[0, '#2a241e'], [0.5, '#0d0b09'], [1, '#2a241e']]));
    m.band(0.95, 1, m.grad(GOLD_SIGHT));
  }

  // How each kind draws, and how wide it runs relative to an ordinary frame.
  var KINDS = {
    'ripple':          { draw: rippleFrame },
    'ripple-gilt':     { draw: rippleFrame, gilt: true },
    'ripple-rosewood': { draw: rippleFrame, wood: ROSEWOOD },
    'ripple-tortoise': { draw: rippleFrame, plate: 'tortoise' },
    'ebony':           { draw: plainFrame },
    'ebony-gilt':      { draw: plainFrame, gilt: true },
    'carved':          { draw: carvedFrame, width: 1.15, corners: true, centres: true },
    'gilt':            { draw: giltFrame, corners: true },
    'burl':            { draw: burlFrame, width: 1.35 },
    'burl-ripple':     { draw: burlFrame, ripple: true, width: 1.2 },
    'marquetry':       { draw: marquetryFrame, width: 2.4 }
  };
  function kindOf(name) { return KINDS[name] || KINDS.ebony; }

  // A carved rosette over each mitre of a gilt frame.
  function cartouche(lid, cx, cy, t) {
    var r = t * 0.3, out = '';
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3 + Math.PI / 6;
      out += '<ellipse cx="' + f(cx + Math.cos(a) * r * 0.62) + '" cy="' + f(cy + Math.sin(a) * r * 0.62) + '" rx="' + f(r * 0.5) + '" ry="' + f(r * 0.26) +
        '" transform="rotate(' + f(a * 180 / Math.PI) + ' ' + f(cx + Math.cos(a) * r * 0.62) + ' ' + f(cy + Math.sin(a) * r * 0.62) + ')" fill="url(#' + lid + ')" stroke="#5a3f10" stroke-opacity=".5" stroke-width=".6"/>';
    }
    return out + '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r * 0.34) + '" fill="url(#' + lid + ')" stroke="#5a3f10" stroke-opacity=".6" stroke-width=".6"/>';
  }

  function frameSVG(W, H, t, kindName, key) {
    var id = 'fr' + (++frameSeq);
    var rand = rng(key), kind = kindOf(kindName);
    var sides = [
      // [length, transform from side coordinates, light]
      { len: W, m: '1 0 0 1 0 0', light: 'rgba(255,248,225,.16)' },        // top
      { len: H, m: '0 1 1 0 0 0', light: 'rgba(255,248,225,.07)' },        // left
      { len: H, m: '0 1 -1 0 ' + W + ' 0', light: 'rgba(0,0,0,.28)' },     // right
      { len: W, m: '1 0 0 -1 0 ' + H, light: 'rgba(0,0,0,.4)' }            // bottom
    ];
    var defs = '', body = '';
    sides.forEach(function (sd, i) {
      var sid = id + 's' + i, m = moulding(sid, t, sd.len);
      m.id = sid; m.lid = sid + 'L';
      kind.draw(m, kind, rand);
      var p = m.out();
      defs += p.defs +
        '<clipPath id="' + id + 'm' + i + '"><path d="M0,0 L' + f(sd.len) + ',0 L' + f(sd.len - t) + ',' + f(t) + ' L' + f(t) + ',' + f(t) + 'Z"/></clipPath>';
      body += '<g transform="matrix(' + sd.m + ')"><g clip-path="url(#' + id + 'm' + i + ')">' + p.body +
        '<rect width="' + f(sd.len) + '" height="' + f(t) + '" fill="' + sd.light + '"/></g></g>';
    });
    // Hairline mitre joints.
    var mitre = 'M0,0L' + f(t) + ',' + f(t) + 'M' + f(W) + ',0L' + f(W - t) + ',' + f(t) +
      'M0,' + f(H) + 'L' + f(t) + ',' + f(H - t) + 'M' + f(W) + ',' + f(H) + 'L' + f(W - t) + ',' + f(H - t);
    body += '<path d="' + mitre + '" stroke="#000" stroke-opacity=".35" stroke-width=".6"/>';
    if (kind.corners) {
      var c = t * 0.43, lid = id + 's0L';
      var pts = [[c, c], [W - c, c], [c, H - c], [W - c, H - c]];
      // Louis XIV frames also carry a cartouche at the centre of each side.
      if (kind.centres) pts.push([W / 2, c], [W / 2, H - c], [c, H / 2], [W - c, H / 2]);
      pts.forEach(function (pt) { body += cartouche(lid, pt[0], pt[1], t); });
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
    var k = kindOf(w.frame).width || 1;
    var t = Math.round(Math.min(46 * k, Math.max(15, (5 + 0.15 * Math.max(h, wd)) * k)));

    var work = el('figure', 'work');
    var hanger = el('div', 'work-hanger');
    var frame = el('div', 'frame' + (w.stolen ? ' empty' : ''));
    frame.style.setProperty('--t', t + 'px');
    var canvas = el('div', 'canvas');
    var cw = Math.round(wd), ch = Math.round(h);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    frame.appendChild(cord());
    frame.appendChild(frameSVG(cw + 2 * t, ch + 2 * t, t, w.frame, w.id));
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
      // A wax seal pressed into the label's corner, with the year I saw it.
      label.classList.add('has-seen');
      var seal = el('div', 'seal');
      seal.setAttribute('role', 'img');
      seal.setAttribute('aria-label', w.seen === true ? 'Seen' : 'Seen in ' + w.seen);
      seal.style.setProperty('--tilt', (rng(w.id)() * 24 - 12).toFixed(1) + 'deg');
      seal.innerHTML = sealSVG(w);
      label.appendChild(seal);
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

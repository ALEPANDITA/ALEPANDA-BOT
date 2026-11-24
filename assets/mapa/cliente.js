// Parte del .mapa que corre DENTRO del panel de WhatsApp (en el celular de quien lo ve).
// Dibuja el mapa con lib/mapa-mundo.js, deja moverlo con el dedo, acercar/alejar y tocar un comercio para verlo en grande.
// Los datos llegan en window.MAPA_DATA (los arma lib/mapa-estados.js). Para regenerar el paquete minificado, ver lib/mapa-panel.js.
(function () {
'use strict';
var D = window.MAPA_DATA, E = window.MapaEdificios, M = window.MapaMundo;
var $ = function (i) { return document.getElementById(i); };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
var dinero = function (n) { return '$' + Math.round(Number(n) || 0).toLocaleString('en-US'); };
var vista = $('vista'), cv = $('mapa'), carga = $('carga'), aviso = $('aviso'), wrap = document.querySelector('.wrap'), giro = false;
var CATS = {}, porId = {}, estados = [], cajas = [], niveles = [], idx = 3, z = 0.6, mundo = null, ocupado = false, mios = [], turno = 0, actual = -1, tAviso = 0;
D.c.forEach(function (c) { CATS[c.id] = c; });

// ---- tamaño de la ventana: aprovechar todo el espacio que da WhatsApp ----
function ventana() { return [window.innerWidth || document.documentElement.clientWidth, window.innerHeight || document.documentElement.clientHeight]; }
function layout(hForzado) {
  var v = ventana(), W = v[0], H = hForzado || v[1], s = wrap.style;
  if (giro) { s.width = H + 'px'; s.height = W + 'px'; s.transformOrigin = '0 0'; s.transform = 'translate(' + W + 'px,0) rotate(90deg)'; }
  else { s.width = ''; s.transform = ''; s.height = H + 'px'; }
  wrap.className = 'wrap' + ((giro ? W : H) < 440 ? ' c' : '');
  $('giro').style.display = giro || H > W * 1.15 ? '' : 'none';
}
function recalcular() { // cambió el tamaño de la ventana: se vuelven a calcular los niveles de zoom (el dibujo actual se queda igual)
  layout();
  var fit = Math.max(0.04, Math.min(vista.clientWidth / M.ANCHO, vista.clientHeight / M.ALTO));
  niveles = [fit].concat([0.2, 0.3, 0.45, 0.65, 0.85].filter(function (v) { return v > fit * 1.15; }));
  idx = 0; for (var i = 1; i < niveles.length; i++) if (Math.abs(niveles[i] - z) < Math.abs(niveles[idx] - z)) idx = i;
  botonesZoom();
}
function arrancar(cb) {
  var h0 = ventana()[1];
  if (h0 >= 440) { layout(); return cb(); }
  layout(660); // la ventana es baja: pido una alta; si WhatsApp ajusta la ventana al contenido, crece
  var n = 0, t = setInterval(function () {
    n++;
    if (ventana()[1] >= 440 || n >= 7) { clearInterval(t); layout(); cb(); }
  }, 120);
}

function fallo(e) {
  try { console.error(e); } catch (_) {}
  carga.style.display = 'flex';
  carga.innerHTML = '<div><b>No pude dibujar el mapa aquí.</b><br><br>Pídelo en imágenes con<br><b>' + esc(D.pre) + 'mapa 1</b> · <b>' + esc(D.pre) + 'mapa 2</b><br><b>' + esc(D.pre) + 'mapa 3</b> · <b>' + esc(D.pre) + 'mapa 4</b></div>';
}
function toast(t) { aviso.textContent = t; aviso.style.opacity = 1; clearTimeout(tAviso); tAviso = setTimeout(function () { aviso.style.opacity = 0; }, 3200); }

function armar() {
  var items = D.e.map(function (r) { var c = CATS[r.c]; return { id: r.i, num: r.u, cat: r.c, colorCat: c.color, nombreCat: c.nombre }; });
  mundo = M.crearMundo(items, { crearLienzo: function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; } }, { S: 6 });
  estados = D.e.map(function (r) {
    var c = CATS[r.c], e = { id: r.i, cat: r.c, nombre: r.n, color: c.color, gris: r.s !== 'm' && r.s !== 'p', nivel: r.v || 0, maxNivel: r.m, exclusiva: !!r.x, pareja: r.s === 'p' };
    porId[r.i] = { r: r, e: e };
    return e;
  });
  mundo.lotes.forEach(function (l, k) {
    var o = porId[l.id], p = E.preparar(o.e), h = E.altura(p.tipo, p.o);
    cajas.push({ l: l, k: k, x0: l.x - 88, x1: l.x + 88, y0: l.y - h - 60, y1: l.y + 36 });
    if (!o.e.gris) mios.push(l);
  });
}
function calcularNiveles() {
  var fit = Math.max(0.04, Math.min(vista.clientWidth / M.ANCHO, vista.clientHeight / M.ALTO));
  niveles = [fit].concat([0.2, 0.3, 0.45, 0.65, 0.85].filter(function (v) { return v > fit * 1.15; }));
  idx = niveles.length - 1; for (var i = 0; i < niveles.length; i++) if (Math.abs(niveles[i] - 0.65) < Math.abs(niveles[idx] - 0.65)) idx = i;
  z = niveles[idx];
}
function pintar() {
  // más nítido en pantallas de alta densidad, pero sin pasar de ~6.5 millones de pixeles para no gastar la memoria del celular
  var k = Math.max(1, Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(6500000 / (M.ANCHO * M.ALTO * z * z))));
  var w = Math.round(M.ANCHO * z), h = Math.round(M.ALTO * z);
  cv.width = Math.round(w * k); cv.height = Math.round(h * k); cv.style.width = w + 'px'; cv.style.height = h + 'px';
  M.pintar(cv.getContext('2d'), mundo, estados, { escala: z * k });
}
function irA(wx, wy, suave) {
  var x = Math.max(0, wx * z - vista.clientWidth / 2), y = Math.max(0, wy * z - vista.clientHeight / 2);
  if (suave) { try { vista.scrollTo({ left: x, top: y, behavior: 'smooth' }); return; } catch (_) {} }
  vista.scrollLeft = x; vista.scrollTop = y;
}
function botonesZoom() { $('menos').disabled = idx <= 0; $('mas').disabled = idx >= niveles.length - 1; $('pct').textContent = Math.round(z * 100) + '%'; }
function zoom(i) {
  i = Math.max(0, Math.min(niveles.length - 1, i));
  if (ocupado || i === idx) return;
  var cx = (vista.scrollLeft + vista.clientWidth / 2) / z, cy = (vista.scrollTop + vista.clientHeight / 2) / z;
  ocupado = true; carga.style.display = 'flex'; carga.textContent = 'Dibujando…';
  setTimeout(function () {
    try { idx = i; z = niveles[i]; pintar(); irA(cx, cy); } catch (e) { return fallo(e); }
    ocupado = false; carga.style.display = 'none'; botonesZoom();
  }, 40);
}

// ---- tocar un comercio: se ve en grande ----
function abrir(k) {
  var n = mundo.lotes.length; k = (k + n) % n; actual = k;
  var l = mundo.lotes[k], o = porId[l.id], r = o.r, e = o.e, c = CATS[r.c], g = $('grande'), x = g.getContext('2d'), W = 320, H = 270;
  x.setTransform(2, 0, 0, 2, 0, 0);
  var f = x.createLinearGradient(0, 0, 0, H);
  if (e.gris) { f.addColorStop(0, '#e4e8eb'); f.addColorStop(1, '#c9ced2'); } else { f.addColorStop(0, '#bfe6f7'); f.addColorStop(0.62, '#e9f6dc'); f.addColorStop(1, '#a9d98a'); }
  x.fillStyle = f; x.fillRect(0, 0, W, H);
  var p = E.preparar(e), h = E.altura(p.tipo, p.o), s = Math.min(1.8, 205 / Math.max(60, h)), suelo = H - 46;
  x.beginPath(); x.ellipse(W / 2, suelo - 4, 128, 36, 0, 0, Math.PI * 2); x.fillStyle = e.gris ? '#b9bec2' : '#e9dcb8'; x.fill(); x.lineWidth = 3; x.strokeStyle = e.gris ? '#9ea3a7' : '#bba97d'; x.stroke();
  E.dibujar(x, e, W / 2, suelo, s);
  E.medallon(e.gris ? E.ctxGris(x) : x, E.ICONO[e.id] || 'estrella', 42, 44, 28, e.color, e.exclusiva);
  var est = { m: ['✅ Es tuyo', 'ok'], p: ['💞 De tu pareja', 'ok'], l: ['🔒 Aún no lo tienes', 'no'], o: ['👑 Exclusiva con dueño', 'no'], s: ['🔨 En subasta ahora', 'no'] }[r.s] || ['', 'no'];
  var tiene = r.s === 'm' || r.s === 'p', li = [];
  li.push('<span class="tag ' + est[1] + '">' + est[0] + '</span><span class="tag" style="border-color:' + esc(c.color) + ';color:' + esc(c.color) + '">' + esc(c.nombre) + '</span>');
  if (tiene) {
    li.push('Nivel <b>' + (r.v + 1) + '</b> de ' + (r.m + 1) + ' · 💵 <b>' + dinero(r.h) + '</b> por hora' + (r.b ? ' · 💞 bono x1.5' : ''));
    if (r.g) li.push('⬆️ Siguiente: <b>' + esc(r.g) + '</b> por ' + dinero(r.k) + (r.s === 'm' ? '<br><small>' + esc(D.pre) + 'negocio mejorar ' + r.u + '</small>' : ''));
    else li.push('🏆 Ya está al máximo');
  } else {
    li.push('🏷️ Precio: <b>' + dinero(r.p) + '</b> · 💵 ' + dinero(r.h) + ' por hora al empezar');
    li.push(r.x ? '<small>Las exclusivas se consiguen en subasta (' + esc(D.pre) + 'subasta)</small>' : '<small>Cómpralo con ' + esc(D.pre) + 'negocio comprar ' + r.u + '</small>');
  }
  $('tit').textContent = r.n; $('info').innerHTML = li.join('<br>');
  $('mod').style.display = 'flex';
}
function cerrar() { $('mod').style.display = 'none'; }
cv.addEventListener('click', function (ev) {
  var x, y, mejor = null;
  if (ev.target === cv && typeof ev.offsetX === 'number') { x = ev.offsetX / z; y = ev.offsetY / z; } else { var r = cv.getBoundingClientRect(); x = (ev.clientX - r.left) / z; y = (ev.clientY - r.top) / z; }
  cajas.forEach(function (c) { if (x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1 && (!mejor || c.l.y > mejor.l.y)) mejor = c; });
  if (mejor) abrir(mejor.k);
});

// ---- zonas rápidas ----
function chips() {
  var h = '<button class="chip" data-c="*">⭐ Míos</button>';
  D.c.forEach(function (c) { h += '<button class="chip" data-c="' + esc(c.id) + '" style="border-color:' + esc(c.color) + '">' + esc(c.nombre) + '</button>'; });
  $('chips').innerHTML = h;
  $('chips').addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('.chip') : null; if (!b || ocupado) return;
    var c = b.getAttribute('data-c'), l;
    if (c === '*') { if (!mios.length) return toast('Aún no tienes propiedades: todo está en gris'); l = mios[turno++ % mios.length]; toast('Tuyo ' + ((turno - 1) % mios.length + 1) + ' de ' + mios.length); }
    else { for (var i = 0; i < mundo.lotes.length; i++) if (mundo.lotes[i].cat === c) { l = mundo.lotes[i]; break; } }
    if (l) irA(l.x, l.y - 90, true);
  });
}

// ---- pellizcar para acercar o alejar (si el celular lo deja) ----
var d0 = 0, d1 = 0, dist = function (e) { var a = e.touches[0], b = e.touches[1]; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); };
vista.addEventListener('touchstart', function (e) { if (e.touches.length === 2) { d0 = d1 = dist(e); } }, { passive: true });
vista.addEventListener('touchmove', function (e) { if (d0 && e.touches.length === 2) d1 = dist(e); }, { passive: true });
vista.addEventListener('touchend', function (e) { if (d0 && e.touches.length < 2) { var q = d1 / d0; d0 = 0; if (q > 1.25) zoom(idx + 1); else if (q < 0.8) zoom(idx - 1); } }, { passive: true });

$('mas').onclick = function () { zoom(idx + 1); };
$('menos').onclick = function () { zoom(idx - 1); };
$('todo').onclick = function () { zoom(0); };
$('cerrar').onclick = cerrar;
$('full').onclick = function () { // pantalla completa (si este WhatsApp lo permite)
  var d = document, el = d.documentElement, no = function () { toast('Este WhatsApp no deja pantalla completa. Usa ' + D.pre + 'mapa 1 al ' + D.pre + 'mapa 4 para verlo en imágenes'); };
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
    var f = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!f) return no();
    var lock = function () { try { screen.orientation.lock('landscape').catch(function () {}); } catch (_) {} };
    var p = f.call(el);
    if (p && p.then) p.then(lock, no); else lock();
  } catch (e) { no(); }
};
$('giro').onclick = function () { giro = !giro; var cx = (vista.scrollLeft + vista.clientWidth / 2) / z, cy = (vista.scrollTop + vista.clientHeight / 2) / z; recalcular(); irA(cx, cy); };
window.addEventListener('resize', function () { if (!ocupado && mundo) { var cx = (vista.scrollLeft + vista.clientWidth / 2) / z, cy = (vista.scrollTop + vista.clientHeight / 2) / z; recalcular(); irA(cx, cy); } });
$('ant').onclick = function () { abrir(actual - 1); };
$('sig').onclick = function () { abrir(actual + 1); };
$('ver').onclick = function () { var l = mundo.lotes[actual]; cerrar(); if (l) irA(l.x, l.y - 90, true); };
$('mod').addEventListener('click', function (e) { if (e.target === $('mod')) cerrar(); });

setTimeout(function () {
  arrancar(function () {
    try {
      armar(); calcularNiveles(); chips(); pintar(); botonesZoom();
      var l = mios[0] || mundo.lotes[0]; irA(l.x, l.y - 60);
      carga.style.display = 'none';
      toast('Gris = aún no lo tienes · Toca un comercio para verlo en grande');
    } catch (e) { fallo(e); }
  });
}, 80);
})();

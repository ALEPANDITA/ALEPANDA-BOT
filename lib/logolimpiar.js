// lib/logolimpiar.js
// Recorta cada personaje de una hoja (cuadricula) SIN que se cuelen pedazos de los vecinos.
// Problema que arregla: los dibujos de la hoja no caben exactos en su celda (uno llega mas alla de su cuadro y
// otro empieza antes), asi que cortar la hoja en partes iguales deja trozos del personaje de al lado y le corta
// el borde al propio. Aqui se detecta cada personaje por separado (por sus pixeles, no por la cuadricula),
// se borra todo lo que sea de otro y se amplia el recorte si el personaje se sale de su celda.
// Si la hoja no se puede analizar (no salen tantos personajes como celdas), se usa el recorte simple de siempre.
const analisis = new WeakMap(); // imagen -> resultado (la imagen ya esta en cache, asi que se analiza una sola vez)

const UMBRAL_TINTA = 246; // un pixel con algun canal menor a esto NO es fondo blanco
const UMBRAL_HALO = 252;  // entre este y el de arriba hay un halo muy tenue que tambien se asigna al personaje mas cercano
const MARGEN = 6;        // px extra alrededor del personaje cuando hay que ampliar el recorte

// Devuelve { duenos: Int8Array (personaje de cada pixel, -1 = fondo), cajas: [{x0,y0,x1,y1}] } o null
function analizarHoja(createCanvas, img, cols, filas) {
  const w = img.width, h = img.height, n = cols * filas, total = w * h;
  if (n < 2) return null;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, w, h).data;

  const tinta = new Uint8Array(total);
  for (let p = 0; p < total; p++) {
    const o = p * 4;
    if (Math.min(d[o], d[o + 1], d[o + 2]) < UMBRAL_TINTA && d[o + 3] > 10) tinta[p] = 1;
  }

  // 1) componentes conectados (8 vecinos): cada personaje es uno grande, los detalles sueltos (estrellas, corazones) son chicos
  const etiq = new Int32Array(total);
  const tam = [0], sx = [0], sy = [0];
  const pila = new Int32Array(total);
  let ncomp = 0;
  for (let s = 0; s < total; s++) {
    if (!tinta[s] || etiq[s]) continue;
    ncomp++;
    let t = 0, ax = 0, ay = 0, tope = 0;
    pila[tope++] = s; etiq[s] = ncomp;
    while (tope) {
      const p = pila[--tope];
      const x = p % w, y = (p - x) / w;
      t++; ax += x; ay += y;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= w) continue;
          const q = yy * w + xx;
          if (tinta[q] && !etiq[q]) { etiq[q] = ncomp; pila[tope++] = q; }
        }
      }
    }
    tam.push(t); sx.push(ax / t); sy.push(ay / t);
  }
  if (ncomp < n) return null;

  // 2) los n componentes mas grandes son los personajes; cada uno se asigna a su celda por donde esta su centro
  const orden = [];
  for (let k = 1; k <= ncomp; k++) orden.push(k);
  orden.sort((a, b) => tam[b] - tam[a]);
  const grandes = orden.slice(0, n);
  if (tam[grandes[n - 1]] < total * 0.008) return null; // el mas chico es demasiado pequeño: no parece un personaje
  const celdaDe = new Int32Array(ncomp + 1).fill(-1); // componente -> indice de personaje (fila * cols + col)
  const usados = new Set();
  for (const k of grandes) {
    const col = Math.min(cols - 1, Math.floor(sx[k] / (w / cols)));
    const fila = Math.min(filas - 1, Math.floor(sy[k] / (h / filas)));
    const idx = fila * cols + col;
    if (usados.has(idx)) return null; // dos personajes en la misma celda: la hoja no es una cuadricula normal
    usados.add(idx);
    celdaDe[k] = idx;
  }

  // 3) cada pixel recibe el personaje mas cercano (BFS desde todos los personajes a la vez)
  const cercano = new Int8Array(total).fill(-1);
  const cola = new Int32Array(total);
  let ini = 0, fin = 0;
  for (let p = 0; p < total; p++) {
    const k = etiq[p];
    if (k && celdaDe[k] >= 0) { cercano[p] = celdaDe[k]; cola[fin++] = p; }
  }
  while (ini < fin) {
    const p = cola[ini++];
    const x = p % w, y = (p - x) / w;
    const v = cercano[p];
    if (x > 0 && cercano[p - 1] < 0) { cercano[p - 1] = v; cola[fin++] = p - 1; }
    if (x < w - 1 && cercano[p + 1] < 0) { cercano[p + 1] = v; cola[fin++] = p + 1; }
    if (y > 0 && cercano[p - w] < 0) { cercano[p - w] = v; cola[fin++] = p - w; }
    if (y < h - 1 && cercano[p + w] < 0) { cercano[p + w] = v; cola[fin++] = p + w; }
  }

  // 4) cada detalle suelto se queda con el personaje que mas pixeles suyos tiene cerca (se asigna entero, sin partirlo)
  const votos = new Int32Array((ncomp + 1) * n);
  for (let p = 0; p < total; p++) { const k = etiq[p]; if (k && celdaDe[k] < 0) votos[k * n + cercano[p]]++; }
  for (let k = 1; k <= ncomp; k++) {
    if (celdaDe[k] >= 0) continue;
    let mejor = 0;
    for (let j = 1; j < n; j++) if (votos[k * n + j] > votos[k * n + mejor]) mejor = j;
    celdaDe[k] = mejor;
  }

  // 5) resultado: dueño de cada pixel con tinta y caja de cada personaje
  const duenos = new Int8Array(total).fill(-1);
  const cajas = Array.from({ length: n }, () => ({ x0: w, y0: h, x1: 0, y1: 0 }));
  for (let p = 0; p < total; p++) {
    const k = etiq[p];
    if (!k) { // halo casi blanco de un personaje (no es "tinta" pero si se ve en zoom): es del personaje mas cercano
      const o = p * 4;
      if (Math.min(d[o], d[o + 1], d[o + 2]) < UMBRAL_HALO) duenos[p] = cercano[p];
      continue;
    }
    const j = celdaDe[k];
    duenos[p] = j;
    const x = p % w, y = (p - x) / w, b = cajas[j];
    if (x < b.x0) b.x0 = x; if (x + 1 > b.x1) b.x1 = x + 1;
    if (y < b.y0) b.y0 = y; if (y + 1 > b.y1) b.y1 = y + 1;
  }
  return { duenos, cajas, w, h };
}

// Lienzo (ya agrandado) con el personaje i de la hoja, limpio de vecinos, y su caja de texto ajustada.
// p.caja esta escrita para un personaje de 512 px de ancho (cfg.ref); el origen es la esquina de SU celda.
function prepararPersonaje({ createCanvas }, img, ruta, cfg, i, p, fondo) {
  const cols = cfg.cols || 1, filas = cfg.filas || 1;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  let limp = null;
  if (!p.archivo) {
    sw = img.width / cols; sh = img.height / filas;
    sx = (i % cols) * sw; sy = Math.floor(i / cols) * sh;
    if (!analisis.has(img)) {
      let r = null;
      try { r = analizarHoja(createCanvas, img, cols, filas); } catch (_) { r = null; }
      analisis.set(img, r);
    }
    limp = analisis.get(img);
  }

  // zona a copiar: la celda, ampliada si el personaje se sale de ella
  let x0 = Math.round(sx), y0 = Math.round(sy), x1 = Math.round(sx + sw), y1 = Math.round(sy + sh);
  if (limp) {
    const b = limp.cajas[i];
    x0 = Math.max(0, Math.min(x0, b.x0 - MARGEN)); y0 = Math.max(0, Math.min(y0, b.y0 - MARGEN));
    x1 = Math.min(img.width, Math.max(x1, b.x1 + MARGEN)); y1 = Math.min(img.height, Math.max(y1, b.y1 + MARGEN));
  }
  const cw = x1 - x0, ch = y1 - y0;

  // copia del recorte con lo de los vecinos pintado de blanco
  const origen = createCanvas(cw, ch);
  const octx = origen.getContext('2d');
  octx.fillStyle = '#ffffff';
  octx.fillRect(0, 0, cw, ch);
  octx.drawImage(img, x0, y0, cw, ch, 0, 0, cw, ch);
  if (limp) {
    const datos = octx.getImageData(0, 0, cw, ch);
    const px = datos.data;
    for (let y = 0; y < ch; y++) {
      const fila = (y0 + y) * limp.w + x0;
      for (let x = 0; x < cw; x++) {
        const j = limp.duenos[fila + x];
        if (j >= 0 && j !== i) { const o = (y * cw + x) * 4; px[o] = 255; px[o + 1] = 255; px[o + 2] = 255; }
      }
    }
    octx.putImageData(datos, 0, 0);
  }

  const escala = Math.min(3, Math.max(2, Math.ceil(1000 / sw)));
  const lienzo = createCanvas(Math.round(cw * escala), Math.round(ch * escala));
  const ctx = lienzo.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = fondo || '#ffffff';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(origen, 0, 0, cw, ch, 0, 0, lienzo.width, lienzo.height);

  // la caja esta escrita para un personaje de 512 px de ancho: se ajusta al tamaño real y al origen del recorte
  const k = (sw * escala) / (cfg.ref || 512);
  const dx = (sx - x0) * escala, dy = (sy - y0) * escala;
  const caja = { cx: p.caja.cx * k + dx, cy: p.caja.cy * k + dy, w: p.caja.w * k, h: p.caja.h * k };
  return { lienzo, caja };
}

module.exports = { prepararPersonaje, analizarHoja };

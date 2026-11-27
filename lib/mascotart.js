'use strict';
// lib/mascotart.js — dibuja las mascotas del bot (todo con formas, sin emojis).
const path = require('path');
const fs = require('fs');

const circ = (c, x, y, r, fill, stroke, lw) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.stroke(); } };
const elip = (c, x, y, rx, ry, fill, rot, stroke, lw) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.stroke(); } };
const poli = (c, pts, fill, stroke, lw) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.lineJoin = 'round'; c.stroke(); } };
const linea = (c, pts, color, lw) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.strokeStyle = color; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); };
const curva = (c, x1, y1, cx, cy, x2, y2, color, lw) => { c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(cx, cy, x2, y2); c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round'; c.stroke(); };
const estrella = (c, x, y, r, color, p = 4) => { c.beginPath(); for (let i = 0; i < p * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / p; const rad = i % 2 ? r * 0.4 : r; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } c.closePath(); c.fillStyle = color; c.fill(); };
const corazon = (c, x, y, s, color) => { c.save(); c.translate(x, y); c.scale(s / 20, s / 20); c.beginPath(); c.moveTo(0, 7); c.bezierCurveTo(-14, -3, -8, -13, 0, -6); c.bezierCurveTo(8, -13, 14, -3, 0, 7); c.closePath(); c.fillStyle = color; c.fill(); c.restore(); };
const OSC = 'rgba(30,20,30,0.85)';

function ojos(c, x, y, sep, r = 5.2, color = '#1d1620') {
  for (const s of [-1, 1]) { circ(c, x + s * sep, y, r, color); circ(c, x + s * sep - 1.6, y - 1.8, r * 0.38, '#fff'); }
}
function mejillas(c, x, y, sep, color = 'rgba(255,120,150,0.55)') { for (const s of [-1, 1]) elip(c, x + s * sep, y, 6, 3.6, color); }
function boca(c, x, y, ancho = 5) { curva(c, x - ancho, y, x - ancho / 2, y + 4.5, x, y, OSC, 1.8); curva(c, x, y, x + ancho / 2, y + 4.5, x + ancho, y, OSC, 1.8); }
function patas(c, y, sep, color, rx = 9, ry = 6) { for (const s of [-1, 1]) elip(c, s * sep, y, rx, ry, color); }

function mamifero(c, o) {
  const { c: pelo, c2: osc, v: claro } = o;
  if (typeof o.cola === 'function') o.cola(c);
  else if (o.cola === 'peluda') { elip(c, 34, 30, 14, 30, pelo, 0.7); elip(c, 44, 8, 8, 12, o.puntaCola || claro, 0.7); }
  else if (o.cola === 'fina') { curva(c, 24, 36, 52, 34, 48, 10, pelo, 7); }
  else if (o.cola === 'pompon') circ(c, 28, 40, 7, claro);
  else if (o.cola === 'rayas') { curva(c, 24, 38, 56, 36, 50, 8, pelo, 9); for (const [x, y] of [[44, 32], [52, 22], [51, 12]]) linea(c, [[x - 5, y], [x + 5, y - 3]], osc, 3); }
  const oreja = o.orejas;
  if (oreja === 'gato' || oreja === 'zorro' || oreja === 'lobo') {
    const h = oreja === 'gato' ? 26 : 34;
    for (const s of [-1, 1]) { poli(c, [[s * 12, -40], [s * 40, -44 - (h - 26)], [s * 38, -12]], pelo, osc, 2); poli(c, [[s * 18, -36], [s * 34, -38 - (h - 26) * 0.7], [s * 33, -18]], oreja === 'zorro' ? '#2a1a1a' : '#ffb0c4'); }
  } else if (oreja === 'conejo') {
    for (const s of [-1, 1]) { elip(c, s * 17, -66, 11, 32, pelo, s * 0.12, osc, 2); elip(c, s * 17, -64, 5.5, 22, '#ffb0c4', s * 0.12); }
  } else if (oreja === 'perro') {
    for (const s of [-1, 1]) elip(c, s * 38, -14, 12, 26, osc, s * 0.25, 'rgba(0,0,0,0.25)', 2);
  } else if (oreja === 'redonda') {
    for (const s of [-1, 1]) { const R = o.orejaR || 13; circ(c, s * (o.orejaX || 30), -42, R, o.orejaColor || pelo, osc, 2); circ(c, s * (o.orejaX || 30), -42, R / 2, o.orejaIn || '#ffb0c4'); }
  }
  elip(c, 0, 30, 30, 27, pelo, 0, osc, 2);
  elip(c, 0, 34, 18, 18, claro);
  patas(c, 52, 17, o.patas || pelo);
  if (o.patas) for (const s of [-1, 1]) elip(c, s * 17, 52, 9, 6, o.patas, 0, 'rgba(0,0,0,0.25)', 1.5);
  if (o.brazos) for (const s of [-1, 1]) elip(c, s * 28, 28, 8, 17, o.brazos, s * 0.25);
  elip(c, 0, -14, 40, 34, pelo, 0, osc, 2.2);
  if (o.extra) o.extra(c);
  if (o.hocico !== false) elip(c, 0, -2, 20, 15, claro);
  ojos(c, 0, -14, 17);
  mejillas(c, 0, -3, 29);
  const nar = o.nariz || '#3a2a2a';
  if (oreja === 'conejo' || oreja === 'gato') poli(c, [[-4, -8], [4, -8], [0, -3]], '#ff8aa8');
  else elip(c, 0, -7, 5.5, 4, nar);
  boca(c, 0, -2, 5);
  if (oreja === 'gato') for (const s of [-1, 1]) for (const dy of [-1, 2]) linea(c, [[s * 20, -4 + dy], [s * 40, -8 + dy * 3]], 'rgba(255,255,255,0.8)', 1.5);
  if (o.lengua) elip(c, 0, 4, 4, 5, '#ff7f9c');
  if (o.frente) o.frente(c);
}

function ave(c, o) {
  if (o.cola) o.cola(c);
  elip(c, 0, 22, 34, 32, o.c, 0, o.c2, 2.2);
  elip(c, 0, 30, 22, 22, o.v);
  elip(c, -28, 24, 12, 20, o.c2, 0.5); elip(c, 28, 24, 12, 20, o.c2, -0.5);
  for (const s of [-1, 1]) { linea(c, [[s * 12, 50], [s * 12, 58]], '#f5a02a', 3); linea(c, [[s * 12 - 5, 59], [s * 12 + 5, 59]], '#f5a02a', 3); }
  if (o.cresta) o.cresta(c);
  ojos(c, 0, 4, 16, 5);
  mejillas(c, 0, 14, 25);
  if (o.pico) o.pico(c); else poli(c, [[-6, 12], [6, 12], [0, 22]], '#ff9f1c', 'rgba(0,0,0,0.2)', 1.2);
}

const ESPECIES = {
  pollito: { esc: 1.25, dy: -16, nombre: 'Pollito', precio: 2000, tonos: [{ c: '#ffe14d', c2: '#e8b800', v: '#fff3a6' }, { c: '#ffd1e0', c2: '#f29bb8', v: '#fff0f5' }, { c: '#bfe9ff', c2: '#7cc4ee', v: '#eaf8ff' }],
    dibujar: (c, t) => ave(c, { ...t, cresta: (k) => { for (const x of [-5, 0, 5]) curva(k, x, -10, x * 1.4, -22, x * 2, -14, t.c2, 3); } }) },
  pez: { esc: 1.2, dy: 8, nombre: 'Pez', precio: 3000, tonos: [{ c: '#ff9a3c', c2: '#d9661a', v: '#ffd9a8' }, { c: '#46b6ff', c2: '#2a7fc8', v: '#bfe6ff' }, { c: '#ff6fa8', c2: '#c93d7a', v: '#ffc2dc' }],
    dibujar: (c, t) => {
      poli(c, [[28, 0], [58, -26], [54, 0], [58, 26]], t.c2, 'rgba(0,0,0,0.2)', 1.5);
      poli(c, [[-6, -28], [10, -46], [24, -22]], t.c2); poli(c, [[0, 26], [16, 44], [26, 22]], t.c2);
      elip(c, -2, 0, 42, 30, t.c, 0, t.c2, 2.2); elip(c, -4, 10, 30, 15, t.v);
      for (const x of [10, 20]) curva(c, x, -20, x + 6, 0, x, 20, t.c2, 3);
      circ(c, -22, -6, 8, '#fff'); circ(c, -20, -6, 5, '#1d1620'); circ(c, -21.5, -8, 1.8, '#fff');
      curva(c, -42, 8, -36, 13, -30, 9, OSC, 2);
      for (const [x, y, r] of [[-44, -30, 5], [-36, -44, 3.5], [-50, -48, 2.5]]) circ(c, x, y, r, 'rgba(255,255,255,0.25)', 'rgba(255,255,255,0.85)', 1.5);
    } },
  hamster: { nombre: 'Hámster', precio: 5000, tonos: [{ c: '#e9b36a', c2: '#b07a38', v: '#fff1d6' }, { c: '#f4f1ea', c2: '#bdb5a5', v: '#ffffff' }, { c: '#9b8f84', c2: '#6a5f56', v: '#efe7dc' }],
    dibujar: (c, t) => mamifero(c, { ...t, orejas: 'redonda', cola: 'pompon', hocico: true, extra: (k) => { elip(k, -14, -14 - 12, 9, 6, t.v); elip(k, 14, -26, 9, 6, t.v); } }) },
  conejo: { nombre: 'Conejo', precio: 8000, tonos: [{ c: '#f4f1ea', c2: '#bdb5a5', v: '#ffffff' }, { c: '#c9a37a', c2: '#8a6a45', v: '#f3e4cf' }, { c: '#cfd3dc', c2: '#8a90a0', v: '#f4f6fa' }],
    dibujar: (c, t) => mamifero(c, { ...t, orejas: 'conejo', cola: 'pompon' }) },
  tortuga: { nombre: 'Tortuga', precio: 12000, tonos: [{ c: '#7fcf6a', c2: '#3f9d4f', v: '#c9ef9f' }, { c: '#6bd6c1', c2: '#2f9d8a', v: '#c2f3e8' }, { c: '#c2d96a', c2: '#8aa23a', v: '#eaf5b5' }],
    dibujar: (c, t) => {
      for (const [x, y] of [[-30, 40], [30, 40]]) elip(c, x, y, 13, 10, t.c, 0, t.c2, 2);
      poli(c, [[40, 32], [60, 40], [40, 42]], t.c, t.c2, 2);
      elip(c, 0, 20, 44, 34, t.c2, 0, 'rgba(0,0,0,0.3)', 2.2);
      elip(c, 0, 18, 36, 27, '#a9764a'); elip(c, 0, 18, 36, 27, null, 0, '#6d4526', 2);
      poli(c, [[0, 2], [14, 10], [10, 26], [-10, 26], [-14, 10]], '#c99366', '#6d4526', 2);
      for (const [x1, y1, x2, y2] of [[0, 2, 0, -8], [14, 10, 28, 6], [10, 26, 22, 36], [-10, 26, -22, 36], [-14, 10, -28, 6]]) linea(c, [[x1, y1], [x2, y2]], '#6d4526', 2);
      elip(c, -34, -14, 22, 20, t.c, 0, t.c2, 2); ojos(c, -34, -16, 9, 4.4); mejillas(c, -34, -8, 14); boca(c, -34, -5, 4);
    } },
  gato: { nombre: 'Gato', precio: 15000, tonos: [{ c: '#f0a04b', c2: '#b8691a', v: '#ffe2bd' }, { c: '#4a4a55', c2: '#22222a', v: '#c9c9d4' }, { c: '#f4f1ea', c2: '#aaa59a', v: '#ffffff' }, { c: '#b9b4ad', c2: '#6f6a63', v: '#efe9df' }],
    dibujar: (c, t) => mamifero(c, { ...t, orejas: 'gato', cola: 'fina', extra: (k) => { for (const x of [-8, 0, 8]) linea(k, [[x, -46], [x * 0.7, -38]], t.c2, 3); } }) },
  perro: { nombre: 'Perro', precio: 20000, tonos: [{ c: '#d9a066', c2: '#8a5a2b', v: '#fbe6c6' }, { c: '#3a3a40', c2: '#1d1d22', v: '#d9d9df' }, { c: '#f4eadb', c2: '#a89a85', v: '#ffffff' }],
    dibujar: (c, t) => mamifero(c, { ...t, orejas: 'perro', cola: 'peluda', lengua: true, nariz: '#1d1620', extra: (k) => { elip(k, 18, -20, 12, 11, t.c2, 0.3); } }) },
  loro: { esc: 1.15, dy: -14, nombre: 'Loro', precio: 35000, tonos: [{ c: '#3fc46a', c2: '#1f8a45', v: '#a8f0c0' }, { c: '#ff5c5c', c2: '#c22b2b', v: '#ffb3a8' }, { c: '#4da3ff', c2: '#2465c0', v: '#bde0ff' }],
    dibujar: (c, t) => ave(c, { ...t, cola: (k) => { for (const [a, col] of [[-0.35, t.c2], [0, '#ffd23a'], [0.35, '#ff5c5c']]) { k.save(); k.translate(0, 44); k.rotate(a); elip(k, 0, 8, 6, 14, col); k.restore(); } },
      cresta: (k) => { for (const [x, y] of [[-6, -10], [2, -12], [10, -8]]) elip(k, x, y, 4.5, 9, '#ff5c5c', (x) * 0.05); },
      pico: (k) => { k.beginPath(); k.moveTo(-8, 10); k.quadraticCurveTo(0, 6, 8, 10); k.quadraticCurveTo(10, 24, 0, 28); k.quadraticCurveTo(-8, 22, -8, 10); k.closePath(); k.fillStyle = '#ffd23a'; k.fill(); k.strokeStyle = 'rgba(0,0,0,0.3)'; k.lineWidth = 1.5; k.stroke(); } }) },
  zorro: { nombre: 'Zorro', precio: 60000, tonos: [{ c: '#f47a2a', c2: '#a84a10', v: '#fff1e0' }, { c: '#e8e8f0', c2: '#8c8ca0', v: '#ffffff' }, { c: '#b9562a', c2: '#6d2e10', v: '#f7dcc4' }],
    dibujar: (c, t) => mamifero(c, { ...t, orejas: 'zorro', cola: 'peluda', puntaCola: '#fff', nariz: '#1d1620', hocico: false,
      extra: (k) => { poli(k, [[-38, -4], [0, -30], [38, -4], [20, 14], [-20, 14]], t.v); poli(k, [[-14, -34], [0, -42], [14, -34], [0, -26]], t.c2, null); } }) },
  panda: { nombre: 'Panda', precio: 120000, tonos: [{ c: '#f7f7f7', c2: '#1d1d22', v: '#ffffff' }],
    dibujar: (c, t) => mamifero(c, { c: '#f7f7f7', c2: '#2a2a30', v: '#ffffff', orejas: 'redonda', orejaColor: '#1d1d22', orejaIn: '#3a3a42', cola: 'pompon', patas: '#1d1d22', brazos: '#1d1d22', nariz: '#1d1d22',
      extra: (k) => { elip(k, -16, -14, 11, 14, '#1d1d22', 0.5); elip(k, 16, -14, 11, 14, '#1d1d22', -0.5); } }) },
  lobo: { nombre: 'Lobo', precio: 300000, tonos: [{ c: '#8d95a6', c2: '#4a5060', v: '#e6eaf2' }, { c: '#f1f3f8', c2: '#9aa2b5', v: '#ffffff' }, { c: '#4b4f5c', c2: '#22242c', v: '#b8bdcc' }],
    dibujar: (c, t) => mamifero(c, { ...t, orejas: 'lobo', cola: 'peluda', nariz: '#1d1620', extra: (k) => { poli(k, [[-30, -10], [0, -34], [30, -10], [16, 12], [-16, 12]], t.v); } }) },
  tigre: { nombre: 'Tigre', precio: 800000, tonos: [{ c: '#ff9a2e', c2: '#b8560a', v: '#fff1dc' }, { c: '#f4f1ea', c2: '#6f6a63', v: '#ffffff' }],
    dibujar: (c, t) => mamifero(c, { ...t, orejas: 'redonda', orejaIn: '#fff1dc', cola: 'rayas', nariz: '#ff7f9c',
      extra: (k) => { for (const s of [-1, 1]) { linea(k, [[s * 40, -24], [s * 28, -22]], '#1d1620', 4); linea(k, [[s * 38, -12], [s * 27, -13]], '#1d1620', 4); linea(k, [[s * 8, -46], [s * 10, -36]], '#1d1620', 4); } linea(k, [[0, -48], [0, -38]], '#1d1620', 4); } }) },
  unicornio: { nombre: 'Unicornio', precio: 3000000, tonos: [{ c: '#ffffff', c2: '#c9b8ff', v: '#ffe3f0' }, { c: '#ffd9ec', c2: '#ff9ac6', v: '#fff0f7' }],
    dibujar: (c, t) => {
      for (const [col, d] of [['#ff6f91', 0], ['#ffc84a', 8], ['#6fd6ff', 16], ['#b48cff', 24]]) curva(c, 24, 38, 56 + d * 0.3, 40, 44 + d * 0.3, 8 + d, col, 7);
      for (const s of [-1, 1]) poli(c, [[s * 12, -40], [s * 32, -52], [s * 36, -26]], t.c, t.c2, 2);
      elip(c, 0, 30, 30, 27, t.c, 0, t.c2, 2); patas(c, 52, 17, t.c);
      for (const [col, x, y] of [['#ff6f91', -34, -20], ['#ffc84a', -38, -4], ['#6fd6ff', -34, 12], ['#b48cff', -26, 24]]) elip(c, x, y, 10, 14, col, 0.2);
      elip(c, 0, -14, 40, 34, t.c, 0, t.c2, 2.2);
      for (const [col, x, y, r] of [['#ff6f91', -12, -46, 11], ['#ffc84a', 0, -50, 11], ['#6fd6ff', 12, -46, 11]]) circ(c, x, y, r, col);
      poli(c, [[-7, -44], [0, -86], [7, -44]], '#ffd23a', '#c99a00', 2); linea(c, [[-4, -56], [4, -60]], '#c99a00', 2); linea(c, [[-5, -68], [3, -72]], '#c99a00', 2);
      elip(c, 0, -2, 20, 15, t.v); ojos(c, 0, -14, 17, 5.6, '#5a2a8a'); mejillas(c, 0, -3, 29); circ(c, -6, -4, 1.8, 'rgba(120,60,100,0.7)'); circ(c, 6, -4, 1.8, 'rgba(120,60,100,0.7)'); boca(c, 0, 2, 5);
      estrella(c, -50, -50, 7, '#ffe27a'); estrella(c, 52, -30, 5, '#bfa6ff'); estrella(c, 46, 46, 4, '#ffd1e8');
    } },
  dragon: { nombre: 'Dragón', precio: 12000000, tonos: [{ c: '#4cc86a', c2: '#1f7a3c', v: '#d6f5a8' }, { c: '#7a6bff', c2: '#3a2fb0', v: '#d9d3ff' }, { c: '#ff6a4d', c2: '#a8321a', v: '#ffd9a0' }],
    dibujar: (c, t) => {
      curva(c, 22, 38, 60, 44, 52, 6, t.c, 9); poli(c, [[48, 8], [62, -2], [56, 16]], t.c2);
      for (const s of [-1, 1]) { c.save(); c.scale(s, 1); poli(c, [[22, 14], [56, -22], [50, 6], [64, 8], [44, 24]], t.c2, 'rgba(0,0,0,0.3)', 1.5); c.restore(); }
      for (let i = 0; i < 4; i++) poli(c, [[-5, -44 + i * 0], [5, -44], [0, -56]].map(([x, y]) => [x + (i - 1.5) * 12, y + Math.abs(i - 1.5) * 6]), t.c2);
      elip(c, 0, 30, 30, 27, t.c, 0, t.c2, 2); elip(c, 0, 34, 17, 19, t.v); for (const y of [26, 34, 42]) linea(c, [[-12, y], [12, y]], 'rgba(0,0,0,0.12)', 2);
      patas(c, 52, 17, t.c);
      for (const s of [-1, 1]) poli(c, [[s * 16, -38], [s * 30, -66], [s * 32, -34]], '#fff3d1', '#c9b27a', 2);
      elip(c, 0, -14, 40, 34, t.c, 0, t.c2, 2.2);
      elip(c, 0, 0, 24, 17, t.v);
      for (const s of [-1, 1]) { circ(c, s * 8, -4, 2.2, 'rgba(0,0,0,0.5)'); circ(c, s * 17, -14, 8, '#fff7c2'); circ(c, s * 17, -14, 4.6, '#1d1620'); circ(c, s * 17 - 1.4, -15.5, 1.6, '#fff'); }
      mejillas(c, 0, 0, 31, 'rgba(255,120,120,0.5)'); boca(c, 0, 6, 5);
      for (const x of [-8, 0, 8]) poli(c, [[x - 3, -48], [x + 3, -48], [x, -56]], t.c2);
      estrella(c, -52, -40, 5, '#ffe27a'); estrella(c, 54, -46, 4, '#ffe27a');
    } },
  fenix: { esc: 1.0, dy: -14, nombre: 'Fénix', precio: 40000000, tonos: [{ c: '#ff7a1a', c2: '#c22b0a', v: '#ffd23a' }, { c: '#4da3ff', c2: '#1f56c0', v: '#bff0ff' }],
    dibujar: (c, t) => {
      for (const [a, col, l] of [[-0.5, t.c2, 18], [-0.2, t.c, 24], [0.2, t.v, 24], [0.5, t.c, 18]]) { c.save(); c.translate(0, 40); c.rotate(a); c.beginPath(); c.moveTo(-7, 0); c.quadraticCurveTo(-12, l * 0.7, 0, l + 8); c.quadraticCurveTo(12, l * 0.7, 7, 0); c.closePath(); c.fillStyle = col; c.fill(); c.restore(); }
      for (const s of [-1, 1]) { c.save(); c.scale(s, 1); for (const [col, e] of [[t.c2, 0], [t.c, 7], [t.v, 14]]) { c.beginPath(); c.moveTo(24, 20); c.quadraticCurveTo(70 - e, -6, 56 - e, -40 + e); c.quadraticCurveTo(48 - e, -8, 38 - e, -12 + e); c.quadraticCurveTo(40 - e, 6, 24, 30); c.closePath(); c.fillStyle = col; c.fill(); } c.restore(); }
      elip(c, 0, 22, 30, 30, t.c, 0, t.c2, 2); elip(c, 0, 30, 18, 20, t.v);
      for (const [x, h] of [[-8, 26], [0, 34], [8, 26]]) { c.beginPath(); c.moveTo(x - 6, -8); c.quadraticCurveTo(x - 8, -h * 0.6, x, -h - 8); c.quadraticCurveTo(x + 8, -h * 0.6, x + 6, -8); c.closePath(); c.fillStyle = x ? t.c : t.v; c.fill(); }
      for (const s of [-1, 1]) { linea(c, [[s * 12, 50], [s * 12, 58]], '#c22b0a', 3); }
      ojos(c, 0, 4, 14, 5, '#3a0a00'); mejillas(c, 0, 14, 23, 'rgba(255,60,60,0.5)'); poli(c, [[-5, 12], [5, 12], [0, 21]], '#ffd23a', 'rgba(0,0,0,0.25)', 1.2);
      estrella(c, -54, -40, 6, '#ffe27a'); estrella(c, 56, -30, 5, '#ffd23a'); estrella(c, 40, 56, 4, '#ffb347');
    } }
,
  ardilla: { nombre: 'Ardilla', precio: 6000, tonos: [{ c: '#c8742e', c2: '#8a4a14', v: '#fbe3c0' }, { c: '#9a9aa6', c2: '#5a5a66', v: '#ececf2' }],
    dibujar: (c, t) => mamifero(c, { ...t, orejas: 'redonda', orejaR: 11, orejaX: 28, orejaIn: '#ffc9a8', nariz: '#3a2a2a',
      cola: (k) => { elip(k, 38, 4, 22, 44, t.c, 0.35, t.c2, 2); elip(k, 42, 2, 11, 33, t.v, 0.35); },
      frente: (k) => { k.fillStyle = '#fff'; k.fillRect(-3.5, 0.5, 3.2, 5.5); k.fillRect(0.3, 0.5, 3.2, 5.5); } }) },
  cerdito: { nombre: 'Cerdito', precio: 10000, tonos: [{ c: '#ffb3c7', c2: '#e57a9d', v: '#ffd9e4' }, { c: '#f4c9a8', c2: '#c98e5e', v: '#fbe6d2' }],
    dibujar: (c, t) => mamifero(c, { ...t, orejas: 'gato', hocico: false,
      cola: (k) => { k.beginPath(); k.arc(33, 38, 7, 0.3, Math.PI * 1.7); k.strokeStyle = t.c2; k.lineWidth = 3.5; k.lineCap = 'round'; k.stroke(); },
      frente: (k) => { elip(k, 0, -3, 14, 9.5, '#ff8fae', 0, t.c2, 1.8); circ(k, -5, -3, 2.6, '#a84a6a'); circ(k, 5, -3, 2.6, '#a84a6a'); } }) },
  mapache: { nombre: 'Mapache', precio: 25000, tonos: [{ c: '#8c8f99', c2: '#4a4d57', v: '#e9eaee' }],
    dibujar: (c, t) => mamifero(c, { ...t, orejas: 'redonda', orejaR: 11, orejaX: 30, orejaColor: '#6c6f7a', orejaIn: '#2f313a', cola: 'rayas', nariz: '#1d1620', hocico: true,
      extra: (k) => { elip(k, -17, -14, 14, 11, '#32343e', -0.25); elip(k, 17, -14, 14, 11, '#32343e', 0.25); elip(k, 0, -26, 9, 4, '#32343e'); },
      frente: (k) => { for (const s of [-1, 1]) { circ(k, s * 17, -14, 7.2, '#fff'); circ(k, s * 17, -14, 4.6, '#1d1620'); circ(k, s * 17 - 1.4, -15.6, 1.7, '#fff'); } } }) },
  pinguino: { esc: 1.2, dy: -12, nombre: 'Pingüino', precio: 45000, tonos: [{ c: '#2b3245', c2: '#1a1f2e', v: '#ffffff' }, { c: '#4a6fa5', c2: '#2a4570', v: '#f2f8ff' }],
    dibujar: (c, t) => ave(c, { ...t, cresta: (k) => { elip(k, 0, 9, 25, 20, '#ffffff'); } }) },
  koala: { nombre: 'Koala', precio: 90000, tonos: [{ c: '#9aa0ab', c2: '#5d6370', v: '#e8eaee' }, { c: '#b7a99b', c2: '#7a6a5a', v: '#efe6dc' }],
    dibujar: (c, t) => mamifero(c, { ...t, orejas: 'redonda', orejaR: 19, orejaX: 36, orejaIn: '#f6eef2', hocico: false,
      frente: (k) => { elip(k, 0, -7, 8.5, 11.5, '#2a2a30'); elip(k, -2.5, -12, 2.4, 3.4, 'rgba(255,255,255,0.35)'); boca(k, 0, 8, 4); } }) },
  buho: { esc: 1.2, dy: -12, nombre: 'Búho', precio: 150000, tonos: [{ c: '#a9794c', c2: '#6d4526', v: '#f0dcc0' }, { c: '#8d8fa0', c2: '#555768', v: '#ecebf2' }],
    dibujar: (c, t) => ave(c, { ...t, cresta: (k) => { for (const s of [-1, 1]) poli(k, [[s * 24, -4], [s * 16, -24], [s * 6, -8]], t.c2); elip(k, -13, 6, 14, 14, '#fff7e6', 0, t.c2, 1.5); elip(k, 13, 6, 14, 14, '#fff7e6', 0, t.c2, 1.5); } }) },
  oso: { nombre: 'Oso', precio: 200000, tonos: [{ c: '#9b6a3f', c2: '#5e3a1c', v: '#e0b98a' }, { c: '#f4f4f6', c2: '#aab2c0', v: '#ffffff' }],
    dibujar: (c, t) => mamifero(c, { ...t, orejas: 'redonda', orejaR: 14, orejaX: 31, orejaIn: '#e0b98a', cola: 'pompon', nariz: '#1d1620' }) }
};
const ORDEN = Object.keys(ESPECIES);

function tonoDe(esp, idx) { const e = ESPECIES[esp]; return e.tonos[(Number(idx) || 0) % e.tonos.length]; }

function dibujar(ctx, especie, x, y, tam, tono = 0) {
  const e = ESPECIES[especie]; if (!e) return;
  ctx.save();
  ctx.translate(x, y); ctx.scale(tam / 130, tam / 130);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  elip(ctx, 0, 60, 34, 7, 'rgba(0,0,0,0.28)');
  if (e.esc) { ctx.translate(0, e.dy || 0); ctx.scale(e.esc, e.esc); }
  e.dibujar(ctx, tonoDe(especie, tono));
  ctx.restore();
}

const CARPETA_FUENTES = path.join(__dirname, '..', 'assets', 'fonts');
const F = 'MascotaSans';
let L = null;
function canvasLib() {
  if (L) return L;
  L = require('@napi-rs/canvas');
  for (const a of ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf']) { try { const r = path.join(CARPETA_FUENTES, a); if (fs.existsSync(r)) L.GlobalFonts.registerFromPath(r, F); } catch (_) { /* fuente del sistema */ } }
  return L;
}
const limpiar = (t) => String(t || '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').trim();
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function fondo(c, W, H) {
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1d1238'); g.addColorStop(1, '#3a1f6b'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,0.05)'; for (let y = 16; y < H; y += 28) for (let x = 16 + ((y / 28) % 2) * 14; x < W; x += 28) { c.beginPath(); c.arc(x, y, 1.3, 0, 7); c.fill(); }
}
function recortar(c, t, max) { t = limpiar(t); if (c.measureText(t).width <= max) return t; while (t.length > 1 && c.measureText(t + '…').width > max) t = t.slice(0, -1); return t + '…'; }

function galeria(items, { titulo = 'MASCOTAS', cols = 4 } = {}) {
  const lib = canvasLib();
  const cw = 250; const ch = 270; const pad = 24; const cab = 78;
  const filas = Math.max(1, Math.ceil(items.length / cols)); const nc = Math.min(cols, Math.max(1, items.length));
  const W = pad * 2 + nc * cw + (nc - 1) * 14; const H = cab + filas * ch + (filas - 1) * 14 + pad;
  const cv = lib.createCanvas(W, H); const c = cv.getContext('2d');
  fondo(c, W, H);
  c.textAlign = 'left'; c.font = `bold 34px ${F}`; c.fillStyle = '#fff'; c.fillText(titulo, pad, 52);
  items.forEach((it, i) => {
    const x = pad + (i % cols) * (cw + 14); const y = cab + Math.floor(i / cols) * (ch + 14);
    rr(c, x, y, cw, ch, 22); c.fillStyle = 'rgba(255,255,255,0.09)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1.5; c.stroke();
    rr(c, x + 10, y + 10, 40, 30, 14); c.fillStyle = '#b48cff'; c.fill();
    c.font = `bold 18px ${F}`; c.fillStyle = '#1c0f38'; c.textAlign = 'center'; c.fillText(String(i + 1), x + 30, y + 31);
    dibujar(c, it.especie, x + cw / 2, y + 112, 150, it.tono);
    c.textAlign = 'center'; c.font = `bold 22px ${F}`; c.fillStyle = '#fff'; c.fillText(recortar(c, it.titulo, cw - 24), x + cw / 2, y + 205);
    c.font = `17px ${F}`; c.fillStyle = '#d9c9ff'; c.fillText(recortar(c, it.sub, cw - 24), x + cw / 2, y + 230);
    if (it.extra) { c.font = `bold 16px ${F}`; c.fillStyle = '#ffd25a'; c.fillText(recortar(c, it.extra, cw - 24), x + cw / 2, y + 252); }
    if (it.compartida) { corazon(c, x + cw - 24, y + 28, 24, '#ff6fa8'); }
  });
  return cv.toBuffer('image/png');
}

function tarjeta(d) {
  const lib = canvasLib(); const W = 640; const H = 700;
  const cv = lib.createCanvas(W, H); const c = cv.getContext('2d');
  fondo(c, W, H);
  rr(c, 20, 20, W - 40, H - 40, 30); c.strokeStyle = 'rgba(180,140,255,0.7)'; c.lineWidth = 2.5; c.stroke();
  const g = c.createRadialGradient(W / 2, 270, 20, W / 2, 270, 240); g.addColorStop(0, 'rgba(180,140,255,0.45)'); g.addColorStop(1, 'rgba(180,140,255,0)'); c.fillStyle = g; c.fillRect(0, 40, W, 460);
  dibujar(c, d.especie, W / 2, 270, 360, d.tono);
  c.textAlign = 'center'; c.font = `bold 44px ${F}`; c.fillStyle = '#fff'; c.fillText(recortar(c, d.nombre, W - 100), W / 2, 500);
  const esp = ESPECIES[d.especie];
  c.font = `22px ${F}`; c.fillStyle = '#d9c9ff'; c.fillText(`${esp.nombre}  ·  Nivel ${d.nivel}`, W / 2, 536);
  rr(c, 120, 556, W - 240, 18, 9); c.fillStyle = 'rgba(255,255,255,0.15)'; c.fill();
  const p = Math.max(0, Math.min(1, d.xpSiguiente ? d.xpActual / d.xpSiguiente : 1));
  if (p > 0) { rr(c, 120, 556, Math.max(18, (W - 240) * p), 18, 9); c.fillStyle = '#b48cff'; c.fill(); }
  c.font = `16px ${F}`; c.fillStyle = '#fff'; c.fillText(`XP ${d.xpActual} / ${d.xpSiguiente}`, W / 2, 590);
  c.font = `bold 20px ${F}`; c.fillStyle = '#ffd25a';
  const duenos = (d.duenos || []).map(limpiar).filter(Boolean);
  const quienes = duenos.length > 3 ? duenos.slice(0, 2).join(', ') + ' y ' + (duenos.length - 2) + ' más' : duenos.length === 3 ? duenos[0] + ', ' + duenos[1] + ' y ' + duenos[2] : duenos.join(' y ');
  c.fillText(recortar(c, (d.compartida ? 'Compartida entre ' : 'Dueño/a: ') + quienes, W - 80), W / 2, 628);
  c.font = `16px ${F}`; c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillText(d.puesta ? 'Se ve en tu perfil' : 'No se ve en tu perfil (usa poner)', W / 2, 660);
  if (d.compartida) corazon(c, W - 56, 56, 34, '#ff6fa8');
  return cv.toBuffer('image/png');
}

function dibujarLados(ctx, mascotas, { cx, cy, ar, pad, pw, reach, F: fuente, nombreFn }) {
  const lista = mascotas.slice(0, 12); const n = lista.length;
  const ladoLibre = pw / 2 - (ar + 8) * reach;
  const pintar = (m, x, y, tam, maxAncho) => {
    dibujar(ctx, m.especie, x, y, tam, m.tono);
    ctx.save(); ctx.textAlign = 'center'; ctx.font = `bold ${Math.max(11, Math.round(tam * 0.19))}px ${fuente}`;
    ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4;
    ctx.fillText(nombreFn(ctx, m.nombre, maxAncho), x, y + tam * 0.5 + Math.round(tam * 0.22));
    ctx.restore();
    if (m.compartida) corazon(ctx, x + tam * 0.36, y - tam * 0.42, Math.max(11, tam * 0.2), '#ff6fa8');
  };
  if (n <= 4) {
    const tam = Math.max(40, Math.min(ladoLibre * 0.92, ar * 0.95, 96));
    const xIzq = pad + 8 + (ladoLibre * 0.5); const xDer = cx + (ar + 8) * reach + ladoLibre * 0.5 - 8;
    const abajo = cy + ar * 0.45; const arriba = abajo - tam * 1.28;
    const pos = [[xDer, abajo], [xIzq, abajo], [xDer, arriba], [xIzq, arriba]];
    lista.forEach((m, i) => pintar(m, pos[i][0], pos[i][1], tam, tam * 1.4));
    return;
  }
  // de 5 a 12: dos columnas a cada lado, a lo alto de la foto
  const der = lista.filter((_, i) => i % 2 === 0); const izq = lista.filter((_, i) => i % 2 === 1);
  const cols = 2; const filas = Math.ceil(der.length / cols);
  const alto = 2 * (ar + 8) + 8; const top = cy - (ar + 8) - 4; const paso = alto / filas;
  const colW = (ladoLibre - 8) / cols;
  const tam = Math.max(34, Math.min(colW * 0.95, paso / 1.3, 80));
  const poner = (items, x0, espejo) => items.forEach((m, j) => {
    let col = j % cols; if (espejo) col = cols - 1 - col;
    const fila = Math.floor(j / cols);
    pintar(m, x0 + colW * (col + 0.5), top + paso * fila + (paso - 1.3 * tam) / 2 + tam * 0.5, tam, colW - 2);
  });
  poner(der, cx + (ar + 8) * reach, false);
  poner(izq, pad + 8, true);
}

const ALTO_FRANJA = 150;
const colsFranja = (n) => (n <= 8 ? 4 : 6);
function altoFranja(n) { return n <= 4 ? ALTO_FRANJA : 50 + Math.ceil(n / colsFranja(n)) * 112 + 10; }
function dibujarFranja(ctx, mascotas, { pad, y, pw, F: fuente, PAN, T, nombreFn }) {
  const lista = mascotas.slice(0, 12); const n = lista.length;
  rr(ctx, pad, y, pw, altoFranja(n), 24); ctx.fillStyle = PAN; ctx.fill();
  ctx.textAlign = 'left'; ctx.font = `bold 21px ${fuente}`; ctx.fillStyle = '#fff'; ctx.fillText('MASCOTAS', pad + 20, y + 34);
  const lx = pad + 20 + ctx.measureText('MASCOTAS').width + 12;
  const lin = ctx.createLinearGradient(lx, 0, pad + pw - 20, 0); lin.addColorStop(0, T.acento); lin.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lin; ctx.fillRect(lx, y + 26, pad + pw - 20 - lx, 3);
  const cols = colsFranja(n); const cw = (pw - 40) / cols; const tam = Math.min(76, cw * 0.82);
  lista.forEach((m, i) => {
    const fila = Math.floor(i / cols); const enFila = Math.min(cols, n - fila * cols);
    const x = pad + 20 + ((cols - enFila) * cw) / 2 + (i % cols) * cw + cw / 2;
    const base = n <= 4 ? y : y + 50 + fila * 112 - 24; const yy = base + 86;
    dibujar(ctx, m.especie, x, yy, tam, m.tono);
    ctx.textAlign = 'center'; ctx.font = `bold ${cols > 4 ? 14 : 15}px ${fuente}`; ctx.fillStyle = '#fff'; ctx.fillText(nombreFn(ctx, m.nombre, cw - 6), x, base + 136);
    if (m.compartida) corazon(ctx, x + tam * 0.4, yy - tam * 0.4, 16, '#ff6fa8');
  });
}

module.exports = { ESPECIES, ORDEN, dibujar, galeria, tarjeta, dibujarLados, dibujarFranja, ALTO_FRANJA, altoFranja, tonoDe };

// MASCOTAS-NUEVAS

// MASCOTAS-12

// MASCOTAS-LADOS

// MASCOTAS-DUENOS

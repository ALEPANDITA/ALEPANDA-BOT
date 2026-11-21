const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, error: cajaError, advertencia } = require('../../lib/estilo');
const { ease, lerp, enviarAnimacion } = require('../../lib/animar');

const MINIMO = 10;
const ROJOS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
// Orden real de los numeros en una ruleta europea
const ORDEN = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const COLORES = { rojo: 'rojo', red: 'rojo', roja: 'rojo', negro: 'negro', black: 'negro', negra: 'negro' };
const PARIDAD = { par: 'par', pares: 'par', impar: 'impar', impares: 'impar' };
const colorDe = (n) => (n === 0 ? 'verde' : ROJOS.has(n) ? 'rojo' : 'negro');
const PINTA = { rojo: '#c0392b', negro: '#1c1c1c', verde: '#1e8449' };

function crearDibujo(numero, etiquetaFinal) {
  const W = 520; const H = 600; const cx = W / 2; const cy = 290; const R = 230;
  const paso = (2 * Math.PI) / 37;
  const idx = ORDEN.indexOf(numero);
  const rotFinal = -Math.PI / 2 - idx * paso;
  const vueltasRueda = 2; const vueltasBola = 5;

  return (ctx, t, i, fin) => {
    // fondo de mesa
    const fondo = ctx.createLinearGradient(0, 0, 0, H);
    fondo.addColorStop(0, '#0b3d2e'); fondo.addColorStop(1, '#06241b');
    ctx.fillStyle = fondo; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#f5d76e'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('RULETA', cx, 38);

    const e = ease.quart(t);
    const rot = rotFinal - vueltasRueda * 2 * Math.PI * (1 - e);

    // aro exterior fijo (madera)
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    const madera = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R);
    madera.addColorStop(0, '#5d3a1a'); madera.addColorStop(1, '#2b1708');
    ctx.fillStyle = madera; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#d4af37'; ctx.stroke();
    // pista de la bola
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.97, 0, Math.PI * 2); ctx.arc(cx, cy, R * 0.82, 0, Math.PI * 2, true);
    ctx.fillStyle = '#3b2412'; ctx.fill();

    // casillas giratorias
    const r1 = R * 0.52; const r2 = R * 0.82;
    for (let k = 0; k < 37; k++) {
      const n = ORDEN[k];
      const a = rot + k * paso;
      ctx.beginPath(); ctx.arc(cx, cy, r2, a - paso / 2, a + paso / 2); ctx.arc(cx, cy, r1, a + paso / 2, a - paso / 2, true); ctx.closePath();
      ctx.fillStyle = PINTA[colorDe(n)]; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#d4af37'; ctx.stroke();
      ctx.save();
      ctx.translate(cx + Math.cos(a) * R * 0.72, cy + Math.sin(a) * R * 0.72);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.fillText(String(n), 0, 0);
      ctx.restore();
    }
    // centro dorado que gira
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.5, 0, Math.PI * 2);
    const centro = ctx.createRadialGradient(cx, cy, 5, cx, cy, R * 0.5);
    centro.addColorStop(0, '#f7e08a'); centro.addColorStop(1, '#a8801f');
    ctx.fillStyle = centro; ctx.fill();
    ctx.strokeStyle = '#6b4e10'; ctx.lineWidth = 3;
    for (let k = 0; k < 4; k++) {
      const a = rot * 1.5 + k * Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R * 0.46, cy + Math.sin(a) * R * 0.46); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.fillStyle = '#fff3b0'; ctx.fill();

    // bola
    let ang; let rad;
    if (t < 0.85) {
      const eb = ease.cubic(t / 0.85);
      ang = -Math.PI / 2 + vueltasBola * 2 * Math.PI * (1 - eb);
    } else {
      ang = rot + idx * paso;
    }
    const caida = Math.min(1, Math.max(0, (t - 0.6) / 0.3));
    rad = lerp(R * 0.9, R * 0.67, ease.cubic(caida)) + Math.sin(caida * Math.PI * 4) * (1 - caida) * 7;
    const bx = cx + Math.cos(ang) * rad; const by = cy + Math.sin(ang) * rad;
    ctx.beginPath(); ctx.arc(bx + 2, by + 3, 8, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
    const bolaG = ctx.createRadialGradient(bx - 3, by - 3, 1, bx, by, 9);
    bolaG.addColorStop(0, '#ffffff'); bolaG.addColorStop(1, '#bfc5cc');
    ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2); ctx.fillStyle = bolaG; ctx.fill();

    // marcador fijo arriba
    ctx.beginPath(); ctx.moveTo(cx - 12, cy - R - 8); ctx.lineTo(cx + 12, cy - R - 8); ctx.lineTo(cx, cy - R + 14); ctx.closePath();
    ctx.fillStyle = '#ff4757'; ctx.fill();

    // barra inferior
    ctx.textAlign = 'center';
    if (fin) {
      const c = colorDe(numero);
      ctx.beginPath(); ctx.arc(cx, 548, 30, 0, Math.PI * 2); ctx.fillStyle = PINTA[c]; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#f5d76e'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 30px sans-serif'; ctx.fillText(String(numero), cx, 549);
      ctx.fillStyle = '#f5d76e'; ctx.font = 'bold 20px sans-serif'; ctx.fillText(etiquetaFinal, cx + 130, 549);
    } else {
      ctx.fillStyle = '#cfd8dc'; ctx.font = 'bold 22px sans-serif';
      ctx.fillText('Girando' + '.'.repeat(1 + (Math.floor(i / 5) % 3)), cx, 548);
    }
  };
}

module.exports = {
  name: 'ruleta',
  aliases: ['rt', 'roulette', 'rtl'],
  category: 'casino',
  description: `Ruleta animada: rojo/negro, par/impar (1 a 1) o numero n17 (35 a 1). Ej: .ruleta 100 rojo. Minimo $${MINIMO}`,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/).slice(1).map((p) => p.toLowerCase());

    let apuesta = null; let tipo = null; let valor = null;
    for (const p of partes) {
      const num = p.match(/^(?:n|#|num)(\d{1,2})$/);
      if (COLORES[p]) { tipo = 'color'; valor = COLORES[p]; }
      else if (PARIDAD[p]) { tipo = 'paridad'; valor = PARIDAD[p]; }
      else if (num && Number(num[1]) <= 36) { tipo = 'numero'; valor = Number(num[1]); }
      else if (/^\d+$/.test(p) && apuesta === null) apuesta = parseInt(p, 10);
    }

    if (!tipo || !apuesta) {
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}ruleta <monto> <apuesta>\n• rojo / negro → paga 1 a 1\n• par / impar → paga 1 a 1\n• n17 (un numero 0-36) → paga 35 a 1\nEj: ${prefix}ruleta 100 rojo`, { titulo: 'RULETA', estilo: 'gamer' })
      }, { quoted: msg });
    }
    if (apuesta < MINIMO) {
      return sock.sendMessage(jid, { text: cajaError(`La apuesta minima es *$${MINIMO}*.`, { titulo: 'RULETA', estilo: 'gamer' }) }, { quoted: msg });
    }

    const db = leerDB();
    const usuario = getUsuario(db, remitente);
    if (usuario.saldo < apuesta) {
      return sock.sendMessage(jid, { text: cajaError(`No tienes suficiente saldo.\nTu saldo: *$${usuario.saldo}*`, { titulo: 'RULETA', estilo: 'gamer' }) }, { quoted: msg });
    }

    const numero = Math.floor(Math.random() * 37);
    const salio = colorDe(numero);
    const emoji = salio === 'verde' ? '🟢' : salio === 'rojo' ? '🔴' : '⚫';
    let gano = false; let pago = 1;
    if (tipo === 'color') gano = salio === valor;
    else if (tipo === 'paridad') gano = numero !== 0 && (numero % 2 === 0) === (valor === 'par');
    else { gano = numero === valor; pago = 35; }

    const cambio = gano ? apuesta * pago : -apuesta;
    usuario.saldo += cambio;
    guardarDB(db);

    const apostado = tipo === 'numero' ? `número ${valor}` : valor;
    const linea = `🎰 La ruleta cayó en ${emoji} *${numero}* (${salio}).\nApostaste a: *${apostado}*\n` +
      (gano ? `¡Ganaste *$${cambio}*!` : `Perdiste *$${apuesta}*.`) +
      `\nSaldo actual: *$${usuario.saldo}*`;
    const caption = gano ? exito(linea, { titulo: 'RULETA', estilo: 'gamer' }) : cajaError(linea, { titulo: 'RULETA', estilo: 'gamer' });

    await enviarAnimacion(sock, jid, msg, {
      ancho: 520, alto: 600, fps: 20, total: 80, retener: 18,
      dibujar: crearDibujo(numero, salio.toUpperCase())
    }, caption);
  }
};

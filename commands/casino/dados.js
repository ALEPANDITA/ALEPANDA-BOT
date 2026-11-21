const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, error: cajaError, advertencia } = require('../../lib/estilo');
const { ease, rr, enviarAnimacion } = require('../../lib/animar');

const MINIMO = 10;
const APUESTAS = {
  alto: { nombre: 'ALTO (8-12)', pago: 1, gana: (s) => s >= 8 },
  bajo: { nombre: 'BAJO (2-6)', pago: 1, gana: (s) => s <= 6 },
  siete: { nombre: 'SIETE', pago: 4, gana: (s) => s === 7 }
};
const ALIAS = { alta: 'alto', altos: 'alto', baja: 'bajo', bajos: 'bajo', '7': 'siete' };

const PIPS = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]
};

function dibujarDado(ctx, x, y, tam, giro, cara) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(giro);
  rr(ctx, -tam / 2, -tam / 2, tam, tam, tam * 0.18);
  const g = ctx.createLinearGradient(-tam / 2, -tam / 2, tam / 2, tam / 2);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d9d9d9');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#9e9e9e'; ctx.stroke();
  ctx.fillStyle = '#c62828';
  for (const [px, py] of PIPS[cara]) { ctx.beginPath(); ctx.arc(px * tam * 0.27, py * tam * 0.27, tam * 0.075, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function crearDibujo(d1, d2, gano, etiqueta) {
  const W = 640; const H = 380;
  return (ctx, t, i, fin) => {
    const fondo = ctx.createLinearGradient(0, 0, 0, H);
    fondo.addColorStop(0, '#0b3d2e'); fondo.addColorStop(1, '#06241b');
    ctx.fillStyle = fondo; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f5d76e'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('DADOS', W / 2, 34);

    const salto = Math.abs(Math.sin(t * Math.PI * 4)) * (1 - t) * 150;
    const giroBase = (1 - ease.cubic(t)) * Math.PI * 6;
    const rueda = t < 0.78; // mientras ruedan, la cara cambia
    const caras = [rueda ? 1 + ((i * 7 + 3) % 6) : d1, rueda ? 1 + ((i * 5 + 1) % 6) : d2];
    [[200, 1], [440, -1]].forEach(([x, dir], k) => {
      const y = 215 - salto * (k === 0 ? 1 : 0.85);
      // sombra en el piso
      ctx.beginPath(); ctx.ellipse(x, 300, 60 - salto * 0.18, 12 - salto * 0.03, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
      dibujarDado(ctx, x, y, 110, giroBase * dir, caras[k]);
    });

    ctx.textAlign = 'center';
    if (fin) {
      ctx.fillStyle = gano ? '#69f0ae' : '#ff8a80'; ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`${d1} + ${d2} = ${d1 + d2}   ${etiqueta}`, W / 2, 350);
    } else {
      ctx.fillStyle = '#cfd8dc'; ctx.font = 'bold 22px sans-serif';
      ctx.fillText('Lanzando' + '.'.repeat(1 + (Math.floor(i / 5) % 3)), W / 2, 350);
    }
  };
}

module.exports = {
  name: 'dados',
  aliases: ['dice', 'dado'],
  category: 'casino',
  description: `Dados animados: alto (8-12) o bajo (2-6) pagan 1 a 1, siete paga 4 a 1. Ej: .dados 100 alto. Minimo $${MINIMO}`,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/).slice(1).map((p) => p.toLowerCase());
    const eleccion = partes.map((p) => ALIAS[p] || p).find((p) => APUESTAS[p] && !/^\d+$/.test(p)) || null;
    const apuesta = partes.map((p) => (/^\d+$/.test(p) && !ALIAS[p] ? parseInt(p, 10) : NaN)).find((n) => n > 0);

    if (!eleccion || !apuesta) {
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}dados <monto> <alto/bajo/siete>\n• alto (suma 8-12) → paga 1 a 1\n• bajo (suma 2-6) → paga 1 a 1\n• siete (suma 7) → paga 4 a 1\nEj: ${prefix}dados 100 alto`, { titulo: 'DADOS', estilo: 'gamer' })
      }, { quoted: msg });
    }
    if (apuesta < MINIMO) return sock.sendMessage(jid, { text: cajaError(`La apuesta minima es *$${MINIMO}*.`, { titulo: 'DADOS', estilo: 'gamer' }) }, { quoted: msg });

    const db = leerDB();
    const usuario = getUsuario(db, remitente);
    if (usuario.saldo < apuesta) {
      return sock.sendMessage(jid, { text: cajaError(`No tienes suficiente saldo.\nTu saldo: *$${usuario.saldo}*`, { titulo: 'DADOS', estilo: 'gamer' }) }, { quoted: msg });
    }

    const d1 = 1 + Math.floor(Math.random() * 6); const d2 = 1 + Math.floor(Math.random() * 6);
    const suma = d1 + d2; const ap = APUESTAS[eleccion];
    const gano = ap.gana(suma);
    const cambio = gano ? apuesta * ap.pago : -apuesta;
    usuario.saldo += cambio;
    guardarDB(db);

    const linea = `🎲 Salieron *${d1}* y *${d2}* (suma *${suma}*).\nApostaste a: *${ap.nombre}*\n` +
      (gano ? `¡Ganaste *$${cambio}*!` : `Perdiste *$${apuesta}*.`) + `\nSaldo actual: *$${usuario.saldo}*`;
    const caption = gano ? exito(linea, { titulo: 'DADOS', estilo: 'gamer' }) : cajaError(linea, { titulo: 'DADOS', estilo: 'gamer' });

    await enviarAnimacion(sock, jid, msg, {
      ancho: 640, alto: 380, fps: 20, total: 64, retener: 18,
      dibujar: crearDibujo(d1, d2, gano, gano ? 'GANASTE' : 'PERDISTE')
    }, caption);
  }
};

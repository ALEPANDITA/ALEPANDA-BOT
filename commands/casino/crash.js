const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, error: cajaError, advertencia } = require('../../lib/estilo');
const { enviarAnimacion } = require('../../lib/animar');

const MINIMO = 10;
const MIN_MULT = 1.1;
const MAX_MULT = 50;

function crearDibujo(crash, objetivo, gano) {
  const W = 640; const H = 400; const X0 = 70; const X1 = 610; const Y0 = 70; const Y1 = 330;
  const lnCrash = Math.log(Math.max(crash, 1.0001));
  return (ctx, t, i, fin) => {
    const m = Math.exp(lnCrash * t);
    const fondo = ctx.createLinearGradient(0, 0, 0, H);
    fondo.addColorStop(0, '#0f172a'); fondo.addColorStop(1, '#020617');
    ctx.fillStyle = fondo; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f5d76e'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CRASH', W / 2, 28);

    // la escala vertical crece con el multiplicador para que la curva siempre llene la grafica
    const yMax = Math.log(Math.max(2, m * 1.25));
    const aY = (mult) => Y1 - (Y1 - Y0) * (Math.log(Math.max(mult, 1)) / yMax);
    ctx.strokeStyle = 'rgba(148,163,184,0.25)'; ctx.lineWidth = 1; ctx.fillStyle = '#94a3b8'; ctx.font = '14px sans-serif'; ctx.textAlign = 'right';
    for (const v of [1, 1.5, 2, 3, 5, 10, 20, 50]) {
      if (Math.log(v) > yMax) break;
      const y = aY(v);
      ctx.beginPath(); ctx.moveTo(X0, y); ctx.lineTo(X1, y); ctx.stroke();
      ctx.fillText(v + 'x', X0 - 8, y);
    }

    // linea del objetivo
    if (Math.log(objetivo) <= yMax) {
      ctx.setLineDash([8, 6]); ctx.strokeStyle = 'rgba(250,204,21,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X0, aY(objetivo)); ctx.lineTo(X1, aY(objetivo)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#facc15'; ctx.textAlign = 'left'; ctx.font = 'bold 14px sans-serif';
      ctx.fillText('objetivo ' + objetivo.toFixed(2) + 'x', X0 + 6, aY(objetivo) - 10);
    }

    // curva
    const pasos = 60;
    const cobrado = m >= objetivo;
    const quebrado = fin;
    ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = quebrado ? '#ef4444' : cobrado ? '#22c55e' : '#38bdf8';
    ctx.beginPath();
    let ux = X0; let uy = Y1;
    for (let k = 0; k <= pasos; k++) {
      const tt = (t * k) / pasos;
      const mm = Math.exp(lnCrash * tt);
      const x = X0 + (X1 - X0) * 0.9 * (tt / Math.max(t, 0.25));
      const y = aY(mm);
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      ux = x; uy = y;
    }
    ctx.stroke();
    ctx.beginPath(); ctx.arc(ux, uy, 8, 0, Math.PI * 2); ctx.fillStyle = quebrado ? '#ef4444' : '#fff'; ctx.fill();

    // multiplicador grande
    ctx.textAlign = 'center'; ctx.font = 'bold 54px sans-serif';
    ctx.fillStyle = quebrado ? '#ef4444' : cobrado ? '#22c55e' : '#e2e8f0';
    ctx.fillText(m.toFixed(2) + 'x', W / 2, 150);
    ctx.font = 'bold 22px sans-serif';
    if (quebrado) {
      ctx.fillStyle = '#ef4444'; ctx.fillText('¡CRASH!', W / 2, 372);
      ctx.fillStyle = gano ? '#22c55e' : '#fca5a5'; ctx.font = 'bold 18px sans-serif';
      ctx.fillText(gano ? 'Cobraste antes del crash' : 'Se rompió antes de tu objetivo', W / 2, 394);
    } else if (cobrado) {
      ctx.fillStyle = '#22c55e'; ctx.fillText('OBJETIVO ALCANZADO', W / 2, 372);
    } else {
      ctx.fillStyle = '#94a3b8'; ctx.fillText('Subiendo...', W / 2, 372);
    }
  };
}

module.exports = {
  name: 'crash',
  aliases: ['cohete', 'rocket'],
  category: 'casino',
  description: `Crash animado: eliges un multiplicador objetivo; si la curva llega a el antes de romperse, ganas. Ej: .crash 100 2.5. Minimo $${MINIMO}`,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/).slice(1);
    const apuesta = parseInt(partes[0], 10);
    const objetivo = partes[1] ? parseFloat(String(partes[1]).replace(/x$/i, '').replace(',', '.')) : 2;

    if (!apuesta || apuesta <= 0 || !Number.isFinite(objetivo) || objetivo < MIN_MULT || objetivo > MAX_MULT) {
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}crash <monto> <multiplicador>\nMultiplicador entre ${MIN_MULT}x y ${MAX_MULT}x (si no pones, usa 2x).\nEj: ${prefix}crash 100 2.5`, { titulo: 'CRASH', estilo: 'gamer' })
      }, { quoted: msg });
    }
    if (apuesta < MINIMO) return sock.sendMessage(jid, { text: cajaError(`La apuesta minima es *$${MINIMO}*.`, { titulo: 'CRASH', estilo: 'gamer' }) }, { quoted: msg });

    const db = leerDB();
    const usuario = getUsuario(db, remitente);
    if (usuario.saldo < apuesta) {
      return sock.sendMessage(jid, { text: cajaError(`No tienes suficiente saldo.\nTu saldo: *$${usuario.saldo}*`, { titulo: 'CRASH', estilo: 'gamer' }) }, { quoted: msg });
    }

    // Punto de quiebre con 3% de ventaja de la casa, entre 1.00x y 100x
    const obj = Math.round(objetivo * 100) / 100;
    const crash = Math.min(100, Math.max(1, Math.floor((0.97 / (1 - Math.random())) * 100) / 100));
    const gano = crash >= obj;
    const ganancia = gano ? Math.max(1, Math.floor(apuesta * (obj - 1))) : 0;
    usuario.saldo += gano ? ganancia : -apuesta;
    guardarDB(db);

    const linea = `🚀 Se rompió en *${crash.toFixed(2)}x*.\nTu objetivo: *${obj.toFixed(2)}x*\n` +
      (gano ? `¡Cobraste! Ganaste *$${ganancia}*.` : `Perdiste *$${apuesta}*.`) + `\nSaldo actual: *$${usuario.saldo}*`;
    const caption = gano ? exito(linea, { titulo: 'CRASH', estilo: 'gamer' }) : cajaError(linea, { titulo: 'CRASH', estilo: 'gamer' });

    // la animacion dura mas cuanto mas sube la curva
    const total = Math.round(Math.min(90, 40 + Math.log(Math.max(crash, 1.01)) * 18));
    await enviarAnimacion(sock, jid, msg, {
      ancho: 640, alto: 400, fps: 20, total, retener: 18,
      dibujar: crearDibujo(crash, obj, gano)
    }, caption);
  }
};

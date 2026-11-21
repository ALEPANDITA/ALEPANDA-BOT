const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, error: cajaError, advertencia } = require('../../lib/estilo');
const { ease, rr, enviarAnimacion } = require('../../lib/animar');

const EMOJIS = ['🍒', '🍋', '🍇', '💎', '⭐', '🔔'];
const TAU = Math.PI * 2;

// Iconos dibujados con formas (no dependen de fuentes de emojis del servidor)
const ICONOS = [
  (c, x, y, s) => { // cereza
    c.strokeStyle = '#2e7d32'; c.lineWidth = 5; c.beginPath();
    c.moveTo(x - s * 0.35, y + s * 0.2); c.quadraticCurveTo(x - s * 0.1, y - s * 0.8, x + s * 0.3, y - s * 0.85);
    c.moveTo(x + s * 0.4, y + s * 0.3); c.quadraticCurveTo(x + s * 0.4, y - s * 0.5, x + s * 0.3, y - s * 0.85); c.stroke();
    c.fillStyle = '#e53935';
    c.beginPath(); c.arc(x - s * 0.4, y + s * 0.35, s * 0.42, 0, TAU); c.fill();
    c.beginPath(); c.arc(x + s * 0.42, y + s * 0.4, s * 0.42, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(x - s * 0.52, y + s * 0.22, s * 0.1, 0, TAU); c.fill();
  },
  (c, x, y, s) => { // limon
    c.fillStyle = '#fdd835'; c.beginPath(); c.ellipse(x, y, s * 0.9, s * 0.62, -0.3, 0, TAU); c.fill();
    c.fillStyle = '#f9a825'; c.beginPath(); c.ellipse(x + s * 0.88, y - s * 0.28, s * 0.14, s * 0.1, -0.3, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(x - s * 0.25, y - s * 0.2, s * 0.35, s * 0.12, -0.3, 0, TAU); c.fill();
  },
  (c, x, y, s) => { // uva
    c.fillStyle = '#7b1fa2';
    const p = [[0, -0.55], [-0.35, -0.1], [0.35, -0.1], [-0.65, 0.35], [0, 0.35], [0.65, 0.35], [-0.3, 0.8], [0.3, 0.8]];
    for (const [dx, dy] of p) { c.beginPath(); c.arc(x + dx * s, y + dy * s, s * 0.32, 0, TAU); c.fill(); }
    c.strokeStyle = '#2e7d32'; c.lineWidth = 5; c.beginPath(); c.moveTo(x, y - s * 0.8); c.lineTo(x + s * 0.3, y - s * 1.05); c.stroke();
  },
  (c, x, y, s) => { // diamante
    c.fillStyle = '#26c6da'; c.beginPath();
    c.moveTo(x - s * 0.9, y - s * 0.3); c.lineTo(x - s * 0.5, y - s * 0.85); c.lineTo(x + s * 0.5, y - s * 0.85);
    c.lineTo(x + s * 0.9, y - s * 0.3); c.lineTo(x, y + s * 0.95); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 3; c.beginPath();
    c.moveTo(x - s * 0.9, y - s * 0.3); c.lineTo(x + s * 0.9, y - s * 0.3); c.moveTo(x - s * 0.5, y - s * 0.85); c.lineTo(x - s * 0.2, y - s * 0.3); c.lineTo(x, y + s * 0.95);
    c.moveTo(x + s * 0.5, y - s * 0.85); c.lineTo(x + s * 0.2, y - s * 0.3); c.lineTo(x, y + s * 0.95); c.stroke();
  },
  (c, x, y, s) => { // estrella
    c.fillStyle = '#ffca28'; c.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5; const r = k % 2 === 0 ? s : s * 0.42;
      if (k === 0) c.moveTo(x + r * Math.cos(a), y + r * Math.sin(a)); else c.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
    }
    c.closePath(); c.fill(); c.strokeStyle = '#ff8f00'; c.lineWidth = 3; c.stroke();
  },
  (c, x, y, s) => { // campana
    c.fillStyle = '#ffb300'; c.beginPath();
    c.moveTo(x - s * 0.85, y + s * 0.55); c.quadraticCurveTo(x - s * 0.8, y - s * 0.2, x - s * 0.5, y - s * 0.55);
    c.quadraticCurveTo(x, y - s * 1.05, x + s * 0.5, y - s * 0.55); c.quadraticCurveTo(x + s * 0.8, y - s * 0.2, x + s * 0.85, y + s * 0.55);
    c.closePath(); c.fill();
    c.fillStyle = '#ff8f00'; c.beginPath(); c.arc(x, y + s * 0.75, s * 0.22, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(x - s * 0.3, y - s * 0.15, s * 0.1, s * 0.3, 0.3, 0, TAU); c.fill();
  }
];

function crearDibujo(finales, gano, textoFinal) {
  const W = 640; const H = 420; const celda = 100; const ventY = 60; const ventH = 300;
  const xs = [50, 240, 430]; const ancho = 160;
  const paradas = [0.5, 0.75, 1];
  const recorrido = [22, 32, 42];
  // cada rodillo es una tira de simbolos; el simbolo final queda en la celda central al detenerse
  const tiras = finales.map((f, k) => {
    const largo = recorrido[k] + 8;
    const tira = Array.from({ length: largo }, () => Math.floor(Math.random() * ICONOS.length));
    tira[recorrido[k] + 3] = f;
    return tira;
  });

  return (ctx, t, i, fin) => {
    const fondo = ctx.createLinearGradient(0, 0, 0, H);
    fondo.addColorStop(0, '#2a0845'); fondo.addColorStop(1, '#12021f');
    ctx.fillStyle = fondo; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f5d76e'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TRAGAMONEDAS', W / 2, 30);

    for (let k = 0; k < 3; k++) {
      const x = xs[k];
      rr(ctx, x - 6, ventY - 6, ancho + 12, ventH + 12, 16);
      ctx.fillStyle = fin && gano ? '#ffd54f' : '#d4af37'; ctx.fill();
      rr(ctx, x, ventY, ancho, ventH, 12); ctx.fillStyle = '#fafafa'; ctx.fill();
      ctx.save();
      rr(ctx, x, ventY, ancho, ventH, 12); ctx.clip();
      const tk = Math.min(1, t / paradas[k]);
      const p = recorrido[k] * ease.cubic(tk);
      const girando = tk < 1;
      for (let j = Math.floor(p) - 2; j <= Math.ceil(p) + 2; j++) {
        const idx = j + 3;
        if (idx < 0 || idx >= tiras[k].length) continue;
        const y = ventY + ventH / 2 - (p - j) * celda;
        ctx.globalAlpha = girando ? 0.8 : 1;
        ICONOS[tiras[k][idx]](ctx, x + ancho / 2, y, 36);
      }
      ctx.globalAlpha = 1;
      // sombreado arriba y abajo para dar efecto de cilindro
      const sombra = ctx.createLinearGradient(0, ventY, 0, ventY + ventH);
      sombra.addColorStop(0, 'rgba(0,0,0,0.35)'); sombra.addColorStop(0.3, 'rgba(0,0,0,0)');
      sombra.addColorStop(0.7, 'rgba(0,0,0,0)'); sombra.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = sombra; ctx.fillRect(x, ventY, ancho, ventH);
      ctx.restore();
    }
    // linea de pago
    ctx.strokeStyle = 'rgba(255,23,68,0.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(30, ventY + ventH / 2); ctx.lineTo(W - 30, ventY + ventH / 2); ctx.stroke();

    ctx.textAlign = 'center';
    if (fin) {
      ctx.fillStyle = gano ? '#69f0ae' : '#ff8a80'; ctx.font = 'bold 26px sans-serif';
      ctx.fillText(textoFinal, W / 2, 392);
    } else {
      ctx.fillStyle = '#b39ddb'; ctx.font = 'bold 22px sans-serif';
      ctx.fillText('Girando' + '.'.repeat(1 + (Math.floor(i / 5) % 3)), W / 2, 392);
    }
  };
}

module.exports = {
  name: 'tragamonedas',
  aliases: ['slots', 'slot'],
  category: 'casino',
  description: 'Tragamonedas animada (ej: .tragamonedas 100). Par paga x2, triple paga x5',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/);
    const apuesta = parseInt(partes[1], 10);

    if (!apuesta || apuesta <= 0) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}tragamonedas <monto>`, { titulo: 'TRAGAMONEDAS', estilo: 'gamer' }) }, { quoted: msg });
    }
    const db = leerDB();
    const usuario = getUsuario(db, remitente);
    if (usuario.saldo < apuesta) {
      return sock.sendMessage(jid, { text: cajaError(`No tienes suficiente saldo.\nTu saldo: *$${usuario.saldo}*`, { titulo: 'TRAGAMONEDAS', estilo: 'gamer' }) }, { quoted: msg });
    }

    const r = [0, 1, 2].map(() => Math.floor(Math.random() * ICONOS.length));
    let ganancia; let resumen; let gano = true;
    if (r[0] === r[1] && r[1] === r[2]) { ganancia = apuesta * 5; resumen = `🎉 ¡TRIPLE! Ganaste *$${ganancia}*`; }
    else if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) { ganancia = apuesta * 2; resumen = `✨ ¡Par! Ganaste *$${ganancia}*`; }
    else { ganancia = -apuesta; resumen = `💸 Perdiste *$${apuesta}*`; gano = false; }

    usuario.saldo += ganancia;
    guardarDB(db);

    const linea = `[ ${r.map((n) => EMOJIS[n]).join(' | ')} ]\n\n${resumen}\nSaldo actual: *$${usuario.saldo}*`;
    const caption = gano ? exito(linea, { titulo: 'TRAGAMONEDAS', estilo: 'gamer' }) : cajaError(linea, { titulo: 'TRAGAMONEDAS', estilo: 'gamer' });
    const rotulo = r[0] === r[1] && r[1] === r[2] ? 'TRIPLE!' : gano ? 'PAR!' : 'Sin premio';

    await enviarAnimacion(sock, jid, msg, {
      ancho: 640, alto: 420, fps: 20, total: 70, retener: 18,
      dibujar: crearDibujo(r, gano, rotulo)
    }, caption);
  }
};

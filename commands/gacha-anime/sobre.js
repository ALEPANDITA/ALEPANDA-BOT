const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { EMOJI_RAREZA } = require('../../lib/gachaanime');
const { obtenerImagenAnime, descargarImagenBuffer } = require('../../lib/animeapi');
const { formatoTiempo } = require('../../lib/mercado');
const C = require('../../lib/cartasbot');

// Rectangulo redondeado (sin depender de ctx.roundRect, que no existe en todas las versiones del canvas)
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const COLOR = { legendaria: '#ffc857', epica: '#b07cff', rara: '#4aa8ff', comun: '#9fb3b0' };

// Junta las 5 cartas en una sola imagen (marco de color segun rareza)
async function crearCollage(cartas, buffers) {
  const { createCanvas, loadImage } = require('@napi-rs/canvas');
  const W = 900; const H = 900; const cw = 250; const ch = 340;
  const lienzo = createCanvas(W, H); const ctx = lienzo.getContext('2d');
  const fondo = ctx.createLinearGradient(0, 0, 0, H); fondo.addColorStop(0, '#12302b'); fondo.addColorStop(1, '#0b1316');
  ctx.fillStyle = fondo; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f5d76e'; ctx.font = 'bold 40px sans-serif'; ctx.fillText('SOBRE DE CARTAS', W / 2, 46);
  const pos = [[45, 90], [335, 90], [625, 90], [185, 470], [465, 470]];
  for (let i = 0; i < cartas.length; i++) {
    const [x, y] = pos[i]; const c = cartas[i]; const col = COLOR[c.rareza];
    ctx.save();
    rr(ctx, x, y, cw, ch, 16); ctx.clip();
    ctx.fillStyle = '#14232a'; ctx.fillRect(x, y, cw, ch);
    try {
      if (!buffers[i]) throw new Error('sin imagen');
      const img = await loadImage(buffers[i]);
      const esc = Math.max(cw / img.width, ch / img.height);
      const w = img.width * esc; const h = img.height * esc;
      ctx.drawImage(img, x + (cw - w) / 2, y, w, h);
    } catch (_) {
      ctx.fillStyle = col; ctx.globalAlpha = 0.25; ctx.fillRect(x, y, cw, ch); ctx.globalAlpha = 1;
      ctx.fillStyle = '#e6f1ee'; ctx.font = 'bold 28px sans-serif'; ctx.fillText(c.nombre, x + cw / 2, y + ch / 2);
    }
    ctx.restore();
    rr(ctx, x, y, cw, ch, 16); ctx.lineWidth = c.rareza === 'legendaria' ? 8 : 5; ctx.strokeStyle = col;
    ctx.shadowColor = col; ctx.shadowBlur = c.rareza === 'legendaria' ? 24 : 10; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = col; ctx.font = 'bold 20px sans-serif'; ctx.fillText(C.NOMBRE_RAREZA[c.rareza].toUpperCase(), x + cw / 2, y + ch + 22);
    ctx.fillStyle = '#e6f1ee'; ctx.font = '17px sans-serif'; ctx.fillText(c.nombre, x + cw / 2, y + ch + 46);
  }
  return lienzo.toBuffer('image/jpeg', 86);
}

module.exports = {
  name: 'sobre',
  aliases: ['sobreanime', 'pack', 'abrirsobre'],
  category: 'gacha-anime',
  description: `Abre un sobre de ${C.CARTAS_POR_SOBRE} cartas de anime por $${C.PRECIO_SOBRE}. Solo tú puedes reclamarlo con .claim`,
  execute: async (sock, jid, msg, { prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const responder = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });

    const validar = () => {
      const db = leerDB(); const perfil = getUsuario(db, remitente);
      const ahora = Date.now();
      if (perfil.pendingSobre && ahora - perfil.pendingSobre.timestamp < C.TIEMPO_RECLAMO_SOBRE_MS) {
        const seg = C.TIEMPO_RECLAMO_SOBRE_MS - (ahora - perfil.pendingSobre.timestamp);
        return { error: `📦 Ya tienes un sobre esperando. Usa *${prefix}claim* para reclamarlo (${formatoTiempo(seg)}).` };
      }
      const resta = C.COOLDOWN_SOBRE_MS - (ahora - (perfil.lastSobreAnime || 0));
      if (resta > 0) return { error: `⏳ Tu próximo sobre estará listo en ${formatoTiempo(resta)}.` };
      if (perfil.saldo < C.PRECIO_SOBRE) return { error: `No tienes suficientes monedas. Un sobre cuesta *$${C.PRECIO_SOBRE}* y tienes $${perfil.saldo}.` };
      return { db, perfil };
    };

    const previo = validar();
    if (previo.error) return responder(previo.error);

    await responder(`📦 *Abriendo tu sobre...*\n_(${C.CARTAS_POR_SOBRE} cartas por $${C.PRECIO_SOBRE})_`);
    const cartas = C.armarSobre();
    const buffers = await Promise.all(cartas.map(async (c, i) => {
      try {
        const img = await obtenerImagenAnime(c.categoriaApi);
        cartas[i] = { ...c, imagen: img.url };
        return await descargarImagenBuffer(img.url);
      } catch (_) { return null; }
    }));

    // se vuelve a validar y cobrar con datos frescos (por si pidio dos sobres a la vez)
    const ahora = validar();
    if (ahora.error) return responder(ahora.error);
    ahora.perfil.saldo -= C.PRECIO_SOBRE;
    ahora.perfil.lastSobreAnime = Date.now();
    ahora.perfil.pendingSobre = {
      timestamp: Date.now(),
      cartas: cartas.map((c) => ({ nombre: c.nombre, rareza: c.rareza, emoji: c.emoji, imagen: c.imagen || '' }))
    };
    guardarDB(ahora.db);

    const lista = cartas.map((c, i) => `${i + 1}. ${EMOJI_RAREZA[c.rareza]} ${c.emoji} *${c.nombre}* (${C.NOMBRE_RAREZA[c.rareza]})`).join('\n');
    const caption = `📦 *¡Tu sobre está listo!*\n\n${lista}\n\n✋ Solo tú puedes quedártelo: escribe *${prefix}claim* en los próximos ${Math.round(C.TIEMPO_RECLAMO_SOBRE_MS / 60000)} minutos.\n💰 Saldo restante: $${ahora.perfil.saldo}`;
    try {
      const imagen = await crearCollage(cartas, buffers);
      await sock.sendMessage(jid, { image: imagen, caption }, { quoted: msg });
    } catch (err) {
      console.error('[sobre] no se pudo armar la imagen:', err && err.message ? err.message : err);
      await responder(caption);
    }
  }
};

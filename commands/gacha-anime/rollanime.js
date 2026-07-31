const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { tirarGachaAnime, EMOJI_RAREZA } = require('../../lib/gachaanime');
const { obtenerImagenAnime, descargarImagenBuffer } = require('../../lib/animeapi');

const COSTO = 50;
const COOLDOWN_MS = 20 * 60 * 1000;
const TIEMPO_CLAIM_MS = 3 * 60 * 1000; // 3 minutos para reclamarlo con .claimanime

module.exports = {
  name: 'rollanime',
  category: 'gacha-anime',
  description: 'Invoca una ilustracion aleatoria de anime (cuesta 50 monedas). Debes reclamarla con .claimanime.',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const perfil = getUsuario(db, remitente);

    if (!perfil.gachaAnime) perfil.gachaAnime = {};
    if (!perfil.lastGachaAnime) perfil.lastGachaAnime = 0;

    const ahora = Date.now();
    const restante = COOLDOWN_MS - (ahora - perfil.lastGachaAnime);

    if (restante > 0) {
      const minutos = Math.ceil(restante / 60000);
      return sock.sendMessage(jid, {
        text: `🎴 Necesitas esperar. Vuelve a intentarlo en ${minutos} minuto(s).`
      }, { quoted: msg });
    }

    if (perfil.pendingGachaAnime && (ahora - perfil.pendingGachaAnime.timestamp) < TIEMPO_CLAIM_MS) {
      const segRestantes = Math.ceil((TIEMPO_CLAIM_MS - (ahora - perfil.pendingGachaAnime.timestamp)) / 1000);
      return sock.sendMessage(jid, {
        text: `⚠️ Ya tienes a *${perfil.pendingGachaAnime.nombre}* esperando. Usa *.claimanime* para reclamarlo (${segRestantes}s).`
      }, { quoted: msg });
    }

    if (perfil.saldo < COSTO) {
      return sock.sendMessage(jid, {
        text: `No tienes suficientes monedas. Necesitas $${COSTO} y tienes $${perfil.saldo}.`
      }, { quoted: msg });
    }

    perfil.saldo -= COSTO;
    perfil.lastGachaAnime = ahora;

    const resultado = tirarGachaAnime();
    perfil.pendingGachaAnime = { ...resultado, timestamp: ahora };

    guardarDB(db);

    const yaExiste = (perfil.gachaAnime[resultado.nombre] || 0) > 0;
    const minutosClaim = Math.round(TIEMPO_CLAIM_MS / 60000);
    const caption =
      `${EMOJI_RAREZA[resultado.rareza]} *¡Encontraste una ilustracion!*\n\n` +
      `${yaExiste ? 'Ya tienes copias de este tipo.' : '¡Primera vez que consigues este tipo!'}\n` +
      `⏳ Usa *.claimanime* dentro de los proximos ${minutosClaim} minutos o la perderas.\n` +
      `💰 Saldo restante: $${perfil.saldo}`;

    try {
      const img = await obtenerImagenAnime(resultado.categoriaApi);
      const buffer = await descargarImagenBuffer(img.url);
      const credito = img.artist_name ? `\n🎨 Arte: ${img.artist_name}` : '';
      await sock.sendMessage(jid, {
        image: buffer,
        caption: `${resultado.emoji} *${resultado.nombre}*\n\n${caption}${credito}`
      }, { quoted: msg });
    } catch (err) {
      console.error('[rollanime] Error obteniendo la imagen:', err);
      await sock.sendMessage(jid, {
        text: `${resultado.emoji} *${resultado.nombre}*\n\n${caption}\n\n⚠️ _(No se pudo traer la imagen ahora mismo: ${err.message})_`
      }, { quoted: msg });
    }
  }
};

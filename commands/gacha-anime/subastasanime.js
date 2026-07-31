const { leerDB } = require('../../lib/db');
const { EMOJI_RAREZA } = require('../../lib/gachaanime');
const { asegurarMercadoAnime, finalizarSubastasVencidasAnime } = require('../../lib/mercadoanime');
const { formatoTiempo } = require('../../lib/mercado');

module.exports = {
  name: 'subastasanime',
  category: 'gacha-anime',
  description: 'Muestra las subastas activas de anime',
  execute: async (sock, jid, msg, { prefix }) => {
    let db = leerDB();
    await finalizarSubastasVencidasAnime(sock, db);
    db = leerDB();

    const mercado = asegurarMercadoAnime(db);
    const subastas = Object.values(mercado.subastas).sort((a, b) => a.finalizaEn - b.finalizaEn);

    if (!subastas.length) {
      return sock.sendMessage(jid, {
        text: `📭 No hay subastas activas. Crea una con ${prefix}subastaranime <nombre> <precio inicial> <minutos>.`
      }, { quoted: msg });
    }

    let texto = `🔨 *SUBASTAS DE ANIME*\n\n`;
    const mentions = [];
    for (const s of subastas) {
      const restante = formatoTiempo(s.finalizaEn - Date.now());
      texto +=
        `${EMOJI_RAREZA[s.rareza]} *${s.nombre}*\n` +
        `   💰 Actual: $${s.precioActual}${s.mejorPostor ? ` (@${s.mejorPostor.split('@')[0]})` : ' (sin pujas)'}\n` +
        `   ⏳ ${restante} | 🆔 \`${s.id}\`\n\n`;
      if (s.mejorPostor) mentions.push(s.mejorPostor);
    }
    texto += `Puja con: ${prefix}pujaranime <ID> <monto>`;

    await sock.sendMessage(jid, { text: texto, mentions }, { quoted: msg });
  }
};

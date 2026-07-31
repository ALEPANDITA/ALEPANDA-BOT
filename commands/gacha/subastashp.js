const { leerDB } = require('../../lib/db');
const { EMOJI_RAREZA } = require('../../lib/gachahp');
const { asegurarMercado, finalizarSubastasVencidas, formatoTiempo } = require('../../lib/mercado');

module.exports = {
  name: 'subastashp',
  category: 'gacha',
  description: 'Muestra las subastas activas de personajes',
  execute: async (sock, jid, msg, { prefix }) => {
    let db = leerDB();
    await finalizarSubastasVencidas(sock, db);
    db = leerDB();

    const mercado = asegurarMercado(db);
    const subastas = Object.values(mercado.subastas).sort((a, b) => a.finalizaEn - b.finalizaEn);

    if (!subastas.length) {
      return sock.sendMessage(jid, {
        text: `📭 No hay subastas activas. Crea una con ${prefix}subastarhp <personaje> <precio inicial> <minutos>.`
      }, { quoted: msg });
    }

    let texto = `🔨 *SUBASTAS ACTIVAS*\n\n`;
    const mentions = [];
    for (const s of subastas) {
      const restante = formatoTiempo(s.finalizaEn - Date.now());
      texto +=
        `${EMOJI_RAREZA[s.rareza]} *${s.nombre}*\n` +
        `   💰 Actual: $${s.precioActual}${s.mejorPostor ? ` (@${s.mejorPostor.split('@')[0]})` : ' (sin pujas)'}\n` +
        `   ⏳ ${restante} | 🆔 \`${s.id}\`\n\n`;
      if (s.mejorPostor) mentions.push(s.mejorPostor);
    }
    texto += `Puja con: ${prefix}pujarhp <ID> <monto>`;

    await sock.sendMessage(jid, { text: texto, mentions }, { quoted: msg });
  }
};

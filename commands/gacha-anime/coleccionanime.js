const { leerDB, getUsuario } = require('../../lib/db');
const { EMOJI_RAREZA, ARQUETIPOS } = require('../../lib/gachaanime');

function buscarRareza(nombre) {
  for (const [rareza, a] of Object.entries(ARQUETIPOS)) {
    if (a.nombre === nombre) return rareza;
  }
  return 'comun';
}

module.exports = {
  name: 'coleccionanime',
  category: 'gacha-anime',
  description: 'Muestra tu coleccion de ilustraciones de anime',
  execute: async (sock, jid, msg) => {
    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const remitente = msg.key.participant || msg.key.remoteJid;
    const objetivo = mencionado || citado || remitente;

    const db = leerDB();
    const perfil = getUsuario(db, objetivo);
    const coleccion = perfil.gachaAnime || {};
    const nombres = Object.keys(coleccion);

    if (!nombres.length) {
      return sock.sendMessage(jid, {
        text: `@${objetivo.split('@')[0]} todavia no tiene ninguna ilustracion. Usa .rollanime para conseguir una.`,
        mentions: [objetivo]
      }, { quoted: msg });
    }

    let texto = `📖 *COLECCIÓN DE ANIME*\n👤 @${objetivo.split('@')[0]}\n\n`;

    nombres
      .sort((a, b) => a.localeCompare(b))
      .forEach(nombre => {
        const rareza = buscarRareza(nombre);
        texto += `${EMOJI_RAREZA[rareza]} ${nombre} x${coleccion[nombre]}\n`;
      });

    texto += `\n📊 Tipos distintos: ${nombres.length}/${Object.keys(ARQUETIPOS).length}`;

    await sock.sendMessage(jid, { text: texto, mentions: [objetivo] }, { quoted: msg });
  }
};

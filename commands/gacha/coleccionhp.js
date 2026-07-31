const { leerDB, getUsuario } = require('../../lib/db');
const { EMOJI_RAREZA, PERSONAJES } = require('../../lib/gachahp');

function buscarRareza(nombre) {
  for (const [rareza, lista] of Object.entries(PERSONAJES)) {
    if (lista.some(p => p.nombre === nombre)) return rareza;
  }
  return 'comun';
}

module.exports = {
  name: 'coleccionhp',
  category: 'gacha',
  description: 'Muestra tu coleccion de personajes magicos',
  execute: async (sock, jid, msg) => {
    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const remitente = msg.key.participant || msg.key.remoteJid;
    const objetivo = mencionado || citado || remitente;

    const db = leerDB();
    const perfil = getUsuario(db, objetivo);
    const coleccion = perfil.gachaHP || {};
    const nombres = Object.keys(coleccion);

    if (!nombres.length) {
      return sock.sendMessage(jid, {
        text: `@${objetivo.split('@')[0]} todavia no tiene ningun personaje. Usa .rollhp para conseguir uno.`,
        mentions: [objetivo]
      }, { quoted: msg });
    }

    const totalPersonajesUnicos = Object.values(PERSONAJES).reduce((sum, l) => sum + l.length, 0);

    let texto = `📖 *COLECCIÓN DE HARRY POTTER*\n👤 @${objetivo.split('@')[0]}\n\n`;

    nombres
      .sort((a, b) => a.localeCompare(b))
      .forEach(nombre => {
        const rareza = buscarRareza(nombre);
        texto += `${EMOJI_RAREZA[rareza]} ${nombre} x${coleccion[nombre]}\n`;
      });

    texto += `\n📊 Progreso: ${nombres.length}/${totalPersonajesUnicos} personajes distintos`;

    await sock.sendMessage(jid, { text: texto, mentions: [objetivo] }, { quoted: msg });
  }
};

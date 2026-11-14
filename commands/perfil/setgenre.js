const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, advertencia } = require('../../lib/estilo');

const GENEROS = ['hombre', 'mujer', 'otro'];

// Genero que sale en .perfil y en el historial matrimonial (Casado / Casada / Casade).
module.exports = {
  name: 'setgenre',
  aliases: ['setgenero'],
  category: 'perfil',
  description: 'Fija tu genero en el perfil: hombre, mujer u otro. Uso: .setgenre mujer',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const genero = (texto.trim().split(/\s+/)[1] || '').toLowerCase();

    if (!GENEROS.includes(genero)) {
      return sock.sendMessage(jid, {
        text: advertencia(`Elige: *hombre*, *mujer* u *otro*.\nEj: ${prefix}setgenre mujer`, { titulo: 'GENERO' })
      }, { quoted: msg });
    }

    const db = leerDB();
    getUsuario(db, remitente).genero = genero;
    guardarDB(db);
    await sock.sendMessage(jid, { text: exito(`Genero guardado: *${genero}*.`, { titulo: 'PERFIL' }) }, { quoted: msg });
  }
};

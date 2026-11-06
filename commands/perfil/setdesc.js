const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, advertencia } = require('../../lib/estilo');

const MAX_CARACTERES = 180;

// Descripcion que sale en .perfil. Sin texto: si ya tenias una, la borra.
module.exports = {
  name: 'setdesc',
  aliases: ['setbio', 'setdescription'],
  category: 'perfil',
  description: 'Pone o quita la descripcion de tu perfil. Uso: .setdesc <texto> (sin texto la borra)',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const nueva = texto.trim().split(/\s+/).slice(1).join(' ').trim();

    const db = leerDB();
    const usuario = getUsuario(db, remitente);

    if (!nueva) {
      if (!usuario.descripcion) {
        return sock.sendMessage(jid, {
          text: advertencia(`Escribe el texto de tu descripcion.\nEj: ${prefix}setdesc Jugador de Minecraft y fan del anime`, { titulo: 'FALTA EL TEXTO' })
        }, { quoted: msg });
      }
      usuario.descripcion = '';
      guardarDB(db);
      return sock.sendMessage(jid, { text: exito('Borre tu descripcion.', { titulo: 'PERFIL' }) }, { quoted: msg });
    }

    if (nueva.length > MAX_CARACTERES) {
      return sock.sendMessage(jid, {
        text: advertencia(`Tu descripcion es muy larga (${nueva.length}). El maximo es ${MAX_CARACTERES} caracteres.`, { titulo: 'MUY LARGA' })
      }, { quoted: msg });
    }

    usuario.descripcion = nueva;
    guardarDB(db);
    await sock.sendMessage(jid, { text: exito('Listo, tu descripcion ya sale en tu perfil.', { titulo: 'PERFIL' }) }, { quoted: msg });
  }
};

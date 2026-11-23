const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { leerConfig } = require('../../lib/config');
const { esAdminDelGrupo } = require('../../lib/permisos');

module.exports = {
  name: 'setprefix',
  category: 'admin',
  description: 'Prefijo del grupo. El bot entiende cualquier prefijo siempre; para dejar UNO solo: .setprefix ! solo (y .setprefix todos para volver)',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente, msg); // incluye al super owner del bot

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: 'Solo un admin del grupo puede cambiar el prefijo.' });
    }

    const db = leerDB();
    const grupo = getGrupo(db, jid);
    const resto = texto.slice((prefix + 'setprefix').length).trim();
    const partes = resto.split(/\s+/).filter(Boolean);
    const actual = grupo.prefix || leerConfig().prefix || '.';

    if (!partes.length) {
      return sock.sendMessage(jid, {
        text: `⚙️ *Prefijo de este grupo*\n\n` +
          `Ahora: *${actual}* · ${grupo.prefixSolo ? 'solo vale ese prefijo' : 'vale cualquier prefijo (. / ! # ...)'}\n\n` +
          `• ${prefix}setprefix ! solo → solo se usará "!" en este grupo\n` +
          `• ${prefix}setprefix solo → solo el prefijo actual (${actual})\n` +
          `• ${prefix}setprefix todos → vuelve a valer cualquier prefijo\n` +
          `• ${prefix}setprefix ! → cambia el prefijo principal (el del menú) sin quitar los demás`
      });
    }

    const palabra = partes[0].toLowerCase();
    if (['todos', 'todo', 'multi', 'libre'].includes(palabra)) {
      grupo.prefixSolo = false;
      guardarDB(db);
      return sock.sendMessage(jid, { text: '✅ En este grupo vale *cualquier prefijo* (. / ! # ...).' });
    }
    if (palabra === 'solo' && partes.length === 1) {
      grupo.prefixSolo = true;
      guardarDB(db);
      return sock.sendMessage(jid, { text: `🔒 En este grupo solo vale el prefijo *${actual}*.\nPara volver: ${actual}setprefix todos` });
    }

    const nuevo = partes[0];
    if (nuevo.length > 3) return sock.sendMessage(jid, { text: 'El prefijo es muy largo (máximo 3 caracteres).' });
    grupo.prefix = nuevo;
    const pideSolo = partes.slice(1).some((p) => p.toLowerCase() === 'solo');
    if (pideSolo) grupo.prefixSolo = true;
    guardarDB(db);

    if (grupo.prefixSolo) {
      return sock.sendMessage(jid, { text: `🔒 Prefijo de este grupo: *${nuevo}* (es el único que vale).\nPara volver a aceptar todos: ${nuevo}setprefix todos` });
    }
    return sock.sendMessage(jid, { text: `✅ Prefijo principal de este grupo: *${nuevo}*\nSigue valiendo cualquier prefijo. Para dejar solo este: ${nuevo}setprefix solo` });
  }
};

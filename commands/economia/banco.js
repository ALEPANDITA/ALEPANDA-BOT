const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

module.exports = {
  name: 'banco',
  category: 'economia',
  description: 'Ver, guardar o sacar dinero del banco (ej: .banco guardar 100)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/);
    const accion = (partes[1] || '').toLowerCase();
    const monto = parseInt(partes[2]);

    const db = leerDB();
    const usuario = getUsuario(db, remitente);

    if (!accion || accion === 'ver') {
      return sock.sendMessage(jid, {
        text: `🏦 *Banco*\nEn mano: *$${usuario.saldo}*\nGuardado: *$${usuario.banco}*`
      });
    }

    if (accion === 'guardar') {
      if (!monto || monto <= 0) {
        return sock.sendMessage(jid, { text: `Uso: ${prefix}banco guardar <monto>` });
      }
      if (usuario.saldo < monto) {
        return sock.sendMessage(jid, { text: `No tienes suficiente en mano. Tienes: $${usuario.saldo}` });
      }
      usuario.saldo -= monto;
      usuario.banco += monto;
      guardarDB(db);
      return sock.sendMessage(jid, { text: `✅ Guardaste *$${monto}* en el banco.\nEn mano: *$${usuario.saldo}* | Guardado: *$${usuario.banco}*` });
    }

    if (accion === 'sacar') {
      if (!monto || monto <= 0) {
        return sock.sendMessage(jid, { text: `Uso: ${prefix}banco sacar <monto>` });
      }
      if (usuario.banco < monto) {
        return sock.sendMessage(jid, { text: `No tienes suficiente guardado. Tienes: $${usuario.banco}` });
      }
      usuario.banco -= monto;
      usuario.saldo += monto;
      guardarDB(db);
      return sock.sendMessage(jid, { text: `✅ Sacaste *$${monto}* del banco.\nEn mano: *$${usuario.saldo}* | Guardado: *$${usuario.banco}*` });
    }

    return sock.sendMessage(jid, { text: `Uso:\n${prefix}banco - ver saldo\n${prefix}banco guardar <monto>\n${prefix}banco sacar <monto>` });
  }
};

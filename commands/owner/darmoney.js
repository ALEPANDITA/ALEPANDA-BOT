const { leerConfig } = require('../../lib/config');
const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { resolverLid, esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'darmoney',
  category: 'owner',
  description: 'Dar dinero a un usuario (solo owner)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;

    let objetivo = mencionado || citado;

    if (!objetivo) {
      return sock.sendMessage(jid, {
        text: advertencia(`Menciona o responde a alguien: ${prefix}darmoney <monto>`, { titulo: 'FALTA EL USUARIO', estilo: 'neon' })
      });
    }

    let objetivoResuelto = objetivo;
    try {
      objetivoResuelto = await resolverLid(sock, objetivo);
    } catch {}

    const partes = (texto || '').trim().split(/\s+/).filter(Boolean);
    const monto = parseInt(partes[partes.length - 1], 10);

    if (!monto || monto <= 0) {
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}darmoney <monto> (mencionando o respondiendo a alguien)`, { titulo: 'FALTA EL MONTO', estilo: 'neon' })
      });
    }

    const db = leerDB();
    const receptor = getUsuario(db, objetivoResuelto);
    receptor.saldo += monto;
    guardarDB(db);

    await sock.sendMessage(jid, {
      text: exito(`Le diste *$${monto}* al usuario.\nSu saldo actual: *$${receptor.saldo}*`, { titulo: 'DINERO ENVIADO', estilo: 'neon' })
    });
  }
};

const { leerConfig, guardarConfig } = require('../../lib/config');
const { mismoUsuario, esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'delowner',
  category: 'owner',
  description: 'Quita a un owner del bot (solo owner)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const partes = (texto || '').trim().split(/\s+/).filter(Boolean);
    const numeroTexto = partes[1] ? partes[1].replace(/[^0-9]/g, '') : null;

    let objetivo = mencionado || citado || (numeroTexto ? `${numeroTexto}@s.whatsapp.net` : null);

    if (!objetivo) {
      return sock.sendMessage(jid, {
        text: advertencia(`Menciona a alguien, responde a su mensaje, o escribe el numero: ${prefix}delowner <numero>`, { titulo: 'FALTA EL USUARIO', estilo: 'neon' })
      });
    }

    if (!config.owners) config.owners = [];

    const antes = config.owners.length;
    config.owners = config.owners.filter(o => !mismoUsuario(o, objetivo));

    if (config.owners.length === antes) {
      return sock.sendMessage(jid, { text: advertencia('Ese usuario no estaba en la lista de owners.', { titulo: 'SIN CAMBIOS', estilo: 'neon' }) });
    }

    guardarConfig(config);

    const numeroLimpio = objetivo.split('@')[0];
    await sock.sendMessage(jid, {
      text: exito(`*${numeroLimpio}* fue removido de la lista de owners.`, { titulo: 'OWNER ELIMINADO', estilo: 'neon' })
    });
  }
};

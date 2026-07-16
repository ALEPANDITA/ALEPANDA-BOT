const { leerConfig, guardarConfig } = require('../../lib/config');
const { resolverLid, mismoUsuario, esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'setowner',
  category: 'owner',
  description: 'Agrega un nuevo owner al bot (solo owner)',
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
        text: advertencia(`Menciona a alguien, responde a su mensaje, o escribe el numero: ${prefix}setowner <numero>`, { titulo: 'FALTA EL USUARIO', estilo: 'neon' })
      });
    }

    if (!config.owners) config.owners = [];

    const yaEsOwner = config.owners.some(o => mismoUsuario(o, objetivo));
    if (yaEsOwner) {
      return sock.sendMessage(jid, { text: advertencia('Ese usuario ya es owner del bot.', { titulo: 'SIN CAMBIOS', estilo: 'neon' }) });
    }

    config.owners.push(objetivo);
    guardarConfig(config);

    const numeroLimpio = objetivo.split('@')[0];
    await sock.sendMessage(jid, {
      text: exito(`*${numeroLimpio}* fue agregado como owner del bot.\nYa puede usar todos los comandos de owner sin reiniciar el bot.`, { titulo: 'NUEVO OWNER', estilo: 'neon' })
    });
  }
};

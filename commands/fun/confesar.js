const { caja, advertencia, error: cajaError } = require('../../lib/estilo');
const { guardarConfesion } = require('../../lib/confesiones');

function extraerCodigoInvitacion(texto) {
  const match = texto.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/i);
  return match ? match[1] : null;
}

module.exports = {
  name: 'confesar',
  category: 'fun',
  description: 'Envia una confesion anonima a un grupo usando su link de invitacion. Uso: .confesar <link> <confesion>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const contenido = texto.slice((prefix + 'confesar').length).trim();
    const codigo = extraerCodigoInvitacion(contenido);

    if (!codigo) {
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}confesar <link del grupo> <tu confesion>\nEjemplo: ${prefix}confesar https://chat.whatsapp.com/ABC123 me gusta alguien`, { titulo: 'FALTA EL LINK', estilo: 'kawaii' })
      });
    }

    const confesion = contenido.replace(/https?:\/\/chat\.whatsapp\.com\/[a-zA-Z0-9]+/i, '').trim();

    if (!confesion) {
      return sock.sendMessage(jid, {
        text: advertencia('Escribe tu confesion despues del link.', { titulo: 'FALTA LA CONFESION', estilo: 'kawaii' })
      });
    }

    try {
      const infoInvitacion = await sock.groupGetInviteInfo(codigo);
      const grupoDestino = infoInvitacion.id;

      const gruposDelBot = await sock.groupFetchAllParticipating();

      if (!gruposDelBot[grupoDestino]) {
        return sock.sendMessage(jid, {
          text: cajaError('El bot no esta en ese grupo, no puedo enviar la confesion ahi.')
        });
      }

      const textoConfesion = caja([
        `"${confesion}"`
      ], {
        titulo: 'CONFESION ANONIMA',
        pie: 'Nadie sabe quien la mando... o si?',
        estilo: 'kawaii'
      });

      await sock.sendMessage(grupoDestino, { text: textoConfesion });

      guardarConfesion({
        remitente: (msg.key.participant || msg.key.remoteJid).split('@')[0],
        confesion,
        grupoId: grupoDestino,
        grupoNombre: infoInvitacion.subject,
        fecha: new Date().toISOString()
      });

      if (jid !== grupoDestino) {
        await sock.sendMessage(jid, {
          text: `✅ Tu confesion fue enviada de forma anonima a *${infoInvitacion.subject}*`
        });
      }
    } catch (err) {
      console.error('[confesar]', err);
      await sock.sendMessage(jid, {
        text: cajaError('No se pudo enviar la confesion. Revisa que el link sea valido y que el bot este en ese grupo.')
      });
    }
  }
};

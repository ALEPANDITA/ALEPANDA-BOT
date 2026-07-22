const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { caja, exito, advertencia, error: cajaError } = require('../../lib/estilo');
const { guardarConfesion } = require('../../lib/confesiones');

function extraerCodigoInvitacion(texto) {
  const match = texto.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/i);
  return match ? match[1] : null;
}

function extraerMensajeConImagen(msg) {
  const citado = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (citado?.imageMessage) return { message: citado };
  if (msg.message?.imageMessage) return msg;
  return null;
}

module.exports = {
  name: 'confesar',
  category: 'fun',
  description: 'Envia una confesion anonima a un grupo usando su link de invitacion. Puedes adjuntar o responder una imagen. Uso: .confesar <link> <confesion> [numero para etiquetar]',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const contenido = texto.slice((prefix + 'confesar').length).trim();
    const codigo = extraerCodigoInvitacion(contenido);

    if (!codigo) {
      return sock.sendMessage(jid, {
        text: advertencia(
          `Uso: ${prefix}confesar <link del grupo> <tu confesion> [numero]\nEjemplo: ${prefix}confesar https://chat.whatsapp.com/ABC123 me gusta alguien 525662708347\n\nTambien puedes responder a una imagen (o mandarla junto al comando) para incluirla.`,
          { titulo: 'FALTA EL LINK', estilo: 'kawaii' }
        )
      });
    }

    let confesion = contenido.replace(/https?:\/\/chat\.whatsapp\.com\/[a-zA-Z0-9]+/i, '').trim();

    let numeroEtiquetado = null;
    const matchNumero = confesion.match(/(\d{8,15})\s*$/);
    if (matchNumero) {
      numeroEtiquetado = matchNumero[1];
      confesion = confesion.slice(0, matchNumero.index).trim();
    }

    let todos = false;
    if (/@todos\b/i.test(confesion)) {
      todos = true;
      confesion = confesion.replace(/@todos\b/gi, '').replace(/\s{2,}/g, ' ').trim();
    }

    const mensajeConImagen = extraerMensajeConImagen(msg);

    if (!confesion && !mensajeConImagen) {
      return sock.sendMessage(jid, {
        text: advertencia('Escribe tu confesion despues del link (o adjunta una imagen).', { titulo: 'FALTA LA CONFESION', estilo: 'kawaii' })
      });
    }

    try {
      const infoInvitacion = await sock.groupGetInviteInfo(codigo);
      const grupoDestino = infoInvitacion.id;

      const gruposDelBot = await sock.groupFetchAllParticipating();

      if (!gruposDelBot[grupoDestino]) {
        return sock.sendMessage(jid, {
          text: cajaError('El bot no esta en ese grupo, no puedo enviar la confesion ahi.', { estilo: 'kawaii' })
        });
      }

      const metadata = await sock.groupMetadata(grupoDestino);

      let jidEtiquetado = null;
      if (numeroEtiquetado) {
        const participante = metadata.participants.find(p => p.id.split('@')[0] === numeroEtiquetado);
        if (participante) jidEtiquetado = participante.id;
      }

      const lineas = confesion ? [`"${confesion}"`] : [];
      if (jidEtiquetado) {
        lineas.push('', `💌 Dedicada para @${numeroEtiquetado}`);
      } else if (numeroEtiquetado) {
        lineas.push('', `⚠️ (la persona etiquetada ya no esta en el grupo)`);
      }

      const textoConfesion = caja(lineas, {
        titulo: '💌 CONFESION ANONIMA 💌',
        pie: 'Nadie sabe quien la mando... o si? 👀',
        estilo: 'kawaii'
      });

      const mentions = todos
        ? metadata.participants.map(p => p.id)
        : (jidEtiquetado ? [jidEtiquetado] : []);

      if (mensajeConImagen) {
        const buffer = await downloadMediaMessage(mensajeConImagen, 'buffer', {});
        await sock.sendMessage(grupoDestino, {
          image: buffer,
          caption: textoConfesion,
          mentions
        });
      } else {
        await sock.sendMessage(grupoDestino, {
          text: textoConfesion,
          mentions
        });
      }

      guardarConfesion({
        remitente: (msg.key.participant || msg.key.remoteJid).split('@')[0],
        confesion,
        etiquetado: numeroEtiquetado || null,
        conImagen: Boolean(mensajeConImagen),
        aTodos: todos,
        grupoId: grupoDestino,
        grupoNombre: infoInvitacion.subject,
        fecha: new Date().toISOString()
      });

      if (jid !== grupoDestino) {
        await sock.sendMessage(jid, {
          text: exito(`Tu confesion fue enviada de forma anonima a *${infoInvitacion.subject}*`, { titulo: 'ENVIADA', estilo: 'kawaii' })
        });
      }
    } catch (err) {
      console.error('[confesar]', err);
      await sock.sendMessage(jid, {
        text: cajaError('No se pudo enviar la confesion. Revisa que el link sea valido y que el bot este en ese grupo.', { estilo: 'kawaii' })
      });
    }
  }
};

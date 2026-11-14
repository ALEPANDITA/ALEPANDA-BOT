const { leerConfig } = require('../../lib/config');
const { esAdminDelGrupo, esOwnerBot } = require('../../lib/permisos');

const ENCABEZADO = '📢 *MENSAJE DE LOS ADMINS IMPORTANTE*\n👇👇👇\n\n';

// Saca el mensaje al que se esta respondiendo (si hay) y lo "desenvuelve" si viene
// dentro de un mensaje temporal / con caption de documento.
function obtenerCitado(msg) {
  let q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    || msg.message?.imageMessage?.contextInfo?.quotedMessage
    || msg.message?.videoMessage?.contextInfo?.quotedMessage
    || null;
  for (let i = 0; q && i < 3; i++) {
    const interno = q.ephemeralMessage?.message || q.documentWithCaptionMessage?.message;
    if (!interno) break;
    q = interno;
  }
  return q;
}

function textoDe(m) {
  return (
    m?.conversation ||
    m?.extendedTextMessage?.text ||
    m?.imageMessage?.caption ||
    m?.videoMessage?.caption ||
    m?.documentMessage?.caption ||
    ''
  ).trim();
}

module.exports = {
  name: 'n',
  category: 'admin',
  description: 'Manda un mensaje etiquetando a todos de forma silenciosa, sin mostrar la lista de usuarios. Tambien funciona respondiendo a un mensaje (texto, imagen, video, audio, sticker o documento) (solo admin/owner)',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const config = leerConfig();
    const remitente = msg.key.participant;

    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);
    const esOwner = await esOwnerBot(sock, config, msg);

    if (!esAdmin && !esOwner) {
      return sock.sendMessage(jid, { text: 'Solo un admin o un owner del bot puede usar este comando.' });
    }

    const propio = texto.slice((prefix + 'n').length).trim();
    const citado = obtenerCitado(msg);

    if (!propio && !citado) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}n <mensaje>\nO responde a un mensaje (texto, foto, video, audio, sticker) con ${prefix}n para mandarlo etiquetando a todos.` });
    }

    try {
      const metadata = await sock.groupMetadata(jid);
      const botNumero = (sock.user?.id || '').split(':')[0];
      const participantes = metadata.participants
        .map(p => p.id)
        .filter(id => id.split('@')[0] !== botNumero);

      // Sin mensaje citado: funciona como antes
      if (!citado) {
        return sock.sendMessage(jid, { text: ENCABEZADO + propio, mentions: participantes });
      }

      const tipos = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'];
      const tipo = tipos.find((t) => citado[t]);
      const textoCitado = textoDe(citado);

      // Mensaje citado de solo texto
      if (!tipo) {
        const cuerpo = [propio, textoCitado].filter(Boolean).join('\n\n');
        if (!cuerpo) {
          return sock.sendMessage(jid, { text: 'Ese mensaje no se puede reenviar (no tiene texto ni archivo compatible).' });
        }
        return sock.sendMessage(jid, { text: ENCABEZADO + cuerpo, mentions: participantes });
      }

      if (citado[tipo].viewOnce) {
        return sock.sendMessage(jid, { text: 'No puedo reenviar mensajes de "ver una vez".' });
      }

      // Mensaje citado con archivo: se descarga y se vuelve a mandar
      const { downloadMediaMessage } = require('@whiskeysockets/baileys');
      let buffer;
      try {
        buffer = await downloadMediaMessage({ message: citado }, 'buffer', {});
      } catch (err) {
        console.error('[n] no se pudo descargar el archivo citado:', err.message);
        return sock.sendMessage(jid, { text: 'No pude descargar ese archivo, intenta de nuevo.' });
      }

      const caption = ENCABEZADO + [propio, textoCitado].filter(Boolean).join('\n\n');
      const info = citado[tipo];

      if (tipo === 'imageMessage') {
        return sock.sendMessage(jid, { image: buffer, caption, mentions: participantes });
      }
      if (tipo === 'videoMessage') {
        return sock.sendMessage(jid, { video: buffer, caption, mentions: participantes, gifPlayback: !!info.gifPlayback });
      }
      if (tipo === 'documentMessage') {
        return sock.sendMessage(jid, {
          document: buffer,
          mimetype: info.mimetype || 'application/octet-stream',
          fileName: info.fileName || 'archivo',
          caption,
          mentions: participantes
        });
      }

      // Audio y sticker no llevan texto: primero el aviso con la mencion silenciosa y luego el archivo
      await sock.sendMessage(jid, { text: ENCABEZADO + (propio || (tipo === 'audioMessage' ? '🔊 Audio de los admins' : '✨ Sticker de los admins')), mentions: participantes });
      if (tipo === 'audioMessage') {
        return sock.sendMessage(jid, { audio: buffer, mimetype: info.mimetype || 'audio/mp4', ptt: !!info.ptt });
      }
      return sock.sendMessage(jid, { sticker: buffer });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error al mandar el mensaje.' });
    }
  }
};

const { obtenerMega } = require('../../lib/dvyer');

async function react(sock, msg, emoji) {
  try {
    await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } });
  } catch (e) {}
}

module.exports = {
  name: 'mega',
  category: 'download',
  description: 'Descarga un archivo de un link de MEGA',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.slice((prefix + 'mega ').length).trim();

    if (!url || !/^https?:\/\//i.test(url)) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}mega <link de mega.nz>` }, { quoted: msg });
    }

    await react(sock, msg, '⏳');

    try {
      const resultado = await obtenerMega(url);

      await sock.sendMessage(jid, {
        text: `📁 *${resultado.title}*\n` +
          (resultado.fileSize ? `📦 Tamaño: ${resultado.fileSize}\n` : '') +
          `\nDescargando archivo...`
      }, { quoted: msg });

      await sock.sendMessage(jid, {
        document: resultado.buffer,
        fileName: resultado.fileName,
        mimetype: 'application/octet-stream'
      }, { quoted: msg });

      await react(sock, msg, '✅');
    } catch (err) {
      console.error(err);
      await react(sock, msg, '❌');
      await sock.sendMessage(jid, { text: `No se pudo descargar de MEGA: ${err.message}` }, { quoted: msg });
    }
  }
};

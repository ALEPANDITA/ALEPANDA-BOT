module.exports = {
  name: 'qrcode',
  category: 'tools',
  description: 'Genera un codigo QR a partir de un texto o link',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const contenido = texto.slice((prefix + 'qrcode ').length).trim();

    if (!contenido) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}qrcode <texto o link>` }, { quoted: msg });
    }

    const url = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(contenido)}`;

    await sock.sendMessage(jid, {
      image: { url },
      caption: `📷 QR generado para:\n${contenido}`
    }, { quoted: msg });
  }
};

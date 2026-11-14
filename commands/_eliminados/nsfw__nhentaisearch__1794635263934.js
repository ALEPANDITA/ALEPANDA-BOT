const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'nhentaisearch',
  aliases: ['nhsearch', 'nhentai'],
  category: 'nsfw',
  description: 'Busca doujins en nhentai. Uso: .nhentaisearch <query>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const query = texto.trim().split(/\s+/).slice(1).join(' ').trim();
    if (!query) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}nhentaisearch <query>`, { titulo: 'FALTA INFORMACION' }) });
    }

    try {
      const response = await fetch(`https://api.delirius.online/anime/nhentaisearch?query=${encodeURIComponent(query)}`);
      const json = await response.json();

      if (!json.status || !json.data || json.data.length === 0) {
        return sock.sendMessage(jid, { text: cajaError('No se encontraron resultados para la búsqueda.') });
      }

      let resultadoTexto = `*Resultados para:* ${query}\n*Usuario:* @${msg.key.participant ? msg.key.participant.split('@')[0] : jid.split('@')[0]}\n\n`;

      const limit = Math.min(json.data.length, 10); // Mostramos hasta 10 resultados para no saturar el chat
      for (let i = 0; i < limit; i++) {
        const item = json.data[i];
        resultadoTexto += `*${i + 1}.* ${item.title}\n*ID:* ${item.id}\n*URL:* ${item.url}\n\n`;
      }

      const mentionJid = msg.key.participant || jid;

      await sock.sendMessage(jid, {
        text: resultadoTexto.trim(),
        mentions: [mentionJid]
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al realizar la búsqueda.') });
    }
  }
};
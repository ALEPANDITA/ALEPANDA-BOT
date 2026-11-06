const { advertencia, error: cajaError } = require('../../lib/estilo');

// Letras de canciones (api.delirius.online, la misma que usan los logos).
module.exports = {
  name: 'lyrics',
  aliases: ['letra', 'lyric'],
  category: 'download',
  description: 'Busca la letra de una cancion. Uso: .lyrics <cancion> [artista]',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const consulta = texto.trim().split(/\s+/).slice(1).join(' ').trim();
    if (!consulta) {
      return sock.sendMessage(jid, {
        text: advertencia(`Escribe el nombre de la cancion.\nEj: ${prefix}lyrics bohemian rhapsody`, { titulo: 'FALTA LA CANCION' })
      }, { quoted: msg });
    }

    try {
      const res = await fetch(`https://api.delirius.online/search/lyrics?query=${encodeURIComponent(consulta)}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = json?.data;
      const letra = typeof data?.lyrics === 'string' ? data.lyrics.trim() : '';

      if (!json?.status || !letra) {
        return sock.sendMessage(jid, { text: cajaError(`No encontre la letra de *${consulta}*.`, { titulo: 'SIN RESULTADOS' }) }, { quoted: msg });
      }

      const titulo = data.title || consulta;
      const artista = data.artist || data.author || '';
      const MAX = 20000; // limite comodo para un solo mensaje
      const cuerpo = letra.length > MAX ? `${letra.slice(0, MAX)}\n…` : letra;

      await sock.sendMessage(jid, {
        text: `🎤 *${titulo}*${artista ? `\n👤 ${artista}` : ''}\n\n${cuerpo}`
      }, { quoted: msg });
    } catch (err) {
      console.error('[lyrics]', err.message);
      const lento = err.name === 'TimeoutError' || err.name === 'AbortError';
      await sock.sendMessage(jid, {
        text: cajaError(lento ? 'El servidor de letras tardo demasiado. Intenta de nuevo en un momento.' : 'No pude buscar la letra ahora mismo. Intenta mas tarde.')
      }, { quoted: msg });
    }
  }
};

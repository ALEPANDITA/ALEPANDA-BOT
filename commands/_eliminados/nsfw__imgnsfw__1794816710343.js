const { advertencia, error: cajaError } = require('../../lib/estilo');

const DEFAULT_CATEGORIES = [
  'waifu', 'hentai', 'neko', 'kemonomimi', 'bunny', 'maid',
  'boobs', 'bigboobs', 'mediumboobs', 'smallboobs', 'flatchest',
  'ass', 'pussy', 'dick', 'anal', 'masturbation', 'masturbating',
  'threesome', 'kissing', 'bikini', 'schoolgirl', 'wet', 'yuri',
  'lesbian', 'trap', 'futa'
];

const API_HEADERS = {
  'x-api-key': 'evogb-WPHlBOdu',
  'Accept': 'application/json'
};

module.exports = {
  name: 'imgnsfw',
  aliases: ['nsfw'],
  category: 'nsfw',
  description: 'Obtiene una imagen NSFW por categoría. Usa .imgnsfw para ver la lista de categorías.',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const args = texto.trim().split(/\s+/).slice(1);
    const catInput = args[0] ? args[0].toLowerCase() : '';

    let categories = DEFAULT_CATEGORIES;
    try {
      const resList = await fetch('https://api.evogb.org/nsfw/rnd?type=list', { headers: API_HEADERS });
      if (resList.ok) {
        const jsonList = await resList.json();
        if (jsonList && Array.isArray(jsonList.options) && jsonList.options.length > 0) {
          categories = jsonList.options;
        }
      }
    } catch (err) {
      // Si falla al cargar lista dinamica, se usa la lista por defecto
    }

    if (!catInput) {
      const listaFormatted = categories.map(c => `• ${prefix}imgnsfw ${c}`).join('\n');
      const textResponse = `🔞 *CATEGORÍAS NSFW DISPONIBLES*\n\n${listaFormatted}\n\nUso: *${prefix}imgnsfw <categoría>*`;
      return sock.sendMessage(jid, { text: textResponse });
    }

    const categoryFound = categories.find(c => c.toLowerCase() === catInput);
    if (!categoryFound) {
      return sock.sendMessage(
        jid,
        { text: advertencia(`La categoría "*${catInput}*" no existe.\nEscribe *${prefix}imgnsfw* para ver todas las categorías disponibles.`, { titulo: 'CATEGORÍA INVÁLIDA' }) }
      );
    }

    try {
      const apiUrl = `https://api.evogb.org/nsfw/rnd?type=${encodeURIComponent(categoryFound)}`;
      const res = await fetch(apiUrl, { headers: API_HEADERS });

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const json = await res.json();
      const imageUrl = json?.data?.result || json?.result || json?.url || json?.link || json?.image;

      if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
        throw new Error('La API no devolvió una URL de imagen válida.');
      }

      await sock.sendMessage(
        jid,
        {
          image: { url: imageUrl },
          caption: `🔞 *Categoría:* ${categoryFound}`
        }
      );
    } catch (err) {
      console.error(err);
      await sock.sendMessage(
        jid,
        { text: cajaError('Ocurrió un error al obtener la imagen. Intenta más tarde.') }
      );
    }
  }
};
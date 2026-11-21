const { enviarReaccion } = require('../../lib/animereact');
const { cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'coffee',
  aliases: ['cafe'],
  category: 'anime',
  description: 'Comparte un café con alguien o tómate uno tú solo. Uso: .coffee [@usuario]',
  execute: async (sock, jid, msg, { prefix }) => {
    try {
      await enviarReaccion(sock, jid, msg, {
        tipo: 'coffee',
        emoji: '☕',
        conObjetivo: (yo, el) => `@${yo} le ofrece un café a @${el}`,
        sinObjetivo: (yo) => `@${yo} está disfrutando de un buen café`,
        obtener: async () => {
          // Intentamos primero con evogb, si falla usamos nekos.best como respaldo
          try {
            const res = await fetch('https://api.evogb.org/sfw/interaction?type=coffee');
            if (res.ok) {
              const data = await res.json();
              if (data?.status && data?.result) {
                return { url: data.result };
              }
            }
          } catch (_) {
            // Ignorar error y pasar al fallback
          }
          // Fallback a nekos.best (endpoint aleatorio de tipo coffee)
          const fallbackRes = await fetch('https://nekos.best/api/v2/coffee');
          if (!fallbackRes.ok) throw new Error('Fallback API failed');
          const fallbackData = await fallbackRes.json();
          // nekos.best devuelve { results: [{ url: '...' }] }
          if (fallbackData?.results?.[0]?.url) {
            return { url: fallbackData.results[0].url };
          }
          throw new Error('No se obtuvo URL de imagen/gif');
        }
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al procesar el comando coffee.') });
    }
  }
};
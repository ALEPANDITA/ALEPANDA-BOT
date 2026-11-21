const { enviarReaccion } = require('../../lib/animereact');
const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'snuggle',
  aliases: ['acurrucar', 'acurrucarse'],
  category: 'anime',
  description: 'Reacción anime de acurrucarse. Uso: .snuggle [@usuario]',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      await enviarReaccion(sock, jid, msg, {
        tipo: 'snuggle',
        emoji: '🤗',
        conObjetivo: (yo, el) => `@${yo} se acurruca tiernamente con @${el} 🥰✨`,
        sinObjetivo: (yo) => `@${yo} se acurruca solo, buscando calor 💖`,
        obtener: async () => {
          // Intentamos primero con la API original, si falla usamos nekos.best como respaldo
          try {
            const r1 = await fetch('https://api.evogb.org/sfw/interaction?type=snuggle');
            if (r1.ok) {
              const j1 = await r1.json();
              if (j1 && j1.result) return { url: j1.result };
            }
          } catch (_) {}
          // Respaldo con nekos.best
          const r2 = await fetch('https://nekos.best/api/v2/snuggle');
          if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
          const j2 = await r2.json();
          if (j2 && j2.results && j2.results[0] && j2.results[0].url) {
            return { url: j2.results[0].url };
          }
          throw new Error('Respuesta inválida de la API de respaldo');
        }
      });
    } catch (err) {
      console.error('Error en comando snuggle:', err);
      await sock.sendMessage(jid, {
        text: cajaError('No se pudo obtener la reacción anime en este momento.')
      }, { quoted: msg });
    }
  }
};
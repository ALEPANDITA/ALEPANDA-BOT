const { getApiKey } = require('../../lib/apikeys');
const { error: cajaError, advertencia } = require('../../lib/estilo');

const categorias = [
  'waifu', 'hentai', 'neko', 'kemonomimi', 'bunny', 'maid', 'boobs', 
  'bigboobs', 'mediumboobs', 'smallboobs', 'flatchest', 'ass', 'pussy', 
  'dick', 'anal', 'masturbation', 'masturbating', 'threesome', 'kissing', 
  'bikini', 'schoolgirl', 'wet', 'yuri', 'lesbian', 'trap', 'futa'
];

module.exports = categorias.map((cat) => {
  const cmdName = `img${cat}`;
  return {
    name: cmdName,
    category: 'nsfw',
    description: `Envía una imagen NSFW de la categoría ${cat}. Uso: .${cmdName} [@usuario]`,
    execute: async (sock, jid, msg, { prefix }) => {
      try {
        const apiKey = getApiKey('evogb') || 'evogb-WPHlBOdu';
        const urlApi = `https://api.evogb.org/nsfw/rnd?type=${cat}&apikey=${apiKey}`;
        
        const response = await fetch(urlApi);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();
        
        if (!json.status || (!json.url && !json.result && !json.image)) {
          return sock.sendMessage(jid, { text: cajaError(`No se pudo obtener una imagen para la categoría ${cat}.`) });
        }

        const imageUrl = json.url || json.result || json.image;

        const sender = msg.key.participant || msg.key.remoteJid;
        const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const target = mentionedJid.length > 0 ? mentionedJid[0] : null;

        let caption = '';
        const senderTag = `@${sender.split('@')[0]}`;
        if (target) {
          const targetTag = `@${target.split('@')[0]}`;
          caption = `${senderTag} interactúa con ${targetTag} usando ${cat}.`;
        } else {
          caption = `${senderTag} disfruta de ${cat}.`;
        }

        const mentions = [sender];
        if (target) mentions.push(target);

        await sock.sendMessage(jid, {
          image: { url: imageUrl },
          caption: caption,
          mentions: mentions
        });
      } catch (err) {
        console.error(err);
        await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al procesar el comando NSFW.') });
      }
    }
  };
});
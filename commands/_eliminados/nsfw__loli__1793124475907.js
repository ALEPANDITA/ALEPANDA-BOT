const { advertencia, error: cajaError } = require('../../lib/estilo');
const { getApiKey } = require('../../lib/apikeys');

module.exports = {
  name: 'loli',
  category: 'nsfw',
  description: 'Envía una imagen NSFW aleatoria. Uso: .loli',
  execute: async (sock, jid, msg, { prefix }) => {
    // Obtener el JID del usuario que envió el mensaje para mencionarlo
    const sender = msg.key.participant || msg.key.remoteJid;

    try {
      // Obtener la API Key configurada para evogb
      const apiKey = getApiKey('evogb');
      if (!apiKey) {
        return sock.sendMessage(jid, { 
          text: cajaError('No se ha configurado la API Key de evogb. Por favor configúrala en el sistema.') 
        });
      }

      const response = await fetch(`https://api.evogb.org/nsfw/random/loli?apikey=${encodeURIComponent(apiKey)}`);
      
      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`);
      }

      const json = await response.json();

      if (!json || json.status === false) {
        throw new Error(json?.message || 'Respuesta inválida de la API');
      }

      const imageUrl = json.data?.url || json.url || json.result;

      if (!imageUrl) {
        throw new Error('No se encontró la URL de la imagen en la respuesta');
      }

      await sock.sendMessage(jid, {
        image: { url: imageUrl },
        caption: `Aquí tienes @${sender.split('@')[0]}`,
        mentions: [sender]
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo obtener la imagen NSFW: ' + err.message) });
    }
  }
};
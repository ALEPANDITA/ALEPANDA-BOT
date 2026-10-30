const { getApiKey } = require('../../lib/apikeys');
const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'imagen',
  aliases: ['genimg', 'aiimage'],
  category: 'herramientas',
  description: 'Genera una imagen a partir de un texto o prompt. Uso: .imagen <prompt>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const prompt = texto.trim().split(/\s+/).slice(1).join(' ').trim();
    
    if (!prompt) {
      return sock.sendMessage(jid, { 
        text: advertencia(`Por favor ingresa una descripción para generar la imagen.\n\nEjemplo: ${prefix}imagen un gato astronauta en el espacio`, { titulo: 'FALTA INFORMACION' }) 
      });
    }

    try {
      const apiKey = getApiKey('evogb') || 'evogb-WPHlBOdu';
      const encodedPrompt = encodeURIComponent(prompt);
      const apiUrl = `https://api.evogb.org/ai/text-to-image?key=${apiKey}&prompt=${encodedPrompt}`;

      const res = await fetch(apiUrl);
      
      if (!res.ok) {
        throw new Error(`Error en la API: ${res.statusText}`);
      }

      const contentType = res.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        const imageUrl = data.url || data.result || data.image;

        if (!imageUrl) {
          throw new Error('La API no devolvió una URL de imagen válida.');
        }

        await sock.sendMessage(jid, { 
          image: { url: imageUrl }, 
          caption: `✨ *Prompt:* ${prompt}` 
        });
      } else {
        const buffer = Buffer.from(await res.arrayBuffer());
        await sock.sendMessage(jid, { 
          image: buffer, 
          caption: `✨ *Prompt:* ${prompt}` 
        });
      }

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { 
        text: cajaError('No se pudo generar la imagen en este momento. Inténtalo más tarde.') 
      });
    }
  }
};
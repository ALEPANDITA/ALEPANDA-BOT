const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'spongebob',
  aliases: ['bob', 'espongebob'],
  category: 'fun',
  description: 'Crea un meme de Bob Esponja con el texto que le indiques. Uso: .spongebob <texto>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const input = texto.trim().split(/\s+/).slice(1).join(' ').trim();
    if (!input) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}spongebob <texto>`, { titulo: 'FALTA INFORMACION' }) });
    }
    
    try {
      const url = `https://prexzyapis.com/imagecreator/spongebob?text=${encodeURIComponent(input)}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error en la API: ${response.statusText}`);
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      
      await sock.sendMessage(jid, {
        image: buffer
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrio un error al generar la imagen: ' + err.message) });
    }
  }
};
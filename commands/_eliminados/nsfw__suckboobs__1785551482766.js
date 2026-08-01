const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'suckboobs',
  aliases: ['sb'],
  category: 'nsfw',
  description: 'Estimular los pechos con la boca y lengua. Uso: .suckboobs @usuario',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    try {
      const mention = texto.match(/@(.+)/g);
      if (!mention || mention.length !== 1) {
        return sock.sendMessage(jid, { text: advertencia('Uso: .suckboobs @usuario', { titulo: 'FALTA MENCION' }) });
      }

      const apiRes = await fetch('https://api.evogb.org/nsfw/interaction?type=suckboobs&key=evogb-WPHlBOdu');
      if (!apiRes.ok) {
        throw new Error('Error al conectar con la API.');
      }
      const data = await apiRes.json();
      
      if (!data.status || !data.result) {
        return sock.sendMessage(jid, { text: advertencia('No se pudo obtener el contenido NSFW.', { titulo: 'ERROR' }) });
      }

      const videoUrl = data.result;
      const usuario = msg.author;
      const mencionado = mention[0].slice(1);
      const caption = `@${usuario.split('@')[0]} le hace una interacción a @${mencionado} ${data.description || 'Estimular los pechos con la boca y lengua.'}`;

      // Cambio para enviar video como archivo de video en lugar de texto
      await sock.sendMessage(jid, {
        video: { url: videoUrl },
        caption: caption
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrio un error al procesar el comando: ' + err.message) });
    }
  }
};
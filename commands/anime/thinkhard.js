const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'thinkhard',
  aliases: ['pensar'],
  category: 'anime',
  description: 'Reacción de pensar profundamente. Uso: .thinkhard @usuario',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    // Intentar extraer el usuario mencionado desde las citas o menciones del mensaje
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    
    let objetivo = '';
    if (mentionedJid.length > 0) {
      objetivo = `@${mentionedJid[0].split('@')[0]}`;
    } else {
      const args = texto.trim().split(/\s+/).slice(1).join(' ').trim();
      objetivo = args ? args : '';
    }

    try {
      const apiRes = await fetch('https://api.evogb.org/sfw/interaction?type=thinkhard&key=evogb-WPHlBOdu');
      if (!apiRes.ok) throw new Error('Error al conectar con la API');
      
      const json = await apiRes.json();
      if (!json.status || !json.result) {
        throw new Error('No se pudo obtener el resultado de la API');
      }

      const videoUrl = json.result;
      
      // Obtener el emisor del comando
      const sender = msg.key.participant || msg.key.remoteJid;
      const autor = `@${sender.split('@')[0]}`;

      let mensajeTexto = `${autor} está pensando profundamente`;
      const menciones = [sender];

      if (objetivo && mentionedJid.length > 0) {
        mensajeTexto += ` en ${objetivo}`;
        menciones.push(mentionedJid[0]);
      } else if (objetivo) {
        mensajeTexto += ` sobre ${objetivo}`;
      }

      await sock.sendMessage(jid, {
        video: { url: videoUrl },
        gifPlayback: true,
        caption: mensajeTexto,
        mentions: menciones
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al procesar el comando thinkhard.') });
    }
  }
};
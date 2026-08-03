const { fetchEvogb } = require('../../lib/evogb');
const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'peek',
  aliases: ['asomarse', 'espiar'],
  category: 'anime',
  description: 'Manda una animación de reacción tipo peek (espiar/asomarse). Uso: .peek @usuario',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const args = texto.trim().split(/\s+/).slice(1);
    
    // Obtener menciones de Baileys de forma segura
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    
    let target = '';
    if (mentionedJid.length > 0) {
      target = `@${mentionedJid[0].split('@')[0]}`;
    } else if (args.length > 0) {
      target = args.join(' ');
    }

    // Obtener el remitente correctamente tanto en grupos como en chats privados
    const senderParticipant = msg.key.participant || (msg.key.fromMe ? sock.user.id : jid);
    const sender = `@${senderParticipant.split('@')[0]}`;

    try {
      const res = await fetchEvogb('https://api.evogb.org/sfw/interaction?type=peek');
      if (!res.ok) throw new Error('Error al conectar con la API');
      
      const data = await res.json();
      if (!data.status || !data.result) {
        throw new Error('Respuesta inválida de la API');
      }

      let mensajeTexto = target 
        ? `${sender} espía a ${target}` 
        : `${sender} está espiando a los alrededores.`;

      // Recopilar todas las menciones únicas para que WhatsApp pinte los @ correctamente
      const allMentions = [...new Set([...mentionedJid, senderParticipant])];

      await sock.sendMessage(jid, {
        video: { url: data.result },
        caption: mensajeTexto,
        gifPlayback: true,
        mentions: allMentions
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo procesar el comando peek: ' + err.message) });
    }
  }
};
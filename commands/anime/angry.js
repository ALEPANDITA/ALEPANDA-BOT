const { error: cajaError } = require('../../lib/estilo');

// Lista de interacciones soportadas por la API
const interacciones = [
  { name: 'angry', labelNoTarget: 'está muy enojado/a 😡', labelTarget: 'está muy enojado/a con' },
  { name: 'hug', labelNoTarget: 'quiere un abrazo 🤗', labelTarget: 'le dio un fuerte abrazo a' },
  { name: 'kiss', labelNoTarget: 'manda un beso 😘', labelTarget: 'le dio un beso a' },
  { name: 'slap', labelNoTarget: 'dio una bofetada 👋', labelTarget: 'le dio una bofetada a' },
  { name: 'pat', labelNoTarget: 'quiere mimos 🖐️', labelTarget: 'está acariciando a' },
  { name: 'bite', labelNoTarget: 'dio un mordisco 😬', labelTarget: 'mordió a' },
  { name: 'cuddle', labelNoTarget: 'se acurrucó 🫂', labelTarget: 'se acurrucó con' },
  { name: 'dance', labelNoTarget: 'se puso a bailar 💃', labelTarget: 'está bailando con' },
  { name: 'kill', labelNoTarget: 'anda con ganas de pelear 🔪', labelTarget: 'acabó con' },
  { name: 'punch', labelNoTarget: 'lanzó un puñetazo 👊', labelTarget: 'le dio un puñetazo a' }
];

module.exports = interacciones.map(item => ({
  name: item.name,
  category: 'anime',
  description: `Interacción de anime (${item.name}). Uso: .${item.name} [@usuario]`,
  execute: async (sock, jid, msg, { prefix }) => {
    try {
      // Obtener emisor
      const sender = msg.key.participant || msg.key.remoteJid;

      // Detectar si se etiquetó o respondió a alguien
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo || msg.message?.imageMessage?.contextInfo || msg.message?.videoMessage?.contextInfo;
      const mentioned = contextInfo?.mentionedJid?.[0];
      const quoted = contextInfo?.participant;
      const target = mentioned || quoted;

      let caption = '';
      const mentions = [sender];

      if (target && target !== sender) {
        mentions.push(target);
        caption = `@${sender.split('@')[0]} ${item.labelTarget} @${target.split('@')[0]}`;
      } else {
        caption = `@${sender.split('@')[0]} ${item.labelNoTarget}`;
      }

      // Llamada a la API de Evogb
      const apiUrl = `https://api.evogb.org/sfw/interaction?type=${item.name}&key=evogb-WPHlBOdu`;
      const res = await fetch(apiUrl);

      if (!res.ok) {
        throw new Error(`Estado HTTP: ${res.status}`);
      }

      const data = await res.json();

      if (!data.status || !data.result) {
        throw new Error('La API no devolvió un resultado válido.');
      }

      // Enviar el video de la interacción en bucle (animación GIF)
      await sock.sendMessage(jid, {
        video: { url: data.result },
        caption: caption,
        mentions: mentions,
        gifPlayback: true
      }, { quoted: msg });

    } catch (err) {
      console.error(`Error en comando ${item.name}:`, err);
      const textoError = typeof cajaError === 'function' 
        ? cajaError('Ocurrió un error al obtener la animación: ' + err.message)
        : 'Ocurrió un error al obtener la animación.';
      
      await sock.sendMessage(jid, { text: textoError }, { quoted: msg });
    }
  }
}));
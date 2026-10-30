const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'buscargif',
  aliases: ['klipy', 'searchgif'],
  category: 'search',
  description: 'Busca y envía un GIF/video con interacción dinámica. Uso: .buscargif <búsqueda> [@usuario]',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    // Extraer argumentos quitando el prefijo y el comando
    const args = texto.trim().split(/\s+/).slice(1);
    
    // Detectar si hay un usuario etiquetado al final o en cualquier parte de los argumentos
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    
    // Limpiar la query removiendo las menciones si están en formato de texto o filtrando palabras vacías si es necesario
    // O simplemente tomamos todo lo que no sea una mención o limpiamos el texto bruto
    let queryArgs = args.filter(arg => !arg.includes('@'));
    const query = queryArgs.join(' ').trim();

    if (!query) {
      return sock.sendMessage(jid, { 
        text: advertencia(`Uso correcto: ${prefix}buscargif <búsqueda> [@usuario]`, { titulo: 'FALTA TÉRMINO DE BÚSQUEDA' }) 
      });
    }

    try {
      const encodedQuery = encodeURIComponent(query);
      const apiUrl = `https://api.evogb.org/search/tenor?key=evogb-WPHlBOdu&query=${encodedQuery}&provider=klipy`;
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error('Error en la respuesta de la API');
      }

      const data = await response.json();
      
      if (!data || !data.status || !data.medias || data.medias.length === 0) {
        return sock.sendMessage(jid, { 
          text: cajaError(`No se encontraron GIFs para: "${query}"`) 
        });
      }

      const randomMedia = data.medias[Math.floor(Math.random() * data.medias.length)];
      const videoUrl = randomMedia?.data?.url;

      if (!videoUrl) {
        return sock.sendMessage(jid, { 
          text: cajaError('No se pudo obtener la URL del GIF.') 
        });
      }

      // Obtener el remitente del mensaje
      const sender = msg.key.participant || msg.key.remoteJid;
      const senderId = sender.split('@')[0];
      const targetId = mentionedJid.length > 0 ? mentionedJid[0].split('@')[0] : null;

      // Analizar la consulta para generar interacciones más naturales y dinámicas
      const qLower = query.toLowerCase();
      let accionPropia = `está realizando: ${query}`;
      let accionMutua = `comparte "${query}" con`;

      // Diccionario de acciones comunes para personalizar el texto
      if (qLower.includes('bailar') || qLower.includes('dance')) {
        accionPropia = 'está bailando 💃🕺';
        accionMutua = 'se pone a bailar con';
      } else if (qLower.includes('dormir') || qLower.includes('sleep') || qLower.includes('cansado')) {
        accionPropia = 'se ha quedado dormido/a 💤';
        accionMutua = 'se acurruca a dormir con';
      } else if (qLower.includes('llorar') || qLower.includes('cry')) {
        accionPropia = 'está llorando 😭';
        accionMutua = 'llora junto a';
      } else if (qLower.includes('reír') || qLower.includes('risa') || qLower.includes('laugh') || qLower.includes('rigidez')) {
        accionPropia = 'se está muriendo de risa 😆';
        accionMutua = 'se ríe a carcajadas con';
      } else if (qLower.includes('enojar') || qLower.includes('enojo') || qLower.includes('angry')) {
        accionPropia = 'está muy enojado/a 💢';
        accionMutua = 'se enoja con';
      } else if (qLower.includes('abrazar') || qLower.includes('abrazo') || qLower.includes('hug')) {
        accionPropia = 'quiere dar un abrazo 🤗';
        accionMutua = 'le da un cálido abrazo a';
      } else if (qLower.includes('besar') || qLower.includes('beso') || qLower.includes('kiss')) {
        accionPropia = 'manda un besito 😘';
        accionMutua = 'le da un tierno beso a';
      } else if (qLower.includes('golpear') || qLower.includes('pegar') || qLower.includes('slap')) {
        accionPropia = 'reacciona con golpe 👊';
        accionMutua = 'le da un golpe a';
      }

      let captionText = '';
      let mentions = [];

      if (targetId) {
        mentions = [sender, mentionedJid[0]];
        captionText = `@${senderId} ${accionMutua} @${targetId}! ✨`;
      } else {
        mentions = [sender];
        captionText = `@${senderId} ${accionPropia}`;
      }

      await sock.sendMessage(jid, {
        video: { url: videoUrl },
        gifPlayback: true,
        caption: captionText,
        mentions: mentions
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { 
        text: cajaError('Ocurrió un error al procesar la solicitud de GIFs.') 
      });
    }
  }
};
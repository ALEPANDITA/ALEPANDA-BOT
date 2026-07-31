const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'furro',
  aliases: ['furry'],
  category: 'nsfw', // Corregido de 'fun' a 'nsfw' según reporte del owner
  description: 'Envía una imagen aleatoria de la categoría furro (NSFW).',
  execute: async (sock, jid, msg, { prefix }) => {
    try {
      // Consulta a la API proporcionada
      const response = await fetch('https://api.evogb.org/nsfw/random/furro');
      
      if (!response.ok) {
        throw new Error('Error al conectar con el servidor de la API');
      }

      const json = await response.json();

      // Validación de la estructura de respuesta de la API
      if (!json.status || !json.data || !json.data.url) {
        throw new Error('La API no devolvió una estructura válida');
      }

      const imageUrl = json.data.url;
      const textoPersonalizado = 'uff ven mira lo que estás buscando espera que porque usas esto';

      // Envío de la imagen con el texto solicitado
      await sock.sendMessage(jid, {
        image: { url: imageUrl },
        caption: textoPersonalizado
      });

    } catch (err) {
      console.error(err);
      
      // Manejo estético de errores
      let mensajeError = 'Ocurrió un error al intentar obtener la imagen.';
      if (typeof cajaError === 'function') {
        mensajeError = cajaError('No se pudo cargar la imagen de furro. Inténtalo de nuevo más tarde.');
      }

      await sock.sendMessage(jid, { text: mensajeError });
    }
  }
};
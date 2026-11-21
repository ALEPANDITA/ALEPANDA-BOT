const { caja, advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'ffstalk',
  aliases: ['freefire'],
  category: 'search',
  description: 'Consulta información de un perfil de Free Fire por su ID. Uso: .ffstalk <id>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const args = texto.trim().split(/\s+/).slice(1);
    const id = args[0];

    if (!id) {
      return sock.sendMessage(jid, { 
        text: advertencia(`Uso correcto: ${prefix}ffstalk <id_de_free_fire>\nEjemplo: ${prefix}ffstalk 123456789`, { titulo: 'FALTA EL ID' }) 
      });
    }

    try {
      const response = await fetch(`https://prexzyapis.com/stalk/ffstalk?id=${encodeURIComponent(id)}`);
      const data = await response.json();

      if (!data.status) {
        const errorMsg = data.error || 'Ocurrió un error al consultar el ID.';
        return sock.sendMessage(jid, { text: cajaError(errorMsg, { titulo: 'ERROR DE API' }) });
      }

      const info = data.result || data.data || data;
      
      let textoResultado = `• *ID:* ${info.id || id}\n`;
      textoResultado += `• *Nombre:* ${info.name || info.nickname || 'No disponible'}\n`;
      textoResultado += `• *Nivel:* ${info.level || 'No disponible'}\n`;
      textoResultado += `• *Servidor:* ${info.region || info.server || 'No disponible'}\n`;

      if (info.likes) {
        textoResultado += `• *Me gusta:* ${info.likes}\n`;
      }

      await sock.sendMessage(jid, { 
        text: caja(textoResultado, { titulo: 'FREE FIRE STALK' }) 
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { 
        text: cajaError('No se pudo conectar con el servidor de Free Fire. Inténtalo más tarde.', { titulo: 'ERROR DE RED' }) 
      });
    }
  }
};
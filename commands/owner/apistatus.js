const { leerConfig } = require('../../lib/config');
const { leerKeys } = require('../../lib/apikeys');
const { esOwnerBot } = require('../../lib/permisos');

// Lista de servicios que el bot sabe usar (para mostrarlos aunque no tengan key guardada)
const SERVICIOS_CONOCIDOS = ['gemini', 'groq', 'openrouter', 'tiktok', 'mediafire', 'pinterest', 'facebook', 'instagram', 'ytmp3', 'ytmp4'];

module.exports = {
  name: 'apistatus',
  category: 'owner',
  description: 'Muestra que APIs tienen clave activa y cuales no (solo owner)',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' });
    }

    const keys = leerKeys();
    const todosLosServicios = [...new Set([...SERVICIOS_CONOCIDOS, ...Object.keys(keys)])];

    let texto = `🔑 *ESTADO DE LAS APIs*\n\n`;

    for (const servicio of todosLosServicios) {
      const clave = keys[servicio];
      const activa = clave && clave.trim().length > 0;
      const estado = activa ? '🟢 Activa' : '🔴 Inactiva';
      const vista = activa ? `(${clave.slice(0, 4)}${'*'.repeat(Math.max(clave.length - 4, 0))})` : '';
      texto += `▸ ${servicio}: ${estado} ${vista}\n`;
    }

    texto += `\nUsa \`.setapikey <servicio> <clave>\` para activar una.`;

    await sock.sendMessage(jid, { text: texto });
  }
};

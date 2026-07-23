const { leerConfig } = require('../../lib/config');
const { leerKeys } = require('../../lib/apikeys');
const { esOwnerBot } = require('../../lib/permisos');

// Lista de servicios que el bot sabe usar (para mostrarlos aunque no tengan key guardada)
const SERVICIOS_CONOCIDOS = ['gemini', 'tiktok', 'mediafire', 'pinterest', 'facebook', 'instagram', 'ytmp3', 'ytmp4'];

module.exports = {
  name: 'apistatus',
  category: 'owner',
  description: 'Muestra que APIs tienen clave(s) activa(s) y cuales no (solo owner)',
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
      const claves = keys[servicio] || [];
      const activa = claves.length > 0;
      const estado = activa ? `🟢 Activa (${claves.length} clave${claves.length > 1 ? 's' : ''})` : '🔴 Inactiva';
      texto += `▸ ${servicio}: ${estado}\n`;
      claves.forEach((clave, i) => {
        const vista = clave ? `${clave.slice(0, 4)}${'*'.repeat(Math.max(clave.length - 4, 0))}` : '';
        texto += `   ${i + 1}. ${vista}\n`;
      });
    }

    texto += `\nUsa \`.setapikey <servicio> <clave>\` para agregar una clave.\nUsa \`.delapikey <servicio> <numero>\` para quitar una clave.`;

    await sock.sendMessage(jid, { text: texto });
  }
};

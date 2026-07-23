const { leerConfig } = require('../../lib/config');
const { leerKeys } = require('../../lib/apikeys');
const { esOwnerBot } = require('../../lib/permisos');

// Servicios que necesitan SU PROPIA clave guardada para funcionar (o mejorar) de verdad
const SERVICIOS_PROPIOS = ['gemini', 'groq', 'dvyer'];

// Estos comandos de descarga en realidad usan la clave de "dvyer" por dentro,
// asi que estan activos si dvyer tiene al menos una clave guardada
const SERVICIOS_VIA_DVYER = ['facebook', 'instagram', 'ytmp3', 'ytmp4', 'play', 'ytsearch', 'spotify', 'spotifyalbum', 'mega'];

// Estos no necesitan ninguna clave para funcionar (scrapean o usan una API publica)
const SERVICIOS_SIN_CLAVE = ['tiktok', 'mediafire', 'pinterest', 'twitter', 'apk', 'webtoon', 'descargar', 'instagramv2', 'ytmp3v2', 'applemusic', 'spotifyplaylist'];

function verClave(clave) {
  return clave ? `${clave.slice(0, 4)}${'*'.repeat(Math.max(clave.length - 4, 0))}` : '';
}

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
    const clavesDvyer = keys['dvyer'] || [];
    const dvyerActivo = clavesDvyer.length > 0;

    let texto = `🔑 *ESTADO DE LAS APIs*\n\n`;

    texto += `*— Claves propias —*\n`;
    const serviciosPropios = [...new Set([...SERVICIOS_PROPIOS, ...Object.keys(keys)])].filter(s => !SERVICIOS_VIA_DVYER.includes(s) && !SERVICIOS_SIN_CLAVE.includes(s));
    for (const servicio of serviciosPropios) {
      const claves = keys[servicio] || [];
      const activa = claves.length > 0;
      const estado = activa ? `🟢 Activa (${claves.length} clave${claves.length > 1 ? 's' : ''})` : '🔴 Inactiva';
      texto += `▸ ${servicio}: ${estado}\n`;
      claves.forEach((clave, i) => {
        texto += `   ${i + 1}. ${verClave(clave)}\n`;
      });
    }

    texto += `\n*— Funcionan con la clave de dvyer —*\n`;
    for (const servicio of SERVICIOS_VIA_DVYER) {
      const estado = dvyerActivo ? '🟢 Activa (via dvyer)' : '🔴 Inactiva (dvyer no tiene clave)';
      texto += `▸ ${servicio}: ${estado}\n`;
    }

    texto += `\n*— No necesitan clave —*\n`;
    for (const servicio of SERVICIOS_SIN_CLAVE) {
      const claves = keys[servicio] || [];
      const extra = claves.length > 0 ? ` (+${claves.length} clave propia opcional)` : '';
      texto += `▸ ${servicio}: 🟢 Activa${extra}\n`;
    }

    texto += `\nUsa \`.setapikey <servicio> <clave>\` para agregar una clave.\nUsa \`.delapikey <servicio> <numero>\` para quitar una clave.`;

    await sock.sendMessage(jid, { text: texto });
  }
};

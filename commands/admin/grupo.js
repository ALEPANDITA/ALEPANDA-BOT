const { leerDB, getGrupo } = require('../../lib/db');
const { leerConfig } = require('../../lib/config');

function estado(valor) {
  return valor ? '✅ ON' : '❌ OFF';
}

module.exports = {
  name: 'grupo',
  category: 'admin',
  description: 'Muestra la configuracion actual del grupo',
  groupOnly: true,
  execute: async (sock, jid) => {
    const db = leerDB();
    const grupo = getGrupo(db, jid);
    const config = leerConfig();
    const prefixActual = grupo.prefix || config.prefix || '.';

    let texto = `🐼┈┈┈┈┈┈┈┈┈┈┈┈🐼\n`;
    texto += `   *CONFIG GRUPO*\n`;
    texto += `🐼┈┈┈┈┈┈┈┈┈┈┈┈🐼\n\n`;

    texto += `🐼 Bienvenida: ${estado(grupo.bienvenida)}\n`;
    texto += `💌 Despedida: ${estado(grupo.despedida)}\n`;
    texto += `📋 Descripcion en bienvenida: ${estado(grupo.usarDescripcion)}\n`;
    texto += `───────────────\n`;
    texto += `🔗 AntiLink: ${estado(grupo.antilink)}\n`;
    texto += `───────────────\n`;
    texto += `🔒 Modo solo-admins: ${estado(grupo.soloAdmins)}\n`;
    texto += `📈 Sistema de niveles: ${estado(grupo.niveles)}\n`;
    texto += `───────────────\n`;
    texto += `⚙️ Prefijo actual: [ ${prefixActual} ]\n`;

    const permisos = grupo.permisosCategorias || {};
    const restringidas = Object.entries(permisos).filter(([, v]) => v === 'admins');
    if (restringidas.length) {
      texto += `───────────────\n`;
      texto += `🚫 Categorias solo-admins:\n`;
      for (const [cat] of restringidas) {
        texto += `   ▸ ${cat}\n`;
      }
    }

    texto += `\n🐼 ALEPANDA BOT`;

    await sock.sendMessage(jid, { text: texto });
  }
};

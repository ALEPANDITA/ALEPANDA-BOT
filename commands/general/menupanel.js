// .menupanel -> menu en tarjetas deslizables dentro de WhatsApp.
// Comando NUEVO e independiente: el .menu de siempre no se toca.
const { leerConfig } = require('../../lib/config');
const { esComandoOwner } = require('../../lib/menuowner');
const menuMedia = require('../../lib/menumedia');
const { enviarMenuPanel } = require('../../lib/menu-panel');

// Mismo orden que el .menu normal (los de owner van solo en .menuowner)
const ordenCategorias = ['general', 'subbot', 'perfil', 'admin', 'download', 'fun', 'economia', 'casino', 'arcade', 'gacha', 'gacha-anime', 'niveles', 'anime', 'interaction', 'ia', 'tools', 'logo', 'logovideo', 'config', 'nsfw'];

module.exports = {
  name: 'menupanel',
  category: 'general',
  description: 'Menu en tarjetas deslizables dentro de WhatsApp (el .menu normal sigue igual)',
  execute: async (sock, jid, msg, { prefix, comandos }) => {
    // Mismo registro obligatorio que el .menu normal
    try {
      const { esOwnerBot } = require('../../lib/permisos');
      const { obtenerRegistro } = require('../../lib/registro');
      let metadata = null;
      if (String(jid).endsWith('@g.us')) { try { metadata = await sock.groupMetadata(jid); } catch (_) { metadata = null; } }
      if (!(await esOwnerBot(sock, leerConfig(), msg)) && !(await obtenerRegistro(sock, msg, jid, metadata))) {
        return sock.sendMessage(jid, { text: `Para usar el menu primero tienes que registrarte.\n\nEscribe: ${prefix}registrar <nombre> <edad> <hombre o mujer>` }, { quoted: msg });
      }
    } catch (err) { console.error('[menupanel] registro:', err && err.message ? err.message : err); }

    const categorias = {};
    for (const comando of comandos.values()) {
      if (esComandoOwner(comando)) continue;
      const cat = comando.category || 'general';
      if (!categorias[cat]) categorias[cat] = [];
      if (!categorias[cat].some((c) => c.name === comando.name)) categorias[cat].push(comando);
    }
    for (const cat of Object.keys(categorias)) categorias[cat].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const orden = [...ordenCategorias.filter((c) => categorias[c]), ...Object.keys(categorias).filter((c) => !ordenCategorias.includes(c))];

    try {
      await enviarMenuPanel({ sock, jid, categorias, orden, prefix, rutaImagen: menuMedia.rutaParaMenu(jid) });
    } catch (err) {
      console.error('[menupanel] no se pudo mandar el panel:', err && err.message ? err.message : err);
      await sock.sendMessage(jid, { text: `No pude mandar el menu en panel. Usa ${prefix}menu mientras tanto.` }, { quoted: msg });
    }
  }
};

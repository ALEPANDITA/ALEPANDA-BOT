const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

const TEMAS = { rosa: '🌸', azul: '💙', morado: '💜', verde: '💚', rojo: '❤️', dorado: '✨', negro: '🖤', naranja: '🧡', amarillo: '💛' };
const EMOJI = /^[\p{Extended_Pictographic}\u200d\ufe0f]{1,8}$/u;

module.exports = {
  name: 'editarperfil',
  aliases: ['setperfil'],
  category: 'perfil',
  description: 'Personaliza tu perfil: color/tema, titulo y emoji. Uso: .editarperfil tema rosa | titulo Reina del grupo | emoji 🐼',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = String(texto || '').trim().split(/\s+/).slice(1);
    const opcion = (partes[0] || '').toLowerCase();
    const valor = partes.slice(1).join(' ').trim();
    const db = leerDB();
    const usuario = getUsuario(db, remitente);
    const responder = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });

    if (opcion === 'tema' || opcion === 'color') {
      const t = valor.toLowerCase();
      if (!TEMAS[t]) return responder(`Elige un color: ${Object.keys(TEMAS).join(', ')}\nEj: ${prefix}editarperfil tema rosa`);
      usuario.perfilTema = t;
      guardarDB(db);
      return responder(`${TEMAS[t]} Tema de tu perfil cambiado a *${t}*. Míralo con ${prefix}perfil`);
    }
    if (opcion === 'titulo' || opcion === 'título') {
      if (!valor || /^(quitar|borrar)$/i.test(valor)) {
        usuario.perfilTitulo = null;
        guardarDB(db);
        return responder('🏷️ Título quitado de tu perfil.');
      }
      if (valor.length > 30) return responder('El título es muy largo (máximo 30 caracteres).');
      usuario.perfilTitulo = valor;
      guardarDB(db);
      return responder(`🏷️ Título guardado: *${valor}*. Míralo con ${prefix}perfil`);
    }
    if (opcion === 'emoji') {
      if (/^(quitar|borrar)$/i.test(valor)) {
        usuario.perfilEmoji = null;
        guardarDB(db);
        return responder('Emoji quitado de tu perfil.');
      }
      if (!EMOJI.test(valor)) return responder(`Manda un solo emoji.\nEj: ${prefix}editarperfil emoji 🐼`);
      usuario.perfilEmoji = valor;
      guardarDB(db);
      return responder(`${valor} Emoji de tu perfil guardado. Míralo con ${prefix}perfil`);
    }

    return responder(
      `🎨 *EDITAR PERFIL*\n\n` +
      `• ${prefix}editarperfil tema <color>\n   _Colores: ${Object.keys(TEMAS).join(', ')}_\n` +
      `• ${prefix}editarperfil titulo <texto>\n   _Un título debajo de tu nombre (máx. 30). "quitar" lo borra_\n` +
      `• ${prefix}editarperfil emoji <emoji>\n   _El emoji de tu encabezado_\n\n` +
      `También: ${prefix}setdesc, ${prefix}setgenre y ${prefix}setbirth.\n\n` +
      `Ahora: tema *${usuario.perfilTema || 'rosa'}*${usuario.perfilTitulo ? ` · título *${usuario.perfilTitulo}*` : ''}${usuario.perfilEmoji ? ` · emoji ${usuario.perfilEmoji}` : ''}`
    );
  }
};

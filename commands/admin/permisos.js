const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { leerConfig } = require('../../lib/config');

module.exports = {
  name: 'permisos',
  category: 'admin',
  description: 'Configura permisos por categoria (ej: .permisos casino admins)',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix, comandos }) => {
    const config = leerConfig();
    const remitente = msg.key.participant;
    const esOwner = config.owners && config.owners.includes(remitente);

    const metadata = await sock.groupMetadata(jid);
    const esAdmin = metadata.participants.find(p => p.jid === remitente || p.id === remitente || p.lid === remitente)?.admin;

    if (!esAdmin && !esOwner) {
      return sock.sendMessage(jid, { text: 'Solo un admin o un owner del bot puede usar este comando.' });
    }

    const partes = texto.slice((prefix + 'permisos').length).trim().split(/\s+/).filter(Boolean);
    const db = leerDB();
    const grupo = getGrupo(db, jid);

    const categoriasDisponibles = [...new Set([...comandos.values()].map(c => c.category || 'general'))];

    if (!partes.length || partes[0] === 'list') {
      let texto2 = `📋 *PERMISOS POR CATEGORIA*\n\n`;
      for (const cat of categoriasDisponibles) {
        const modo = grupo.permisosCategorias[cat] || 'todos';
        texto2 += `▸ ${cat}: *${modo}*\n`;
      }
      texto2 += `\nUso: ${prefix}permisos <categoria> <todos/admins>`;
      return sock.sendMessage(jid, { text: texto2 });
    }

    const categoria = partes[0]?.toLowerCase();
    const modo = partes[1]?.toLowerCase();

    if (!categoriasDisponibles.includes(categoria)) {
      return sock.sendMessage(jid, {
        text: `Categoria invalida. Disponibles: ${categoriasDisponibles.join(', ')}`
      });
    }

    if (!['todos', 'admins'].includes(modo)) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}permisos ${categoria} <todos/admins>` });
    }

    grupo.permisosCategorias[categoria] = modo;
    guardarDB(db);

    await sock.sendMessage(jid, {
      text: `Categoria *${categoria}* configurada como: *${modo}*`
    });
  }
};

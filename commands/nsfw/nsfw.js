const { leerDB, guardarDB, getGrupo } = require('../../lib/db');

module.exports = {
  name: 'nsfw',
  aliases: ['modonsfw'],
  category: 'admin',
  groupOnly: true,

  async execute(sock, jid, msg, { prefix, texto }) {
    const args = texto.trim().split(/\s+/).slice(1);
    const opcion = (args[0] || '').toLowerCase();

    const remitente = msg.key.participant || msg.key.remoteJid;
    const metadata = await sock.groupMetadata(jid);
    const participante = metadata.participants.find(p =>
      (p.id || '').split('@')[0] === remitente.split('@')[0] ||
      (p.phoneNumber || '').split('@')[0] === remitente.split('@')[0]
    );

    const esAdmin = !!participante?.admin;

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: 'Solo los admins pueden cambiar el modo NSFW.' }, { quoted: msg });
    }

    if (!['on', 'off'].includes(opcion)) {
      return sock.sendMessage(
        jid,
        { text: `Uso correcto:\n${prefix}nsfw on\n${prefix}nsfw off` },
        { quoted: msg }
      );
    }

    const db = leerDB();
    const grupo = getGrupo(db, jid);

    grupo.nsfw = opcion === 'on';
    guardarDB(db);

    await sock.sendMessage(
      jid,
      { text: `✅ El modo NSFW ahora esta *${grupo.nsfw ? 'activado' : 'desactivado'}* en este grupo.` },
      { quoted: msg }
    );
  }
};

const { resolverJidReal, conTimeout } = require('../../lib/identidad');
const { advertencia, error: cajaError } = require('../../lib/estilo');

// Manda la foto de perfil de alguien: menciona a la persona, responde a su mensaje, o sin nada trae la tuya.
module.exports = {
  name: 'pfp',
  aliases: ['getpfp', 'foto', 'avatar'],
  category: 'perfil',
  description: 'Manda la foto de perfil de alguien (mencionalo o responde a su mensaje). Sin nadie, manda la tuya',
  execute: async (sock, jid, msg) => {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const objetivo = ctx?.mentionedJid?.[0] || ctx?.participant || msg.key.participant || msg.key.remoteJid;

    const pedir = (id) => conTimeout(sock.profilePictureUrl(id, 'image').catch(() => null), 8000, null);

    let url = await pedir(objetivo);
    if (!url && jid.endsWith('@g.us') && !objetivo.endsWith('@s.whatsapp.net')) {
      // Con @lid a veces no hay foto; se reintenta con el numero real
      try {
        const metadata = await conTimeout(sock.groupMetadata(jid), 5000, null);
        const real = await resolverJidReal(sock, objetivo, metadata);
        if (real && real !== objetivo) url = await pedir(real);
      } catch (_) { /* sin respaldo */ }
    }

    if (!url) {
      return sock.sendMessage(jid, {
        text: cajaError('No pude traer la foto de perfil. Puede que no tenga foto o que la tenga oculta.', { titulo: 'SIN FOTO' })
      }, { quoted: msg });
    }

    try {
      await sock.sendMessage(jid, { image: { url }, caption: `🖼️ Foto de perfil de @${objetivo.split('@')[0]}`, mentions: [objetivo] }, { quoted: msg });
    } catch (err) {
      console.error('[pfp]', err.message);
      await sock.sendMessage(jid, { text: advertencia('No pude mandar la foto, intenta de nuevo.') }, { quoted: msg });
    }
  }
};

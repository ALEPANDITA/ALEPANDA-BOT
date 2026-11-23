const { REGALOS, dinero } = require('../../lib/tiendaperfil');
const { nivelDe } = require('../../lib/regalosdata');

const TITULOS = {
  chico: '🌸 DETALLITOS',
  medio: '💖 ROMANTICOS',
  grande: '🎉 DE LUJO',
  legendario: '🎆 LEGENDARIOS'
};

module.exports = {
  name: 'regalos',
  aliases: ['listaregalos'],
  category: 'economia',
  description: 'Lista de regalos que puedes mandarle a tu pareja (de $1,000 a $100,000,000)',
  execute: async (sock, jid, msg, { prefix }) => {
    const grupos = {};
    REGALOS.forEach((r, i) => {
      const nivel = nivelDe(r.precio);
      (grupos[nivel] = grupos[nivel] || []).push(`*${i + 1}.* ${r.emoji} ${r.nombre} — ${dinero(r.precio)}`);
    });

    const partes = ['🎁 *REGALOS PARA TU PAREJA* 🎁', ''];
    for (const nivel of ['chico', 'medio', 'grande', 'legendario']) {
      if (!grupos[nivel]) continue;
      partes.push(`*${TITULOS[nivel]}*`, ...grupos[nivel], '');
    }
    partes.push(`Para mandar uno: *${prefix}regalar <numero o nombre>*`);
    partes.push(`Ej: ${prefix}regalar 5   o   ${prefix}regalar rosa`);
    partes.push('Se cobra de tu dinero en mano y el bot etiqueta a tu pareja.');

    await sock.sendMessage(jid, { text: partes.join('\n') }, { quoted: msg });
  }
};

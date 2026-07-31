const { leerRegistro, reiniciarProcesoSubbot } = require('../../lib/subbots');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');

module.exports = {
  name: 'restartsubbots',
  aliases: ['reiniciarsubbots'],
  category: 'owner',
  description: 'Reinicia todos los subbots activos (util despues de actualizar comandos/librerias del bot principal). No borra sus sesiones, solo relanza el proceso.',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);
    if (!autorizado) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' }, { quoted: msg });
    }

    const registro = leerRegistro();
    const subbots = Object.entries(registro.subbots);

    if (subbots.length === 0) {
      return sock.sendMessage(jid, { text: 'No hay subbots registrados para reiniciar.' }, { quoted: msg });
    }

    await sock.sendMessage(jid, {
      text: `🔄 Reiniciando ${subbots.length} subbot(s)...`
    }, { quoted: msg });

    let exitosos = 0;
    let fallidos = [];

    for (const [id, info] of subbots) {
      const resultado = await reiniciarProcesoSubbot(info.nombreProceso);
      if (resultado.ok) {
        exitosos++;
      } else {
        fallidos.push(`${id} (${info.nombreProceso})`);
      }
    }

    let texto = `✅ ${exitosos} subbot(s) reiniciado(s) correctamente.`;
    if (fallidos.length > 0) {
      texto += `\n\n❌ Fallaron ${fallidos.length}:\n${fallidos.join('\n')}`;
    }

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  }
};

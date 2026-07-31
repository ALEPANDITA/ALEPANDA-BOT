const { correrSpeedtest } = require('../../lib/speedtestlib');
const { generarTarjetaSpeedtest } = require('../../lib/tarjetavelocidad');
const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'speedtest',
  category: 'general',
  description: 'Mide la velocidad de internet del servidor donde corre el bot (descarga, subida, ping y jitter).',
  execute: async (sock, jid, msg) => {
    await sock.sendMessage(jid, {
      text: '🐼 Poniendo a prueba las garras de la conexion... esto tarda unos segundos.'
    }, { quoted: msg });

    try {
      const resultado = await correrSpeedtest();
      const buffer = await generarTarjetaSpeedtest(resultado);

      await sock.sendMessage(jid, {
        image: buffer,
        caption: `✦ *REPORTE DE VELOCIDAD* ✦\n\n` +
          `⬇️ Descarga: *${resultado.descarga} Mbps*\n` +
          `⬆️ Subida: *${resultado.subida} Mbps*\n` +
          `📡 Ping: *${resultado.ping} ms*\n` +
          `📶 Jitter: *${resultado.jitter} ms*`
      }, { quoted: msg });
    } catch (err) {
      console.error('[speedtest] Error:', err);
      await sock.sendMessage(jid, {
        text: cajaError('No se pudo completar la prueba de velocidad. Intenta de nuevo en un momento.')
      }, { quoted: msg });
    }
  }
};

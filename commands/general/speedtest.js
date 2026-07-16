module.exports = {
  name: 'speedtest',
  category: 'general',
  description: 'Prueba aproximada de velocidad de descarga del servidor',
  execute: async (sock, jid, msg) => {
    await sock.sendMessage(jid, { text: '📶 Probando velocidad, espera unos segundos...' });

    const urlArchivo = 'https://speed.hetzner.de/1MB.bin';

    try {
      const inicio = Date.now();
      const res = await fetch(urlArchivo);
      const buffer = await res.arrayBuffer();
      const duracionSeg = (Date.now() - inicio) / 1000;

      const bytes = buffer.byteLength;
      const mbps = ((bytes * 8) / duracionSeg / 1_000_000).toFixed(2);
      const mbDescargados = (bytes / 1_000_000).toFixed(2);

      await sock.sendMessage(jid, {
        text: `📶 *SPEEDTEST (aproximado)*\n\n` +
          `Archivo de prueba: ${mbDescargados} MB\n` +
          `Tiempo: ${duracionSeg.toFixed(2)}s\n` +
          `Velocidad estimada: ${mbps} Mbps\n\n` +
          `Nota: esto mide la conexion del servidor donde corre el bot, no la tuya.`
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'No se pudo completar la prueba de velocidad.' });
    }
  }
};

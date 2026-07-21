const SERVIDORES = [
  { nombre: 'Hetzner (Alemania)', url: 'https://speed.hetzner.de/1MB.bin' },
  { nombre: 'Cloudflare', url: 'https://speed.cloudflare.com/__down?bytes=5000000' },
  { nombre: 'Hetzner (respaldo 10MB)', url: 'https://speed.hetzner.de/10MB.bin' }
];

async function probarServidor(servidor, timeoutMs = 12000) {
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), timeoutMs);

  try {
    const inicio = Date.now();
    const res = await fetch(servidor.url, {
      signal: controlador.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AlepandaBot/1.0)' }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buffer = await res.arrayBuffer();
    const duracionSeg = (Date.now() - inicio) / 1000;
    const bytes = buffer.byteLength;

    if (bytes === 0) throw new Error('Archivo vacio recibido');

    const mbps = ((bytes * 8) / duracionSeg / 1_000_000).toFixed(2);
    const mbDescargados = (bytes / 1_000_000).toFixed(2);

    return { exito: true, servidor: servidor.nombre, mbDescargados, duracionSeg, mbps };
  } catch (err) {
    return { exito: false, servidor: servidor.nombre, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  name: 'speedtest',
  category: 'general',
  description: 'Prueba aproximada de velocidad de descarga del servidor',
  execute: async (sock, jid, msg) => {
    await sock.sendMessage(jid, { text: '📶 Probando velocidad, espera unos segundos...' });

    for (const servidor of SERVIDORES) {
      const resultado = await probarServidor(servidor);

      if (resultado.exito) {
        return sock.sendMessage(jid, {
          text: `📶 *SPEEDTEST (aproximado)*\n\n` +
            `Servidor: ${resultado.servidor}\n` +
            `Archivo de prueba: ${resultado.mbDescargados} MB\n` +
            `Tiempo: ${resultado.duracionSeg.toFixed(2)}s\n` +
            `Velocidad estimada: ${resultado.mbps} Mbps\n\n` +
            `Nota: esto mide la conexion del servidor donde corre el bot, no la tuya.`
        });
      }

      console.error(`[speedtest] fallo con ${servidor.nombre}: ${resultado.error}`);
    }

    await sock.sendMessage(jid, { text: 'No se pudo completar la prueba de velocidad (todos los servidores fallaron). Revisa la conexion del servidor.' });
  }
};

const { caja, error: cajaError } = require('../../lib/estilo');

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
    for (const servidor of SERVIDORES) {
      const resultado = await probarServidor(servidor);

      if (resultado.exito) {
        const texto = caja([
          `📡 Servidor: ${resultado.servidor}`,
          `📦 Archivo de prueba: ${resultado.mbDescargados} MB`,
          `⏱️ Tiempo: ${resultado.duracionSeg.toFixed(2)}s`,
          `🚀 Velocidad estimada: ${resultado.mbps} Mbps`
        ], {
          titulo: 'SPEEDTEST',
          pie: 'Mide la conexion del servidor, no la tuya',
          estilo: 'neon'
        });

        return sock.sendMessage(jid, { text: texto });
      }

      console.error(`[speedtest] fallo con ${servidor.nombre}: ${resultado.error}`);
    }

    await sock.sendMessage(jid, {
      text: cajaError('No se pudo completar la prueba de velocidad (todos los servidores fallaron).')
    });
  }
};

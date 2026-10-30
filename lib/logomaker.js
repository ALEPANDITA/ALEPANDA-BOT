// Generador de logos con texto (efectos de ephoto360) a traves de la API de delirius.
// Uso: const buffer = await generarLogo('Panda', 'https://en.ephoto360.com/....html');

const API = 'https://api.delirius.online/tools/ephoto';

async function descargar(url, ms = 20000) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    signal: AbortSignal.timeout(ms)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar el logo`);
  return Buffer.from(await res.arrayBuffer());
}

async function generarLogo(texto, efectoUrl) {
  const endpoint = `${API}?effect=${encodeURIComponent(efectoUrl)}&text=${encodeURIComponent(texto)}`;
  const res = await fetch(endpoint, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept': 'application/json'
    },
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`La API de logos respondio HTTP ${res.status}`);

  const data = await res.json().catch(() => null);
  const imagen = data?.data?.image || data?.data?.url || data?.image || data?.url;
  if (!data?.status || typeof imagen !== 'string' || !/^https?:\/\//i.test(imagen)) {
    throw new Error('No se pudo generar el logo con ese texto');
  }
  return descargar(imagen);
}

module.exports = { generarLogo };

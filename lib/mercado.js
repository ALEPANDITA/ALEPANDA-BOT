// Utilidades compartidas por las subastas y ventas del gacha anime (lib/mercadoanime.js)
function generarId(prefijo) {
  return `${prefijo}${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;
}

function formatoTiempo(ms) {
  if (ms <= 0) return '0s';
  const totalSeg = Math.ceil(ms / 1000);
  const min = Math.floor(totalSeg / 60);
  const seg = totalSeg % 60;
  return min > 0 ? `${min}m ${seg}s` : `${seg}s`;
}

module.exports = { generarId, formatoTiempo };

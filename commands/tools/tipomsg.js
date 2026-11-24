// Herramienta de diagnóstico: responde a cualquier mensaje con .tipomsg y te dice de qué tipo es (sin datos privados).
const OCULTAR = new Set(['url', 'directPath', 'mediaKey', 'fileSha256', 'fileEncSha256', 'jpegThumbnail', 'thumbnailDirectPath', 'thumbnailSha256', 'thumbnailEncSha256', 'waveform', 'streamingSidecar', 'scansSidecar', 'midQualityFileSha256', 'mediaKeyTimestamp', 'contextInfo', 'firstScanSidecar', 'scanLengths']);

function limpiar(valor, nivel = 0) {
  if (valor === null || valor === undefined) return valor;
  if (valor instanceof Uint8Array || (valor && valor.type === 'Buffer')) return '<datos>';
  if (typeof valor === 'string') return valor.length > 60 ? valor.slice(0, 60) + '…' : valor;
  if (typeof valor !== 'object') return valor;
  if (nivel > 4) return '…';
  if (Array.isArray(valor)) return valor.slice(0, 5).map((x) => limpiar(x, nivel + 1));
  const salida = {};
  for (const k of Object.keys(valor)) {
    if (OCULTAR.has(k)) continue;
    const v = limpiar(valor[k], nivel + 1);
    if (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) continue;
    salida[k] = v;
  }
  return salida;
}

// Quita envolturas (reenviado, efímero, ver una vez) para llegar al mensaje real
function desenvolver(m) {
  let actual = m;
  const capas = [];
  for (let i = 0; i < 6 && actual; i++) {
    const k = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage', 'editedMessage'].find((x) => actual[x]);
    if (!k) break;
    capas.push(k);
    actual = actual[k].message || actual[k];
  }
  return { actual, capas };
}

module.exports = {
  name: 'tipomsg',
  aliases: ['tipo', 'infomsg'],
  category: 'tools',
  description: 'Diagnóstico: responde a un mensaje con .tipomsg para ver de qué tipo es (sticker, video, audio, etc.)',
  execute: async (sock, jid, msg) => {
    const citado = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!citado) return sock.sendMessage(jid, { text: 'Responde con *.tipomsg* al mensaje que quieres analizar.' }, { quoted: msg });
    const { actual, capas } = desenvolver(citado);
    const tipos = Object.keys(actual || {}).filter((k) => k !== 'messageContextInfo');
    const datos = {};
    for (const t of tipos) datos[t] = limpiar(actual[t]);
    let texto = `🔎 *Tipo de mensaje*\n\n▸ Tipos: ${tipos.join(', ') || 'desconocido'}\n▸ Envolturas: ${capas.join(', ') || 'ninguna'}\n\n${JSON.stringify(datos, null, 1)}`;
    if (texto.length > 3500) texto = texto.slice(0, 3500) + '\n…';
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  }
};

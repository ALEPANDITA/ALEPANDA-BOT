const path = require('path');

const CENTRO_X = (630 + 985) / 2;
const DESPLAZAMIENTO_Y = 10; // si los numeros siguen viendose desalineados, ajusta este valor

const CAJAS = [
  { clave: 'latencia', y1: 505, y2: 590 },
  { clave: 'uptime', y1: 700, y2: 785 },
  { clave: 'rambot', y1: 897, y2: 982 },
  { clave: 'heap', y1: 1094, y2: 1179 }
];

// Jimp no trae una version "bold" de sus fuentes, asi que simulamos negrita
// dibujando el mismo texto varias veces con micro-desplazamientos de 1px
// alrededor del centro. Esto engorda el trazo sin cambiar el tamano de letra.
function imprimirGrueso(imagen, fuente, x, y, texto) {
  const offsets = [
    [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [-1, -1], [1, -1], [-1, 1]
  ];
  for (const [dx, dy] of offsets) {
    imagen.print(fuente, x + dx, y + dy, texto);
  }
}

function formatearUptime(segundos) {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function obtenerTimestampMs(msg) {
  const ts = msg.messageTimestamp;
  const segundos = typeof ts === 'object' && ts !== null
    ? Number(ts.low ?? (ts.toNumber ? ts.toNumber() : ts))
    : Number(ts);
  return segundos * 1000;
}

module.exports = {
  name: 'ping',
  category: 'general',
  description: 'Muestra la latencia y el estado del bot con una tarjeta visual',
  execute: async (sock, jid, msg) => {
    const latenciaMs = Date.now() - obtenerTimestampMs(msg);

    const mem = process.memoryUsage();
    const valores = {
      latencia: `${latenciaMs}ms`,
      uptime: formatearUptime(process.uptime()),
      rambot: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`,
      heap: `${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`
    };

    try {
      const Jimp = require('jimp');
      const imagen = await Jimp.read(path.join(__dirname, '..', '..', 'assets', 'pingcard.png'));
      const fuenteGrande = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
      const fuenteChica = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
      const ANCHO_MAXIMO = 325;

      for (const caja of CAJAS) {
        const texto = valores[caja.clave];

        let fuente = fuenteGrande;
        let anchoTexto = Jimp.measureText(fuente, texto);

        if (anchoTexto > ANCHO_MAXIMO) {
          fuente = fuenteChica;
          anchoTexto = Jimp.measureText(fuente, texto);
        }

        const altoTexto = Jimp.measureTextHeight(fuente, texto, anchoTexto);
        const cy = (caja.y1 + caja.y2) / 2;
        imprimirGrueso(imagen, fuente, CENTRO_X - anchoTexto / 2, cy - altoTexto / 2 + DESPLAZAMIENTO_Y, texto);
      }

      const buffer = await imagen.getBufferAsync(Jimp.MIME_PNG);
      await sock.sendMessage(jid, { image: buffer, caption: '🏓 *Pong!*' }, { quoted: msg });
    } catch (err) {
      console.error('Error generando la tarjeta de ping:', err);
      await sock.sendMessage(jid, {
        text: `🏓 Pong!\nLatencia: ${valores.latencia}\nUptime: ${valores.uptime}\nRAM bot: ${valores.rambot}\nHeap usado: ${valores.heap}`
      }, { quoted: msg });
    }
  }
};

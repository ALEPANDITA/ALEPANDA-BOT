// Animaciones de TEXTO para el casino: se manda un mensaje y se va EDITANDO cuadro por cuadro.
// No usa gifs, videos ni canvas, asi que es instantaneo y no gasta CPU del VPS.
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const aleatorio = (n) => Math.floor(Math.random() * n);
const elegir = (lista) => lista[aleatorio(lista.length)];

function mezclar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) { const j = aleatorio(i + 1); [copia[i], copia[j]] = [copia[j], copia[i]]; }
  return copia;
}

// tabla = [{ peso, ...datos }]  ->  devuelve un elemento al azar segun su peso
function sorteo(tabla) {
  const total = tabla.reduce((s, x) => s + x.peso, 0);
  let r = Math.random() * total;
  for (const x of tabla) { r -= x.peso; if (r < 0) return x; }
  return tabla[tabla.length - 1];
}

const marco = (titulo, lineas) => ['╔════════════════════╗', `   ${titulo}`, '╚════════════════════╝', '', ...lineas].join('\n');

// Un jugador solo puede tener una animacion a la vez (evita spam y apuestas encimadas)
const jugando = new Set();
const ocupar = (id) => { if (jugando.has(id)) return false; jugando.add(id); return true; };
const liberar = (id) => { jugando.delete(id); };

// cuadros: lista de textos (o { texto, ms } para una pausa distinta). Manda el primero y edita el mismo mensaje con
// los demas. Si WhatsApp no deja editar, manda directamente el ultimo cuadro (el resultado) para no perder la jugada.
async function reproducir(sock, jid, cuadros, { quoted, pausaMs = 1000, mentions } = {}) {
  const cuadro = (c) => (typeof c === 'string' ? { texto: c, ms: pausaMs } : { ms: pausaMs, ...c });
  const lista = cuadros.map(cuadro);
  const primero = await sock.sendMessage(jid, { text: lista[0].texto, mentions }, quoted ? { quoted } : undefined);
  let clave = primero.key;
  for (let i = 1; i < lista.length; i++) {
    await espera(lista[i - 1].ms);
    try {
      await sock.sendMessage(jid, { text: lista[i].texto, edit: clave, mentions });
    } catch (_) {
      const ultimo = await sock.sendMessage(jid, { text: lista[lista.length - 1].texto, mentions });
      return ultimo.key;
    }
  }
  return clave;
}

module.exports = { reproducir, marco, ocupar, liberar, sorteo, mezclar, elegir, aleatorio, espera };

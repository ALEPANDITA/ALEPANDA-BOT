// Proceso hijo del analizador: lee un JSON por stdin y escribe el resultado en JSON por stdout.
// Corre aparte (sin variables de entorno) porque el HTML a analizar puede venir de cualquier lado.
'use strict';

const { analizar, generarBoleto } = require('./arcade-analizar');

const trozos = [];
let total = 0;
process.stdin.on('data', (d) => {
  total += d.length;
  if (total > 5 * 1024 * 1024) { process.stderr.write('demasiado grande'); process.exit(2); }
  trozos.push(d);
});
process.stdin.on('end', () => {
  try {
    const p = JSON.parse(Buffer.concat(trozos).toString('utf8'));
    const r = p.accion === 'boleto'
      ? generarBoleto(String(p.html || ''), { card: String(p.card), secreto: String(p.secreto), valores: p.valores || {} })
      : analizar(String(p.html || ''));
    process.stdout.write(JSON.stringify(r));
  } catch (err) {
    process.stderr.write(String((err && err.stack) || err));
    process.exit(1);
  }
});

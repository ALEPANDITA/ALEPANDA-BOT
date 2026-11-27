// .infinito [tiempo]  -> (solo owner) da o quita el BANCO infinito.
//   .infinito 30m @alguien   -> 30 minutos de banco infinito (m = minutos, h = horas, d = dias)
//   .infinito 2h             -> a ti mismo, 2 horas
//   .infinito @alguien       -> sin tiempo = infinito hasta que lo quites
// Si ya lo tenia, se lo quita (banco en 0). Con infinito el BANCO nunca se mueve: puede retirar cuanto quiera
// y el banco sigue igual. El dinero en mano es normal (y se puede robar). Al acabarse el tiempo, el banco vuelve a $0.
const { leerConfig } = require('../../lib/config');
const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { esOwnerBot } = require('../../lib/permisos');
const { llavePersona, llaveRemitente, objetivoDe } = require('../../lib/economiaid');
const { exito, advertencia } = require('../../lib/estilo');

const UNIDAD = { s: 1e3, seg: 1e3, m: 6e4, min: 6e4, h: 36e5, hr: 36e5, hora: 36e5, horas: 36e5, d: 864e5, dia: 864e5, dias: 864e5, 'día': 864e5, 'días': 864e5 };
const MAX_MS = 365 * 864e5;

// "30m", "2h", "1d", "30 minutos", "1h30m" -> milisegundos (0 si no hay tiempo)
function leerTiempo(texto) {
  const limpio = String(texto || '').toLowerCase().replace(/@\d+/g, ' ').replace(/\b\d{8,}\b/g, ' ');
  let total = 0;
  const re = /(\d+(?:[.,]\d+)?)\s*(segundos?|seg|s|minutos?|min|m|horas?|hrs?|h|d[ií]as?|d)\b/g;
  let m;
  while ((m = re.exec(limpio))) {
    const u = m[2].replace(/(os|as|s)$/, (x) => (m[2] === 's' || m[2] === 'seg' ? x : '')).replace(/^d[ií]a$/, 'dia');
    const clave = UNIDAD[m[2]] ? m[2] : (UNIDAD[u] ? u : m[2][0]);
    total += parseFloat(m[1].replace(',', '.')) * (UNIDAD[clave] || 0);
  }
  return Math.min(Math.round(total), MAX_MS);
}

function textoTiempo(ms) {
  const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.round(ms % 6e4 / 1e3);
  const p = [];
  if (d) p.push(`${d} d`); if (h) p.push(`${h} h`); if (m) p.push(`${m} min`); if (!p.length || (s && !d && !h && !m)) p.push(`${s} s`);
  return p.join(' ');
}

module.exports = {
  name: 'infinito',
  aliases: ['infinite', 'dineroinfinito'],
  category: 'owner',
  description: 'Dar o quitar banco infinito, con tiempo opcional: .infinito 30m @persona (solo owner)',
  _leerTiempo: leerTiempo,
  execute: async (sock, jid, msg, { texto }) => {
    const config = leerConfig();
    if (!(await esOwnerBot(sock, config, msg))) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }
    const db = leerDB();
    const objetivo = objetivoDe(msg, texto);
    const clave = objetivo ? await llavePersona(sock, jid, db, objetivo) : await llaveRemitente(sock, jid, db, msg);
    const u = getUsuario(db, clave);
    const ms = leerTiempo(texto);

    let aviso;
    if (u.infinito && !ms) {
      // Sin tiempo y ya lo tenia: se lo quito
      delete u.banco; delete u.infinito; delete u.infinitoHasta;
      const antes = Number(u.bancoAntes) || 0; delete u.bancoAntes; // GUARDA-BANCO
      const nuevo = getUsuario(db, clave);
      nuevo.banco = antes;
      aviso = exito(`Le quité el banco infinito. Su banco volvió a *$${antes.toLocaleString('es-MX')}* (lo que tenía antes). Su dinero en mano no se tocó.`, { titulo: 'INFINITO QUITADO', estilo: 'neon' });
    } else {
      // Dar (o poner/renovar el tiempo si ya lo tenia)
      if (!u.infinito) u.bancoAntes = Number(u.banco) || 0; // GUARDA-BANCO: lo que tenia en el banco antes
      u.infinito = true;
      if (ms) u.infinitoHasta = Date.now() + ms; else delete u.infinitoHasta;
      getUsuario(db, clave); // activa el banco fijo
      const cuanto = ms ? `Durará *${textoTiempo(ms)}*; después su banco vuelve a lo que tenía antes.` : 'Sin tiempo: dura hasta que se lo quites con .infinito.';
      aviso = exito(`Banco infinito activado ♾️\n${cuanto}\nSu banco nunca baja: puede retirar y comprar lo que quiera. El dinero en mano es normal (se puede robar).\nEn su perfil el banco sale ∞.`, { titulo: 'BANCO INFINITO', estilo: 'neon' });
    }
    guardarDB(db);
    await sock.sendMessage(jid, { text: aviso });
  }
};

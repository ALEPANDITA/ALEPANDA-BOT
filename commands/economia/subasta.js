const N = require('../../lib/eco-negocios');
const S = require('../../lib/eco-subasta');
const A = require('../../lib/eco-subasta-aviso');
const { leerDB, guardarDB } = require('../../lib/db');

module.exports = {
  name: 'subasta',
  aliases: ['subastas', 'auction', 'remate'],
  category: 'economia',
  description: 'Subastas de propiedades exclusivas 👑: mira la actual, inicia una o ve quién tiene cada exclusiva',
  execute: async (sock, jid, msg, { prefix = '.', texto = '' } = {}) => {
    const sub = N.sinAcentos(String(texto).trim().split(/\s+/)[1]);
    const db = leerDB();
    const res = S.resolver(db);
    if (res) guardarDB(db);
    const enviar = (lineas, menciones = [], titulo) => sock.sendMessage(jid, { text: A.cuadro(lineas, titulo), mentions: menciones }, { quoted: msg });
    if (res && res.n) await sock.sendMessage(jid, { text: A.textoResultado(res), mentions: res.ganadorJid ? [res.ganadorJid] : [] }, { quoted: msg });

    if (['lista', 'exclusivas', 'duenos', 'dueños'].includes(sub)) {
      const lineas = ['*Propiedades exclusivas* 👑', ''];
      const menciones = [];
      for (const n of N.NEGOCIOS.filter((x) => x.tipo === 'exclusiva')) {
        const dueño = (db.propiedadesUnicas || {})[n.id];
        const nivel = dueño && db.usuarios[dueño] ? N.nivelDe(db.usuarios[dueño], n.id) : 0;
        if (dueño) { menciones.push(dueño); }
        lineas.push(`${n.emoji} *${n.etapas[nivel].nombre}* — ${dueño ? `🔒 ${A.tag(dueño)} (nivel ${nivel}/${n.maxNivel})` : `libre · desde ${A.dinero(n.salida)}`}`);
      }
      return enviar(lineas, menciones);
    }

    if (['iniciar', 'nueva', 'empezar', 'start'].includes(sub)) {
      if (!String(jid).endsWith('@g.us')) return enviar(['Inicia las subastas en un grupo para que otros puedan pujar.']);
      const r = S.iniciar(db, jid);
      if (r.error === 'activa') return enviar(A.textoActiva(r.activa, prefix));
      if (r.error === 'espera') return enviar([`⏳ La siguiente subasta se puede iniciar en *${A.quedan(r.espera)}*.`]);
      if (r.error === 'agotadas') return enviar(['Ya todas las propiedades exclusivas tienen dueño 👑', '', `Míralos con *${prefix}subasta lista*`]);
      guardarDB(db);
      A.programar(sock);
      return enviar(['📣 *¡Comienza una subasta!*', '', ...A.textoActiva(r.activa, prefix)]);
    }

    const a = db.subasta && db.subasta.activa;
    if (a) return enviar(A.textoActiva(a, prefix), a.ganadorJid ? [a.ganadorJid] : []);
    const espera = ((db.subasta && db.subasta.ultimaFin) || 0) + S.ENFRIAMIENTO - Date.now();
    const libres = S.disponibles(db).length;
    return enviar([
      'No hay ninguna subasta ahora mismo.', '',
      `👑 Exclusivas libres: *${libres}* de ${N.NEGOCIOS.filter((n) => n.tipo === 'exclusiva').length}`,
      espera > 0 ? `⏳ Se podrá iniciar otra en ${A.quedan(espera)}` : `▸ Inicia una con *${prefix}subasta iniciar*`,
      `▸ Ver quién tiene cada exclusiva: *${prefix}subasta lista*`
    ]);
  }
};

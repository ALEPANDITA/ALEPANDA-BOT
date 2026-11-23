const N = require('./eco-negocios');
const S = require('./eco-subasta');
const { leerDB, guardarDB } = require('./db');
const { caja, porCategoria } = require('./estilo');

const dinero = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const tag = (jid) => `@${String(jid || '').split('@')[0].split(':')[0]}`;
const quedan = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : m ? `${m} min ${s % 60} s` : `${s} s`;
};
const cuadro = (lineas, titulo = 'SUBASTA') => caja(lineas, { titulo, estilo: porCategoria('economia') });

function textoActiva(a, prefix, ahora = Date.now()) {
  const n = N.POR_ID[a.id];
  const minima = S.minimaPuja(a, n);
  const ultimaEtapa = n.etapas[n.maxNivel];
  return [
    '🔨 *SUBASTA DE PROPIEDAD EXCLUSIVA* 👑', '',
    `${n.emoji} *${n.nombre}*`,
    `📈 Gana ${dinero(n.hora)}/h y se mejora hasta *${ultimaEtapa.nombre}* (${dinero(ultimaEtapa.hora)}/h)`,
    '🔒 Solo una persona en todo el bot puede tenerla', '',
    a.pujas ? `💰 Puja más alta: *${dinero(a.puja)}* de ${tag(a.ganadorJid)} (${a.pujas} puja${a.pujas === 1 ? '' : 's'})` : `💰 Sin pujas. Arranca en *${dinero(n.salida)}*`,
    `⏳ Termina en *${quedan(a.fin - ahora)}*`, '',
    `▸ Puja: *${prefix}pujar ${minima}*  (mínimo ${dinero(minima)})`,
    `▸ O solo *${prefix}pujar min*`,
    '💡 Tu dinero se aparta al pujar y se te devuelve si te superan.'
  ];
}

function textoResultado(r) {
  if (r.sinPujas) return cuadro(['⏰ La subasta terminó', '', `${r.n.emoji} *${r.n.nombre}*`, 'Nadie pujó, así que la propiedad sigue libre para otra subasta.']);
  return cuadro([
    '🔨 ¡VENDIDA!', '',
    `${r.n.emoji} *${r.n.nombre}*`,
    `👑 Nuevo dueño: ${tag(r.ganadorJid)}`,
    `💰 Pagó: *${dinero(r.puja)}* (${r.pujas} puja${r.pujas === 1 ? '' : 's'})`, '',
    '¡Ya es suya! Puede mejorarla con *.negocio mejorar*'
  ]);
}

let temporizador = null;
function programar(sock) {
  if (temporizador) { clearTimeout(temporizador); temporizador = null; }
  const db = leerDB();
  const a = db.subasta && db.subasta.activa;
  if (!a) return;
  const jid = a.jid;
  const espera = Math.min(Math.max(0, a.fin - Date.now()) + 800, 2 ** 31 - 1);
  temporizador = setTimeout(async () => {
    temporizador = null;
    try {
      const d = leerDB();
      const r = S.resolver(d);
      if (!r) return programar(sock);
      guardarDB(d);
      await sock.sendMessage(jid, { text: textoResultado(r), mentions: r.ganadorJid ? [r.ganadorJid] : [] });
    } catch (e) { console.error('[subasta] aviso de cierre:', e && e.message ? e.message : e); }
  }, espera);
  if (temporizador.unref) temporizador.unref();
}

module.exports = { textoActiva, textoResultado, programar, cuadro, dinero, tag, quedan };

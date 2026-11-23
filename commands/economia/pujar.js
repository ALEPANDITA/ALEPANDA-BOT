const N = require('../../lib/eco-negocios');
const S = require('../../lib/eco-subasta');
const A = require('../../lib/eco-subasta-aviso');
const { leerDB, guardarDB, getUsuario, claveCanonica } = require('../../lib/db');

module.exports = {
  name: 'pujar',
  aliases: ['puja', 'bid', 'ofertar'],
  category: 'economia',
  description: 'Puja en la subasta de propiedad exclusiva (ej: .pujar 5000000, .pujar min)',
  execute: async (sock, jid, msg, { prefix = '.', texto = '' } = {}) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const palabra = N.sinAcentos(String(texto).trim().split(/\s+/)[1]).replace(/[,$]/g, '');
    const enviar = (lineas, menciones = []) => sock.sendMessage(jid, { text: A.cuadro(lineas), mentions: menciones }, { quoted: msg });

    const db = leerDB();
    const fin = S.resolver(db);
    const a0 = db.subasta && db.subasta.activa;
    if (!a0) {
      if (fin) { guardarDB(db); await sock.sendMessage(jid, { text: A.textoResultado(fin), mentions: fin.ganadorJid ? [fin.ganadorJid] : [] }, { quoted: msg }); }
      return enviar(['No hay ninguna subasta ahora mismo.', `Inicia una con *${prefix}subasta iniciar*`]);
    }
    const n = N.POR_ID[a0.id];
    const minima = S.minimaPuja(a0, n);
    if (!palabra) return enviar([`Dime cuánto. Ej: *${prefix}pujar ${minima}* o *${prefix}pujar min*`, '', ...A.textoActiva(a0, prefix)], a0.ganadorJid ? [a0.ganadorJid] : []);

    const monto = ['min', 'minima', 'minimo'].includes(palabra) ? minima : /^\d+$/.test(palabra) ? parseInt(palabra, 10) : NaN;
    if (!Number.isFinite(monto)) return enviar([`No entendí el monto. Ej: *${prefix}pujar ${minima}*`]);

    const llave = claveCanonica(db, remitente);
    const u = getUsuario(db, remitente);
    const r = S.pujar(db, u, llave, remitente, monto);
    if (r.error === 'ninguna') return enviar(['Esa subasta ya terminó.']);
    if (r.error === 'baja') return enviar([`Tu puja es muy baja. El mínimo ahora es *${A.dinero(r.minima)}*.`, `Ej: *${prefix}pujar ${r.minima}*`]);
    if (r.error === 'saldo') return enviar([`No te alcanza. Tienes *${A.dinero(r.disponible)}* y quieres pujar *${A.dinero(r.monto)}*.`]);
    guardarDB(db);
    A.programar(sock);

    const lineas = [
      `🔨 ${A.tag(remitente)} pujó *${A.dinero(monto)}*`, '',
      `${n.emoji} *${n.nombre}*`,
      `⏳ Termina en *${A.quedan(r.activa.fin - Date.now())}*${r.alargada ? ' (¡se alargó 1 min por puja de último momento!)' : ''}`,
      `💼 Tu saldo: ${A.dinero(r.saldo)}`
    ];
    const menciones = [remitente];
    if (r.superado && r.superado.jid) { lineas.push('', `⚠️ ${A.tag(r.superado.jid)} fue superado/a y ya se le devolvió su dinero.`); menciones.push(r.superado.jid); }
    return enviar(lineas, menciones);
  }
};

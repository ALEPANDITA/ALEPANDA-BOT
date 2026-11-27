const { leerConfig } = require('../../lib/config');
const { leerDB, guardarDB, getUsuario, claveCanonica, unirIdentidad } = require('../../lib/db');
const { esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia } = require('../../lib/estilo');
const { _resolverReceptor } = require('./darmoney');

const DIA = 86400000;
const numeroDe = (id) => String(id || '').split('@')[0].split(':')[0];
const fechaTxt = (ms) => new Date(ms).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Tijuana' });

// Lo que se escribio: "5" (llevan 5 dias), "+5" (sumar 5 dias), "15/03/2026" o "2026-03-15" (fecha de la boda)
function entender(t) {
  let m;
  if ((m = /^\+(\d{1,4})$/.exec(t))) return { suma: Number(m[1]) };
  if ((m = /^(\d{1,4})$/.exec(t))) return { dias: Number(m[1]) };
  let d; let mes; let a;
  if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t))) { d = +m[1]; mes = +m[2]; a = +m[3]; }
  else if ((m = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(t))) { a = +m[1]; mes = +m[2]; d = +m[3]; }
  else return null;
  if (a < 100) a += 2000;
  const ms = Date.UTC(a, mes - 1, d, 20, 0, 0); // mediodia de Tijuana
  const f = new Date(ms);
  if (f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== d) return null; // fecha imposible (31/02...)
  return { fecha: ms };
}

module.exports = {
  name: 'fechaboda',
  aliases: ['editarboda', 'diasboda', 'ponerboda', 'modificarboda'],
  category: 'owner',
  description: 'Cambia los dias de casados de una pareja (solo owner). Ej: .fechaboda @usuario 5  ·  +5  ·  15/03/2026',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const aviso = (t, titulo) => sock.sendMessage(jid, { text: advertencia(t, { titulo, estilo: 'neon' }) });
    if (!(await esOwnerBot(sock, leerConfig(), msg))) return aviso('Solo un owner del bot puede usar este comando.', 'SIN PERMISOS');

    const ci = Object.values(msg.message || {}).map((x) => x && x.contextInfo).find(Boolean) || {};
    const menciones = ci.mentionedJid || [];
    const objetivo = menciones[0] || ci.participant;
    const dato = String(texto || '').trim().split(/\s+/).slice(1).filter((p) => !p.startsWith('@') && !/^\d{8,}$/.test(p)).pop();
    const ayuda = (titulo) => aviso([
      `Uso: ${prefix}fechaboda @usuario <dias | +dias | fecha>`,
      `• ${prefix}fechaboda @usuario 5  → llevan 5 días de casados`,
      `• ${prefix}fechaboda @usuario +5  → suma 5 días a lo que llevan`,
      `• ${prefix}fechaboda @usuario 15/03/2026  → se casaron ese día`,
      'Menciona a uno de los dos: el cambio se aplica a la pareja completa (deben estar casados ahora).'
    ].join('\n'), titulo);
    if (!objetivo) return ayuda('FALTA EL USUARIO');
    const pedido = dato ? entender(dato) : null;
    if (!pedido) return ayuda(dato ? 'NO ENTENDÍ ESO' : 'FALTA EL DATO');

    const db = leerDB();
    const { clave, numeroReal } = await _resolverReceptor(sock, jid, objetivo, db);
    const llaveA = unirIdentidad(db, [objetivo, clave, numeroReal && `${numeroReal}@s.whatsapp.net`].filter(Boolean));
    const a = getUsuario(db, llaveA);
    if (!a.pareja) return aviso(`@${numeroDe(objetivo)} no está casado/a ahora.\nSi ya se divorciaron, cásalos de nuevo con ${prefix}casar y luego usa este comando.`, 'SIN MATRIMONIO');
    const llaveB = claveCanonica(db, a.pareja);
    const b = getUsuario(db, llaveB);
    if (menciones[1] && numeroDe(menciones[1]) !== numeroDe(llaveB) && claveCanonica(db, menciones[1]) !== llaveB) return aviso('Esas dos personas no están casadas entre sí.', 'NO SON PAREJA');

    const abierto = (u, con) => {
      if (!Array.isArray(u.historialMatrimonial)) u.historialMatrimonial = [];
      let h = [...u.historialMatrimonial].reverse().find((x) => !x.fin);
      if (!h) { h = { con, inicio: Date.now(), fin: null }; u.historialMatrimonial.push(h); }
      return h;
    };
    const hA = abierto(a, llaveB); const hB = abierto(b, llaveA);
    const ahora = Date.now();
    const inicioActual = Math.min(hA.inicio || ahora, hB.inicio || ahora);
    let inicio;
    if (pedido.dias !== undefined) inicio = ahora - pedido.dias * DIA;
    else if (pedido.suma !== undefined) inicio = inicioActual - pedido.suma * DIA;
    else inicio = pedido.fecha;
    if (inicio > ahora) return aviso('Esa fecha es futura: no pueden llevar días negativos.', 'FECHA INVÁLIDA');
    if (ahora - inicio > 3650 * DIA) return aviso('Más de 10 años es demasiado, revisa el dato.', 'FECHA INVÁLIDA');
    hA.inicio = inicio; hB.inicio = inicio;
    guardarDB(db);

    const dias = Math.max(0, Math.floor((ahora - inicio) / DIA));
    await sock.sendMessage(jid, {
      text: exito([`💍 Matrimonio de @${numeroDe(objetivo)} y @${numeroDe(llaveB)} actualizado:`, `📅 Se casaron el ${fechaTxt(inicio)}`, `💞 Llevan *${dias} día${dias === 1 ? '' : 's'}* de casados`].join('\n'), { titulo: 'BODA ACTUALIZADA', estilo: 'neon' }),
      mentions: [objetivo, llaveB]
    });
  }
};

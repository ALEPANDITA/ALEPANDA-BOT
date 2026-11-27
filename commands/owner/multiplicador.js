const { leerConfig } = require('../../lib/config');
const { leerDB, guardarDB, getUsuario, claveCanonica, unirIdentidad } = require('../../lib/db');
const { esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia } = require('../../lib/estilo');
const { _resolverReceptor } = require('./darmoney');
const N = require('../../lib/eco-negocios');

const numeroDe = (id) => String(id || '').split('@')[0].split(':')[0];
const MAX_MULT = 1000, MAX_HORAS = 720;
const tiempo = (ms) => { const m = Math.max(0, Math.ceil(ms / 60000)); return m >= 1440 ? `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h` : m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };

// "3" / "x3" / "3x" / "1.5"  -> multiplicador;  "2h" / "30m" / "1d" / "2" (horas) -> duración en ms
const leerMult = (p) => { const m = /^x?(\d+(?:[.,]\d+)?)x?$/i.exec(p); return m ? Number(m[1].replace(',', '.')) : null; };
function leerDur(p) {
  const m = /^(\d+(?:[.,]\d+)?)(m|min|h|hr|hrs|d|dia|dias)?$/i.exec(p || '');
  if (!m) return null;
  const v = Number(m[1].replace(',', '.'));
  const u = (m[2] || 'h').toLowerCase();
  return v * (u.startsWith('m') ? 60000 : u.startsWith('d') ? 86400000 : 3600000);
}

module.exports = {
  name: 'multiplicador',
  aliases: ['multi', 'boost', 'multiplicar', 'darmultiplicador'],
  category: 'owner',
  description: 'Da un multiplicador a los negocios de alguien (solo owner). Ej: .multiplicador @usuario 3 2h  ·  .multiplicador todos 2 1h',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const aviso = (t, titulo) => sock.sendMessage(jid, { text: advertencia(t, { titulo, estilo: 'neon' }) });
    if (!(await esOwnerBot(sock, leerConfig(), msg))) return aviso('Solo un owner del bot puede usar este comando.', 'SIN PERMISOS');

    const ci = Object.values(msg.message || {}).map((x) => x && x.contextInfo).find(Boolean) || {};
    const objetivo = (ci.mentionedJid || [])[0] || ci.participant;
    const palabras = String(texto || '').trim().split(/\s+/).slice(1).filter((p) => p && !p.startsWith('@') && !/^\d{8,}$/.test(p));
    const primera = (palabras[0] || '').toLowerCase();
    const quitar = ['quitar', 'borrar', 'cancelar', 'off', 'reset'].includes(primera);
    const ver = ['ver', 'estado', 'info', 'lista'].includes(primera);
    const global = palabras.some((p) => ['todos', 'todas', 'global', 'all'].includes(p.toLowerCase()));
    const resto = palabras.filter((p) => !['quitar', 'borrar', 'cancelar', 'off', 'reset', 'ver', 'estado', 'info', 'lista', 'todos', 'todas', 'global', 'all'].includes(p.toLowerCase()));

    const ayuda = (titulo) => aviso([
      `Uso: ${prefix}multiplicador @usuario <multiplicador> [duración]`,
      `• ${prefix}multiplicador @usuario 3  → x3 en todos sus negocios por 1 hora`,
      `• ${prefix}multiplicador @usuario 3 2h  → x3 durante 2 horas (también 30m, 1d)`,
      `• ${prefix}multiplicador todos 2 3h  → x2 para TODOS durante 3 horas`,
      `• ${prefix}multiplicador quitar @usuario  ·  ${prefix}multiplicador quitar todos`,
      `• ${prefix}multiplicador ver @usuario`,
      `Máximo x${MAX_MULT} y ${MAX_HORAS} h. Se multiplica con el x${N.BONO_PAREJA} de pareja y el de las misiones. Solo vale desde que lo activas.`
    ].join('\n'), titulo);

    const db = leerDB();
    const ahora = Date.now();

    if (global && !ver) {
      if (quitar) { delete db.multiplicadorGlobal; guardarDB(db); return sock.sendMessage(jid, { text: exito('Se quitó el multiplicador global.', { titulo: 'MULTIPLICADOR', estilo: 'neon' }) }); }
      const mult = leerMult(resto[0]);
      const dur = leerDur(resto[1] || '1h');
      if (!mult || !dur) return ayuda('NO ENTENDÍ ESO');
      if (mult > MAX_MULT || dur > MAX_HORAS * 3600000) return ayuda('DEMASIADO GRANDE');
      db.multiplicadorGlobal = { mult, desde: ahora, hasta: ahora + dur, fuente: 'owner' };
      guardarDB(db);
      return sock.sendMessage(jid, { text: exito(`🌎 TODOS los negocios dan *x${mult}* durante ${tiempo(dur)}.\nSolo cuenta desde ahora; lo ya juntado no cambia.`, { titulo: 'MULTIPLICADOR GLOBAL', estilo: 'neon' }) });
    }

    if (!objetivo) return ayuda('FALTA EL USUARIO');
    const { clave, numeroReal } = await _resolverReceptor(sock, jid, objetivo, db);
    const llave = unirIdentidad(db, [objetivo, clave, numeroReal && `${numeroReal}@s.whatsapp.net`].filter(Boolean));
    const u = getUsuario(db, llave);
    const quien = `@${numeroDe(objetivo)}`;
    const enviar = (t, titulo) => sock.sendMessage(jid, { text: exito(t, { titulo, estilo: 'neon' }), mentions: [objetivo] });

    if (ver) {
      const r = N.resumen(u, db, ahora);
      const act = (u.multiplicadores || []).filter((e) => e.hasta > ahora);
      return enviar([`${quien}:`, `⚡ Multiplicador actual: x${Math.round(r.mult * 100) / 100}${r.multHasta ? ` (quedan ${tiempo(r.multHasta - ahora)})` : ''}`, ...act.map((e) => `• x${e.mult} (${e.fuente || 'owner'}) · quedan ${tiempo(e.hasta - ahora)}`)].join('\n'), 'MULTIPLICADOR');
    }
    if (quitar) {
      const antes = (u.multiplicadores || []).length;
      u.multiplicadores = (u.multiplicadores || []).filter((e) => e.fuente !== 'owner' && e.hasta > ahora);
      guardarDB(db);
      return enviar(antes ? `Se quitó el multiplicador de ${quien}.` : `${quien} no tenía un multiplicador tuyo.`, 'MULTIPLICADOR');
    }
    const mult = leerMult(resto[0]);
    const dur = leerDur(resto[1] || '1h');
    if (!mult || !dur) return ayuda(resto.length ? 'NO ENTENDÍ ESO' : 'FALTA EL MULTIPLICADOR');
    if (mult > MAX_MULT || dur > MAX_HORAS * 3600000) return ayuda('DEMASIADO GRANDE');

    N.podarMult(u, ahora);
    u.multiplicadores = [...(u.multiplicadores || []).filter((e) => e.fuente !== 'owner' && e.hasta > ahora), { mult, desde: ahora, hasta: ahora + dur, fuente: 'owner' }];
    // La pareja que comparte negocios cobra por su cuenta: el multiplicador es solo de quien lo recibe.
    guardarDB(db);
    const r = N.resumen(u, db, ahora);
    return enviar([`${quien} ahora gana *x${mult}* en todos sus negocios durante ${tiempo(dur)}.`, `📈 Total con otros bonos: x${Math.round(r.mult * 100) / 100} → ${Math.round(r.porHora).toLocaleString('en-US')} por hora`, 'Solo cuenta desde ahora; lo ya juntado no cambia.'].join('\n'), 'MULTIPLICADOR');
  }
};

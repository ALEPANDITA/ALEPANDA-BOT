const fs = require('fs');
const path = require('path');
const { leerConfig } = require('../../lib/config');
const { leerDB, guardarDB } = require('../../lib/db');
const { esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia } = require('../../lib/estilo');
const { _resolverReceptor } = require('./darmoney');
const { trasladar, numeroDe } = require('../../lib/traslado');

const fmt = (n) => Number(n || 0).toLocaleString('es-MX');

// Los dos usuarios EN EL ORDEN en que se escribieron (menciones o numeros): el 1ro es el origen, el 2do el destino.
function objetivosEnOrden(msg, texto) {
  const m = (msg && msg.message) || {};
  const ci = Object.values(m).map((x) => x && x.contextInfo).find(Boolean) || {};
  const menciones = ci.mentionedJid || [];
  const cuerpo = String(texto || '').replace(/^\S+\s*/, '');
  const out = [];
  const re = /@?(\d{6,20})/g; let t;
  while ((t = re.exec(cuerpo))) {
    if (out.some((x) => numeroDe(x) === t[1])) continue;
    out.push(menciones.find((x) => numeroDe(x) === t[1]) || `${t[1]}@s.whatsapp.net`);
  }
  for (const j of menciones) if (!out.some((x) => numeroDe(x) === numeroDe(j))) out.push(j);
  return out;
}

async function ids(sock, jid, objetivo, db) {
  const { clave, numeroReal } = await _resolverReceptor(sock, jid, objetivo, db);
  return [objetivo, clave, numeroReal && `${numeroReal}@s.whatsapp.net`].filter(Boolean);
}

module.exports = {
  name: 'trasladar',
  aliases: ['traspasar', 'migrar', 'traspaso'],
  category: 'owner',
  description: 'Traspasa TODAS las cosas de un usuario a otro numero (solo owner). Ej: .trasladar @viejo @nuevo',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const aviso = (t, titulo) => sock.sendMessage(jid, { text: advertencia(t, { titulo, estilo: 'neon' }) });
    const autorizado = await esOwnerBot(sock, leerConfig(), msg);
    if (!autorizado) return aviso('Solo un owner del bot puede usar este comando.', 'SIN PERMISOS');

    const lista = objetivosEnOrden(msg, texto);
    if (lista.length < 2) {
      return aviso(`Uso: ${prefix}trasladar @viejo @nuevo\nEl 1ro es quien pasa todo (dinero, negocios, accesorios, perfil, gacha, nivel, pareja...) y el 2do quien lo recibe.\nSi el viejo ya no esta en el grupo, escribe su numero completo con lada: ${prefix}trasladar 5216641234567 @nuevo`, 'FALTAN USUARIOS');
    }
    const db = leerDB();
    const idsO = await ids(sock, jid, lista[0], db);
    const idsD = await ids(sock, jid, lista[1], db);

    // copia de seguridad de toda la base antes de tocar nada (se guardan las ultimas 5)
    const raiz = path.join(__dirname, '..', '..');
    try {
      fs.copyFileSync(path.join(raiz, 'database.json'), path.join(raiz, `database.json.bak-traslado-${Date.now()}`));
      const viejos = fs.readdirSync(raiz).filter((f) => f.startsWith('database.json.bak-traslado-')).sort();
      for (const f of viejos.slice(0, -5)) fs.unlinkSync(path.join(raiz, f));
    } catch (e) { return aviso(`No pude hacer la copia de seguridad (${e.message}). No se movio nada.`, 'CANCELADO'); }

    const r = trasladar(db, idsO, idsD);
    if (r.error === 'mismo') return aviso('Son la misma persona, no hay nada que traspasar.', 'MISMO USUARIO');
    if (r.error === 'sinDatos') return aviso('El primer usuario no tiene datos guardados en el bot.', 'SIN DATOS');
    if (r.error === 'casados') return aviso('Esos dos estan casados entre si. Divorciense primero con el comando de divorcio.', 'CASADOS');
    if (r.error) return aviso('No pude identificar a alguno de los dos usuarios.', 'ERROR');
    guardarDB(db);

    const d = r.despues;
    const tag = (id) => `@${numeroDe(id)}`;
    const resultado = `Todo paso de ${tag(lista[0])} a ${tag(lista[1])}.\n\n` +
      `💰 Cartera: *$${fmt(d.saldo)}*   🏦 Banco: *$${fmt(d.banco)}*\n` +
      `🏢 Propiedades: *${d.negocios}*   🎀 Accesorios: *${d.accesorios}*\n` +
      `🎴 Gacha: *${d.personajes}*   ⭐ XP: *${fmt(d.xp)}*\n` +
      `${d.pareja ? '💍 Pareja e hijos pasaron tambien.\n' : ''}🖼️ Perfil (foto, nombre, marco, accesorios) copiado igual.\n` +
      `${r.huboDestino ? '➕ Lo que ya tenia el nuevo se sumo (dinero, listas).\n' : ''}` +
      `🔗 Referencias actualizadas: ${r.referencias}\n\n` +
      `El numero viejo quedo en cero. Copia de seguridad guardada por si hay que deshacerlo.`;
    await sock.sendMessage(jid, { text: exito(resultado, { titulo: 'TRASPASO COMPLETO', estilo: 'neon' }), mentions: [lista[0], lista[1]] });
  }
};

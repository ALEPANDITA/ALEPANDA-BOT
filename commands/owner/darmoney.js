const { leerConfig } = require('../../lib/config');
const { leerDB, guardarDB, getUsuario, unirIdentidad } = require('../../lib/db');
const { resolverLid, esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia } = require('../../lib/estilo');

const numeroDe = (id) => String(id || '').split('@')[0].split(':')[0];

// Encuentra a quien recibe el dinero y con QUE llave guardarlo. Las demas economias (saldo, casino, trabajar...) usan el id
// con el que el usuario escribe en el grupo (msg.key.participant = el "id" de su ficha del grupo: @lid o numero segun el grupo).
// Aqui se juntan todas las formas de la misma persona (@lid, numero real, lo que vino en la mencion) y se usa ese mismo id.
async function resolverReceptor(sock, jid, objetivo, db) {
  const variantes = new Set([objetivo]);
  try { const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(objetivo); if (pn) variantes.add(pn); } catch (_) { /* este fork no lo soporta */ }
  try { const lid = await sock.signalRepository?.lidMapping?.getLIDForPN?.(objetivo); if (lid) variantes.add(lid); } catch (_) { /* idem */ }

  let ficha = null;
  if (String(jid).endsWith('@g.us')) {
    let meta = null;
    try { meta = await sock.groupMetadata(jid); } catch (_) { meta = null; }
    const nums = new Set([...variantes].map(numeroDe));
    ficha = meta?.participants?.find((p) => [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean).some((x) => nums.has(numeroDe(x)))) || null;
  }

  // Numero real: de la ficha del grupo, de la mencion o del mapeo
  let numeroReal = null;
  if (ficha?.phoneNumber) numeroReal = numeroDe(ficha.phoneNumber);
  if (!numeroReal) { const pn = [...variantes].find((v) => String(v).endsWith('@s.whatsapp.net')); if (pn) numeroReal = numeroDe(pn); }

  // Llave: la ficha del grupo; si no esta en el grupo, una llave que ya exista en la base para esa persona; y si no, el metodo de antes
  if (ficha) return { clave: ficha.id, numeroReal, origen: 'grupo' };
  const nums = new Set([...variantes].map(numeroDe));
  const existentes = Object.keys(db.usuarios || {}).filter((k) => nums.has(numeroDe(k)));
  if (existentes.length) return { clave: existentes.includes(objetivo) ? objetivo : existentes[0], numeroReal, origen: 'base de datos' };
  let clave = objetivo;
  try { clave = await resolverLid(sock, objetivo); } catch (_) { /* seguimos con el id tal cual */ }
  return { clave, numeroReal, origen: 'respaldo' };
}

module.exports = {
  name: 'darmoney',
  category: 'owner',
  description: 'Dar dinero a un usuario (solo owner)',
  _resolverReceptor: resolverReceptor,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;

    let objetivo = mencionado || citado;

    if (!objetivo) {
      return sock.sendMessage(jid, {
        text: advertencia(`Menciona o responde a alguien: ${prefix}darmoney <monto>`, { titulo: 'FALTA EL USUARIO', estilo: 'neon' })
      });
    }

    const partes = (texto || '').trim().split(/\s+/).filter(Boolean);
    const monto = parseInt(partes[partes.length - 1], 10);

    if (!monto || monto <= 0) {
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}darmoney <monto> (mencionando o respondiendo a alguien)`, { titulo: 'FALTA EL MONTO', estilo: 'neon' })
      });
    }

    const db = leerDB();
    const { clave, numeroReal } = await resolverReceptor(sock, jid, objetivo, db);
    unirIdentidad(db, [objetivo, clave, numeroReal && `${numeroReal}@s.whatsapp.net`]);
    const receptor = getUsuario(db, clave);
    receptor.saldo += monto;
    guardarDB(db);

    await sock.sendMessage(jid, {
      text: exito(`Le diste *$${monto}* al usuario.\nSu saldo actual: *$${receptor.saldo}*\n🆔 Id: ${clave}${numeroReal ? ` · 📱 +${numeroReal}` : ''}`, { titulo: 'DINERO ENVIADO', estilo: 'neon' })
    });
  }
};

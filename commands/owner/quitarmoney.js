const { leerConfig } = require('../../lib/config');
const { leerDB, guardarDB, getUsuario, unirIdentidad } = require('../../lib/db');
const { esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia } = require('../../lib/estilo');
const { _resolverReceptor: resolverReceptor } = require('./darmoney');

const dinero = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');

// Quita dinero a un usuario (solo owner). Es el contrario de .darmoney y encuentra a la persona igual que el.
//   .quitarmoney 5000            -> quita $5,000 del dinero en mano
//   .quitarmoney banco 5000      -> quita $5,000 del banco
//   .quitarmoney todo            -> deja en $0 el dinero en mano
//   .quitarmoney banco todo      -> deja en $0 el banco
module.exports = {
  name: 'quitarmoney',
  aliases: ['quitardinero', 'removemoney'],
  category: 'owner',
  description: 'Quita dinero a un usuario (solo owner). Uso: .quitarmoney <monto|todo> o .quitarmoney banco <monto|todo>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    if (!(await esOwnerBot(sock, leerConfig(), msg))) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const objetivo = ctx?.mentionedJid?.[0] || ctx?.participant;
    if (!objetivo) {
      return sock.sendMessage(jid, { text: advertencia(`Menciona o responde a alguien:\n${prefix}quitarmoney <monto|todo>\n${prefix}quitarmoney banco <monto|todo>`, { titulo: 'FALTA EL USUARIO', estilo: 'neon' }) });
    }

    // Se leen las palabras de despues del comando (las menciones @numero se ignoran)
    const palabras = String(texto || '').trim().split(/\s+/).slice(1).filter((p) => !p.startsWith('@'));
    const enBanco = palabras.some((p) => /^(banco|bank)$/i.test(p));
    const pideTodo = palabras.some((p) => /^(todo|todos|all)$/i.test(p));
    const numerico = palabras.map((p) => parseInt(String(p).replace(/[$,._]/g, ''), 10)).find((n) => Number.isFinite(n) && n > 0);

    if (!pideTodo && !numerico) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}quitarmoney <monto|todo>\n${prefix}quitarmoney banco <monto|todo>\n(mencionando o respondiendo a alguien)`, { titulo: 'FALTA EL MONTO', estilo: 'neon' }) });
    }

    const db = leerDB();
    const { clave, numeroReal } = await resolverReceptor(sock, jid, objetivo, db);
    unirIdentidad(db, [objetivo, clave, numeroReal && `${numeroReal}@s.whatsapp.net`]);
    const usuario = getUsuario(db, clave);

    const campo = enBanco ? 'banco' : 'saldo';
    const tenia = Math.max(0, Number(usuario[campo]) || 0);
    const quitado = pideTodo ? tenia : Math.min(numerico, tenia);
    usuario[campo] = tenia - quitado;
    guardarDB(db);
    console.log(`[quitarmoney] ${msg.key.participant || msg.key.remoteJid} le quitó ${quitado} (${campo}) a ${clave}`);

    const dondeEs = enBanco ? 'del banco' : 'de su dinero en mano';
    const lineas = [];
    if (quitado === 0) lineas.push(`Ese usuario no tenía nada ${dondeEs}, no se quitó nada.`);
    else if (!pideTodo && numerico > tenia) lineas.push(`Solo tenía ${dinero(tenia)} ${dondeEs}: se le quitó todo (${dinero(quitado)}).`);
    else lineas.push(`Le quitaste *${dinero(quitado)}* ${dondeEs}.`);
    lineas.push(`${enBanco ? '🏦 Banco' : '💰 Saldo'} actual: *${dinero(usuario[campo])}*`, `${enBanco ? '💰 Saldo' : '🏦 Banco'}: *${dinero(usuario[enBanco ? 'saldo' : 'banco'])}*`, `🆔 Id: ${clave}${numeroReal ? ` · 📱 +${numeroReal}` : ''}`);

    await sock.sendMessage(jid, { text: exito(lineas.join('\n'), { titulo: 'DINERO QUITADO', estilo: 'neon' }) });
  }
};

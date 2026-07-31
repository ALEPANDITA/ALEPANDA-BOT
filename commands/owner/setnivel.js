const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { sumarNiveles, fijarNivel, NIVEL_MAXIMO } = require('../../lib/niveles');
const { resolverIdEnGrupo } = require('../../lib/identidad');
const { exito, advertencia, error } = require('../../lib/estilo');

module.exports = {
  name: 'setnivel',
  category: 'owner',
  aliases: ['nivelset'],
  description: 'Da, quita o fija el nivel de alguien. Uso: .setnivel dar/quitar/fijar <numero> (mencionando o respondiendo a la persona)',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, {
        text: advertencia('Solo un owner del bot puede dar o quitar niveles.', { titulo: 'SIN PERMISOS' })
      });
    }

    const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
    const objetivoCrudo = mencionado || citado;

    if (!objetivoCrudo) {
      return sock.sendMessage(jid, {
        text: advertencia(
          `Menciona a alguien o responde su mensaje.\nUso: ${prefix}setnivel dar/quitar/fijar <numero> @usuario`,
          { titulo: 'FALTA EL USUARIO' }
        )
      });
    }

    // Resolvemos al ID canonico del grupo (el mismo que usa el contador de xp
    // por mensajes en index.js y el topnivel) para que dar/quitar niveles a
    // alguien mencionado siempre afecte el mismo registro que su actividad de
    // chat, sin importar si la mencion vino como @lid o como numero real.
    const objetivo = await resolverIdEnGrupo(sock, jid, objetivoCrudo);

    const argumentos = texto.slice((prefix + 'setnivel').length).trim().split(/\s+/).filter(Boolean);
    const accion = (argumentos[0] || '').toLowerCase();
    const numero = parseInt(argumentos.find(a => /^\d+$/.test(a)), 10);

    if (!['dar', 'quitar', 'fijar'].includes(accion) || Number.isNaN(numero)) {
      return sock.sendMessage(jid, {
        text: advertencia(
          `Uso: ${prefix}setnivel dar <numero> @usuario\n` +
          `${prefix}setnivel quitar <numero> @usuario\n` +
          `${prefix}setnivel fijar <numero> @usuario`,
          { titulo: 'USO INCORRECTO' }
        )
      });
    }

    const db = leerDB();
    const usuario = getUsuario(db, objetivo);

    let resultado;
    if (accion === 'dar') resultado = sumarNiveles(usuario, numero);
    else if (accion === 'quitar') resultado = sumarNiveles(usuario, -numero);
    else resultado = fijarNivel(usuario, numero);

    guardarDB(db);

    if (numero > NIVEL_MAXIMO && accion !== 'quitar') {
      await sock.sendMessage(jid, {
        text: advertencia(`El nivel maximo es ${NIVEL_MAXIMO}, se dejo en ese tope.`, { titulo: 'NIVEL MAXIMO' })
      });
    }

    await sock.sendMessage(jid, {
      text: exito(
        `@${objetivo.split('@')[0]} ahora esta en el *nivel ${resultado.nivel}*\n` +
        `🏅 Rango: *${resultado.rango}*${resultado.insignia ? ` — ${resultado.insignia}` : ''}`,
        { titulo: 'NIVEL ACTUALIZADO' }
      ),
      mentions: [objetivo]
    });
  }
};

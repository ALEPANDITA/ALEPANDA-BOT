const { leerDB, guardarDB, getGrupo, listaVozUnica } = require('../../lib/db');
const { esAdminDelGrupo, esAdminDelBot } = require('../../lib/permisos');
const { exito, advertencia } = require('../../lib/estilo');

function extraerObjetivo(msg) {
  const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
  return mencionado || citado || null;
}

module.exports = {
  name: 'vozunica',
  category: 'admin',
  description: 'Deja que SOLO ciertas personas puedan hablar en el grupo (al resto se les borra el mensaje), sin quitarle el admin a nadie. Uso: .vozunica @persona | .vozunica quitar @persona | .vozunica off',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);
    const esAdminBot = await esAdminDelBot(sock, jid);

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: advertencia('Solo un admin puede usar este comando.', { titulo: 'SIN PERMISOS' }) });
    }
    if (!esAdminBot) {
      return sock.sendMessage(jid, { text: advertencia('Necesito ser admin del grupo para poder borrar mensajes.', { titulo: 'ME FALTAN PERMISOS' }) });
    }

    const db = leerDB();
    const grupo = getGrupo(db, jid);
    const permitidos = listaVozUnica(grupo);
    const argumento = texto.slice((prefix + 'vozunica').length).trim();
    const subcomando = (argumento.split(/\s+/)[0] || '').toLowerCase();
    const objetivo = extraerObjetivo(msg);

    // Sin argumentos de texto Y sin responder a nadie: mostrar el estado actual
    if (!argumento && !objetivo) {
      if (permitidos.length) {
        return sock.sendMessage(jid, {
          text: exito(`Voz unica activada.\nPueden hablar:\n${permitidos.map(n => `- @${n}`).join('\n')}\n\nAgregar otra: ${prefix}vozunica @persona\nQuitar a alguien: ${prefix}vozunica quitar @persona\nApagarlo: ${prefix}vozunica off`, { titulo: 'VOZ UNICA' }),
          mentions: permitidos.map(n => `${n}@s.whatsapp.net`)
        });
      }
      return sock.sendMessage(jid, {
        text: advertencia(`Voz unica esta apagada.\nUso: ${prefix}vozunica @persona (o responde su mensaje)\nPuedes usarlo varias veces para agregar mas de una persona.`, { titulo: 'VOZ UNICA' })
      });
    }

    // Apagarlo por completo
    if (subcomando === 'off') {
      grupo.vozUnica = [];
      guardarDB(db);
      return sock.sendMessage(jid, { text: exito('Voz unica desactivada. Todos pueden hablar de nuevo.', { titulo: 'VOZ UNICA' }) });
    }

    // Quitar a una persona especifica de la lista
    if (subcomando === 'quitar') {
      if (!objetivo) {
        return sock.sendMessage(jid, { text: advertencia(`Menciona a quien quitar.\nEjemplo: ${prefix}vozunica quitar @persona`, { titulo: 'FALTA LA PERSONA' }) });
      }
      const numero = objetivo.split('@')[0];
      grupo.vozUnica = permitidos.filter(n => n !== numero);
      guardarDB(db);

      if (grupo.vozUnica.length) {
        return sock.sendMessage(jid, {
          text: exito(`Listo, @${numero} ya no puede hablar solo.\nSiguen pudiendo hablar:\n${grupo.vozUnica.map(n => `- @${n}`).join('\n')}`, { titulo: 'VOZ UNICA' }),
          mentions: [objetivo, ...grupo.vozUnica.map(n => `${n}@s.whatsapp.net`)]
        });
      }
      return sock.sendMessage(jid, { text: exito('Ya no queda nadie en la lista, asi que voz unica se apago por completo. Todos pueden hablar de nuevo.', { titulo: 'VOZ UNICA' }) });
    }

    // Cualquier otro caso: agregar a la persona mencionada/citada a la lista
    // (esto cubre tanto ".vozunica @persona" como responder un mensaje sin escribir nada mas)
    if (!objetivo) {
      return sock.sendMessage(jid, { text: advertencia(`Menciona a la persona o responde su mensaje.\nEjemplo: ${prefix}vozunica @persona`, { titulo: 'FALTA LA PERSONA' }) });
    }

    const numero = objetivo.split('@')[0];
    if (!permitidos.includes(numero)) permitidos.push(numero);
    grupo.vozUnica = permitidos;
    guardarDB(db);

    await sock.sendMessage(jid, {
      text: exito(`Listo. Ahora pueden hablar:\n${permitidos.map(n => `- @${n}`).join('\n')}\n\nA nadie se le quito el admin, pero se le borraran los mensajes a los demas (excepto comandos, para que no se quede nadie sin control del bot).\n\nAgregar a alguien mas: ${prefix}vozunica @otra_persona\nApagarlo: ${prefix}vozunica off`, { titulo: 'VOZ UNICA' }),
      mentions: permitidos.map(n => `${n}@s.whatsapp.net`)
    });
  }
};

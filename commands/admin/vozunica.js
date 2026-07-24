const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { esAdminDelGrupo, esAdminDelBot } = require('../../lib/permisos');
const { exito, advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'vozunica',
  category: 'admin',
  description: 'Deja que SOLO una persona pueda hablar en el grupo (a todos los demas se les borra el mensaje), sin quitarle el admin a nadie. Uso: .vozunica @persona | .vozunica off',
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
    const argumento = texto.slice((prefix + 'vozunica').length).trim();

    if (!argumento) {
      if (grupo.vozUnica) {
        return sock.sendMessage(jid, {
          text: exito(`Voz unica activada.\nSolo puede hablar: @${grupo.vozUnica}\n\nPara apagarlo: ${prefix}vozunica off`, { titulo: 'VOZ UNICA' }),
          mentions: [`${grupo.vozUnica}@s.whatsapp.net`]
        });
      }
      return sock.sendMessage(jid, {
        text: advertencia(`Voz unica esta apagada.\nUso: ${prefix}vozunica @persona (o responde su mensaje)\nPara apagarlo: ${prefix}vozunica off`, { titulo: 'VOZ UNICA' })
      });
    }

    if (argumento.toLowerCase() === 'off') {
      grupo.vozUnica = null;
      guardarDB(db);
      return sock.sendMessage(jid, { text: exito('Voz unica desactivada. Todos pueden hablar de nuevo.', { titulo: 'VOZ UNICA' }) });
    }

    const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
    const objetivo = mencionado || citado;

    if (!objetivo) {
      return sock.sendMessage(jid, { text: advertencia(`Menciona a la persona o responde su mensaje.\nEjemplo: ${prefix}vozunica @persona`, { titulo: 'FALTA LA PERSONA' }) });
    }

    grupo.vozUnica = objetivo.split('@')[0];
    guardarDB(db);

    await sock.sendMessage(jid, {
      text: exito(`Listo. Ahora SOLO puede hablar @${grupo.vozUnica}.\nA nadie mas se le quito el admin, pero se le borraran los mensajes (excepto comandos, para que no se quede nadie sin control del bot).\n\nPara apagarlo: ${prefix}vozunica off`, { titulo: 'VOZ UNICA' }),
      mentions: [objetivo]
    });
  }
};

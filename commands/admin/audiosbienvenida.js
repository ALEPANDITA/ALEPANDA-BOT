// commands/admin/audiosbienvenida.js
// .welcomeaudio / .byeaudio  -> audios extra de bienvenida / despedida (varios por grupo)

const audios = require('../../lib/audiosbienvenida');

async function esAdmin(sock, jid, msg) {
  const metadata = await sock.groupMetadata(jid);
  const remitente = msg.key.participant || msg.key.remoteJid;
  return !!metadata.participants.find((p) => p.jid === remitente || p.id === remitente || p.lid === remitente)?.admin;
}

function audioDelMensaje(msg) {
  const citado = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const fuente = citado || msg.message;
  return fuente?.audioMessage ? fuente : null;
}

function comando(tipo) {
  const nombre = tipo === 'welcome' ? 'welcomeaudio' : 'byeaudio';
  const etiqueta = tipo === 'welcome' ? 'bienvenida' : 'despedida';

  return {
    name: nombre,
    category: 'admin',
    description: `Audios extra de ${etiqueta} (puedes guardar varios). Responde a un audio con .${nombre} para agregarlo.`,
    groupOnly: true,
    execute: async (sock, jid, msg, { texto, prefix }) => {
      if (!(await esAdmin(sock, jid, msg))) {
        return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' }, { quoted: msg });
      }

      const args = String(texto || '').trim().split(/\s+/).slice(1);
      const sub = (args[0] || '').toLowerCase();
      const responder = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });

      if (sub === 'lista') {
        const ind = audios.leerIndice(tipo, jid);
        if (!ind.audios.length) return responder(`No hay audios de ${etiqueta} guardados todavia.\nResponde a un audio con ${prefix}${nombre} para agregar uno.`);
        const lineas = ind.audios.map((a, i) => `${i + 1}. ${a.segundos ? a.segundos + 's' : 'audio'} ${a.ptt ? '(nota de voz)' : ''}`.trim());
        return responder(`🔊 *Audios de ${etiqueta}* (${ind.audios.length}/${audios.MAX_AUDIOS})\nModo: *${ind.modo}*\n\n${lineas.join('\n')}\n\n${prefix}${nombre} borrar <numero> | ${prefix}${nombre} modo aleatorio/todos | ${prefix}${nombre} probar`);
      }

      if (sub === 'borrar') {
        const que = (args[1] || '').toLowerCase();
        if (que === 'todos' || que === 'todo') {
          const n = audios.borrarTodos(tipo, jid);
          return responder(`🗑️ Se borraron ${n} audio(s) de ${etiqueta}.`);
        }
        if (!/^\d+$/.test(que) || !audios.borrarAudio(tipo, jid, parseInt(que, 10))) {
          return responder(`Uso: ${prefix}${nombre} borrar <numero> o ${prefix}${nombre} borrar todos\nMira los numeros con ${prefix}${nombre} lista`);
        }
        return responder(`🗑️ Audio ${que} borrado.`);
      }

      if (sub === 'modo') {
        const modo = (args[1] || '').toLowerCase();
        if (modo !== 'aleatorio' && modo !== 'todos') {
          return responder(`Uso: ${prefix}${nombre} modo aleatorio (manda 1 al azar) o ${prefix}${nombre} modo todos (manda todos en orden, maximo 5)`);
        }
        audios.cambiarModo(tipo, jid, modo);
        return responder(`✅ Modo de audios de ${etiqueta}: *${modo}*`);
      }

      if (sub === 'probar') {
        const n = await audios.enviarAudios(sock, jid, tipo, { forzar: true });
        if (!n) return responder(`No hay audios de ${etiqueta} guardados. Responde a un audio con ${prefix}${nombre} para agregar uno.`);
        return;
      }

      // Sin subcomando: agregar el audio al que se esta respondiendo
      const fuente = audioDelMensaje(msg);
      if (!fuente) {
        return responder(
          `🔊 *Audios de ${etiqueta}*\n\n` +
          `Responde a un audio con *${prefix}${nombre}* para agregarlo (puedes agregar varios).\n\n` +
          `${prefix}${nombre} lista\n${prefix}${nombre} borrar <numero|todos>\n${prefix}${nombre} modo aleatorio|todos\n${prefix}${nombre} probar\n\n` +
          `Se manda despues del texto/imagen de ${etiqueta}. Maximo ${audios.MAX_AUDIOS} audios de ${audios.MAX_SEGUNDOS}s.`
        );
      }

      const info = fuente.audioMessage;
      if ((info.seconds || 0) > audios.MAX_SEGUNDOS) {
        return responder(`⚠️ El audio dura ${info.seconds}s y el maximo es ${audios.MAX_SEGUNDOS}s.`);
      }

      try {
        const { downloadMediaMessage } = require('@whiskeysockets/baileys');
        const buffer = await downloadMediaMessage({ message: fuente }, 'buffer', {});
        const r = audios.agregarAudio(tipo, jid, buffer, { mimetype: info.mimetype, ptt: info.ptt, segundos: info.seconds });
        if (!r.ok) return responder(`⚠️ ${r.error}`);
        await responder(`✅ Audio agregado a la ${etiqueta}. Ahora hay *${r.total}* guardado(s).\nUsa ${prefix}${nombre} probar para escucharlo.`);
      } catch (err) {
        console.error('[' + nombre + ']', err);
        await responder('No se pudo guardar el audio. Intenta de nuevo.');
      }
    }
  };
}

module.exports = [comando('welcome'), comando('bye')];

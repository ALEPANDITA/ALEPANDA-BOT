const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { leerStatus, crearSubbotCompleto } = require('../../lib/subbots');

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  name: 'addsubbot',
  category: 'owner',
  description: 'Crea un subbot para otra persona (sin limite, solo owner). El numero vinculado queda como owner de ese subbot. Uso: .addsubbot <numero con codigo de pais>',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' }, { quoted: msg });
    }

    const numero = texto.slice((prefix + 'addsubbot ').length).trim().replace(/[^0-9]/g, '');
    if (!numero) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}addsubbot <numero con codigo de pais, sin +>\nEj: ${prefix}addsubbot 5215512345678`
      }, { quoted: msg });
    }

    await sock.sendMessage(jid, {
      text: '🪄 Creando el subbot y solicitando codigo de vinculacion, espera unos segundos...'
    }, { quoted: msg });

    const remitente = msg.key.participant || msg.key.remoteJid;

    try {
      const { id, nombreProceso } = await crearSubbotCompleto(numero, remitente, 'addsubbot');

      let status = null;
      for (let intento = 0; intento < 20; intento++) {
        await esperar(3000);
        status = leerStatus(id);
        if (status?.codigo || status?.estado === 'error') break;
      }

      if (!status) {
        return sock.sendMessage(jid, {
          text: `⚠️ El subbot se creo (ID: ${id}) pero no respondio a tiempo. Revisa con:\npm2 logs ${nombreProceso}`
        }, { quoted: msg });
      }

      if (status.estado === 'error') {
        return sock.sendMessage(jid, { text: `❌ Error al crear el subbot: ${status.error}` }, { quoted: msg });
      }

      if (!status.codigo) {
        return sock.sendMessage(jid, {
          text: `⚠️ El subbot se creo (ID: ${id}) pero el codigo no llego a tiempo (estado actual: ${status.estado}). Revisa con:\npm2 logs ${nombreProceso}`
        }, { quoted: msg });
      }

      await sock.sendMessage(jid, {
        text: `✅ Subbot creado (ID: *${id}*)\n\n` +
          `📱 Numero: ${numero}\n\n` +
          `Ve a WhatsApp del numero ${numero} → Ajustes → Dispositivos vinculados → Vincular con numero de telefono, y cuando te pida el codigo, copia y pega el siguiente mensaje (dentro de los proximos minutos):`
      }, { quoted: msg });

      await sock.sendMessage(jid, { text: status.codigo });

      await sock.sendMessage(jid, {
        text: `Ese numero quedara automaticamente como owner de su propio subbot.\nUsa ${prefix}listsubbots para revisar el estado.`
      }, { quoted: msg });
    } catch (err) {
      console.error('[addsubbot] Error:', err);
      await sock.sendMessage(jid, { text: '❌ Ocurrio un error al crear el subbot.' }, { quoted: msg });
    }
  }
};

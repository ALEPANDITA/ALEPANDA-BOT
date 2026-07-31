const fs = require('fs');
const path = require('path');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { leerRegistro, guardarRegistro, detenerProcesoSubbot, CARPETA_SUBBOTS } = require('../../lib/subbots');

module.exports = {
  name: 'delsubbot',
  category: 'owner',
  description: 'Elimina un subbot: detiene su proceso y borra su sesion. Uso: .delsubbot <id o numero>',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' }, { quoted: msg });
    }

    const entrada = texto.slice((prefix + 'delsubbot ').length).trim();
    const registro = leerRegistro();

    if (!entrada) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}delsubbot <id o numero>\nEj: ${prefix}delsubbot 57323325455\nUsa ${prefix}listsubbots para ver los IDs y numeros disponibles.`
      }, { quoted: msg });
    }

    // Primero probamos como ID directo
    let id = registro.subbots[entrada] ? entrada : null;

    // Si no matcheo como ID, probamos como numero de telefono
    if (!id) {
      const numeroLimpio = entrada.replace(/[^0-9]/g, '');
      const coincidencias = numeroLimpio
        ? Object.entries(registro.subbots).filter(([, info]) => (info.numero || '').replace(/[^0-9]/g, '') === numeroLimpio)
        : [];

      if (coincidencias.length === 1) {
        id = coincidencias[0][0];
      } else if (coincidencias.length > 1) {
        const lista = coincidencias.map(([subId, info]) => `▸ ${subId} (${info.numero})`).join('\n');
        return sock.sendMessage(jid, {
          text: `Ese numero tiene *${coincidencias.length}* subbots asociados, especifica el ID:\n${lista}`
        }, { quoted: msg });
      }
    }

    if (!id || !registro.subbots[id]) {
      return sock.sendMessage(jid, {
        text: `No encontre ningun subbot con ese ID o numero.\nUsa ${prefix}listsubbots para ver los disponibles.`
      }, { quoted: msg });
    }

    const info = registro.subbots[id];
    await detenerProcesoSubbot(info.nombreProceso);

    const carpeta = path.join(CARPETA_SUBBOTS, id);
    if (fs.existsSync(carpeta)) fs.rmSync(carpeta, { recursive: true, force: true });

    delete registro.subbots[id];
    guardarRegistro(registro);

    await sock.sendMessage(jid, {
      text: `🗑️ Subbot *${id}* (${info.numero}) eliminado (proceso detenido y sesion borrada). Los demas subbots y el bot principal no fueron afectados.`
    }, { quoted: msg });
  }
};

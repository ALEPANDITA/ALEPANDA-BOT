const fs = require('fs');
const path = require('path');
const { leerRegistro, guardarRegistro, detenerProcesoSubbot, CARPETA_SUBBOTS } = require('../../lib/subbots');

module.exports = {
  name: 'desconectar',
  aliases: ['logout'],
  category: 'subbot',
  description: 'Desconecta y elimina TU subbot. Solo funciona escrito dentro del chat de tu propio subbot.',
  execute: async (sock, jid, msg, opciones = {}) => {
    if (!opciones.esSubbot || !opciones.subbotId) {
      return sock.sendMessage(jid, {
        text: 'Este comando solo funciona dentro de un subbot. Escribelo en el chat del subbot que quieres desconectar (el que creaste con .serbot).'
      }, { quoted: msg });
    }

    const { subbotId } = opciones;
    const registro = leerRegistro();
    const info = registro.subbots[subbotId];

    await sock.sendMessage(jid, {
      text: '👋 Desconectando tu subbot y cerrando sesion... Cuando quieras podras crear uno nuevo con .serbot.'
    }, { quoted: msg });

    if (info) {
      delete registro.subbots[subbotId];
      guardarRegistro(registro);
    }

    try {
      await sock.logout();
    } catch (err) {
      console.error(`[desconectar] Error en logout de ${subbotId}:`, err.message);
    }

    // Pequeña espera para que el mensaje de despedida alcance a salir antes
    // de borrar la carpeta y matar el proceso (que se elimina a si mismo).
    setTimeout(() => {
      const carpeta = path.join(CARPETA_SUBBOTS, subbotId);
      if (fs.existsSync(carpeta)) fs.rmSync(carpeta, { recursive: true, force: true });
      if (info?.nombreProceso) {
        detenerProcesoSubbot(info.nombreProceso).catch(() => {});
      }
    }, 1500);
  }
};

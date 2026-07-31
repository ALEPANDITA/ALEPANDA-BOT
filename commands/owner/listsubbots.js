const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { caja } = require('../../lib/estilo');
const { leerRegistro, leerStatus, obtenerEstadosPM2, SLOTS_TOTALES } = require('../../lib/subbots');

// Combina lo que el subbot reporto la ultima vez (status.json) con si su
// proceso en PM2 sigue vivo de verdad ahora mismo. Si el proceso ya no esta
// corriendo (se cayo, lo mataron a mano, el VPS se reinicio, etc), no
// confiamos en el ultimo estado reportado -- lo marcamos como inactivo.
function calcularEstado(estadoReportado, estadoPM2) {
  if (estadoPM2 !== 'online') {
    return { texto: 'inactivo (proceso caido)', emoji: '🔴' };
  }
  if (estadoReportado === 'conectado') return { texto: 'conectado', emoji: '🟢' };
  if (estadoReportado === 'desconectado') return { texto: 'desconectado (sesion cerrada)', emoji: '⚪' };
  if (estadoReportado === 'error') return { texto: 'error', emoji: '🔴' };
  return { texto: estadoReportado || 'desconocido', emoji: '🟡' };
}

module.exports = {
  name: 'listsubbots',
  category: 'owner',
  description: 'Muestra todos los slots de subbots, ocupados y libres, con su estado actual (cruzado con PM2).',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' }, { quoted: msg });
    }

    const registro = leerRegistro();
    const ids = Object.keys(registro.subbots);
    const estadosPM2 = await obtenerEstadosPM2();

    const lineas = [];
    let ocupados = 0;
    const totalAMostrar = Math.max(SLOTS_TOTALES, ids.length);

    for (let i = 0; i < totalAMostrar; i++) {
      const numeroSlot = i + 1;
      const id = ids[i];

      if (!id) {
        lineas.push(`⬜ SUBBOT-${numeroSlot} → libre, no hay conectados`);
        continue;
      }

      ocupados++;
      const info = registro.subbots[id];
      const status = leerStatus(id);
      const estadoReportado = status?.estado || info.estado || 'desconocido';
      const estadoPM2 = estadosPM2[info.nombreProceso] || 'no encontrado';
      const { texto: estadoTexto, emoji } = calcularEstado(estadoReportado, estadoPM2);

      lineas.push(
        `${emoji} SUBBOT-${numeroSlot} → ${estadoTexto}`,
        `    📱 ${info.numero}  |  🏷️ ${info.origen || 'addsubbot'}  |  🆔 ${id}`
      );
    }

    const texto = caja(lineas, {
      titulo: `SUBBOTS (${ocupados}/${totalAMostrar})`,
      pie: 'ALEPANDA BOT',
      estilo: 'gamer'
    });

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  }
};

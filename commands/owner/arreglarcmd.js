const fs = require('fs');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { advertencia, error: cajaError, caja } = require('../../lib/estilo');
const { diagnosticarComando } = require('../../lib/diagnostico-red');
const plan = require('../../lib/crearcmd-plan');

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

module.exports = {
  name: 'arreglarcmd',
  aliases: ['fixcmd'],
  category: 'owner',
  description: 'Arregla UN comando que ya existe: prueba sus URLs en vivo, te explica que encontro y que cambiaria, y solo lo aplica cuando digas "si". Uso: .arreglarcmd <nombre> <que esta mal>. Para toda una categoria usa .repararcmd. Solo owner.',
  execute: async (sock, jid, msg, { prefix, texto, comandos }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);
    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const partes = texto.trim().split(/\s+/);
    const nombrePedido = partes[1];
    const descripcionProblema = partes.slice(2).join(' ').trim() || '(el owner no dio detalles adicionales, basate solo en el diagnostico en vivo para decidir que corregir)';
    const planPendiente = plan.obtenerPlan(jid);

    if (!nombrePedido) {
      const lineas = [
        `Uso: ${prefix}arreglarcmd <nombre del comando> [que esta mal]`,
        '',
        `Ejemplo: ${prefix}arreglarcmd pindl ya no descarga, el endpoint ahora responde asi: {"link":"..."}`,
        `Sin descripcion: ${prefix}arreglarcmd pindl  (primero pruebo sus URLs en vivo y con eso decido)`,
        '',
        'Te cuento que encontre y que cambiaria, y solo lo aplico cuando me digas *si*. Siempre guardo un respaldo del original.'
      ];
      if (planPendiente) lineas.push('', '📌 Tienes un plan pendiente: responde *si*, pide cambios o escribe *cancelar*.');
      return sock.sendMessage(jid, { text: caja(lineas, { titulo: 'ARREGLARCMD', estilo: 'neon' }) });
    }

    const comando = comandos.get(normalizar(nombrePedido));

    // Hay un plan en pantalla y lo que escribes no es un comando: es "si", "cancelar" o un cambio
    if (planPendiente && !comando) {
      return plan.continuar({ sock, jid, msg, texto: partes.slice(1).join(' '), comandos, prefix });
    }

    if (!comando) {
      return sock.sendMessage(jid, {
        text: advertencia(`No encontre ningun comando llamado "${nombrePedido}". Usa ${prefix}cmd para ver la lista completa.`, { titulo: 'NO EXISTE', estilo: 'neon' })
      });
    }

    if (!comando._rutaArchivo || !fs.existsSync(comando._rutaArchivo)) {
      return sock.sendMessage(jid, {
        text: cajaError('No pude encontrar el archivo fuente de ese comando en disco, no se puede reparar automaticamente.')
      });
    }

    if (planPendiente && planPendiente.ocupado) {
      return sock.sendMessage(jid, { text: '⏳ Todavia estoy terminando el comando anterior, dame un momento.' }, { quoted: msg });
    }
    plan.descartarPlan(jid);

    const rutaOriginal = comando._rutaArchivo;
    const codigoActual = fs.readFileSync(rutaOriginal, 'utf-8');

    await sock.sendMessage(jid, { text: `🔎 Probando en vivo las URLs que usa "${comando.name}"...` }, { quoted: msg });
    const diagnostico = await diagnosticarComando(codigoActual);
    await sock.sendMessage(jid, {
      text: caja([diagnostico.resumenTexto], { titulo: 'DIAGNOSTICO EN VIVO', estilo: 'neon' })
    });

    return plan.iniciarPlanArreglo({
      sock, jid, msg, comandos, prefix, comando, rutaOriginal, codigoActual,
      diagnostico: diagnostico.resumenTexto, descripcionProblema
    });
  }
};

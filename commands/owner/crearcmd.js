const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { advertencia } = require('../../lib/estilo');
const { obtenerEstado, borrarEstado } = require('../../lib/crearcmd-estado');
const plan = require('../../lib/crearcmd-plan');

// Si el ultimo comando se instalo bien hace mucho, un texto nuevo ya no se toma como "arreglo" de ese comando
const MINUTOS_PARA_ARREGLAR_ULTIMO = 30;

module.exports = {
  name: 'crearcmd',
  aliases: ['iacmd', 'generarcmd'],
  category: 'owner',
  description: 'Te ayuda a crear un comando nuevo con IA: primero te explica el plan, tu lo ajustas y cuando digas "si" lo crea y lo activa. Solo owner.',
  execute: async (sock, jid, msg, { prefix, texto, comandos }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);
    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const argumentos = texto.trim().split(/\s+/).slice(1).join(' ').trim();
    const planPendiente = plan.obtenerPlan(jid);
    let estadoPrevio = obtenerEstado(jid);

    if (estadoPrevio && estadoPrevio.estado === 'exito' && Date.now() - (estadoPrevio.actualizado || 0) > MINUTOS_PARA_ARREGLAR_ULTIMO * 60 * 1000) {
      estadoPrevio = null;
    }

    if (!argumentos) {
      const lineas = [
        '👋 Cuentame que comando quieres y te explico como lo haria *antes* de crearlo.',
        '',
        '*Ejemplo:*',
        `${prefix}crearcmd un comando ${prefix}clima que reciba una ciudad, consulte este endpoint https://... y responda la temperatura`,
        '',
        'Si pegas la URL de una API, la PRUEBO en vivo: veo que responde y si trae varias opciones (ej. una lista de reacciones) para hacer un comando por cada una.',
        '',
        'Despues te mando el plan y tu decides:',
        `• Pideme cambios respondiendo a mi mensaje (o con ${prefix}crearcmd <cambio>)`,
        '• Cuando te guste, responde *si* y lo creo',
        '• *cancelar* lo descarta',
        '',
        'Si alguno de los nombres ya existe, lo PRUEBO antes de tocarlo: si funciona lo dejo igual; si falla lo arreglo con la API que me pases (siempre con respaldo y tu visto bueno).',
        '',
        `${prefix}crearcmd nuevo <descripcion> — empezar de cero (ignora lo anterior)`
      ];
      if (planPendiente) {
        lineas.push('', '📌 Tienes un plan pendiente: responde *si*, pide cambios o escribe *cancelar*.');
      } else if (estadoPrevio) {
        lineas.push('', `📌 Tu ultimo comando: *${prefix}${estadoPrevio.nombre || '(sin nombre aun)'}* (${estadoPrevio.estado === 'fallo' ? 'fallo' : 'instalado'}). Si algo no funciona, dime que pasa con ${prefix}crearcmd <que pasa>.`);
      }
      return sock.sendMessage(jid, { text: lineas.join('\n') }, { quoted: msg });
    }

    const forzarNuevo = /^nuevo\b/i.test(argumentos);
    if (forzarNuevo) {
      const descripcion = argumentos.replace(/^nuevo\b/i, '').trim();
      if (!descripcion) {
        return sock.sendMessage(jid, { text: advertencia(`Escribe la descripcion despues de "nuevo". Ej: ${prefix}crearcmd nuevo un comando que descargue algo desde tal endpoint...`) }, { quoted: msg });
      }
      if (planPendiente && planPendiente.ocupado) {
        return sock.sendMessage(jid, { text: '⏳ Todavia estoy terminando el comando anterior, dame un momento.' }, { quoted: msg });
      }
      plan.descartarPlan(jid);
      borrarEstado(jid);
      return plan.iniciarPlanNuevo({ sock, jid, msg, comandos, prefix, descripcion });
    }

    // Ya hay un plan en pantalla: lo que escribas es "si", "cancelar" o un cambio
    if (planPendiente) {
      return plan.continuar({ sock, jid, msg, texto: argumentos, comandos, prefix });
    }

    // Hay un comando reciente (instalado o fallido): lo que escribas se toma como correccion de ese
    if (estadoPrevio && estadoPrevio.codigo) {
      return plan.iniciarPlanEstado({ sock, jid, msg, comandos, prefix, estadoPrevio, aclaracion: argumentos });
    }

    return plan.iniciarPlanNuevo({ sock, jid, msg, comandos, prefix, descripcion: argumentos });
  }
};

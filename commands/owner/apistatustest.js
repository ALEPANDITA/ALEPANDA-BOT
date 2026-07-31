const { leerConfig } = require('../../lib/config');
const { getApiKeys } = require('../../lib/apikeys');
const { esOwnerBot } = require('../../lib/permisos');
const { probarClave } = require('../../lib/gemini');
const { caja, advertencia } = require('../../lib/estilo');

function verClave(clave) {
  return clave ? `${clave.slice(0, 4)}${'*'.repeat(Math.max(clave.length - 4, 0))}` : '';
}

module.exports = {
  name: 'apistatustest',
  category: 'owner',
  description: 'Prueba EN VIVO cada clave de Gemini guardada contra la API real y marca cual funciona y cual no (solo owner).',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const claves = getApiKeys('gemini');

    if (!claves.length) {
      return sock.sendMessage(jid, {
        text: advertencia('No hay ninguna clave de Gemini guardada.\nUsa .setapikey gemini TU_CLAVE para agregar una.', { titulo: 'SIN CLAVES', estilo: 'neon' })
      });
    }

    await sock.sendMessage(jid, { react: { text: '🔬', key: msg.key } });
    await sock.sendMessage(jid, { text: `Probando ${claves.length} clave(s) de Gemini una por una, espera un momento...` }, { quoted: msg });

    const lineas = [];
    let activas = 0;

    for (let i = 0; i < claves.length; i++) {
      const resultado = await probarClave(claves[i]);
      const etiqueta = `${i + 1}. ${verClave(claves[i])}`;

      if (resultado.ok) {
        activas++;
        lineas.push(`${etiqueta}\n   ✅ Funciona (${resultado.ms}ms, ${resultado.modelo})`);
      } else if (resultado.esCuota) {
        const espera = resultado.esperaSegundos
          ? `espera ~${resultado.esperaSegundos}s`
          : 'sin tiempo de espera indicado (puede ser cupo diario, se libera manana)';
        lineas.push(`${etiqueta}\n   ⏳ Sin cupo ahora mismo (${espera})`);
      } else if (resultado.esTemporal) {
        lineas.push(`${etiqueta}\n   🟡 Google esta saturado ahorita, no es culpa de la clave`);
      } else {
        lineas.push(`${etiqueta}\n   ❌ Invalida / bloqueada: ${resultado.mensaje}`);
      }
    }

    const resumen = `${activas} de ${claves.length} clave(s) respondieron bien ahora mismo.`;

    await sock.sendMessage(jid, {
      text: caja(lineas, { titulo: 'PRUEBA DE CLAVES GEMINI', pie: resumen, estilo: 'neon' })
    });
    await sock.sendMessage(jid, { react: { text: activas > 0 ? '✅' : '❌', key: msg.key } });
  }
};

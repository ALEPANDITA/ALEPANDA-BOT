const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { advertencia, caja } = require('../../lib/estilo');

module.exports = {
  name: 'eval',
  category: 'owner',
  description: 'Evalua codigo JavaScript en tiempo real (solo owner)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const partes = (texto || '').trim().split(/\s+/);
    const code = partes.slice(1).join(' ');

    if (!code) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}eval <codigo>`, { titulo: 'FALTA EL CODIGO', estilo: 'neon' }) });
    }

    try {
      const output = await eval(`(async () => { ${code} })()`);
      const respuesta = typeof output === 'string'
        ? output
        : JSON.stringify(output, null, 2) || 'Sin resultado';

      await sock.sendMessage(jid, { text: caja([respuesta.slice(0, 3800)], { titulo: 'EVAL', estilo: 'neon' }) });
    } catch (error) {
      const detalle = String(error?.stack || error || 'error desconocido').slice(0, 3800);
      await sock.sendMessage(jid, { text: caja([detalle], { titulo: 'EVAL ERROR', estilo: 'neon' }) });
    }
  }
};

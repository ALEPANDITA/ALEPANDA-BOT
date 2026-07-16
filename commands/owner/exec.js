const { exec } = require('child_process');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { advertencia, caja } = require('../../lib/estilo');

module.exports = {
  name: 'exec',
  category: 'owner',
  description: 'Ejecuta un comando del sistema (solo owner)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const partes = (texto || '').trim().split(/\s+/);
    const command = partes.slice(1).join(' ');

    if (!command) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}exec <comando>`, { titulo: 'FALTA EL COMANDO', estilo: 'neon' }) });
    }

    exec(
      command,
      { cwd: process.cwd(), timeout: 20000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
      async (error, stdout, stderr) => {
        const chunks = [];
        if (stdout?.trim()) chunks.push(`STDOUT\n${stdout.trim()}`);
        if (stderr?.trim()) chunks.push(`STDERR\n${stderr.trim()}`);
        if (error && !chunks.length) chunks.push(String(error?.stack || error || 'error desconocido'));

        const resultado = (chunks.join('\n\n') || 'Comando ejecutado sin salida.').slice(0, 3800);
        await sock.sendMessage(jid, { text: caja([resultado], { titulo: 'EXEC', estilo: 'neon' }) });
      }
    );
  }
};

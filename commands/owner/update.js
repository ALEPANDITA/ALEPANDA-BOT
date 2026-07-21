const { promisify } = require('util');
const execCb = require('child_process').exec;
const exec = promisify(execCb);
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'update',
  category: 'owner',
  description: 'Actualiza el bot a la ultima version de GitHub (solo owner)',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    try {
      await exec('git fetch', { cwd: process.cwd() });

      const { stdout: cambiosLog } = await exec('git log HEAD..origin/main --pretty=format:"• %s"', { cwd: process.cwd() });

      if (!cambiosLog.trim()) {
        return sock.sendMessage(jid, {
          text: exito('El bot ya esta en la ultima version, no hay nada nuevo que actualizar.', { titulo: 'UPDATE', estilo: 'neon' })
        });
      }

      await exec('git pull', { cwd: process.cwd() });

      let avisoDependencias = '';
      try {
        await exec('npm install --legacy-peer-deps', { cwd: process.cwd() });
      } catch (errNpm) {
        console.error('[update] error npm install:', errNpm);
        avisoDependencias = '\n⚠️ Hubo un error instalando dependencias, revisa la terminal.';
      }

      const texto = exito(
        `Cambios aplicados:\n${cambiosLog.trim()}${avisoDependencias}\n\nReiniciando en 3 segundos...`,
        { titulo: 'UPDATE COMPLETO', estilo: 'neon' }
      );

      await sock.sendMessage(jid, { text: texto });
      setTimeout(() => process.exit(0), 3000);
    } catch (err) {
      console.error('[update]', err);
      await sock.sendMessage(jid, {
        text: cajaError('Ocurrio un error al actualizar. Verifica que el bot este conectado a un repositorio de git y que no haya archivos modificados en conflicto.', { estilo: 'neon' })
      });
    }
  }
};

const { exec } = require('child_process');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia, error: cajaError, info } = require('../../lib/estilo');

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

    await sock.sendMessage(jid, { text: info('Buscando actualizaciones...', { titulo: 'UPDATE', estilo: 'neon' }) });

    exec('git fetch && git status -uno', { cwd: process.cwd() }, async (error, stdout) => {
      if (error) {
        console.error(error);
        return sock.sendMessage(jid, { text: cajaError('Ocurrio un error al buscar actualizaciones. Verifica que el bot este conectado a un repositorio de git.', { estilo: 'neon' }) });
      }

      if (stdout.includes('up to date') || stdout.includes('up-to-date')) {
        return sock.sendMessage(jid, { text: exito('El bot ya esta en la ultima version.', { titulo: 'UPDATE', estilo: 'neon' }) });
      }

      await sock.sendMessage(jid, { text: info('Descargando cambios nuevos...', { titulo: 'UPDATE', estilo: 'neon' }) });

      exec('git pull', { cwd: process.cwd() }, (error2, stdout2) => {
        if (error2) {
          console.error(error2);
          return sock.sendMessage(jid, { text: cajaError('Ocurrio un error al descargar los cambios. Puede que tengas archivos modificados localmente en conflicto.', { estilo: 'neon' }) });
        }

        sock.sendMessage(jid, { text: info('Instalando dependencias nuevas (si las hay)...', { titulo: 'UPDATE', estilo: 'neon' }) });

        exec('npm install', { cwd: process.cwd() }, (error3) => {
          if (error3) {
            console.error(error3);
            sock.sendMessage(jid, { text: cajaError('Se actualizo el codigo pero hubo un error instalando dependencias. Revisa la terminal.', { estilo: 'neon' }) });
          }

          sock.sendMessage(jid, {
            text: exito('Bot actualizado correctamente. Reiniciando en 3 segundos...', { titulo: 'UPDATE COMPLETO', estilo: 'neon' })
          }).then(() => {
            setTimeout(() => {
              process.exit(0);
            }, 3000);
          });
        });
      });
    });
  }
};

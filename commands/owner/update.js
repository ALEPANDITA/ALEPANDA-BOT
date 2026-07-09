const { exec } = require('child_process');
const { leerConfig } = require('../../lib/config');
const { resolverLid, mismoUsuario } = require('../../lib/permisos');

module.exports = {
  name: 'update',
  category: 'owner',
  description: 'Actualiza el bot a la ultima version de GitHub (solo owner)',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const remitente = msg.key.participant || msg.key.remoteJid;
    const remitenteResuelto = await resolverLid(sock, remitente);

    const esOwner = config.owners && config.owners.some(o => mismoUsuario(o, remitente) || mismoUsuario(o, remitenteResuelto));

    if (!esOwner) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' });
    }

    await sock.sendMessage(jid, { text: '🔄 Buscando actualizaciones...' });

    exec('git fetch && git status -uno', { cwd: process.cwd() }, async (error, stdout) => {
      if (error) {
        console.error(error);
        return sock.sendMessage(jid, { text: 'Ocurrio un error al buscar actualizaciones. Verifica que el bot este conectado a un repositorio de git.' });
      }

      if (stdout.includes('up to date') || stdout.includes('up-to-date')) {
        return sock.sendMessage(jid, { text: '✅ El bot ya esta en la ultima version.' });
      }

      await sock.sendMessage(jid, { text: '⬇️ Descargando cambios nuevos...' });

      exec('git pull', { cwd: process.cwd() }, (error2, stdout2) => {
        if (error2) {
          console.error(error2);
          return sock.sendMessage(jid, { text: 'Ocurrio un error al descargar los cambios. Puede que tengas archivos modificados localmente en conflicto.' });
        }

        sock.sendMessage(jid, { text: '📦 Instalando dependencias nuevas (si las hay)...' });

        exec('npm install', { cwd: process.cwd() }, (error3) => {
          if (error3) {
            console.error(error3);
            sock.sendMessage(jid, { text: 'Se actualizo el codigo pero hubo un error instalando dependencias. Revisa la terminal.' });
          }

          sock.sendMessage(jid, {
            text: '✅ Bot actualizado correctamente. Reiniciando en 3 segundos...'
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

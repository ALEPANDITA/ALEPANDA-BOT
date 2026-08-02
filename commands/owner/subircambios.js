const { promisify } = require('util');
const execCb = require('child_process').exec;
const execFileCb = require('child_process').execFile;
const exec = promisify(execCb);
const execFile = promisify(execFileCb);
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia, error: cajaError, caja } = require('../../lib/estilo');

module.exports = {
  name: 'subircambios',
  aliases: ['pushgit', 'subirgit', 'gitpush', 'subir'],
  category: 'owner',
  description: 'Sube los cambios/comandos nuevos a GitHub directo desde WhatsApp, revisando sintaxis antes (solo owner)',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);
    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const argumentos = texto.trim().split(/\s+/).slice(1).join(' ').trim();
    const mensajeCommit = argumentos || `chore: actualizacion desde WhatsApp (${new Date().toLocaleString('es-MX')})`;

    try {
      const { stdout: estadoRaw } = await exec('git status --porcelain -uall', { cwd: process.cwd() });
      const cambios = estadoRaw.split('\n').map((l) => l.trim()).filter(Boolean);

      if (!cambios.length) {
        return sock.sendMessage(jid, {
          text: advertencia('No hay ningun cambio nuevo que subir, todo esta igual que en GitHub.', { titulo: 'SIN CAMBIOS', estilo: 'neon' })
        });
      }

      const archivosJs = cambios
        .map((linea) => linea.slice(3).trim().split(' -> ').pop())
        .filter((archivo) => archivo.endsWith('.js'));

      const errores = [];
      for (const archivo of archivosJs) {
        try {
          await execFile('node', ['--check', archivo], { cwd: process.cwd() });
        } catch (errCheck) {
          const detalle = String(errCheck.stderr || errCheck.message || '').split('\n').filter(Boolean).slice(0, 2).join(' | ');
          errores.push(`${archivo}: ${detalle}`);
        }
      }

      if (errores.length) {
        return sock.sendMessage(jid, {
          text: caja(
            ['No subi nada porque estos archivos tienen errores:', '', ...errores, '', 'Corrigelos y vuelve a intentar.'],
            { titulo: 'REVISA ANTES DE SUBIR', estilo: 'neon' }
          )
        });
      }

      await sock.sendMessage(jid, { text: `⬆️ Subiendo ${cambios.length} cambio(s) a GitHub...` }, { quoted: msg });

      await exec('git add .', { cwd: process.cwd() });
      await execFile('git', ['commit', '-m', mensajeCommit], { cwd: process.cwd() });

      try {
        await exec('git push', { cwd: process.cwd() });
      } catch (errPush) {
        const detallePush = String(errPush.stderr || errPush.message || '');
        if (/set-upstream|no upstream branch/i.test(detallePush)) {
          const { stdout: rama } = await exec('git rev-parse --abbrev-ref HEAD', { cwd: process.cwd() });
          await exec(`git push --set-upstream origin ${rama.trim()}`, { cwd: process.cwd() });
        } else {
          throw errPush;
        }
      }

      const { stdout: hash } = await exec('git log -1 --format=%h', { cwd: process.cwd() });
      const listaArchivos = cambios.map((l) => `• ${l}`).join('\n');

      await sock.sendMessage(jid, {
        text: exito(
          `Commit ${hash.trim()} subido a GitHub.\n\nMensaje: "${mensajeCommit}"\n\nArchivos:\n${listaArchivos}\n\nNo olvides hacer *git pull* + reiniciar en tu VPS para que tambien lo tenga ahi.`,
          { titulo: 'SUBIDO A GITHUB', estilo: 'neon' }
        )
      });
    } catch (err) {
      console.error('[subircambios]', err);
      const detalle = String(err.stderr || err.message || '').slice(0, 800);
      await sock.sendMessage(jid, {
        text: cajaError(`Ocurrio un error subiendo los cambios: ${detalle}\n\nRevisa que el bot este dentro de un repositorio de git valido y con acceso configurado (SSH key o token) para hacer push sin pedir usuario/contrasena.`)
      });
    }
  }
};

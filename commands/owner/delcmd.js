const fs = require('fs');
const path = require('path');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { advertencia, exito, error: cajaError, caja } = require('../../lib/estilo');

const CARPETA_COMANDOS = path.join(__dirname, '..', '..', 'commands');
const CARPETA_ELIMINADOS = path.join(CARPETA_COMANDOS, '_eliminados');

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

module.exports = {
  name: 'delcmd',
  aliases: ['borrarcmd', 'eliminarcmd', 'desinstalarcmd'],
  category: 'owner',
  description: 'Quita un comando del bot (solo owner). No lo borra para siempre, lo manda a una carpeta de respaldo por si te arrepientes.',
  execute: async (sock, jid, msg, { prefix, texto, comandos }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);
    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const args = (texto || '').trim().split(/\s+/).slice(1);
    const nombreBuscado = normalizar(args[0]);
    if (!nombreBuscado) {
      return sock.sendMessage(jid, {
        text: advertencia(`Dime el nombre (o alias) del comando a quitar, ej:\n${prefix}delcmd 8ball`, { titulo: 'FALTA EL NOMBRE', estilo: 'neon' })
      });
    }

    const comando = comandos.get(nombreBuscado);
    if (!comando) {
      return sock.sendMessage(jid, {
        text: cajaError(`No encontre ningun comando llamado o con alias "${nombreBuscado}".`)
      });
    }

    if (comando.category === 'owner') {
      return sock.sendMessage(jid, {
        text: advertencia(
          `"${comando.name}" es un comando de la categoria owner (administracion del bot) y no se puede quitar con ${prefix}delcmd, para evitar que te quedes sin herramientas para manejarlo.\n\nSi de verdad quieres borrarlo, hazlo manual desde el archivo directamente.`,
          { titulo: 'PROTEGIDO', estilo: 'neon' }
        )
      });
    }

    const clavesAQuitar = [];
    for (const [clave, valor] of comandos.entries()) {
      if (valor === comando) clavesAQuitar.push(clave);
    }

    const rutaArchivo = comando._rutaArchivo;
    const objetosUnicosDelMismoArchivo = new Set();
    for (const valor of comandos.values()) {
      if (valor._rutaArchivo === rutaArchivo) objetosUnicosDelMismoArchivo.add(valor);
    }
    const archivoCompartido = objetosUnicosDelMismoArchivo.size > 1;

    for (const clave of clavesAQuitar) comandos.delete(clave);

    let notaArchivo;
    if (!rutaArchivo || !fs.existsSync(rutaArchivo)) {
      notaArchivo = 'No encontre el archivo en disco (puede que ya se hubiera movido antes); solo se quito de la memoria del bot.';
    } else if (archivoCompartido) {
      notaArchivo = 'Ese archivo tiene otros comandos adentro, asi que dejé el archivo intacto y solo desactive este comando en memoria. Si quieres borrarlo del archivo, editalo manualmente.';
    } else {
      if (!fs.existsSync(CARPETA_ELIMINADOS)) fs.mkdirSync(CARPETA_ELIMINADOS, { recursive: true });
      const nombreRespaldo = `${comando.category}__${comando.name}__${Date.now()}.js`;
      const rutaRespaldo = path.join(CARPETA_ELIMINADOS, nombreRespaldo);
      try {
        fs.renameSync(rutaArchivo, rutaRespaldo);
        notaArchivo = `El archivo se movio a commands/_eliminados/${nombreRespaldo} (no se borro para siempre, por si quieres recuperarlo a mano).`;
      } catch (err) {
        notaArchivo = `Se quito de memoria, pero no pude mover el archivo original (${err.message}).`;
      }
    }

    await sock.sendMessage(jid, {
      text: exito(
        `"${prefix}${comando.name}" quedo desactivado, ya no responde.\n\n${notaArchivo}\n\nSi quieres volver a intentarlo, usa ${prefix}addcmd o ${prefix}crearcmd de nuevo.`,
        { titulo: 'DELCMD', estilo: 'neon' }
      )
    });
  }
};

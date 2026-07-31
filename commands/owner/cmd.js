const fs = require('fs');
const path = require('path');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { caja, porCategoria } = require('../../lib/estilo');

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

module.exports = {
  name: 'cmd',
  aliases: ['code', 'fuente'],
  category: 'owner',
  description: 'Solo owner: lista todos los comandos, o manda el .js de uno. Uso: .cmd [nombre]',
  execute: async (sock, jid, msg, { texto, prefix, comandos }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);
    if (!autorizado) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' }, { quoted: msg });
    }

    const nombrePedido = texto.trim().split(/\s+/)[1];

    // --- Sin argumento: listar todos los comandos, agrupados por categoria ---
    if (!nombrePedido) {
      const vistos = new Set();
      const porCat = {};

      for (const comando of comandos.values()) {
        if (vistos.has(comando)) continue; // el Map repite el mismo objeto por cada alias
        vistos.add(comando);
        const cat = comando.category || 'general';
        if (!porCat[cat]) porCat[cat] = [];
        porCat[cat].push(comando.name);
      }

      const categoriasOrdenadas = Object.keys(porCat).sort();
      const lineas = [];
      let total = 0;
      for (const cat of categoriasOrdenadas) {
        const nombres = porCat[cat].sort();
        total += nombres.length;
        lineas.push(`*${cat.toUpperCase()}* (${nombres.length})`);
        lineas.push(nombres.join(', '));
        lineas.push('');
      }
      lineas.push(`Total: ${total} comandos`);
      lineas.push(`Usa "${prefix}cmd <nombre>" para pedir el archivo de uno.`);

      return sock.sendMessage(jid, {
        text: caja(lineas, { titulo: '📂 COMANDOS', estilo: porCategoria('owner') })
      });
    }

    // --- Con argumento: mandar el .js de ese comando (sin explicacion) ---
    const comando = comandos.get(normalizar(nombrePedido));

    if (!comando) {
      return sock.sendMessage(jid, {
        text: caja([`No encontre ningun comando llamado "${nombrePedido}".`, `Usa "${prefix}cmd" para ver la lista completa.`], { titulo: 'CMD', estilo: porCategoria('owner') })
      });
    }

    if (!comando._rutaArchivo || !fs.existsSync(comando._rutaArchivo)) {
      return sock.sendMessage(jid, {
        text: caja(['No pude encontrar el archivo fuente de ese comando en disco.'], { titulo: 'CMD', estilo: porCategoria('owner') })
      });
    }

    const codigo = fs.readFileSync(comando._rutaArchivo, 'utf-8');
    const rutaRelativa = path.relative(path.join(__dirname, '../..'), comando._rutaArchivo);
    const nombreArchivo = path.basename(comando._rutaArchivo);

    await sock.sendMessage(jid, {
      document: Buffer.from(codigo, 'utf-8'),
      fileName: nombreArchivo,
      mimetype: 'application/javascript',
      caption: caja(
        [`Comando: *${comando.name}*`, `Archivo: ${rutaRelativa}`, `Categoria: ${comando.category || 'general'}`],
        { titulo: '📄 CODIGO FUENTE', estilo: porCategoria('owner') }
      )
    }, { quoted: msg });
  }
};

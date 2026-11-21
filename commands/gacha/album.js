// .album  ->  tu album de gacha como LIBRO (misma estetica del .menupanel): portada + paginas de 5 piezas con foto, rareza y valor.
//   .album              tu album
//   .album @usuario     el album de otra persona (o respondiendo a su mensaje)
const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { llavePersona, objetivoDe } = require('../../lib/economiaid');
const album = require('../../lib/album-gacha');

module.exports = {
  name: 'album',
  aliases: ['albumgacha', 'mialbum'],
  category: 'gacha',
  description: 'Tu album de gacha como libro: 5 por pagina, con foto, rareza y valor. Uso: .album [@usuario]',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const objetivo = objetivoDe(msg) || remitente;
    const esPropio = objetivo === remitente;

    const db = leerDB();
    const llave = await llavePersona(sock, jid, db, objetivo);
    const perfil = getUsuario(db, llave);
    const numero = String(objetivo).split('@')[0].split(':')[0];
    const dueno = (esPropio && msg.pushName) || perfil.nombre || `+${numero}`;

    let piezas = album.reunirPiezas(perfil);
    if (!piezas.length) {
      return sock.sendMessage(jid, {
        text: esPropio
          ? '📖 Tu álbum está vacío. Consigue piezas con *.rollwaifu* o *.rollanime* y vuelve.'
          : `📖 El álbum de *${dueno}* está vacío.`
      }, { quoted: msg });
    }

    await sock.sendMessage(jid, { text: `📖 Abriendo el álbum de *${dueno}*...` }, { quoted: msg });

    // Waifus viejas sin foto guardada: se completan poco a poco (y se guardan para la proxima vez)
    await album.completarImagenes(piezas, (conFoto) => {
      const db2 = leerDB();
      const p2 = getUsuario(db2, llave);
      for (const w of p2.waifus || []) {
        if (w.imagen) continue;
        const hallada = conFoto.find((x) => x.tipo === 'waifu' && x.id === w.id && x.imagen);
        if (hallada) w.imagen = hallada.imagen;
      }
      for (const x of conFoto) {
        if (x.tipo !== 'anime' || !x.imagen) continue;
        if (!p2.gachaAnimeFotos) p2.gachaAnimeFotos = {};
        if (!p2.gachaAnimeFotos[x.nombre]) p2.gachaAnimeFotos[x.nombre] = x.imagen;
      }
      guardarDB(db2);
    }).catch(() => 0);

    try {
      const { html } = await album.armarAlbum({ piezas, dueno });
      await album.enviarHTML(sock, jid, `📖 ÁLBUM DE ${String(dueno).toUpperCase()}`, html);
    } catch (err) {
      console.error('[album] no se pudo mandar el libro:', err && err.message ? err.message : err);
      // Respaldo en texto: primera pagina de piezas
      const r = album.resumen(piezas);
      const lineas = piezas.slice(0, 15).map((p, i) => `${i + 1}. ${album.EMOJI_RAREZA[p.rareza]} *${p.nombre}*${p.copias > 1 ? ` x${p.copias}` : ''} — ${album.dinero(p.valor)}`);
      await sock.sendMessage(jid, {
        text: `📖 *ÁLBUM DE ${String(dueno).toUpperCase()}*\n🧩 ${r.total} piezas · 💰 ${album.dinero(r.valor)}\n\n${lineas.join('\n')}${piezas.length > 15 ? `\n… y ${piezas.length - 15} más` : ''}`
      }, { quoted: msg });
    }
  }
};

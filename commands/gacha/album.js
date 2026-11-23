// .album  ->  tu album de gacha como LIBRO (misma estetica del .menupanel). Toca una carta para verla en grande (✕ para volver).
//   .album            tu album (tomo 1)       .album 2            el tomo 2
//   .album @usuario   el album de otra persona (o respondiendo a su mensaje); tambien: .album @usuario 2
const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { llavePersona, objetivoDe } = require('../../lib/economiaid');
const album = require('../../lib/album-gacha');

module.exports = {
  name: 'album',
  aliases: ['albumgacha', 'mialbum'],
  category: 'gacha',
  description: 'Tu album de gacha como libro: 5 por pagina, con foto, rareza y valor; toca una carta para verla en grande. Uso: .album [tomo] [@usuario]',
  execute: async (sock, jid, msg, { texto, prefix } = {}) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const objetivo = objetivoDe(msg) || remitente;
    const esPropio = objetivo === remitente;
    const pedido = (String(texto || '').trim().split(/\s+/).slice(1).filter((x) => /^\d{1,3}$/.test(x)).pop());

    const db = leerDB();
    const llave = await llavePersona(sock, jid, db, objetivo);
    const perfil = getUsuario(db, llave);
    const numero = String(objetivo).split('@')[0].split(':')[0];
    const dueno = (esPropio && msg.pushName) || perfil.nombre || `+${numero}`;

    const piezas = album.reunirPiezas(perfil);
    if (!piezas.length) {
      return sock.sendMessage(jid, {
        text: esPropio
          ? '📖 Tu álbum está vacío. Consigue cartas con *.rollwaifu* o *.rollanime* y vuelve.'
          : `📖 El álbum de *${dueno}* está vacío.`
      }, { quoted: msg });
    }

    const totalTomos = Math.max(1, Math.ceil(piezas.length / album.PIEZAS_POR_TOMO));
    const tomo = Math.min(Math.max(1, parseInt(pedido, 10) || 1), totalTomos);
    const inicio = (tomo - 1) * album.PIEZAS_POR_TOMO;
    const delTomo = piezas.slice(inicio, inicio + album.PIEZAS_POR_TOMO);

    await sock.sendMessage(jid, { text: `📖 Abriendo el álbum de *${dueno}*${totalTomos > 1 ? ` (tomo ${tomo}/${totalTomos})` : ''}...` }, { quoted: msg });

    await Promise.all([
      album.completarImagenes(delTomo, (conFoto) => {
        const db2 = leerDB();
        const p2 = getUsuario(db2, llave);
        for (const w of p2.waifus || []) {
          if (w.imagen) continue;
          const hallada = conFoto.find((x) => x.tipo === 'waifu' && x.id === w.id && x.imagen);
          if (hallada) w.imagen = hallada.imagen;
        }
        guardarDB(db2);
      }).catch(() => 0),
      album.completarImagenesAnime(delTomo, (nuevas) => {
        const db2 = leerDB();
        const p2 = getUsuario(db2, llave);
        if (!p2.imagenesAnime) p2.imagenesAnime = {};
        for (const n of nuevas) {
          if (!p2.imagenesAnime[n.nombre]) p2.imagenesAnime[n.nombre] = [];
          p2.imagenesAnime[n.nombre].push(n.url);
        }
        guardarDB(db2);
      }).catch(() => 0)
    ]);

    try {
      const { html } = await album.armarAlbum({ piezas, dueno, tomo, prefix: prefix || '.' });
      await album.enviarHTML(sock, jid, `📖 ÁLBUM DE ${String(dueno).toUpperCase()}`, html);
    } catch (err) {
      console.error('[album] no se pudo mandar el libro:', err && err.message ? err.message : err);
      const r = album.resumen(piezas);
      const lineas = piezas.slice(0, 15).map((p, i) => `${i + 1}. ${album.EMOJI_RAREZA[p.rareza]} *${p.nombre}* — ${album.dinero(p.valor)}`);
      await sock.sendMessage(jid, {
        text: `📖 *ÁLBUM DE ${String(dueno).toUpperCase()}*\n🧩 ${r.total} cartas · 💰 ${album.dinero(r.valor)}\n\n${lineas.join('\n')}${piezas.length > 15 ? `\n… y ${piezas.length - 15} más` : ''}`
      }, { quoted: msg });
    }
  }
};

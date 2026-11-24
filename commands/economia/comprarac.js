const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const T = require('../../lib/tiendaperfil');
const { llaveRemitente } = require('../../lib/economiaid');
const { reproducir, marco, ocupar, liberar } = require('../../lib/cuadros');

module.exports = {
  name: 'comprarac',
  aliases: ['compraraccesorio'],
  category: 'economia',
  description: 'Compra un accesorio para tu perfil. Ej: .comprarac 8  o  .comprarac lentes de sol',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const consulta = T.argumentosDe(texto, prefix);

    if (!consulta) {
      return sock.sendMessage(jid, { text: `🛍️ Dime que accesorio quieres.\nMira la tienda con *${prefix}accesorios* y usa *${prefix}comprarac <numero o nombre>*.` }, { quoted: msg });
    }

    const r = T.buscar(T.ACCESORIOS, consulta);
    if (r.error === 'varios') {
      return sock.sendMessage(jid, { text: `🤔 Encontre varios:\n${r.opciones.map(o => `• ${o.nombre} (${prefix}comprarac ${T.ACCESORIOS.indexOf(o) + 1})`).join('\n')}\n\nUsa el numero para elegir uno.` }, { quoted: msg });
    }
    if (r.error) {
      return sock.sendMessage(jid, { text: `❌ No encontre ese accesorio. Mira la tienda con *${prefix}accesorios*.` }, { quoted: msg });
    }
    const acc = r.item;

    const db = leerDB();
    const usuario = T.datosAccesorios(getUsuario(db, await llaveRemitente(sock, jid, db, msg)));

    if (usuario.accesorios.includes(acc.id)) {
      return sock.sendMessage(jid, { text: `✅ Ya tienes *${acc.nombre}*. Ponetelo con *${prefix}equipar ${T.ACCESORIOS.indexOf(acc) + 1}*.` }, { quoted: msg });
    }

    if (!T.cobrar(usuario, acc.precio)) {
      const falta = acc.precio - (usuario.saldo || 0);
      return sock.sendMessage(jid, {
        text: `💸 *${acc.nombre}* cuesta ${T.dinero(acc.precio)} y en mano tienes ${T.dinero(usuario.saldo)}.\nTe faltan ${T.dinero(falta)}. (Puedes sacar del banco con *${prefix}banco sacar <monto>*)`
      }, { quoted: msg });
    }

    usuario.accesorios.push(acc.id);
    const slot = T.SLOTS.find(s => s.id === acc.slot);
    let nota;
    const lleno = acc.slot !== 'titulo' && T.visiblesDe(usuario).length >= T.MAX_PUESTOS;
    if (!usuario.accEquipados[acc.slot] && !lleno) {
      usuario.accEquipados[acc.slot] = acc.id;
      nota = `Ya lo llevas puesto: aparece sobre tu foto en el *${prefix}perfil* ✨`;
    } else if (!usuario.accEquipados[acc.slot] && lleno) {
      nota = `Ya llevas ${T.MAX_PUESTOS} accesorios puestos. Quita uno con *${prefix}desequipar* y ponte este con *${prefix}equipar ${T.ACCESORIOS.indexOf(acc) + 1}*.`;
    } else {
      nota = `Ya llevas otro en ${slot.etiqueta}. Cambialo cuando quieras con *${prefix}equipar ${T.ACCESORIOS.indexOf(acc) + 1}*.`;
    }
    guardarDB(db);

    const yo = `@${remitente.split('@')[0]}`;
    const titulo = '🛍️ *TIENDA DE ACCESORIOS* 🛍️';
    const cab = `${yo} compra ${acc.emoji} *${acc.nombre}*`;
    const final = `✨ *¡COMPRA EXITOSA!* ✨\n\n${acc.emoji} *${acc.nombre}* (${slot.etiqueta})\n💸 Pagaste: ${T.dinero(acc.precio)}\n💰 Te quedan: ${T.dinero(usuario.saldo)}\n\n${nota}`;
    const barra = (p) => '▰'.repeat(Math.round(p * 10)) + '▱'.repeat(10 - Math.round(p * 10));
    if (!ocupar(remitente)) return sock.sendMessage(jid, { text: final, mentions: [remitente] }, { quoted: msg });
    try {
      await reproducir(sock, jid, [
        marco(titulo, [cab, '', '🧾 Pasando por caja...', barra(0.2)]),
        marco(titulo, [cab, '', '📦 Empacando tu accesorio...', barra(0.5)]),
        marco(titulo, [cab, '', '🎀 Ya casi...', barra(0.8)]),
        marco(titulo, [cab, '', '✨  🌟  ✨  🌟  ✨', `      ${acc.emoji}`, '✨  🌟  ✨  🌟  ✨', '', barra(1)]),
        { texto: final }
      ], { quoted: msg, pausaMs: 800, mentions: [remitente] });
    } finally {
      liberar(remitente);
    }
  }
};

// ACCESORIOS-FOTO

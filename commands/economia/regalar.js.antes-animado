const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const T = require('../../lib/tiendaperfil');
const { REACCIONES, EFECTOS, nivelDe } = require('../../lib/regalosdata');

const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];
const llenar = (t, de, para) => String(t).split('{de}').join(de).split('{para}').join(para);

module.exports = {
  name: 'regalar',
  aliases: ['regalo'],
  category: 'economia',
  description: 'Manda un regalo a tu pareja (el bot la etiqueta). Ej: .regalar 5  o  .regalar rosa',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const consulta = T.argumentosDe(texto, prefix);

    const db = leerDB();
    const usuario = getUsuario(db, remitente);

    if (!usuario.pareja) {
      return sock.sendMessage(jid, { text: `💍 Necesitas estar casado/a para mandar regalos a tu pareja.\nUsa *${prefix}casar @persona* para proponer matrimonio.` }, { quoted: msg });
    }

    if (!consulta) {
      return sock.sendMessage(jid, { text: `🎁 Dime cual regalo quieres mandar.\nMira la lista con *${prefix}regalos* y usa *${prefix}regalar <numero o nombre>*.` }, { quoted: msg });
    }

    const r = T.buscar(T.REGALOS, consulta);
    if (r.error === 'varios') {
      return sock.sendMessage(jid, { text: `🤔 Encontre varios:\n${r.opciones.map(o => `• ${o.nombre} (${prefix}regalar ${T.REGALOS.indexOf(o) + 1})`).join('\n')}\n\nUsa el numero para elegir uno.` }, { quoted: msg });
    }
    if (r.error) {
      return sock.sendMessage(jid, { text: `❌ No encontre ese regalo. Mira la lista con *${prefix}regalos*.` }, { quoted: msg });
    }
    const regalo = r.item;

    if (!T.cobrar(usuario, regalo.precio)) {
      const falta = regalo.precio - (usuario.saldo || 0);
      return sock.sendMessage(jid, {
        text: `💸 *${regalo.nombre}* cuesta ${T.dinero(regalo.precio)} y en mano tienes ${T.dinero(usuario.saldo)}.\nTe faltan ${T.dinero(falta)}. (Puedes sacar del banco con *${prefix}banco sacar <monto>*)`
      }, { quoted: msg });
    }
    guardarDB(db);

    const pareja = usuario.pareja;
    const de = `@${remitente.split('@')[0]}`;
    const para = `@${pareja.split('@')[0]}`;
    const nivel = nivelDe(regalo.precio);

    try {
      try { await sock.sendMessage(jid, { react: { text: regalo.emoji, key: msg.key } }); } catch (e) { /* no critico */ }

      await sock.sendMessage(jid, {
        text: `🎁 ${de} esta preparando una sorpresa muy especial${nivel === 'legendario' ? '... algo que nadie habia visto jamas' : ''}... ✨`,
        mentions: [remitente]
      }, { quoted: msg });

      await T.esperar(nivel === 'legendario' ? 2500 : 1500);

      const reaccion = llenar(elegir(REACCIONES[nivel]), de, para);
      const adorno = regalo.emoji + ' ';
      const textoFinal =
        `${EFECTOS[nivel]}\n\n` +
        `💝 *¡REGALO DE AMOR!* 💝\n\n` +
        `${de} le manda a ${para}:\n` +
        `${adorno.repeat(3).trim()}\n` +
        `*${regalo.nombre.toUpperCase()}*\n` +
        `${adorno.repeat(3).trim()}\n\n` +
        `_${llenar(regalo.frase, de, para)}_\n\n` +
        `${reaccion}\n\n` +
        `${EFECTOS[nivel]}\n` +
        `💸 Costo: ${T.dinero(regalo.precio)}`;

      await sock.sendMessage(jid, { text: textoFinal, mentions: [remitente, pareja] }, { quoted: msg });
    } catch (err) {
      // Si no se pudo enviar el regalo, se devuelve el dinero para que no se pierda.
      console.error('[regalar] fallo el envio, se devuelve el dinero:', err);
      const dbRef = leerDB();
      getUsuario(dbRef, remitente).saldo += regalo.precio;
      guardarDB(dbRef);
      await sock.sendMessage(jid, { text: '😵 No pude enviar el regalo, te devolvi tu dinero. Intenta otra vez.' }, { quoted: msg }).catch(() => {});
    }
  }
};

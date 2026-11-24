const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const T = require('../../lib/tiendaperfil');
const { REACCIONES, EFECTOS, nivelDe } = require('../../lib/regalosdata');
const { reproducir, ocupar, liberar } = require('../../lib/cuadros');
const { crearCuadros, PAUSA } = require('../../lib/regaloanim');
const V = require('../../lib/regalosvariantes');

// Escoge un texto que esta persona NO haya visto todavía (guarda lo ya visto en su ficha). Al agotarlos, reinicia sin repetir el último.
function elegirNuevo(usuario, grupo, clave, lista) {
  if (!usuario.regaloHist || typeof usuario.regaloHist !== 'object') usuario.regaloHist = {};
  const h = usuario.regaloHist[grupo] = usuario.regaloHist[grupo] || {};
  let usados = Array.isArray(h[clave]) ? h[clave].filter((i) => i >= 0 && i < lista.length) : [];
  let libres = lista.map((_, i) => i).filter((i) => !usados.includes(i));
  if (!libres.length) {
    const ultimo = usados[usados.length - 1];
    usados = [];
    libres = lista.map((_, i) => i).filter((i) => i !== ultimo || lista.length === 1);
  }
  const idx = libres[Math.floor(Math.random() * libres.length)];
  h[clave] = [...usados, idx];
  return lista[idx];
}
const llenar = (t, de, para) => String(t).split('{de}').join(de).split('{para}').join(para);

module.exports = {
  name: 'regalar',
  aliases: ['regalo'],
  category: 'economia',
  description: 'Manda un regalo animado a tu pareja (el bot la etiqueta y va editando el mensaje). Ej: .regalar 5  o  .regalar rosa',
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

    // una sola escena a la vez por persona (así no se encimen dos regalos)
    if (!ocupar(remitente)) {
      return sock.sendMessage(jid, { text: '⏳ Espera a que termine tu regalo anterior.' }, { quoted: msg });
    }
    let cobrado = false;
    try {
      if (!T.cobrar(usuario, regalo.precio)) {
        const falta = regalo.precio - (usuario.saldo || 0);
        return await sock.sendMessage(jid, {
          text: `💸 *${regalo.nombre}* cuesta ${T.dinero(regalo.precio)} y en mano tienes ${T.dinero(usuario.saldo)}.\nTe faltan ${T.dinero(falta)}. (Puedes sacar del banco con *${prefix}banco sacar <monto>*)`
        }, { quoted: msg });
      }
      const nivel = nivelDe(regalo.precio);
      // textos que esta persona no haya visto con este regalo (frase, reacción y título de la escena)
      const fraseElegida = elegirNuevo(usuario, 'frase', regalo.id, [regalo.frase, ...(V.FRASES[regalo.id] || [])]);
      const reaccionElegida = elegirNuevo(usuario, 'reaccion', nivel, [...REACCIONES[nivel], ...V.REACCIONES_EXTRA[nivel]]);
      const encabezadoElegido = elegirNuevo(usuario, 'encabezado', nivel, V.ENCABEZADOS[nivel]);
      const prepElegida = elegirNuevo(usuario, 'prep', 'general', V.PREPARACION);
      guardarDB(db);
      cobrado = true;

      const pareja = usuario.pareja;
      const de = `@${remitente.split('@')[0]}`;
      const para = `@${pareja.split('@')[0]}`;

      try { await sock.sendMessage(jid, { react: { text: regalo.emoji, key: msg.key } }); } catch (e) { /* no critico */ }

      const cuadros = crearCuadros({
        regalo, nivel, de, para,
        frase: llenar(fraseElegida, de, para),
        reaccion: llenar(reaccionElegida, de, para),
        encabezado: encabezadoElegido,
        preparacion: prepElegida,
        efecto: EFECTOS[nivel],
        costo: T.dinero(regalo.precio)
      });
      await reproducir(sock, jid, cuadros, { quoted: msg, pausaMs: PAUSA[nivel], mentions: [remitente, pareja] });
      cobrado = false; // ya se entregó
    } catch (err) {
      console.error('[regalar] fallo el envio:', err);
      if (cobrado) {
        // Si no se pudo enviar el regalo, se devuelve el dinero para que no se pierda.
        try {
          const dbRef = leerDB();
          getUsuario(dbRef, remitente).saldo += regalo.precio;
          guardarDB(dbRef);
          await sock.sendMessage(jid, { text: '😵 No pude enviar el regalo, te devolvi tu dinero. Intenta otra vez.' }, { quoted: msg });
        } catch (_) { /* sin conexión */ }
      }
    } finally {
      liberar(remitente);
    }
  }
};

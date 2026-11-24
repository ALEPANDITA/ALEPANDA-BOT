const { leerDB, getUsuario } = require('../../lib/db');
const { llaveRemitente } = require('../../lib/economiaid');
const T = require('../../lib/tiendaperfil');
const { TEMAS } = require('../../lib/perfilcard');

async function descargarAvatar(sock, id) {
  try {
    const url = await Promise.race([sock.profilePictureUrl(id, 'image'), new Promise((r) => setTimeout(() => r(null), 4000))]);
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 100 ? buf : null;
  } catch (_) { return null; }
}

module.exports = {
  name: 'accesorios',
  aliases: ['accesorio', 'tiendaperfil'],
  category: 'economia',
  description: 'Tienda de accesorios que se dibujan sobre tu foto de perfil (de $1,000 a $100,000,000). ".accesorios mis" = los tuyos, ".accesorios ver 5" = pruebatelo',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const llave = await llaveRemitente(sock, jid, db, msg);
    const usuario = T.datosAccesorios(getUsuario(db, llave));
    const argTexto = T.argumentosDe(texto, prefix);
    const arg = T.norm(argTexto);

    // ---- vista previa: .accesorios ver <numero o nombre> ----
    if (/^(ver|probar|prueba|preview)\b/.test(arg)) {
      const consulta = argTexto.replace(/^\S+\s*/, '');
      const r = T.buscar(T.ACCESORIOS, consulta);
      if (r.error === 'varios') return sock.sendMessage(jid, { text: `🤔 Encontre varios:\n${r.opciones.map(o => `• ${o.nombre} (${prefix}accesorios ver ${T.ACCESORIOS.indexOf(o) + 1})`).join('\n')}` }, { quoted: msg });
      if (r.error) return sock.sendMessage(jid, { text: `Uso: *${prefix}accesorios ver <numero o nombre>*  (mira los numeros en *${prefix}accesorios*)` }, { quoted: msg });
      const acc = r.item;
      try {
        const { crearVista } = require('../../lib/accesorioart');
        const puestos = T.visiblesDe(usuario).filter(a => a.slot !== acc.slot).map(a => a.id);
        const ids = acc.slot === 'titulo' ? puestos : [...puestos, acc.id];
        const avatar = await descargarAvatar(sock, remitente);
        const tema = TEMAS[usuario.perfilTema] || TEMAS.rosa;
        const png = await crearVista({ avatar, ids, marco: 'circulo', tema, inicial: usuario.perfilNombre || msg.pushName || '?' });
        const tengo = usuario.accesorios.includes(acc.id);
        return sock.sendMessage(jid, { image: png, caption: `👀 *${acc.nombre}* en tu foto\n💸 ${T.dinero(acc.precio)}${tengo ? '  ✅ ya lo tienes' : ''}\n${tengo ? `Ponértelo: *${prefix}equipar ${T.ACCESORIOS.indexOf(acc) + 1}*` : `Comprarlo: *${prefix}comprarac ${T.ACCESORIOS.indexOf(acc) + 1}*`}` }, { quoted: msg });
      } catch (e) {
        console.error('[accesorios] vista previa:', e && e.message ? e.message : e);
        return sock.sendMessage(jid, { text: `${acc.emoji} *${acc.nombre}* — ${T.dinero(acc.precio)}\n(No pude dibujar la vista previa ahora.)` }, { quoted: msg });
      }
    }

    if (arg === 'mis' || arg === 'mios' || arg === 'mio' || arg === 'inventario') {
      if (!usuario.accesorios.length) {
        return sock.sendMessage(jid, { text: `🎒 Todavia no tienes accesorios.\nMira la tienda con *${prefix}accesorios*.` }, { quoted: msg });
      }
      const lineas = [`🎒 *TUS ACCESORIOS*  (puestos: ${T.visiblesDe(usuario).length}/${T.MAX_PUESTOS})`, ''];
      for (const slot of T.SLOTS) {
        const mios = T.ACCESORIOS.filter(a => a.slot === slot.id && usuario.accesorios.includes(a.id));
        for (const a of mios) {
          const puesto = usuario.accEquipados[slot.id] === a.id ? ' ✅ puesto' : '';
          lineas.push(`*${T.ACCESORIOS.indexOf(a) + 1}.* ${a.emoji} ${a.nombre} (${slot.etiqueta})${puesto}`);
        }
      }
      lineas.push('', `Ponerte uno: *${prefix}equipar <numero o nombre>*`, `Quitarte uno: *${prefix}desequipar <numero, nombre o espacio>*`, `Puedes llevar *${T.MAX_PUESTOS}* a la vez sobre tu foto (el titulo no cuenta).`);
      return sock.sendMessage(jid, { text: lineas.join('\n') }, { quoted: msg });
    }

    const lineas = ['🛍️ *TIENDA DE ACCESORIOS* 🛍️', `Se dibujan sobre tu foto del *${prefix}perfil*. Llevas ${T.visiblesDe(usuario).length}/${T.MAX_PUESTOS}.`, ''];
    for (const slot of T.SLOTS) {
      lineas.push(`*${slot.etiqueta.toUpperCase()}*`);
      for (const a of T.ACCESORIOS.filter(x => x.slot === slot.id)) {
        const tengo = usuario.accesorios.includes(a.id) ? ' ✅' : '';
        lineas.push(`*${T.ACCESORIOS.indexOf(a) + 1}.* ${a.emoji} ${a.nombre} — ${T.dinero(a.precio)}${tengo}`);
      }
      lineas.push('');
    }
    lineas.push(`Probártelo en tu foto: *${prefix}accesorios ver <numero>*`);
    lineas.push(`Comprar: *${prefix}comprarac <numero o nombre>*`);
    lineas.push(`Tus accesorios: *${prefix}accesorios mis*`);
    lineas.push(`Puedes llevar ${T.MAX_PUESTOS} a la vez (uno por espacio) ✨`);

    await sock.sendMessage(jid, { text: lineas.join('\n') }, { quoted: msg });
  }
};

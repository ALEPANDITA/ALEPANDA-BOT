const { leerDB, getUsuario, claveCanonica } = require('../../lib/db');
const { formatearCumple, edadDe } = require('../../lib/cumple');

const TEMAS = { rosa: '🌸', azul: '💙', morado: '💜', verde: '💚', rojo: '❤️', dorado: '✨', negro: '🖤', naranja: '🧡', amarillo: '💛' };
const num = (j) => String(j || '').split('@')[0].split(':')[0];
const tag = (j) => '@' + num(j);

// Nombre guardado en la base (nombre de WhatsApp o registro). Se busca a la persona por TODAS sus formas de id
// (llave unica de la economia, indice del registro, numero real y @lid): antes solo probaba una y por eso a veces no salia.
function nombreConocido(db, id) {
  try {
    const n = num(id);
    const llaves = [claveCanonica(db, id), db.registroIndice && db.registroIndice[n], `${n}@s.whatsapp.net`, id, `${n}@lid`];
    for (const llave of llaves) {
      const u = llave && db.usuarios && db.usuarios[llave];
      const nombre = u && (u.nombre || (u.registro && u.registro.nombre));
      if (nombre) return nombre;
    }
    return null;
  } catch (_) { return null; }
}

async function descargarAvatar(sock, id) {
  try {
    const url = await Promise.race([
      sock.profilePictureUrl(id, 'image'),
      new Promise((r) => setTimeout(() => r(null), 4000))
    ]);
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 100 ? buf : null;
  } catch (_) { return null; }
}

module.exports = {
  name: 'perfil',
  category: 'perfil',
  description: 'Muestra tu perfil o el de alguien mencionado en una tarjeta (boda, hijos y mas). Personalizalo con .editarperfil',
  execute: async (sock, jid, msg) => {
    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const remitente = msg.key.participant || msg.key.remoteJid;
    const objetivo = mencionado || citado || remitente;

    const db = leerDB();
    const usuario = getUsuario(db, objetivo);
    // Nombre de cada persona de la tarjeta: se llena mas abajo ("nombres"). Sin nombre se muestra su numero real, nunca el @lid.
    const nombres = new Map();
    const nombreDe = (id) => nombres.get(id) || nombreConocido(db, id) || (String(id).endsWith('@s.whatsapp.net') ? '+' + num(id) : 'Usuario');

    const tema = TEMAS[usuario.perfilTema] ? usuario.perfilTema : 'rosa';
    const genero = usuario.genero ? usuario.genero.charAt(0).toUpperCase() + usuario.genero.slice(1) : '';
    let cumple = '';
    if (usuario.cumple) {
      const edad = edadDe(usuario.cumple);
      cumple = formatearCumple(usuario.cumple) + (edad !== null ? ` (${edad} años)` : '');
    }

    let boda = null;
    if (usuario.pareja) {
      const abierto = [...(usuario.historialMatrimonial || [])].reverse().find((h) => !h.fin);
      if (abierto && abierto.inicio) {
        boda = {
          fecha: new Date(abierto.inicio).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Tijuana' }),
          dias: Math.max(0, Math.floor((Date.now() - abierto.inicio) / 86400000))
        };
      }
    }
    const hijos = Array.isArray(usuario.hijos) ? usuario.hijos : [];
    const padres = Array.isArray(usuario.padres) ? usuario.padres : [];

    // Busca el nombre de quien sale en la tarjeta (pareja, hijos, padres): el de WhatsApp o el registro (por numero o @lid)
    // y, si no se sabe, el del grupo; si de plano no hay nombre, su numero real.
    {
      const mismaPersona = (a, b) => num(a) === num(b) || claveCanonica(db, a) === claveCanonica(db, b);
      let meta = null;
      for (const id of new Set([objetivo, usuario.pareja, ...hijos, ...padres].filter(Boolean))) {
        let nombre = (mismaPersona(id, remitente) && msg.pushName) || nombreConocido(db, id);
        if (!nombre) {
          if (meta === null) { try { meta = String(jid).endsWith('@g.us') ? await sock.groupMetadata(jid) : false; } catch (_) { meta = false; } }
          const ficha = meta && meta.participants ? meta.participants.find((p) => [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean).some((x) => num(x) === num(id))) : null;
          const real = ficha && ficha.phoneNumber ? num(ficha.phoneNumber) : (String(id).endsWith('@s.whatsapp.net') ? num(id) : null);
          nombre = (ficha && (ficha.name || ficha.notify)) || (real ? '+' + real : 'Usuario');
        }
        nombres.set(id, nombre);
      }
    }

    // ===== Tarjeta en imagen =====
    try {
      const { crearPerfil } = require('../../lib/perfilcard');
      let avatar = null;
      if (usuario.perfilFoto) {
        try { const rf = require('path').join(__dirname, '..', '..', 'database', 'perfil-fotos', usuario.perfilFoto); if (require('fs').existsSync(rf)) avatar = require('fs').readFileSync(rf); } catch (_) { avatar = null; }
      }
      if (!avatar) avatar = await descargarAvatar(sock, objetivo);
      let banner = null;
      if (usuario.perfilBanner) {
        try { const rb = require('path').join(__dirname, '..', '..', 'database', 'perfil-fotos', usuario.perfilBanner); if (require('fs').existsSync(rb)) banner = require('fs').readFileSync(rb); } catch (_) { banner = null; }
      }
      const png = await crearPerfil({
        nombre: usuario.perfilNombre || nombreDe(objetivo),
        titulo: usuario.perfilTitulo || '',
        desc: usuario.descripcion || '',
        genero,
        cumple,
        tema,
        avatar,
        marco: usuario.perfilMarco || 'circulo',
        banner,
        tamano: usuario.perfilTamano || 'grande',
        fotoTam: usuario.perfilFotoTam || 'grande',
        saldo: usuario.saldo || 0,
        banco: usuario.banco || 0,
        warns: usuario.warns || 0,
        pareja: usuario.pareja ? nombreDe(usuario.pareja) : null,
        boda,
        hijos: hijos.map(nombreDe),
        padres: padres.map(nombreDe)
      });
      return await sock.sendMessage(jid, { image: png, caption: `${usuario.perfilEmoji || TEMAS[tema]} Perfil de ${tag(objetivo)}`, mentions: [objetivo] }, { quoted: msg });
    } catch (err) {
      console.error('[perfil] No pude dibujar la tarjeta, mando texto:', err && err.message ? err.message : err);
    }

    // ===== Respaldo en texto (si falla el dibujo) =====
    const menciones = [objetivo];
    let extras = '';
    if (usuario.perfilTitulo) extras += `🏷️ *${usuario.perfilTitulo}*\n`;
    if (usuario.descripcion) extras += `📝 ${usuario.descripcion}\n`;
    if (genero) extras += `🚻 Genero: ${genero}\n`;
    if (cumple) extras += `🎂 Cumpleaños: ${cumple}\n`;
    let familia = '';
    if (usuario.pareja) {
      menciones.push(usuario.pareja);
      familia += `💍 Casado/a con: ${tag(usuario.pareja)}\n`;
      familia += boda ? `📅 Se casaron el ${boda.fecha}\n💞 Llevan *${boda.dias} día${boda.dias === 1 ? '' : 's'}* de casados\n` : '📅 _Fecha de la boda no registrada_\n';
    } else familia += '💍 Estado: Soltero/a\n';
    if (hijos.length) { menciones.push(...hijos); familia += `👶 Hijos (${hijos.length}): ${hijos.map(tag).join(', ')}\n`; }
    if (padres.length) { menciones.push(...padres); familia += `👪 Padres: ${padres.map(tag).join(' y ')}\n`; }
    await sock.sendMessage(jid, {
      text: `${usuario.perfilEmoji || TEMAS[tema]} *PERFIL* ${usuario.perfilEmoji || TEMAS[tema]}\n\nUsuario: ${tag(objetivo)}\n${extras}\n${familia}\n💰 Saldo: ${usuario.saldo || 0}\n🏦 Banco: $${usuario.banco || 0}\n⚠️ Warns: ${usuario.warns || 0}`,
      mentions: [...new Set(menciones)]
    });
  }
};

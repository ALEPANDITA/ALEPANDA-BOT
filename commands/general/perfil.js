const { leerDB, getUsuario } = require('../../lib/db');
const { formatearCumple, edadDe } = require('../../lib/cumple');

const TEMAS = { rosa: '🌸', azul: '💙', morado: '💜', verde: '💚', rojo: '❤️', dorado: '✨', negro: '🖤', naranja: '🧡', amarillo: '💛' };
const num = (j) => String(j || '').split('@')[0].split(':')[0];
const tag = (j) => '@' + num(j);

// Nombre guardado en la base (registro) o, si no hay, el numero
function nombreConocido(db, id) {
  try {
    const n = num(id);
    const llave = (db.registroIndice && db.registroIndice[n]) || `${n}@s.whatsapp.net`;
    const u = (db.usuarios && (db.usuarios[llave] || db.usuarios[id])) || null;
    return (u && (u.nombre || (u.registro && u.registro.nombre))) || null;
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
  category: 'general',
  description: 'Muestra tu perfil o el de alguien mencionado en una tarjeta (boda, hijos y mas). Personalizalo con .editarperfil',
  execute: async (sock, jid, msg) => {
    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const remitente = msg.key.participant || msg.key.remoteJid;
    const objetivo = mencionado || citado || remitente;

    const db = leerDB();
    const usuario = getUsuario(db, objetivo);
    const nombreDe = (id) => (id === remitente && msg.pushName) || nombreConocido(db, id) || ('+' + num(id));

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

    // ===== Tarjeta en imagen =====
    try {
      const { crearPerfil } = require('../../lib/perfilcard');
      const avatar = await descargarAvatar(sock, objetivo);
      const png = await crearPerfil({
        nombre: nombreDe(objetivo),
        titulo: usuario.perfilTitulo || '',
        desc: usuario.descripcion || '',
        genero,
        cumple,
        tema,
        avatar,
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

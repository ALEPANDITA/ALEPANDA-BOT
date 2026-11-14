const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { halloweenActivo } = require('../../lib/estilo');
const { seccionesOwner } = require('../../lib/menuowner');

const BULLETS_HW = ['🎃', '👻', '🦇', '🕷️', '💀', '🕯️'];
const SEPARADOR_HW = '🕸️━━━━━━━━━━━━━━━━━━━🕸️';
const CIERRE_HW = '🦇━━━━━━━━━━━━━━━━━━━🦇';

function recortar(texto = '', max = 90) {
  const t = String(texto || '').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

// En el menu owner "(solo owner)" sobra: todo lo de aqui es solo para owners.
function limpiarDescripcion(texto = '') {
  const limpio = String(texto)
    .replace(/\s*\(solo owners?\)/gi, '')
    .replace(/^solo owners?:\s*/i, '')
    .replace(/\s*solo owners?\.?$/i, '')
    .trim();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

function renderizarSeccion(sec, prefix, emojiComando, hw) {
  const linea = (c, bullet) => {
    const alias = c.aliases?.length ? ` _(${c.aliases.map((a) => prefix + a).join(', ')})_` : '';
    const desc = recortar(limpiarDescripcion(c.description) || 'Sin descripcion');
    return hw
      ? `${bullet} ${emojiComando} *${prefix}${c.name}*${alias}\n    ↳ _${desc}_\n`
      : `│ ${emojiComando} *${prefix}${c.name}*${alias}\n│   _${desc}_\n`;
  };

  if (hw) {
    let b = `${SEPARADOR_HW}\n${sec.emoji} *${sec.titulo}*\n${SEPARADOR_HW}\n`;
    sec.lista.forEach((c, i) => { b += linea(c, BULLETS_HW[i % BULLETS_HW.length]); });
    return `${b}${CIERRE_HW}\n\n`;
  }
  let b = `╭── ${sec.emoji} *${sec.titulo}* (${sec.lista.length}) ──╮\n`;
  for (const c of sec.lista) b += linea(c);
  return `${b}╰${'─'.repeat(22)}╯\n\n`;
}

module.exports = {
  name: 'menuowner',
  aliases: ['ownermenu'],
  category: 'owner',
  description: 'Menu con todos los comandos de owner',
  // index.js: si quien lo escribe no es owner, ni reacciona ni responde (silencio total).
  silencioNoOwner: true,
  execute: async (sock, jid, msg, { prefix, comandos }) => {
    // Doble seguro (index.js ya filtra): quien no sea owner no recibe NADA.
    if (!(await esOwnerBot(sock, leerConfig(), msg))) return;

    const emojiComando = leerConfig().menuEmoji || '🪄';
    const secciones = seccionesOwner(comandos);
    const total = secciones.reduce((n, s) => n + s.lista.length, 0);
    const hw = halloweenActivo();

    let texto;
    if (hw) {
      texto = `🕸️🕸️🕸️🕸️🕸️🕸️🕸️🕸️🕸️🕸️🕸️\n`;
      texto += `   👑 *MENU OWNER* 👑\n`;
      texto += `🦇 _Solo para el Alfa del clan_ 🦇\n`;
      texto += `🕸️🕸️🕸️🕸️🕸️🕸️🕸️🕸️🕸️🕸️🕸️\n`;
      texto += `🕷️ Prefijo: [ ${prefix} ]\n`;
      texto += `🎃 Comandos de owner: ${total}\n\n`;
    } else {
      texto = `╭─────────────────────╮\n`;
      texto += `   👑 *MENU OWNER* 👑\n`;
      texto += `   _Solo para el Alfa del clan_\n`;
      texto += `╰─────────────────────╯\n`;
      texto += `▸ Prefijo: [ ${prefix} ]\n`;
      texto += `▸ Comandos de owner: ${total}\n`;
      texto += `─────────────────────────\n\n`;
    }

    for (const sec of secciones) texto += renderizarSeccion(sec, prefix, emojiComando, hw);

    texto += hw ? `🕯️━━━━━━━━━━━━━━━━━━━🕯️\n🐼 Con garra y sin miedo.` : `─────────────────────────\n🐼 Con garra y sin miedo.`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  }
};

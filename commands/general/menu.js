const { leerConfig } = require('../../lib/config');
const { halloweenActivo } = require('../../lib/estilo');
const fs = require('fs');
const path = require('path');

const menuMedia = require('../../lib/menumedia');

// Cache en memoria del buffer del menu (video o imagen), para no releer el
// archivo del disco entero en CADA .menu que pidan. Se invalida solo si el
// archivo cambia (por .setmenuvideo/.setmenuimg/.delmenuvideo/.delmenuimg),
// comparando la fecha de modificacion, asi que sigue actualizandose bien.
const cacheMenuMedia = new Map(); // ruta -> { tipo: 'video'|'imagen', buffer, mtimeMs, ruta }

// jid: chat donde se pidio el menu (cada grupo puede tener su propia imagen/video)
function obtenerBufferMenu(jid) {
  const rutaActual = menuMedia.rutaParaMenu(jid);
  if (!rutaActual) return null;

  const stat = fs.statSync(rutaActual);
  const guardado = cacheMenuMedia.get(rutaActual);
  if (guardado && guardado.mtimeMs === stat.mtimeMs) return guardado;

  const nuevo = {
    tipo: menuMedia.esVideo(rutaActual) ? 'video' : 'imagen',
    buffer: fs.readFileSync(rutaActual),
    mtimeMs: stat.mtimeMs,
    ruta: rutaActual
  };
  cacheMenuMedia.set(rutaActual, nuevo);
  return nuevo;
}

const ordenCategorias = ['general', 'subbot', 'admin', 'download', 'owner', 'fun', 'economia', 'casino', 'gacha', 'gacha-anime', 'niveles', 'perfil', 'anime', 'interaction', 'ia', 'tools', 'config', 'nsfw'];

// Cuantos alias numerados (.menu1, .menu2, ...) se registran de entrada.
const MAX_PAGINAS_ALIAS = 20;

const EMOJI_CATEGORIA = {
  general: '🏠',
  subbot: '🤖',
  download: '⬇️',
  casino: '🎲',
  gacha: '🎁',
  'gacha-anime': '🎴',
  fun: '🎉',
  admin: '🛡️',
  owner: '👑',
  economia: '💰',
  perfil: '🪪',
  anime: '🎌',
  ia: '🔮',
  tools: '🧰',
  config: '⚙️',
  interaction: '🤝',
  niveles: '🏅',
  nsfw: '🔞'
};

const NOMBRE_CATEGORIA = {
  general: 'GUARIDA PANDA (General)',
  subbot: 'CLAN DE SOMBRAS (Subbots)',
  download: 'ARSENAL DE GARRAS (Descargas)',
  casino: 'CALLEJON DEL BAMBU NEGRO (Casino)',
  gacha: 'RULETA DEL DESTINO (Gacha)',
  'gacha-anime': 'GACHA ANIME',
  fun: 'MANADA SALVAJE (Diversion)',
  owner: 'ALFA DEL CLAN (Owner)',
  anime: 'ANIME',
  admin: 'GUARDIANES DEL BAMBU (Administracion)',
  economia: 'BOVEDA DE BAMBU (Economia)',
  perfil: 'FICHA DE GUERRERO (Perfil)',
  ia: 'ORACULO PANDA (IA)',
  tools: 'HERRAMIENTAS',
  config: 'CONFIGURACION DEL CLAN (Config)',
  interaction: 'CONTACTO DE MANADA (Interacciones)',
  niveles: 'SENDERO DEL GUERRERO (Niveles)',
  nsfw: 'RINCON PROHIBIDO (NSFW)'
};

function saludoSegunHora() {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return '☀️ Buenos dias, cachorro de la manada';
  if (hora >= 12 && hora < 19) return '🌤️ Buenas tardes, panda guerrero';
  return '🌙 Buenas noches, hasta los pandas rudos duermen';
}

function recortar(texto = '', max = 90) {
  const t = String(texto || '').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

// ---------- Estilo Halloween (.halloween on/off) ----------
const EMOJI_CATEGORIA_HW = {
  general: '🏚️', subbot: '🦇', download: '⚰️', casino: '🎰', gacha: '🧪', 'gacha-anime': '🎴',
  fun: '👻', owner: '👑', economia: '🎃', perfil: '💀', anime: '🎌', admin: '🧙', ia: '🔮',
  tools: '🕯️', config: '📜', interaction: '🧛', niveles: '🏆', nsfw: '🔞'
};

const NOMBRE_CATEGORIA_HW = {
  general: 'GUARIDA PANDA EMBRUJADA (General)',
  subbot: 'CLAN DE SOMBRAS (Subbots)',
  download: 'ARSENAL DE GARRAS MALDITAS (Descargas)',
  casino: 'CALLEJON DEL BAMBU MALDITO (Casino)',
  gacha: 'RULETA DEL DESTINO OSCURO (Gacha)',
  'gacha-anime': 'GACHA ANIME DE TERROR',
  fun: 'MANADA DE LA NOCHE (Diversion)',
  owner: 'ALFA DEL CLAN (Owner)',
  anime: 'ANIME NOCTURNO',
  admin: 'GUARDIANES DEL CEMENTERIO (Administracion)',
  economia: 'BOVEDA DE CALABAZAS (Economia)',
  perfil: 'FICHA DE GUERRERO NOCTURNO (Perfil)',
  ia: 'ORACULO PANDA DE LA BRUJA (IA)',
  tools: 'HERRAMIENTAS DE BRUJERIA',
  config: 'GRIMORIO DEL CLAN (Config)',
  interaction: 'RITUAL DE MANADA (Interacciones)',
  niveles: 'SENDERO NOCTURNO DEL GUERRERO (Niveles)',
  nsfw: 'CRIPTA PROHIBIDA (NSFW)'
};

const SEPARADOR_HW = '🕸️━━━━━━━━━━━━━━━━━━━🕸️';
const CIERRE_HW = '🦇━━━━━━━━━━━━━━━━━━━🦇';

function saludoHalloween() {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return '🌅 Buenos dias, cachorro de la manada... los fantasmas aun duermen';
  if (hora >= 12 && hora < 19) return '🌤️ Buenas tardes, panda guerrero... ya huele a calabaza';
  return '🌙 Buenas noches, que salgan los pandas fantasma 👻';
}

// Cuenta regresiva al 31 de octubre (hora de Tijuana). Vacio si Halloween ya paso.
function cuentaRegresivaHalloween() {
  try {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Tijuana', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).reduce((o, x) => ({ ...o, [x.type]: x.value }), {});
    const hoy = Date.UTC(+p.year, +p.month - 1, +p.day);
    const dias = Math.round((Date.UTC(+p.year, 9, 31) - hoy) / 86400000);
    if (dias === 0) return '🎃 *¡HOY ES HALLOWEEN!* La manada sale a pedir dulces 🍬';
    if (dias === 1) return '🎃 Mañana es Halloween... ¿ya tienes tu disfraz? 🧛';
    if (dias > 1 && dias <= 31) return `🎃 Faltan *${dias} dias* para Halloween 🕯️`;
  } catch (_) { /* sin cuenta regresiva */ }
  return '';
}

const BULLETS_HW = ['🎃', '👻', '🦇', '🕷️', '💀', '🕯️'];

function renderizarCategoriaHalloween(cat, categorias, prefix, emojiComando) {
  const emoji = EMOJI_CATEGORIA_HW[cat] || EMOJI_CATEGORIA[cat] || '📜';
  const titulo = NOMBRE_CATEGORIA_HW[cat] || NOMBRE_CATEGORIA[cat] || cat.toUpperCase();
  const n = categorias[cat].length;

  let bloque = `${SEPARADOR_HW}\n`;
  bloque += `${emoji} *${titulo}*\n`;
  bloque += `${BULLETS_HW[0]} _${n} comando${n === 1 ? '' : 's'} en esta cripta_ ${BULLETS_HW[1]}\n`;
  bloque += `${SEPARADOR_HW}\n`;
  categorias[cat].forEach((c, i) => {
    const alias = c.aliases?.length ? ` _(${c.aliases.map((a) => prefix + a).join(', ')})_` : '';
    bloque += `${BULLETS_HW[i % BULLETS_HW.length]} ${emojiComando} *${prefix}${c.name}*${alias}\n`;
    bloque += `    ↳ _${recortar(c.description || 'Sin descripcion')}_\n`;
  });
  bloque += `${CIERRE_HW}\n\n`;
  return bloque;
}

function renderizarCategoria(cat, categorias, prefix, emojiComando) {
  if (halloweenActivo()) return renderizarCategoriaHalloween(cat, categorias, prefix, emojiComando);

  const emoji = EMOJI_CATEGORIA[cat] || '📜';
  const titulo = NOMBRE_CATEGORIA[cat] || cat.toUpperCase();

  let bloque = `╭── ${emoji} *${titulo}* (${categorias[cat].length}) ──╮\n`;
  for (const c of categorias[cat]) {
    const alias = c.aliases?.length ? ` _(${c.aliases.map((a) => prefix + a).join(', ')})_` : '';
    bloque += `│ ${emojiComando} *${prefix}${c.name}*${alias}\n`;
    bloque += `│   _${recortar(c.description || 'Sin descripcion')}_\n`;
  }
  bloque += `╰${'─'.repeat(22)}╯\n\n`;
  return bloque;
}

module.exports = {
  name: 'menu',
  // Ojo: estos van en 'aliasesOcultas' (no en 'aliases') a proposito. El bot los
  // registra igual para que .menu2, .menu3, etc funcionen, pero al no estar en
  // 'aliases' no aparecen listados junto a .menu en el propio .menu.
  aliasesOcultas: Array.from({ length: MAX_PAGINAS_ALIAS }, (_, i) => `menu${i + 1}`),
  category: 'general',
  description: 'Muestra el menu de comandos (o una categoria a la vez con .menu1, .menu2, etc)',
  execute: async (sock, jid, msg, { prefix, texto, comandos }) => {
    const categorias = {};
    const emojiComando = leerConfig().menuEmoji || "🪄";

    for (const comando of comandos.values()) {
      const cat = comando.category || 'general';
      if (!categorias[cat]) categorias[cat] = [];
      if (!categorias[cat].some((c) => c.name === comando.name)) {
        categorias[cat].push(comando);
      }
    }

    const categoriasOrdenadas = [
      ...ordenCategorias.filter((cat) => categorias[cat]),
      ...Object.keys(categorias).filter((cat) => !ordenCategorias.includes(cat))
    ];

    for (const cat of Object.keys(categorias)) {
      categorias[cat].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    }

    const totalComandos = Object.values(categorias).reduce((acc, arr) => acc + arr.length, 0);
    const totalPaginas = categoriasOrdenadas.length;

    // Detecta el numero de pagina de dos formas: pegado (.menu2) o como
    // argumento separado con espacio (.menu 2) - las dos deben funcionar igual.
    const partesTexto = (texto || '').trim().split(/\s+/);
    const primeraPalabra = partesTexto[0] || '';
    const segundaPalabra = partesTexto[1] || '';

    const matchPegado = primeraPalabra.match(/menu(\d+)$/i);
    const numeroSuelto = /^\d+$/.test(segundaPalabra) ? parseInt(segundaPalabra, 10) : null;
    const paginaSolicitada = matchPegado ? parseInt(matchPegado[1], 10) : numeroSuelto;

    if (paginaSolicitada !== null) {
      if (paginaSolicitada < 1 || paginaSolicitada > totalPaginas) {
        return sock.sendMessage(jid, {
          text: `No hay una categoria numero ${paginaSolicitada}. Hay ${totalPaginas} en total: ${prefix}menu1 hasta ${prefix}menu${totalPaginas}.\n\nEscribe ${prefix}menu para ver todas de un jalon.`
        }, { quoted: msg });
      }

      const cat = categoriasOrdenadas[paginaSolicitada - 1];
      const hwPag = halloweenActivo();
      let texto2 = hwPag
        ? `👻 *Pagina ${paginaSolicitada} de ${totalPaginas}* 🎃\n\n`
        : `📖 *Pagina ${paginaSolicitada} de ${totalPaginas}*\n\n`;
      texto2 += renderizarCategoria(cat, categorias, prefix, emojiComando);
      texto2 += hwPag ? `🕯️─────────────────────🕯️\n` : `─────────────────────────\n`;
      if (paginaSolicitada > 1) texto2 += `${hwPag ? '🦇' : '◂'} Anterior: ${prefix}menu${paginaSolicitada - 1}\n`;
      if (paginaSolicitada < totalPaginas) texto2 += `${hwPag ? '🦇' : '▸'} Siguiente: ${prefix}menu${paginaSolicitada + 1}\n`;
      texto2 += `${hwPag ? '🎃' : '☰'} Menu completo: ${prefix}menu`;

      return sock.sendMessage(jid, { text: texto2 }, { quoted: msg });
    }

    const hw = halloweenActivo();
    let texto3;

    if (hw) {
      texto3 = `🕸️🕸️🕸️🕸️🕸️🕸️🕸️🕸️🕸️🕸️🕸️\n`;
      texto3 += `      🎃 *ALEPANDA BOT* 🎃\n`;
      texto3 += `   🐼 _Modo Panda Rudo_ 🐼\n`;
      texto3 += ` 🦇 _Edicion Noche de Brujas_ 🦇\n`;
      texto3 += `🕸️🕸️🕸️🕸️🕸️🕸️🕸️🕸️🕸️🕸️🕸️\n`;
      texto3 += `${saludoHalloween()}\n`;
      texto3 += `_"No hace falta ser el mas grande de la manada, solo el mas correoso."_\n`;
      const cuenta = cuentaRegresivaHalloween();
      if (cuenta) texto3 += `${cuenta}\n`;
      texto3 += `\n╭─── 🔮 *DATOS DEL CLAN* 🔮 ───╮\n`;
      texto3 += `│ 🦇 Prefijo de combate: [ ${prefix} ]\n`;
      texto3 += `│ 🕷️ Tecnicas disponibles: ${totalComandos}\n`;
      texto3 += `│ 👑 Alfa del clan: *ALEPANDITA*\n`;
      texto3 += `│ 📞 Contacto directo: https://wa.me/527732654942\n`;
      texto3 += `╰────────────────────────╯\n`;
      texto3 += `👻 ¿Prefieres verlo por partes? Escribe ${prefix}menu1 hasta ${prefix}menu${totalPaginas} (una cripta a la vez).\n\n`;

      for (const cat of categoriasOrdenadas) {
        texto3 += renderizarCategoria(cat, categorias, prefix, emojiComando);
      }

      texto3 += `🕯️━━━━━━━━━━━━━━━━━━━🕯️\n`;
      texto3 += `✧ Escribe el comando tal como aparece arriba (con el prefijo incluido).\n`;
      texto3 += `🐼 Con garra y sin miedo.\n`;
      texto3 += `🎃🦇👻 _Feliz Halloween de parte de la manada_ 👻🦇🎃`;
    } else {
      texto3 = `╭─────────────────────╮\n`;
      texto3 += `   ⚡ *ALEPANDA BOT* ⚡\n`;
      texto3 += `   🐼 _Modo Panda Rudo_ 🐼\n`;
      texto3 += `╰─────────────────────╯\n`;
      texto3 += `${saludoSegunHora()}\n`;
      texto3 += `_"No hace falta ser el mas grande de la manada, solo el mas correoso."_\n\n`;
      texto3 += `▸ Prefijo de combate: [ ${prefix} ]\n`;
      texto3 += `▸ Tecnicas disponibles: ${totalComandos}\n`;
      texto3 += `▸ Alfa del clan: *ALEPANDITA*\n`;
      texto3 += `▸ Contacto directo: https://wa.me/527732654942\n`;
      texto3 += `📖 ¿Prefieres verlo por partes? Escribe ${prefix}menu1 hasta ${prefix}menu${totalPaginas} (una categoria a la vez).\n`;
      texto3 += `─────────────────────────\n\n`;

      for (const cat of categoriasOrdenadas) {
        texto3 += renderizarCategoria(cat, categorias, prefix, emojiComando);
      }

      texto3 += `─────────────────────────\n`;
      texto3 += `✧ Escribe el comando tal como aparece arriba (con el prefijo incluido).\n`;
      texto3 += `🐼 Con garra y sin miedo.`;
    }

    const media = obtenerBufferMenu(jid);
    if (media?.tipo === 'video') {
      await sock.sendMessage(jid, { video: media.buffer, caption: texto3, gifPlayback: true });
    } else if (media?.tipo === 'imagen') {
      await sock.sendMessage(jid, { image: media.buffer, caption: texto3 });
    } else {
      await sock.sendMessage(jid, { text: texto3 });
    }
  }
};

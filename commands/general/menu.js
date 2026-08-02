const { leerConfig } = require('../../lib/config');
const fs = require('fs');
const path = require('path');

const imagePath = path.join(__dirname, '..', '..', 'assets', 'menu.jpg');
const videoPath = path.join(__dirname, '..', '..', 'assets', 'menu.mp4');
const ordenCategorias = ['general', 'subbot', 'download', 'casino', 'gacha', 'gacha-anime', 'fun', 'admin', 'owner', 'economia', 'perfil', 'anime', 'ia', 'tools'];

const MAX_PAGINAS_ALIAS = 20;

const EMOJI_CATEGORIA = {
  general: '🦉', subbot: '🔥', download: '🪄', casino: '🎲', gacha: '⚡',
  'gacha-anime': '🎴', fun: '🎉', admin: '🛡️', owner: '👑', economia: '💰',
  perfil: '🧙', anime: '🎌', ia: '🔮', tools: '🧰'
};

const NOMBRE_CATEGORIA = {
  general: 'GUARIDA PANDA (General)', subbot: 'CLAN DE SOMBRAS (Subbots)',
  download: 'ARSENAL DE GARRAS (Descargas)', casino: 'CALLEJON DEL BAMBU NEGRO (Casino)',
  gacha: 'RULETA DEL DESTINO (Gacha)', 'gacha-anime': 'GACHA ANIME',
  fun: 'MANADA SALVAJE (Diversion)', owner: 'ALFA DEL CLAN (Owner)', anime: 'ANIME',
  admin: 'GUARDIANES DEL BAMBU (Administracion)', economia: 'BOVEDA DE BAMBU (Economia)',
  perfil: 'FICHA DE GUERRERO (Perfil)', ia: 'ORACULO PANDA (IA)', tools: 'HERRAMIENTAS'
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

function renderizarCategoria(cat, categorias, prefix, emojiComando) {
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
  aliases: Array.from({ length: MAX_PAGINAS_ALIAS }, (_, i) => `menu${i + 1}`),
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

    const primeraPalabra = (texto || '').trim().split(/\s+/)[0] || '';
    const matchPagina = primeraPalabra.match(/menu(\d+)$/i);
    const paginaSolicitada = matchPagina ? parseInt(matchPagina[1], 10) : null;

    if (paginaSolicitada !== null) {
      if (paginaSolicitada < 1 || paginaSolicitada > totalPaginas) {
        return sock.sendMessage(jid, {
          text: `No hay una categoria numero ${paginaSolicitada}. Hay ${totalPaginas} en total: ${prefix}menu1 hasta ${prefix}menu${totalPaginas}.\n\nEscribe ${prefix}menu para ver todas de un jalon.`
        }, { quoted: msg });
      }

      const cat = categoriasOrdenadas[paginaSolicitada - 1];
      let texto2 = `📖 *Pagina ${paginaSolicitada} de ${totalPaginas}*\n\n`;
      texto2 += renderizarCategoria(cat, categorias, prefix, emojiComando);
      texto2 += `─────────────────────────\n`;
      if (paginaSolicitada > 1) texto2 += `◂ Anterior: ${prefix}menu${paginaSolicitada - 1}\n`;
      if (paginaSolicitada < totalPaginas) texto2 += `▸ Siguiente: ${prefix}menu${paginaSolicitada + 1}\n`;
      texto2 += `☰ Menu completo: ${prefix}menu`;

      return sock.sendMessage(jid, { text: texto2 }, { quoted: msg });
    }

    let texto3 = `╭─────────────────────╮\n`;
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

    if (fs.existsSync(videoPath)) {
      const buffer = fs.readFileSync(videoPath);
      await sock.sendMessage(jid, { video: buffer, caption: texto3, gifPlayback: true });
    } else if (fs.existsSync(imagePath)) {
      const buffer = fs.readFileSync(imagePath);
      await sock.sendMessage(jid, { image: buffer, caption: texto3 });
    } else {
      await sock.sendMessage(jid, { text: texto3 });
    }
  }
};

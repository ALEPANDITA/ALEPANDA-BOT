const { leerConfig } = require('../../lib/config');
const fs = require('fs');
const path = require('path');

const imagePath = path.join(__dirname, '..', '..', 'assets', 'menu.jpg');
const videoPath = path.join(__dirname, '..', '..', 'assets', 'menu.mp4');
const ordenCategorias = ['general', 'subbot', 'download', 'casino', 'gacha', 'gacha-anime', 'fun', 'admin', 'owner', 'economia', 'perfil', 'anime', 'ia', 'tools'];

const EMOJI_CATEGORIA = {
  general: '🦉',
  subbot: '🔥',
  download: '🪄',
  casino: '🎲',
  gacha: '⚡',
  'gacha-anime': '🎴',
  fun: '🎉',
  admin: '🛡️',
  owner: '👑',
  economia: '💰',
  perfil: '🧙',
  anime: '🎌',
  ia: '🔮',
  tools: '🧰'
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
  tools: 'HERRAMIENTAS'
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

module.exports = {
  name: 'menu',
  category: 'general',
  description: 'Muestra el menu de comandos',
  execute: async (sock, jid, msg, { prefix, comandos }) => {
    const categorias = {};
    const emojiComando = leerConfig().menuEmoji || "🪄";

    for (const comando of comandos.values()) {
      const cat = comando.category || 'general';
      if (!categorias[cat]) categorias[cat] = [];
      if (!categorias[cat].some(c => c.name === comando.name)) {
        categorias[cat].push(comando);
      }
    }

    const categoriasOrdenadas = [
      ...ordenCategorias.filter(cat => categorias[cat]),
      ...Object.keys(categorias).filter(cat => !ordenCategorias.includes(cat))
    ];

    // Dentro de cada categoria, los comandos se ordenan alfabeticamente para que
    // siempre salgan en el mismo orden (fs.readdirSync no garantiza orden alfabetico
    // ni estable entre carpeta y subcarpetas, por eso antes se veian "salteados").
    for (const cat of Object.keys(categorias)) {
      categorias[cat].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    }

    const totalComandos = Object.values(categorias).reduce((acc, arr) => acc + arr.length, 0);

    let texto = `╭─────────────────────╮\n`;
    texto += `   ⚡ *ALEPANDA BOT* ⚡\n`;
    texto += `   🐼 _Modo Panda Rudo_ 🐼\n`;
    texto += `╰─────────────────────╯\n`;
    texto += `${saludoSegunHora()}\n`;
    texto += `_"No hace falta ser el mas grande de la manada, solo el mas correoso."_\n\n`;
    texto += `▸ Prefijo de combate: [ ${prefix} ]\n`;
    texto += `▸ Tecnicas disponibles: ${totalComandos}\n`;
    texto += `▸ Alfa del clan: *ALEPANDITA*\n`;
    texto += `▸ Contacto directo: https://wa.me/527732654942\n`;
    texto += `─────────────────────────\n\n`;

    for (const cat of categoriasOrdenadas) {
      const emoji = EMOJI_CATEGORIA[cat] || '📜';
      const titulo = NOMBRE_CATEGORIA[cat] || cat.toUpperCase();

      texto += `╭── ${emoji} *${titulo}* (${categorias[cat].length}) ──╮\n`;

      for (const c of categorias[cat]) {
        const alias = c.aliases?.length ? ` _(${c.aliases.map(a => prefix + a).join(', ')})_` : '';
        texto += `│ ${emojiComando} *${prefix}${c.name}*${alias}\n`;
        texto += `│   _${recortar(c.description || 'Sin descripcion')}_\n`;
      }

      texto += `╰${'─'.repeat(22)}╯\n\n`;
    }

    texto += `─────────────────────────\n`;
    texto += `✧ Escribe el comando tal como aparece arriba (con el prefijo incluido).\n`;
    texto += `🐼 Con garra y sin miedo.`;

    if (fs.existsSync(videoPath)) {
      const buffer = fs.readFileSync(videoPath);
      await sock.sendMessage(jid, { video: buffer, caption: texto, gifPlayback: true });
    } else if (fs.existsSync(imagePath)) {
      const buffer = fs.readFileSync(imagePath);
      await sock.sendMessage(jid, { image: buffer, caption: texto });
    } else {
      await sock.sendMessage(jid, { text: texto });
    }
  }
};

const { leerConfig } = require('../../lib/config');
const fs = require('fs');
const path = require('path');

const imagePath = path.join(__dirname, '..', '..', 'assets', 'menu.jpg');
const videoPath = path.join(__dirname, '..', '..', 'assets', 'menu.mp4');
const ordenCategorias = ['general', 'download', 'casino', 'gacha', 'gacha-anime', 'fun', 'admin', 'owner', 'economia', 'perfil', 'anime', 'ia', 'tools'];

const EMOJI_CATEGORIA = {
  general: '🦉',
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
  general: 'LECHUCERIA (General)',
  download: 'HECHIZOS DE INVOCACION (Descargas)',
  casino: 'CALLEJON KNOCKTURN (Casino)',
  gacha: 'SORTEO DE LA VARITA (Gacha)',
  'gacha-anime': 'GACHA ANIME',
  fun: 'SALA COMUN (Diversion)',
  owner: 'DIRECTOR/A (Owner)',
  anime: 'ANIME',
  admin: 'PREFECTOS (Administracion)',
  economia: 'BOVEDA DE GRINGOTTS (Economia)',
  perfil: 'PERGAMINO PERSONAL (Perfil)',
  ia: 'ORACULO (IA)',
  tools: 'HERRAMIENTAS'
};

function saludoSegunHora() {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return '☀️ Buenos dias, aprendiz de magia';
  if (hora >= 12 && hora < 19) return '🌤️ Buenas tardes, mago/a';
  return '🌙 Buenas noches, la torre de astronomia te espera';
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

    const totalComandos = Object.values(categorias).reduce((acc, arr) => acc + arr.length, 0);

    let texto = `╭─────────────────────╮\n`;
    texto += `   ⚡ *ALEPANDA BOT* ⚡\n`;
    texto += `   🏰 _Edicion Hogwarts_ 🏰\n`;
    texto += `╰─────────────────────╯\n`;
    texto += `${saludoSegunHora()}\n`;
    texto += `_"No es la magia lo que nos hace grandes, es como la usamos."_\n\n`;
    texto += `▸ Hechizo de invocacion: [ ${prefix} ]\n`;
    texto += `▸ Sortilegios disponibles: ${totalComandos}\n`;
    texto += `▸ Director del colegio: *ALEPANDITA*\n`;
    texto += `▸ Lechuza mensajera: https://wa.me/527732654942\n`;
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
    texto += `✧ Mischief managed. 🖋️`;

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

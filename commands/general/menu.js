const fs = require('fs');
const path = require('path');

const imagePath = path.join(__dirname, '..', '..', 'assets', 'menu.jpg');

module.exports = {
  name: 'menu',
  category: 'general',
  description: 'Muestra el menu de comandos',
  execute: async (sock, jid, msg, { prefix, comandos }) => {
    const categorias = {};

    for (const comando of comandos.values()) {
      const cat = comando.category || 'general';
      if (!categorias[cat]) categorias[cat] = [];
      if (!categorias[cat].some(c => c.name === comando.name)) {
        categorias[cat].push(comando);
      }
    }

    let texto = `MENU DEL BOT (prefijo: ${prefix})\n`;

    for (const [cat, lista] of Object.entries(categorias)) {
      texto += `\n📂 *${cat.toUpperCase()}*\n`;
      for (const c of lista) {
        texto += `▸ ${prefix}${c.name} — ${c.description || 'sin descripcion'}\n`;
      }
    }

    if (fs.existsSync(imagePath)) {
      const buffer = fs.readFileSync(imagePath);
      await sock.sendMessage(jid, { image: buffer, caption: texto });
    } else {
      await sock.sendMessage(jid, { text: texto });
    }
  }
};

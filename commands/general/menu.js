const fs = require('fs');
const path = require('path');

const imagePath = path.join(__dirname, '..', '..', 'assets', 'menu.jpg');
const ordenCategorias = ['general', 'download', 'casino', 'fun', 'owner', 'anime'];

function saludoSegunHora() {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return '☀️ BUENOS DIAS';
  if (hora >= 12 && hora < 19) return '🌤️ BUENAS TARDES';
  return '🌙 BUENAS NOCHES';
}

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

    const categoriasOrdenadas = [
      ...ordenCategorias.filter(cat => categorias[cat]),
      ...Object.keys(categorias).filter(cat => !ordenCategorias.includes(cat))
    ];

    let texto = `┃✌️ ${saludoSegunHora()}\n\n`;
    texto += `┃🐼 *ALEPANDA BOT*\n`;
    texto += `╭───────◇■\n`;
    texto += `┃✎ Automatiza, simplifica, crece.\n`;
    texto += `┃◆➢ Prefijo actual: [ ${prefix} ]\n`;
    texto += `┃◆➢ Creado por: *ALEPANDITA*\n`;
    texto += `╰───────◇■\n\n`;
    texto += `➢✿ 📂 *LISTA DE COMANDOS*\n`;
    texto += `───✧✦◈✦✧───\n\n`;

    const nombresBonitos = {
      general: 'GENERAL',
      download: 'DESCARGAS',
      casino: 'CASINO',
      fun: 'DIVERSION',
      owner: 'OWNER',
      anime: 'ANIME'
    };

    for (const cat of categoriasOrdenadas) {
      const titulo = nombresBonitos[cat] || cat.toUpperCase();
      texto += `➢✿ 📁 *${titulo}*\n`;
      texto += `───✧✦◈✦✧───✿\n`;

      for (const c of categorias[cat]) {
        texto += `┃➤ ${prefix}${c.name}\n`;
        texto += `┃   ${c.description || 'sin descripcion'}\n`;
      }

      texto += `╰────✿\n\n`;
    }

    texto += `✧ Escribe el comando tal como aparece arriba`;

    if (fs.existsSync(imagePath)) {
      const buffer = fs.readFileSync(imagePath);
      await sock.sendMessage(jid, { image: buffer, caption: texto });
    } else {
      await sock.sendMessage(jid, { text: texto });
    }
  }
};

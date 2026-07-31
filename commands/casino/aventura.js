const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

let cooldownsAventura = {};

module.exports = {
  name: 'aventura',
  category: 'casino',
  description: 'Explora en busca de tesoros (cooldown 10 min)',
  execute: async (sock, jid, msg) => {
    const who = msg.key.participant || msg.key.remoteJid;
    const now = Date.now();
    const cd = cooldownsAventura[who] || 0;

    if (now < cd) {
      const restante = Math.ceil((cd - now) / 1000);
      const minutos = Math.floor(restante / 60);
      const segundos = restante % 60;
      return sock.sendMessage(jid, {
        text: `𖣔 「 ALEPANDA AVENTURA 」 ˚ʚ♡ɞ˚\n\n💫 » Espera ${minutos}m ${segundos}s`
      });
    }

    const random = Math.random();
    let lugar, emoji, diamantes;

    if (random < 0.10) {
      lugar = 'Palacio del Rey Demonio'; emoji = '👹';
      diamantes = Math.floor(Math.random() * 26) + 15;
    } else if (random < 0.30) {
      lugar = 'Mazmorra Oscura'; emoji = '🕳️';
      diamantes = Math.floor(Math.random() * 16) + 10;
    } else if (random < 0.60) {
      lugar = 'Bosque Encantado'; emoji = '🌲';
      diamantes = Math.floor(Math.random() * 8) + 5;
    } else if (random < 0.85) {
      lugar = 'Cueva de Goblins'; emoji = '👺';
      diamantes = Math.floor(Math.random() * 4) + 2;
    } else {
      lugar = 'Trampa en el camino'; emoji = '💀';
      diamantes = -Math.floor(Math.random() * 4) - 1;
    }

    const db = leerDB();
    const usuario = getUsuario(db, who);
    usuario.saldo = Math.max(0, (usuario.saldo || 0) + diamantes);
    guardarDB(db);
    cooldownsAventura[who] = now + 600000;

    let texto = `𖣔 「 ALEPANDA AVENTURA 」 ˚ʚ♡ɞ˚\n\n`;
    texto += `${emoji} » ${lugar}\n💎 » ${diamantes > 0 ? '+' : ''}${diamantes} diamantes\n`;
    texto += `💰 » Total: ${usuario.saldo} 💎`;

    await sock.sendMessage(jid, { text: texto });
  }
};

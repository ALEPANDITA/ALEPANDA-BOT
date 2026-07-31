const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { tirarGacha, EMOJI_RAREZA } = require('../../lib/gachahp');
const { obtenerAvatarPersonaje } = require('../../lib/avatarhp');

const COSTO = 50;
const COOLDOWN_MS = 20 * 60 * 1000;
const TIEMPO_CLAIM_MS = 3 * 60 * 1000; // 3 minutos para reclamarlo con .claim

module.exports = {
  name: 'rollhp',
  category: 'gacha',
  description: 'Invoca al Sombrero para revelar un personaje magico (cuesta 50 monedas). Debes reclamarlo con .claim antes de que se acabe el tiempo.',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const perfil = getUsuario(db, remitente);

    if (!perfil.gachaHP) perfil.gachaHP = {};
    if (!perfil.lastGachaHP) perfil.lastGachaHP = 0;

    const ahora = Date.now();
    const restante = COOLDOWN_MS - (ahora - perfil.lastGachaHP);

    if (restante > 0) {
      const minutos = Math.ceil(restante / 60000);
      return sock.sendMessage(jid, {
        text: `🪄 El sombrero necesita descansar. Vuelve a intentarlo en ${minutos} minuto(s).`
      }, { quoted: msg });
    }

    if (perfil.pendingGachaHP && (ahora - perfil.pendingGachaHP.timestamp) < TIEMPO_CLAIM_MS) {
      const segRestantes = Math.ceil((TIEMPO_CLAIM_MS - (ahora - perfil.pendingGachaHP.timestamp)) / 1000);
      return sock.sendMessage(jid, {
        text: `⚠️ Ya tienes a *${perfil.pendingGachaHP.nombre}* esperando. Usa *.claim* para reclamarlo antes de que se te escape (${segRestantes}s).`
      }, { quoted: msg });
    }

    if (perfil.saldo < COSTO) {
      return sock.sendMessage(jid, {
        text: `No tienes suficientes monedas. Necesitas $${COSTO} y tienes $${perfil.saldo}.`
      }, { quoted: msg });
    }

    perfil.saldo -= COSTO;
    perfil.lastGachaHP = ahora;

    const resultado = tirarGacha();
    perfil.pendingGachaHP = { ...resultado, timestamp: ahora };

    guardarDB(db);

    const yaExiste = (perfil.gachaHP[resultado.nombre] || 0) > 0;
    const minutosClaim = Math.round(TIEMPO_CLAIM_MS / 60000);
    const caption =
      `${EMOJI_RAREZA[resultado.rareza]} *¡El sombrero encontró un personaje!*\n\n` +
      `${yaExiste ? 'Ya tienes copias de este personaje anteriormente.' : '¡Nunca lo habías conseguido!'}\n` +
      `⏳ Usa *.claim* dentro de los próximos ${minutosClaim} minutos o lo perderás.\n` +
      `💰 Saldo restante: $${perfil.saldo}`;

    try {
      const buffer = await obtenerAvatarPersonaje(resultado.nombre);
      await sock.sendMessage(jid, {
        image: buffer,
        caption: `${resultado.emoji} *${resultado.nombre}*\n🏠 ${resultado.casa}\n\n${caption}`
      }, { quoted: msg });
    } catch (err) {
      console.error('[rollhp] Error obteniendo el avatar:', err);
      await sock.sendMessage(jid, {
        text: `${resultado.emoji} *${resultado.nombre}*\n🏠 ${resultado.casa}\n✨ ${resultado.rareza.toUpperCase()}\n\n${caption}\n\n⚠️ _(No se pudo traer la imagen ahora mismo: ${err.message})_`
      }, { quoted: msg });
    }
  }
};

const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { personajeAleatorio } = require('../../lib/gacha');
const { iniciarJuego, obtenerJuego, terminarJuego } = require('../../lib/juegos');
const { exito, advertencia, cargando, caja } = require('../../lib/estilo');

const COOLDOWN = 30 * 60 * 1000;
const TIEMPO_CLAIM = 30000;

module.exports = {
  name: 'rollwaifu',
  aliases: ['roll', 'gacha'],
  category: 'gacha',
  description: 'Tira por un personaje al azar. Quien escriba su nombre primero se lo queda.',
  execute: async (sock, jid, msg) => {
    if (obtenerJuego(jid)) {
      return sock.sendMessage(jid, { text: advertencia('Ya hay un personaje esperando ser reclamado en este chat.', { titulo: 'GACHA' }) });
    }

    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const usuario = getUsuario(db, remitente);

    const ahora = Date.now();
    const restante = usuario.lastRoll + COOLDOWN - ahora;

    if (restante > 0) {
      const minutos = Math.ceil(restante / 60000);
      return sock.sendMessage(jid, {
        text: advertencia(`Espera ${minutos} minuto(s) para volver a tirar.`, { titulo: 'GACHA' })
      });
    }

    usuario.lastRoll = ahora;
    guardarDB(db);

    await sock.sendMessage(jid, { text: cargando('Buscando un personaje...', { titulo: 'GACHA' }) });

    let personaje;
    try {
      personaje = await personajeAleatorio();
    } catch (err) {
      console.error(err);
      return sock.sendMessage(jid, { text: advertencia('No se pudo obtener un personaje, intenta de nuevo.', { titulo: 'GACHA' }) });
    }

    const timeout = setTimeout(async () => {
      if (obtenerJuego(jid)) {
        terminarJuego(jid);
        await sock.sendMessage(jid, {
          text: advertencia(`Nadie reclamo a *${personaje.nombre}* a tiempo. Se escapo.`, { titulo: 'GACHA' })
        });
      }
    }, TIEMPO_CLAIM);

    iniciarJuego(jid, {
      tipo: 'gacha',
      manejarRespuesta: async (sock, jid, msg, texto) => {
        const intento = texto.trim().toLowerCase();
        const nombreObjetivo = personaje.nombre.toLowerCase();

        if (!nombreObjetivo.includes(intento) || intento.length < 3) return;

        clearTimeout(timeout);
        terminarJuego(jid);

        const quienReclama = msg.key.participant || msg.key.remoteJid;
        const dbClaim = leerDB();
        const usuarioClaim = getUsuario(dbClaim, quienReclama);

        usuarioClaim.waifus.push({
          id: personaje.id,
          nombre: personaje.nombre,
          serie: personaje.serie,
          rareza: personaje.rareza.nombre,
          fecha: Date.now()
        });
        guardarDB(dbClaim);

        await sock.sendMessage(jid, {
          text: exito(`@${quienReclama.split('@')[0]} reclamo a *${personaje.nombre}* ${personaje.rareza.emoji} *${personaje.rareza.nombre}*!`, { titulo: 'GACHA', pie: 'ALEPANDA GACHA' }),
          mentions: [quienReclama]
        });
      }
    });

    const caption = caja([
      `${personaje.rareza.emoji} Rareza: *${personaje.rareza.nombre}*`,
      `📺 Serie: *${personaje.serie}*`,
      `💛 Favoritos: ${personaje.favoritos.toLocaleString()}`,
      '',
      `Escribe su nombre en ${TIEMPO_CLAIM / 1000} segundos para reclamarlo!`
    ], { titulo: personaje.nombre, pie: 'ALEPANDA GACHA' });

    await sock.sendMessage(jid, { image: { url: personaje.imagen }, caption }).catch(async () => {
      await sock.sendMessage(jid, { text: caption });
    });
  }
};

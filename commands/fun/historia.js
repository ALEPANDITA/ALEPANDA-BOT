// .historia [tema]  -> el bot inventa una historia absurda con miembros al azar del grupo (los etiqueta cada vez que salen).
//   .historia                          3 a 5 personajes al azar
//   .historia en una pizzeria          con un tema
//   .historia @user1 @user2            esas personas SI o SI salen (el resto al azar)
//   (responde a una historia) .historia   continua con el siguiente capitulo, mismos personajes
const historia = require('../../lib/historia');
const medios = require('../../lib/ia-medios');
const { error: cajaError } = require('../../lib/estilo');

const ESPERA_MS = 25 * 1000;
const ultimaVez = new Map();    // grupo -> cuando se uso
const escribiendo = new Set();  // grupos con una historia en camino
const guardadas = new Map();    // id del mensaje de la historia -> { personajes, cruda, ts } (para el siguiente capitulo)
const MAX_GUARDADAS = 40;
const TTL_GUARDADAS = 6 * 60 * 60 * 1000;

module.exports = {
  name: 'historia',
  category: 'fun',
  description: 'El bot inventa una historia divertida con integrantes random del grupo. Puedes dar un tema, mencionar personas, o responder a una historia para seguirla',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const responder = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });

    if (escribiendo.has(jid)) return responder('✍️ Ya estoy escribiendo una historia aquí, dame un momento.');
    const falta = ESPERA_MS - (Date.now() - (ultimaVez.get(jid) || 0));
    if (falta > 0) return responder(`⏳ Dame ${Math.ceil(falta / 1000)} s para inspirarme otra vez.`);

    const ctx = medios.contextoDe(medios.desenvolver(msg.message));
    const mencionados = Array.isArray(ctx.mentionedJid) ? ctx.mentionedJid : [];
    const tema = String(texto || '').slice(prefix.length).trim().replace(/^\S+\s*/, '')   // sin ".historia"
      .replace(/@\d{5,}/g, '').replace(/\s+/g, ' ').trim().slice(0, 150);

    escribiendo.add(jid);
    try {
      const metadata = await sock.groupMetadata(jid);
      const idsBot = [sock.user && sock.user.id, sock.user && sock.user.lid].filter(Boolean);

      // ¿Responde a una historia que escribi yo? Entonces es el siguiente capitulo con los mismos personajes
      const previa = ctx.stanzaId ? guardadas.get(ctx.stanzaId) : null;
      let personajes, anterior = null;
      if (previa && Date.now() - previa.ts < TTL_GUARDADAS) {
        personajes = previa.personajes;
        anterior = previa.cruda;
      } else {
        const forzados = [...mencionados];
        if (ctx.participant) forzados.push(ctx.participant);   // responder a un mensaje de alguien = que salga esa persona
        personajes = historia.elegirPersonajes({ participantes: metadata.participants, forzados, idsBot });
      }

      if (personajes.length < historia.MIN_PERSONAJES) {
        return responder(cajaError('Se necesitan al menos 2 personas en el grupo para inventar una historia.'));
      }

      try { await sock.sendPresenceUpdate('composing', jid); } catch (_) { /* da igual */ }
      const h = await historia.escribirHistoria({ personajes, tema, anterior });

      const encabezado = anterior ? '📖 *LA HISTORIA CONTINÚA...*' : '📖 *HISTORIA DEL CLAN*';
      const pie = `\n\n🎲 _Responde a esta historia con ${prefix}historia para el siguiente capítulo_`;
      const enviado = await sock.sendMessage(jid, { text: `${encabezado}\n\n${h.texto}${pie}`, mentions: h.usados }, { quoted: msg });

      ultimaVez.set(jid, Date.now());
      const id = enviado && enviado.key && enviado.key.id;
      if (id) {
        // la historia completa (con codigos) para poder continuarla
        guardadas.set(id, { personajes, cruda: anterior ? `${anterior}\n\n${h.cruda}` : h.cruda, ts: Date.now() });
        for (const [k, v] of guardadas) if (Date.now() - v.ts > TTL_GUARDADAS) guardadas.delete(k);
        while (guardadas.size > MAX_GUARDADAS) guardadas.delete(guardadas.keys().next().value);
      }
    } catch (err) {
      console.error('[historia]', err && (err.code || err.message));
      await responder(cajaError(err && err.code === 'HISTORIA_INVALIDA'
        ? 'Se me enredó la historia, intenta otra vez.'
        : 'Se me fue la inspiración, intenta de nuevo en un ratito.'));
    } finally {
      escribiendo.delete(jid);
    }
  }
};

// .historia [categoria] [contexto]  -> el bot inventa una historia absurda con miembros al azar del grupo (los etiqueta cada vez que salen).
//   .historia                          sorpresa (3 a 5 personajes al azar)
//   .historia terror | amor | ...      con categoria (.historia categorias las muestra todas); se pueden mezclar 2: .historia terror amor
//   .historia un vaquero que conocio a alguien y se enamoro     con contexto (tambien: .historia amor entre un pirata y una sirena)
//   .historia @user1 @user2            esas personas SI o SI salen (el resto al azar)
//   (responde a una historia) .historia   continua con el siguiente capitulo, mismos personajes y mismo genero
const historia = require('../../lib/historia');
const medios = require('../../lib/ia-medios');
const { error: cajaError } = require('../../lib/estilo');
const gemini = require('../../lib/gemini');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');

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

    const ctx = medios.contextoDe(medios.desenvolver(msg.message));
    const mencionados = Array.isArray(ctx.mentionedJid) ? ctx.mentionedJid : [];
    const argumentos = String(texto || '').slice(prefix.length).trim().replace(/^\S+\s*/, '');   // sin ".historia"
    const pedido = historia.interpretarArgumentos(argumentos);
    if (pedido.ayuda) return responder(historia.textoAyuda(prefix));

    if (escribiendo.has(jid)) return responder('✍️ Ya estoy escribiendo una historia aquí, dame un momento.');
    const falta = ESPERA_MS - (Date.now() - (ultimaVez.get(jid) || 0));
    if (falta > 0) return responder(`⏳ Dame ${Math.ceil(falta / 1000)} s para inspirarme otra vez.`);

    escribiendo.add(jid);
    try {
      const metadata = await sock.groupMetadata(jid);
      const idsBot = [sock.user && sock.user.id, sock.user && sock.user.lid].filter(Boolean);

      // ¿Responde a una historia que escribi yo? Entonces es el siguiente capitulo con los mismos personajes
      const previa = ctx.stanzaId ? guardadas.get(ctx.stanzaId) : null;
      let personajes, anterior = null;
      let generos = pedido.generos;
      if (previa && Date.now() - previa.ts < TTL_GUARDADAS) {
        personajes = previa.personajes;
        anterior = previa.cruda;
        if (!generos.length) generos = previa.generos || [];   // el siguiente capitulo sigue en el mismo genero
      } else {
        const forzados = [...mencionados];
        if (ctx.participant) forzados.push(ctx.participant);   // responder a un mensaje de alguien = que salga esa persona
        personajes = historia.elegirPersonajes({ participantes: metadata.participants, forzados, idsBot });
      }

      if (personajes.length < historia.MIN_PERSONAJES) {
        return responder(cajaError('Se necesitan al menos 2 personas en el grupo para inventar una historia.'));
      }

      try { await sock.sendPresenceUpdate('composing', jid); } catch (_) { /* da igual */ }
      const h = await historia.escribirHistoria({ personajes, tema: pedido.contexto, anterior, generos });

      const etiquetaGenero = generos.map((k) => historia.GENEROS[k]).filter(Boolean).map((g) => `${g.emoji} ${g.etiqueta}`).join(' + ');
      const encabezado = `${anterior ? '📖 *LA HISTORIA CONTINÚA...*' : '📖 *HISTORIA DEL CLAN*'}${etiquetaGenero ? ` · ${etiquetaGenero}` : ''}`;
      const pie = `\n\n🎲 _Responde a esta historia con ${prefix}historia para el siguiente capítulo_`;
      const enviado = await sock.sendMessage(jid, { text: `${encabezado}\n\n${h.texto}${pie}`, mentions: h.usados }, { quoted: msg });

      ultimaVez.set(jid, Date.now());
      const id = enviado && enviado.key && enviado.key.id;
      if (id) {
        // la historia completa (con codigos) para poder continuarla
        guardadas.set(id, { personajes, generos, cruda: anterior ? `${anterior}\n\n${h.cruda}` : h.cruda, ts: Date.now() });
        for (const [k, v] of guardadas) if (Date.now() - v.ts > TTL_GUARDADAS) guardadas.delete(k);
        while (guardadas.size > MAX_GUARDADAS) guardadas.delete(guardadas.keys().next().value);
      }
    } catch (err) {
      console.error('[historia]', err && (err.code || err.message), err && err.detalle ? `| ${err.detalle}` : '');
      await responder(cajaError(err && err.code === 'HISTORIA_INVALIDA'
        ? 'Se me enredó la historia, intenta otra vez.'
        : 'Se me fue la inspiración, intenta de nuevo en un ratito.'));
      // Al owner se le dice por que fallo (cupo de Gemini, Groq, etc.)
      try {
        if (await esOwnerBot(sock, leerConfig(), msg)) {
          const real = typeof gemini.ultimoErrorGemini === 'function' ? gemini.ultimoErrorGemini() : null;
          const motivo = (err && (err.detalle || err.message)) || 'desconocido';
          await sock.sendMessage(jid, { text: `🔧 Detalle (solo owner): ${String(motivo).slice(0, 450)}${real && !/Gemini/.test(String(motivo)) ? ` | Gemini: ${real.mensaje.slice(0, 120)}` : ''}` }, { quoted: msg });
        }
      } catch (_) { /* sin detalle */ }
    } finally {
      escribiendo.delete(jid);
    }
  }
};

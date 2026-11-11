// .voz -> configura la VOZ de las IAs (Pandita, Mei) con ElevenLabs. Solo owner.
//   .voz                      estado (claves, voces, modelo, creditos, ultimo error)
//   .voz pandita <voiceId>    voz de Pandita          .voz mei <voiceId>   voz de Mei
//   .voz todas <voiceId>      la misma voz para todas
//   .voz modelo <flash|turbo|multilingual|id>
//   .voz on | off             prender / apagar las respuestas por voz (apagado = solo texto)
//   .voz probar [pandita|mei] [texto]   manda una nota de voz de prueba
//   .voz voces                lista las voces de tu cuenta con su id
//   .voz reanudar             quita la pausa que se pone cuando se acaban los creditos
// La clave se guarda con:  .setapikey elevenlabs TU_CLAVE
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const voz = require('../../lib/ia-voz');

const PERSONAS = ['pandita', 'mei'];
const ID_VOZ = /^[A-Za-z0-9]{10,40}$/;

const cortar = (t, n = 200) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };

module.exports = {
  name: 'voz',
  category: 'owner',
  description: 'Configura la voz (ElevenLabs) de Pandita y Mei: ids de voz, modelo, prueba y estado (solo owner)',
  menuOwner: true,
  silencioNoOwner: true,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    if (!(await esOwnerBot(sock, leerConfig(), msg))) return; // a quien no es owner ni se le responde

    const responder = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });
    const args = texto.trim().split(/\s+/).slice(1);
    const sub = (args[0] || 'estado').toLowerCase();

    // ---- estado ----
    if (sub === 'estado' || sub === 'status') {
      const e = voz.estado();
      const lineas = ['🎙️ *VOZ DE LAS IAs* (ElevenLabs)', ''];
      lineas.push(`Respuestas por voz: ${e.activo ? '✅ activadas' : '⛔ apagadas (solo texto)'}`);
      lineas.push(`Claves guardadas: ${e.claves}${e.claves ? '' : `  → ${prefix}setapikey elevenlabs TU_CLAVE`}`);
      lineas.push(`Modelo: ${e.modelo}`);
      for (const p of PERSONAS) lineas.push(`Voz de ${p}: ${voz.vozDe(p) ? '✅ ' + voz.vozDe(p) : `❌ falta → ${prefix}voz ${p} <id>`}`);
      if (e.enPausaHasta) lineas.push(`⏸️ En pausa por falta de creditos hasta las ${new Date(e.enPausaHasta).toLocaleTimeString('es-MX')} (${prefix}voz reanudar)`);
      if (e.claves) {
        const c = await voz.consultarCreditos();
        lineas.push(c
          ? `Creditos: ${c.usados.toLocaleString('es-MX')} usados de ${c.limite.toLocaleString('es-MX')}${c.plan ? ` (plan ${c.plan})` : ''}`
          : 'Creditos: no pude consultarlos (la clave quizá no tiene permiso de leer la suscripcion)');
      }
      if (e.ultimoError) lineas.push('', `Ultimo error (${new Date(e.ultimoError.cuando).toLocaleTimeString('es-MX')}): ${cortar(e.ultimoError.mensaje)}`);
      lineas.push('', `Probar: ${prefix}voz probar   |   Ver voces: ${prefix}voz voces`);
      return responder(lineas.join('\n'));
    }

    // ---- poner la voz ----
    if (PERSONAS.includes(sub) || sub === 'todas') {
      const id = args[1];
      if (!id || !ID_VOZ.test(id)) {
        return responder(`Uso: ${prefix}voz ${sub} <id de la voz>\nEl id sale en tu cuenta de ElevenLabs (Voices → la voz → "Copy voice ID"), o con ${prefix}voz voces.`);
      }
      const destino = sub === 'todas' ? PERSONAS : [sub];
      for (const p of destino) voz.ponerVoz(p, id);
      return responder(`✅ Voz de ${destino.join(' y ')} guardada: ${id}\nPruébala con ${prefix}voz probar${sub === 'mei' ? ' mei' : ''}`);
    }

    // ---- modelo ----
    if (sub === 'modelo') {
      const m = voz.resolverModelo(args[1]);
      if (!m) {
        return responder(`Uso: ${prefix}voz modelo <flash | turbo | multilingual | id del modelo>\n• flash = ${voz.MODELOS_ATAJO.flash} (el mas barato, el de siempre)\n• turbo = ${voz.MODELOS_ATAJO.turbo}\n• multilingual = ${voz.MODELOS_ATAJO.multilingual} (mejor calidad, gasta el doble)\nAhora: ${voz.configVoz().modelo}`);
      }
      voz.cambiarConfigVoz({ modelo: m });
      return responder(`✅ Modelo de voz: ${m}`);
    }

    // ---- on / off ----
    if (sub === 'on' || sub === 'off') {
      voz.cambiarConfigVoz({ activo: sub === 'on' });
      return responder(sub === 'on' ? '✅ Las IAs contestarán con notas de voz.' : '⛔ Voz apagada: las IAs contestarán solo con texto.');
    }

    if (sub === 'reanudar') {
      voz.reanudar();
      return responder('▶️ Listo, volví a intentar con voz.');
    }

    // ---- voces de la cuenta ----
    if (sub === 'voces') {
      const lista = await voz.listarVoces();
      if (!lista) return responder('No pude leer las voces (falta la clave o no tiene permiso de leer voces). Copia el id desde la página de ElevenLabs.');
      if (!lista.length) return responder('Tu cuenta no tiene voces guardadas todavía. Agrega una en ElevenLabs (Voices → Add) y vuelve a intentar.');
      const propias = lista.filter((v) => v.categoria !== 'premade');
      const mostrar = (propias.length ? propias : lista).slice(0, 15);
      return responder(`🎙️ *Voces de tu cuenta* (${lista.length}):\n` + mostrar.map((v) => `• ${v.nombre}\n  ${v.id}`).join('\n') + `\n\nUsa: ${prefix}voz pandita <id>   ${prefix}voz mei <id>`);
    }

    // ---- prueba ----
    if (sub === 'probar' || sub === 'test') {
      let persona = 'pandita';
      let resto = args.slice(1);
      if (resto[0] && PERSONAS.includes(resto[0].toLowerCase())) { persona = resto[0].toLowerCase(); resto = resto.slice(1); }
      const frase = resto.join(' ').trim() || (persona === 'mei'
        ? 'Hola, soy Mei. Ya tengo voz, ¿qué te parece?'
        : 'Qué onda, soy Pandita. Ya tengo voz, wey. ¿Cómo la ves?');
      voz.reanudar();
      const nota = await voz.generarNotaDeVoz(persona, frase);
      if (!nota) {
        const e = voz.estado();
        return responder(`❌ No pude generar la voz de ${persona}.\n${e.ultimoError ? cortar(e.ultimoError.mensaje, 300) : `Revisa ${prefix}voz estado`}`);
      }
      return sock.sendMessage(jid, { audio: nota.audio, mimetype: nota.mimetype, ptt: true }, { quoted: msg });
    }

    return responder(`Uso:\n${prefix}voz  (estado)\n${prefix}voz pandita <id> | mei <id> | todas <id>\n${prefix}voz modelo <flash|turbo|multilingual>\n${prefix}voz on | off\n${prefix}voz probar [pandita|mei] [texto]\n${prefix}voz voces\n${prefix}voz reanudar`);
  }
};

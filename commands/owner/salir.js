// SALIR (solo owners): finge que saliste del grupo SIN salir. El bot manda el mismo mensaje de despedida
// (texto + imagen/video + audios) que se manda cuando alguien sale de verdad, con tus datos.
//   .salir                      -> en el grupo donde lo escribes
//   .salir <link del grupo>     -> en otro grupo (lo puedes escribir en otro grupo o en privado con el bot)
//   .entrar / .entrar <link>    -> lo contrario: finge que entras otra vez (mensaje de bienvenida)
// El bot tiene que estar en el grupo. Si alguien que NO es owner lo usa, el bot no responde nada.
const { leerConfig } = require('../../lib/config');
const { leerDB, getGrupo, getUsuario } = require('../../lib/db');
const { construirTexto, mencionesExtra, construirPayloadEnvio, obtenerMediaGuardada, obtenerFotoPerfilSegura } = require('../../lib/bienvenidapro');
const { esOwnerBot } = require('../../lib/permisos');

const REGEX_LINK = /chat\.whatsapp\.com\/([A-Za-z0-9]{10,})/;
const numeroDe = (id) => String(id || '').split('@')[0].split(':')[0];
const mismoNumero = (a, b) => !!a && !!b && numeroDe(a) === numeroDe(b);

function crearComando(name, tipo, aliases) {
  const esSalida = tipo === 'bye';
  return {
    name,
    aliases,
    category: 'owner',
    description: esSalida
      ? 'Finge que sales del grupo sin salir. Uso: .salir  o  .salir <link del grupo>'
      : 'Finge que entras al grupo otra vez. Uso: .entrar  o  .entrar <link del grupo>',
    execute: async (sock, jid, msg, { texto }) => {
      const config = leerConfig();
      if (!(await esOwnerBot(sock, config, msg))) return; // a los demas no se les responde nada

      const enGrupo = jid.endsWith('@g.us');
      const link = String(texto || '').match(REGEX_LINK);
      try {
        let destino = jid;
        if (link) {
          const info = await sock.groupGetInviteInfo(link[1]);
          destino = info.id;
        } else if (!enGrupo) {
          return sock.sendMessage(jid, { text: `Escribe el link del grupo.\nEjemplo: ${config.prefix}${name} https://chat.whatsapp.com/ABC123` }, { quoted: msg });
        }

        const grupos = await sock.groupFetchAllParticipating();
        if (!grupos[destino]) {
          return sock.sendMessage(jid, { text: 'El bot no esta en ese grupo, no puedo hacerlo ahi.' }, { quoted: msg });
        }
        const metadata = await sock.groupMetadata(destino);

        // Tus datos tal como aparecen en ESE grupo (puede estar en formato @lid o con numero)
        const remitente = msg.key.participant || msg.key.remoteJid;
        const mios = [remitente, msg.key.participantAlt, msg.key.participantPn, msg.key.remoteJidAlt].filter(Boolean);
        const miembro = metadata.participants.find((p) => mios.some((m) => [p.id, p.lid, p.phoneNumber].some((x) => mismoNumero(x, m))));
        const idMiembro = miembro ? miembro.id : remitente;
        // Igual que cuando alguien sale de verdad: si hay numero real se etiqueta ese numero (como @usuario); si no, el @lid
        let numeroReal = null;
        if (miembro && miembro.phoneNumber) numeroReal = numeroDe(miembro.phoneNumber);
        if (!numeroReal) { const pn = mios.find((m) => m.endsWith('@s.whatsapp.net')); if (pn) numeroReal = numeroDe(pn); }
        if (!numeroReal && idMiembro.endsWith('@s.whatsapp.net')) numeroReal = numeroDe(idMiembro);
        if (!numeroReal) {
          try { const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(idMiembro); if (pn) numeroReal = numeroDe(pn); } catch (_) { /* este fork no lo soporta */ }
        }
        const mencion = numeroReal ? `${numeroReal}@s.whatsapp.net` : idMiembro;
        const numero = numeroReal || `lid-${numeroDe(idMiembro)}`;

        const db = leerDB();
        const grupo = getGrupo(db, destino);
        const nombreConocido = getUsuario(db, mencion).nombre;
        const plantilla = esSalida
          ? (grupo.textoDespedida || '{user} salio del grupo.')
          : (grupo.textoBienvenida || 'Bienvenido/a {user} al grupo {group}!');
        const textoFinal = construirTexto(plantilla, { numero, metadata, sock, prefix: config.prefix, nombreConocido });

        const fotoBuffer = await obtenerFotoPerfilSegura(sock, idMiembro);
        const { buffer, tipoMedia } = await obtenerMediaGuardada(tipo, destino, grupo, {
          fotoBuffer,
          nombreGrupo: metadata.subject,
          totalMiembros: metadata.participants.length,
          numero: numero.startsWith('lid-') ? null : numero,
          nombreConocido
        });
        const payload = construirPayloadEnvio(tipoMedia, buffer, textoFinal);
        await sock.sendMessage(destino, { ...payload, mentions: [mencion, ...mencionesExtra(plantilla, metadata, sock)] });
        try { await require('../../lib/audiosbienvenida').enviarAudios(sock, destino, tipo, { forzar: true }); } catch (_) { /* los audios son opcionales */ }

        if (!link && enGrupo) {
          // Borra tu comando para que no se vea (solo funciona si el bot es admin del grupo)
          try { await sock.sendMessage(jid, { delete: msg.key }); } catch (_) { /* sin permiso: se queda */ }
        } else {
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        }
      } catch (err) {
        console.error(`[${name}]`, err);
        try { await sock.sendMessage(jid, { text: `No pude hacerlo: ${err.message}` }, { quoted: msg }); } catch (_) { /* nada */ }
      }
    }
  };
}

module.exports = [
  crearComando('salir', 'bye', ['fingirsalida']),
  crearComando('entrar', 'welcome', ['fingirentrada'])
];

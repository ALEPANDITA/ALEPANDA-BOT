// SALIRV2 (solo owners): salida REAL del grupo + volver a meter.
//   .salirv2                    -> te saca a TI, te vuelve a meter y te devuelve el admin (si lo eras)
//   .salirv2 @persona           -> saca a esa persona (la etiquetas) y la vuelve a meter. NO le da admin.
//   .salirv2 <link del grupo>   -> igual que el primero pero en otro grupo (lo puedes escribir en otro grupo o en privado)
// Como la salida y la entrada son de verdad, WhatsApp pone sus avisos y el bot manda su despedida / bienvenida
// normales (si las tienes activadas en ese grupo).
// Requisitos: el bot debe ser admin del grupo. No se puede sacar al creador del grupo. A una persona etiquetada que sea
// admin NO se le hace nada (no se le podria devolver el admin). Si por privacidad WhatsApp no deja volver a meter a alguien,
// el bot te manda el link del grupo a tu privado para que se lo pases.
const { leerConfig } = require('../../lib/config');
const { esOwnerBot, esAdminDelBot } = require('../../lib/permisos');

const REGEX_LINK = /chat\.whatsapp\.com\/([A-Za-z0-9]{10,})/;
const ESPERA_MS = 2500;
const numeroDe = (id) => String(id || '').split('@')[0].split(':')[0];
const mismoNumero = (a, b) => !!a && !!b && numeroDe(a) === numeroDe(b);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
  name: 'salirv2',
  aliases: ['salirreal'],
  category: 'owner',
  description: 'Te saca del grupo y te vuelve a meter (con admin si lo eras). Con @persona saca a esa persona y la vuelve a meter sin admin. Uso: .salirv2 | .salirv2 @persona | .salirv2 <link>',
  execute: async (sock, jid, msg, { texto }) => {
    const config = leerConfig();
    if (!(await esOwnerBot(sock, config, msg))) return; // a los demas no se les responde nada

    const enGrupo = jid.endsWith('@g.us');
    const link = String(texto || '').match(REGEX_LINK);
    const responder = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });
    try {
      let destino = jid;
      if (link) {
        destino = (await sock.groupGetInviteInfo(link[1])).id;
      } else if (!enGrupo) {
        return responder(`Escribe el link del grupo.\nEjemplo: ${config.prefix}salirv2 https://chat.whatsapp.com/ABC123`);
      }

      const grupos = await sock.groupFetchAllParticipating();
      if (!grupos[destino]) return responder('El bot no esta en ese grupo, no puedo hacerlo ahi.');
      if (!(await esAdminDelBot(sock, destino))) return responder('El bot necesita ser admin de ese grupo para sacar y volver a meter gente.');

      const metadata = await sock.groupMetadata(destino);
      const remitente = msg.key.participant || msg.key.remoteJid;
      const mios = [remitente, msg.key.participantAlt, msg.key.participantPn, msg.key.remoteJidAlt].filter(Boolean);
      const idsDelBot = [sock.user && sock.user.id, sock.user && sock.user.lid].filter(Boolean);

      // A quien se saca: a ti, o a la persona que etiquetes (solo en el grupo donde escribes el comando)
      const ctx = (msg.message && msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo) || {};
      const etiquetado = (!link && enGrupo)
        ? (ctx.mentionedJid || []).find((m) => !mios.some((x) => mismoNumero(x, m))) || null
        : null;
      const buscados = etiquetado ? [etiquetado] : mios;
      const esOtro = !!etiquetado;

      const miembro = metadata.participants.find((p) => buscados.some((m) => [p.id, p.lid, p.phoneNumber].some((x) => mismoNumero(x, m))));
      if (!miembro) return responder(esOtro ? 'Esa persona no esta en el grupo.' : 'No te encontre como miembro de ese grupo.');
      if (idsDelBot.some((b) => [miembro.id, miembro.lid].some((x) => mismoNumero(x, b)))) return responder('No me puedo sacar a mi mismo.');
      if (miembro.admin === 'superadmin') return responder(esOtro ? 'Esa persona es la creadora del grupo y WhatsApp no deja sacarla.' : 'Eres el creador de ese grupo y WhatsApp no deja sacar al creador, asi que ahi no se puede.');
      if (esOtro && miembro.admin === 'admin') return responder('Esa persona es admin del grupo. No la saco porque despues no le puedo devolver el admin.');

      // Su numero real: hace falta para volver a meterla. Si no se sabe, NO se saca (para no dejarla fuera)
      let numeroReal = null;
      if (miembro.phoneNumber) numeroReal = numeroDe(miembro.phoneNumber);
      if (!numeroReal) { const pn = buscados.find((m) => m.endsWith('@s.whatsapp.net')); if (pn) numeroReal = numeroDe(pn); }
      if (!numeroReal && miembro.id.endsWith('@s.whatsapp.net')) numeroReal = numeroDe(miembro.id);
      if (!numeroReal) {
        try { const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(miembro.id); if (pn) numeroReal = numeroDe(pn); } catch (_) { /* este fork no lo soporta */ }
      }
      if (!numeroReal) return responder(esOtro ? 'No pude saber el numero real de esa persona para volver a meterla, asi que no la saque.' : 'No pude saber tu numero real para volver a meterte, asi que no te saque (para no dejarte fuera del grupo).');

      const privado = `${numeroReal}@s.whatsapp.net`;                       // de quien se saca
      const tuPrivado = mios.find((m) => m.endsWith('@s.whatsapp.net')) || (esOtro ? null : privado); // tu chat privado (para avisarte)
      const eraAdmin = !esOtro && miembro.admin === 'admin';                // solo a ti se te devuelve el admin

      // Borra tu comando para que no se vea (el bot ya es admin, asi que puede)
      if (!link && enGrupo) { try { await sock.sendMessage(jid, { delete: msg.key }); } catch (_) { /* se queda */ } }

      // 1) Sacar
      const quitar = await sock.groupParticipantsUpdate(destino, [miembro.id], 'remove');
      const estadoQuitar = quitar && quitar[0] && quitar[0].status;
      if (estadoQuitar && String(estadoQuitar) !== '200') return responder('WhatsApp no me dejo sacar (codigo ' + estadoQuitar + ').');
      await espera(ESPERA_MS);

      // 2) Volver a meter (si no deja por su privacidad, el link va a TU privado para que se lo pases)
      let entro = false;
      try {
        const agregar = await sock.groupParticipantsUpdate(destino, [privado], 'add');
        const estado = String(agregar && agregar[0] && agregar[0].status);
        entro = estado === '200' || estado === '409';
      } catch (e) { console.error('[salirv2] no pude volver a meterla:', e.message); }
      if (!entro) {
        try {
          const codigo = await sock.groupInviteCode(destino);
          const aviso = esOtro
            ? `Saque a esa persona, pero WhatsApp no me dejo volver a meterla directo (su privacidad). Pasale este link:\nhttps://chat.whatsapp.com/${codigo}`
            : `Te saque, pero WhatsApp no me dejo meterte directo (tu privacidad). Entra con este link:\nhttps://chat.whatsapp.com/${codigo}`;
          if (tuPrivado) await sock.sendMessage(tuPrivado, { text: aviso });
          else await responder('Saque a la persona pero no pude volver a meterla directo (su privacidad). Usa el link del grupo para que entre.');
        } catch (e) { console.error('[salirv2] no pude mandar el link:', e.message); }
        return;
      }

      // 3) Solo para ti: devolverte el admin
      let adminOk = true;
      if (eraAdmin) {
        await espera(ESPERA_MS);
        try { await sock.groupParticipantsUpdate(destino, [privado], 'promote'); } catch (e) { adminOk = false; console.error('[salirv2] no pude devolverte el admin:', e.message); }
      }
      if (esOtro) {
        await sock.sendMessage(jid, { text: '✅ Listo: salio y volvio al grupo (sin admin).' });
      } else if (tuPrivado) {
        await sock.sendMessage(tuPrivado, { text: eraAdmin ? (adminOk ? 'Listo: saliste, volviste y recuperaste el admin.' : 'Volviste al grupo, pero no pude devolverte el admin.') : 'Listo: saliste y volviste al grupo.' });
      }
    } catch (err) {
      console.error('[salirv2]', err);
      try { await responder(`No pude hacerlo: ${err.message}`); } catch (_) { /* nada */ }
    }
  }
};

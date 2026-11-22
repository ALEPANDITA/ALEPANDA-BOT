// ELIMINAR (admins del grupo y owners): BROMA. Cuenta regresiva de 1 minuto editando el mismo mensaje, luego finge que
// de 11 a 15 personas salen del grupo, "todos eliminados" y al final finge que el bot tambien se sale.
// ES TODO FALSO: este comando NO saca a nadie ni el bot sale del grupo (no usa groupParticipantsUpdate ni groupLeave).
//   .eliminar   (en un grupo)
const { leerConfig } = require('../../lib/config');
const { esOwnerBot, esAdminDelGrupo } = require('../../lib/permisos');

const SEGUNDOS = 60;
const PAUSA_ENTRE_SALIDAS_MS = 2000;
const enCurso = new Set(); // evita lanzarlo dos veces a la vez en el mismo grupo
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const numeroDe = (id) => String(id || '').split('@')[0].split(':')[0];

function pantallaCuenta(seg) {
  const llenos = Math.round(((SEGUNDOS - seg) / SEGUNDOS) * 10);
  const barra = '▰'.repeat(llenos) + '▱'.repeat(10 - llenos);
  return [
    '╔══════════════════════╗',
    '   ⚠️  *AVISO IMPORTANTE*  ⚠️',
    '╚══════════════════════╝',
    '',
    '🗑️ *Este grupo será eliminado en:*',
    '',
    `        ⏳  *${seg}*  segundos`,
    '',
    `   ${barra}`,
    '',
    '💀 _Despídanse mientras puedan..._'
  ].join('\n');
}

const pantallaFinal = [
  '╔══════════════════════╗',
  '   ✅  *GRUPO ELIMINADO*  ✅',
  '╚══════════════════════╝',
  '',
  'Ya todos fueron eliminados.',
  'Muchas gracias por estar aquí 💚'
].join('\n');

module.exports = {
  name: 'eliminar',
  aliases: ['eliminargrupo'],
  category: 'admin',
  description: 'Broma: cuenta regresiva de 1 minuto y finge que sacan a todos y que el bot se sale. No saca a nadie de verdad.',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    if (!jid.endsWith('@g.us')) { if (await esOwnerBot(sock, config, msg)) return sock.sendMessage(jid, { text: 'Este comando solo se usa en grupos.' }, { quoted: msg }); return; }
    // PARCHE-ELIMINAR-ADMIN: admins del grupo y owners (a los demas no se les responde nada)
    let permitido = false;
    try {
      const quien = msg.key.participant || msg.key.remoteJid;
      const { esAdmin } = await esAdminDelGrupo(sock, jid, quien, msg);
      permitido = !!esAdmin || await esOwnerBot(sock, config, msg);
    } catch (e) { permitido = false; }
    if (!permitido) return;
    if (enCurso.has(jid)) return;
    enCurso.add(jid);
    try {
      const metadata = await sock.groupMetadata(jid);
      const remitente = msg.key.participant || msg.key.remoteJid;
      const idsDelBot = [sock.user && sock.user.id, sock.user && sock.user.lid].filter(Boolean);
      const esElBot = (p) => idsDelBot.some((b) => [p.id, p.lid].some((x) => numeroDe(x) === numeroDe(b)));
      const esElOwner = (p) => [p.id, p.lid, p.phoneNumber].some((x) => numeroDe(x) === numeroDe(remitente));

      // A quienes se les "finge" la salida: de 11 a 15 al azar (sin el bot ni tu; si el grupo es mas chico, a todos los que haya)
      const candidatos = metadata.participants.filter((p) => !esElBot(p) && !esElOwner(p));
      for (let i = candidatos.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [candidatos[i], candidatos[j]] = [candidatos[j], candidatos[i]]; }
      const cuantos = Math.min(candidatos.length, 11 + Math.floor(Math.random() * 5));
      const victimas = candidatos.slice(0, cuantos);
      const participanteBot = metadata.participants.find(esElBot);
      const idBot = participanteBot ? participanteBot.id : `${numeroDe(sock.user && sock.user.id)}@s.whatsapp.net`;

      // Cuenta regresiva: se edita el mismo mensaje cada segundo (si no se puede editar, se borra y se manda de nuevo)
      let enviado = await sock.sendMessage(jid, { text: pantallaCuenta(SEGUNDOS) });
      const inicio = Date.now();
      for (let seg = SEGUNDOS - 1; seg >= 0; seg--) {
        await espera(Math.max(0, inicio + (SEGUNDOS - seg) * 1000 - Date.now()));
        const texto = seg === 0 ? pantallaCuenta(0).replace('_Despídanse mientras puedan..._', '🔥 _¡Eliminando!_') : pantallaCuenta(seg);
        try {
          await sock.sendMessage(jid, { text: texto, edit: enviado.key });
        } catch (_) {
          try { await sock.sendMessage(jid, { delete: enviado.key }); } catch (__) { /* nada */ }
          enviado = await sock.sendMessage(jid, { text: texto });
        }
      }

      // Salidas FALSAS (solo mensajes de texto con etiqueta, nadie sale de verdad)
      for (const p of victimas) {
        await espera(PAUSA_ENTRE_SALIDAS_MS);
        await sock.sendMessage(jid, { text: `❌ @${numeroDe(p.id)} salió del grupo.`, mentions: [p.id] });
      }
      await espera(PAUSA_ENTRE_SALIDAS_MS);
      await sock.sendMessage(jid, { text: pantallaFinal });
      await espera(PAUSA_ENTRE_SALIDAS_MS + 1000);
      await sock.sendMessage(jid, { text: `❌ @${numeroDe(idBot)} salió del grupo.`, mentions: [idBot] });
    } catch (err) {
      console.error('[eliminar]', err);
    } finally {
      enCurso.delete(jid);
    }
  }
};

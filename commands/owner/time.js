const { leerConfig } = require('../../lib/config');
const { esOwnerBot, SUPER_OWNER } = require('../../lib/permisos');
const { resolverJidReal } = require('../../lib/identidad');
const { caja, advertencia, error: cajaError } = require('../../lib/estilo');
const {
  parsearDuracion, extraerCodigoInvitacion, formatearFecha, formatearDuracion,
  registrarTiempo, listarTiempos, quitarTiempo, obtenerAvisoPorDefecto, fijarAvisoPorDefecto
} = require('../../lib/tiempo-grupos');

const soloNumero = (id) => String(id || '').split('@')[0].split(':')[0];

// A quien se le avisa cuando se acabe el tiempo, por prioridad:
//   1) el numero fijo que se puso con ".time aviso <numero>"
//   2) el numero real de quien escribio el comando
//   3) el primer owner del config.json (o el owner principal)
async function destinoAviso(sock, msg, config) {
  const fijo = obtenerAvisoPorDefecto();
  if (fijo) return { jid: fijo, motivo: 'numero fijo' };
  try {
    const real = await resolverJidReal(sock, msg.key.participant || msg.key.remoteJid, null);
    if (real && real.endsWith('@s.whatsapp.net')) return { jid: real, motivo: 'quien programo el tiempo' };
  } catch (_) { /* seguimos con el respaldo */ }
  const owner = (config.owners || []).find((o) => String(o).endsWith('@s.whatsapp.net'));
  return { jid: owner || SUPER_OWNER, motivo: 'owner del bot (no pude saber tu numero)' };
}

module.exports = {
  name: 'time',
  aliases: ['tiempo'],
  category: 'owner',
  silencioNoOwner: true, // si no es owner, el bot ni responde
  description: 'Programa cuanto dura el bot en un grupo y te avisa por privado cuando se acaba. Uso: .time 30d <link del grupo> | .time +15d <link> (suma dias) | .time lista | .time quitar <numero> | .time aviso <numero> (a quien avisar) | .time probar',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const config = leerConfig();
    if (!(await esOwnerBot(sock, config, msg))) return; // doble candado: sin respuesta ni senales

    const partes = String(texto || '').trim().split(/\s+/);
    const primero = (partes[1] || '').toLowerCase();

    // ---- .time aviso [<numero> | borrar]   -> numero fijo al que llegan los avisos
    if (primero === 'aviso') {
      const dado = partes.slice(2).join('').toLowerCase(); // acepta "+52 155 5999 8888" con espacios
      const actual = obtenerAvisoPorDefecto();
      if (!dado) {
        const quien = actual ? `Los avisos llegan SIEMPRE a +${soloNumero(actual)}.` : 'No hay numero fijo: el aviso llega a quien programa el tiempo.';
        return sock.sendMessage(jid, { text: caja([quien, '', `Fijar uno: ${prefix}time aviso 5217712345678`, `Quitarlo: ${prefix}time aviso borrar`, `Probar que llega: ${prefix}time probar`], { titulo: 'AVISOS DEL TIME', estilo: 'neon' }) }, { quoted: msg });
      }
      if (['borrar', 'quitar', 'off'].includes(dado)) {
        fijarAvisoPorDefecto(null);
        return sock.sendMessage(jid, { text: caja(['Listo. Ahora el aviso llega a quien programa el tiempo.'], { titulo: 'AVISOS DEL TIME', estilo: 'neon' }) }, { quoted: msg });
      }
      const digitos = dado.replace(/[^0-9]/g, '');
      if (digitos.length < 8 || digitos.length > 15) {
        return sock.sendMessage(jid, { text: advertencia(`Escribe el numero con codigo de pais y sin signos.\nEjemplo: ${prefix}time aviso 5217712345678`, { titulo: 'NUMERO INVALIDO', estilo: 'neon' }) }, { quoted: msg });
      }
      let destino = `${digitos}@s.whatsapp.net`;
      let verificado = false;
      try {
        const r = await sock.onWhatsApp(digitos);
        if (r && r[0] && r[0].exists === false) {
          return sock.sendMessage(jid, { text: advertencia(`Ese numero (+${digitos}) no tiene WhatsApp. Revisa que este completo, con codigo de pais.`, { titulo: 'SIN WHATSAPP', estilo: 'neon' }) }, { quoted: msg });
        }
        if (r && r[0] && r[0].jid) { destino = r[0].jid; verificado = true; }
      } catch (_) { /* no se pudo verificar: se guarda tal cual */ }
      fijarAvisoPorDefecto(destino);
      return sock.sendMessage(jid, { text: caja([`Los avisos del tiempo llegaran SIEMPRE a +${soloNumero(destino)}${verificado ? ' ✅ (tiene WhatsApp)' : ' (no pude verificarlo)'}.`, `Comprueba que llega con ${prefix}time probar`], { titulo: 'AVISOS DEL TIME', estilo: 'neon' }) }, { quoted: msg });
    }

    // ---- .time probar   -> manda ahora un mensaje de prueba al numero que recibira los avisos
    if (['probar', 'test', 'prueba'].includes(primero)) {
      const { jid: destino, motivo } = await destinoAviso(sock, msg, config);
      try {
        await sock.sendMessage(destino, { text: '🔔 *PRUEBA DEL TIME*\n\nAqui te llegara el aviso privado cuando se acabe el tiempo del bot en un grupo.' });
      } catch (err) {
        return sock.sendMessage(jid, { text: cajaError(`No pude mandar el mensaje a +${soloNumero(destino)}: ${err && err.message ? err.message : err}`) }, { quoted: msg });
      }
      return sock.sendMessage(jid, { text: caja([`Mande el mensaje de prueba a +${soloNumero(destino)} (${motivo}). Revisa su privado.`], { titulo: 'PRUEBA ENVIADA', estilo: 'neon' }) }, { quoted: msg });
    }

    // ---- .time lista
    if (['lista', 'list', 'ver'].includes(primero)) {
      const lista = listarTiempos();
      if (!lista.length) {
        return sock.sendMessage(jid, { text: caja([`No hay grupos con tiempo programado.`, `Ejemplo: ${prefix}time 30d https://chat.whatsapp.com/XXXX`], { titulo: 'TIEMPOS', estilo: 'neon' }) }, { quoted: msg });
      }
      const ahora = Date.now();
      const lineas = lista.flatMap((e, i) => {
        const estado = e.vence <= ahora ? (e.avisado ? '🔴 vencido (ya te avise)' : '🔴 vencido (aviso pendiente)') : `🟢 faltan ${formatearDuracion(e.vence - ahora)}`;
        return [`${i + 1}. *${e.nombre}*`, `   ${estado} · vence ${formatearFecha(e.vence)}`];
      });
      lineas.push('', `Quitar uno: ${prefix}time quitar <numero>`);
      return sock.sendMessage(jid, { text: caja(lineas, { titulo: 'TIEMPOS DEL BOT', estilo: 'neon' }) }, { quoted: msg });
    }

    // ---- .time quitar <numero | link | jid>
    if (['quitar', 'del', 'borrar', 'cancelar'].includes(primero)) {
      const quitado = quitarTiempo(partes.slice(2).join(' '));
      if (!quitado) {
        return sock.sendMessage(jid, { text: advertencia(`No encontre ese grupo. Mira los numeros con ${prefix}time lista`, { titulo: 'NO ENCONTRADO', estilo: 'neon' }) }, { quoted: msg });
      }
      return sock.sendMessage(jid, { text: caja([`Quite el tiempo de *${quitado.nombre}*. Ya no te voy a avisar de ese grupo.`], { titulo: 'TIEMPO QUITADO', estilo: 'neon' }) }, { quoted: msg });
    }

    // ---- .time 30d <link>
    const duracion = parsearDuracion(partes[1]);
    if (!duracion) {
      return sock.sendMessage(jid, {
        text: caja([
          `Uso: ${prefix}time <duracion> <link del grupo>`,
          '',
          `Ejemplo: ${prefix}time 30d https://chat.whatsapp.com/XXXX`,
          `Duraciones: 30d (dias) · 2w (semanas) · 12h (horas) · 90min`,
          `Sumar al tiempo que le queda: ${prefix}time +15d <link>`,
          `Dentro del grupo puedes omitir el link: ${prefix}time 30d`,
          `Ver todos: ${prefix}time lista · Quitar: ${prefix}time quitar <numero>`,
          `A quien avisar: ${prefix}time aviso <numero> · Probar: ${prefix}time probar`
        ], { titulo: 'TIME', estilo: 'neon' })
      }, { quoted: msg });
    }

    const codigo = extraerCodigoInvitacion(partes.slice(2).join(' '));
    let jidGrupo = null;
    let nombre = null;
    let botEnGrupo = true;

    if (codigo) {
      let info;
      try {
        info = await sock.groupGetInviteInfo(codigo);
      } catch (err) {
        return sock.sendMessage(jid, { text: cajaError('No pude leer ese link. Puede estar mal copiado, vencido o revocado. Pide uno nuevo al grupo.') }, { quoted: msg });
      }
      jidGrupo = info && info.id;
      nombre = info && info.subject;
      if (!jidGrupo) {
        return sock.sendMessage(jid, { text: cajaError('Ese link no me dio los datos del grupo. Intenta con otro link.') }, { quoted: msg });
      }
      try {
        const todos = await sock.groupFetchAllParticipating();
        botEnGrupo = !!(todos && todos[jidGrupo]);
      } catch (_) { botEnGrupo = true; /* no se pudo comprobar: no molestamos con una advertencia dudosa */ }
    } else if (String(jid).endsWith('@g.us') && partes.length <= 2) {
      jidGrupo = jid;
      try { nombre = (await sock.groupMetadata(jid)).subject; } catch (_) { nombre = null; }
    } else {
      return sock.sendMessage(jid, { text: advertencia(`Falta el link del grupo.\nEjemplo: ${prefix}time ${partes[1]} https://chat.whatsapp.com/XXXX`, { titulo: 'FALTA EL LINK', estilo: 'neon' }) }, { quoted: msg });
    }

    // A quien se le avisa (ver destinoAviso)
    const avisarA = (await destinoAviso(sock, msg, config)).jid;

    const { entrada, anterior } = registrarTiempo({ jidGrupo, nombre, codigo, ms: duracion.ms, suma: duracion.suma, avisarA });

    const lineas = [
      `Grupo: *${entrada.nombre}*`,
      `${duracion.suma && anterior ? 'Se sumaron' : 'Duracion:'} ${formatearDuracion(duracion.ms)}`,
      `Vence: ${formatearFecha(entrada.vence)} (en ${formatearDuracion(entrada.vence - Date.now())})`,
      `Te aviso por privado al +${soloNumero(entrada.avisarA)} cuando se acabe.`
    ];
    if (anterior && !duracion.suma) lineas.push(`(Reemplaza el tiempo anterior, que vencia ${formatearFecha(anterior.vence)})`);
    if (!botEnGrupo) lineas.push('', '⚠️ Todavia no estoy en ese grupo. Igual quedo guardado el tiempo; el reloj ya esta corriendo.');
    await sock.sendMessage(jid, { text: caja(lineas, { titulo: 'TIEMPO PROGRAMADO', estilo: 'neon' }) }, { quoted: msg });
  }
};

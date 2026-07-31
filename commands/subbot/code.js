const { leerStatus, contarSubbotsDe, crearSubbotCompleto, buscarSubbotActivoDeNumero } = require('../../lib/subbots');

const LIMITE_POR_PERSONA = 10;

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Intenta averiguar el numero de telefono real detras de un LID, probando
// varios metodos por si la libreria instalada soporta alguno. Si ninguno
// funciona, devuelve null (no truena) y el llamador cae al aviso manual.
async function intentarResolverNumeroReal(sock, jid, msg, remitente) {
  const posiblesCampos = [msg.key.participantAlt, msg.key.participantPn, msg.key.senderPn];
  for (const campo of posiblesCampos) {
    if (typeof campo === 'string' && /^\d{8,15}@s\.whatsapp\.net$/.test(campo)) {
      return campo.split('@')[0];
    }
  }

  try {
    const lidMapping = sock.signalRepository?.lidMapping;
    if (lidMapping?.getPNForLID) {
      const real = await lidMapping.getPNForLID(remitente);
      if (real && /^\d{8,15}@s\.whatsapp\.net$/.test(real)) return real.split('@')[0];
    }
  } catch {}

  try {
    if (jid.endsWith('@g.us')) {
      const metadata = await sock.groupMetadata(jid);
      const participante = metadata.participants.find(p => p.id === remitente || p.lid === remitente);
      const candidato = participante?.phoneNumber || participante?.jid;
      if (candidato && /^\d{8,15}@s\.whatsapp\.net$/.test(candidato)) return candidato.split('@')[0];
    }
  } catch {}

  return null;
}

module.exports = {
  name: 'code',
  aliases: ['serbot', 'subbot', 'crearsubbot'],
  category: 'subbot',
  description: 'Crea tu propio subbot y te da el codigo de vinculacion. Sin argumentos usa tu propio numero automaticamente, o especifica otro: .code [numero con codigo de pais]',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;

    // No usamos slice por longitud fija porque el comando tiene varios alias
    // de distinto largo (.code, .serbot, .subbot, .crearsubbot) -- en vez de
    // eso quitamos solo la primera palabra (el nombre/alias usado) y
    // trabajamos con lo que quede.
    const partes = texto.trim().split(/\s+/);
    partes.shift();
    const argumento = partes.join(' ').replace(/[^0-9]/g, '');

    // Si no se especifica numero, usamos el del propio remitente automaticamente.
    const numeroAutomatico = !argumento;
    let numero = argumento || remitente.split('@')[0];

    const pareceLid = numeroAutomatico && jid.endsWith('@g.us') && remitente.endsWith('@lid');

    if (pareceLid) {
      const numeroReal = await intentarResolverNumeroReal(sock, jid, msg, remitente);
      if (numeroReal) {
        numero = numeroReal;
      }
    }

    // Un numero real de telefono (con codigo de pais) tiene entre 8 y 15
    // digitos. En grupos donde el remitente tiene activada la privacidad de
    // numero, WhatsApp identifica a la persona con un ID interno (LID) que
    // no es un numero de telefono real y no sirve para pedir un codigo de
    // vinculacion -- lo detectamos aqui para no desperdiciar el intento.
    if (!/^\d{8,15}$/.test(numero) || (pareceLid && numero === remitente.split('@')[0])) {
      return sock.sendMessage(jid, {
        text: `⚠️ No pude detectar tu numero de telefono real automaticamente (esto pasa seguido en grupos, por privacidad).\n\n` +
          `Escribe tu numero manualmente, con codigo de pais y sin espacios:\n${prefix}code <numero>\nEj: ${prefix}code 521234567890\n\n` +
          `Tip: si me escribes por privado (no en un grupo), normalmente si logro detectarlo solo.`
      }, { quoted: msg });
    }

    const activo = buscarSubbotActivoDeNumero(numero);
    if (activo) {
      const nombreEstado = {
        conectado: 'ya esta conectado',
        esperando_codigo: 'esta esperando que ingreses el codigo de vinculacion',
        iniciando: 'se esta iniciando',
        reconectando: 'se esta reconectando'
      }[activo.estado] || 'ya esta activo';

      return sock.sendMessage(jid, {
        text: `⚠️ El numero ${numero} ${nombreEstado} como subbot (ID: ${activo.id}).\n\n` +
          `Ya tienes un subbot activo, no puedes crear otro con el mismo numero.\n` +
          `Si quieres reemplazarlo, primero escribe *${prefix}desconectar* dentro del chat de ese subbot, y luego vuelve a usar ${prefix}code.`
      }, { quoted: msg });
    }

    const existentes = contarSubbotsDe(remitente);
    if (existentes >= LIMITE_POR_PERSONA) {
      return sock.sendMessage(jid, {
        text: `⚠️ Ya tienes ${existentes} subbot(s) creado(s). El limite es ${LIMITE_POR_PERSONA} por persona.`
      }, { quoted: msg });
    }

    await sock.sendMessage(jid, {
      text: '🪄 Creando tu subbot y solicitando codigo de vinculacion, espera unos segundos...'
    }, { quoted: msg });

    try {
      const { id, nombreProceso } = await crearSubbotCompleto(numero, remitente, 'serbot');

      let status = null;
      for (let intento = 0; intento < 20; intento++) {
        await esperar(3000);
        status = leerStatus(id);
        if (status?.codigo || status?.estado === 'error') break;
      }

      if (!status || !status.codigo) {
        return sock.sendMessage(jid, {
          text: `⚠️ No se pudo generar el codigo a tiempo${status?.estado ? ` (estado: ${status.estado})` : ''}. Vuelve a intentar en un momento con ${prefix}code ${numero}`
        }, { quoted: msg });
      }

      await sock.sendMessage(jid, {
        text: `✅ Tu subbot fue creado (ID: *${id}*)\n\n` +
          `Ve a WhatsApp del numero ${numero} → Ajustes → Dispositivos vinculados → Vincular con numero de telefono, y cuando te pida el codigo, copia y pega el siguiente mensaje (dentro de los proximos minutos):`
      }, { quoted: msg });

      await sock.sendMessage(jid, { text: status.codigo });

      await sock.sendMessage(jid, {
        text: `Una vez vinculado, seras automaticamente el owner de ese subbot (podras usar ahi comandos como ${prefix}restart, ${prefix}setapikey, etc, sin afectar al bot principal).\n\n` +
          `Si en algun momento quieres liberarlo, escribe *${prefix}desconectar* directamente en el chat de ese subbot.`
      }, { quoted: msg });
    } catch (err) {
      console.error('[code] Error:', err);
      await sock.sendMessage(jid, {
        text: '❌ Ocurrio un error al crear tu subbot. Intenta de nuevo en un momento.'
      }, { quoted: msg });
    }
  }
};

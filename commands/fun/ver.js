// .ver -> responde a un mensaje de "ver una vez" (foto, video o nota de voz) y el bot lo reenvia como normal.
//
// WhatsApp NO manda la llave del archivo dentro de una respuesta a un "ver una vez", asi que desde la cita casi nunca se puede
// bajar. Por eso el bot recuerda la referencia de cada "ver una vez" cuando LLEGA (lib/vistaunica.js, hook en index.js) y aqui
// la usa primero; si no la tiene, intenta con lo que trae la cita y, si tampoco, explica el motivo real.
const medios = require('../../lib/ia-medios');
const vistaunica = require('../../lib/vistaunica');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');

const NOMBRE_TIPO = { imagen: 'imagen', video: 'video', audio: 'nota de voz' };
const tieneLlave = (nodo) => !!(nodo && nodo.mediaKey && nodo.mediaKey.length);

module.exports = {
  name: 'ver',
  category: 'fun',
  description: 'Responde a un mensaje "ver una vez" con .ver para reenviarlo como normal',
  execute: async (sock, jid, msg) => {
    const responder = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });
    const ctx = medios.contextoDe(medios.desenvolver(msg.message));
    const citado = ctx.quotedMessage;

    if (!citado) return responder('Responde (cita) al mensaje de "ver una vez" con .ver para reenviarlo.');

    const stanzaId = ctx.stanzaId;
    const guardado = vistaunica.buscar(stanzaId);               // lo que el bot vio llegar (trae la llave completa)
    const deLaCita = vistaunica.analizar(citado);               // lo que trae la cita (normalmente sin llave)
    const deGuardado = guardado ? vistaunica.analizar(guardado.message) : null;
    const base = deGuardado || deLaCita;

    if (!base) return responder('Ese mensaje citado no es una imagen, video o nota de voz de "ver una vez".');

    // Formas de bajarlo, de la mas fiable a la menos
    const intentos = [];
    if (deGuardado) intentos.push({ origen: 'visto al llegar', mensaje: { key: guardado.key, message: guardado.message }, medio: { tipo: deGuardado.tipo, nodo: deGuardado.nodo } });
    if (deLaCita && tieneLlave(deLaCita.nodo)) {
      intentos.push({
        origen: 'de la cita',
        mensaje: { key: { remoteJid: jid, id: stanzaId, participant: ctx.participant }, message: deLaCita.contenido },
        medio: { tipo: deLaCita.tipo, nodo: deLaCita.nodo }
      });
    }

    const detalles = [];
    let buffer = null;
    for (const intento of intentos) {
      try {
        buffer = await medios.descargar(sock, intento.mensaje, intento.medio);
        if (buffer && buffer.length) break;
      } catch (err) {
        detalles.push(`${intento.origen}: ${String((err && err.message) || err).slice(0, 220)}`);
      }
      buffer = null;
    }

    if (!buffer) {
      console.error('[ver] no se pudo recuperar:', detalles.join(' | ') || 'sin llave');
      const nombre = NOMBRE_TIPO[base.tipo] || 'archivo';
      let texto;
      if (!intentos.length) {
        texto = `No pude abrir esa ${nombre}: WhatsApp no manda el archivo cuando alguien responde a un "ver una vez", y este no lo vi llegar. ` +
          `Solo puedo recuperar los que me llegan mientras estoy encendido (hasta 3 horas después). Prueba con uno que acaben de mandar.`;
      } else {
        texto = `No se pudo recuperar esa ${nombre}: ya no está disponible en WhatsApp (puede que ya se haya abierto o que haya expirado).`;
      }
      await responder(texto);
      try {
        if (await esOwnerBot(sock, leerConfig(), msg)) {
          const resumen = `visto al llegar: ${guardado ? 'sí' : 'no'} · la cita trae llave: ${deLaCita && tieneLlave(deLaCita.nodo) ? 'sí' : 'no'}${detalles.length ? ' · ' + detalles.join(' | ') : ''}`;
          await sock.sendMessage(jid, { text: `🔧 Detalle (solo owner): ${resumen}`.slice(0, 600) }, { quoted: msg });
        }
      } catch (_) { /* sin detalle */ }
      return;
    }

    const caption = (base.nodo.caption || '').toString();
    if (base.tipo === 'imagen') {
      await sock.sendMessage(jid, { image: buffer, caption }, { quoted: msg });
    } else if (base.tipo === 'video') {
      await sock.sendMessage(jid, { video: buffer, caption }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, { audio: buffer, mimetype: base.nodo.mimetype || 'audio/ogg; codecs=opus', ptt: !!base.nodo.ptt }, { quoted: msg });
    }
  }
};

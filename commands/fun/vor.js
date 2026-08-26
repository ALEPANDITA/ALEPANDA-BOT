const { caja, error: cajaError } = require('../../lib/estilo');
const { obtenerEstado, minutosParaReinicio, reiniciarManual, HORAS_REINICIO } = require('../../lib/vorEstado');
const { VERDAD_NORMAL, RETO_NORMAL, VERDAD_PICANTE, RETO_PICANTE } = require('../../lib/vorContenido');

function elegirAlAzar(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

module.exports = {
  name: 'vor',
  aliases: ['verdadoreto', 'vr'],
  category: 'fun',
  description: 'Verdad o Reto. Uso: .vor [@mencion] [normal|picante]. Sin mencion elige a alguien al azar (sin repetir persona hasta el reinicio de 10h). Sin categoria, elige entre ambas al azar.',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

      const argumentos = texto.trim().split(/\s+/).slice(1).join(' ').toLowerCase();
      let categoriaForzada = null;
      if (/picante|\+18|18\+|fuerte/.test(argumentos)) categoriaForzada = 'picante';
      else if (/normal|tranquilo|suave/.test(argumentos)) categoriaForzada = 'normal';

      // Reinicio manual: ".vor reiniciar" (cualquiera en el grupo, no solo owner -- es un juego, no algo delicado)
      if (/^reiniciar$/.test(argumentos)) {
        reiniciarManual(jid);
        return sock.sendMessage(jid, { text: '🔄 Se reinicio el juego de Verdad o Reto para este grupo.' });
      }

      const estado = obtenerEstado(jid);

      let targetJid;
      let elegidoAlAzar = false;

      if (mencionado) {
        targetJid = mencionado;
      } else {
        const metadata = await sock.groupMetadata(jid);
        const participantes = metadata.participants
          .map((p) => p.id)
          .filter((id) => !id.includes('status@broadcast') && !id.includes(sock.user?.id?.split(':')[0] || '__nada__'));

        if (participantes.length === 0) {
          return sock.sendMessage(jid, { text: cajaError('No hay suficientes personas en el grupo para jugar.') });
        }

        let disponibles = participantes.filter((id) => !estado.elegidosAleatorio.has(id));

        // Si ya le toco a todos los del grupo en este ciclo, se reinicia
        // solo la lista de "elegidos al azar" (las preguntas ya usadas por
        // persona se mantienen, para que sigan sin repetirse las mismas).
        if (disponibles.length === 0) {
          estado.elegidosAleatorio.clear();
          disponibles = participantes;
        }

        targetJid = elegirAlAzar(disponibles);
        estado.elegidosAleatorio.add(targetJid);
        elegidoAlAzar = true;
      }

      const esVerdad = Math.random() < 0.5;
      const categoria = categoriaForzada || (Math.random() < 0.7 ? 'normal' : 'picante');

      let bancoCompleto;
      if (esVerdad) bancoCompleto = categoria === 'picante' ? VERDAD_PICANTE : VERDAD_NORMAL;
      else bancoCompleto = categoria === 'picante' ? RETO_PICANTE : RETO_NORMAL;

      const usadosDeEstaPersona = estado.usadosPorPersona.get(targetJid) || new Set();
      let disponiblesContenido = bancoCompleto.filter((item) => !usadosDeEstaPersona.has(item.id));

      // Si a esta persona ya le tocaron todas las de este banco, se le
      // reinicia SOLO su lista de usados (no la de los demas), para que
      // le puedan volver a tocar despues de agotarlas todas.
      if (disponiblesContenido.length === 0) {
        usadosDeEstaPersona.clear();
        disponiblesContenido = bancoCompleto;
      }

      const elegido = elegirAlAzar(disponiblesContenido);
      usadosDeEstaPersona.add(elegido.id);
      estado.usadosPorPersona.set(targetJid, usadosDeEstaPersona);

      const etiquetaTipo = esVerdad ? '❓ VERDAD' : '🎯 RETO';
      const etiquetaCategoria = categoria === 'picante' ? '🌶️ Picante' : '🍃 Normal';

      const texto2 = caja([
        `@${targetJid.split('@')[0]}${elegidoAlAzar ? ' (elegido al azar)' : ''}`,
        '',
        elegido.texto,
        '',
        `Categoria: ${etiquetaCategoria}`
      ], {
        titulo: etiquetaTipo,
        pie: `El juego se reinicia solo cada ${HORAS_REINICIO}h (quedan ~${minutosParaReinicio(jid)} min) | ${prefix}vor reiniciar para forzarlo`,
        estilo: 'neon'
      });

      await sock.sendMessage(jid, { text: texto2, mentions: [targetJid] });
    } catch (err) {
      console.error('[vor]', err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo jugar Verdad o Reto, intenta de nuevo.') });
    }
  }
};

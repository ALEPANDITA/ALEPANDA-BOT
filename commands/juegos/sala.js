const { advertencia, error: cajaError, exito } = require('../../lib/estilo');

module.exports = {
  name: 'sala',
  aliases: ['ff', 'vsfree', '6vs6', '5vs5', '4vs4', '3vs3', '2vs2', '1vs1'],
  category: 'juegos',
  description: 'Mezcla aleatoriamente a los jugadores mencionados y crea dos equipos para salas de Free Fire. Uso: .sala @user1 @user2 @user3 ...',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    // Solo se permite en grupos
    if (!jid.endsWith('@g.us')) {
      return sock.sendMessage(jid, {
        text: advertencia('Este comando solo se puede usar en grupos.', { titulo: 'GRUPO REQUERIDO' })
      });
    }

    // Extraer menciones directas del mensaje (incluyendo al autor si fue mencionado o si queremos integrarlo, 
    // pero Baileys saca las menciones reales del mensaje extendido)
    let mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    // Si el usuario que ejecuta el comando quiere ser incluido automáticamente o si solo se usan los etiquetados:
    // Asegurémonos de que el creador del comando también tenga la posibilidad de salir si se etiqueta a sí mismo o si se desea incluir.
    // Sin embargo, para cumplir estrictamente con "el bot los mezcle y haga los 2 equipos con el @ que el usuario ponga todos los @",
    // tomaremos las menciones proporcionadas. Opcionalmente, añadimos al autor si no está incluido para que tenga su "posibilidad de salir".
    const sender = msg.key.participant || msg.participant || msg.key.remoteJid;
    if (sender && !mentionedJids.includes(sender)) {
      mentionedJids.push(sender);
    }

    if (mentionedJids.length < 2) {
      return sock.sendMessage(jid, {
        text: advertencia(`Debes etiquetar al menos a 2 jugadores (incluyéndote o etiquetando a otros) para hacer equipos.\nEjemplo: ${prefix}sala @user1 @user2 @user3 @user4`, { titulo: 'FALTA MENCIONES' })
      });
    }

    if (mentionedJids.length > 12) {
      return sock.sendMessage(jid, {
        text: advertencia('El número máximo total de jugadores es 12 (para salas de hasta 6vs6).', { titulo: 'LIMITE EXCEDIDO' })
      });
    }

    try {
      // Función para mezclar aleatoriamente el arreglo de jugadores (Algoritmo Fisher-Yates)
      const shuffleArray = (array) => {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };

      const jugadoresMezclados = shuffleArray(mentionedJids);
      const mitad = Math.ceil(jugadoresMezclados.length / 2);

      const equipo1 = jugadoresMezclados.slice(0, mitad);
      const equipo2 = jugadoresMezclados.slice(mitad);

      const formatoVs = `${equipo1.length}vs${equipo2.length}`;
      let textoRespuesta = `🎮 *SALA DE FREE FIRE (${formatoVs})* 🎮\n\n`;

      textoRespuesta += `🔴 *EQUIPO 1*:\n`;
      equipo1.forEach((jidPlayer, idx) => {
        const tag = jidPlayer.split('@')[0];
        textoRespuesta += `${idx + 1}. @${tag}\n`;
      });

      textoRespuesta += `\n🔵 *EQUIPO 2*:\n`;
      equipo2.forEach((jidPlayer, idx) => {
        const tag = jidPlayer.split('@')[0];
        textoRespuesta += `${idx + 1}. @${tag}\n`;
      });

      textoRespuesta += `\n✨ ¡Equipos generados aleatoriamente! Listos para la custom.`;

      const todosLosJugadores = [...equipo1, ...equipo2];

      await sock.sendMessage(jid, {
        text: textoRespuesta,
        mentions: todosLosJugadores
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, {
        text: cajaError('Ocurrió un error al sortear los equipos: ' + err.message)
      });
    }
  }
};
const juegosActivos = new Map();

module.exports = {
  name: 'genio',
  category: 'fun',
  description: 'Adivina el numero secreto del genio (1-100)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const arg = texto.slice((prefix + 'genio').length).trim().toLowerCase();

    if (arg === 'salir' || arg === 'rendirse') {
      if (juegosActivos.has(jid)) {
        const numero = juegosActivos.get(jid).numero;
        juegosActivos.delete(jid);
        return sock.sendMessage(jid, { text: `El numero secreto era *${numero}*. Juego cancelado.` }, { quoted: msg });
      }
      return sock.sendMessage(jid, { text: 'No hay ningun juego activo aqui.' }, { quoted: msg });
    }

    if (!juegosActivos.has(jid)) {
      const numero = Math.floor(Math.random() * 100) + 1;
      juegosActivos.set(jid, { numero, intentos: 0 });
      return sock.sendMessage(jid, {
        text: `🧞 *El genio ha elegido un numero secreto entre 1 y 100*\n\nEscribe ${prefix}genio <numero> para adivinar.\n${prefix}genio salir para rendirte.`
      }, { quoted: msg });
    }

    const intento = Number(arg);
    if (!arg || Number.isNaN(intento)) {
      return sock.sendMessage(jid, { text: `Escribe: ${prefix}genio <numero>` }, { quoted: msg });
    }

    const juego = juegosActivos.get(jid);
    juego.intentos++;

    if (intento === juego.numero) {
      juegosActivos.delete(jid);
      return sock.sendMessage(jid, {
        text: `🎉 ¡Correcto! El numero era *${juego.numero}*. Lo lograste en ${juego.intentos} intentos.`
      }, { quoted: msg });
    }

    const pista = intento < juego.numero ? '📈 Mas alto' : '📉 Mas bajo';
    await sock.sendMessage(jid, { text: `${pista}. Intento #${juego.intentos}` }, { quoted: msg });
  }
};

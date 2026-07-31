module.exports = {
  name: 'encuesta',
  category: 'admin',
  description: 'Crea una encuesta (ej: .encuesta Pregunta | opcion1 | opcion2)',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const contenido = texto.slice((prefix + 'encuesta ').length).trim();

    if (!contenido) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}encuesta Pregunta | opcion1 | opcion2 | opcion3`
      }, { quoted: msg });
    }

    const partes = contenido.split('|').map(p => p.trim()).filter(Boolean);
    const pregunta = partes[0];
    const opciones = partes.slice(1);

    if (!pregunta || opciones.length < 2) {
      return sock.sendMessage(jid, {
        text: `Necesitas una pregunta y al menos 2 opciones separadas por "|"\nEjemplo: ${prefix}encuesta ¿Pizza o hamburguesa? | Pizza | Hamburguesa`
      }, { quoted: msg });
    }

    if (opciones.length > 12) {
      return sock.sendMessage(jid, { text: 'Maximo 12 opciones.' }, { quoted: msg });
    }

    await sock.sendMessage(jid, {
      poll: {
        name: pregunta,
        values: opciones,
        selectableCount: 1
      }
    }, { quoted: msg });
  }
};

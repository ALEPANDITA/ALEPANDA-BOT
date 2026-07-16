const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

const CASAS = [
  { nombre: 'Gryffindor', emoji: '🦁', color: 'rojo y dorado', rasgo: 'el valor' },
  { nombre: 'Slytherin', emoji: '🐍', color: 'verde y plata', rasgo: 'la ambicion' },
  { nombre: 'Hufflepuff', emoji: '🦡', color: 'amarillo y negro', rasgo: 'la lealtad' },
  { nombre: 'Ravenclaw', emoji: '🦅', color: 'azul y bronce', rasgo: 'la sabiduria' }
];

module.exports = {
  name: 'sombrero',
  category: 'perfil',
  description: 'Deja que el Sombrero Seleccionador te asigne una casa de Hogwarts',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const perfil = getUsuario(db, remitente);

    if (perfil.casaHP) {
      const casaActual = CASAS.find(c => c.nombre === perfil.casaHP);
      return sock.sendMessage(jid, {
        text: `🎩 El Sombrero ya te asigno una casa: ${casaActual?.emoji || ''} *${perfil.casaHP}*\n\nEsa decision es definitiva... a menos que un profesor diga lo contrario 😉`
      }, { quoted: msg });
    }

    const casa = CASAS[Math.floor(Math.random() * CASAS.length)];
    perfil.casaHP = casa.nombre;
    guardarDB(db);

    const texto =
      `🎩 *El Sombrero Seleccionador piensa...*\n\n` +
      `"Veo ${casa.rasgo} en ti... no hay duda..."\n\n` +
      `${casa.emoji} *¡${casa.nombre.toUpperCase()}!*\n` +
      `🎨 Colores: ${casa.color}`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  }
};

const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

const CASAS = [
  { nombre: 'Garra Escarlata', emoji: '🐼🔥', color: 'rojo y negro', rasgo: 'la ferocidad' },
  { nombre: 'Colmillo Sombrio', emoji: '🐼⚔️', color: 'verde y gris', rasgo: 'la astucia' },
  { nombre: 'Bambu de Acero', emoji: '🐼🎋', color: 'amarillo y negro', rasgo: 'la lealtad' },
  { nombre: 'Mirada Carmesi', emoji: '🐼👁️', color: 'azul y plata', rasgo: 'la sabiduria' }
];

module.exports = {
  name: 'sombrero',
  category: 'perfil',
  description: 'Deja que el Sello Ancestral te asigne un clan panda',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const perfil = getUsuario(db, remitente);

    if (perfil.casaHP) {
      const casaActual = CASAS.find(c => c.nombre === perfil.casaHP);
      return sock.sendMessage(jid, {
        text: `🐼 El Sello Ancestral ya te asigno un clan: ${casaActual?.emoji || ''} *${perfil.casaHP}*\n\nEsa decision es definitiva... a menos que el Alfa diga lo contrario 😉`
      }, { quoted: msg });
    }

    const casa = CASAS[Math.floor(Math.random() * CASAS.length)];
    perfil.casaHP = casa.nombre;
    guardarDB(db);

    const texto =
      `🐼 *El Sello Ancestral resuena...*\n\n` +
      `"Siento ${casa.rasgo} en ti... no hay duda..."\n\n` +
      `${casa.emoji} *¡${casa.nombre.toUpperCase()}!*\n` +
      `🎨 Colores: ${casa.color}`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  }
};
